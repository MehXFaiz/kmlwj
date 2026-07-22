import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import * as authService from '../_services/auth.service.js';
import { logAudit } from '../_utils/audit.js';
import { getRefreshTokenCookie, clearRefreshTokenCookie } from '../_utils/cookies.js';

export default makeHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  const refreshToken = getRefreshTokenCookie(req) || req.body?.refreshToken;
  if (refreshToken) {
    const userId = await authService.logout(refreshToken);
    if (userId) {
      await logAudit(
        userId,
        'User Logout',
        'AUTH',
        null,
        null,
        req.headers['x-forwarded-for'] as string,
        req.headers['user-agent']
      );
    }
  }

  clearRefreshTokenCookie(res);

  return res.status(200).json({
    status: 200,
    message: 'Logout successful',
  });
});
