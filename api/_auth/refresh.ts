import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import * as authService from '../_services/auth.service.js';
import { getRefreshTokenCookie, setRefreshTokenCookie } from '../_utils/cookies.js';

export default makeHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  // SQA fix: the refresh token now travels only via the httpOnly cookie set
  // at login, not the request body — a legacy body-supplied token is still
  // accepted as a fallback so any non-browser caller isn't broken.
  const refreshToken = getRefreshTokenCookie(req) || req.body?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: { message: 'Invalid refresh token', status: 401 } });
  }

  const result = await authService.rotateTokens(refreshToken);

  setRefreshTokenCookie(res, result.refreshToken);

  return res.status(200).json({
    status: 200,
    message: 'Token refreshed',
    data: {
      accessToken: result.accessToken,
    },
  });
});
