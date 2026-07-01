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
  if (method === "PATCH") {
    const { id, status } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: { message: "Missing id or status", status: 400 } });
    }
    try {
      const result = await prisma.$transaction(async (tx) => {
        const je = await tx.journalEntry.findUnique({
          where: { id },
          include: { lines: true }
        });
        if (!je) throw new Error("Journal entry not found");
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
      });
      await logAudit(req.user.id, "Update Journal Status", "Journal Entries", null, { id, status }, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, data: result });
    } catch (err) {
      return res.status(400).json({ error: { message: err.message, status: 400 } });
    }
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  journal_entries_default as default
};
