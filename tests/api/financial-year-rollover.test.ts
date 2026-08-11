import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../api/_prisma.js';
import { AccountingService } from '../../api/_services/accounting.service.js';
import { FinancialYearService } from '../../api/_services/financial-year.service.js';

describe('Financial Year Opening/Closing & Automatic Rollover Engine', { timeout: 30000 }, () => {
  const testFy1 = 'FY 2026-2027';
  const testFy2 = 'FY 2027-2028';
  let testUserId: string;

  let cashAccountId: string;
  let cashGlCode: string;
  let revenueAccountId: string;
  let expenseAccountId: string;
  let equityAccountId: string;

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

    // Asset (Cash) Account
    let assetType = await prisma.accountType.findFirst({ where: { name: { in: ['Asset', 'ASSET'] } } });
    if (!assetType) assetType = await prisma.accountType.create({ data: { name: 'ASSET', description: 'Asset' } });

    cashGlCode = '1010199-TEST';
    let cashAccount = await prisma.account.findUnique({ where: { glCode: cashGlCode } });
    if (!cashAccount) {
      cashAccount = await prisma.account.create({
        data: {
          glCode: cashGlCode,
          accountName: 'Test Cash in Hand',
          accountLevel: 'GL',
          accountTypeId: assetType.id,
          detailType: 'Cash'
        }
      });
    }
    cashAccountId = cashAccount.id;

    // Revenue Account
    let revType = await prisma.accountType.findFirst({ where: { name: { in: ['Revenue', 'REVENUE', 'Income', 'INCOME'] } } });
    if (!revType) revType = await prisma.accountType.create({ data: { name: 'REVENUE', description: 'Revenue' } });

    const revGlCode = '4010199-TEST';
    let revAccount = await prisma.account.findUnique({ where: { glCode: revGlCode } });
    if (!revAccount) {
      revAccount = await prisma.account.create({
        data: {
          glCode: revGlCode,
          accountName: 'Test Donation Revenue',
          accountLevel: 'GL',
          accountTypeId: revType.id,
          detailType: 'Revenue'
        }
      });
    }
    revenueAccountId = revAccount.id;

    // Expense Account
    let expType = await prisma.accountType.findFirst({ where: { name: { in: ['Expense', 'EXPENSE', 'Expenses', 'EXPENSES'] } } });
    if (!expType) expType = await prisma.accountType.create({ data: { name: 'EXPENSE', description: 'Expense' } });

    const expGlCode = '5010199-TEST';
    let expAccount = await prisma.account.findUnique({ where: { glCode: expGlCode } });
    if (!expAccount) {
      expAccount = await prisma.account.create({
        data: {
          glCode: expGlCode,
          accountName: 'Test Office Expense',
          accountLevel: 'GL',
          accountTypeId: expType.id,
          detailType: 'Expense'
        }
      });
    }
    expenseAccountId = expAccount.id;

    // Equity Account
    let eqType = await prisma.accountType.findFirst({ where: { name: { in: ['Equity', 'EQUITY'] } } });
    if (!eqType) eqType = await prisma.accountType.create({ data: { name: 'EQUITY', description: 'Equity' } });

    const eqGlCode = '3030199-TEST';
    let eqAccount = await prisma.account.findUnique({ where: { glCode: eqGlCode } });
    if (!eqAccount) {
      eqAccount = await prisma.account.create({
        data: {
          glCode: eqGlCode,
          accountName: 'Test Opening Equity',
          accountLevel: 'GL',
          accountTypeId: eqType.id,
          detailType: 'Equity'
        }
      });
    }
    equityAccountId = eqAccount.id;

    // Ensure test financial years and test journal entries are cleaned
    const oldJvs = await prisma.journalEntry.findMany({
      where: { reference: { contains: 'TEST-' } },
      select: { id: true }
    });
    const oldJvIds = oldJvs.map(j => j.id);

    if (oldJvIds.length > 0) {
      await prisma.openingBalanceLine.deleteMany({ where: { batch: { journalEntryId: { in: oldJvIds } } } });
      await prisma.openingBalanceBatch.deleteMany({ where: { journalEntryId: { in: oldJvIds } } });
      await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: { in: oldJvIds } } });
      await prisma.journalEntry.deleteMany({ where: { id: { in: oldJvIds } } });
    }

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
    // Create FY 2026-2027 record
    const fy1Record = await FinancialYearService.getOrCreateYearByCode(testFy1);
    expect(fy1Record.code).toBe(testFy1);
    expect(fy1Record.isClosed).toBe(false);

    // Initial Opening Balance for Cash = PKR 100,000 on 01-07-2026
    const opDate = new Date('2026-07-01');

    const opJv = await AccountingService.postTransaction(prisma, {
      reference: 'TEST-OP-2026',
      description: 'Initial Opening Balance Test',
      module: 'Opening Balances',
      voucherType: 'OP',
      postedBy: 'Test Admin',
      postingDate: opDate,
      lines: [
        { accountId: cashAccountId, debit: 100000, credit: 0, description: 'Opening Cash' },
        { accountId: equityAccountId, debit: 0, credit: 100000, description: 'Opening Equity' }
      ]
    });

    const batch = await prisma.openingBalanceBatch.create({
      data: {
        financialYear: testFy1,
        openingDate: opDate,
        isAutoRolled: false,
        status: 'Posted',
        journalEntry: { connect: { id: opJv.id } },
        createdBy: testUserId,
        lines: {
          create: [
            { accountId: cashAccountId, glCode: cashGlCode, debitCredit: 'DEBIT', amount: 100000 }
          ]
        }
      }
    });

    expect(batch).toBeDefined();
    expect(batch.financialYear).toBe(testFy1);

    // Verify initial balance on GL for FY 2026-2027
    const gl = await AccountingService.getGeneralLedger({
      startDate: '2026-07-01',
      endDate: '2027-06-30',
      accountId: cashAccountId
    });

    expect(gl.summary.openingBalance).toBe(100000);
  });

  it('Step 2: Full Year Operational Transactions (Revenue: 50,000, Expense: 20,000)', async () => {
    // Transaction 1: Revenue Receipt (+50,000 Cash, +50,000 Revenue) on 15-10-2026
    await AccountingService.postReceipt(prisma, {
      amount: 50000,
      cashOrBankAccountId: cashAccountId,
      incomeAccountId: revenueAccountId,
      reference: 'TEST-REV-2026-001',
      description: 'Donation Receipt',
      module: 'Donations',
      postedBy: 'Test Admin',
      postingDate: '2026-10-15'
    });

    // Transaction 2: Expense Payment (-20,000 Cash, +20,000 Expense) on 20-03-2027
    await AccountingService.postPayment(prisma, {
      amount: 20000,
      cashOrBankAccountId: cashAccountId,
      expenseAccountId: expenseAccountId,
      reference: 'TEST-EXP-2026-001',
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
      accountId: cashAccountId
    });

    expect(gl.summary.closingBalance).toBe(130000);

    const isReport = await AccountingService.getIncomeStatement('2026-07-01', '2027-06-30');
    // Find test revenue & expense items
    const testRevItem = isReport.revenues.find(r => r.id === revenueAccountId);
    const testExpItem = isReport.expenses.find(e => e.id === expenseAccountId);
    expect(testRevItem?.balance).toBe(50000);
    expect(testExpItem?.balance).toBe(20000);
  });

  it('Step 3: Pre-Closing Automated Validation', async () => {
    const validation = await FinancialYearService.validateYearEndClosing(testFy1);
    expect(validation.canClose).toBe(true);
    expect(validation.errors).toHaveLength(0);
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
    const cashLine = fy2Batch?.lines.find(l => l.accountId === cashAccountId || l.glCode === cashGlCode);

    expect(cashLine).toBeDefined();
    expect(Number(cashLine?.amount)).toBe(130000); // Exactly PKR 130,000 opening!
  });

  it('Step 5: Verify Next Year (FY 2027-2028) Revenue & Expense Opening Balances Reset to 0', async () => {
    const isReportNextYear = await AccountingService.getIncomeStatement('2027-07-01', '2028-06-30');
    // Test revenue & expense accounts have zero movement in new year
    const revItem = isReportNextYear.revenues.find(r => r.id === revenueAccountId);
    const expItem = isReportNextYear.expenses.find(e => e.id === expenseAccountId);
    expect(revItem?.balance || 0).toBe(0);
    expect(expItem?.balance || 0).toBe(0);
  });

  it('Step 6: Post Next Year Transaction (Expense: 10,000) & Verify Real-Time Balance (120,000)', async () => {
    // Next year expense payment on 10-08-2027
    await AccountingService.postPayment(prisma, {
      amount: 10000,
      cashOrBankAccountId: cashAccountId,
      expenseAccountId: expenseAccountId,
      reference: 'TEST-EXP-2027-001',
      description: 'Next Year Fuel Expense',
      module: 'Expenses',
      postedBy: 'Test Admin',
      postingDate: '2027-08-10'
    });

    // Expected current Cash = Next Year Opening (130,000) - Expense (10,000) = 120,000
    const glNext = await AccountingService.getGeneralLedger({
      startDate: '2027-07-01',
      endDate: '2028-06-30',
      accountId: cashAccountId
    });

    expect(glNext.summary.openingBalance).toBe(130000);
    expect(glNext.summary.totalCredit).toBe(10000);
    expect(glNext.summary.closingBalance).toBe(120000);
  });

  it('Step 7: Closed Year Lock Enforcement', async () => {
    // Attempt to post transaction in closed FY 2026-2027 (date: 2026-11-20)
    await expect(
      AccountingService.postPayment(prisma, {
        amount: 5000,
        cashOrBankAccountId: cashAccountId,
        expenseAccountId: expenseAccountId,
        reference: 'TEST-ILLEGAL-2026',
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
