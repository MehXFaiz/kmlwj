import { z } from "zod";
import { emailSchema, sanitizedString } from "./common.schema.js";
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required")
});
const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters long"),
  fullName: sanitizedString({ min: 2, max: 100, fieldName: "Full Name" }),
  roleId: z.string().uuid("Invalid role ID format").optional()
});
const forgotPasswordSchema = z.object({
  email: emailSchema
});
const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters long")
});
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters long")
});
export {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema
};
