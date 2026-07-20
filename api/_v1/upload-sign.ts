import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth } from '../_middlewares/auth.middleware.js';
import { logger } from '../_utils/logger.js';
import crypto from 'crypto';

/**
 * Issues a short-lived Cloudinary upload signature so the browser can upload
 * files directly to Cloudinary, without the raw bytes ever passing through
 * our own server/serverless function.
 *
 * This matters on Vercel specifically: serverless functions hard-cap request
 * bodies at 4.5 MB at the platform level, before any application code runs.
 * Proxying image uploads through /api/v1/upload works locally but silently
 * 500s in production for any file over that limit. Signing a direct-to-Cloudinary
 * upload sidesteps the platform limit entirely.
 *
 * If Cloudinary isn't configured (e.g. local dev with no CLOUDINARY_* env vars),
 * responds with { mode: 'local' } so the client falls back to POSTing the file
 * to /api/v1/upload, which is fine for a long-running dev server with no such cap.
 */
export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed', status: 405 } });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    logger.info('Cloudinary not configured — client will use local upload fallback');
    return res.status(200).json({ status: 200, data: { mode: 'local' } });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder    = process.env.CLOUDINARY_FOLDER || 'kmlwj/members';
  const toSign    = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  logger.info({ cloudName, folder, userId: req.user.id }, 'Issued Cloudinary upload signature');

  return res.status(200).json({
    status: 200,
    data: { mode: 'cloud', cloudName, apiKey, timestamp, signature, folder },
  });
});
