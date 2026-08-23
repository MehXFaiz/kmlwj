import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../api/index.js';
import { prisma } from '../../api/_prisma.js';
import { PERMS } from '../../api/_constants/permissions.js';

describe('Global Post to Ledger Permission & Workflow Test Suite', () => {
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_sign_key_123_abc';

  let customPosterRole: any;
  let customPosterUser: any;
  let customPosterToken: string;

  let viewerRole: any;
  let viewerUser: any;
  let viewerToken: string;

  let testIncomeCategory: any;
  let testIncomeRecord: any;

  beforeAll(async () => {
    // 1. Ensure ledger.post permission exists in DB
    const postLedgerPerm = await prisma.permission.upsert({
      where: { name: PERMS.POST_LEDGER },
      update: {},
      create: {
        name: PERMS.POST_LEDGER,
        description: 'Post transactions to General Ledger'
      }
    });

    const viewIncomePerm = await prisma.permission.upsert({
      where: { name: PERMS.RECORD_INCOME },
      update: {},
      create: {
        name: PERMS.RECORD_INCOME,
        description: 'Record income'
      }
    });

    // 2. Create a custom non-privileged role WITH ledger.post (e.g. Donation & Zakat Manager / Custom Operator)
    customPosterRole = await prisma.role.create({
      data: {
        name: `Custom Post Role ${Date.now()}`,
        description: 'Role with Post to Ledger permission enabled',
        isPrivileged: false
      }
    });

    await prisma.rolePermission.createMany({
      data: [
        { roleId: customPosterRole.id, permissionId: postLedgerPerm.id },
        { roleId: customPosterRole.id, permissionId: viewIncomePerm.id }
      ]
    });

    customPosterUser = await prisma.user.create({
      data: {
        email: `poster_user_${Date.now()}@erp.com`,
        password: 'hashed_password',
        fullName: 'Operational Poster User',
        roleId: customPosterRole.id,
        isActive: true
      }
    });
    customPosterToken = jwt.sign(
      { sub: customPosterUser.id, email: customPosterUser.email, role: customPosterRole.name },
      secret
    );

    // 3. Create a viewer role WITHOUT�ledger.post
    viewerRole = await prisma.role.create({
      data: {
        name: `Restricted Viewer ${Date.now()}`,
        description: 'Viewer role without ledger.post permission',
        isPrivileged: false
      }
    });

    await prisma.rolePermission.create({
      data: { roleId: viewerRole.id, permissionId: viewIncomePerm.id }
    });

    viewerUser = await prisma.user.create({
      data: {
        email: `viewer_user_${Date.now()}@erp.com`,
        password: 'hashed_password',
        fullName: 'Restricted Viewer User',
        roleId: viewerRole.id,
        isActive: true
      }
    });
    viewerToken = jwt.sign(
      { sub: viewerUser.id, email: viewerUser.email, role: viewerRole.name },
      secret
    );

    // 4. Ensure an income category exists
    testIncomeCategory = await prisma.incomeCategory.findFirst();
    if (!testIncomeCategory) {
      testIncomeCategory = await prisma.incomeCategory.create({
        data: {
          name: `Test Category ${Date.now()}`,
          isSystem: false
        }
      });
    }

    // 5. Create a test income record
    testIncomeRecord = await prisma.addIncomeRecord.create({
      data: {
        categoryId: testIncomeCategory.id,
        amount: 2500,
        paymentMethod: 'CASH',
        status: 'PENDING',
        createdById: customPosterUser.id
      }
    });
  }, 30000);

  afterAll(async () => {
    // Cleanup created test records
    if (testIncomeRecord) {
      await prisma.addIncomeRecord.delete({ where: { id: testIncomeRecord.id } }).catch(() => {});
    }
    if (customPosterUser) {
      await prisma.user.delete({ where: { id: customPosterUser.id } }).catch(() => {});
    }
    if (viewerUser) {
      await prisma.user.delete({ where: { id: viewerUser.id } }).catch(() => {});
    }
    if (customPosterRole) {
      await prisma.rolePermission.deleteMany({ where: { roleId: customPosterRole.id } }).catch(() => {});
      await prisma.role.delete({ where: { id: customPosterRole.id } }).catch(() => {});
    }
    if (viewerRole) {
      await prisma.rolePermission.deleteMany({ where: { roleId: viewerRole.id } }).catch(() => {});
      await prisma.role.delete({ where: { id: viewerRole.id } }).catch(() => {});
    }
  });


  describe('Authentication & Authorization Enforcements', () => {
    it('should return 401 Unauthorized when posting to ledger without authentication token', async () => {
      const res = await request(app)
        .post('/api/v1/ledger-post')
        .send({
          module: 'Add Income',
          recordId: testIncomeRecord.id
        });

      expect(res.status).toBe(401);
    });

    it('should return 403 Forbidden (not 401) when user does not have ledger.post permission', async () => {
      const res = await request(app)
        .post('/api/v1/ledger-post')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          module: 'Add Income',
          recordId: testIncomeRecord.id
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();
    });

    it('should allow any non-admin role with ledger.post permission to successfully post to ledger', async () => {
      const res = await request(app)
        .post('/api/v1/ledger-post')
        .set('Authorization', `Bearer ${customPosterToken}`)
        .send({
          module: 'Add Income',
          recordId: testIncomeRecord.id
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('POSTED');
      expect(res.body.data.journalEntryId).toBeDefined();

      // Check DB record
      const dbRec = await prisma.addIncomeRecord.findUnique({
        where: { id: testIncomeRecord.id }
      });
      expect(dbRec?.status).toBe('POSTED');
    }, 20000);

    it('should return 409 Conflict when attempting to post an already posted transaction (duplicate prevention)', async () => {
      const res = await request(app)
        .post('/api/v1/ledger-post')
        .set('Authorization', `Bearer ${customPosterToken}`)
        .send({
          module: 'Add Income',
          recordId: testIncomeRecord.id
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/already.*posted/i);
    }, 20000);

    it('should create an audit trail record with action POST_TO_LEDGER', async () => {
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'POST_TO_LEDGER',
          module: 'Add Income',
          userId: customPosterUser.id
        },
        orderBy: { createdAt: 'desc' }
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.action).toBe('POST_TO_LEDGER');
    }, 20000);
  });
});
