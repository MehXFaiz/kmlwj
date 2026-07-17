import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
var general_ledger_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (req.method === "GET") {
    const { startDate, endDate, accountId, glCode, page = "1", limit = "100" } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;
    let targetAccount = null;
    if (accountId) {
      targetAccount = await prisma.account.findUnique({ where: { id: accountId }, include: { accountType: true } });
    } else if (glCode) {
      targetAccount = await prisma.account.findUnique({ where: { glCode }, include: { accountType: true } });
    }
    if (!targetAccount && (accountId || glCode)) {
      return res.status(404).json({ error: { message: "Account not found", status: 404 } });
    }
    const entryWhere = {};
    if (targetAccount) {
      entryWhere.accountId = targetAccount.id;
    }
    if (startDate || endDate) {
      entryWhere.postingDate = {};
      if (startDate) entryWhere.postingDate.gte = new Date(startDate);
      if (endDate) entryWhere.postingDate.lte = new Date(endDate);
    }
    const [entries, total] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where: entryWhere,
        include: { account: { select: { glCode: true, accountName: true, initialBalance: true, accountType: { select: { name: true } } } } },
        orderBy: { postingDate: "asc" },
        skip,
        take: limitNum
      }),
      prisma.ledgerEntry.count({ where: entryWhere })
    ]);
    const uniqueAccountIds = [...new Set(entries.map((e) => e.accountId))];
    const accountMeta = {};
    for (const accId of uniqueAccountIds) {
      const firstEntry = entries.find((e) => e.accountId === accId);
      const initialBal = firstEntry?.account?.initialBalance || 0;
      const typeName = firstEntry?.account?.accountType?.name?.toUpperCase() || "ASSET";
      const glCode2 = firstEntry?.account?.glCode || "";
      const name = firstEntry?.account?.accountName || "";
      let opBal = initialBal;
      if (startDate) {
        const prior = await prisma.ledgerEntry.aggregate({
          where: {
            accountId: accId,
            postingDate: { lt: new Date(startDate) }
          },
          _sum: { debit: true, credit: true }
        });
        const pDebit = prior._sum.debit || 0;
        const pCredit = prior._sum.credit || 0;
        if (["ASSET", "EXPENSE"].includes(typeName)) {
          opBal += pDebit - pCredit;
        } else {
          opBal += pCredit - pDebit;
        }
      }
      accountMeta[glCode2] = { openingBalance: opBal, type: typeName, initialBalance: initialBal, name };
    }
    let openingBalance = 0;
    if (targetAccount) {
      openingBalance = targetAccount.initialBalance || 0;
      if (startDate) {
        const priorEntries = await prisma.ledgerEntry.aggregate({
          where: {
            accountId: targetAccount.id,
            postingDate: { lt: new Date(startDate) }
          },
          _sum: { debit: true, credit: true }
        });
        const priorDebit = priorEntries._sum.debit || 0;
        const priorCredit = priorEntries._sum.credit || 0;
        const typeName = targetAccount.accountType?.name?.toUpperCase() || "ASSET";
        if (["ASSET", "EXPENSE"].includes(typeName)) {
          openingBalance += priorDebit - priorCredit;
        } else {
          openingBalance += priorCredit - priorDebit;
        }
      }
    } else if (entries.length > 0) {
      openingBalance = 0;
    }
    let totalDebit = 0;
    let totalCredit = 0;
    const formattedEntries = entries.map((entry) => {
      totalDebit += entry.debit;
      totalCredit += entry.credit;
      return {
        id: entry.id,
        date: entry.postingDate.toISOString().split("T")[0],
        glCode: entry.account.glCode,
        accountName: entry.account.accountName,
        reference: entry.reference,
        description: entry.description,
        debit: entry.debit,
        credit: entry.credit
      };
    });
    let closingBalance = 0;
    if (targetAccount) {
      const typeName = targetAccount.accountType?.name?.toUpperCase() || "ASSET";
      if (["ASSET", "EXPENSE"].includes(typeName)) {
        closingBalance = openingBalance + totalDebit - totalCredit;
      } else {
        closingBalance = openingBalance + totalCredit - totalDebit;
      }
    }
    return res.status(200).json({
      status: 200,
      data: {
        account: targetAccount ? {
          glCode: targetAccount.glCode,
          name: targetAccount.accountName,
          type: targetAccount.accountType?.name || "Unknown"
        } : null,
        summary: {
          openingBalance,
          totalDebit,
          totalCredit,
          closingBalance: targetAccount ? closingBalance : null
        },
        accountMeta,
        entries: formattedEntries
      },
      meta: { total, page: pageNum, limit: limitNum }
    });
  }
  if (req.method === "POST") {
    return res.status(400).json({
      error: {
        message: "Manual General Ledger entries are strictly prohibited. All General Ledger entries must be automatically generated from Journal Entries.",
        status: 400
      }
    });
  }
  if (req.method === "DELETE") {
    return res.status(400).json({
      error: {
        message: "General Ledger entries cannot be deleted directly \u2014 they are automatically generated from Journal Entries. Delete or reverse the source Journal Entry instead.",
        status: 400
      }
    });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  general_ledger_default as default
};
