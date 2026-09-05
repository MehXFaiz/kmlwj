import { prisma } from '../api/_prisma.js';

async function inspectEmpty() {
  const totalLines = await prisma.journalEntryLine.count();
  console.log(`Total JournalEntryLine records in DB: ${totalLines}`);

  const lines = await prisma.journalEntryLine.findMany({
    take: 20,
    include: { journalEntry: true, account: true }
  });
  console.log('Sample JournalEntryLines:', JSON.stringify(lines, null, 2));

  // Check if there are journalEntryLine with invalid/null journalEntryId
  const allLines = await prisma.journalEntryLine.findMany();
  console.log('All lines journalEntryIds:', allLines.map(l => ({ id: l.id, jeId: l.journalEntryId, debit: l.debit, credit: l.credit })));
}

inspectEmpty().catch(console.error).finally(() => prisma.$disconnect());
