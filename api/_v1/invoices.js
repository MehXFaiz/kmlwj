import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { AccountingService } from "../_services/accounting.service.js";
import { PERMS } from "../_constants/permissions.js";
function generateInvoiceNumber() {
  const date = /* @__PURE__ */ new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${year}${month}-${randomStr}`;
}
function isUniqueViolation(err) {
  return err?.code === "P2002";
}
function computeInvoiceTotals(items, tax, discount) {
  const subtotal = Math.round(
    items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0) * 100
  ) / 100;
  const total = Math.round((subtotal + tax - discount) * 100) / 100;
  return { subtotal, total };
}
function generateVoucherNumber(prefix = "JV") {
  const date = /* @__PURE__ */ new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${year}${month}-${randomStr}`;
}
async function getOrCreateAccountsReceivable(tx) {
  let arAccount = await tx.account.findFirst({
    where: { accountName: { contains: "Accounts Receivable", mode: "insensitive" } }
  });
  if (!arAccount) {
    const currentAsset = await tx.account.findFirst({
      where: { glCode: "1010000" }
    });
    if (!currentAsset) {
      throw new Error("Current Assets account (1010000) not found in Chart of Accounts.");
    }
    let newGlCode = "1010200";
    let codeExists = true;
    while (codeExists) {
      const existing = await tx.account.findFirst({ where: { glCode: newGlCode } });
      if (existing) {
        newGlCode = (parseInt(newGlCode) + 1).toString();
      } else {
        codeExists = false;
      }
    }
    arAccount = await tx.account.create({
      data: {
        glCode: newGlCode,
        accountName: "Accounts Receivable",
        accountLevel: "SUBSIDIARY",
        parentId: currentAsset.id,
        accountTypeId: currentAsset.accountTypeId,
        detailType: "Accounts Receivable",
        description: "Standard Accounts Receivable account",
        currency: "PKR",
        subsidiary: ["Global"],
        initialBalance: 0,
        currentBalance: 0,
        isSystemDefined: true
      }
    });
  }
  return arAccount;
}
var invoices_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (!await verifyPermission(req, res, PERMS.MANAGE_INVOICES)) return;
  const { method } = req;
  const id = req.query.id;
  const action = req.query.action || req.body?.action;
  if (method === "GET") {
    if (id && !req.query.limit) {
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
          customer: true,
          items: true,
          bankAccount: true
        }
      });
      if (!invoice) {
        return res.status(404).json({ error: { message: "Invoice not found", status: 404 } });
      }
      return res.status(200).json({ status: 200, data: invoice });
    }
    const { limit = "1000", page = "1" } = req.query;
    const limitNum = parseInt(limit) || 1e3;
    const pageNum = parseInt(page) || 1;
    const skip = (pageNum - 1) * limitNum;
    const whereClause = getDeletedFilter(req.query);
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: whereClause,
        include: {
          customer: true,
          items: true
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum
      }),
      prisma.invoice.count({ where: whereClause })
    ]);
    return res.status(200).json({ status: 200, data: invoices, meta: { total, page: pageNum, limit: limitNum } });
  }
  if (method === "PUT" || method === "POST" || method === "PATCH") {
    if (action === "restore") {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can restore records", status: 403 } });
      }
      const targetId = id || req.body?.id;
      if (!targetId) {
        return res.status(400).json({ error: { message: "Invoice ID is required", status: 400 } });
      }
      const existing = await prisma.invoice.findUnique({ where: { id: targetId } });
      if (!existing) {
        return res.status(404).json({ error: { message: "Invoice not found", status: 404 } });
      }
      const restored = await prisma.invoice.update({
        where: { id: targetId },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      await logAudit(req.user.id, "Restore Invoice", "INVOICE", existing, restored, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, message: "Invoice restored successfully", data: restored });
    }
  }
  if (method === "POST") {
    if (action === "post") {
      const { id: invoiceId, revenueAccountId } = req.body;
      if (!invoiceId || !revenueAccountId) {
        return res.status(400).json({ error: { message: "Invoice ID and Revenue Account ID are required to post", status: 400 } });
      }
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { customer: true }
      });
      if (!invoice) return res.status(404).json({ error: { message: "Invoice not found", status: 404 } });
      if (invoice.status !== "DRAFT") return res.status(400).json({ error: { message: "Only DRAFT invoices can be posted", status: 400 } });
      const revenueAccount = await prisma.account.findUnique({ where: { id: revenueAccountId } });
      if (!revenueAccount) return res.status(400).json({ error: { message: "Revenue account not found", status: 400 } });
      const result = await prisma.$transaction(async (tx) => {
        const arAccount = await getOrCreateAccountsReceivable(tx);
        const updatedInvoice = await tx.invoice.update({
          where: { id: invoiceId },
          data: { status: "POSTED" },
          include: { customer: true, items: true, bankAccount: true }
        });
        const postingResult = await AccountingService.postTransaction(tx, {
          voucherType: "JV",
          reference: `POST-${invoice.invoiceNo}`,
          description: `Invoice posted to ${invoice.customer.name} - Inv #${invoice.invoiceNo}`,
          module: "Invoices",
          postedBy: req.user.id,
          lines: [
            { accountId: arAccount.id, debit: invoice.total, credit: 0, description: "Accounts Receivable Debit" },
            { accountId: revenueAccount.id, debit: 0, credit: invoice.total, description: "Sales/Revenue Credit" }
          ],
          ipAddress: req.headers["x-forwarded-for"],
          userAgent: req.headers["user-agent"]
        });
        return { updatedInvoice, journalEntry: postingResult.journalEntry };
      });
      await logAudit(req.user.id, "Post Invoice", "INVOICE", invoice, result.updatedInvoice, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, data: result.updatedInvoice, message: "Invoice posted and ledger transactions logged successfully" });
    }
    if (action === "pay") {
      const { id: invoiceId, bankAccountId, paymentMethod, chequeNumber } = req.body;
      if (!invoiceId || !paymentMethod || !bankAccountId) {
        return res.status(400).json({ error: { message: "Invoice ID, Payment Method, and Bank/Cash Account ID are required", status: 400 } });
      }
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { customer: true }
      });
      if (!invoice) return res.status(404).json({ error: { message: "Invoice not found", status: 404 } });
      if (invoice.status !== "POSTED") return res.status(400).json({ error: { message: "Invoice must be in POSTED status to record a payment", status: 400 } });
      const destAccount = await prisma.account.findUnique({ where: { id: bankAccountId } });
      if (!destAccount) return res.status(400).json({ error: { message: "Destination Cash/Bank account not found", status: 400 } });
      const result = await prisma.$transaction(async (tx) => {
        const arAccount = await getOrCreateAccountsReceivable(tx);
        const updatedInvoice = await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            status: "PAID",
            paymentMethod,
            bankAccountId,
            chequeNumber: chequeNumber || null
          },
          include: { customer: true, items: true, bankAccount: true }
        });
        const postingResult = await AccountingService.postTransaction(tx, {
          voucherType: "BR",
          reference: `PAY-${invoice.invoiceNo}`,
          description: `Invoice payment received from ${invoice.customer.name} - Inv #${invoice.invoiceNo}`,
          module: "Invoices",
          postedBy: req.user.id,
          lines: [
            { accountId: destAccount.id, debit: invoice.total, credit: 0, description: "Cash/Bank Debit" },
            { accountId: arAccount.id, debit: 0, credit: invoice.total, description: "Accounts Receivable Credit" }
          ],
          ipAddress: req.headers["x-forwarded-for"],
          userAgent: req.headers["user-agent"]
        });
        return { updatedInvoice, journalEntry: postingResult.journalEntry };
      });
      await logAudit(req.user.id, "Pay Invoice", "INVOICE", invoice, result.updatedInvoice, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, data: result.updatedInvoice, message: "Payment recorded and ledger transactions logged successfully" });
    }
    if (action === "cancel") {
      const { id: invoiceId, revenueAccountId } = req.body;
      if (!invoiceId) {
        return res.status(400).json({ error: { message: "Invoice ID is required to cancel", status: 400 } });
      }
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { customer: true }
      });
      if (!invoice) return res.status(404).json({ error: { message: "Invoice not found", status: 404 } });
      if (invoice.status === "CANCELLED") return res.status(400).json({ error: { message: "Invoice is already cancelled", status: 400 } });
      const prevStatus = invoice.status;
      const result = await prisma.$transaction(async (tx) => {
        const arAccount = await getOrCreateAccountsReceivable(tx);
        const updatedInvoice = await tx.invoice.update({
          where: { id: invoiceId },
          data: { status: "CANCELLED" },
          include: { customer: true, items: true, bankAccount: true }
        });
        if (prevStatus === "DRAFT") {
          return { updatedInvoice, journalEntry: null };
        }
        const linesToCreate = [];
        if (prevStatus === "PAID") {
          if (!invoice.bankAccountId) {
            throw new Error("Payment reversal failed: original bank account ID is missing on the paid invoice.");
          }
          linesToCreate.push(
            { accountId: arAccount.id, debit: invoice.total, credit: 0, description: "Reverse Payment - A/R Debit" },
            { accountId: invoice.bankAccountId, debit: 0, credit: invoice.total, description: "Reverse Payment - Cash/Bank Credit" }
          );
        }
        const activeRevAccId = revenueAccountId;
        if (!activeRevAccId) {
          throw new Error("Revenue Account ID is required to reverse the posting entry of a posted/paid invoice.");
        }
        linesToCreate.push(
          { accountId: activeRevAccId, debit: invoice.total, credit: 0, description: "Reverse Posting - Revenue Debit" },
          { accountId: arAccount.id, debit: 0, credit: invoice.total, description: "Reverse Posting - A/R Credit" }
        );
        const postingResult = await AccountingService.postTransaction(tx, {
          voucherType: "JV",
          reference: `RVS-${invoice.invoiceNo}`,
          description: `REVERSAL: Invoice #${invoice.invoiceNo} cancelled`,
          module: "Invoices",
          postedBy: req.user.id,
          lines: linesToCreate,
          ipAddress: req.headers["x-forwarded-for"],
          userAgent: req.headers["user-agent"]
        });
        return { updatedInvoice, journalEntry: postingResult.journalEntry };
      });
      await logAudit(req.user.id, "Cancel Invoice", "INVOICE", invoice, result.updatedInvoice, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, data: result.updatedInvoice, message: "Invoice cancelled and reversing journal entries logged" });
    }
    const { customerId, issueDate, dueDate, discount, tax, remarks, items } = req.body;
    if (!customerId || !issueDate || !dueDate || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: { message: "Missing required invoice parameters", status: 400 } });
    }
    const parsedTax = parseFloat(tax) || 0;
    const parsedDiscount = parseFloat(discount) || 0;
    if (parsedTax < 0 || parsedDiscount < 0) {
      return res.status(400).json({ error: { message: "Tax and discount cannot be negative", status: 400 } });
    }
    const { subtotal: computedSubtotal, total: computedTotal } = computeInvoiceTotals(items, parsedTax, parsedDiscount);
    if (computedTotal < 0) {
      return res.status(400).json({ error: { message: "Invoice total cannot be negative \u2014 check tax/discount against the line items", status: 400 } });
    }
    let newInvoice;
    for (let attempt = 1; ; attempt++) {
      try {
        newInvoice = await prisma.invoice.create({
          data: {
            invoiceNo: generateInvoiceNumber(),
            customerId,
            issueDate: new Date(issueDate),
            dueDate: new Date(dueDate),
            status: "DRAFT",
            subtotal: computedSubtotal,
            discount: parsedDiscount,
            tax: parsedTax,
            total: computedTotal,
            remarks: remarks || null,
            items: {
              create: items.map((item) => ({
                description: item.description,
                quantity: parseFloat(item.quantity),
                unitPrice: parseFloat(item.unitPrice),
                amount: Math.round((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) * 100) / 100
              }))
            }
          },
          include: {
            customer: true,
            items: true
          }
        });
        break;
      } catch (err) {
        if (isUniqueViolation(err) && attempt < 5 && err.meta?.target?.includes("invoiceNo")) {
          continue;
        }
        throw err;
      }
    }
    await logAudit(req.user.id, "Create Invoice", "INVOICE", null, newInvoice, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(201).json({ status: 201, data: newInvoice });
  }
  if (method === "PUT") {
    if (!id) return res.status(400).json({ error: { message: "Invoice ID is required to update", status: 400 } });
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!existingInvoice) return res.status(404).json({ error: { message: "Invoice not found", status: 404 } });
    if (existingInvoice.status !== "DRAFT") {
      return res.status(400).json({ error: { message: "Only DRAFT invoices can be modified", status: 400 } });
    }
    const { customerId, issueDate, dueDate, discount, tax, remarks, items } = req.body;
    const effectiveItems = items ?? existingInvoice.items;
    const effectiveTax = tax !== void 0 ? parseFloat(tax) || 0 : Number(existingInvoice.tax);
    const effectiveDiscount = discount !== void 0 ? parseFloat(discount) || 0 : Number(existingInvoice.discount);
    if (effectiveTax < 0 || effectiveDiscount < 0) {
      return res.status(400).json({ error: { message: "Tax and discount cannot be negative", status: 400 } });
    }
    const { subtotal: computedSubtotal, total: computedTotal } = computeInvoiceTotals(effectiveItems, effectiveTax, effectiveDiscount);
    if (computedTotal < 0) {
      return res.status(400).json({ error: { message: "Invoice total cannot be negative \u2014 check tax/discount against the line items", status: 400 } });
    }
    const result = await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({
        where: { invoiceId: id }
      });
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          customerId: customerId !== void 0 ? customerId : void 0,
          issueDate: issueDate !== void 0 ? new Date(issueDate) : void 0,
          dueDate: dueDate !== void 0 ? new Date(dueDate) : void 0,
          subtotal: computedSubtotal,
          discount: effectiveDiscount,
          tax: effectiveTax,
          total: computedTotal,
          remarks: remarks !== void 0 ? remarks : void 0,
          items: {
            create: effectiveItems.map((item) => ({
              description: item.description,
              quantity: parseFloat(item.quantity),
              unitPrice: parseFloat(item.unitPrice),
              amount: Math.round((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) * 100) / 100
            }))
          }
        },
        include: {
          customer: true,
          items: true
        }
      });
      return updated;
    });
    await logAudit(req.user.id, "Update Invoice", "INVOICE", existingInvoice, result, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, data: result });
  }
  if (method === "DELETE") {
    const isPermanent = req.query.permanent === "true" || req.query.action === "permanent_delete" || req.body?.permanent === true;
    if (isPermanent && !await isSuperAdmin(req)) {
      return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can permanently delete records", status: 403 } });
    }
    const idsRaw = req.body?.ids || req.body?.id || req.query.ids || req.query.id;
    if (!idsRaw) {
      return res.status(400).json({ error: { message: "Invoice ID(s) required", status: 400 } });
    }
    const ids = Array.isArray(idsRaw) ? idsRaw.map(String) : String(idsRaw).split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      return res.status(400).json({ error: { message: "No valid ID provided", status: 400 } });
    }
    const existingInvoices = await prisma.invoice.findMany({ where: { id: { in: ids } } });
    if (existingInvoices.length === 0) {
      return res.status(404).json({ error: { message: "Invoice(s) not found", status: 404 } });
    }
    await prisma.$transaction(async (tx) => {
      for (const inv of existingInvoices) {
        const jes = await tx.journalEntry.findMany({
          where: {
            OR: [
              { reference: { contains: inv.invoiceNo } },
              { description: { contains: inv.invoiceNo } }
            ]
          }
        });
        for (const je of jes) {
          try {
            if (isPermanent) {
              await AccountingService.deleteJournalEntry(tx, je.id, req.user.id, "Invoice Permanently Deleted");
            } else {
              await tx.journalEntry.update({
                where: { id: je.id },
                data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
              });
              await AccountingService.recalculateBalancesForJournalEntry(tx, je.id);
            }
          } catch (e) {
          }
        }
        if (isPermanent) {
          await tx.invoiceItem.deleteMany({ where: { invoiceId: inv.id } });
          await tx.invoice.delete({ where: { id: inv.id } });
        } else {
          await tx.invoice.update({
            where: { id: inv.id },
            data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
          });
        }
      }
    });
    for (const inv of existingInvoices) {
      await logAudit(req.user.id, "Delete Invoice", "INVOICE", inv, null, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    }
    return res.status(200).json({ status: 200, message: `${existingInvoices.length} invoice(s) deleted successfully` });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  invoices_default as default
};
