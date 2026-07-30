import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const connectionString = process.env.DATABASE_URL;
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

export async function resetFinancialData(client = prisma) {
  console.log('🔄 Starting reset of all test data, financial data, and transactions inside a database transaction...');

  const results = await client.$transaction(async (tx) => {
    // 1. Delete Zakat Cards
    const zcCount = await tx.zakatCard.deleteMany({});
    
    // 2. Delete Journal Entry Lines
    const jelCount = await tx.journalEntryLine.deleteMany({});
    
    // 3. Delete Journal Entries
    const jeCount = await tx.journalEntry.deleteMany({});
    
    // 4. Delete Donations (Given)
    const donGivenCount = await tx.donation.deleteMany({});
    
    // 5. Delete Donations Received
    const donRecvCount = await tx.donationReceived.deleteMany({});
    
    // 6. Delete Simple Expenses
    const seCount = await tx.simpleExpense.deleteMany({});
    
    // 7. Delete Simple Incomes
    const siCount = await tx.simpleIncome.deleteMany({});
    
    // 8. Delete Revenue Collections
    const rcCount = await tx.revenueCollection.deleteMany({});
    
    // 9. Delete Invoice Items & Invoices
    const invItemCount = await tx.invoiceItem.deleteMany({});
    const invCount = await tx.invoice.deleteMany({});
    
    // 10. Delete Hall Bookings
    const hbCount = await tx.hallBooking.deleteMany({});

    // 11. Delete Donors
    const donorCount = await tx.donor.deleteMany({});

    // 12. Delete Family Relationships & Members
    const familyRelCount = await tx.familyRelationship.deleteMany({});
    const memberCount = await tx.member.deleteMany({});

    // 13. Delete Beneficiaries
    const benCount = await tx.beneficiary.deleteMany({});

    // 14. Delete Customers
    const custCount = await tx.customer.deleteMany({});

    // 15. Delete Audit Logs
    const auditCount = await tx.auditLog.deleteMany({});

    // 16. Delete non-system test users (keep admin@erp.com and guest@erp.com)
    const userCount = await tx.user.deleteMany({
      where: {
        email: {
          notIn: ['admin@erp.com', 'guest@erp.com']
        }
      }
    });

    // 17. Reset Account initialBalance and currentBalance to 0 across all accounts
    const accUpdate = await tx.account.updateMany({
      data: {
        initialBalance: 0,
        currentBalance: 0,
      },
    });

    // 18. Reset RevenueHead amounts to 0
    const revHeadUpdate = await tx.revenueHead.updateMany({
      data: { amount: 0 },
    });

    return {
      zcCount: zcCount.count,
      jelCount: jelCount.count,
      jeCount: jeCount.count,
      donGivenCount: donGivenCount.count,
      donRecvCount: donRecvCount.count,
      seCount: seCount.count,
      siCount: siCount.count,
      rcCount: rcCount.count,
      invItemCount: invItemCount.count,
      invCount: invCount.count,
      hbCount: hbCount.count,
      donorCount: donorCount.count,
      familyRelCount: familyRelCount.count,
      memberCount: memberCount.count,
      benCount: benCount.count,
      custCount: custCount.count,
      auditCount: auditCount.count,
      userCount: userCount.count,
      accCount: accUpdate.count,
      revHeadCount: revHeadUpdate.count,
    };
  }, { timeout: 60000 });

  console.log(`Deleted ${results.jelCount} JournalEntryLines`);
  console.log(`Deleted ${results.jeCount} JournalEntries`);
  console.log(`Deleted ${results.donGivenCount} Donations Given`);
  console.log(`Deleted ${results.donRecvCount} Donations Received`);
  console.log(`Deleted ${results.seCount} SimpleExpenses`);
  console.log(`Deleted ${results.siCount} SimpleIncomes`);
  console.log(`Deleted ${results.rcCount} RevenueCollections`);
  console.log(`Deleted ${results.invCount} Invoices (${results.invItemCount} items)`);
  console.log(`Deleted ${results.hbCount} HallBookings`);
  console.log(`Deleted ${results.zcCount} ZakatCards`);
  console.log(`Deleted ${results.donorCount} Donors`);
  console.log(`Deleted ${results.familyRelCount} Family Relationships`);
  console.log(`Deleted ${results.memberCount} Members`);
  console.log(`Deleted ${results.benCount} Beneficiaries`);
  console.log(`Deleted ${results.custCount} Customers`);
  console.log(`Deleted ${results.auditCount} Audit Logs`);
  console.log(`Deleted ${results.userCount} Test Users`);
  console.log(`Reset initialBalance and currentBalance to 0 across ${results.accCount} Accounts`);

  console.log('\nSystem test data and financial data have been successfully reset.\n\nAll calculations are now starting from zero.\n\nMaster system configuration has been preserved.');
  return results;
}

async function main() {
  await resetFinancialData();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .catch((e) => {
      console.error('❌ Error clearing test and financial data (transaction rolled back):', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
    });
}
