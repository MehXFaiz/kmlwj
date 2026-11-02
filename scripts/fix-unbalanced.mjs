import fs from 'fs';
import { prisma } from '../api/_prisma.js';

async function run() {
  // 1. Fix Hall Booking #51 journal entry lines
  const jeHb51 = await prisma.journalEntry.findFirst({
    where: { voucherNo: 'BR-270124-945063' },
    include: { lines: true }
  });

  if (jeHb51) {
    console.log('Fixing Hall Booking #51 journal entry...');
    await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: jeHb51.id } });
    await prisma.journalEntryLine.createMany({
      data: [
        {
          journalEntryId: jeHb51.id,
          accountId: 'c81b0db9-c996-4825-b570-cd70083bb3b5', // National Bank of Pakistan
          debit: 23000,
          credit: 0,
          description: 'Receipt: Hall Booking #51 for A.GHANI BARIYE WALA - BAGH-E-HAJIANI - GARDEN'
        },
        {
          journalEntryId: jeHb51.id,
          accountId: 'f99186a7-2594-41c7-8675-6b3f2ffa986e', // BAGH-E-HAJIANI - GARDEN (Revenue)
          debit: 0,
          credit: 23000,
          description: 'Revenue: Hall Booking #51 for A.GHANI BARIYE WALA - BAGH-E-HAJIANI - GARDEN'
        }
      ]
    });
    console.log('Fixed Hall Booking #51 journal entry successfully');
  }

  // 2. Clean up test batches first (to satisfy required foreign key relation)
  await prisma.openingBalanceLine.deleteMany({
    where: {
      batch: {
        financialYear: { in: ['FY 2048-2049', 'FY 2049-2050'] }
      }
    }
  });
  await prisma.openingBalanceBatch.deleteMany({
    where: {
      financialYear: { in: ['FY 2048-2049', 'FY 2049-2050'] }
    }
  });

  // Now delete test journal entry OP-2049-QDQE
  const testJe = await prisma.journalEntry.findFirst({
    where: { voucherNo: 'OP-2049-QDQE' }
  });
  if (testJe) {
    console.log('Removing test rollover journal entry OP-2049-QDQE...');
    await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: testJe.id } });
    await prisma.journalEntry.delete({ where: { id: testJe.id } });
    console.log('Deleted OP-2049-QDQE successfully');
  }

  // 3. Clean up other test entries from FY 2048-2049 and FY 2049-2050
  const otherTestJes = await prisma.journalEntry.findMany({
    where: {
      reference: { in: ['TEST-OP-2048', 'TEST-REV-2048', 'AUTO-ROLLOVER-FY 2048-2049'] }
    }
  });
  for (const je of otherTestJes) {
    await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: je.id } });
    await prisma.journalEntry.delete({ where: { id: je.id } });
  }

  // Clean up test batches
  await prisma.openingBalanceLine.deleteMany({
    where: {
      batch: {
        financialYear: { in: ['FY 2048-2049', 'FY 2049-2050'] }
      }
    }
  });
  await prisma.openingBalanceBatch.deleteMany({
    where: {
      financialYear: { in: ['FY 2048-2049', 'FY 2049-2050'] }
    }
  });
  await prisma.financialYear.deleteMany({
    where: {
      code: { in: ['FY 2048-2049', 'FY 2049-2050'] }
    }
  });

  // 4. Update AccountingSyncService to use createMany
  let syncCode = fs.readFileSync('api/_services/accounting-sync.service.ts', 'utf8');
  syncCode = syncCode.replace(/\r\n/g, '\n');

  const hbOldLines = `        await db.journalEntryLine.deleteMany({ where: { journalEntryId: existingJe.id } });
        for (const line of lines) {
          await db.journalEntryLine.create({
            data: {
              journalEntryId: existingJe.id,
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
              description: line.description
            }
          });
        }`;

  const hbNewLines = `        await db.journalEntryLine.deleteMany({ where: { journalEntryId: existingJe.id } });
        await db.journalEntryLine.createMany({
          data: lines.map(line => ({
            journalEntryId: existingJe.id,
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            description: line.description
          }))
        });`;

  const donOldLines = `        await db.journalEntryLine.deleteMany({ where: { journalEntryId: existingJe.id } });
        for (const line of lines) {
          await db.journalEntryLine.create({
            data: { journalEntryId: existingJe.id, accountId: line.accountId, debit: line.debit, credit: line.credit, description: line.description }
          });
        }`;

  const donNewLines = `        await db.journalEntryLine.deleteMany({ where: { journalEntryId: existingJe.id } });
        await db.journalEntryLine.createMany({
          data: lines.map(line => ({
            journalEntryId: existingJe.id,
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            description: line.description
          }))
        });`;

  syncCode = syncCode.replace(hbOldLines, hbNewLines);
  syncCode = syncCode.replace(donOldLines, donNewLines);
  fs.writeFileSync('api/_services/accounting-sync.service.ts', syncCode, 'utf8');

  // 5. Update tests/api/financial-year-rollover.test.ts afterAll cleanup
  let fyTest = fs.readFileSync('tests/api/financial-year-rollover.test.ts', 'utf8');
  fyTest = fyTest.replace(/\r\n/g, '\n');
  const oldAfterAll = `  afterAll(async () => {
    await prisma.$disconnect();
  });`;

  const newAfterAll = `  afterAll(async () => {
    try {
      const testJes = await prisma.journalEntry.findMany({
        where: {
          reference: { in: ['TEST-OP-2048', 'TEST-REV-2048', 'AUTO-ROLLOVER-FY 2048-2049'] }
        }
      });
      for (const je of testJes) {
        await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: je.id } });
        await prisma.journalEntry.delete({ where: { id: je.id } });
      }
      await prisma.openingBalanceLine.deleteMany({
        where: { batch: { financialYear: { in: [testFy1, testFy2] } } }
      });
      await prisma.openingBalanceBatch.deleteMany({
        where: { financialYear: { in: [testFy1, testFy2] } }
      });
      await prisma.financialYear.deleteMany({
        where: { code: { in: [testFy1, testFy2] } }
      });
    } catch {}
    await prisma.$disconnect();
  });`;

  fyTest = fyTest.replace(oldAfterAll, newAfterAll);
  fs.writeFileSync('tests/api/financial-year-rollover.test.ts', fyTest, 'utf8');

  console.log('All fixes applied. Recomputing balances...');
  const { AccountingService } = await import('../api/_services/accounting.service.js');
  await AccountingService.recalculateAllBalances();
  console.log('Balance recalculation completed');
}

run().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
