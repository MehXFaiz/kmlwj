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
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
function sniffImageType(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
    return { ext: ".jpg", mime: "image/jpeg" };
  }
  if (buffer.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { ext: ".png", mime: "image/png" };
  }
  if (buffer.slice(0, 6).toString("ascii") === "GIF87a" || buffer.slice(0, 6).toString("ascii") === "GIF89a") {
    return { ext: ".gif", mime: "image/gif" };
  }
  if (buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP") {
    return { ext: ".webp", mime: "image/webp" };
  }
  return null;
}
function assertWritableEnvironment() {
  if (process.env.VERCEL) {
    const missingVars = [
      !process.env.CLOUDINARY_CLOUD_NAME && "CLOUDINARY_CLOUD_NAME",
      !process.env.CLOUDINARY_API_KEY && "CLOUDINARY_API_KEY",
      !process.env.CLOUDINARY_API_SECRET && "CLOUDINARY_API_SECRET"
    ].filter(Boolean);
    logger.error(
      { missingVars },
      "Local-disk upload fallback invoked on Vercel (process.env.VERCEL is set). Vercel serverless functions have a read-only filesystem outside /tmp, and /tmp does not persist across invocations, so files saved here would be lost immediately. Set the missing Cloudinary environment variables in the Vercel project settings so uploads go directly from the browser to Cloudinary instead."
    );
    const err = new Error(
      `Cloud storage is not configured. Missing environment variable(s): ${missingVars.join(", ")}. Set them in the Vercel project settings (Settings \u2192 Environment Variables) and redeploy.`
    );
    err.status = 503;
    err.code = "STORAGE_NOT_CONFIGURED";
    throw err;
  }
}
function saveLocally(buffer, ext, field) {
  const uploadsDir = path.join(process.cwd(), "uploads", "members");
  logger.info({ field, uploadsDir }, "Ensuring upload directory exists");
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (err) {
    logger.error({ err: { message: err.message, code: err.code, stack: err.stack }, uploadsDir }, "Failed to create upload directory");
    throw err;
  }
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
      if (file.size > MAX_IMAGE_BYTES) {
        const err = new Error(`"${field}" is too large. Maximum allowed size is ${MAX_IMAGE_BYTES / (1024 * 1024)}MB.`);
        err.status = 413;
        throw err;
      }
      const sniffed = sniffImageType(file.buffer);
      if (!sniffed) {
        logger.warn({ field, originalname: file.originalname, mimetype: file.mimetype }, "Rejected upload \u2014 not a recognized image format");
        const err = new Error(`"${field}" must be a JPEG, PNG, GIF, or WEBP image.`);
        err.status = 400;
        throw err;
      }
      const url = saveLocally(file.buffer, sniffed.ext, field);
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
