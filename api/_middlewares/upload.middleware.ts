import multer, { MulterError } from 'multer';
import type { Request, Response, NextFunction } from 'express';

// No file-type or per-field size restrictions by design — any file the user
// selects is accepted. The single cap below exists purely as an operational
// safeguard: uploads are buffered in memory (multer.memoryStorage()), so an
// unbounded upload could exhaust server memory. It is not a validation rule.
const MEMORY_SAFETY_CAP_BYTES = 100 * 1024 * 1024; // 100 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MEMORY_SAFETY_CAP_BYTES,
    files: 3, // at most photo + cnicFront + cnicBack per request
  },
});

export const uploadFields = upload.fields([
  { name: 'photo',     maxCount: 1 },
  { name: 'cnicFront', maxCount: 1 },
  { name: 'cnicBack',  maxCount: 1 },
]);

/**
 * Express error-handling middleware that converts multer errors into the same
 * JSON shape the rest of the API uses, so the frontend always gets structured JSON
 * instead of Express's default HTML error page.
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
  if (err instanceof MulterError) {
    let message: string;
    let status: number;

    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File is too large to upload.';
      status  = 413;
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files in a single upload request.';
      status  = 400;
    } else {
      message = `Upload error: ${err.message}`;
      status  = 400;
    }

    res.status(status).json({ error: { message, status } });
    return;
  }

  next(err);
}
