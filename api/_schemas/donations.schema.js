import { z } from "zod";
import {
  sanitizedString,
  optionalSanitizedString,
  uuidSchema,
  optionalUuidSchema,
  nonNegativeAmountSchema,
  optionalNonNegativeAmountSchema,
  optionalCnicSchema,
  optionalPhoneSchema,
  optionalEmailSchema,
  dateSchema,
  optionalDateSchema
} from "./common.schema.js";
const beneficiarySchema = z.object({
  fullName: sanitizedString({ min: 2, max: 100, fieldName: "Full Name" }),
  cnic: optionalCnicSchema,
  mobile: optionalPhoneSchema,
  address: optionalSanitizedString({ max: 200, fieldName: "Address" }),
  city: optionalSanitizedString({ max: 80, fieldName: "City" }),
  area: optionalSanitizedString({ max: 80, fieldName: "Area" }),
  familyMembers: z.preprocess(
    (val) => val === void 0 || val === null || val === "" ? void 0 : Number(val),
    z.number().int().min(0, "Family members count cannot be negative").optional()
  ),
  monthlyIncome: optionalNonNegativeAmountSchema,
  zakatEligible: z.boolean().optional().default(true),
  status: z.enum(["PENDING", "VERIFIED", "APPROVED", "REJECTED"], {
    errorMap: () => ({ message: "Status must be PENDING, VERIFIED, APPROVED, or REJECTED" })
  }).optional().default("PENDING"),
  notes: optionalSanitizedString({ max: 500, fieldName: "Notes" })
});
const donorSchema = z.object({
  name: sanitizedString({ min: 2, max: 100, fieldName: "Donor Name" }),
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
  cnic: optionalCnicSchema,
  address: optionalSanitizedString({ max: 200, fieldName: "Address" }),
  city: optionalSanitizedString({ max: 80, fieldName: "City" }),
  donorType: z.enum(["INDIVIDUAL", "CORPORATE", "ORGANIZATION"], {
    errorMap: () => ({ message: "Donor type must be INDIVIDUAL, CORPORATE, or ORGANIZATION" })
  }).optional().default("INDIVIDUAL"),
  notes: optionalSanitizedString({ max: 500, fieldName: "Notes" })
});
const donationSchema = z.object({
  beneficiaryId: uuidSchema,
  amount: nonNegativeAmountSchema,
  category: sanitizedString({ min: 2, max: 50, fieldName: "Donation Category" }),
  status: z.enum(["PENDING", "APPROVED", "DISBURSED", "REJECTED"], {
    errorMap: () => ({ message: "Donation status must be PENDING, APPROVED, DISBURSED, or REJECTED" })
  }).optional().default("PENDING"),
  requestDate: optionalDateSchema,
  disbursementDate: optionalDateSchema,
  notes: optionalSanitizedString({ max: 500, fieldName: "Notes" })
});
const donationReceivedSchema = z.object({
  donorId: optionalUuidSchema,
  amount: nonNegativeAmountSchema,
  category: sanitizedString({ min: 2, max: 50, fieldName: "Category" }),
  paymentMethod: z.enum(["CASH", "BANK", "CHEQUE", "ONLINE"], {
    errorMap: () => ({ message: "Payment method must be CASH, BANK, CHEQUE, or ONLINE" })
  }),
  receiptNo: optionalSanitizedString({ max: 50, fieldName: "Receipt No" }),
  date: dateSchema,
  notes: optionalSanitizedString({ max: 500, fieldName: "Notes" })
});
export {
  beneficiarySchema,
  donationReceivedSchema,
  donationSchema,
  donorSchema
};
