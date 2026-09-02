import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../api/index';
import { prisma } from '../../api/_prisma';
import { AccountingService } from '../../api/_services/accounting.service';

describe('Monthly Donation Disbursement & Bank Deduction Workflow', () => {
  let token: string;
  let bankAccount1: any;
  let bankAccount2: any;
  let createdDonationIds: string[] = [];
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_sign_key_123_abc';

  beforeAll(async () => {
    // 1. Authenticated admin user
    const adminUser = await prisma.user.findFirst({
      where: { role: { name: { in: ['admin', 'super admin', 'administrator'], mode: 'insensitive' } } }
    });
    const subId = adminUser ? adminUser.id : 'admin-user-id';
    const email = adminUser ? adminUser.email : 'admin@erp.com';
    token = jwt.sign({ sub: subId, email, role: 'admin' }, secret);

    // 2. Ensure 2 Bank Accounts in Chart of Accounts
    const bankAssetType = await prisma.accountType.findFirst({
      where: { name: { in: ['Asset', 'Assets'], mode: 'insensitive' } }
    });

    bankAccount1 = await prisma.account.findFirst({
      where: {
        isDeleted: false,
        isLocked: false,
        OR: [{ detailType: 'Bank' }, { glCode: '1010101' }, { accountName: { contains: 'Bank', mode: 'insensitive' } }]
      }
    });

    if (!bankAccount1) {
      bankAccount1 = await prisma.account.create({
        data: {
          accountName: 'Main Test Bank Account',
          glCode: '1010101',
          code: '1010101',
          accountTypeId: bankAssetType?.id || 'asset-type-id',
          detailType: 'Bank',
          accountLevel: 'GL',
          currentBalance: 10000000,
          initialBalance: 10000000,
        }
      });
    } else {
      await prisma.account.update({
        where: { id: bankAccount1.id },
        data: { initialBalance: 10000000, currentBalance: 10000000 }
      });
    }

    bankAccount2 = await prisma.account.findFirst({
      where: {
        id: { not: bankAccount1.id },
        isDeleted: false,
        isLocked: false,
        OR: [{ detailType: 'Bank' }, { glCode: '1010102' }, { accountName: { contains: 'Bank', mode: 'insensitive' } }]
      }
    });

    if (!bankAccount2) {
      bankAccount2 = await prisma.account.create({
        data: {
          accountName: 'Secondary Test Bank Account',
          glCode: '1010102',
          code: '1010102',
          accountTypeId: bankAssetType?.id || 'asset-type-id',
          detailType: 'Bank',
          accountLevel: 'GL',
          currentBalance: 5000000,
          initialBalance: 5000000,
        }
      });
    } else {
      await prisma.account.update({
        where: { id: bankAccount2.id },
        data: { initialBalance: 5000000, currentBalance: 5000000 }
      });
    }

    // Ensure Expense accounts exist for Donation and Zakat
    const expenseType = await prisma.accountType.findFirst({
      where: { name: { in: ['Expense', 'Expenses'], mode: 'insensitive' } }
    });

    const donationExp = await prisma.account.findFirst({
      where: { OR: [{ glCode: '4060101' }, { accountName: { contains: 'Donation', mode: 'insensitive' } }] }
    });
    if (!donationExp && expenseType) {
      await prisma.account.create({
        data: {
          accountName: 'Monthly Donations Expense',
          glCode: '4060101',
          code: '4060101',
          accountTypeId: expenseType.id,
          accountLevel: 'GL',
          currentBalance: 0,
        }
      });
    }

    // Clean up any test records for test months before running
    const priorTestRecords = await prisma.donation.findMany({
      where: {
        disbursementMonth: { in: ['2026-09', '2026-10'] }
      }
    });
    for (const r of priorTestRecords) {
      if (r.journalEntryId) {
        try {
          await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: r.journalEntryId } });
          await prisma.journalEntry.delete({ where: { id: r.journalEntryId } });
        } catch {}
      }
    }
    await prisma.donation.deleteMany({
      where: {
        disbursementMonth: { in: ['2026-09', '2026-10'] }
      }
    });
  }, 30000);

  afterAll(async () => {
    // Cleanup created test records and journal entries
    if (createdDonationIds.length > 0) {
      const records = await prisma.donation.findMany({
        where: { id: { in: createdDonationIds } }
      });
      for (const r of records) {
        if (r.journalEntryId) {
          try {
            await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: r.journalEntryId } });
            await prisma.journalEntry.delete({ where: { id: r.journalEntryId } });
          } catch {}
        }
      }
      await prisma.donation.deleteMany({
        where: { id: { in: createdDonationIds } }
      });
    }
  }, 30000);

  it('1. should post a monthly donation from bank account and create single GL entry', async () => {
    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        month: 'September 2026',
        disbursementMonth: '2026-09',
        donationType: 'DONATION',
        amount: 100000,
        paymentMethod: 'BANK',
        bankAccountId: bankAccount1.id,
        remarks: 'September 2026 Monthly Welfare Batch'
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.disbursementMonth).toBe('2026-09');
    expect(res.body.data.bankAccountId).toBe(bankAccount1.id);
    expect(res.body.data.journalEntryId).toBeTruthy();

    createdDonationIds.push(res.body.data.id);

    // Verify GL Journal Entry
    const je = await prisma.journalEntry.findUnique({
      where: { id: res.body.data.journalEntryId },
      include: { lines: true }
    });
    expect(je).toBeTruthy();
    expect(je?.lines.length).toBe(2);

    const creditLine = je?.lines.find(l => l.accountId === bankAccount1.id);
    expect(creditLine).toBeTruthy();
    expect(Number(creditLine?.credit)).toBe(100000);
    expect(Number(creditLine?.debit)).toBe(0);
  }, 30000);

  it('2. should reject duplicate monthly donation posting for same month, category, and bank account with 409', async () => {
    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        month: 'September 2026',
        disbursementMonth: '2026-09',
        donationType: 'DONATION',
        amount: 50000,
        paymentMethod: 'BANK',
        bankAccountId: bankAccount1.id,
        remarks: 'Trying duplicate donation in September 2026'
      });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('September 2026');
    expect(res.body.error.message).toContain('already been posted');
  }, 30000);

  it('3. should check duplicate via GET action=check-duplicate endpoint', async () => {
    const res = await request(app)
      .get('/api/v1/donations')
      .query({
        action: 'check-duplicate',
        disbursementMonth: '2026-09',
        donationType: 'DONATION',
        bankAccountId: bankAccount1.id
      })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.isDuplicate).toBe(true);
    expect(res.body.message).toContain('already been posted');
  }, 30000);

  it('4. should allow separate ZAKAT disbursement in September 2026 from the same bank account', async () => {
    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        month: 'September 2026',
        disbursementMonth: '2026-09',
        donationType: 'ZAKAT',
        amount: 50000,
        paymentMethod: 'BANK',
        bankAccountId: bankAccount1.id,
        remarks: 'September 2026 Zakat Distribution'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.donationType).toBe('ZAKAT');
    expect(res.body.data.disbursementMonth).toBe('2026-09');
    expect(res.body.data.status).toBe('APPROVED');

    createdDonationIds.push(res.body.data.id);
  }, 30000);

  it('5. should allow posting September 2026 donation from a DIFFERENT bank account', async () => {
    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        month: 'September 2026',
        disbursementMonth: '2026-09',
        donationType: 'DONATION',
        amount: 75000,
        paymentMethod: 'BANK',
        bankAccountId: bankAccount2.id,
        remarks: 'September 2026 from Bank Account 2'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.bankAccountId).toBe(bankAccount2.id);
    expect(res.body.data.status).toBe('APPROVED');

    createdDonationIds.push(res.body.data.id);
  }, 30000);

  it('6. should allow posting NEXT month (October 2026) donation from the same bank account', async () => {
    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        month: 'October 2026',
        disbursementMonth: '2026-10',
        donationType: 'DONATION',
        amount: 100000,
        paymentMethod: 'BANK',
        bankAccountId: bankAccount1.id,
        remarks: 'October 2026 Monthly Donation'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.disbursementMonth).toBe('2026-10');
    expect(res.body.data.status).toBe('APPROVED');

    createdDonationIds.push(res.body.data.id);
  }, 30000);

  it('7. should post a multi-beneficiary batch disbursement deducting bank account ONCE for total', async () => {
    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        month: 'October 2026',
        disbursementMonth: '2026-10',
        donationType: 'ZAKAT',
        amount: 100000,
        paymentMethod: 'BANK',
        bankAccountId: bankAccount1.id,
        beneficiaries: [
          { name: 'Person A', amount: 30000, cnic: '42101-1111111-1', remarks: 'Ration' },
          { name: 'Person B', amount: 25000, cnic: '42101-2222222-2', remarks: 'Medical' },
          { name: 'Person C', amount: 45000, cnic: '42101-3333333-3', remarks: 'Education' }
        ],
        remarks: 'Multi-beneficiary Zakat Batch'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(100000);
    expect(Array.isArray(res.body.data.beneficiaries)).toBe(true);
    expect(res.body.data.beneficiaries.length).toBe(3);

    createdDonationIds.push(res.body.data.id);

    // Verify single journal entry crediting bank once for 100,000
    const je = await prisma.journalEntry.findUnique({
      where: { id: res.body.data.journalEntryId },
      include: { lines: true }
    });
    expect(je?.lines.length).toBe(2);
    const bankLine = je?.lines.find(l => l.accountId === bankAccount1.id);
    expect(Number(bankLine?.credit)).toBe(100000);
  }, 30000);

  it('8. should return monthly donations & zakat metrics on dashboard stats API', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('monthlyDonations');
    expect(res.body.data).toHaveProperty('monthlyZakat');
    expect(res.body.data).toHaveProperty('currentMonthName');
    expect(res.body.data.summary).toHaveProperty('bankBalance');
  }, 60000);
});
