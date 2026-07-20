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
function saveLocally(buffer, originalname) {
  const uploadsDir = path.join(process.cwd(), "uploads", "members");
  fs.mkdirSync(uploadsDir, { recursive: true });
  const ext = path.extname(originalname).toLowerCase().replace(/[^.a-z0-9]/gi, "") || ".bin";
  const safeName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
  const fullPath = path.join(uploadsDir, safeName);
  fs.writeFileSync(fullPath, buffer);
  const urlPath = `/uploads/members/${safeName}`;
  logger.info({ fullPath, urlPath }, "File saved locally");
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
    logger.warn({ err, urlPath }, "Failed to delete orphaned local file");
  }
}
var upload_default = makeHandler(async (req, res) => {
  logger.info({ method: req.method, url: req.url }, "Local upload request received");
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method not allowed", status: 405 } });
  }
  const files = req.files;
  logger.info({
    hasFiles: !!files,
    fieldNames: files ? Object.keys(files) : [],
    contentType: req.headers["content-type"]
  }, "Parsed upload request");
  if (!files || Object.keys(files).length === 0) {
    logger.warn("Upload request contained no parseable files");
    return res.status(400).json({
      error: {
        message: "No files received. Ensure the request uses multipart/form-data.",
        status: 400
      }
    });
  }
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
      const url = saveLocally(file.buffer, file.originalname);
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
    logger.error({ err }, "Upload processing failed");
    throw err;
  }
  logger.info({ result }, "All uploads complete");
  return res.status(200).json({ status: 200, data: result });
});
export {
  upload_default as default
};
