import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString?.includes('sslmode=require') || connectionString?.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== RUNNING EXPENSE CATEGORIES MIGRATION ===");

  // 1. Rename ExpenseHead records
  const heads = await prisma.expenseHead.findMany();
  for (const head of heads) {
    const nameLower = head.name.toLowerCase();
    if (nameLower === 'bus repair' || nameLower === 'bus repairs') {
      await prisma.expenseHead.update({
        where: { id: head.id },
        data: { name: 'Bus Expense' }
      });
      console.log(`✅ Renamed ExpenseHead ${head.name} -> Bus Expense`);
    } else if (nameLower === 'generator repair' || nameLower === 'generator repairs') {
      await prisma.expenseHead.update({
        where: { id: head.id },
        data: { name: 'Generator Expense' }
      });
      console.log(`✅ Renamed ExpenseHead ${head.name} -> Generator Expense`);
    }
  }

  // 2. Rename Chart of Accounts Account records
  const accounts = await prisma.account.findMany({
    where: {
      OR: [
        { glCode: '4050101' },
        { glCode: '4050102' },
        { accountName: { contains: 'Bus Repair', mode: 'insensitive' } },
        { accountName: { contains: 'Generator Repair', mode: 'insensitive' } }
      ]
    }
  });

  for (const acc of accounts) {
    if (acc.glCode === '4050101' || acc.accountName.toLowerCase().includes('bus')) {
      await prisma.account.update({
        where: { id: acc.id },
        data: { accountName: 'Bus Expense' }
      });
      console.log(`✅ Renamed Account ${acc.glCode} | ${acc.accountName} -> Bus Expense`);
    } else if (acc.glCode === '4050102' || acc.accountName.toLowerCase().includes('generator')) {
      await prisma.account.update({
        where: { id: acc.id },
        data: { accountName: 'Generator Expense' }
      });
      console.log(`✅ Renamed Account ${acc.glCode} | ${acc.accountName} -> Generator Expense`);
    }
  }

  // Helper function to migrate descriptions
  const migrateText = (text: string | null): string | null => {
    if (!text) return null;
    let newText = text;
    
    // Replace "Bus Repair" variations
    newText = newText.replace(/Bus Repair/g, 'Bus Expense - Repair');
    newText = newText.replace(/Bus repair/g, 'Bus Expense - Repair');
    newText = newText.replace(/bus repair/g, 'Bus Expense - Repair');
    
    // Replace "Generator Repair" variations
    newText = newText.replace(/Generator Repair/g, 'Generator Expense - Repair');
    newText = newText.replace(/Generator repair/g, 'Generator Expense - Repair');
    newText = newText.replace(/generator repair/g, 'Generator Expense - Repair');

    // Remove duplicates like "Bus Expense - Repair - Repair" if double-replaced
    newText = newText.replace(/Bus Expense - Repair - Repair/g, 'Bus Expense - Repair');
    newText = newText.replace(/Generator Expense - Repair - Repair/g, 'Generator Expense - Repair');

    return newText;
  };

  // 3. Migrate SimpleExpense descriptions
  const simpleExpenses = await prisma.simpleExpense.findMany();
  for (const exp of simpleExpenses) {
    const updatedDesc = migrateText(exp.description);
    if (updatedDesc !== exp.description) {
      await prisma.simpleExpense.update({
        where: { id: exp.id },
        data: { description: updatedDesc }
      });
      console.log(`✅ Updated SimpleExpense ID ${exp.id} description: "${exp.description}" -> "${updatedDesc}"`);
    }
  }

  // 4. Migrate JournalEntry descriptions
  const journalEntries = await prisma.journalEntry.findMany();
  for (const je of journalEntries) {
    const updatedDesc = migrateText(je.description);
    const updatedRef = migrateText(je.reference);
    if (updatedDesc !== je.description || updatedRef !== je.reference) {
      await prisma.journalEntry.update({
        where: { id: je.id },
        data: {
          description: updatedDesc || '',
          reference: updatedRef || ''
        }
      });
      console.log(`✅ Updated JournalEntry ID ${je.id} description/reference.`);
    }
  }

  // 5. Migrate JournalEntryLine descriptions
  const lines = await prisma.journalEntryLine.findMany();
  for (const line of lines) {
    const updatedDesc = migrateText(line.description);
    if (updatedDesc !== line.description) {
      await prisma.journalEntryLine.update({
        where: { id: line.id },
        data: { description: updatedDesc || '' }
      });
      console.log(`✅ Updated JournalEntryLine ID ${line.id} description.`);
    }
  }

  console.log("=== EXPENSE CATEGORIES MIGRATION COMPLETED ===");
}

main()
  .catch(e => {
    console.error("❌ Error running migration:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
