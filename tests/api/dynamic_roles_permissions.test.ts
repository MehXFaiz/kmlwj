import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../api/index.js';
import { prisma } from '../../api/_prisma.js';

describe('Dynamic Roles & Granular Action-Level Permissions Suite', () => {
  let superAdminToken: string;
  let superAdminUser: any;
  let dynamicUser: any;
  let dynamicUserToken: string;
  let createdRoleId: string;
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_sign_key_123_abc';

  beforeAll(async () => {
    // 1. Get or create Super Admin role & user
    let superAdminRole = await prisma.role.findUnique({
      where: { name: 'Super Admin' },
    });
    if (!superAdminRole) {
      superAdminRole = await prisma.role.create({
        data: { name: 'Super Admin', description: 'Root Super Admin', isPrivileged: true },
      });
    }

    superAdminUser = await prisma.user.findFirst({
      where: { roleId: superAdminRole.id },
    });
    if (!superAdminUser) {
      superAdminUser = await prisma.user.create({
        data: {
          email: `superadmin_dynamic_${Date.now()}@erp.com`,
          password: 'hashed_password',
          fullName: 'Test Dynamic Super Admin',
          roleId: superAdminRole.id,
          isActive: true,
        },
      });
    }

    superAdminToken = jwt.sign(
      { sub: superAdminUser.id, email: superAdminUser.email, role: 'Super Admin' },
      secret
    );
  }, 35000);

  afterAll(async () => {
    if (dynamicUser) {
      await prisma.user.delete({ where: { id: dynamicUser.id } }).catch(() => {});
    }
    if (createdRoleId) {
      await prisma.rolePermission.deleteMany({ where: { roleId: createdRoleId } }).catch(() => {});
      await prisma.role.delete({ where: { id: createdRoleId } }).catch(() => {});
    }
  }, 35000);

  // TEST 1: Create dynamic custom role with module permissions
  it(
    '1. Successfully creates a dynamic role with granular module permissions',
    async () => {
      const rolePayload = {
        name: `Donation Specialist ${Date.now()}`,
        description: 'Specialist handling donations, collections and welfare aid',
        modulePermissions: {
          donations: {
            view: true,
            create: true,
            update: true,
            delete: false,
            post: true,
            approve: false,
            export: true,
            print: true,
          },
          beneficiaries: {
            view: true,
            create: true,
            update: true,
            delete: false,
            export: true,
            print: false,
          },
          reports: {
            view: true,
            export: false,
            print: false,
          },
        },
      };

      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(rolePayload);

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.name).toBe(rolePayload.name);
      expect(res.body.data.modulesCount).toBeGreaterThanOrEqual(3);
      expect(res.body.data.permissionsCount).toBeGreaterThanOrEqual(10);
      expect(res.body.data.modulePermissions.donations.post).toBe(true);
      expect(res.body.data.modulePermissions.donations.delete).toBe(false);

      createdRoleId = res.body.data.id;
    },
    35000
  );

  // TEST 2: GET /api/v1/roles includes rich metrics
  it(
    '2. GET /api/v1/roles returns modulePermissions, modulesCount, and permissionsCount',
    async () => {
      const res = await request(app)
        .get('/api/v1/roles')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      const targetRole = res.body.data.find((r: any) => r.id === createdRoleId);
      expect(targetRole).toBeDefined();
      expect(targetRole.modulesCount).toBeGreaterThanOrEqual(3);
      expect(targetRole.permissionsCount).toBeGreaterThanOrEqual(10);
      expect(targetRole.modulePermissions).toBeDefined();
      expect(targetRole.accessLevels).toBeDefined();
      expect(targetRole.accessLevels.reports).toBe('View Only');
    },
    35000
  );

  // TEST 3: PUT /api/v1/roles/:id updates permissions dynamically
  it(
    '3. PUT /api/v1/roles/:id overrides permissions and updates in DB',
    async () => {
      const updatePayload = {
        modulePermissions: {
          donations: {
            view: true,
            create: true,
            update: true,
            delete: true, // Now enable delete
            post: true,
            approve: true, // Now enable approve
            export: true,
            print: true,
          },
          reports: {
            view: true,
            export: true,
            print: true,
          },
        },
      };

      const res = await request(app)
        .put(`/api/v1/roles?id=${createdRoleId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.data.modulePermissions.donations.delete).toBe(true);
      expect(res.body.data.modulePermissions.donations.approve).toBe(true);
      expect(res.body.data.accessLevels.donations).toBe('Full Access');
    },
    35000
  );

  // TEST 4: Assign dynamic role to user and verify /api/v1/auth/me
  it(
    '4. User assigned to dynamic role receives active permissions in /api/v1/auth/me',
    async () => {
      dynamicUser = await prisma.user.create({
        data: {
          email: `specialist_user_${Date.now()}@erp.com`,
          password: 'hashed_password',
          fullName: 'Ali Donation Specialist',
          roleId: createdRoleId,
          isActive: true,
        },
      });

      dynamicUserToken = jwt.sign(
        { sub: dynamicUser.id, email: dynamicUser.email, role: 'Donation Specialist' },
        secret
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${dynamicUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(dynamicUser.id);
      expect(res.body.data.permissions).toBeDefined();
      expect(res.body.data.permissions).toContain('donations.view');
      expect(res.body.data.permissions).toContain('donations.create');
      expect(res.body.data.modulePermissions).toBeDefined();
      expect(res.body.data.modulePermissions.donations.view).toBe(true);
    },
    35000
  );
});
