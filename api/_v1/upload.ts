import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth } from '../_middlewares/auth.middleware.js';
import { logger } from '../_utils/logger.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

/**
 * Local-disk upload fallback, used only when Cloudinary isn't configured
 * (see /api/v1/upload-sign). Suitable for a long-running dev server; NOT
 * suitable for Vercel serverless deployments, where the filesystem is
 * ephemeral and wiped between invocations, and where request bodies are
 * capped at 4.5 MB by the platform regardless of this code. Production
 * should always have Cloudinary configured so the browser uploads directly.
 */

const FIELD_KEY: Record<string, string> = {
  photo:     'photoUrl',
  cnicFront: 'cnicFrontUrl',
  cnicBack:  'cnicBackUrl',
};

function saveLocally(buffer: Buffer, originalname: string): string {
  const uploadsDir = path.join(process.cwd(), 'uploads', 'members');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const ext      = path.extname(originalname).toLowerCase().replace(/[^.a-z0-9]/gi, '') || '.bin';
  const safeName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  const fullPath = path.join(uploadsDir, safeName);

  fs.writeFileSync(fullPath, buffer);

  const urlPath = `/uploads/members/${safeName}`;
  logger.info({ fullPath, urlPath }, 'File saved locally');
  return urlPath;
}

function deleteLocally(urlPath: string): void {
  try {
    const relative = urlPath.replace(/^\/uploads\//, '');
    const fullPath = path.join(process.cwd(), 'uploads', relative);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      logger.info({ fullPath }, 'Orphaned local file deleted');
    }
  } catch (err) {
    logger.warn({ err, urlPath }, 'Failed to delete orphaned local file');
  }
}

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  logger.info({ method: req.method, url: req.url }, 'Local upload request received');

  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed', status: 405 } });
  }

  const files = (req as any).files as Record<string, Express.Multer.File[]> | undefined;

  logger.info({
    hasFiles: !!files,
    fieldNames: files ? Object.keys(files) : [],
    contentType: req.headers['content-type'],
  }, 'Parsed upload request');

  if (!files || Object.keys(files).length === 0) {
    logger.warn('Upload request contained no parseable files');
    return res.status(400).json({
      error: {
        message: 'No files received. Ensure the request uses multipart/form-data.',
        status: 400,
      },
    });
  }

  const savedUrls: string[] = []; // track for rollback on partial failure
  const result: Record<string, string> = {};

  try {
    for (const [field, fileArr] of Object.entries(files)) {
      const file = fileArr[0];

      logger.info({
        field,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      }, 'Processing uploaded file');

      const url = saveLocally(file.buffer, file.originalname);
      savedUrls.push(url);

      const key = FIELD_KEY[field] ?? field;
      result[key] = url;

      logger.info({ field, key, url }, 'File upload successful');
    }
  } catch (err: any) {
    if (savedUrls.length > 0) {
      logger.warn({ savedUrls }, 'Rolling back locally saved files due to error');
      savedUrls.forEach(deleteLocally);
    }
    logger.error({ err }, 'Upload processing failed');
    throw err; // re-thrown so makeHandler formats the error response
  }

  logger.info({ result }, 'All uploads complete');
  return res.status(200).json({ status: 200, data: result });
});
