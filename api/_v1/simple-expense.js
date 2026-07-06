import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { AccountingService } from "../_services/accounting.service.js";
var simple_expense_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (req.method === "GET") {
    const expenses = await prisma.simpleExpense.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        expenseHead: true,
        createdBy: { select: { fullName: true } }
      }
    });
    return res.status(200).json({ status: 200, data: expenses });
  }
  if (req.method === "POST") {
    const { date, expenseHeadId, paidTo, description, amount, paymentMethod, bankAccountId, reference } = req.body;
    if (!expenseHeadId || !amount) {
      return res.status(400).json({ error: { message: "Missing required fields", status: 400 } });
    }
    const result = await prisma.$transaction(async (tx) => {
      const expenseHead = await tx.expenseHead.findUnique({
        where: { id: expenseHeadId },
        include: { subsidiaryAccount: true }
      });
      if (!expenseHead || !expenseHead.subsidiaryAccount) {
        throw new Error("Expense head or associated account not found");
      }
      let creditAccountCode;
      if (paymentMethod === "BANK" && bankAccountId) {
        const bankAcc = await tx.account.findUnique({ where: { id: bankAccountId } });
        if (!bankAcc) throw new Error("Bank account not found");
        creditAccountCode = bankAcc.code;
      } else {
        const cashAcc = await tx.account.findFirst({
          where: { name: { contains: "Cash", mode: "insensitive" }, type: "Asset" }
        });
        if (!cashAcc) throw new Error("Cash account not found. Please create a Cash account first.");
        creditAccountCode = cashAcc.code;
      }
      const journalEntry = await tx.journalEntry.create({
        data: {
          date: new Date(date),
          reference: reference || "Expense Payment",
          description: description || `Expense for ${expenseHead.name}`,
          status: "POSTED",
          // Auto-post simple expenses for operators
          createdById: req.user.id,
          lines: {
            create: [
              { accountCode: expenseHead.subsidiaryAccount.code, debit: amount, credit: 0, description },
              { accountCode: creditAccountCode, debit: 0, credit: amount, description }
            ]
          }
        }
      });
      const expense = await tx.simpleExpense.create({
        data: {
          date: new Date(date),
          expenseHeadId,
          paidTo,
          description,
          amount,
          paymentMethod,
          bankAccountId,
          reference,
          journalEntryId: journalEntry.id,
          createdById: req.user.id
        },
        include: { expenseHead: true }
      });
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: "Create Simple Expense",
          module: "Expense",
          details: `Added expense of ${amount} for ${expenseHead.name}`
        }
      });
      return expense;
    });
    return res.status(201).json({ status: 201, data: result });
  }
  if (req.method === "PUT" || req.method === "PATCH") {
    const { id, date, expenseHeadId, paidTo, description, amount, paymentMethod, bankAccountId, reference } = req.body;
    if (!id || !expenseHeadId || !amount) {
      return res.status(400).json({ error: { message: "Missing required fields", status: 400 } });
    }
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.simpleExpense.findUnique({ where: { id }, include: { expenseHead: true } });
      if (!existing) throw new Error("Expense not found");
      if (existing.journalEntryId) {
        try {
          await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user.id, "Simple Expense Updated");
        } catch (e) {
        }
      }
      const expenseHead = await tx.expenseHead.findUnique({
        where: { id: expenseHeadId },
        include: { subsidiaryAccount: true }
      });
      if (!expenseHead || !expenseHead.subsidiaryAccount) {
        throw new Error("Expense head or associated account not found");
      }
      let creditAccountCode;
      if (paymentMethod === "BANK" && bankAccountId) {
        const bankAcc = await tx.account.findUnique({ where: { id: bankAccountId } });
        if (!bankAcc) throw new Error("Bank account not found");
        creditAccountCode = bankAcc.code;
      } else {
        const cashAcc = await tx.account.findFirst({
          where: { name: { contains: "Cash", mode: "insensitive" }, type: "Asset" }
        });
        if (!cashAcc) throw new Error("Cash account not found.");
        creditAccountCode = cashAcc.code;
      }
      const journalEntry = await tx.journalEntry.create({
        data: {
          date: new Date(date),
          reference: reference || "Expense Payment",
          description: description || `Expense for ${expenseHead.name}`,
          status: "POSTED",
          createdById: req.user.id,
          lines: {
            create: [
              { accountCode: expenseHead.subsidiaryAccount.code, debit: amount, credit: 0, description },
              { accountCode: creditAccountCode, debit: 0, credit: amount, description }
            ]
          }
        }
      });
      const updated = await tx.simpleExpense.update({
        where: { id },
        data: {
          date: new Date(date),
          expenseHeadId,
          paidTo,
          description,
          amount,
          paymentMethod,
          bankAccountId,
          reference,
          journalEntryId: journalEntry.id
        },
        include: { expenseHead: true, createdBy: { select: { fullName: true } } }
      });
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: "Update Simple Expense",
          module: "Expense",
          details: `Updated expense of ${amount} for ${expenseHead.name}`
        }
      });
      return updated;
    });
    return res.status(200).json({ status: 200, data: result });
  }
  if (req.method === "DELETE") {
    const id = req.query.id || req.body.id;
    if (!id) return res.status(400).json({ error: { message: "Expense ID required", status: 400 } });
    await prisma.$transaction(async (tx) => {
      const existing = await tx.simpleExpense.findUnique({ where: { id: String(id) } });
      if (existing && existing.journalEntryId) {
        try {
          await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user.id, "Simple Expense Deleted");
        } catch (e) {
        }
      }
      if (existing) {
        await tx.simpleExpense.delete({ where: { id: String(id) } });
      }
    });
    return res.status(200).json({ status: 200, message: "Expense deleted successfully" });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  simple_expense_default as default
};
