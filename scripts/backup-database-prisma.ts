import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../api/_prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runBackup() {
  console.log('--- STARTING COMPLETE DATABASE BACKUP VIA PRISMA ---');
  const backupDir = path.resolve(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilePath = path.join(backupDir, `db-backup-pre-fix-${timestamp}.json`);

  const tables: Record<string, any> = {};

  const models: [string, () => Promise<any>][] = [
    ['User', () => prisma.user.findMany()],
    ['Role', () => prisma.role.findMany()],
    ['Permission', () => prisma.permission.findMany()],
    ['RolePermission', () => prisma.rolePermission.findMany()],
    ['RefreshToken', () => prisma.refreshToken.findMany()],
    ['AccountType', () => prisma.accountType.findMany()],
    ['Account', () => prisma.account.findMany()],
    ['ReservedCode', () => prisma.reservedCode.findMany()],
    ['RevenueHead', () => prisma.revenueHead.findMany()],
    ['ExpenseHead', () => prisma.expenseHead.findMany()],
    ['AuditLog', () => prisma.auditLog.findMany().catch(async () => {
      // Fallback via raw command
      const res = await (prisma as any).$runCommandRaw({ find: 'AuditLog', filter: {} });
      return res.cursor?.firstBatch || [];
    })],
    ['JournalEntry', () => prisma.journalEntry.findMany()],
    ['JournalEntryLine', () => prisma.journalEntryLine.findMany()],
    ['Beneficiary', () => prisma.beneficiary.findMany()],
    ['Donation', () => prisma.donation.findMany()],
    ['SimpleIncome', () => prisma.simpleIncome.findMany()],
    ['IncomeCategory', () => prisma.incomeCategory.findMany()],
    ['AddIncomeRecord', () => prisma.addIncomeRecord.findMany()],
    ['SimpleExpense', () => prisma.simpleExpense.findMany()],
    ['HallBooking', () => prisma.hallBooking.findMany()],
    ['Customer', () => prisma.customer.findMany()],
    ['Invoice', () => prisma.invoice.findMany()],
    ['InvoiceItem', () => prisma.invoiceItem.findMany()],
    ['RevenueCollection', () => prisma.revenueCollection.findMany()],
    ['Member', () => prisma.member.findMany()],
    ['FamilyRelationship', () => prisma.familyRelationship.findMany()],
    ['ZakatCard', () => prisma.zakatCard.findMany()],
    ['Donor', () => prisma.donor.findMany()],
    ['DonationReceived', () => prisma.donationReceived.findMany()],
    ['AiRepairIssue', () => prisma.aiRepairIssue.findMany()],
    ['AiRepairLog', () => prisma.aiRepairLog.findMany()],
    ['PettyCashConfig', () => prisma.pettyCashConfig.findMany()],
    ['PettyCashTransaction', () => prisma.pettyCashTransaction.findMany()],
    ['PettyCashReconciliation', () => prisma.pettyCashReconciliation.findMany()],
    ['FinancialYear', () => prisma.financialYear.findMany()],
    ['OpeningBalanceBatch', () => prisma.openingBalanceBatch.findMany()],
    ['OpeningBalanceLine', () => prisma.openingBalanceLine.findMany()],
  ];

  const summary: Record<string, number> = {};
  let totalRecords = 0;

  for (const [name, fn] of models) {
    try {
      const data = await fn();
      tables[name] = data;
      summary[name] = data.length;
      totalRecords += data.length;
      console.log(`Backed up [${name}]: ${data.length} records`);
    } catch (err: any) {
      console.warn(`Warning backing up [${name}]:`, err.message);
      try {
        const raw = await (prisma as any).$runCommandRaw({ find: name, filter: {} });
        const list = raw.cursor?.firstBatch || [];
        tables[name] = list;
        summary[name] = list.length;
        totalRecords += list.length;
        console.log(`Backed up [${name}] via raw: ${list.length} records`);
      } catch (err2: any) {
        console.error(`Failed to back up [${name}]:`, err2.message);
        tables[name] = [];
        summary[name] = 0;
      }
    }
  }

  const payload = {
    metadata: {
      timestamp: new Date().toISOString(),
      database: 'kmlwj',
      totalRecords,
      summary,
    },
    tables,
  };

  fs.writeFileSync(backupFilePath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`\n✅ Backup successfully saved to: ${backupFilePath}`);
  console.log(`Total records backed up: ${totalRecords}`);

  await prisma.$disconnect();
}

runBackup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
