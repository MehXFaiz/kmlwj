import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../api/index.js';
import { prisma } from '../../api/_prisma.js';

/**
 * Cross-module delete-persistence audit.
 *
 * For every CRUD module this asserts the full round trip:
 *   create via API -> DELETE via API -> re-GET the default list (the exact
 *   request the UI issues after a refresh) -> read the row straight out of
 *   PostgreSQL.
 *
 * The re-GET is the part that reproduces the reported bug: a record that is
 * only removed from React state, or soft-deleted without the list query
 * filtering it out, reappears here exactly as it does after F5.
 */
describe('Delete persistence across modules', () => {
  let superAdminToken: string;
  let superAdminUserId: string;
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_sign_key_123_abc';
  const stamp = Date.now();

  beforeAll(async () => {
    const superAdmin = await prisma.user.findFirst({
      where: { role: { name: 'Super Admin' } },
      include: { role: true }
    });
    if (!superAdmin) throw new Error('No Super Admin user present to run the audit against');
    superAdminUserId = superAdmin.id;
    superAdminToken = jwt.sign(
      { sub: superAdmin.id, email: superAdmin.email, role: 'Super Admin' },
      secret
    );
  }, 30000);

  afterAll(async () => {
    await prisma.$disconnect().catch(() => {});
  });

  const auth = () => ({ Authorization: `Bearer ${superAdminToken}` });

  /**
   * Runs the create -> delete -> refetch cycle for one module.
   *
   * `listOf` extracts the array of records from the module's GET envelope,
   * which is not uniform across routes (some return `data`, some nest it).
   */
  async function assertDeletePersists(opts: {
    module: string;
    path: string;
    createBody: Record<string, unknown>;
    model: string;
    listOf?: (body: any) => any[];
  }) {
    const { module, path, createBody, model } = opts;
    const listOf = opts.listOf || ((b: any) => (Array.isArray(b?.data) ? b.data : b?.data?.items || []));

    // 1. Create
    const created = await request(app).post(path).set(auth()).send(createBody);
    expect(created.status, `${module}: create failed -> ${JSON.stringify(created.body)}`).toBeLessThan(300);
    const id = created.body?.data?.id;
    expect(id, `${module}: create returned no id`).toBeTruthy();

    // 2. Confirm it is visible in the default list before deleting
    const before = await request(app).get(path).set(auth());
    expect(listOf(before.body).some((r: any) => r.id === id), `${module}: created record not in list`).toBe(true);

    // 3. Delete
    const del = await request(app).delete(`${path}?id=${id}`).set(auth()).send({ id });
    expect(del.status, `${module}: delete failed -> ${JSON.stringify(del.body)}`).toBeLessThan(300);

    // 4. Refetch the default list — this is the post-refresh request
    const after = await request(app).get(path).set(auth());
    expect(
      listOf(after.body).some((r: any) => r.id === id),
      `${module}: DELETED RECORD REAPPEARS in the default GET list after delete`
    ).toBe(false);

    // 5. Verify against PostgreSQL directly: row must be gone or flagged deleted
    const row = await (prisma as any)[model].findUnique({ where: { id } });
    if (row !== null) {
      expect(row.isDeleted, `${module}: row still live in PostgreSQL after delete`).toBe(true);
    }

    // Cleanup
    await (prisma as any)[model].delete({ where: { id } }).catch(() => {});
  }

  it('Donors: delete persists after refetch', async () => {
    await assertDeletePersists({
      module: 'Donors',
      path: '/api/v1/donors',
      model: 'donor',
      createBody: { fullName: 'Audit Donor', mobile: '03001234567' }
    });
  }, 40000);

  it('Customers: delete persists after refetch', async () => {
    await assertDeletePersists({
      module: 'Customers',
      path: '/api/v1/customers',
      model: 'customer',
      createBody: { name: 'Audit Customer', phone: '03001234567' }
    });
  }, 40000);

  it('Members: delete persists after refetch', async () => {
    await assertDeletePersists({
      module: 'Members',
      path: '/api/v1/members',
      model: 'member',
      createBody: { fullName: 'Audit Member', mobile: '03001234567' }
    });
  }, 40000);

  it('Beneficiaries (Welfare List): delete persists after refetch', async () => {
    await assertDeletePersists({
      module: 'Beneficiaries',
      path: '/api/v1/beneficiaries',
      model: 'beneficiary',
      createBody: { name: 'Audit Beneficiary', cnic: '4210112345671' }
    });
  }, 40000);

  it('Expense Heads: delete persists after refetch', async () => {
    await assertDeletePersists({
      module: 'Expense Heads',
      path: '/api/v1/expense-heads',
      model: 'expenseHead',
      createBody: { name: `Audit Head ${stamp}`, category: 'Administrative' }
    });
  }, 40000);

  it('Reserved Codes: delete persists after refetch', async () => {
    await assertDeletePersists({
      module: 'Reserved Codes',
      path: '/api/v1/reserved-codes',
      model: 'reservedCode',
      createBody: { reserveStart: '9900001', reserveEnd: '9900009', reserveReason: 'Audit' }
    });
  }, 40000);

  it('General Ledger: refuses direct delete with a meaningful error, never a silent success', async () => {
    const res = await request(app).delete('/api/v1/general-ledger?id=whatever').set(auth()).send({ id: 'whatever' });
    expect(res.status).toBe(400);
    expect(res.body?.error?.message).toMatch(/Journal Entr/i);
  }, 30000);
});
