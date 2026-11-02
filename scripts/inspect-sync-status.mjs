import { PrismaClient } from '@prisma/client';
import { AccountingService } from '../api/_services/accounting.service.js';
const prisma = new PrismaClient();

async function run() {
  const summary = await AccountingService.getFinancialSummary();
  console.log('--- DASHBOARD SUMMARY ---');
  console.log('Total Revenue:', summary.totalRevenue);
  console.log('Total Expense:', summary.totalExpense);
  console.log('Net Period Income:', summary.netPeriodIncome);
  console.log('Total Assets:', summary.totalAssets);
  console.log('Total Liabilities:', summary.totalLiabilities);
  console.log('Total Equity:', summary.totalEquity);
  console.log('Is Equation Balanced:', summary.isEquationBalanced);
  console.log('Cash Balance:', summary.cashBalance);
  console.log('Bank Balance:', summary.bankBalance);

  // Check monthly data for 2026
  const startOfYear = new Date('2026-01-01T00:00:00Z');
  const endOfYear = new Date('2027-01-01T00:00:00Z');

  const postedJournals = await prisma.journalEntry.findMany({
    where: {
      status: 'Posted',
      isDeleted: false,
      postingDate: {
        gte: startOfYear,
        lt: endOfYear,
      }
    },
    select: {
      postingDate: true,
      lines: {
        select: {
          debit: true,
          credit: true,
          account: {
            select: {
              accountType: { select: { name: true } }
            }
          }
        }
      }
    }
  });

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyData = months.map(month => ({ month, Revenue: 0, Expenses: 0 }));

  for (const entry of postedJournals) {
    const monthIndex = entry.postingDate ? entry.postingDate.getMonth() : 0;
    for (const line of entry.lines) {
      const typeName = (line.account?.accountType?.name || '').toUpperCase();
      if (typeName === 'REVENUE' || typeName === 'INCOME') {
        monthlyData[monthIndex].Revenue += (Number(line.credit) || 0) - (Number(line.debit) || 0);
      } else if (typeName === 'EXPENSE' || typeName === 'EXPENSES') {
        monthlyData[monthIndex].Expenses += (Number(line.debit) || 0) - (Number(line.credit) || 0);
      }
    }
  }

  console.log('--- MONTHLY REVENUE VS EXPENSE TREND ---');
  console.table(monthlyData.filter(m => m.Revenue > 0 || m.Expenses > 0));

  await prisma.$disconnect();
}
run();
