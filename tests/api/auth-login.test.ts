import { describe, expect, it } from 'vitest';
import { login } from '../../api/_services/auth.service.ts';

describe('Auth login regression', () => {
  it('should authenticate a valid user when the email is submitted with different casing', async () => {
    const result = await login({
      email: 'ADMIN@ERP.COM',
      password: 'admin123',
    });

    expect(result).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      user: expect.objectContaining({
        id: expect.any(String),
        email: 'admin@erp.com',
        fullName: 'System Admin',
        role: 'Super Admin',
      }),
    });
  });
});
