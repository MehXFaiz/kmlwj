import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
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
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  simple_expense_default as default
};
