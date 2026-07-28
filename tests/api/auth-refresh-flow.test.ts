import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../api/index.js';
import { prisma } from '../../api/_prisma.js';

/**
 * End-to-end check of the access/refresh token lifecycle.
 *
 * Uses a dedicated throwaway user rather than the seeded admin because the reuse
 * detection case deliberately revokes every refresh token belonging to the user,
 * which would sign out any real admin session sharing this database.
 */
describe('Auth refresh flow', () => {
  const PASSWORD = 'RefreshFlowTest!123';
  const EMAIL = `test_refresh_flow_${Date.now()}@erp.com`;
  let userId: string;

  /** Pulls the refresh_token cookie out of a Set-Cookie header array. */
  function refreshCookie(res: any): string | undefined {
    const raw = res.headers['set-cookie'] as string[] | undefined;
    return raw?.find(c => c.startsWith('refresh_token='));
  }

  beforeAll(async () => {
    const role = await prisma.role.findFirst({ where: { name: 'Super Admin' } });
    if (!role) throw new Error('Seeded role "Super Admin" not found — run prisma db seed first.');
    const user = await prisma.user.create({
      data: {
        email: EMAIL,
        password: await bcrypt.hash(PASSWORD, 12),
        fullName: 'Refresh Flow Test User',
        roleId: role.id,
        isActive: true,
      },
    });
    userId = user.id;
  }, 30000);

  afterAll(async () => {
    if (userId) {
      await prisma.refreshToken.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  }, 30000);

  async function doLogin() {
    const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(200);
    return res;
  }

  it('login issues an access token and an httpOnly refresh cookie', async () => {
    const res = await doLogin();

    expect(res.body.data.accessToken).toEqual(expect.any(String));

    const cookie = refreshCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api/auth');

    // The refresh token must never be readable by JavaScript, so it must not
    // appear in the JSON body — only in the httpOnly cookie.
    expect(res.body.data.refreshToken).toBeUndefined();
  }, 30000);

  it('refresh with the cookie returns a fresh access token and rotates the cookie', async () => {
    const login = await doLogin();
    const cookie = refreshCookie(login)!;

    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));

    const rotated = refreshCookie(res);
    expect(rotated).toBeDefined();
    expect(rotated).not.toBe(cookie);
  }, 30000);

  it('refresh with no cookie returns 401 — the expected logged-out response', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  }, 30000);

  it('reusing an already-rotated refresh token is rejected and revokes the family', async () => {
    const login = await doLogin();
    const original = refreshCookie(login)!;

    const first = await request(app).post('/api/auth/refresh').set('Cookie', original);
    expect(first.status).toBe(200);

    // Replaying the now-revoked token must fail rather than mint a new session.
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', original);
    expect(replay.status).toBe(401);

    // Reuse detection revokes every outstanding token for the user, so the
    // token handed out by the successful rotation is dead too.
    const rotated = refreshCookie(first)!;
    const afterRevoke = await request(app).post('/api/auth/refresh').set('Cookie', rotated);
    expect(afterRevoke.status).toBe(401);

    const live = await prisma.refreshToken.count({ where: { userId, revokedAt: null } });
    expect(live).toBe(0);
  }, 30000);

  it('logout revokes the refresh token so it can no longer be rotated', async () => {
    const login = await doLogin();
    const cookie = refreshCookie(login)!;

    const out = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(200);

    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(401);
  }, 30000);

  describe('notifications authorization', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await request(app).get('/api/v1/notifications?limit=50');
      expect(res.status).toBe(401);
    }, 30000);

    it('returns 401 for a malformed or expired token', async () => {
      const res = await request(app)
        .get('/api/v1/notifications?limit=50')
        .set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(401);
    }, 30000);

    it('returns 200 with the access token issued by login', async () => {
      const login = await doLogin();
      const res = await request(app)
        .get('/api/v1/notifications?limit=50')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    }, 30000);

    it('returns 200 with an access token obtained by refreshing', async () => {
      const login = await doLogin();
      const refreshed = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookie(login)!);

      const res = await request(app)
        .get('/api/v1/notifications?limit=50')
        .set('Authorization', `Bearer ${refreshed.body.data.accessToken}`);

      expect(res.status).toBe(200);
    }, 30000);
  });
});
