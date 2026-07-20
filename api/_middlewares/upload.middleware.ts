import multer from 'multer';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;  // 2 MB
export const CNIC_MAX_BYTES  = 3 * 1024 * 1024;  // 3 MB

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CNIC_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('UNSUPPORTED_FORMAT'));
    }
    cb(null, true);
  },
});

export const uploadFields = upload.fields([
  { name: 'photo',     maxCount: 1 },
  { name: 'cnicFront', maxCount: 1 },
  { name: 'cnicBack',  maxCount: 1 },
]);
