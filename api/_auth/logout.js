import { makeHandler } from "../_utils/handler.js";
import * as authService from "../_services/auth.service.js";
var logout_default = makeHandler(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  const { refreshToken } = req.body;
  if (refreshToken) {
    await authService.logout(refreshToken);
  }
  return res.status(200).json({
    status: 200,
    message: "Logout successful"
  });
});
export {
  logout_default as default
};
