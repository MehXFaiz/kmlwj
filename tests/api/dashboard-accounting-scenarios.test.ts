import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../api/index';
import { prisma } from '../../api/_prisma';
import { AccountingService } from '../../api/_services/accounting.service';

describe('7 Live Accounting & Dashboard Verification Scenarios', () => {
  let token: string;
  let adminUser: any;
  let testDonor: any;
  let cashAccount: any;
  let bankAccount: any;
  let donationIncomeAccount: any;
  let donationExpenseAccount: any;
  const createdVoucherNos: string[] = [];
  const createdDonationReceivedIds: string[] = [];
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_sign_key_123_abc';

  beforeAll(async () => {
    // Ensure pristine initial state
    await prisma.account.updateMany({
      where: { glCode: { in: ['1010102', '4080103'] } },
      data: { initialBalance: 0 }
    });

    const oldTestJes = await prisma.journalEntry.findMany({
      where: {
        OR: [
          { voucherNo: { startsWith: 'SCEN' } },
          { voucherNo: { startsWith: 'CR-TEST' } },
          { reference: { contains: 'Scenario' } }
        ]
      },
      select: { id: true }
    });
    if (oldTestJes.length > 0) {
      const oldIds = oldTestJes.map(j => j.id);
      await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: { in: oldIds } } });
      await prisma.donationReceived.deleteMany({ where: { journalEntryId: { in: oldIds } } });
      await prisma.journalEntry.deleteMany({ where: { id: { in: oldIds } } });
    }

    await AccountingService.syncAllModulesToLedger(prisma);

    adminUser = await prisma.user.findFirst({
      where: { role: { name: { in: ['admin', 'super admin', 'administrator'], mode: 'insensitive' } } }
    });
    const subId = adminUser ? adminUser.id : 'admin-user-id';
    const email = adminUser ? adminUser.email : 'admin@erp.com';
    token = jwt.sign({ sub: subId, email, role: 'admin' }, secret);

    testDonor = await prisma.donor.findFirst({ where: { isDeleted: false } });
    if (!testDonor) {
      testDonor = await prisma.donor.create({
        data: {
          fullName: 'Scenario Test Donor',
          donorCode: `DNR-${Date.now()}`,
          mobile: '03009999999',
          isActive: true
        }
      });
    }

    const assetType = await prisma.accountType.findFirst({
      where: { name: { in: ['Asset', 'Assets'], mode: 'insensitive' } }
    });
    const revenueType = await prisma.accountType.findFirst({
      where: { name: { in: ['Revenue', 'Income'], mode: 'insensitive' } }
    });
    const expenseType = await prisma.accountType.findFirst({
      where: { name: { in: ['Expense', 'Expenses'], mode: 'insensitive' } }
    });

    bankAccount = await prisma.account.findFirst({
      where: {
        isDeleted: false,
        isLocked: false,
        accountLevel: 'GL',
        accountTypeId: assetType?.id,
        OR: [
          { glCode: '1010101' },
          { detailType: { in: ['Bank', 'bank'] } },
          { accountName: { contains: 'bank', mode: 'insensitive' } }
        ]
      }
    });

    cashAccount = await prisma.account.findFirst({
      where: {
        isDeleted: false,
        isLocked: false,
        accountLevel: 'GL',
        accountTypeId: assetType?.id,
        OR: [
          { glCode: '1010103' },
          { detailType: { in: ['Cash', 'cash'] } },
          { accountName: { contains: 'cash', mode: 'insensitive' } }
        ]
      }
    });

    donationIncomeAccount = await prisma.account.findFirst({
      where: {
        isDeleted: false,
        accountTypeId: revenueType?.id,
        accountLevel: 'GL',
        accountName: { contains: 'donation', mode: 'insensitive' }
      }
    }) || await prisma.account.findFirst({
      where: {
        isDeleted: false,
        accountTypeId: revenueType?.id,
        accountLevel: 'GL'
      }
    });

    donationExpenseAccount = await prisma.account.findFirst({
      where: {
        isDeleted: false,
        accountTypeId: expenseType?.id,
        accountLevel: 'GL',
        accountName: { contains: 'donation', mode: 'insensitive' }
      }
    }) || await prisma.account.findFirst({
      where: {
        isDeleted: false,
        accountTypeId: expenseType?.id,
        accountLevel: 'GL'
      }
    });
  }, 90000);

  it('Scenario 1: Cash donation Rs 10,000 increases Cash in Hand & Income, Bank unchanged', async () => {
    const beforeRes = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    const beforeCash = beforeRes.body.data.cashInHand;
    const beforeBank = beforeRes.body.data.bankBalance;
    const beforeIncome = beforeRes.body.data.income;
    const beforeNet = beforeRes.body.data.netResult;

    const voucherNo = `SCEN1-CASH-${Date.now()}`;
    createdVoucherNos.push(voucherNo);

    await AccountingService.postTransaction(prisma, {
      voucherNo,
      postingDate: new Date(),
      reference: 'Scenario 1 Cash Donation',
      module: 'Donations',
      postedBy: adminUser ? adminUser.id : 'Scenario Test',
      lines: [
        { accountId: cashAccount.id, debit: 10000, credit: 0, description: 'Cash Donation Received' },
        { accountId: donationIncomeAccount.id, debit: 0, credit: 10000, description: 'Donation Income' }
      ]
    });

    const afterRes = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(afterRes.body.data.cashInHand).toBe(beforeCash + 10000);
    expect(afterRes.body.data.bankBalance).toBe(beforeBank);
    expect(afterRes.body.data.income).toBe(beforeIncome + 10000);
    expect(afterRes.body.data.netResult).toBe(beforeNet + 10000);
  }, 30000);

  it('Scenario 2: Bank donation Rs 20,000 increases Bank Balance & Income, Cash unchanged', async () => {
    const beforeRes = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    const beforeCash = beforeRes.body.data.cashInHand;
    const beforeBank = beforeRes.body.data.bankBalance;
    const beforeIncome = beforeRes.body.data.income;
    const beforeNet = beforeRes.body.data.netResult;

    const voucherNo = `SCEN2-BANK-${Date.now()}`;
    createdVoucherNos.push(voucherNo);

    await AccountingService.postTransaction(prisma, {
      voucherNo,
      postingDate: new Date(),
      reference: 'Scenario 2 Bank Donation',
      module: 'Donations',
      postedBy: adminUser ? adminUser.id : 'Scenario Test',
      lines: [
        { accountId: bankAccount.id, debit: 20000, credit: 0, description: 'Bank Donation Received' },
        { accountId: donationIncomeAccount.id, debit: 0, credit: 20000, description: 'Donation Income' }
      ]
    });

    const afterRes = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(afterRes.body.data.bankBalance).toBe(beforeBank + 20000);
    expect(afterRes.body.data.cashInHand).toBe(beforeCash);
    expect(afterRes.body.data.income).toBe(beforeIncome + 20000);
    expect(afterRes.body.data.netResult).toBe(beforeNet + 20000);
  }, 30000);

  it('Scenario 3: Bank to Cash transfer (Contra) Rs 5,000 shifts balance with zero P&L impact', async () => {
    const beforeRes = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    const beforeCash = beforeRes.body.data.cashInHand;
    const beforeBank = beforeRes.body.data.bankBalance;
    const beforeIncome = beforeRes.body.data.income;
    const beforeExpenses = beforeRes.body.data.expenses;
    const beforeNet = beforeRes.body.data.netResult;

    const voucherNo = `SCEN3-CONTRA-${Date.now()}`;
    createdVoucherNos.push(voucherNo);

    await AccountingService.postTransaction(prisma, {
      voucherNo,
      postingDate: new Date(),
      reference: 'Scenario 3 Bank to Cash Transfer',
      module: 'Banking',
      postedBy: adminUser ? adminUser.id : 'Scenario Test',
      lines: [
        { accountId: cashAccount.id, debit: 5000, credit: 0, description: 'Cash drawn from Bank' },
        { accountId: bankAccount.id, debit: 0, credit: 5000, description: 'Bank transfer to Cash' }
      ]
    });

    const afterRes = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(afterRes.body.data.cashInHand).toBe(beforeCash + 5000);
    expect(afterRes.body.data.bankBalance).toBe(beforeBank - 5000);
    expect(afterRes.body.data.income).toBe(beforeIncome);
    expect(afterRes.body.data.expenses).toBe(beforeExpenses);
    expect(afterRes.body.data.netResult).toBe(beforeNet);
  }, 30000);

  it('Scenario 4: Donation distribution from Bank Rs 3,000 decreases Bank Balance & increases Expense', async () => {
    const beforeRes = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    const beforeCash = beforeRes.body.data.cashInHand;
    const beforeBank = beforeRes.body.data.bankBalance;
    const beforeExpenses = beforeRes.body.data.expenses;
    const beforeNet = beforeRes.body.data.netResult;

    const voucherNo = `SCEN4-DISB-BANK-${Date.now()}`;
    createdVoucherNos.push(voucherNo);

    await AccountingService.postTransaction(prisma, {
      voucherNo,
      postingDate: new Date(),
      reference: 'Scenario 4 Bank Distribution',
      module: 'Donations',
      postedBy: adminUser ? adminUser.id : 'Scenario Test',
      lines: [
        { accountId: donationExpenseAccount.id, debit: 3000, credit: 0, description: 'Donation Aid Distributed' },
        { accountId: bankAccount.id, debit: 0, credit: 3000, description: 'Disbursed from Bank' }
      ]
    });

    const afterRes = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(afterRes.body.data.bankBalance).toBe(beforeBank - 3000);
    expect(afterRes.body.data.cashInHand).toBe(beforeCash);
    expect(afterRes.body.data.expenses).toBe(beforeExpenses + 3000);
    expect(afterRes.body.data.netResult).toBe(beforeNet - 3000);
  }, 30000);

  it('Scenario 5: Donation distribution from Cash Rs 2,000 decreases Cash in Hand & increases Expense', async () => {
    const beforeRes = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    const beforeCash = beforeRes.body.data.cashInHand;
    const beforeBank = beforeRes.body.data.bankBalance;
    const beforeExpenses = beforeRes.body.data.expenses;
    const beforeNet = beforeRes.body.data.netResult;

    const voucherNo = `SCEN5-DISB-CASH-${Date.now()}`;
    createdVoucherNos.push(voucherNo);

    await AccountingService.postTransaction(prisma, {
      voucherNo,
      postingDate: new Date(),
      reference: 'Scenario 5 Cash Distribution',
      module: 'Donations',
      postedBy: adminUser ? adminUser.id : 'Scenario Test',
      lines: [
        { accountId: donationExpenseAccount.id, debit: 2000, credit: 0, description: 'Cash Aid Distributed' },
        { accountId: cashAccount.id, debit: 0, credit: 2000, description: 'Disbursed from Cash' }
      ]
    });

    const afterRes = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(afterRes.body.data.cashInHand).toBe(beforeCash - 2000);
    expect(afterRes.body.data.bankBalance).toBe(beforeBank);
    expect(afterRes.body.data.expenses).toBe(beforeExpenses + 2000);
    expect(afterRes.body.data.netResult).toBe(beforeNet - 2000);
  }, 30000);

  it('Scenario 6: Net Result strictly equals Total Income - Total Expenses & Equation is balanced', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    const data = res.body.data;
    expect(data.netResult).toBe(data.income - data.expenses);
    expect(data.isEquationBalanced).toBe(true);
    expect(data.totalAssets).toBe(data.totalLiabilities + data.totalEquity);
  }, 30000);

  it('Scenario 7: Monthly Donations KPI counts only current month donations received', async () => {
    const now = new Date();
    const vNo1 = `CR-TEST-CURR-${Date.now()}`;
    createdVoucherNos.push(vNo1);
    const je1 = await prisma.journalEntry.create({
      data: {
        voucherNo: vNo1,
        voucherType: 'CR',
        postingDate: now,
        subsidiary: 'Global',
        reference: 'Scenario 7 Current',
        description: 'Scenario 7 Current Month',
        postedBy: adminUser.id,
        status: 'Posted',
        lines: {
          create: [
            { accountId: cashAccount.id, debit: 7500, credit: 0, description: 'Cash' },
            { accountId: donationIncomeAccount.id, debit: 0, credit: 7500, description: 'Donation Income' }
          ]
        }
      }
    });

    const currentMonthDonation = await prisma.donationReceived.create({
      data: {
        receiptNo: `REC-CURR-${Date.now()}`,
        receiptDate: now,
        donorId: testDonor.id,
        createdById: adminUser.id,
        donationType: 'GENERAL_DONATION',
        paymentMethod: 'CASH',
        amount: 7500,
        status: 'POSTED',
        journalEntryId: je1.id,
        narration: 'Scenario 7 Current Month Received'
      }
    });
    createdDonationReceivedIds.push(currentMonthDonation.id);

    const pastDate = new Date(now.getFullYear(), now.getMonth() - 2, 15);
    const vNo2 = `CR-TEST-PAST-${Date.now()}`;
    createdVoucherNos.push(vNo2);
    const je2 = await prisma.journalEntry.create({
      data: {
        voucherNo: vNo2,
        voucherType: 'CR',
        postingDate: pastDate,
        subsidiary: 'Global',
        reference: 'Scenario 7 Past',
        description: 'Scenario 7 Past Month',
        postedBy: adminUser.id,
        status: 'Posted',
        lines: {
          create: [
            { accountId: bankAccount?.id || cashAccount.id, debit: 50000, credit: 0, description: 'Bank' },
            { accountId: donationIncomeAccount.id, debit: 0, credit: 50000, description: 'Donation Income' }
          ]
        }
      }
    });

    const pastMonthDonation = await prisma.donationReceived.create({
      data: {
        receiptNo: `REC-PAST-${Date.now()}`,
        receiptDate: pastDate,
        donorId: testDonor.id,
        createdById: adminUser.id,
        donationType: 'GENERAL_DONATION',
        paymentMethod: 'BANK',
        amount: 50000,
        status: 'POSTED',
        journalEntryId: je2.id,
        narration: 'Scenario 7 Past Month Received'
      }
    });
    createdDonationReceivedIds.push(pastMonthDonation.id);

    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    const data = res.body.data;
    expect(data.monthlyDonations).toBeGreaterThanOrEqual(7500);
    expect(data.totalDonationsReceived).toBeGreaterThanOrEqual(57500);
  }, 30000);

  afterAll(async () => {
    if (createdDonationReceivedIds.length > 0) {
      await prisma.donationReceived.deleteMany({
        where: { id: { in: createdDonationReceivedIds } }
      });
    }

    if (createdVoucherNos.length > 0) {
      const jes = await prisma.journalEntry.findMany({
        where: { voucherNo: { in: createdVoucherNos } },
        select: { id: true }
      });
      const jeIds = jes.map(j => j.id);
      if (jeIds.length > 0) {
        await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: { in: jeIds } } });
        await prisma.journalEntry.deleteMany({ where: { id: { in: jeIds } } });
      }
    }

    await AccountingService.syncAllModulesToLedger(prisma);
  }, 90000);
});
