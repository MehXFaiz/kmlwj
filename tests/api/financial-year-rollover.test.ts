import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../api/_prisma.js';
import { AccountingService } from '../../api/_services/accounting.service.js';
import { FinancialYearService, parseFinancialYearCode } from '../../api/_services/financial-year.service.js';

describe('Financial Year Opening/Closing & Automatic Rollover Engine', () => {
  const testFy1 = 'FY 2026-2027';
  const testFy2 = 'FY 2027-2028';
  let testUserId: string;

  beforeAll(async () => {
    // Find or create test admin user
    let user = await prisma.user.findFirst({ where: { isDeleted: false } });
    if (!user) {
      let role = await prisma.role.findFirst({ where: { name: 'Super Admin' } });
      if (!role) {
        role = await prisma.role.create({ data: { name: 'Super Admin', description: 'Admin' } });
      }
      user = await prisma.user.create({
        data: {
          fullName: 'Test Admin',
          email: `testadmin_${Date.now()}@example.com`,
          password: 'password123',
          roleId: role.id
        }
      });
    }
    testUserId = user.id;

    // Ensure test financial years are reset/clean for predictable assertions
    await prisma.openingBalanceLine.deleteMany({
      where: { batch: { financialYear: { in: [testFy1, testFy2] } } }
    });
    await prisma.openingBalanceBatch.deleteMany({
      where: { financialYear: { in: [testFy1, testFy2] } }
    });
    await prisma.financialYear.deleteMany({
      where: { code: { in: [testFy1, testFy2] } }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Step 1: Financial Year Setup & Manual Opening Balance Entry (FY 2026-2027)', async () => {
    // Ensure Leaf Accounts exist
    const cashAccount = await AccountingService.ensureCashInHandAccount(prisma);
    expect(cashAccount).toBeDefined();
    expect(cashAccount.glCode).toBe('1010103');

    // Create FY 2026-2027 record
    const fy1Record = await FinancialYearService.getOrCreateYearByCode(testFy1);
    expect(fy1Record.code).toBe(testFy1);
    expect(fy1Record.isClosed).toBe(false);

    // Initial Opening Balance for Cash = PKR 100,000 on 01-07-2026
    const opDate = new Date('2026-07-01');
    const existingBatch = await prisma.openingBalanceBatch.findUnique({ where: { financialYear: testFy1 } });
    if (existingBatch) {
      await prisma.openingBalanceLine.deleteMany({ where: { batchId: existingBatch.id } });
      await prisma.openingBalanceBatch.delete({ where: { id: existingBatch.id } });
    }

    const opJv = await AccountingService.postTransaction(prisma, {
      reference: 'TEST-OP-2026',
      description: 'Initial Opening Balance Test',
      module: 'Opening Balances',
      voucherType: 'OP',
      postedBy: 'Test Admin',
      postingDate: opDate,
      lines: [
        { accountId: cashAccount.id, debit: 100000, credit: 0, description: 'Opening Cash' },
        { accountKeyword: 'Opening Equity', debit: 0, credit: 100000, description: 'Opening Equity' }
      ]
    });

    const batch = await prisma.openingBalanceBatch.create({
      data: {
        financialYear: testFy1,
        openingDate: opDate,
        isAutoRolled: false,
        status: 'Posted',
        journalEntryId: opJv.id,
        createdBy: testUserId,
        lines: {
          create: [
            { accountId: cashAccount.id, glCode: cashAccount.glCode, debitCredit: 'DEBIT', amount: 100000 }
          ]
        }
      }
    });

    expect(batch).toBeDefined();
    expect(batch.financialYear).toBe(testFy1);

    // Verify initial balance on GL/TB for FY 2026-2027
    const tb = await AccountingService.getTrialBalance('2026-07-01', '2027-06-30');
    expect(tb.difference).toBeLessThan(0.01);
  });

  it('Step 2: Full Year Operational Transactions (Revenue: 50,000, Expense: 20,000)', async () => {
    const cashAccount = await AccountingService.ensureCashInHandAccount(prisma);

    // Transaction 1: Revenue Receipt (+50,000 Cash, +50,000 Revenue) on 15-10-2026
    await AccountingService.postReceipt(prisma, {
      amount: 50000,
      cashOrBankAccountId: cashAccount.id,
      incomeAccountKeyword: 'Donation Income',
      reference: 'REV-2026-001',
      description: 'Donation Receipt',
      module: 'Donations',
      postedBy: 'Test Admin',
      postingDate: '2026-10-15'
    });

    // Transaction 2: Expense Payment (-20,000 Cash, +20,000 Expense) on 20-03-2027
    await AccountingService.postPayment(prisma, {
      amount: 20000,
      cashOrBankAccountId: cashAccount.id,
      expenseAccountKeyword: 'General Office Expense',
      reference: 'EXP-2026-001',
      description: 'Office Maintenance Expense',
      module: 'Expenses',
      postedBy: 'Test Admin',
      postingDate: '2027-03-20'
    });

    // Check FY 2026-2027 closing cash balance before year end:
    // Opening Cash (100,000) + Revenue (50,000) - Expense (20,000) = 130,000
    const gl = await AccountingService.getGeneralLedger({
      startDate: '2026-07-01',
      endDate: '2027-06-30',
      accountId: cashAccount.id
    });

    expect(gl.summary.closingBalance).toBe(130000);

    const isReport = await AccountingService.getIncomeStatement('2026-07-01', '2027-06-30');
    expect(isReport.netProfit).toBe(30000); // 50,000 - 20,000
  });

  it('Step 3: Pre-Closing Automated Validation', async () => {
    const validation = await FinancialYearService.validateYearEndClosing(testFy1);
    expect(validation.canClose).toBe(true);
    expect(validation.errors).toHaveLength(0);
    expect(validation.summary.netProfitOrLoss).toBe(30000);
  });

  it('Step 4: Execute Atomic Year-End Closing & Automatic Rollover to FY 2027-2028', async () => {
    const closeResult = await FinancialYearService.executeYearEndClosing(
      testFy1,
      '2027-06-30',
      testUserId,
      'Automated test execution of FY 2026-2027 closing'
    );

    expect(closeResult.closedFinancialYear).toBe(testFy1);
    expect(closeResult.nextFinancialYear).toBe(testFy2);
    expect(closeResult.netProfitLoss).toBe(30000);

    // Verify FY 2026-2027 is now closed in DB
    const fy1Db = await prisma.financialYear.findUnique({ where: { code: testFy1 } });
    expect(fy1Db?.isClosed).toBe(true);

    // Verify FY 2027-2028 Opening Balance Batch was created automatically
    const fy2Batch = await prisma.openingBalanceBatch.findUnique({
      where: { financialYear: testFy2 },
      include: { lines: { include: { account: true } } }
    });

    expect(fy2Batch).toBeDefined();
    expect(fy2Batch?.isAutoRolled).toBe(true);
    expect(fy2Batch?.sourceFinancialYear).toBe(testFy1);

    // Check Cash in Hand opening line for FY 2027-2028
    const cashAccount = await AccountingService.ensureCashInHandAccount(prisma);
    const cashLine = fy2Batch?.lines.find(l => l.accountId === cashAccount.id || l.glCode === cashAccount.glCode);

    expect(cashLine).toBeDefined();
    expect(Number(cashLine?.amount)).toBe(130000); // Exactly PKR 130,000 opening!
  });

  it('Step 5: Verify Next Year (FY 2027-2028) Revenue & Expense Opening Balances Reset to 0', async () => {
    const isReportNextYear = await AccountingService.getIncomeStatement('2027-07-01', '2028-06-30');
    // At start of new year, Revenue and Expense are 0
    expect(isReportNextYear.totalRevenue).toBe(0);
    expect(isReportNextYear.totalExpense).toBe(0);
    expect(isReportNextYear.netProfit).toBe(0);
  });

  it('Step 6: Post Next Year Transaction (Expense: 10,000) & Verify Real-Time Balance (120,000)', async () => {
    const cashAccount = await AccountingService.ensureCashInHandAccount(prisma);

    // Next year expense payment on 10-08-2027
    await AccountingService.postPayment(prisma, {
      amount: 10000,
      cashOrBankAccountId: cashAccount.id,
      expenseAccountKeyword: 'General Office Expense',
      reference: 'EXP-2027-001',
      description: 'Next Year Fuel Expense',
      module: 'Expenses',
      postedBy: 'Test Admin',
      postingDate: '2027-08-10'
    });

    // Expected current Cash = Next Year Opening (130,000) - Expense (10,000) = 120,000
    const glNext = await AccountingService.getGeneralLedger({
      startDate: '2027-07-01',
      endDate: '2028-06-30',
      accountId: cashAccount.id
    });

    expect(glNext.summary.openingBalance).toBe(130000);
    expect(glNext.summary.totalCredit).toBe(10000);
    expect(glNext.summary.closingBalance).toBe(120000);

    // Verify Trial Balance for FY 2027-2028 is balanced and cash equals 120,000 without double counting
    const tbNext = await AccountingService.getTrialBalance('2027-07-01', '2028-06-30');
    expect(tbNext.difference).toBeLessThan(0.01);
  });

  it('Step 7: Closed Year Lock Enforcement', async () => {
    const cashAccount = await AccountingService.ensureCashInHandAccount(prisma);

    // Attempt to post transaction in closed FY 2026-2027 (date: 2026-11-20)
    await expect(
      AccountingService.postPayment(prisma, {
        amount: 5000,
        cashOrBankAccountId: cashAccount.id,
        expenseAccountKeyword: 'Office Supplies',
        reference: 'ILLEGAL-2026',
        description: 'Posting into closed year',
        module: 'Expenses',
        postedBy: 'Test Admin',
        postingDate: '2026-11-20'
      })
    ).rejects.toThrow(/closed/i);
  });

  it('Step 8: Admin Reopening of Closed Financial Year', async () => {
    const reopened = await FinancialYearService.reopenFinancialYear(
      testFy1,
      testUserId,
      'Reopening FY 2026-2027 for external audit adjustment per request.'
    );

    expect(reopened.isClosed).toBe(false);

    // Verify audit trail log created for reopening
    const auditLog = await prisma.auditLog.findFirst({
      where: { action: 'Year Reopened' },
      orderBy: { createdAt: 'desc' }
    });

    expect(auditLog).toBeDefined();
    expect(auditLog?.userId).toBe(testUserId);
  });
});
