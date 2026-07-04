import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { AccountingService } from "../_services/accounting.service.js";
async function getIncomeAccountForCategory(category, tx) {
  let acc = await tx.account.findFirst({
    where: {
      accountType: { name: { equals: "Revenue", mode: "insensitive" } },
      accountName: { contains: category, mode: "insensitive" },
      accountLevel: { in: ["SUBSIDIARY", "GL"] },
      isLocked: false
    }
  });
  if (!acc) {
    let searchTerm = category;
    if (category === "Membership Fee" || category === "Bus Booking") searchTerm = "Income";
    acc = await tx.account.findFirst({
      where: {
        accountType: { name: { equals: "Revenue", mode: "insensitive" } },
        accountName: { contains: searchTerm, mode: "insensitive" },
        accountLevel: { in: ["SUBSIDIARY", "GL"] },
        isLocked: false
      }
    });
  }
  if (!acc) {
    acc = await tx.account.findFirst({
      where: {
        accountType: { name: { equals: "Revenue", mode: "insensitive" } },
        isLocked: false
      }
    });
  }
  return acc;
}
var revenue_collections_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const action = req.query.action;
  const categoryFilter = req.query.category;
  if (method === "GET") {
    const whereClause = categoryFilter ? { category: categoryFilter } : {};
    const collections = await prisma.revenueCollection.findMany({
      where: whereClause,
      include: {
        bankAccount: true,
        createdBy: { select: { id: true, fullName: true, email: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return res.status(200).json({ status: 200, data: collections });
  }
  if (method === "POST") {
    if (action === "approve") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: { message: "Collection ID is required", status: 400 } });
      const item = await prisma.revenueCollection.findUnique({ where: { id }, include: { bankAccount: true } });
      if (!item) return res.status(404).json({ error: { message: "Record not found", status: 404 } });
      if (item.status === "POSTED") return res.status(400).json({ error: { message: "Record is already posted to ledger", status: 400 } });
      let debitAccountId2 = null;
      if (item.paymentMethod === "CASH") {
        const cashAccount = await prisma.account.findFirst({
          where: { accountName: { contains: "Cash", mode: "insensitive" } }
        });
        if (!cashAccount) return res.status(400).json({ error: { message: "Cash account not found in Chart of Accounts", status: 400 } });
        debitAccountId2 = cashAccount.id;
      } else {
        if (!item.bankAccountId) return res.status(400).json({ error: { message: "Bank account is required for BANK/CHEQUE payments", status: 400 } });
        debitAccountId2 = item.bankAccountId;
      }
      const result2 = await prisma.$transaction(async (tx) => {
        const incomeAccount = await getIncomeAccountForCategory(item.category, tx);
        if (!incomeAccount) {
          throw new Error(`No revenue account found in Chart of Accounts for ${item.category}`);
        }
        const postingResult = await AccountingService.postReceipt(tx, {
          amount: item.amount,
          cashOrBankAccountId: debitAccountId2,
          incomeAccountId: incomeAccount.id,
          reference: `${item.category.slice(0, 3).toUpperCase()}-${item.receiptNo}`,
          description: `${item.category} Receipt from ${item.title} ${item.subTitle ? `(${item.subTitle})` : ""}`,
          module: item.category,
          voucherType: "BR",
          postedBy: req.user.id,
          postingDate: item.eventDate || /* @__PURE__ */ new Date(),
          ipAddress: req.headers["x-forwarded-for"],
          userAgent: req.headers["user-agent"]
        });
        const approvedItem = await tx.revenueCollection.update({
          where: { id },
          data: {
            status: "POSTED",
            journalEntryId: postingResult.journalEntry.id
          }
        });
        return { approvedItem, journalEntry: postingResult.journalEntry };
      });
      await logAudit(req.user.id, `Post ${item.category}`, "REVENUE", item, result2.approvedItem, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, data: result2.approvedItem, message: `${item.category} posted to ledger successfully` });
    }
    const { category, title, subTitle, mobile, eventDate, quantity, rate, destination, amount, paymentMethod, bankAccountId, chequeNumber, remarks } = req.body;
    if (!category || !title || !amount || !paymentMethod) {
      return res.status(400).json({ error: { message: "Missing required fields (category, title, amount, paymentMethod)", status: 400 } });
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: { message: "Amount must be greater than 0", status: 400 } });
    }
    if ((paymentMethod === "BANK" || paymentMethod === "CHEQUE") && !bankAccountId) {
      return res.status(400).json({ error: { message: "Bank account is required for Bank/Cheque payment methods", status: 400 } });
    }
    let debitAccountId = null;
    if (paymentMethod === "CASH") {
      const cashAccount = await prisma.account.findFirst({
        where: { accountName: { contains: "Cash", mode: "insensitive" } }
      });
      if (!cashAccount) return res.status(400).json({ error: { message: "Cash account not found in Chart of Accounts", status: 400 } });
      debitAccountId = cashAccount.id;
    } else {
      debitAccountId = bankAccountId;
    }
    const result = await prisma.$transaction(async (tx) => {
      const incomeAccount = await getIncomeAccountForCategory(category, tx);
      if (!incomeAccount) {
        throw new Error(`No revenue account found in Chart of Accounts for ${category}`);
      }
      const count = await tx.revenueCollection.count({ where: { category } });
      const refNo = count + 1;
      const postingResult = await AccountingService.postReceipt(tx, {
        amount: parsedAmount,
        cashOrBankAccountId: debitAccountId,
        incomeAccountId: incomeAccount.id,
        reference: `${category.slice(0, 3).toUpperCase()}-${refNo}`,
        description: `${category} Receipt from ${title} ${subTitle ? `(${subTitle})` : ""}`,
        module: category,
        voucherType: "BR",
        postedBy: req.user.id,
        postingDate: eventDate ? new Date(eventDate) : /* @__PURE__ */ new Date(),
        ipAddress: req.headers["x-forwarded-for"],
        userAgent: req.headers["user-agent"]
      });
      const newItem = await tx.revenueCollection.create({
        data: {
          category,
          // receiptNo is autoincrement — do NOT set it manually
          title,
          subTitle: subTitle || null,
          mobile: mobile || null,
          eventDate: eventDate ? new Date(eventDate) : /* @__PURE__ */ new Date(),
          quantity: quantity ? parseInt(quantity, 10) : null,
          rate: rate ? parseFloat(rate) : null,
          destination: destination || null,
          amount: parsedAmount,
          paymentMethod,
          bankAccountId: bankAccountId || null,
          chequeNumber: chequeNumber || null,
          status: "POSTED",
          remarks: remarks || null,
          journalEntryId: postingResult.journalEntry.id,
          createdById: req.user.id
        },
        include: {
          bankAccount: true,
          journalEntry: true
        }
      });
      return newItem;
    });
    await logAudit(req.user.id, `Create & Post ${category}`, "REVENUE", null, result, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(201).json({ status: 201, data: result });
  }
  if (method === "DELETE") {
    const idsRaw = req.body?.ids || req.body?.id || req.query.ids || req.query.id;
    if (!idsRaw) {
      return res.status(400).json({ error: { message: "Record ID(s) required", status: 400 } });
    }
    const ids = Array.isArray(idsRaw) ? idsRaw.map(String) : String(idsRaw).split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      return res.status(400).json({ error: { message: "No valid ID provided", status: 400 } });
    }
    try {
      const deletedItems = await prisma.$transaction(async (tx) => {
        const items = await tx.revenueCollection.findMany({
          where: { id: { in: ids } }
        });
        if (items.length === 0) {
          throw new Error("No records found to delete");
        }
        for (const item of items) {
          if (item.status === "POSTED" && item.journalEntryId) {
            try {
              await AccountingService.deleteJournalEntry(tx, item.journalEntryId, req.user.id, `${item.category} Deleted`);
            } catch (e) {
            }
          }
        }
        await tx.revenueCollection.deleteMany({
          where: { id: { in: items.map((i) => i.id) } }
        });
        return items;
      });
      await logAudit(
        req.user.id,
        "Delete Revenue Collection",
        "REVENUE",
        null,
        { count: deletedItems.length, ids: deletedItems.map((i) => i.id) },
        req.headers["x-forwarded-for"],
        req.headers["user-agent"]
      );
      return res.status(200).json({
        status: 200,
        message: `${deletedItems.length} record(s) deleted successfully`,
        data: deletedItems
      });
    } catch (err) {
      return res.status(400).json({ error: { message: err.message || "Failed to delete record(s)", status: 400 } });
    }
  }
  if (method === "PUT") {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: { message: "Record ID is required", status: 400 } });
    }
    const existingItem = await prisma.revenueCollection.findUnique({ where: { id } });
    if (!existingItem) {
      return res.status(404).json({ error: { message: "Record not found", status: 404 } });
    }
    const { category, title, subTitle, mobile, eventDate, quantity, rate, destination, amount, paymentMethod, bankAccountId, chequeNumber, remarks } = req.body;
    if (!category || !title || !amount || !paymentMethod) {
      return res.status(400).json({ error: { message: "Missing required fields (category, title, amount, paymentMethod)", status: 400 } });
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: { message: "Amount must be greater than 0", status: 400 } });
    }
    if ((paymentMethod === "BANK" || paymentMethod === "CHEQUE") && !bankAccountId) {
      return res.status(400).json({ error: { message: "Bank account is required for Bank/Cheque payment methods", status: 400 } });
    }
    const updatedItem = await prisma.$transaction(async (tx) => {
      if (existingItem.journalEntryId) {
        try {
          await AccountingService.deleteJournalEntry(tx, existingItem.journalEntryId, req.user.id, `Reversing ${category} for update`);
        } catch (e) {
        }
      }
      let debitAccountId = null;
      if (paymentMethod === "CASH") {
        const cashAccount = await tx.account.findFirst({
          where: { accountName: { contains: "Cash", mode: "insensitive" } }
        });
        if (!cashAccount) throw new Error("Cash account not found in Chart of Accounts");
        debitAccountId = cashAccount.id;
      } else {
        debitAccountId = bankAccountId;
      }
      const incomeAccount = await getIncomeAccountForCategory(category, tx);
      if (!incomeAccount) {
        throw new Error(`No revenue account found in Chart of Accounts for ${category}`);
      }
      const postingResult = await AccountingService.postReceipt(tx, {
        amount: parsedAmount,
        cashOrBankAccountId: debitAccountId,
        incomeAccountId: incomeAccount.id,
        reference: `${category.slice(0, 3).toUpperCase()}-${existingItem.receiptNo}`,
        description: `${category} Receipt from ${title} ${subTitle ? `(${subTitle})` : ""}`,
        module: category,
        voucherType: "BR",
        postedBy: req.user.id,
        postingDate: eventDate ? new Date(eventDate) : /* @__PURE__ */ new Date(),
        ipAddress: req.headers["x-forwarded-for"],
        userAgent: req.headers["user-agent"]
      });
      return await tx.revenueCollection.update({
        where: { id },
        data: {
          category,
          title,
          subTitle: subTitle || null,
          mobile: mobile || null,
          eventDate: eventDate ? new Date(eventDate) : /* @__PURE__ */ new Date(),
          quantity: quantity ? parseInt(quantity, 10) : null,
          rate: rate ? parseFloat(rate) : null,
          destination: destination || null,
          amount: parsedAmount,
          paymentMethod,
          bankAccountId: bankAccountId || null,
          chequeNumber: chequeNumber || null,
          status: "POSTED",
          remarks: remarks || null,
          journalEntryId: postingResult.journalEntry.id
        },
        include: {
          bankAccount: true,
          journalEntry: true
        }
      });
    });
    await logAudit(req.user.id, `Update & Post ${category}`, "REVENUE", existingItem, updatedItem, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, data: updatedItem });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  revenue_collections_default as default
};
