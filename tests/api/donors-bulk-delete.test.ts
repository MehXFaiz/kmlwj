import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../api/index.js';
import { prisma } from '../../api/_prisma.js';

const ENDPOINT = '/api/v1/donors/bulk-delete';

describe('Donors Bulk Delete API', () => {
  let adminToken: string;
  let adminUserId: string;
  let managerToken: string;
  let managerUserId: string;
  let viewerToken: string;
  let viewerUserId: string;
  const createdDonorIds: string[] = [];
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_sign_key_123_abc';

  /** Creates a throwaway user attached to an existing seeded role. */
  async function makeUser(roleName: string) {
    const role = await prisma.role.findFirst({ where: { name: roleName } });
    if (!role) throw new Error(`Seeded role "${roleName}" not found — run prisma db seed first.`);
    return prisma.user.create({
      data: {
        email: `test_bulkdelete_${roleName.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}@erp.com`,
        password: 'hashed_password',
        fullName: `Test ${roleName}`,
        roleId: role.id,
        isActive: true,
      },
    });
  }

  async function makeDonors(count: number) {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const donor = await prisma.donor.create({
        data: {
          donorCode: `TST-${Date.now()}-${i}-${Math.floor(Math.random() * 10000)}`,
          fullName: `Bulk Delete Test Donor ${i}`,
          isActive: true,
        },
      });
      ids.push(donor.id);
      createdDonorIds.push(donor.id);
    }
    return ids;
  }

  beforeAll(async () => {
    const admin = await makeUser('Admin');
    adminUserId = admin.id;
    adminToken = jwt.sign({ sub: admin.id, email: admin.email, role: 'Admin' }, secret);

    // Manager holds MANAGE_DONORS but is below the Admin tier — the case the
    // module permission alone would wrongly let through.
    const manager = await makeUser('Manager');
    managerUserId = manager.id;
    managerToken = jwt.sign({ sub: manager.id, email: manager.email, role: 'Manager' }, secret);

    const viewer = await makeUser('Viewer');
    viewerUserId = viewer.id;
    viewerToken = jwt.sign({ sub: viewer.id, email: viewer.email, role: 'Viewer' }, secret);
  }, 30000);

  afterAll(async () => {
    await prisma.donor.deleteMany({ where: { id: { in: createdDonorIds } } }).catch(() => {});
    for (const id of [adminUserId, managerUserId, viewerUserId]) {
      if (id) await prisma.user.delete({ where: { id } }).catch(() => {});
    }
  }, 30000);

  describe('Authorization', () => {
    it('rejects an unauthenticated request with 401', async () => {
      const res = await request(app).delete(ENDPOINT).send({ ids: ['x'] });
      expect(res.status).toBe(401);
    }, 30000);

    it('rejects a role without MANAGE_DONORS with 403', async () => {
      const ids = await makeDonors(1);
      const res = await request(app)
        .delete(ENDPOINT)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ ids });

      expect(res.status).toBe(403);
      const row = await prisma.donor.findUnique({ where: { id: ids[0] } });
      expect(row?.isDeleted).toBe(false);
    }, 30000);

    it('rejects a Manager who holds MANAGE_DONORS but is not Admin with 403', async () => {
      const ids = await makeDonors(1);
      const res = await request(app)
        .delete(ENDPOINT)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ids });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/Admin or Super Admin/i);
      const row = await prisma.donor.findUnique({ where: { id: ids[0] } });
      expect(row?.isDeleted).toBe(false);
    }, 30000);

    it('ignores a forged role claim in the JWT and reads the role from the database', async () => {
      const ids = await makeDonors(1);
      const forged = jwt.sign({ sub: managerUserId, email: 'x@erp.com', role: 'Super Admin' }, secret);
      const res = await request(app)
        .delete(ENDPOINT)
        .set('Authorization', `Bearer ${forged}`)
        .send({ ids });

      expect(res.status).toBe(403);
      const row = await prisma.donor.findUnique({ where: { id: ids[0] } });
      expect(row?.isDeleted).toBe(false);
    }, 30000);
  });

  describe('Validation', () => {
    it('rejects a missing ids array with 400', async () => {
      const res = await request(app)
        .delete(ENDPOINT)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
    }, 30000);

    it('rejects an empty ids array with 400', async () => {
      const res = await request(app)
        .delete(ENDPOINT)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [] });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/No donors selected/i);
    }, 30000);

    it('rejects ids that are not valid UUIDs with 400 rather than a 500', async () => {
      const res = await request(app)
        .delete(ENDPOINT)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: ['not-a-uuid', 'also-not-a-uuid'] });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/No valid donor IDs/i);
    }, 30000);

    it('rejects a batch over the 500-id cap with 400', async () => {
      const res = await request(app)
        .delete(ENDPOINT)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: Array.from({ length: 501 }, (_, i) => `id-${i}`) });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/more than 500/i);
    }, 30000);

    it('rejects a non-DELETE method with 405', async () => {
      const res = await request(app)
        .post(ENDPOINT)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [] });
      expect(res.status).toBe(405);
    }, 30000);
  });

  describe('Deletion', () => {
    it('soft-deletes every selected donor and reports the count', async () => {
      const ids = await makeDonors(3);
      const res = await request(app)
        .delete(ENDPOINT)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deleted).toBe(3);
      expect(res.body.message).toBe('3 donors deleted successfully.');
      expect(res.body.deletedIds.sort()).toEqual([...ids].sort());

      const rows = await prisma.donor.findMany({ where: { id: { in: ids } } });
      expect(rows).toHaveLength(3);
      for (const row of rows) {
        expect(row.isDeleted).toBe(true);
        expect(row.deletedAt).not.toBeNull();
        expect(row.deletedBy).toBe(adminUserId);
      }
    }, 30000);

    it('hides deleted donors from the default directory listing', async () => {
      const ids = await makeDonors(2);
      await request(app)
        .delete(ENDPOINT)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids });

      const list = await request(app)
        .get('/api/v1/donors?limit=1000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(list.status).toBe(200);
      const listedIds = list.body.data.map((d: any) => d.id);
      expect(listedIds).not.toContain(ids[0]);
      expect(listedIds).not.toContain(ids[1]);
    }, 30000);

    it('deletes a single donor with correctly singular wording', async () => {
      const ids = await makeDonors(1);
      const res = await request(app)
        .delete(ENDPOINT)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids });

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(1);
      expect(res.body.message).toBe('1 donor deleted successfully.');
    }, 30000);

    it('is idempotent — repeating the request deletes nothing more', async () => {
      const ids = await makeDonors(2);
      const first = await request(app)
        .delete(ENDPOINT)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids });
      const second = await request(app)
        .delete(ENDPOINT)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids });

      expect(first.body.deleted).toBe(2);
      expect(second.status).toBe(200);
      expect(second.body.deleted).toBe(0);
      expect(second.body.deletedIds).toEqual([]);
      expect(second.body.message).toMatch(/no longer exist/i);
    }, 30000);

    it('counts only the donors that still exist when ids are stale or duplicated', async () => {
      const ids = await makeDonors(2);
      const missing = '00000000-0000-4000-8000-000000000000';
      const res = await request(app)
        .delete(ENDPOINT)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [...ids, ...ids, missing] });

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(2);
      expect(res.body.deletedIds).toHaveLength(2);
    }, 30000);
  });

  describe('Audit trail', () => {
    it('records one audit entry naming the deleted donor codes', async () => {
      const ids = await makeDonors(2);
      const codes = (await prisma.donor.findMany({
        where: { id: { in: ids } },
        select: { donorCode: true },
      })).map(d => d.donorCode);

      const before = new Date();
      const res = await request(app)
        .delete(ENDPOINT)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids });
      expect(res.status).toBe(200);

      const logs = await prisma.auditLog.findMany({
        where: { userId: adminUserId, action: 'Bulk Delete Donors', createdAt: { gte: before } },
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].module).toBe('DONOR');
      expect((logs[0].newValues as any).deletedCount).toBe(2);
      expect(((logs[0].newValues as any).donorCodes as string[]).sort()).toEqual([...codes].sort());
    }, 30000);

    it('writes no audit entry when nothing was deleted', async () => {
      const before = new Date();
      const res = await request(app)
        .delete(ENDPOINT)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: ['00000000-0000-4000-8000-000000000001'] });

      expect(res.body.deleted).toBe(0);
      const logs = await prisma.auditLog.findMany({
        where: { userId: adminUserId, action: 'Bulk Delete Donors', createdAt: { gte: before } },
      });
      expect(logs).toHaveLength(0);
    }, 30000);
  });
});
