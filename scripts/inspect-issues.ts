import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { AccountingIntegrityService } from '../api/_services/accounting-integrity.service.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString?.includes('sslmode=require') || connectionString?.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});

const adapter = new PrismaPg(pool);
const prismaInstance = new PrismaClient({ adapter });

async function main() {
  console.log("=== Running Integrity Check ===");
  const results = await AccountingIntegrityService.runFullCheck();
  console.log(`Total Issues Found: ${results.totalIssues}`);
  console.log(`Critical Count: ${results.criticalCount}`);
  console.log(`Warning Count: ${results.warningCount}`);
  console.log(`Info Count: ${results.infoCount}`);
  
  console.log("\n--- Remaining Critical/Warning Issues List ---");
  const filtered = results.issues.filter(i => i.severity !== 'info');
  if (filtered.length === 0) {
    console.log("🎉 No remaining Critical or Warning issues found!");
  } else {
    filtered.forEach((issue, idx) => {
      console.log(`${idx + 1}. [${issue.severity.toUpperCase()}] [${issue.type}] ${issue.description}`);
    });
  }
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await pool.end();
  });
