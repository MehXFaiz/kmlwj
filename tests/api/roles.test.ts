import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../api/index.js';
import { prisma } from '../../api/_prisma.js';

describe('Role Management API & Deletion Safety Suite', () => {
  let superAdminToken: string;
  let unauthorizedToken: string;
  let superAdminRole: any;
  let testCustomRole: any;
  let roleWithUsers: any;
  let assignedUser: any;
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_sign_key_123_abc';

  beforeAll(async () => {
    // 1. Get or create Super Admin role & user
    superAdminRole = await prisma.role.findUnique({
      where: { name: 'Super Admin' }
    });
    if (!superAdminRole) {
      superAdminRole = await prisma.role.create({
        data: { name: 'Super Admin', description: 'Root Super Admin' }
      });
    }

    let superAdminUser = await prisma.user.findFirst({
      where: { roleId: superAdminRole.id }
    });
    if (!superAdminUser) {
      superAdminUser = await prisma.user.create({
        data: {
          email: `superadmin_test_${Date.now()}@erp.com`,
          password: 'hashed_password',
          fullName: 'Test Super Admin',
          roleId: superAdminRole.id,
          isActive: true
        }
      });
    }

    superAdminToken = jwt.sign(
      { sub: superAdminUser.id, email: superAdminUser.email, role: 'Super Admin' },
      secret
    );

    // 2. Create unauthorized user (Viewer role without MANAGE_ROLES)
    let viewerRole = await prisma.role.findFirst({ where: { name: 'Viewer' } });
    if (!viewerRole) {
      viewerRole = await prisma.role.create({
        data: { name: 'Viewer', description: 'Read only' }
      });
    }
    const unauthorizedUser = await prisma.user.create({
      data: {
        email: `unauth_user_${Date.now()}@erp.com`,
        password: 'hashed_password',
        fullName: 'Unauthorized User',
        roleId: viewerRole.id,
        isActive: true
      }
    });
    unauthorizedToken = jwt.sign(
      { sub: unauthorizedUser.id, email: unauthorizedUser.email, role: 'Viewer' },
      secret
    );

    // 3. Create a custom role to test deletion
    testCustomRole = await prisma.role.create({
      data: {
        name: `Custom Test Role ${Date.now()}`,
        description: 'Temporary custom role for deletion testing'
      }
    });

    // Add permissions to this custom role
    const perm = await prisma.permission.upsert({
      where: { name: 'VIEW_REPORTS' },
      update: {},
      create: { name: 'VIEW_REPORTS', description: 'View reports' }
    });
    await prisma.rolePermission.create({
      data: {
        roleId: testCustomRole.id,
        permissionId: perm.id
      }
    });

    // 4. Create a role with assigned users
    roleWithUsers = await prisma.role.create({
      data: {
        name: `Role With Users ${Date.now()}`,
        description: 'Role with active assigned users'
      }
    });
    assignedUser = await prisma.user.create({
      data: {
        email: `assigned_user_${Date.now()}@erp.com`,
        password: 'hashed_password',
        fullName: 'Assigned User',
        roleId: roleWithUsers.id,
        isActive: true
      }
    });
  }, 30000);

  afterAll(async () => {
    // Cleanup any lingering test records
    if (assignedUser) {
      await prisma.user.delete({ where: { id: assignedUser.id } }).catch(() => {});
    }
    if (roleWithUsers) {
      await prisma.rolePermission.deleteMany({ where: { roleId: roleWithUsers.id } }).catch(() => {});
      await prisma.role.delete({ where: { id: roleWithUsers.id } }).catch(() => {});
    }
    if (testCustomRole) {
      await prisma.rolePermission.deleteMany({ where: { roleId: testCustomRole.id } }).catch(() => {});
      await prisma.role.delete({ where: { id: testCustomRole.id } }).catch(() => {});
    }
  });

  // CASE 1: Delete normal unused custom role with permissions
  it('CASE 1: Successfully deletes an unused custom role and cascades permissions (200 OK)', async () => {
    const res = await request(app)
      .delete(`/api/v1/roles?id=${testCustomRole.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success || res.body.status === 200).toBeTruthy();

    // Verify role is deleted from database
    const dbRole = await prisma.role.findUnique({
      where: { id: testCustomRole.id }
    });
    expect(dbRole).toBeNull();

    // Verify role permissions are cleaned up
    const dbRolePerms = await prisma.rolePermission.findMany({
      where: { roleId: testCustomRole.id }
    });
    expect(dbRolePerms.length).toBe(0);
  });

  // CASE 2: Delete role assigned to users -> 409 Conflict
  it('CASE 2: Rejects deleting a role assigned to users with 409 Conflict', async () => {
    const res = await request(app)
      .delete(`/api/v1/roles?id=${roleWithUsers.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error?.message || res.body.message).toMatch(/assigned to.*user/i);

    // Verify role still exists
    const dbRole = await prisma.role.findUnique({
      where: { id: roleWithUsers.id }
    });
    expect(dbRole).not.toBeNull();
  });

  // CASE 3: Delete Super Admin if protected -> 403 Forbidden
  it('CASE 3: Blocks deleting Super Admin with 403 Forbidden and clear message', async () => {
    const res = await request(app)
      .delete(`/api/v1/roles?id=${superAdminRole.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error?.message || res.body.message).toMatch(/Super Admin is a protected system role and cannot be deleted/i);

    // Verify Super Admin still exists in database
    const dbRole = await prisma.role.findUnique({
      where: { id: superAdminRole.id }
    });
    expect(dbRole).not.toBeNull();
  });

  // CASE 4: Delete non-existing role -> 404 Not Found
  it('CASE 4: Returns 404 for non-existent role ID', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .delete(`/api/v1/roles?id=${fakeUuid}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error?.message || res.body.message).toMatch(/Role not found/i);
  });

  // CASE 5: Unauthorized user tries to delete role -> 403 Forbidden
  it('CASE 5: Returns 403 for unauthorized user lacking MANAGE_ROLES permission', async () => {
    const res = await request(app)
      .delete(`/api/v1/roles?id=${superAdminRole.id}`)
      .set('Authorization', `Bearer ${unauthorizedToken}`);

    expect(res.status).toBe(403);
  });

  // CASE 6: Unauthenticated user -> 401 Unauthorized
  it('CASE 6: Returns 401 for unauthenticated request without token', async () => {
    const res = await request(app)
      .delete(`/api/v1/roles?id=${superAdminRole.id}`);

    expect(res.status).toBe(401);
  });

  // Also verify route param syntax: DELETE /api/v1/roles/:id
  it('Route verification: Supports DELETE /api/v1/roles/:id path parameter syntax', async () => {
    const tempRole = await prisma.role.create({
      data: {
        name: `Path Param Role ${Date.now()}`,
        description: 'Test path param delete'
      }
    });

    const res = await request(app)
      .delete(`/api/v1/roles/${tempRole.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);

    const check = await prisma.role.findUnique({
      where: { id: tempRole.id }
    });
    expect(check).toBeNull();
  });
});
