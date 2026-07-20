import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth } from '../_middlewares/auth.middleware.js';
import { PHOTO_MAX_BYTES, CNIC_MAX_BYTES } from '../_middlewares/upload.middleware.js';
import { logger } from '../_utils/logger.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// ── Metadata tables ─────────────────────────────────────────────────────────

const FIELD_KEY: Record<string, string> = {
  photo:     'photoUrl',
  cnicFront: 'cnicFrontUrl',
  cnicBack:  'cnicBackUrl',
};

const FIELD_MAX: Record<string, number> = {
  photo:     PHOTO_MAX_BYTES,
  cnicFront: CNIC_MAX_BYTES,
  cnicBack:  CNIC_MAX_BYTES,
};

const FIELD_LABEL: Record<string, string> = {
  photo:     'Profile photo',
  cnicFront: 'CNIC front image',
  cnicBack:  'CNIC back image',
};

const FIELD_LIMIT_LABEL: Record<string, string> = {
  photo:     '2 MB',
  cnicFront: '3 MB',
  cnicBack:  '3 MB',
};

// ── Local storage (development) ──────────────────────────────────────────────

function saveLocally(buffer: Buffer, originalname: string): string {
  const uploadsDir = path.join(process.cwd(), 'uploads', 'members');

  fs.mkdirSync(uploadsDir, { recursive: true });

  const ext      = path.extname(originalname).toLowerCase().replace(/[^.a-z]/g, '') || '.jpg';
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

// ── Cloudinary upload (production) ───────────────────────────────────────────

async function uploadToCloudinary(buffer: Buffer, originalname: string): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    logger.error('Cloudinary credentials missing — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
    const err: any = new Error(
      'File storage is not configured for this environment. Please contact the administrator.'
    );
    err.status = 503;
    throw err;
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder    = process.env.CLOUDINARY_FOLDER || 'kmlwj/members';
  const toSign    = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  const ext      = path.extname(originalname).toLowerCase().replace('.', '') || 'jpg';
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  };
  const mime = mimeMap[ext] ?? 'image/jpeg';

  const form = new FormData();
  form.append('file',      new Blob([buffer], { type: mime }), originalname);
  form.append('api_key',   apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  form.append('folder',    folder);

  logger.info({ cloudName, folder, originalname }, 'Uploading to Cloudinary');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: form }
  );

  const responseText = await response.text();

  if (!response.ok) {
    logger.error({ status: response.status, body: responseText }, 'Cloudinary upload failed');
    const err: any = new Error('Cloud storage upload failed. Please try again.');
    err.status = 502;
    throw err;
  }

  const data = JSON.parse(responseText) as { secure_url: string };
  logger.info({ url: data.secure_url }, 'Cloudinary upload successful');
  return data.secure_url;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  logger.info({ method: req.method, url: req.url }, 'Upload request received');

  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed', status: 405 } });
  }

  // req.files is populated by the multer middleware wired in index.ts
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

  const isProduction = process.env.NODE_ENV === 'production';
  const savedUrls: string[] = [];   // track for rollback on partial failure
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

      // Per-field size validation (multer enforces the global cap; this enforces per-field limits)
      const maxSize   = FIELD_MAX[field] ?? CNIC_MAX_BYTES;
      const limitLabel = FIELD_LIMIT_LABEL[field] ?? '3 MB';
      const label      = FIELD_LABEL[field] ?? 'File';

      if (file.size > maxSize) {
        logger.warn({ field, size: file.size, maxSize }, 'File exceeds per-field size limit');
        const err: any = new Error(`${label} exceeds the ${limitLabel} limit.`);
        err.status = 413;
        throw err;
      }

      // Persist the file
      const url = isProduction
        ? await uploadToCloudinary(file.buffer, file.originalname)
        : saveLocally(file.buffer, file.originalname);

      savedUrls.push(url);

      const key = FIELD_KEY[field] ?? field;
      result[key] = url;

      logger.info({ field, key, url }, 'File upload successful');
    }
  } catch (err: any) {
    // Rollback any files already saved in this request before the error
    if (!isProduction && savedUrls.length > 0) {
      logger.warn({ savedUrls }, 'Rolling back locally saved files due to error');
      savedUrls.forEach(deleteLocally);
    }
    throw err;   // re-throw so makeHandler formats the error response
  }

  logger.info({ result }, 'All uploads complete');
  return res.status(200).json({ status: 200, data: result });
});
