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
 * (see /api/v1/upload-sign). Suitable for a long-running dev server.
 *
 * NOT suitable for Vercel serverless deployments: the filesystem there is
 * read-only outside /tmp, and /tmp itself is wiped between invocations, so
 * writes either throw (EROFS/EACCES) or silently vanish. `process.env.VERCEL`
 * is set automatically by the Vercel runtime, so we detect this up front and
 * fail with a clear, actionable message instead of crashing into a doomed
 * fs.writeFileSync call. Production should always have Cloudinary configured
 * so uploads go directly from the browser (see memberService.uploadFile).
 */

const FIELD_KEY: Record<string, string> = {
  photo:     'photoUrl',
  cnicFront: 'cnicFrontUrl',
  cnicBack:  'cnicBackUrl',
};

// SQA fix: this local-disk path previously accepted any file type/size "by
// design" and derived the saved filename's extension from the client-supplied
// original filename — a renamed .html/.php/.exe would be written to disk with
// that extension and served back from /uploads, a same-origin stored-content
// risk. Content is now sniffed by magic bytes (not trusted mimetype/filename)
// against an image allowlist, and the saved extension is always derived from
// the detected type. The production path (Cloudinary, see upload-sign.ts)
// already restricts to images via its /image/upload endpoint.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB per file

type SniffedImageType = { ext: string; mime: string };

function sniffImageType(buffer: Buffer): SniffedImageType | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: '.jpg', mime: 'image/jpeg' };
  }
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: '.png', mime: 'image/png' };
  }
  if (buffer.slice(0, 6).toString('ascii') === 'GIF87a' || buffer.slice(0, 6).toString('ascii') === 'GIF89a') {
    return { ext: '.gif', mime: 'image/gif' };
  }
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') {
    return { ext: '.webp', mime: 'image/webp' };
  }
  return null;
}

function assertWritableEnvironment(): void {
  if (process.env.VERCEL) {
    const missingVars = [
      !process.env.CLOUDINARY_CLOUD_NAME && 'CLOUDINARY_CLOUD_NAME',
      !process.env.CLOUDINARY_API_KEY    && 'CLOUDINARY_API_KEY',
      !process.env.CLOUDINARY_API_SECRET && 'CLOUDINARY_API_SECRET',
    ].filter(Boolean) as string[];

    logger.error({ missingVars },
      'Local-disk upload fallback invoked on Vercel (process.env.VERCEL is set). Vercel serverless ' +
      'functions have a read-only filesystem outside /tmp, and /tmp does not persist across invocations, ' +
      'so files saved here would be lost immediately. Set the missing Cloudinary environment variables ' +
      'in the Vercel project settings so uploads go directly from the browser to Cloudinary instead.'
    );
    const err: any = new Error(
      `Cloud storage is not configured. Missing environment variable(s): ${missingVars.join(', ')}. ` +
      'Set them in the Vercel project settings (Settings → Environment Variables) and redeploy.'
    );
    err.status = 503;
    err.code = 'STORAGE_NOT_CONFIGURED';
    throw err;
  }
}

function saveLocally(buffer: Buffer, ext: string, field: string): string {
  const uploadsDir = path.join(process.cwd(), 'uploads', 'members');

  logger.info({ field, uploadsDir }, 'Ensuring upload directory exists');
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (err: any) {
    logger.error({ err: { message: err.message, code: err.code, stack: err.stack }, uploadsDir }, 'Failed to create upload directory');
    throw err;
  }

  const safeName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  const fullPath = path.join(uploadsDir, safeName);

  logger.info({ field, fullPath }, 'Writing file to disk');
  try {
    fs.writeFileSync(fullPath, buffer);
  } catch (err: any) {
    logger.error({ err: { message: err.message, code: err.code, stack: err.stack }, fullPath }, 'Failed to write file to disk');
    throw err;
  }

  const urlPath = `/uploads/members/${safeName}`;
  logger.info({ field, fullPath, urlPath }, 'File saved locally');
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
  } catch (err: any) {
    logger.warn({ err: { message: err.message, code: err.code }, urlPath }, 'Failed to delete orphaned local file');
  }
}

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  logger.info({
    method: req.method,
    url: req.url,
    headers: {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length'],
      authorization: req.headers.authorization ? '[present]' : '[missing]',
    },
  }, 'Local upload request received');

  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) {
    logger.warn('Upload request failed authentication — request will not proceed further');
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed', status: 405 } });
  }

  // req.files is populated by the multer middleware wired in index.ts
  const files = (req as any).files as Record<string, Express.Multer.File[]> | undefined;

  logger.info({
    hasFiles: !!files,
    fieldNames: files ? Object.keys(files) : [],
    bodyKeys: req.body ? Object.keys(req.body) : [],
    contentType: req.headers['content-type'],
  }, 'Parsed upload request (post-multer)');

  if (!files || Object.keys(files).length === 0) {
    logger.warn({ contentType: req.headers['content-type'] }, 'Upload request contained no parseable files');
    return res.status(400).json({
      error: {
        message: 'No files received. Ensure the request uses multipart/form-data.',
        status: 400,
      },
    });
  }

  // Fail fast with a clear message rather than crashing into a doomed fs write
  assertWritableEnvironment();

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

      if (file.size > MAX_IMAGE_BYTES) {
        const err: any = new Error(`"${field}" is too large. Maximum allowed size is ${MAX_IMAGE_BYTES / (1024 * 1024)}MB.`);
        err.status = 413;
        throw err;
      }

      // Validate by content (magic bytes), never by client-supplied filename
      // or mimetype header — both are trivially spoofable.
      const sniffed = sniffImageType(file.buffer);
      if (!sniffed) {
        logger.warn({ field, originalname: file.originalname, mimetype: file.mimetype }, 'Rejected upload — not a recognized image format');
        const err: any = new Error(`"${field}" must be a JPEG, PNG, GIF, or WEBP image.`);
        err.status = 400;
        throw err;
      }

      const url = saveLocally(file.buffer, sniffed.ext, field);
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
    logger.error({ err: { message: err.message, code: err.code, stack: err.stack } }, 'Upload processing failed');
    throw err; // re-thrown so makeHandler formats the error response
  }

  logger.info({ result }, 'All uploads complete — sending success response');
  return res.status(200).json({ status: 200, data: result });
});
