import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const accs = await prisma.account.findMany({
  where: {
    OR: ['zakat', 'bank', 'nbp', 'cash'].map((s) => ({
      accountName: { contains: s, mode: 'insensitive' as const },
    })),
  },
  select: { glCode: true, accountName: true, accountLevel: true, initialBalance: true, currentBalance: true },
  orderBy: { glCode: 'asc' },
});
for (const a of accs) {
  console.log(`${a.glCode}  [${a.accountLevel}]  ${a.accountName}  initial=${a.initialBalance} current=${a.currentBalance}`);
}
await prisma.$disconnect();
await pool.end();
