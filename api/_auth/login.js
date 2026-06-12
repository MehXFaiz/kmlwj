import { z } from "zod";
import { makeHandler } from "../_utils/handler.js";
import * as authService from "../_services/auth.service.js";
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required")
});
var login_default = makeHandler(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  const validatedData = loginSchema.parse(req.body);
  const result = await authService.login(validatedData);
  return res.status(200).json({
    status: 200,
    message: "Login successful",
    data: result
  });
});
export {
  login_default as default
};
