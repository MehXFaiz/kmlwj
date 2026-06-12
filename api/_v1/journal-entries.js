import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
var journal_entries_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  if (method === "GET") {
    const { subsidiary, limit = "100", page = "1" } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;
    const whereClause = {};
    if (subsidiary && subsidiary !== "Global") {
      whereClause.subsidiary = subsidiary;
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
      id: je.jeNumber,
      dbId: je.id,
      date: je.date.toISOString().split("T")[0],
      subsidiary: je.subsidiary,
      reference: je.reference,
      postedBy: je.postedBy,
      status: je.status,
      lines: je.lines.map((line) => ({
        accountCode: line.account.glCode,
        description: line.description,
        debit: line.debit,
        credit: line.credit
      }))
    }));
    return res.status(200).json({ status: 200, data: formatted, meta: { total, page: pageNum, limit: limitNum } });
  }
  if (method === "POST") {
    const { date, subsidiary, reference, lines } = req.body;
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
    const jeNumber = `JE-${Date.now()}`;
    const postedBy = req.user.email || "system";
    try {
      const result = await prisma.$transaction(async (tx) => {
        const je = await tx.journalEntry.create({
          data: {
            jeNumber,
            date: new Date(date || /* @__PURE__ */ new Date()),
            subsidiary: subsidiary || "Global",
            reference: reference || "Journal Entry",
            postedBy,
            status: "Posted"
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
          await tx.ledgerEntry.create({
            data: {
              accountId: account.id,
              debit: Number(line.debit) || 0,
              credit: Number(line.credit) || 0,
              reference: je.jeNumber,
              description: line.description || reference || "Journal Entry",
              postingDate: new Date(date || /* @__PURE__ */ new Date())
            }
          });
        }
        return je;
      });
      await logAudit(req.user.id, "Post Journal", "Journal Entries", null, { jeNumber, reference, total: totalDebit }, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(201).json({ status: 201, data: result });
    } catch (err) {
      return res.status(400).json({ error: { message: err.message, status: 400 } });
    }
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  journal_entries_default as default
};
