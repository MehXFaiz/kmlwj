import { z } from "zod";
import {
  sanitizedString,
  optionalSanitizedString,
  uuidSchema,
  optionalUuidSchema,
  nonNegativeAmountSchema,
  optionalNonNegativeAmountSchema,
  optionalCnicSchema,
  phoneSchema,
  optionalPhoneSchema,
  emailSchema,
  optionalEmailSchema,
  dateSchema,
  optionalDateSchema
} from "./common.schema.js";
const hallBookingSchema = z.object({
  hallName: sanitizedString({ min: 2, max: 100, fieldName: "Hall Name" }),
  eventDate: dateSchema,
  slot: z.enum(["MORNING", "AFTERNOON", "EVENING", "FULL_DAY"], {
    errorMap: () => ({ message: "Slot must be MORNING, AFTERNOON, EVENING, or FULL_DAY" })
  }),
  customerName: sanitizedString({ min: 2, max: 100, fieldName: "Customer Name" }),
  customerPhone: phoneSchema,
  cnic: optionalCnicSchema,
  amount: nonNegativeAmountSchema,
  advancePaid: optionalNonNegativeAmountSchema.default(0),
  status: z.enum(["BOOKED", "CONFIRMED", "CANCELLED", "COMPLETED"], {
    errorMap: () => ({ message: "Status must be BOOKED, CONFIRMED, CANCELLED, or COMPLETED" })
  }).optional().default("BOOKED"),
  notes: optionalSanitizedString({ max: 500, fieldName: "Notes" })
});
const customerSchema = z.object({
  name: sanitizedString({ min: 2, max: 100, fieldName: "Customer Name" }),
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
  cnic: optionalCnicSchema,
  address: optionalSanitizedString({ max: 200, fieldName: "Address" }),
  city: optionalSanitizedString({ max: 80, fieldName: "City" }),
  company: optionalSanitizedString({ max: 100, fieldName: "Company" })
});
const invoiceItemSchema = z.object({
  description: sanitizedString({ min: 1, max: 200, fieldName: "Item Description" }),
  quantity: z.preprocess(
    (val) => typeof val === "string" && val.trim() !== "" ? Number(val) : val,
    z.number().positive("Quantity must be greater than zero")
  ),
  unitPrice: nonNegativeAmountSchema
});
const invoiceSchema = z.object({
  customerId: uuidSchema,
  invoiceDate: dateSchema,
  dueDate: optionalDateSchema,
  totalAmount: nonNegativeAmountSchema,
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"], {
    errorMap: () => ({ message: "Invoice status must be DRAFT, SENT, PAID, OVERDUE, or CANCELLED" })
  }).optional().default("DRAFT"),
  items: z.array(invoiceItemSchema).min(1, "Invoice must contain at least 1 item").optional(),
  notes: optionalSanitizedString({ max: 500, fieldName: "Notes" })
});
const userCreateSchema = z.object({
  email: emailSchema,
  fullName: sanitizedString({ min: 2, max: 100, fieldName: "Full Name" }),
  roleId: uuidSchema,
  password: z.string().min(8, "Password must be at least 8 characters long").optional(),
  isActive: z.boolean().optional().default(true)
});
const userUpdateSchema = z.object({
  email: optionalEmailSchema,
  fullName: optionalSanitizedString({ max: 100, fieldName: "Full Name" }),
  roleId: optionalUuidSchema,
  isActive: z.boolean().optional()
});
const roleSchema = z.object({
  name: sanitizedString({ min: 2, max: 50, fieldName: "Role Name" }),
  description: optionalSanitizedString({ max: 200, fieldName: "Description" }),
  permissionIds: z.array(uuidSchema).optional().default([])
});
const reservedCodeSchema = z.object({
  code: sanitizedString({ min: 1, max: 20, fieldName: "Code" }),
  description: optionalSanitizedString({ max: 200, fieldName: "Description" }),
  category: optionalSanitizedString({ max: 50, fieldName: "Category" })
});
export {
  customerSchema,
  hallBookingSchema,
  invoiceItemSchema,
  invoiceSchema,
  reservedCodeSchema,
  roleSchema,
  userCreateSchema,
  userUpdateSchema
};
