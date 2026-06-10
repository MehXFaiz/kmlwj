import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler';
import * as authService from '../_services/auth.service';

export default makeHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  const { refreshToken } = req.body;
  if (refreshToken) {
    await authService.logout(refreshToken);
  }

  return res.status(200).json({
    status: 200,
    message: 'Logout successful',
  });
});
