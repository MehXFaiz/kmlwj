import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- Running Database Healing Migration ---');

  // 1. Find the target revenue account
  // Look for a leaf General Donation account of type REVENUE
  const targetRevenueAccount = await prisma.account.findFirst({
    where: {
      accountName: { contains: 'General Donation', mode: 'insensitive' },
      accountType: { name: { equals: 'REVENUE', mode: 'insensitive' } },
      children: { none: {} },
      isLocked: false
    }
  });

  if (!targetRevenueAccount) {
    throw new Error('Could not find a General Donation revenue account to migrate the entry to.');
  }

  console.log(`Found Target Revenue Account: ${targetRevenueAccount.glCode} - ${targetRevenueAccount.accountName} (${targetRevenueAccount.id})`);

  // 2. Find the incorrect journal entry line (Voucher: BR-260714-176477, Account: Medical Donations)
  const targetJournalLine = await prisma.journalEntryLine.findFirst({
    where: {
      journalEntry: {
        voucherNo: 'BR-260714-176477'
      },
      account: {
        glCode: '4060103' // Medical Donations
      }
    },
    include: { journalEntry: true, account: true }
  });

  if (!targetJournalLine) {
    console.log('Target journal line not found. It might have already been healed or doesn\'t exist.');
    return;
  }

  const oldAccountId = targetJournalLine.accountId;
  const newAccountId = targetRevenueAccount.id;

  console.log(`Found incorrect line on Journal Entry: ${targetJournalLine.journalEntry.voucherNo}`);
  console.log(`  Updating Account from ${targetJournalLine.account.glCode} (${targetJournalLine.account.accountName}) to ${targetRevenueAccount.glCode} (${targetRevenueAccount.accountName})`);

  // 3. Update the JournalEntryLine and the corresponding LedgerEntry inside a transaction
  await prisma.$transaction(async (tx) => {
    // Update JournalEntryLine
    await tx.journalEntryLine.update({
      where: { id: targetJournalLine.id },
      data: { accountId: newAccountId }
    });

    // Update LedgerEntry
    const ledgerResult = await tx.ledgerEntry.updateMany({
      where: {
        accountId: oldAccountId,
        reference: targetJournalLine.journalEntry.voucherNo
      },
      data: { accountId: newAccountId }
    });

    console.log(`Updated ${ledgerResult.count} LedgerEntry record(s).`);

    // Recalculate balances for both old and new accounts
    // Helper function inside the transaction
    const recalculate = async (accId: string) => {
      const account = await tx.account.findUnique({
        where: { id: accId },
        include: { accountType: true }
      });
      if (!account) return;

      const aggregations = await tx.journalEntryLine.aggregate({
        where: {
          accountId: accId,
          journalEntry: { status: 'Posted' }
        },
        _sum: { debit: true, credit: true }
      });

      const totalDebit = Number(aggregations._sum.debit) || 0;
      const totalCredit = Number(aggregations._sum.credit) || 0;
      const initialBalance = Number(account.initialBalance) || 0;

      const typeName = account.accountType?.name?.toUpperCase() || 'ASSET';
      const isDebitNormal = ['ASSET', 'EXPENSE'].includes(typeName);

      const currentBalance = isDebitNormal
        ? (initialBalance + totalDebit - totalCredit)
        : (initialBalance + totalCredit - totalDebit);

      await tx.account.update({
        where: { id: accId },
        data: { currentBalance }
      });

      console.log(`Recalculated balance for ${account.glCode} - ${account.accountName}: ${currentBalance}`);
    };

    await recalculate(oldAccountId);
    await recalculate(newAccountId);
  });

  console.log('✅ Database healing migration completed successfully.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
