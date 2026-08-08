import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const prisma = new PrismaClient();

async function inspectDetails() {
  console.log('=== INSPECTING JOURNAL ENTRIES & DATE BOUNDARIES ===\n');

  const jes = await prisma.journalEntry.findMany({
    include: {
      lines: {
        include: { account: { include: { accountType: true } } }
      }
    },
    orderBy: { postingDate: 'asc' }
  });

  console.log(`Total Journal Entries: ${jes.length}`);

  let activeRevTotal = 0;
  let activeExpTotal = 0;
  let deletedRevTotal = 0;
  let deletedExpTotal = 0;

  for (const je of jes) {
    const dateStr = je.postingDate.toISOString().split('T')[0];
    let drRev = 0, crRev = 0, drExp = 0, crExp = 0, drAsset = 0, crAsset = 0;

    for (const l of je.lines) {
      const typeName = (l.account?.accountType?.name || '').toUpperCase();
      if (['REVENUE', 'INCOME'].includes(typeName)) {
        drRev += Number(l.debit);
        crRev += Number(l.credit);
      } else if (['EXPENSE', 'EXPENSES'].includes(typeName)) {
        drExp += Number(l.debit);
        crExp += Number(l.credit);
      } else if (['ASSET', 'ASSETS'].includes(typeName)) {
        drAsset += Number(l.debit);
        crAsset += Number(l.credit);
      }
    }

    const netRev = crRev - drRev;
    const netExp = drExp - crExp;

    if (!je.isDeleted && je.status === 'Posted') {
      activeRevTotal += netRev;
      activeExpTotal += netExp;
    } else {
      deletedRevTotal += netRev;
      deletedExpTotal += netExp;
    }

    console.log(`JE ${je.voucherNo} | Date: ${dateStr} | Status: ${je.status} | Deleted: ${je.isDeleted} | Type: ${je.voucherType} | NetRev: ${netRev} | NetExp: ${netExp} | AssetDr: ${drAsset} | AssetCr: ${crAsset}`);
  }

  console.log(`\nActive Posted GL Revenue Total: ${activeRevTotal}`);
  console.log(`Active Posted GL Expense Total: ${activeExpTotal}`);
  console.log(`Deleted GL Revenue Total: ${deletedRevTotal}`);
  console.log(`Deleted GL Expense Total: ${deletedExpTotal}`);

  // Let's test date ranges for 2026, 2025, 2024, etc.
  const dates = await prisma.journalEntry.aggregate({
    _min: { postingDate: true },
    _max: { postingDate: true }
  });
  console.log('\nPosting Date Range in DB:', dates);

  // Group active posted JE lines by Year & Month
  const postedActiveJEs = jes.filter(j => !j.isDeleted && j.status === 'Posted');
  let monthlyBreakdown: Record<string, { rev: number; exp: number; assetDr: number; assetCr: number }> = {};

  for (const je of postedActiveJEs) {
    const ym = je.postingDate.toISOString().slice(0, 7); // YYYY-MM
    if (!monthlyBreakdown[ym]) monthlyBreakdown[ym] = { rev: 0, exp: 0, assetDr: 0, assetCr: 0 };

    for (const l of je.lines) {
      const typeName = (l.account?.accountType?.name || '').toUpperCase();
      if (['REVENUE', 'INCOME'].includes(typeName)) {
        monthlyBreakdown[ym].rev += (Number(l.credit) - Number(l.debit));
      } else if (['EXPENSE', 'EXPENSES'].includes(typeName)) {
        monthlyBreakdown[ym].exp += (Number(l.debit) - Number(l.credit));
      } else if (['ASSET', 'ASSETS'].includes(typeName)) {
        monthlyBreakdown[ym].assetDr += Number(l.debit);
        monthlyBreakdown[ym].assetCr += Number(l.credit);
      }
    }
  }

  console.log('\nMonthly Active Posted Breakdown (GL):', JSON.stringify(monthlyBreakdown, null, 2));

  // Also group DELETED JE lines by Year & Month
  const deletedJEs = jes.filter(j => j.isDeleted);
  let monthlyDeletedBreakdown: Record<string, { rev: number; exp: number }> = {};
  for (const je of deletedJEs) {
    const ym = je.postingDate.toISOString().slice(0, 7);
    if (!monthlyDeletedBreakdown[ym]) monthlyDeletedBreakdown[ym] = { rev: 0, exp: 0 };
    for (const l of je.lines) {
      const typeName = (l.account?.accountType?.name || '').toUpperCase();
      if (['REVENUE', 'INCOME'].includes(typeName)) {
        monthlyDeletedBreakdown[ym].rev += (Number(l.credit) - Number(l.debit));
      } else if (['EXPENSE', 'EXPENSES'].includes(typeName)) {
        monthlyDeletedBreakdown[ym].exp += (Number(l.debit) - Number(l.credit));
      }
    }
  }
  console.log('\nMonthly Deleted Breakdown (GL):', JSON.stringify(monthlyDeletedBreakdown, null, 2));

  await prisma.$disconnect();
}

inspectDetails().catch(console.error);
