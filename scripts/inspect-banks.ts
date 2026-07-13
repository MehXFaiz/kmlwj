import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
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
  console.log("=== Inspecting Meezan and HBL Bank Accounts ===");
  const bankCodes = ['1100001', '1100002', '1010101', '1010102'];
  
  for (const code of bankCodes) {
    const acc = await prisma.account.findUnique({
      where: { glCode: code },
      include: {
        _count: {
          select: {
            journalEntryLines: true,
            ledgerEntries: true,
          }
        }
      }
    });
    
    if (acc) {
      console.log(`\nAccount Code: ${acc.glCode} | Name: ${acc.accountName} | Level: ${acc.accountLevel}`);
      console.log(`- Journal Lines Count: ${acc._count.journalEntryLines}`);
      console.log(`- Ledger Entries Count: ${acc._count.ledgerEntries}`);
    } else {
      console.log(`\nAccount Code ${code} not found in database.`);
    }
  }
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
