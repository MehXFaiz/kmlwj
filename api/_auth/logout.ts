import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import * as authService from '../_services/auth.service.js';
import { logAudit } from '../_utils/audit.js';

export default makeHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  const { refreshToken } = req.body;
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

  return res.status(200).json({
    status: 200,
    message: 'Logout successful',
  });
});
