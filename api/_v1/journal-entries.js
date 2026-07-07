import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { AccountingService } from "../_services/accounting.service.js";
var journal_entries_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  if (method === "GET") {
    const { subsidiary, limit = "100", page = "1", type } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;
    const whereClause = {};
    if (subsidiary && subsidiary !== "Global") {
      whereClause.subsidiary = subsidiary;
    }
    if (type) {
      whereClause.voucherType = type;
    }
    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where: whereClause,
        include: {
          lines: {
            include: { account: true }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum
      }),
      prisma.journalEntry.count({ where: whereClause })
    ]);
    const formatted = entries.map((je) => ({
      id: je.voucherNo,
      dbId: je.id,
      voucherNo: je.voucherNo,
      postingDate: je.postingDate.toISOString().split("T")[0],
      subsidiary: je.subsidiary,
      reference: je.reference,
      description: je.description,
      postedBy: je.postedBy,
      status: je.status,
      voucherType: je.voucherType,
      lines: je.lines.map((line) => ({
        id: line.id,
        accountCode: line.account.glCode,
        description: line.description,
        debit: line.debit,
        credit: line.credit
      }))
    }));
    return res.status(200).json({ status: 200, data: formatted, meta: { total, page: pageNum, limit: limitNum } });
  }
  if (method === "POST") {
    const { postingDate, subsidiary, reference, description, status = "Draft", lines, voucherType = "JV" } = req.body;
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: { message: "Lines are required", status: 400 } });
    }
    const voucherNo = req.body.voucherNo;
    const postedBy = req.user.id || req.user.email || "system";
    try {
      const result = await prisma.$transaction(async (tx) => {
        const payloadLines = lines.map((l) => ({
          accountCode: l.accountCode,
          accountId: l.accountId,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description || description || reference
        }));
        return await AccountingService.postTransaction(tx, {
          voucherNo,
          postingDate: postingDate ? new Date(postingDate) : /* @__PURE__ */ new Date(),
          subsidiary: subsidiary || "Global",
          reference: reference || "Journal Entry",
          description: description || "Journal Entry",
          module: "Journal Entries",
          voucherType,
          postedBy,
          status,
          lines: payloadLines,
          ipAddress: req.headers["x-forwarded-for"],
          userAgent: req.headers["user-agent"]
        });
      });
      return res.status(201).json({ status: 201, data: result.journalEntry });
    } catch (err) {
      return res.status(400).json({ error: { message: err.message, status: 400 } });
    }
  }
  if (method === "PATCH" || method === "PUT") {
    const { id, status, reference, description, postingDate, amount, lines } = req.body;
    if (!id) {
      return res.status(400).json({ error: { message: "Missing journal entry id", status: 400 } });
    }
    try {
      const result = await prisma.$transaction(async (tx) => {
        const je = await tx.journalEntry.findUnique({
          where: { id },
          include: { lines: true }
        });
        if (!je) throw new Error("Journal entry not found");
        const isStatusChangeOnly = status && status !== je.status && reference === void 0 && description === void 0 && postingDate === void 0 && amount === void 0 && !lines;
        if (isStatusChangeOnly) {
          if (je.status === status) return je;
          if (je.status === "Draft" && status === "Posted") {
            return await AccountingService.postDraft(tx, id, req.user.id);
          }
          if (je.status === "Posted" && status === "Cancelled") {
            return await AccountingService.reverseJournalEntry(tx, id, req.user.id, req.body.reason);
          }
          const updatedJe = await tx.journalEntry.update({
            where: { id },
            data: { status }
          });
          return updatedJe;
        }
        const newDate = postingDate ? new Date(postingDate) : je.postingDate;
        const newRef = reference !== void 0 ? reference : je.reference;
        const newDesc = description !== void 0 ? description : je.description;
        const newStatus = status || je.status;
        await tx.journalEntry.update({
          where: { id },
          data: {
            postingDate: newDate,
            reference: newRef,
            description: newDesc !== void 0 ? newDesc || null : void 0,
            status: newStatus
          }
        });
        if (amount !== void 0 && !lines && je.lines.length > 0) {
          const numAmount = Number(amount);
          for (const l of je.lines) {
            const newDebit = l.debit > 0 ? numAmount : l.debit;
            const newCredit = l.credit > 0 ? numAmount : l.credit;
            const lineDesc = newDesc !== void 0 ? newDesc : l.description;
            await tx.journalEntryLine.update({
              where: { id: l.id },
              data: {
                debit: newDebit,
                credit: newCredit,
                description: lineDesc
              }
            });
          }
        } else if (lines && Array.isArray(lines) && lines.length > 0) {
          await tx.journalEntryLine.deleteMany({
            where: { journalEntryId: je.id }
          });
          for (const l of lines) {
            await tx.journalEntryLine.create({
              data: {
                journalEntryId: je.id,
                accountId: l.accountId,
                description: l.description || newDesc || newRef || je.description,
                debit: Number(l.debit) || 0,
                credit: Number(l.credit) || 0
              }
            });
          }
        }
        if (newStatus === "Posted" || newStatus === "POSTED") {
          await tx.ledgerEntry.deleteMany({
            where: { reference: { in: [je.voucherNo, `${je.voucherNo}-REV`] } }
          });
          const updatedLines = await tx.journalEntryLine.findMany({ where: { journalEntryId: je.id } });
          for (const l of updatedLines) {
            await tx.ledgerEntry.create({
              data: {
                accountId: l.accountId,
                debit: l.debit,
                credit: l.credit,
                reference: je.voucherNo,
                description: l.description || newDesc || newRef || je.description,
                postingDate: newDate
              }
            });
            await AccountingService.recalculateAccountBalance(tx, l.accountId);
          }
        }
        return await tx.journalEntry.findUnique({ where: { id }, include: { lines: true } });
      });
      await logAudit(req.user.id, "Update Journal Entry", "Journal Entries", null, { id, status, reference, amount }, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, data: result });
    } catch (err) {
      return res.status(400).json({ error: { message: err.message, status: 400 } });
    }
  }
  if (method === "DELETE") {
    const idsRaw = req.body?.ids || req.body?.id || req.query.ids || req.query.id;
    if (!idsRaw) {
      return res.status(400).json({ error: { message: "Journal Entry ID(s) required", status: 400 } });
    }
    const ids = Array.isArray(idsRaw) ? idsRaw.map(String) : String(idsRaw).split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      return res.status(400).json({ error: { message: "No valid ID provided", status: 400 } });
    }
    try {
      const deletedEntries = await prisma.$transaction(async (tx) => {
        const results = [];
        for (const id of ids) {
          const resJe = await AccountingService.deleteJournalEntry(tx, id, req.user.id, "Admin Deleted");
          if (resJe) results.push(resJe);
        }
        return results;
      });
      await logAudit(
        req.user.id,
        "Delete Journal Entry",
        "Journal Entries",
        null,
        { count: deletedEntries.length, ids: deletedEntries.map((e) => e.id) },
        req.headers["x-forwarded-for"],
        req.headers["user-agent"]
      );
      return res.status(200).json({
        status: 200,
        message: `${deletedEntries.length} journal entry(s) deleted successfully`,
        data: deletedEntries
      });
    } catch (err) {
      return res.status(400).json({ error: { message: err.message, status: 400 } });
    }
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  journal_entries_default as default
};
