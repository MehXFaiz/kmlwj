import { z } from "zod";
import {
  sanitizedString,
  optionalSanitizedString,
  optionalCnicSchema,
  optionalPhoneSchema,
  optionalEmailSchema,
  optionalDateSchema,
  uuidSchema
} from "./common.schema.js";
const urlOrPathSchema = z.preprocess(
  (val) => val === null || val === void 0 || val === "" ? void 0 : val,
  z.string().trim().refine((val) => !val.startsWith("data:"), {
    message: "Send an image URL, not Base64 data. Use /api/v1/upload first."
  }).optional()
);
const createMemberSchema = z.object({
  memberNo: optionalSanitizedString({ max: 50, fieldName: "Member No" }),
  fullName: sanitizedString({ min: 2, max: 100, fieldName: "Full Member Name" }),
  fatherName: sanitizedString({ min: 2, max: 80, fieldName: "Father's Name" }),
  cnic: optionalCnicSchema,
  dob: optionalDateSchema,
  address: optionalSanitizedString({ max: 200, fieldName: "Address" }),
  mobile: optionalPhoneSchema,
  email: optionalEmailSchema,
  city: optionalSanitizedString({ max: 80, fieldName: "City" }),
  area: optionalSanitizedString({ max: 80, fieldName: "Area" }),
  ghamName: optionalSanitizedString({ max: 80, fieldName: "Gham Name" }),
  education: optionalSanitizedString({ max: 100, fieldName: "Education" }),
  profession: optionalSanitizedString({ max: 100, fieldName: "Profession" }),
  company: optionalSanitizedString({ max: 100, fieldName: "Company" }),
  doi: optionalDateSchema,
  photoUrl: urlOrPathSchema,
  cnicFrontUrl: urlOrPathSchema,
  cnicBackUrl: urlOrPathSchema,
  isActive: z.boolean().optional().default(true),
  membershipType: optionalSanitizedString({ max: 50, fieldName: "Membership Type" }),
  feeAmount: z.preprocess((val) => val === "" || val === null || val === void 0 ? void 0 : Number(val), z.number().min(0).optional()),
  startDate: optionalDateSchema,
  expiryDate: optionalDateSchema,
  initialPayment: z.preprocess((val) => val === "" || val === null || val === void 0 ? 0 : Number(val), z.number().min(0).optional()),
  paymentMethod: z.enum(["CASH", "BANK", "CHEQUE"]).optional(),
  bankAccountId: optionalSanitizedString({ max: 100, fieldName: "Bank Account" }),
  chequeNumber: optionalSanitizedString({ max: 50, fieldName: "Cheque Number" })
});
const updateMemberSchema = createMemberSchema.partial();
const familyRelationshipSchema = z.object({
  headId: uuidSchema,
  relativeId: uuidSchema,
  relationshipType: z.enum(["SPOUSE", "CHILD", "PARENT", "SIBLING", "OTHER"])
});
const zakatCardSchema = z.object({
  memberId: uuidSchema,
  cardNumber: sanitizedString({ min: 3, max: 50, fieldName: "Card Number" }),
  expiryDate: optionalDateSchema,
  notes: optionalSanitizedString({ max: 500, fieldName: "Notes" })
});
export {
  createMemberSchema,
  familyRelationshipSchema,
  updateMemberSchema,
  zakatCardSchema
};
