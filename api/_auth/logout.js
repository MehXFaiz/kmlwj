import { makeHandler } from "../_utils/handler.js";
import * as authService from "../_services/auth.service.js";
import { logAudit } from "../_utils/audit.js";
var logout_default = makeHandler(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  const { refreshToken } = req.body;
  if (refreshToken) {
    const userId = await authService.logout(refreshToken);
    if (userId) {
      await logAudit(
        userId,
        "User Logout",
        "AUTH",
        null,
        null,
        req.headers["x-forwarded-for"],
        req.headers["user-agent"]
      );
    }
  }
  return res.status(200).json({
    status: 200,
    message: "Logout successful"
  });
});
export {
  logout_default as default
};
