import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../api/index.js';
import { prisma } from '../../api/_prisma.js';
import { PERMS } from '../../api/_constants/permissions.js';

describe('ERP RBAC Strict Privilege Enforcement Suite', () => {
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_sign_key_123_abc';

  let superAdminUser: any;
  let superAdminToken: string;

  let adminUser: any;
  let adminToken: string;

  let dataEntryUser: any;
  let dataEntryToken: string;

  let donationManagerUser: any;
  let donationManagerToken: string;

  let testMemberId: string;
  let testBeneficiaryId: string;

  beforeAll(async () => {
    // 1. Get or create Super Admin
    let superAdminRole = await prisma.role.findUnique({ where: { name: 'Super Admin' } });
    if (!superAdminRole) {
      superAdminRole = await prisma.role.create({
        data: { name: 'Super Admin', isPrivileged: true, description: 'Super Admin' }
      });
    } else if (!superAdminRole.isPrivileged) {
      superAdminRole = await prisma.role.update({
        where: { id: superAdminRole.id },
        data: { isPrivileged: true }
      });
    }

    superAdminUser = await prisma.user.create({
      data: {
        email: `superadmin_rbac_${Date.now()}@erp.com`,
        password: 'hashed_password',
        fullName: 'Super Admin RBAC',
        roleId: superAdminRole.id,
        isActive: true,
      }
    });
    superAdminToken = jwt.sign({ sub: superAdminUser.id, email: superAdminUser.email, role: superAdminRole.name }, secret);

    // 2. Get or create Admin
    let adminRole = await prisma.role.findUnique({ where: { name: 'Admin' } });
    if (!adminRole) {
      adminRole = await prisma.role.create({
        data: { name: 'Admin', isPrivileged: true, description: 'Admin' }
      });
    } else if (!adminRole.isPrivileged) {
      adminRole = await prisma.role.update({
        where: { id: adminRole.id },
        data: { isPrivileged: true }
      });
    }

    adminUser = await prisma.user.create({
      data: {
        email: `admin_rbac_${Date.now()}@erp.com`,
        password: 'hashed_password',
        fullName: 'Admin RBAC',
        roleId: adminRole.id,
        isActive: true,
      }
    });
    adminToken = jwt.sign({ sub: adminUser.id, email: adminUser.email, role: adminRole.name }, secret);

    // 3. Get or create Data Entry Operator (restricted role)
    let dataEntryRole = await prisma.role.findUnique({ where: { name: 'Data Entry Operator' } });
    if (!dataEntryRole) {
      dataEntryRole = await prisma.role.create({
        data: { name: 'Data Entry Operator', isPrivileged: false, description: 'Data Entry' }
      });
    }
    // Ensure permissions for member / beneficiary
    const permsToAdd = ['VIEW_MEMBERS', 'CREATE_MEMBER', 'VIEW_BENEFICIARIES', 'CREATE_BENEFICIARY', 'VIEW_DONATIONS', 'CREATE_DONATION'];
    for (const pName of permsToAdd) {
      const p = await prisma.permission.upsert({
        where: { name: pName },
        update: {},
        create: { name: pName, description: pName }
      });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: dataEntryRole.id, permissionId: p.id } },
        update: {},
        create: { roleId: dataEntryRole.id, permissionId: p.id }
      });
    }

    dataEntryUser = await prisma.user.create({
      data: {
        email: `dataentry_rbac_${Date.now()}@erp.com`,
        password: 'hashed_password',
        fullName: 'Data Entry Operator RBAC',
        roleId: dataEntryRole.id,
        isActive: true,
      }
    });
    dataEntryToken = jwt.sign({ sub: dataEntryUser.id, email: dataEntryUser.email, role: dataEntryRole.name }, secret);

    // 4. Get or create Donation and Zakat Manager (restricted role)
    let donRole = await prisma.role.findUnique({ where: { name: 'Donation and Zakat Manager' } });
    if (!donRole) {
      donRole = await prisma.role.create({
        data: { name: 'Donation and Zakat Manager', isPrivileged: false, description: 'Donation Manager' }
      });
    }
    for (const pName of ['VIEW_DONATIONS', 'CREATE_DONATION', 'VIEW_BENEFICIARIES', 'CREATE_BENEFICIARY', 'VIEW_REPORTS']) {
      const p = await prisma.permission.upsert({
        where: { name: pName },
        update: {},
        create: { name: pName, description: pName }
      });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: donRole.id, permissionId: p.id } },
        update: {},
        create: { roleId: donRole.id, permissionId: p.id }
      });
    }
    donationManagerUser = await prisma.user.create({
      data: {
        email: `donmgr_rbac_${Date.now()}@erp.com`,
        password: 'hashed_password',
        fullName: 'Donation Manager RBAC',
        roleId: donRole.id,
        isActive: true,
      }
    });
    donationManagerToken = jwt.sign({ sub: donationManagerUser.id, email: donationManagerUser.email, role: donRole.name }, secret);
  }, 60000);

  afterAll(async () => {
    // Cleanup created test records
    if (testMemberId) {
      await prisma.member.delete({ where: { id: testMemberId } }).catch(() => {});
    }
    if (testBeneficiaryId) {
      await prisma.beneficiary.delete({ where: { id: testBeneficiaryId } }).catch(() => {});
    }
    if (dataEntryUser) {
      await prisma.user.delete({ where: { id: dataEntryUser.id } }).catch(() => {});
    }
    if (donationManagerUser) {
      await prisma.user.delete({ where: { id: donationManagerUser.id } }).catch(() => {});
    }
    if (superAdminUser) {
      await prisma.user.delete({ where: { id: superAdminUser.id } }).catch(() => {});
    }
    if (adminUser) {
      await prisma.user.delete({ where: { id: adminUser.id } }).catch(() => {});
    }
  }, 60000);

  describe('1. /api/v1/auth/me Endpoint isPrivileged Flag', () => {
    it('returns isPrivileged: true for Super Admin', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isPrivileged).toBe(true);
    });

    it('returns isPrivileged: true for Admin', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isPrivileged).toBe(true);
    });

    it('returns isPrivileged: false for Data Entry Operator', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${dataEntryToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isPrivileged).toBe(false);
    });

    it('returns isPrivileged: false for Donation and Zakat Manager', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${donationManagerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isPrivileged).toBe(false);
    });
  });

  describe('2. Non-Admin Role: View & Add capability (Members)', () => {
    it('Data Entry Operator CAN view members (GET /api/v1/members)', async () => {
      const res = await request(app)
        .get('/api/v1/members')
        .set('Authorization', `Bearer ${dataEntryToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('Data Entry Operator CAN create a new member (POST /api/v1/members)', async () => {
      const res = await request(app)
        .post('/api/v1/members')
        .set('Authorization', `Bearer ${dataEntryToken}`)
        .send({
          fullName: 'RBAC Test Member',
          fatherName: 'Father Name',
          mobile: '03001234567',
          city: 'Karachi',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.data).toBeDefined();
      testMemberId = res.body.data.id;
    });

    it('Data Entry Operator CANNOT edit a member (PUT /api/v1/members/:id) -> 403', async () => {
      expect(testMemberId).toBeDefined();
      const res = await request(app)
        .put(`/api/v1/members?id=${testMemberId}`)
        .set('Authorization', `Bearer ${dataEntryToken}`)
        .send({
          fullName: 'Hacked Member Name',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('RESTRICTED_ROLE');
    });

    it('Data Entry Operator CANNOT delete a member (DELETE /api/v1/members/:id) -> 403', async () => {
      expect(testMemberId).toBeDefined();
      const res = await request(app)
        .delete(`/api/v1/members?id=${testMemberId}`)
        .set('Authorization', `Bearer ${dataEntryToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('RESTRICTED_ROLE');
    });
  });

  describe('3. Non-Admin Role: View & Add capability (Beneficiaries & Welfare)', () => {
    it('Data Entry Operator CAN create a beneficiary (POST /api/v1/beneficiaries)', async () => {
      const res = await request(app)
        .post('/api/v1/beneficiaries')
        .set('Authorization', `Bearer ${dataEntryToken}`)
        .send({
          name: 'RBAC Beneficiary Test',
          fatherName: 'Test Father',
          mobile: '03009998877',
          monthlyIncome: 15000,
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.data).toBeDefined();
      testBeneficiaryId = res.body.data.id;
    });

    it('Data Entry Operator CANNOT edit beneficiary (PUT /api/v1/beneficiaries) -> 403', async () => {
      expect(testBeneficiaryId).toBeDefined();
      const res = await request(app)
        .put(`/api/v1/beneficiaries?id=${testBeneficiaryId}`)
        .set('Authorization', `Bearer ${dataEntryToken}`)
        .send({
          name: 'Updated Beneficiary Name',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('RESTRICTED_ROLE');
    });

    it('Data Entry Operator CANNOT delete beneficiary (DELETE /api/v1/beneficiaries) -> 403', async () => {
      expect(testBeneficiaryId).toBeDefined();
      const res = await request(app)
        .delete(`/api/v1/beneficiaries?id=${testBeneficiaryId}`)
        .set('Authorization', `Bearer ${dataEntryToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('RESTRICTED_ROLE');
    });
  });

  describe('4. Privileged Roles (Admin & Super Admin): Full CRUD Capability', () => {
    it('Admin CAN update a member (PUT /api/v1/members/:id)', async () => {
      expect(testMemberId).toBeDefined();
      const res = await request(app)
        .put(`/api/v1/members?id=${testMemberId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'Admin Updated Member Name',
          mobile: '03001234567',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.fullName).toBe('Admin Updated Member Name');
    });

    it('Admin CAN update a beneficiary (PUT /api/v1/beneficiaries/:id)', async () => {
      expect(testBeneficiaryId).toBeDefined();
      const res = await request(app)
        .put(`/api/v1/beneficiaries?id=${testBeneficiaryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Updated Beneficiary',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Admin Updated Beneficiary');
    });

    it('Admin CAN delete a member (DELETE /api/v1/members/:id)', async () => {
      expect(testMemberId).toBeDefined();
      const res = await request(app)
        .delete(`/api/v1/members?id=${testMemberId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });
});
