import { makeHandler } from "../_utils/handler.js";
import { loginSchema } from "../_schemas/auth.schema.js";
import * as authService from "../_services/auth.service.js";
import { logAudit } from "../_utils/audit.js";
import { logger } from "../_utils/logger.js";
import { setRefreshTokenCookie } from "../_utils/cookies.js";
var login_default = makeHandler(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  const validatedData = loginSchema.parse(req.body);
  const result = await authService.login(validatedData);
  logger.info({ userId: result.user.id, status: 200 }, "Login response status");
  await logAudit(
    result.user.id,
    "User Login",
    "AUTH",
    null,
    null,
    req.headers["x-forwarded-for"],
    req.headers["user-agent"]
  );
  setRefreshTokenCookie(res, result.refreshToken);
  return res.status(200).json({
    status: 200,
    message: "Login successful",
    data: {
      accessToken: result.accessToken,
      user: result.user
    }
  });
});
export {
  login_default as default
};
