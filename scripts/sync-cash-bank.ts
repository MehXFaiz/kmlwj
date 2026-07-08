import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const cashAccount = await prisma.account.findFirst({
    where: {
      OR: [
        { glCode: '1010103' },
        { accountName: { equals: 'Cash in Hand', mode: 'insensitive' } }
      ]
    }
  });
  if (!cashAccount) throw new Error('Cash in Hand account not found');

  // 1. Check Hall Bookings
  const hallBookings = await prisma.hallBooking.findMany({ where: { status: 'POSTED' } });
  for (const h of hallBookings) {
    if (h.journalEntryId) {
      const je = await prisma.journalEntry.findUnique({
        where: { id: h.journalEntryId },
        include: { lines: true }
      });
      if (je) {
        for (const l of je.lines) {
          if (l.debit > 0) {
            const targetId = (h.paymentMethod === 'CASH') ? cashAccount.id : (h.bankAccountId || l.accountId);
            if (l.accountId !== targetId) {
              await prisma.journalEntryLine.update({
                where: { id: l.id },
                data: { accountId: targetId }
              });
            }
          }
        }
      }
    }
  }

  // 2. Check Donations Received
  const donsReceived = await prisma.donationReceived.findMany({ where: { status: 'POSTED' } });
  for (const d of donsReceived) {
    if (d.journalEntryId) {
      const je = await prisma.journalEntry.findUnique({
        where: { id: d.journalEntryId },
        include: { lines: true }
      });
      if (je) {
        for (const l of je.lines) {
          if (l.debit > 0) {
            const targetId = (d.paymentMethod === 'CASH') ? cashAccount.id : (d.bankAccountId || l.accountId);
            if (l.accountId !== targetId) {
              await prisma.journalEntryLine.update({
                where: { id: l.id },
                data: { accountId: targetId }
              });
            }
          }
        }
      }
    }
  }

  // 3. Check Revenue Collections
  const revCollections = await prisma.revenueCollection.findMany({ where: { status: 'POSTED' } });
  for (const r of revCollections) {
    if (r.journalEntryId) {
      const je = await prisma.journalEntry.findUnique({
        where: { id: r.journalEntryId },
        include: { lines: true }
      });
      if (je) {
        for (const l of je.lines) {
          if (l.debit > 0) {
            const targetId = (r.paymentMethod === 'CASH') ? cashAccount.id : (r.bankAccountId || l.accountId);
            if (l.accountId !== targetId) {
              await prisma.journalEntryLine.update({
                where: { id: l.id },
                data: { accountId: targetId }
              });
            }
          }
        }
      }
    }
  }

  // 4. Check Donations Given (Disbursements)
  const donsGiven = await prisma.donation.findMany({ where: { status: 'APPROVED' } });
  for (const d of donsGiven) {
    if (d.journalEntryId) {
      const je = await prisma.journalEntry.findUnique({
        where: { id: d.journalEntryId },
        include: { lines: true }
      });
      if (je) {
        for (const l of je.lines) {
          if (l.credit > 0) {
            const targetId = (d.paymentMethod === 'CASH') ? cashAccount.id : (d.bankAccountId || l.accountId);
            if (l.accountId !== targetId) {
              await prisma.journalEntryLine.update({
                where: { id: l.id },
                data: { accountId: targetId }
              });
            }
          }
        }
      }
    }
  }

  // 5. Recalculate balances of all asset accounts
  const assetAccounts = await prisma.account.findMany({
    where: {
      accountType: { name: { in: ['Asset', 'ASSET'], mode: 'insensitive' } }
    }
  });

  for (const acc of assetAccounts) {
    const lines = await prisma.journalEntryLine.findMany({
      where: { accountId: acc.id }
    });
    let netDebit = 0;
    let netCredit = 0;
    for (const l of lines) {
      netDebit += Number(l.debit || 0);
      netCredit += Number(l.credit || 0);
    }
    const newBalance = netDebit - netCredit;
    await prisma.account.update({
      where: { id: acc.id },
      data: { currentBalance: newBalance }
    });
  }

  console.log('Cash and Bank sync finished successfully!');
}

main().finally(() => { prisma.$disconnect(); pool.end(); });
