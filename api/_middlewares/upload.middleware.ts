import multer, { MulterError } from 'multer';
import type { Request, Response, NextFunction } from 'express';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_MAX_BYTES    = 2 * 1024 * 1024;   // 2 MB
export const CNIC_MAX_BYTES     = 3 * 1024 * 1024;   // 3 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CNIC_MAX_BYTES,   // hard cap — per-field limits enforced in the handler
    files: 3,                   // at most photo + cnicFront + cnicBack
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      // Pass an error with a recognisable code so the error handler can map it
      const err: any = new Error('Unsupported image format. Please use JPG, PNG, or WEBP.');
      err.code = 'UNSUPPORTED_FORMAT';
      return cb(err);
    }
    cb(null, true);
  },
});

export const uploadFields = upload.fields([
  { name: 'photo',     maxCount: 1 },
  { name: 'cnicFront', maxCount: 1 },
  { name: 'cnicBack',  maxCount: 1 },
]);

/**
 * Express error-handling middleware that converts multer errors into the same
 * JSON shape the rest of the API uses, so the frontend always gets structured JSON.
 *
 * Register this immediately after the upload route in index.ts:
 *   app.post('/api/v1/upload', uploadFields, makeExpress(uploadHandler), handleUploadError);
 */
export function handleUploadError(
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Only intercept errors that originate from multer or our fileFilter
  if (err instanceof MulterError || err?.code === 'UNSUPPORTED_FORMAT') {
    let message: string;
    let status: number;

    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File exceeds the maximum allowed size. Profile photo: 2 MB, CNIC images: 3 MB.';
      status  = 413;
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files in a single upload request.';
      status  = 400;
    } else if (err.code === 'UNSUPPORTED_FORMAT') {
      message = err.message;
      status  = 415;
    } else {
      message = `Upload error: ${err.message}`;
      status  = 400;
    }

    res.status(status).json({ error: { message, status } });
    return;
  }

  // Not a multer error — pass it down the chain
  next(err);
}
