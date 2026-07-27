import { z } from 'zod';
import {
  sanitizedString,
  optionalSanitizedString,
  optionalCnicSchema,
  optionalPhoneSchema,
  optionalEmailSchema,
  optionalDateSchema,
  uuidSchema,
} from './common.schema.js';

const urlOrPathSchema = z.string().trim().refine((val) => !val.startsWith('data:'), {
  message: 'Send an image URL, not Base64 data. Use /api/v1/upload first.',
}).optional();

export const createMemberSchema = z.object({
  memberNo: optionalSanitizedString({ max: 50, fieldName: 'Member No' }),
  fullName: sanitizedString({ min: 2, max: 100, fieldName: 'Full Member Name' }),
  fatherName: optionalSanitizedString({ max: 80, fieldName: 'Father Name' }),
  cnic: optionalCnicSchema,
  dob: optionalDateSchema,
  address: optionalSanitizedString({ max: 200, fieldName: 'Address' }),
  mobile: optionalPhoneSchema,
  email: optionalEmailSchema,
  city: optionalSanitizedString({ max: 80, fieldName: 'City' }),
  area: optionalSanitizedString({ max: 80, fieldName: 'Area' }),
  ghamName: optionalSanitizedString({ max: 80, fieldName: 'Gham Name' }),
  education: optionalSanitizedString({ max: 100, fieldName: 'Education' }),
  profession: optionalSanitizedString({ max: 100, fieldName: 'Profession' }),
  company: optionalSanitizedString({ max: 100, fieldName: 'Company' }),
  doi: optionalDateSchema,
  photoUrl: urlOrPathSchema,
  cnicFrontUrl: urlOrPathSchema,
  cnicBackUrl: urlOrPathSchema,
  isActive: z.boolean().optional().default(true),
});

export const updateMemberSchema = createMemberSchema.partial();

export const familyRelationshipSchema = z.object({
  headId: uuidSchema,
  relativeId: uuidSchema,
  relationshipType: z.enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER'], {
    errorMap: () => ({ message: 'Invalid relationship type enum' }),
  }),
});

export const zakatCardSchema = z.object({
  memberId: uuidSchema,
  cardNumber: sanitizedString({ min: 3, max: 50, fieldName: 'Card Number' }),
  expiryDate: optionalDateSchema,
  notes: optionalSanitizedString({ max: 500, fieldName: 'Notes' }),
});
