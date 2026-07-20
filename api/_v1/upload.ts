import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth } from '../_middlewares/auth.middleware.js';
import { PHOTO_MAX_BYTES, CNIC_MAX_BYTES } from '../_middlewares/upload.middleware.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// ── Field → output key map ──────────────────────────────────────────────────
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

// ── Local storage (development) ─────────────────────────────────────────────
function saveLocally(buffer: Buffer, originalname: string): string {
  const dir = path.join(process.cwd(), 'uploads', 'members');
  fs.mkdirSync(dir, { recursive: true });
  const ext      = path.extname(originalname).toLowerCase() || '.jpg';
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/uploads/members/${filename}`;
}

// ── Cloudinary upload (production) ─────────────────────────────────────────
async function uploadToCloudinary(buffer: Buffer, originalname: string): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    const err: any = new Error(
      'Cloud storage is not configured. ' +
      'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.'
    );
    err.status = 500;
    throw err;
  }

  const timestamp    = Math.round(Date.now() / 1000);
  const folder       = 'kmlwj/members';
  const toSign       = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature    = crypto.createHash('sha1').update(toSign).digest('hex');
  const ext          = path.extname(originalname).toLowerCase().replace('.', '') || 'jpg';
  const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const mime         = mimeMap[ext] ?? 'image/jpeg';

  const form = new FormData();
  form.append('file',      new Blob([buffer], { type: mime }), originalname);
  form.append('api_key',   apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  form.append('folder',    folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: form }
  );

  if (!response.ok) {
    const body = await response.text();
    const err: any = new Error(`Cloud upload failed: ${body}`);
    err.status = 502;
    throw err;
  }

  const data = await response.json() as { secure_url: string };
  return data.secure_url;
}

// ── Handler ─────────────────────────────────────────────────────────────────
export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed', status: 405 } });
  }

  // req.files is populated by the multer middleware registered in index.ts
  const files = (req as any).files as Record<string, Express.Multer.File[]> | undefined;

  if (!files || Object.keys(files).length === 0) {
    return res.status(400).json({ error: { message: 'No files uploaded.', status: 400 } });
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const result: Record<string, string> = {};

  for (const [field, fileArr] of Object.entries(files)) {
    const file   = fileArr[0];
    const maxSize = FIELD_MAX[field] ?? CNIC_MAX_BYTES;

    if (file.size > maxSize) {
      const label = FIELD_LABEL[field] ?? 'File';
      const limit = field === 'photo' ? '2 MB' : '3 MB';
      const err: any = new Error(`${label} exceeds the ${limit} limit.`);
      err.status = 413;
      throw err;
    }

    const url = isProduction
      ? await uploadToCloudinary(file.buffer, file.originalname)
      : saveLocally(file.buffer, file.originalname);

    const key = FIELD_KEY[field] ?? field;
    result[key] = url;
  }

  return res.status(200).json({ status: 200, data: result });
});
