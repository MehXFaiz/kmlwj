import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { makeHandler } from '../_utils/handler.js';
import * as authService from '../_services/auth.service.js';
import { logAudit } from '../_utils/audit.js';
import { logger } from '../_utils/logger.js';
import { setRefreshTokenCookie } from '../_utils/cookies.js';

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').transform((value) => value.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

export default makeHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  const validatedData = loginSchema.parse(req.body);
  const result = await authService.login(validatedData);

  logger.info({ userId: result.user.id, status: 200 }, 'Login response status');

  await logAudit(
    result.user.id,
    'User Login',
    'AUTH',
    null,
    null,
    req.headers['x-forwarded-for'] as string,
    req.headers['user-agent']
  );

  // SQA fix: the refresh token is now delivered exclusively via an httpOnly,
  // SameSite cookie instead of the JSON body — a script running on the page
  // (e.g. via any future XSS) can no longer read it from localStorage.
  setRefreshTokenCookie(res, result.refreshToken);

  return res.status(200).json({
    status: 200,
    message: 'Login successful',
    data: {
      accessToken: result.accessToken,
      user: result.user,
    },
  });
});
