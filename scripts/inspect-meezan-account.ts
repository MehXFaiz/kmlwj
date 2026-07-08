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
  const accounts = await prisma.account.findMany({
    where: {
      accountType: { name: { in: ['Asset', 'ASSET'], mode: 'insensitive' } },
      OR: [
        { accountName: { contains: 'bank', mode: 'insensitive' } },
        { accountName: { contains: 'cash', mode: 'insensitive' } },
        { detailType: { in: ['Cash', 'Bank'], mode: 'insensitive' } }
      ]
    },
    include: {
      journalEntryLines: {
        include: { journalEntry: true }
      }
    },
    orderBy: { glCode: 'asc' }
  });

  for (const acc of accounts) {
    console.log(`=============================`);
    console.log(`ACCOUNT: ${acc.accountName} | Code: ${acc.glCode} | ID: ${acc.id} | Balance: ${acc.currentBalance} | DetailType: ${acc.detailType}`);
    for (const l of acc.journalEntryLines) {
      console.log(`  Line [${l.journalEntry.voucherNo}] Debit: ${l.debit} Credit: ${l.credit} Desc: "${l.description || l.journalEntry.description}"`);
    }
  }
}

main().finally(() => { prisma.$disconnect(); pool.end(); });
