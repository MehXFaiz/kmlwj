import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
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
    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of lines) {
      totalDebit += Number(line.debit) || 0;
      totalCredit += Number(line.credit) || 0;
    }
    if (Math.abs(totalDebit - totalCredit) > 1e-3) {
      return res.status(400).json({ error: { message: "Journal entry must balance", status: 400 } });
    }
    const voucherNo = req.body.voucherNo || `JE-${Date.now()}`;
    const postedBy = req.user.email || "system";
    try {
      const result = await prisma.$transaction(async (tx) => {
        const je = await tx.journalEntry.create({
          data: {
            voucherNo,
            postingDate: new Date(postingDate || /* @__PURE__ */ new Date()),
            subsidiary: subsidiary || "Global",
            reference: reference || "Journal Entry",
            description: description || null,
            postedBy,
            status,
            voucherType
          }
        });
        for (const line of lines) {
          const account = await tx.account.findUnique({
            where: { glCode: line.accountCode }
          });
          if (!account) {
            throw new Error(`Account not found: ${line.accountCode}`);
          }
          await tx.journalEntryLine.create({
            data: {
              journalEntryId: je.id,
              accountId: account.id,
              description: line.description || null,
              debit: Number(line.debit) || 0,
              credit: Number(line.credit) || 0
            }
          });
          if (status === "Posted") {
            await tx.ledgerEntry.create({
              data: {
                accountId: account.id,
                debit: Number(line.debit) || 0,
                credit: Number(line.credit) || 0,
                reference: je.voucherNo,
                description: line.description || description || reference || "Journal Entry",
                postingDate: new Date(postingDate || /* @__PURE__ */ new Date())
              }
            });
            await tx.account.update({
              where: { id: account.id },
              data: {
                currentBalance: {
                  increment: Number(line.debit) - Number(line.credit)
                }
              }
            });
          }
        }
        return je;
      });
      await logAudit(req.user.id, "Create Journal", "Journal Entries", null, { voucherNo, reference, status, total: totalDebit }, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(201).json({ status: 201, data: result });
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
          for (const line of je.lines) {
            await tx.ledgerEntry.create({
              data: {
                accountId: line.accountId,
                debit: line.debit,
                credit: line.credit,
                reference: je.voucherNo,
                description: line.description || je.description || je.reference || "Journal Entry",
                postingDate: je.postingDate
              }
            });
            await tx.account.update({
              where: { id: line.accountId },
              data: {
                currentBalance: {
                  increment: line.debit - line.credit
                }
              }
            });
          }
        }
        if (je.status === "Posted" && status === "Cancelled") {
          for (const line of je.lines) {
            await tx.ledgerEntry.create({
              data: {
                accountId: line.accountId,
                debit: line.credit,
                credit: line.debit,
                reference: je.voucherNo + "-REV",
                description: "Reversal: " + (line.description || je.description || je.reference),
                postingDate: /* @__PURE__ */ new Date()
              }
            });
            await tx.account.update({
              where: { id: line.accountId },
              data: {
                currentBalance: {
                  increment: line.credit - line.debit
                }
              }
            });
          }
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
