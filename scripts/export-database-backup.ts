import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('sslmode=require') || connectionString.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function exportBackup() {
  console.log('📦 Starting complete database export/backup...');

  const backupDir = path.resolve(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilePath = path.join(backupDir, `db-backup-${timestamp}.json`);

  const tables: Record<string, any> = {};

  console.log('Fetching records from all tables...');

  tables['User'] = await prisma.user.findMany();
  tables['Role'] = await prisma.role.findMany();
  tables['Permission'] = await prisma.permission.findMany();
  tables['RolePermission'] = await prisma.rolePermission.findMany();
  tables['RefreshToken'] = await prisma.refreshToken.findMany();
  tables['AccountType'] = await prisma.accountType.findMany();
  tables['Account'] = await prisma.account.findMany();
  tables['ReservedCode'] = await prisma.reservedCode.findMany();
  tables['RevenueHead'] = await prisma.revenueHead.findMany();
  tables['ExpenseHead'] = await prisma.expenseHead.findMany();
  tables['AuditLog'] = await prisma.auditLog.findMany();
  tables['JournalEntry'] = await prisma.journalEntry.findMany();
  tables['JournalEntryLine'] = await prisma.journalEntryLine.findMany();
  tables['Beneficiary'] = await prisma.beneficiary.findMany();
  tables['Donation'] = await prisma.donation.findMany();
  tables['SimpleIncome'] = await prisma.simpleIncome.findMany();
  tables['IncomeCategory'] = await prisma.incomeCategory.findMany();
  tables['AddIncomeRecord'] = await prisma.addIncomeRecord.findMany();
  tables['SimpleExpense'] = await prisma.simpleExpense.findMany();
  tables['HallBooking'] = await prisma.hallBooking.findMany();
  tables['Customer'] = await prisma.customer.findMany();
  tables['Invoice'] = await prisma.invoice.findMany();
  tables['InvoiceItem'] = await prisma.invoiceItem.findMany();
  tables['RevenueCollection'] = await prisma.revenueCollection.findMany();
  tables['Member'] = await prisma.member.findMany();
  tables['FamilyRelationship'] = await prisma.familyRelationship.findMany();
  tables['ZakatCard'] = await prisma.zakatCard.findMany();
  tables['Donor'] = await prisma.donor.findMany();
  tables['DonationReceived'] = await prisma.donationReceived.findMany();
  tables['AiRepairIssue'] = await prisma.aiRepairIssue.findMany();
  tables['AiRepairLog'] = await prisma.aiRepairLog.findMany();
  tables['PettyCashConfig'] = await prisma.pettyCashConfig.findMany();
  tables['PettyCashTransaction'] = await prisma.pettyCashTransaction.findMany();
  tables['PettyCashReconciliation'] = await prisma.pettyCashReconciliation.findMany();
  tables['FinancialYear'] = await prisma.financialYear.findMany();
  tables['OpeningBalanceBatch'] = await prisma.openingBalanceBatch.findMany();
  tables['OpeningBalanceLine'] = await prisma.openingBalanceLine.findMany();

  const summary: Record<string, number> = {};
  let totalRecords = 0;
  for (const [table, rows] of Object.entries(tables)) {
    summary[table] = rows.length;
    totalRecords += rows.length;
  }

  const payload = {
    metadata: {
      timestamp: new Date().toISOString(),
      database: 'kmlwj',
      environment: process.env.NODE_ENV || 'development',
      totalRecords,
      summary,
    },
    tables,
  };

  fs.writeFileSync(backupFilePath, JSON.stringify(payload, null, 2), 'utf-8');

  const stats = fs.statSync(backupFilePath);
  console.log(`\n✅ Backup successfully created at: ${backupFilePath}`);
  console.log(`📦 File size: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`📊 Total records backed up: ${totalRecords}`);
  console.log('\n--- Table Record Counts ---');
  for (const [table, count] of Object.entries(summary)) {
    if (count > 0) {
      console.log(`  - ${table}: ${count}`);
    }
  }

  return { backupFilePath, totalRecords, summary };
}

export { exportBackup };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  exportBackup()
    .catch((err) => {
      console.error('❌ Backup failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
    });
}
