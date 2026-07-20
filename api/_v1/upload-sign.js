import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { logger } from "../_utils/logger.js";
import crypto from "crypto";
var upload_sign_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method not allowed", status: 405 } });
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    logger.info("Cloudinary not configured \u2014 client will use local upload fallback");
    return res.status(200).json({ status: 200, data: { mode: "local" } });
  }
  const timestamp = Math.round(Date.now() / 1e3);
  const folder = process.env.CLOUDINARY_FOLDER || "kmlwj/members";
  const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(toSign).digest("hex");
  logger.info({ cloudName, folder, userId: req.user.id }, "Issued Cloudinary upload signature");
  return res.status(200).json({
    status: 200,
    data: { mode: "cloud", cloudName, apiKey, timestamp, signature, folder }
  });
});
export {
  upload_sign_default as default
};
