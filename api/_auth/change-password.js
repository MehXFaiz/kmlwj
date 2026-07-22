import { z } from "zod";
import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import * as authService from "../_services/auth.service.js";
const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Old password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters long").regex(/[a-z]/, "Password must contain at least one lowercase letter").regex(/[A-Z]/, "Password must contain at least one uppercase letter").regex(/[0-9]/, "Password must contain at least one digit")
});
var change_password_default = makeHandler(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  const authenticated = await verifyAuth(req, res);
  if (!authenticated) return;
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: { message: "Unauthorized", status: 401 } });
  }
  const validatedData = changePasswordSchema.parse(req.body);
  await authService.changePassword(userId, validatedData);
  return res.status(200).json({
    status: 200,
    message: "Password changed successfully"
  });
});
export {
  change_password_default as default
};
