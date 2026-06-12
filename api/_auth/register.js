import { z } from "zod";
import { makeHandler } from "../_utils/handler.js";
import * as authService from "../_services/auth.service.js";
const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  name: z.string().optional(),
  fullName: z.string().optional(),
  role: z.string().optional()
});
var register_default = makeHandler(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  const validatedData = registerSchema.parse(req.body);
  const user = await authService.register(validatedData);
  return res.status(201).json({
    status: 201,
    message: "Registration successful",
    user
  });
});
export {
  register_default as default
};
