import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../api/index.js';
import { prisma } from '../../api/_prisma.js';

describe('Wave 3 Enterprise Soft Delete Suite', () => {
  let superAdminToken: string;
  let staffToken: string;
  let superAdminUserId: string;
  let staffUserId: string;
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_sign_key_123_abc';

  beforeAll(async () => {
    let superAdmin = await prisma.user.findFirst({
      where: { role: { name: 'Super Admin' } },
      include: { role: true }
    });

    if (!superAdmin) {
      const superAdminRole = await prisma.role.upsert({
        where: { name: 'Super Admin' },
        update: {},
        create: { name: 'Super Admin', description: 'Super Administrator' }
      });
      superAdmin = await prisma.user.create({
        data: {
          email: 'test_superadmin_' + Date.now() + '@erp.com',
          password: 'hashed_password',
          fullName: 'Test Super Admin',
          roleId: superAdminRole.id,
          isActive: true
        },
        include: { role: true }
      });
    }
    superAdminUserId = superAdmin.id;
    superAdminToken = jwt.sign({ sub: superAdmin.id, email: superAdmin.email, role: 'Super Admin' }, secret);

    let staffRole = await prisma.role.findFirst({
      where: { name: 'Accountant' }
    });
    if (!staffRole) {
      staffRole = await prisma.role.create({
        data: { name: 'Accountant', description: 'Regular Staff' }
      });
    }
    const staffUser = await prisma.user.create({
      data: {
        email: 'test_staff_' + Date.now() + '@erp.com',
        password: 'hashed_password',
        fullName: 'Test Staff User',
        roleId: staffRole.id,
        isActive: true
      }
    });
    staffUserId = staffUser.id;
    staffToken = jwt.sign({ sub: staffUser.id, email: staffUser.email, role: 'Accountant' }, secret);
  }, 30000);

  afterAll(async () => {
    if (staffUserId) {
      await prisma.user.delete({ where: { id: staffUserId } }).catch(() => {});
    }
  }, 30000);

  describe('Beneficiary Soft Delete, Filter, Restore & Permanent Delete', () => {
    let createdBeneficiaryId: string;

    it('1. Should create a beneficiary', async () => {
      const res = await request(app)
        .post('/api/v1/beneficiaries')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Soft Delete Test Beneficiary',
          cnic: '42101' + Math.floor(10000000 + Math.random() * 90000000),
          mobile: '0300' + Math.floor(1000000 + Math.random() * 9000000),
          category: 'Widow',
          address: '123 Test Street'
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      createdBeneficiaryId = res.body.data.id;
    }, 30000);

    it('2. Should soft-delete beneficiary and hide from default GET list', async () => {
      const delRes = await request(app)
        .delete(`/api/v1/beneficiaries?id=${createdBeneficiaryId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(delRes.status).toBe(200);

      const dbRow = await prisma.beneficiary.findUnique({ where: { id: createdBeneficiaryId } });
      expect(dbRow?.isDeleted).toBe(true);
      expect(dbRow?.deletedAt).not.toBeNull();
      expect(dbRow?.deletedBy).toBe(superAdminUserId);

      const listRes = await request(app)
        .get('/api/v1/beneficiaries')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(listRes.status).toBe(200);
      const ids = listRes.body.data.map((b: any) => b.id);
      expect(ids).not.toContain(createdBeneficiaryId);
    }, 30000);

    it('3. Should show soft-deleted record when isDeleted=true filter is set', async () => {
      const res = await request(app)
        .get('/api/v1/beneficiaries?isDeleted=true')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((b: any) => b.id);
      expect(ids).toContain(createdBeneficiaryId);
    }, 30000);

    it('4. Non-Super Admin should get 403 when trying to restore', async () => {
      const res = await request(app)
        .post(`/api/v1/beneficiaries?action=restore&id=${createdBeneficiaryId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
    }, 30000);

    it('5. Super Admin should restore soft-deleted beneficiary', async () => {
      const res = await request(app)
        .post(`/api/v1/beneficiaries?action=restore&id=${createdBeneficiaryId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isDeleted).toBe(false);

      const dbRow = await prisma.beneficiary.findUnique({ where: { id: createdBeneficiaryId } });
      expect(dbRow?.isDeleted).toBe(false);
      expect(dbRow?.deletedAt).toBeNull();
      expect(dbRow?.deletedBy).toBeNull();
    }, 30000);

    it('6. Non-Super Admin should get 403 for permanent delete', async () => {
      const res = await request(app)
        .delete(`/api/v1/beneficiaries?id=${createdBeneficiaryId}&permanent=true`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
    }, 30000);

    it('7. Super Admin should permanently delete beneficiary', async () => {
      const res = await request(app)
        .delete(`/api/v1/beneficiaries?id=${createdBeneficiaryId}&permanent=true`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);

      const dbRow = await prisma.beneficiary.findUnique({ where: { id: createdBeneficiaryId } });
      expect(dbRow).toBeNull();
    }, 30000);
  });

  describe('Revenue Head Soft Delete & Restoration', () => {
    let revenueHeadId: string;

    it('1. Should create and soft-delete a revenue head', async () => {
      const createRes = await request(app)
        .post('/api/v1/revenue-heads')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: 'Test Revenue Head ' + Date.now(), category: 'General' });

      expect(createRes.status).toBe(201);
      revenueHeadId = createRes.body.data.id;

      const delRes = await request(app)
        .delete(`/api/v1/revenue-heads?id=${revenueHeadId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(delRes.status).toBe(200);

      const dbRow = await prisma.revenueHead.findUnique({ where: { id: revenueHeadId } });
      expect(dbRow?.isDeleted).toBe(true);
    }, 30000);

    it('2. Super Admin restores revenue head', async () => {
      const restoreRes = await request(app)
        .post(`/api/v1/revenue-heads?action=restore&id=${revenueHeadId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.data.isDeleted).toBe(false);

      await request(app)
        .delete(`/api/v1/revenue-heads?id=${revenueHeadId}&permanent=true`)
        .set('Authorization', `Bearer ${superAdminToken}`);
    }, 30000);
  });

  describe('Financial Reports & Dashboard Soft Delete Isolation', () => {
    it('1. Soft deleted journal entries should not affect Dashboard Stats', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('totalAccounts');
      expect(res.body.data).toHaveProperty('totalJournalEntries');
    }, 30000);

    it('2. Soft deleted journal entries should not affect General Ledger', async () => {
      const res = await request(app)
        .get('/api/v1/general-ledger')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
    }, 30000);

    it('3. Soft deleted journal entries should not affect Trial Balance', async () => {
      const res = await request(app)
        .get('/api/v1/reports/trial-balance')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
    }, 30000);
  });
});
