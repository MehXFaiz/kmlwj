import { z } from "zod";
const HTML_XSS_PATTERN = /<[^>]*>|javascript:|data:text\/html|on\w+\s*=/i;
const sanitizedString = (options = {}) => {
  const { min, max, fieldName = "Field", allowEmpty = false } = options;
  let schema = z.string().transform((val) => val.trim());
  if (!allowEmpty && min === void 0) {
    schema = schema.refine((val) => val.length > 0, {
      message: `${fieldName} cannot be empty`
    });
  }
  if (min !== void 0 && min > 0) {
    schema = schema.refine((val) => val.length >= min, {
      message: `${fieldName} must be at least ${min} characters`
    });
  }
  if (max !== void 0) {
    schema = schema.refine((val) => val.length <= max, {
      message: `${fieldName} must not exceed ${max} characters`
    });
  }
  schema = schema.refine((val) => !HTML_XSS_PATTERN.test(val), {
    message: `${fieldName} contains forbidden HTML or script injection tags`
  });
  return schema;
};
const optionalSanitizedString = (options = {}) => {
  const { max, fieldName = "Field" } = options;
  return z.preprocess(
    (val) => {
      if (val === null || val === void 0 || val === "") return void 0;
      if (typeof val === "string") return val.trim();
      return val;
    },
    z.string().max(max ?? 1e3, `${fieldName} must not exceed ${max ?? 1e3} characters`).refine((val) => !HTML_XSS_PATTERN.test(val), {
      message: `${fieldName} contains forbidden HTML or script injection tags`
    }).optional()
  );
};
const uuidSchema = z.string().trim().uuid({ message: "Invalid UUID format" });
const optionalUuidSchema = z.preprocess(
  (val) => val === null || val === void 0 || val === "" ? void 0 : val,
  z.string().trim().uuid({ message: "Invalid UUID format" }).optional()
);
const amountSchema = z.preprocess(
  (val) => {
    if (typeof val === "number") return val;
    if (typeof val === "string" && val.trim() !== "") {
      const parsed = Number(val.trim());
      return isNaN(parsed) ? val : parsed;
    }
    return val;
  },
  z.number({ message: "Amount must be a valid numeric value" }).finite({ message: "Amount must be a finite numeric value" })
);
const nonNegativeAmountSchema = amountSchema.refine((val) => val >= 0, {
  message: "Amount cannot be negative"
});
const positiveAmountSchema = amountSchema.refine((val) => val > 0, {
  message: "Amount must be greater than zero"
});
const optionalNonNegativeAmountSchema = z.preprocess(
  (val) => {
    if (val === null || val === void 0 || val === "") return void 0;
    if (typeof val === "number") return val;
    if (typeof val === "string" && val.trim() !== "") {
      const parsed = Number(val.trim());
      return isNaN(parsed) ? val : parsed;
    }
    return val;
  },
  z.number({ message: "Amount must be a valid numeric value" }).finite({ message: "Amount must be a finite numeric value" }).refine((val) => val >= 0, { message: "Amount cannot be negative" }).optional()
);
const cnicSchema = z.string().trim().refine((val) => {
  const digitsOnly = val.replace(/-/g, "");
  return /^\d{13}$/.test(digitsOnly) && /^\d{5}-?\d{7}-?\d{1}$/.test(val);
}, {
  message: "Invalid CNIC format. Must be 13 digits (e.g., 12345-1234567-1 or 1234512345671)"
});
const optionalCnicSchema = z.preprocess(
  (val) => val === null || val === void 0 || val === "" ? void 0 : val,
  cnicSchema.optional()
);
const phoneSchema = z.string().trim().refine((val) => {
  const digits = val.replace(/[\s\-\(\)\+]/g, "");
  return /^\d{10,15}$/.test(digits) && /^(\+92|92|0)?3\d{9}$|^\d{11}$|^\+?[1-9]\d{7,14}$/.test(val.replace(/[\s-]/g, ""));
}, {
  message: "Invalid phone number format (e.g., 03001234567 or +923001234567)"
});
const optionalPhoneSchema = z.preprocess(
  (val) => val === null || val === void 0 || val === "" ? void 0 : val,
  phoneSchema.optional()
);
const emailSchema = z.string().trim().toLowerCase().email({ message: "Invalid email address format" }).max(254, "Email must not exceed 254 characters");
const optionalEmailSchema = z.preprocess(
  (val) => val === null || val === void 0 || val === "" ? void 0 : val,
  emailSchema.optional()
);
const dateSchema = z.string().trim().refine((val) => {
  if (!val) return false;
  const parsedDate = new Date(val);
  if (isNaN(parsedDate.getTime())) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const parts = val.split("-").map(Number);
    return parsedDate.getUTCFullYear() === parts[0] && parsedDate.getUTCMonth() + 1 === parts[1] && parsedDate.getUTCDate() === parts[2];
  }
  return true;
}, {
  message: "Invalid date format or non-existent calendar date (e.g. YYYY-MM-DD)"
});
const optionalDateSchema = z.preprocess(
  (val) => val === null || val === void 0 || val === "" ? void 0 : val,
  dateSchema.optional()
);
const paginationQuerySchema = z.object({
  page: z.preprocess(
    (val) => val ? Number(val) : 1,
    z.number().int().min(1, "Page must be at least 1")
  ).optional().default(1),
  limit: z.preprocess(
    (val) => val ? Number(val) : 100,
    z.number().int().min(1, "Limit must be at least 1").max(500, "Limit cannot exceed 500")
  ).optional().default(100),
  search: optionalSanitizedString({ max: 100, fieldName: "Search query" })
});
export {
  amountSchema,
  cnicSchema,
  dateSchema,
  emailSchema,
  nonNegativeAmountSchema,
  optionalCnicSchema,
  optionalDateSchema,
  optionalEmailSchema,
  optionalNonNegativeAmountSchema,
  optionalPhoneSchema,
  optionalSanitizedString,
  optionalUuidSchema,
  paginationQuerySchema,
  phoneSchema,
  positiveAmountSchema,
  sanitizedString,
  uuidSchema
};
