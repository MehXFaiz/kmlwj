import type { VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { AccountingService } from '../_services/accounting.service.js';

async function generateCardNumber(tx: any): Promise<string> {
  const count = await tx.zakatCard.count();
  const seq = (count + 1).toString().padStart(6, '0');
  return `ZK-${seq}`;
}

async function resolveZakatExpenseAccount(tx: any) {
  let acc = await tx.account.findFirst({
    where: {
      accountName: { contains: 'Zakat', mode: 'insensitive' as const },
      accountType: { name: { in: ['Expense', 'Expenses', 'Liability', 'Liabilities'], mode: 'insensitive' as const } },
      isLocked: false,
      children: { none: {} },
    },
    orderBy: { glCode: 'asc' as const },
  });

  if (!acc) {
    acc = await tx.account.findFirst({
      where: {
        accountType: { name: { in: ['Expense', 'Expenses'], mode: 'insensitive' as const } },
        isLocked: false,
        children: { none: {} },
      },
      orderBy: { glCode: 'asc' as const },
    });
  }

  return acc;
}

/* Zakat given to people is recorded as a Donation (disbursement) against a Beneficiary,
   not a Member — so a member is matched to their donation by CNIC (primary) or full name. */
function beneficiaryMatchesMember(beneficiary: { cnic: string | null; name: string }, member: { cnic: string | null; fullName: string }) {
  if (member.cnic && beneficiary.cnic && member.cnic.trim() === beneficiary.cnic.trim()) return true;
  return beneficiary.name.trim().toLowerCase() === member.fullName.trim().toLowerCase();
}

async function findApprovedZakatDonation(member: { cnic: string | null; fullName: string }) {
  const donations = await prisma.donation.findMany({
    where: { donationType: 'ZAKAT', status: 'APPROVED', beneficiaryId: { not: null } },
    include: { beneficiary: { select: { cnic: true, name: true } } },
  });
  return donations.find((d) => d.beneficiary && beneficiaryMatchesMember(d.beneficiary, member)) || null;
}

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;
  const id = req.query.id as string;
  const action = req.query.action as string;

  if (method === 'GET') {
    // Members eligible for a zakat card: those with an approved zakat donation on record
    if (action === 'eligible-members') {
      const [donations, members] = await Promise.all([
        prisma.donation.findMany({
          where: { donationType: 'ZAKAT', status: 'APPROVED', beneficiaryId: { not: null } },
          include: { beneficiary: { select: { cnic: true, name: true } } },
        }),
        prisma.member.findMany({ orderBy: { fullName: 'asc' } }),
      ]);
      const eligible = members.filter((m) =>
        donations.some((d) => d.beneficiary && beneficiaryMatchesMember(d.beneficiary, m))
      );
      return res.status(200).json({ status: 200, data: eligible });
    }

    if (id) {
      const card = await prisma.zakatCard.findUnique({
        where: { id },
        include: {
          member: true,
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
      });
      if (!card) return res.status(404).json({ error: { message: 'Zakat card not found', status: 404 } });
      return res.status(200).json({ status: 200, data: card });
    }

    const cards = await prisma.zakatCard.findMany({
      include: {
        member: true,
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ status: 200, data: cards });
  }

  if (method === 'POST') {
    const { memberId, zakatAmount, issueDate, paymentMethod, bankAccountId } = req.body;

    if (!memberId || !zakatAmount) {
      return res.status(400).json({ error: { message: 'Member and zakat amount are required', status: 400 } });
    }

    const parsedAmount = parseFloat(zakatAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: { message: 'Zakat amount must be greater than 0', status: 400 } });
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) return res.status(404).json({ error: { message: 'Member not found', status: 404 } });

    // A zakat card can only be issued to a member with an approved zakat donation on record
    const zakatDonation = await findApprovedZakatDonation(member);
    if (!zakatDonation) {
      return res.status(400).json({ error: { message: 'Zakat card can only be issued to members with a recorded zakat donation', status: 400 } });
    }

    if ((paymentMethod === 'BANK' || paymentMethod === 'CHEQUE') && !bankAccountId) {
      return res.status(400).json({ error: { message: 'Bank account is required for Bank/Cheque payments', status: 400 } });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const cardNumber = await generateCardNumber(tx);

      const zakatAccount = await resolveZakatExpenseAccount(tx);
      if (!zakatAccount) {
        throw Object.assign(new Error('No Zakat expense/liability account found in Chart of Accounts. Please create one first.'), { status: 400 });
      }

      let debitAccountId: string;
      if (paymentMethod === 'CASH' || !paymentMethod) {
        const cashAccount = await AccountingService.ensureCashInHandAccount(tx);
        debitAccountId = cashAccount.id;
      } else {
        debitAccountId = bankAccountId;
      }

      // Zakat disbursement: Debit Zakat Expense, Credit Cash/Bank
      const postingResult = await AccountingService.postTransaction(tx, {
        reference: cardNumber,
        description: `Zakat Card issued to ${member.fullName} (${cardNumber})`,
        module: 'Zakat Card',
        voucherType: 'JV',
        postedBy: req.user!.id,
        postingDate: issueDate ? new Date(issueDate) : new Date(),
        lines: [
          { accountId: zakatAccount.id, debit: parsedAmount, credit: 0, description: `Zakat disbursement - ${member.fullName}` },
          { accountId: debitAccountId, debit: 0, credit: parsedAmount, description: `Zakat payment - ${cardNumber}` },
        ],
        ipAddress: req.headers['x-forwarded-for'] as string,
        userAgent: req.headers['user-agent'] as string,
      });

      const card = await tx.zakatCard.create({
        data: {
          memberId,
          zakatAmount: parsedAmount,
          issueDate: issueDate ? new Date(issueDate) : new Date(),
          cardNumber,
          paymentMethod: paymentMethod || 'CASH',
          bankAccountId: bankAccountId || null,
          journalEntryId: postingResult.journalEntry.id,
          createdById: req.user!.id,
        },
        include: { member: true },
      });

      return card;
    });

    await logAudit(
      req.user.id, 'Issue Zakat Card', 'ZAKAT_CARD',
      null, result,
      req.headers['x-forwarded-for'] as string, req.headers['user-agent']
    );

    return res.status(201).json({ status: 201, data: result, message: 'Zakat card issued successfully' });
  }

  if (method === 'DELETE') {
    if (!id) return res.status(400).json({ error: { message: 'Card ID is required', status: 400 } });

    const card = await prisma.zakatCard.findUnique({ where: { id } });
    if (!card) return res.status(404).json({ error: { message: 'Zakat card not found', status: 404 } });

    await prisma.$transaction(async (tx: any) => {
      if (card.journalEntryId) {
        try {
          await AccountingService.deleteJournalEntry(tx, card.journalEntryId, req.user!.id, 'Deleted Zakat Card');
        } catch (e) {}
      }
      await tx.zakatCard.delete({ where: { id } });
    });

    await logAudit(
      req.user.id, 'Delete Zakat Card', 'ZAKAT_CARD',
      card, null,
      req.headers['x-forwarded-for'] as string, req.headers['user-agent']
    );

    return res.status(200).json({ status: 200, message: 'Zakat card deleted successfully' });
  }

  return res.status(405).json({ error: { message: 'Method not allowed', status: 405 } });
});
