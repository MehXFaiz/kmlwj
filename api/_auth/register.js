import { z } from "zod";
import { makeHandler } from "../_utils/handler.js";
import * as authService from "../_services/auth.service.js";
const passwordSchema = z.string().min(8, "Password must be at least 8 characters long").regex(/[a-z]/, "Password must contain at least one lowercase letter").regex(/[A-Z]/, "Password must contain at least one uppercase letter").regex(/[0-9]/, "Password must contain at least one digit");
const nameSchema = z.string().trim().min(3, "Name must be at least 3 characters").max(50, "Name must be at most 50 characters").regex(/^[a-zA-Z\s.-]+$/, "Name must contain only letters, spaces, hyphens, and dots").optional();
const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
  name: nameSchema,
  fullName: nameSchema,
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
