import { z } from 'zod';

// HTML / XSS Injection pattern detector
const HTML_XSS_PATTERN = /<[^>]*>|javascript:|data:text\/html|on\w+\s*=/i;

/**
 * Validates and trims text strings while preventing HTML and XSS script injections.
 */
export const sanitizedString = (options: { min?: number; max?: number; fieldName?: string; allowEmpty?: boolean } = {}) => {
  const { min, max, fieldName = 'Field', allowEmpty = false } = options;

  let schema = z.string().transform((val) => val.trim());

  if (!allowEmpty && min === undefined) {
    schema = schema.refine((val) => val.length > 0, {
      message: `${fieldName} cannot be empty`,
    }) as any;
  }

  if (min !== undefined && min > 0) {
    schema = schema.refine((val) => val.length >= min, {
      message: `${fieldName} must be at least ${min} characters`,
    }) as any;
  }

  if (max !== undefined) {
    schema = schema.refine((val) => val.length <= max, {
      message: `${fieldName} must not exceed ${max} characters`,
    }) as any;
  }

  schema = schema.refine((val) => !HTML_XSS_PATTERN.test(val), {
    message: `${fieldName} contains forbidden HTML or script injection tags`,
  }) as any;

  return schema;
};

/**
 * Optional sanitized string schema (allows undefined / null / empty string).
 */
export const optionalSanitizedString = (options: { max?: number; fieldName?: string } = {}) => {
  const { max, fieldName = 'Field' } = options;

  return z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return undefined;
      if (typeof val === 'string') return val.trim();
      return val;
    },
    z.string()
      .max(max ?? 1000, `${fieldName} must not exceed ${max ?? 1000} characters`)
      .refine((val) => !HTML_XSS_PATTERN.test(val), {
        message: `${fieldName} contains forbidden HTML or script injection tags`,
      })
      .optional()
  );
};

/**
 * ID Schema — Supports both MongoDB 24-character ObjectIds and standard UUIDs
 */
const ID_PATTERN = /^[0-9a-fA-F]{24}$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const idSchema = z.string().trim().refine((val) => ID_PATTERN.test(val), {
  message: 'Invalid ID format',
});

export const uuidSchema = idSchema;

export const optionalIdSchema = z.preprocess(
  (val) => (val === null || val === undefined || val === '' ? undefined : val),
  idSchema.optional()
);

export const optionalUuidSchema = optionalIdSchema;

/**
 * Amount & Numeric Schemas
 */
export const amountSchema = z.preprocess(
  (val) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string' && val.trim() !== '') {
      const parsed = Number(val.trim());
      return isNaN(parsed) ? val : parsed;
    }
    return val;
  },
  z.number({ message: 'Amount must be a valid numeric value' })
    .finite({ message: 'Amount must be a finite numeric value' })
);

export const nonNegativeAmountSchema = amountSchema.refine((val) => val >= 0, {
  message: 'Amount cannot be negative',
});

export const positiveAmountSchema = amountSchema.refine((val) => val > 0, {
  message: 'Amount must be greater than zero',
});

/**
 * Optional Non-negative Amount Schema
 */
export const optionalNonNegativeAmountSchema = z.preprocess(
  (val) => {
    if (val === null || val === undefined || val === '') return undefined;
    if (typeof val === 'number') return val;
    if (typeof val === 'string' && val.trim() !== '') {
      const parsed = Number(val.trim());
      return isNaN(parsed) ? val : parsed;
    }
    return val;
  },
  z.number({ message: 'Amount must be a valid numeric value' })
    .finite({ message: 'Amount must be a finite numeric value' })
    .refine((val) => val >= 0, { message: 'Amount cannot be negative' })
    .optional()
);

/**
 * CNIC Schema (Pakistani CNIC: 13 digits, optional hyphens e.g. 12345-1234567-1 or 1234512345671)
 */
export const cnicSchema = z.string().trim().refine((val) => {
  const digitsOnly = val.replace(/-/g, '');
  return /^\d{13}$/.test(digitsOnly) && /^\d{5}-?\d{7}-?\d{1}$/.test(val);
}, {
  message: 'Invalid CNIC format. Must be 13 digits (e.g., 12345-1234567-1 or 1234512345671)',
});

export const optionalCnicSchema = z.preprocess(
  (val) => (val === null || val === undefined || val === '' ? undefined : val),
  cnicSchema.optional()
);

/**
 * Phone Schema (Pakistani / International phone format)
 */
export const phoneSchema = z.string().trim().refine((val) => {
  const digits = val.replace(/[\s\-\(\)\+]/g, '');
  return /^\d{10,15}$/.test(digits) && /^(\+92|92|0)?3\d{9}$|^\d{11}$|^\+?[1-9]\d{7,14}$/.test(val.replace(/[\s-]/g, ''));
}, {
  message: 'Invalid phone number format (e.g., 03001234567 or +923001234567)',
});

export const optionalPhoneSchema = z.preprocess(
  (val) => (val === null || val === undefined || val === '' ? undefined : val),
  phoneSchema.optional()
);

/**
 * Email Schema
 */
export const emailSchema = z.string().trim().toLowerCase().email({ message: 'Invalid email address format' }).max(254, 'Email must not exceed 254 characters');

export const optionalEmailSchema = z.preprocess(
  (val) => (val === null || val === undefined || val === '' ? undefined : val),
  emailSchema.optional()
);

/**
 * Date Schema (ISO date string or YYYY-MM-DD format, rejecting invalid dates)
 */
export const dateSchema = z.string().trim().refine((val) => {
  if (!val) return false;
  const parsedDate = new Date(val);
  if (isNaN(parsedDate.getTime())) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const parts = val.split('-').map(Number);
    return parsedDate.getUTCFullYear() === parts[0] &&
           parsedDate.getUTCMonth() + 1 === parts[1] &&
           parsedDate.getUTCDate() === parts[2];
  }
  return true;
}, {
  message: 'Invalid date format or non-existent calendar date (e.g. YYYY-MM-DD)',
});

export const optionalDateSchema = z.preprocess(
  (val) => (val === null || val === undefined || val === '' ? undefined : val),
  dateSchema.optional()
);

/**
 * Pagination Query Parameters Schema
 */
export const paginationQuerySchema = z.object({
  page: z.preprocess(
    (val) => (val ? Number(val) : 1),
    z.number().int().min(1, 'Page must be at least 1')
  ).optional().default(1),
  limit: z.preprocess(
    (val) => (val ? Number(val) : 100),
    z.number().int().min(1, 'Limit must be at least 1').max(500, 'Limit cannot exceed 500')
  ).optional().default(100),
  search: optionalSanitizedString({ max: 100, fieldName: 'Search query' }),
});
