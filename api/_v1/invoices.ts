import type { VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { AccountingService } from '../_services/accounting.service.js';

function generateInvoiceNumber() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${year}${month}-${randomStr}`;
}

function generateVoucherNumber(prefix = 'JV') {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${year}${month}-${randomStr}`;
}

async function getOrCreateAccountsReceivable(tx: any) {
  let arAccount = await tx.account.findFirst({
    where: { accountName: { contains: 'Accounts Receivable', mode: 'insensitive' } }
  });

  if (!arAccount) {
    const currentAsset = await tx.account.findFirst({
      where: { glCode: '1100000' }
    });

    if (!currentAsset) {
      throw new Error('Current Asset account (1100000) not found in Chart of Accounts.');
    }

    // Find a unique GL code under Current Assets
    let newGlCode = '1100100';
    let codeExists = true;
    while(codeExists) {
      const existing = await tx.account.findFirst({ where: { glCode: newGlCode }});
      if (existing) {
        newGlCode = (parseInt(newGlCode) + 1).toString();
      } else {
        codeExists = false;
      }
    }

    arAccount = await tx.account.create({
      data: {
        glCode: newGlCode,
        accountName: 'Accounts Receivable',
        accountLevel: 'SUBSIDIARY',
        parentId: currentAsset.id,
        accountTypeId: currentAsset.accountTypeId,
        detailType: 'Accounts Receivable',
        description: 'Standard Accounts Receivable account',
        currency: 'PKR',
        subsidiary: ['Global'],
        initialBalance: 0,
        currentBalance: 0,
        isSystemDefined: true,
      }
    });
  }

  return arAccount;
}

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;
  const id = req.query.id as string;
  const action = req.query.action as string;

  if (method === 'GET') {
    if (id) {
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
          customer: true,
          items: true,
          bankAccount: true,
        },
      });

      if (!invoice) {
        return res.status(404).json({ error: { message: 'Invoice not found', status: 404 } });
      }

      return res.status(200).json({ status: 200, data: invoice });
    }

    const invoices = await prisma.invoice.findMany({
      include: {
        customer: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ status: 200, data: invoices });
  }

  if (method === 'POST') {
    // --- POST ACTION: Post/Approve Invoice ---
    if (action === 'post') {
      const { id: invoiceId, revenueAccountId } = req.body;
      if (!invoiceId || !revenueAccountId) {
        return res.status(400).json({ error: { message: 'Invoice ID and Revenue Account ID are required to post', status: 400 } });
      }

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { customer: true }
      });

      if (!invoice) return res.status(404).json({ error: { message: 'Invoice not found', status: 404 } });
      if (invoice.status !== 'DRAFT') return res.status(400).json({ error: { message: 'Only DRAFT invoices can be posted', status: 400 } });

      const revenueAccount = await prisma.account.findUnique({ where: { id: revenueAccountId } });
      if (!revenueAccount) return res.status(400).json({ error: { message: 'Revenue account not found', status: 400 } });

      const result = await prisma.$transaction(async (tx) => {
        const arAccount = await getOrCreateAccountsReceivable(tx);

        const updatedInvoice = await tx.invoice.update({
          where: { id: invoiceId },
          data: { status: 'POSTED' },
          include: { customer: true, items: true, bankAccount: true }
        });

        const postingResult = await AccountingService.postTransaction(tx, {
          voucherType: 'JV',
          reference: `POST-${invoice.invoiceNo}`,
          description: `Invoice posted to ${invoice.customer.name} - Inv #${invoice.invoiceNo}`,
          module: 'Invoices',
          postedBy: req.user!.id,
          lines: [
            { accountId: arAccount.id, debit: invoice.total, credit: 0, description: 'Accounts Receivable Debit' },
            { accountId: revenueAccount.id, debit: 0, credit: invoice.total, description: 'Sales/Revenue Credit' }
          ],
          ipAddress: req.headers['x-forwarded-for'] as string,
          userAgent: req.headers['user-agent']
        });

        return { updatedInvoice, journalEntry: postingResult.journalEntry };
      });

      await logAudit(req.user.id, 'Post Invoice', 'INVOICE', invoice, result.updatedInvoice, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

      return res.status(200).json({ status: 200, data: result.updatedInvoice, message: 'Invoice posted and ledger transactions logged successfully' });
    }

    // --- POST ACTION: Pay Invoice ---
    if (action === 'pay') {
      const { id: invoiceId, bankAccountId, paymentMethod, chequeNumber } = req.body;
      if (!invoiceId || !paymentMethod || !bankAccountId) {
        return res.status(400).json({ error: { message: 'Invoice ID, Payment Method, and Bank/Cash Account ID are required', status: 400 } });
      }

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { customer: true }
      });

      if (!invoice) return res.status(404).json({ error: { message: 'Invoice not found', status: 404 } });
      if (invoice.status !== 'POSTED') return res.status(400).json({ error: { message: 'Invoice must be in POSTED status to record a payment', status: 400 } });

      const destAccount = await prisma.account.findUnique({ where: { id: bankAccountId } });
      if (!destAccount) return res.status(400).json({ error: { message: 'Destination Cash/Bank account not found', status: 400 } });

      const result = await prisma.$transaction(async (tx) => {
        const arAccount = await getOrCreateAccountsReceivable(tx);

        const updatedInvoice = await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            status: 'PAID',
            paymentMethod,
            bankAccountId,
            chequeNumber: chequeNumber || null,
          },
          include: { customer: true, items: true, bankAccount: true }
        });

        const postingResult = await AccountingService.postReceipt(tx, {
          amount: invoice.total,
          cashOrBankAccountId: destAccount.id,
          incomeAccountId: arAccount.id,
          reference: `PAY-${invoice.invoiceNo}`,
          description: `Invoice payment received from ${invoice.customer.name} - Inv #${invoice.invoiceNo}`,
          module: 'Invoices',
          voucherType: 'BR',
          postedBy: req.user!.id,
          ipAddress: req.headers['x-forwarded-for'] as string,
          userAgent: req.headers['user-agent']
        });

        return { updatedInvoice, journalEntry: postingResult.journalEntry };
      });

      await logAudit(req.user.id, 'Pay Invoice', 'INVOICE', invoice, result.updatedInvoice, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

      return res.status(200).json({ status: 200, data: result.updatedInvoice, message: 'Payment recorded and ledger transactions logged successfully' });
    }

    // --- POST ACTION: Cancel Invoice ---
    if (action === 'cancel') {
      const { id: invoiceId, revenueAccountId } = req.body;
      if (!invoiceId) {
        return res.status(400).json({ error: { message: 'Invoice ID is required to cancel', status: 400 } });
      }

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { customer: true }
      });

      if (!invoice) return res.status(404).json({ error: { message: 'Invoice not found', status: 404 } });
      if (invoice.status === 'CANCELLED') return res.status(400).json({ error: { message: 'Invoice is already cancelled', status: 400 } });

      const prevStatus = invoice.status;

      const result = await prisma.$transaction(async (tx) => {
        const arAccount = await getOrCreateAccountsReceivable(tx);

        const updatedInvoice = await tx.invoice.update({
          where: { id: invoiceId },
          data: { status: 'CANCELLED' },
          include: { customer: true, items: true, bankAccount: true }
        });

        // If it was just a DRAFT, no journal reversal is needed.
        if (prevStatus === 'DRAFT') {
          return { updatedInvoice, journalEntry: null };
        }

        const linesToCreate = [];

        if (prevStatus === 'PAID') {
          if (!invoice.bankAccountId) {
            throw new Error('Payment reversal failed: original bank account ID is missing on the paid invoice.');
          }
          linesToCreate.push(
            { accountId: arAccount.id, debit: invoice.total, credit: 0, description: 'Reverse Payment - A/R Debit' },
            { accountId: invoice.bankAccountId, debit: 0, credit: invoice.total, description: 'Reverse Payment - Cash/Bank Credit' }
          );
        }

        const activeRevAccId = revenueAccountId;
        if (!activeRevAccId) {
          throw new Error('Revenue Account ID is required to reverse the posting entry of a posted/paid invoice.');
        }

        linesToCreate.push(
          { accountId: activeRevAccId, debit: invoice.total, credit: 0, description: 'Reverse Posting - Revenue Debit' },
          { accountId: arAccount.id, debit: 0, credit: invoice.total, description: 'Reverse Posting - A/R Credit' }
        );

        const postingResult = await AccountingService.postTransaction(tx, {
          voucherType: 'JV',
          reference: `RVS-${invoice.invoiceNo}`,
          description: `REVERSAL: Invoice #${invoice.invoiceNo} cancelled`,
          module: 'Invoices',
          postedBy: req.user!.id,
          lines: linesToCreate,
          ipAddress: req.headers['x-forwarded-for'] as string,
          userAgent: req.headers['user-agent']
        });

        return { updatedInvoice, journalEntry: postingResult.journalEntry };
      });

      await logAudit(req.user.id, 'Cancel Invoice', 'INVOICE', invoice, result.updatedInvoice, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

      return res.status(200).json({ status: 200, data: result.updatedInvoice, message: 'Invoice cancelled and reversing journal entries logged' });
    }

    // --- CREATE NEW INVOICE ---
    const { customerId, issueDate, dueDate, subtotal, discount, tax, total, remarks, items } = req.body;

    if (!customerId || !issueDate || !dueDate || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: { message: 'Missing required invoice parameters', status: 400 } });
    }

    const newInvoice = await prisma.invoice.create({
      data: {
        invoiceNo: generateInvoiceNumber(),
        customerId,
        issueDate: new Date(issueDate),
        dueDate: new Date(dueDate),
        status: 'DRAFT',
        subtotal: parseFloat(subtotal),
        discount: parseFloat(discount) || 0,
        tax: parseFloat(tax) || 0,
        total: parseFloat(total),
        remarks: remarks || null,
        items: {
          create: items.map((item: any) => ({
            description: item.description,
            quantity: parseFloat(item.quantity),
            unitPrice: parseFloat(item.unitPrice),
            amount: parseFloat(item.amount),
          })),
        },
      },
      include: {
        customer: true,
        items: true,
      },
    });

    await logAudit(req.user.id, 'Create Invoice', 'INVOICE', null, newInvoice, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(201).json({ status: 201, data: newInvoice });
  }

  if (method === 'PUT') {
    if (!id) return res.status(400).json({ error: { message: 'Invoice ID is required to update', status: 400 } });

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!existingInvoice) return res.status(404).json({ error: { message: 'Invoice not found', status: 404 } });
    if (existingInvoice.status !== 'DRAFT') {
      return res.status(400).json({ error: { message: 'Only DRAFT invoices can be modified', status: 400 } });
    }

    const { customerId, issueDate, dueDate, subtotal, discount, tax, total, remarks, items } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      // Delete old items first
      await tx.invoiceItem.deleteMany({
        where: { invoiceId: id }
      });

      // Update invoice and insert new items
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          customerId: customerId !== undefined ? customerId : undefined,
          issueDate: issueDate !== undefined ? new Date(issueDate) : undefined,
          dueDate: dueDate !== undefined ? new Date(dueDate) : undefined,
          subtotal: subtotal !== undefined ? parseFloat(subtotal) : undefined,
          discount: discount !== undefined ? parseFloat(discount) : undefined,
          tax: tax !== undefined ? parseFloat(tax) : undefined,
          total: total !== undefined ? parseFloat(total) : undefined,
          remarks: remarks !== undefined ? remarks : undefined,
          items: items ? {
            create: items.map((item: any) => ({
              description: item.description,
              quantity: parseFloat(item.quantity),
              unitPrice: parseFloat(item.unitPrice),
              amount: parseFloat(item.amount),
            }))
          } : undefined
        },
        include: {
          customer: true,
          items: true
        }
      });

      return updated;
    });

    await logAudit(req.user.id, 'Update Invoice', 'INVOICE', existingInvoice, result, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, data: result });
  }

  if (method === 'DELETE') {
    if (!id) return res.status(400).json({ error: { message: 'Invoice ID is required', status: 400 } });

    const existingInvoice = await prisma.invoice.findUnique({ where: { id } });
    if (!existingInvoice) return res.status(404).json({ error: { message: 'Invoice not found', status: 404 } });

    if (existingInvoice.status !== 'DRAFT') {
      return res.status(400).json({ error: { message: 'Only DRAFT invoices can be deleted', status: 400 } });
    }

    await prisma.invoice.delete({ where: { id } });

    await logAudit(req.user.id, 'Delete Invoice', 'INVOICE', existingInvoice, null, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, message: 'Invoice deleted successfully' });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
