import { z } from "zod";
import { makeHandler } from "../_utils/handler.js";
import * as authService from "../_services/auth.service.js";
const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required")
});
var refresh_default = makeHandler(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  const validatedData = refreshSchema.parse(req.body);
  const result = await authService.rotateTokens(validatedData.refreshToken);
  return res.status(200).json({
    status: 200,
    message: "Token refreshed",
    data: result
  });
});
export {
  refresh_default as default
};
