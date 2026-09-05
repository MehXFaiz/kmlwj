import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../api/index';
import { prisma } from '../../api/_prisma';
import { AccountingService } from '../../api/_services/accounting.service';

describe('Dashboard Data Architecture & Summary API', () => {
  let token: string;
  let cashAccount: any;
  let bankAccount: any;
  let incomeAccount: any;
  let expenseAccount: any;
  const createdVoucherNos: string[] = [];
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_sign_key_123_abc';

  beforeAll(async () => {
    const adminUser = await prisma.user.findFirst({
      where: { role: { name: { in: ['admin', 'super admin', 'administrator'], mode: 'insensitive' } } }
    });
    const subId = adminUser ? adminUser.id : 'admin-user-id';
    const email = adminUser ? adminUser.email : 'admin@erp.com';
    token = jwt.sign({ sub: subId, email, role: 'admin' }, secret);

    // Find or create test accounts for clean testing
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
        accountTypeId: assetType?.id,
        OR: [
          { detailType: { in: ['Bank', 'bank'] } },
          { accountName: { contains: 'bank', mode: 'insensitive' } }
        ]
      }
    });

    cashAccount = await prisma.account.findFirst({
      where: {
        isDeleted: false,
        accountTypeId: assetType?.id,
        OR: [
          { detailType: { in: ['Cash', 'cash'] } },
          { accountName: { contains: 'cash', mode: 'insensitive' } }
        ]
      }
    });

    incomeAccount = await prisma.account.findFirst({
      where: {
        isDeleted: false,
        accountTypeId: revenueType?.id,
      }
    });

    expenseAccount = await prisma.account.findFirst({
      where: {
        isDeleted: false,
        accountTypeId: expenseType?.id,
      }
    });
  });

  it('1. should return 200 with structured JSON from GET /api/v1/dashboard/summary', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary?fiscalYear=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 200);
    expect(res.body).toHaveProperty('data');
    const data = res.body.data;
    expect(typeof data.income).toBe('number');
    expect(typeof data.expenses).toBe('number');
    expect(typeof data.donations).toBe('number');
    expect(typeof data.cashInHand).toBe('number');
    expect(typeof data.bankBalance).toBe('number');
    expect(typeof data.netResult).toBe('number');
    expect(typeof data.monthlyDonations).toBe('number');
    expect(typeof data.monthlyZakat).toBe('number');
    expect(typeof data.totalAssets).toBe('number');
    expect(typeof data.totalLiabilities).toBe('number');
    expect(typeof data.totalEquity).toBe('number');
    expect(typeof data.isEquationBalanced).toBe('boolean');
    expect(data.currency).toBe('PKR');
  }, 30000);

  it('2. should return 200 from alias GET /api/dashboard/summary', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary?fiscalYear=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('income');
    expect(res.body.data).toHaveProperty('expenses');
    expect(res.body.data).toHaveProperty('netResult');
  }, 30000);

  it('3. should return 200 with full chart series from GET /api/v1/dashboard/stats', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/stats?fiscalYear=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data).toHaveProperty('monthlyData');
    expect(Array.isArray(res.body.data.monthlyData)).toBe(true);
    expect(res.body.data.monthlyData.length).toBe(12);
  }, 30000);

  it('4. should accurately reflect income transaction in dashboard summary', async () => {
    const beforeRes = await request(app)
      .get('/api/v1/dashboard/summary?startDate=2026-06-01&endDate=2026-06-30')
      .set('Authorization', `Bearer ${token}`);

    const initialIncome = beforeRes.body.data.income;
    const initialNet = beforeRes.body.data.netResult;

    if (incomeAccount && cashAccount) {
      const testVoucherNo = `TEST-INC-${Date.now()}`;
      createdVoucherNos.push(testVoucherNo);
      await AccountingService.postTransaction(prisma, {
        voucherNo: testVoucherNo,
        postingDate: new Date('2026-06-15T10:00:00Z'),
        reference: 'Test Income Post',
        module: 'Revenue',
        postedBy: 'Test Runner',
        lines: [
          {
            accountId: cashAccount.id,
            debit: 10000,
            credit: 0,
            description: 'Cash received'
          },
          {
            accountId: incomeAccount.id,
            debit: 0,
            credit: 10000,
            description: 'Income earned'
          }
        ]
      });

      const afterRes = await request(app)
        .get('/api/v1/dashboard/summary?startDate=2026-06-01&endDate=2026-06-30')
        .set('Authorization', `Bearer ${token}`);

      expect(afterRes.body.data.income).toBe(initialIncome + 10000);
      expect(afterRes.body.data.netResult).toBe(initialNet + 10000);
    }
  }, 30000);

  it('5. should accurately reflect expense transaction in dashboard summary', async () => {
    const beforeRes = await request(app)
      .get('/api/v1/dashboard/summary?startDate=2026-07-01&endDate=2026-07-31')
      .set('Authorization', `Bearer ${token}`);

    const initialExpense = beforeRes.body.data.expenses;
    const initialNet = beforeRes.body.data.netResult;

    if (expenseAccount && cashAccount) {
      const testVoucherNo = `TEST-EXP-${Date.now()}`;
      createdVoucherNos.push(testVoucherNo);
      await AccountingService.postTransaction(prisma, {
        voucherNo: testVoucherNo,
        postingDate: new Date('2026-07-15T10:00:00Z'),
        reference: 'Test Expense Post',
        module: 'Expense',
        postedBy: 'Test Runner',
        lines: [
          {
            accountId: expenseAccount.id,
            debit: 2500,
            credit: 0,
            description: 'Expense incurred'
          },
          {
            accountId: cashAccount.id,
            debit: 0,
            credit: 2500,
            description: 'Cash paid'
          }
        ]
      });

      const afterRes = await request(app)
        .get('/api/v1/dashboard/summary?startDate=2026-07-01&endDate=2026-07-31')
        .set('Authorization', `Bearer ${token}`);

      expect(afterRes.body.data.expenses).toBe(initialExpense + 2500);
      expect(afterRes.body.data.netResult).toBe(initialNet - 2500);
    }
  }, 30000);

  afterAll(async () => {
    if (createdVoucherNos.length > 0) {
      const jes = await prisma.journalEntry.findMany({
        where: { voucherNo: { in: createdVoucherNos } }
      });
      for (const je of jes) {
        await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: je.id } });
        await prisma.journalEntry.delete({ where: { id: je.id } });
      }
      await AccountingService.recalculateAllBalances(prisma);
    }
  }, 30000);
});
