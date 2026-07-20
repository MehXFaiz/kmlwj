import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { logger } from "../_utils/logger.js";
import path from "path";
import fs from "fs";
import crypto from "crypto";
const FIELD_KEY = {
  photo: "photoUrl",
  cnicFront: "cnicFrontUrl",
  cnicBack: "cnicBackUrl"
};
function assertWritableEnvironment() {
  if (process.env.VERCEL) {
    logger.error(
      "Local-disk upload fallback invoked on Vercel (process.env.VERCEL is set) with no Cloudinary credentials configured. Vercel serverless functions have a read-only filesystem outside /tmp, and /tmp does not persist across invocations, so files saved here would be lost immediately. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in the Vercel project environment variables so uploads go directly from the browser to Cloudinary instead."
    );
    const err = new Error(
      "File storage is not configured for this environment. Please contact the administrator."
    );
    err.status = 503;
    err.code = "STORAGE_NOT_CONFIGURED";
    throw err;
  }
}
function saveLocally(buffer, originalname, field) {
  const uploadsDir = path.join(process.cwd(), "uploads", "members");
  logger.info({ field, uploadsDir }, "Ensuring upload directory exists");
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (err) {
    logger.error({ err: { message: err.message, code: err.code, stack: err.stack }, uploadsDir }, "Failed to create upload directory");
    throw err;
  }
  const ext = path.extname(originalname).toLowerCase().replace(/[^.a-z0-9]/gi, "") || ".bin";
  const safeName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
  const fullPath = path.join(uploadsDir, safeName);
  logger.info({ field, fullPath }, "Writing file to disk");
  try {
    fs.writeFileSync(fullPath, buffer);
  } catch (err) {
    logger.error({ err: { message: err.message, code: err.code, stack: err.stack }, fullPath }, "Failed to write file to disk");
    throw err;
  }
  const urlPath = `/uploads/members/${safeName}`;
  logger.info({ field, fullPath, urlPath }, "File saved locally");
  return urlPath;
}
function deleteLocally(urlPath) {
  try {
    const relative = urlPath.replace(/^\/uploads\//, "");
    const fullPath = path.join(process.cwd(), "uploads", relative);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      logger.info({ fullPath }, "Orphaned local file deleted");
    }
  } catch (err) {
    logger.warn({ err: { message: err.message, code: err.code }, urlPath }, "Failed to delete orphaned local file");
  }
}
var upload_default = makeHandler(async (req, res) => {
  logger.info({
    method: req.method,
    url: req.url,
    headers: {
      "content-type": req.headers["content-type"],
      "content-length": req.headers["content-length"],
      authorization: req.headers.authorization ? "[present]" : "[missing]"
    }
  }, "Local upload request received");
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) {
    logger.warn("Upload request failed authentication \u2014 request will not proceed further");
    return;
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method not allowed", status: 405 } });
  }
  const files = req.files;
  logger.info({
    hasFiles: !!files,
    fieldNames: files ? Object.keys(files) : [],
    bodyKeys: req.body ? Object.keys(req.body) : [],
    contentType: req.headers["content-type"]
  }, "Parsed upload request (post-multer)");
  if (!files || Object.keys(files).length === 0) {
    logger.warn({ contentType: req.headers["content-type"] }, "Upload request contained no parseable files");
    return res.status(400).json({
      error: {
        message: "No files received. Ensure the request uses multipart/form-data.",
        status: 400
      }
    });
  }
  assertWritableEnvironment();
  const savedUrls = [];
  const result = {};
  try {
    for (const [field, fileArr] of Object.entries(files)) {
      const file = fileArr[0];
      logger.info({
        field,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      }, "Processing uploaded file");
      const url = saveLocally(file.buffer, file.originalname, field);
      savedUrls.push(url);
      const key = FIELD_KEY[field] ?? field;
      result[key] = url;
      logger.info({ field, key, url }, "File upload successful");
    }
  } catch (err) {
    if (savedUrls.length > 0) {
      logger.warn({ savedUrls }, "Rolling back locally saved files due to error");
      savedUrls.forEach(deleteLocally);
    }
    logger.error({ err: { message: err.message, code: err.code, stack: err.stack } }, "Upload processing failed");
    throw err;
  }
  logger.info({ result }, "All uploads complete \u2014 sending success response");
  return res.status(200).json({ status: 200, data: result });
});
export {
  upload_default as default
};
