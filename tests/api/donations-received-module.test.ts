import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../api/index';
import { prisma } from '../../api/_prisma';
import { AccountingService } from '../../api/_services/accounting.service';

describe('Standalone Donations Module (Inflows, GL Posting & RBAC)', () => {
  let adminToken: string;
  let nonAdminToken: string;
  let adminUser: any;
  let testDonor: any;
  let bankAccount: any;
  let cashAccount: any;
  let createdDonationIds: string[] = [];
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_sign_key_123_abc';

  beforeAll(async () => {
    // 1. Get or create Admin user (isPrivileged = true)
    adminUser = await prisma.user.findFirst({
      where: { role: { name: { in: ['admin', 'super admin', 'administrator', 'Super Admin', 'Admin'] } } },
      include: { role: true }
    });
    if (!adminUser) {
      const superAdminRole = await prisma.role.findFirst({ where: { name: 'Super Admin' } });
      adminUser = await prisma.user.create({
        data: {
          fullName: 'Test Admin User',
          email: `testadmin_${Date.now()}@erp.com`,
          password: 'hashedpassword',
          roleId: superAdminRole!.id,
          isActive: true
        },
        include: { role: true }
      });
    }
    adminToken = jwt.sign({ sub: adminUser.id, email: adminUser.email, role: adminUser.role.name }, secret);

    // 2. Get or create Non-Admin Operator user (isPrivileged = false)
    let operatorUser = await prisma.user.findFirst({
      where: { role: { isPrivileged: false, name: { in: ['Operator', 'Manager', 'Viewer'] } } },
      include: { role: true }
    });
    if (!operatorUser) {
      const operatorRole = await prisma.role.findFirst({ where: { name: 'Operator' } });
      operatorUser = await prisma.user.create({
        data: {
          fullName: 'Test Operator User',
          email: `testoperator_${Date.now()}@erp.com`,
          password: 'hashedpassword',
          roleId: operatorRole!.id,
          isActive: true
        },
        include: { role: true }
      });
    }

    // Ensure CREATE_DONATION_RECEIVED permission is assigned to operatorUser's role
    const permCreate = await prisma.permission.findFirst({ where: { name: 'CREATE_DONATION_RECEIVED' } });
    if (permCreate && operatorUser) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: operatorUser.roleId,
            permissionId: permCreate.id
          }
        },
        create: {
          roleId: operatorUser.roleId,
          permissionId: permCreate.id
        },
        update: {}
      });
    }

    nonAdminToken = jwt.sign({ sub: operatorUser.id, email: operatorUser.email, role: operatorUser.role.name }, secret);

    // 3. Ensure Test Donor exists
    testDonor = await prisma.donor.findFirst({ where: { isDeleted: false } });
    if (!testDonor) {
      testDonor = await prisma.donor.create({
        data: {
          fullName: 'Haji Abdul Sattar',
          donorCode: `DNR-${Date.now()}`,
          mobile: '03001234567',
          isActive: true
        }
      });
    }

    // 4. Ensure Cash in Hand and Bank Account exist
    cashAccount = await AccountingService.ensureCashInHandAccount(prisma);

    bankAccount = await prisma.account.findFirst({
      where: {
        isDeleted: false,
        isLocked: false,
        OR: [{ detailType: 'Bank' }, { glCode: '1010101' }, { accountName: { contains: 'Bank', mode: 'insensitive' } }]
      }
    });

    if (!bankAccount) {
      const bankAssetType = await prisma.accountType.findFirst({ where: { name: { in: ['Asset', 'Assets'], mode: 'insensitive' } } });
      bankAccount = await prisma.account.create({
        data: {
          accountName: 'Main Test Bank Account',
          glCode: '1010101',
          code: '1010101',
          accountTypeId: bankAssetType!.id,
          detailType: 'Bank',
          accountLevel: 'GL',
          currentBalance: 500000,
          initialBalance: 500000
        }
      });
    }
  });

  afterAll(async () => {
    // Cleanup any created donations
    for (const id of createdDonationIds) {
      try {
        const item = await prisma.donationReceived.findUnique({ where: { id } });
        if (item) {
          if (item.journalEntryId) {
            await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: item.journalEntryId } }).catch(() => {});
            await prisma.journalEntry.delete({ where: { id: item.journalEntryId } }).catch(() => {});
          }
          await prisma.donationReceived.delete({ where: { id } }).catch(() => {});
        }
      } catch (e) {}
    }
  });

  it('GET /api/donations returns status 200 and stats', async () => {
    const res = await request(app)
      .get('/api/donations')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.stats).toBeDefined();
    expect(res.body.stats.totalAmount).toBeDefined();
  }, 25000);

  it('POST /api/donations creates Cash donation, debits Cash in Hand, credits General Donation with reference DONATION-REC-xxx', async () => {
    const amount = 7500;
    const res = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        donorId: testDonor.id,
        donationType: 'GENERAL_DONATION',
        amount,
        paymentMethod: 'CASH',
        donationDate: new Date().toISOString().split('T')[0],
        narration: 'Charity donation for welfare',
        status: 'POSTED'
      });

    expect(res.status).toBe(201);
    const donation = res.body.data;
    expect(donation).toBeDefined();
    expect(donation.id).toBeDefined();
    expect(donation.receiptNo).toMatch(/^REC-/);
    expect(Number(donation.amount)).toBe(amount);
    expect(donation.journalEntryId).toBeDefined();
    createdDonationIds.push(donation.id);

    // Verify GL Journal Entry
    const journal = await prisma.journalEntry.findUnique({
      where: { id: donation.journalEntryId },
      include: { lines: true }
    });

    expect(journal).toBeDefined();
    expect(journal?.reference).toBe(`DONATION-${donation.receiptNo}`);
    expect(journal?.lines.length).toBe(2);

    // Check Debit Cash in Hand
    const debitLine = journal?.lines.find(l => Number(l.debit) > 0);
    expect(debitLine).toBeDefined();
    expect(Number(debitLine?.debit)).toBe(amount);

    // Check Credit General Donation
    const creditLine = journal?.lines.find(l => Number(l.credit) > 0);
    expect(creditLine).toBeDefined();
    expect(Number(creditLine?.credit)).toBe(amount);
  }, 25000);

  it('POST /api/donations creates Bank donation, debits Selected Bank Account, credits General Donation', async () => {
    const amount = 15000;
    const res = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        donorId: testDonor.id,
        donationType: 'MONTHLY',
        amount,
        paymentMethod: 'BANK',
        bankAccountId: bankAccount.id,
        donationDate: new Date().toISOString().split('T')[0],
        referenceNumber: 'TRX-BANK-001',
        status: 'POSTED'
      });

    expect(res.status).toBe(201);
    const donation = res.body.data;
    expect(donation.journalEntryId).toBeDefined();
    createdDonationIds.push(donation.id);

    const journal = await prisma.journalEntry.findUnique({
      where: { id: donation.journalEntryId },
      include: { lines: true }
    });

    const debitLine = journal?.lines.find(l => l.accountId === bankAccount.id);
    expect(debitLine).toBeDefined();
    expect(Number(debitLine?.debit)).toBe(amount);
  }, 25000);

  it('POST /api/donations validates required fields and amount > 0', async () => {
    const res = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amount: -100
      });

    expect(res.status).toBe(400);
  }, 25000);

  it('RBAC: Non-privileged user can create donation, but PUT/DELETE is blocked with 403 Forbidden', async () => {
    // 1. Non-privileged user creates donation
    const resCreate = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${nonAdminToken}`)
      .send({
        donorId: testDonor.id,
        donationType: 'GENERAL_DONATION',
        amount: 2000,
        paymentMethod: 'CASH',
        donationDate: new Date().toISOString().split('T')[0],
        status: 'POSTED'
      });

    expect(resCreate.status).toBe(201);
    const donation = resCreate.body.data;
    createdDonationIds.push(donation.id);

    // 2. Non-privileged user attempts to EDIT (PUT) -> strictly rejected with 403
    const resEdit = await request(app)
      .put(`/api/donations/${donation.id}`)
      .set('Authorization', `Bearer ${nonAdminToken}`)
      .send({ amount: 3000 });

    expect(resEdit.status).toBe(403);

    // 3. Non-privileged user attempts to DELETE -> strictly rejected with 403
    const resDelete = await request(app)
      .delete(`/api/donations/${donation.id}`)
      .set('Authorization', `Bearer ${nonAdminToken}`);

    expect(resDelete.status).toBe(403);
  }, 25000);

  it('DELETE /api/donations/:id by Admin removes donation and reverses journal entry', async () => {
    // 1. Create a donation to delete
    const resCreate = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        donorId: testDonor.id,
        donationType: 'GENERAL_DONATION',
        amount: 4500,
        paymentMethod: 'CASH',
        donationDate: new Date().toISOString().split('T')[0],
        status: 'POSTED'
      });

    const donation = resCreate.body.data;
    const journalId = donation.journalEntryId;

    // 2. Admin deletes donation permanently
    const resDelete = await request(app)
      .delete(`/api/donations/${donation.id}?permanent=true`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resDelete.status).toBe(200);

    // 3. Verify donation record is deleted
    const checkDonation = await prisma.donationReceived.findUnique({ where: { id: donation.id } });
    expect(checkDonation).toBeNull();

    // 4. Verify Journal Entry is deleted or soft-deleted
    const checkJournal = await prisma.journalEntry.findUnique({ where: { id: journalId } });
    expect(checkJournal).toBeNull();
  }, 25000);
});
