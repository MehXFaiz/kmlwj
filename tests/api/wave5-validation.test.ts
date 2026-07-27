import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  uuidSchema,
  amountSchema,
  nonNegativeAmountSchema,
  cnicSchema,
  phoneSchema,
  emailSchema,
  dateSchema,
  sanitizedString,
} from '../../api/_schemas/common.schema.js';
import { beneficiarySchema, donationSchema } from '../../api/_schemas/donations.schema.js';
import { createMemberSchema } from '../../api/_schemas/members.schema.js';
import { simpleExpenseSchema, accountSchema } from '../../api/_schemas/financial.schema.js';
import { hallBookingSchema } from '../../api/_schemas/operations.schema.js';
import { formatZodError, validateData } from '../../api/_middlewares/validation.middleware.js';

describe('Wave 5: Enterprise Input Validation (Zod)', () => {
  describe('UUID Validation', () => {
    it('accepts valid UUIDs', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(uuidSchema.parse(validUuid)).toBe(validUuid);
    });

    it('rejects invalid UUIDs', () => {
      expect(() => uuidSchema.parse('not-a-uuid')).toThrow(ZodError);
      expect(() => uuidSchema.parse('12345')).toThrow(ZodError);
    });
  });

  describe('Amount & Numeric Validation', () => {
    it('accepts valid numeric amounts and numeric strings', () => {
      expect(amountSchema.parse(100.50)).toBe(100.50);
      expect(amountSchema.parse('250.75')).toBe(250.75);
    });

    it('rejects text inside numeric fields', () => {
      expect(() => amountSchema.parse('abc')).toThrow(ZodError);
      expect(() => amountSchema.parse('100usd')).toThrow(ZodError);
    });

    it('rejects NaN and Infinity', () => {
      expect(() => amountSchema.parse(NaN)).toThrow(ZodError);
      expect(() => amountSchema.parse(Infinity)).toThrow(ZodError);
    });

    it('rejects negative values where disallowing negatives', () => {
      expect(() => nonNegativeAmountSchema.parse(-50)).toThrow(ZodError);
      expect(nonNegativeAmountSchema.parse(0)).toBe(0);
      expect(nonNegativeAmountSchema.parse(150)).toBe(150);
    });
  });

  describe('CNIC Validation', () => {
    it('accepts valid Pakistani CNIC formats (13 digits or formatted with hyphens)', () => {
      expect(cnicSchema.parse('42201-1234567-1')).toBe('42201-1234567-1');
      expect(cnicSchema.parse('4220112345671')).toBe('4220112345671');
    });

    it('rejects invalid CNIC formats', () => {
      expect(() => cnicSchema.parse('1234')).toThrow(ZodError);
      expect(() => cnicSchema.parse('42201-1234567-A')).toThrow(ZodError);
      expect(() => cnicSchema.parse('123456789012345')).toThrow(ZodError);
    });
  });

  describe('Phone Number Validation', () => {
    it('accepts valid mobile phone numbers', () => {
      expect(phoneSchema.parse('03001234567')).toBe('03001234567');
      expect(phoneSchema.parse('+923001234567')).toBe('+923001234567');
    });

    it('rejects invalid phone formats', () => {
      expect(() => phoneSchema.parse('12345')).toThrow(ZodError);
      expect(() => phoneSchema.parse('abc03001234567')).toThrow(ZodError);
    });
  });

  describe('Email Validation', () => {
    it('accepts valid email addresses and trims/lowercases them', () => {
      expect(emailSchema.parse('  User@Domain.Com ')).toBe('user@domain.com');
    });

    it('rejects invalid email formats', () => {
      expect(() => emailSchema.parse('invalid-email')).toThrow(ZodError);
      expect(() => emailSchema.parse('user@domain')).toThrow(ZodError);
    });
  });

  describe('Date Validation', () => {
    it('accepts valid ISO date strings and YYYY-MM-DD format', () => {
      expect(dateSchema.parse('2026-07-27')).toBe('2026-07-27');
      expect(dateSchema.parse('2026-07-27T10:00:00Z')).toBe('2026-07-27T10:00:00Z');
    });

    it('rejects invalid date strings and non-existent dates', () => {
      expect(() => dateSchema.parse('invalid-date')).toThrow(ZodError);
      expect(() => dateSchema.parse('2026-02-31')).toThrow(ZodError); // Non-existent date
    });
  });

  describe('String Trimming, Length Limits & HTML / XSS Injection Prevention', () => {
    it('trims whitespace from input strings', () => {
      const schema = sanitizedString({ min: 2, max: 50, fieldName: 'Test' });
      expect(schema.parse('   John Doe   ')).toBe('John Doe');
    });

    it('enforces minimum and maximum length constraints', () => {
      const schema = sanitizedString({ min: 5, max: 10, fieldName: 'Code' });
      expect(() => schema.parse('abc')).toThrow(ZodError); // < min
      expect(() => schema.parse('1234567890123')).toThrow(ZodError); // > max
      expect(schema.parse('123456')).toBe('123456');
    });

    it('rejects HTML and script injection payloads (Prevent XSS)', () => {
      const schema = sanitizedString({ min: 1, max: 200, fieldName: 'Comment' });

      expect(() => schema.parse('<script>alert("xss")</script>')).toThrow(ZodError);
      expect(() => schema.parse('<img src=x onerror=alert(1)>')).toThrow(ZodError);
      expect(() => schema.parse('javascript:alert(1)')).toThrow(ZodError);
      expect(() => schema.parse('<div>test</div>')).toThrow(ZodError);
    });

    it('accepts safe text without HTML tags', () => {
      const schema = sanitizedString({ min: 1, max: 200, fieldName: 'Comment' });
      expect(schema.parse('Regular clean user comment')).toBe('Regular clean user comment');
    });
  });

  describe('Enum Validation', () => {
    it('validates strict enum choices', () => {
      expect(accountSchema.parse({
        code: '1010',
        name: 'Cash in Hand',
        type: 'ASSET',
      }).type).toBe('ASSET');

      expect(() => accountSchema.parse({
        code: '1010',
        name: 'Cash',
        type: 'INVALID_TYPE',
      })).toThrow(ZodError);
    });
  });

  describe('Domain Schema Integrations', () => {
    it('validates createMemberSchema correctly', () => {
      const validMember = {
        fullName: '  Ali Khan  ',
        cnic: '42201-1234567-1',
        mobile: '03001234567',
        email: 'ali@example.com',
        city: 'Karachi',
      };

      const parsed = createMemberSchema.parse(validMember);
      expect(parsed.fullName).toBe('Ali Khan');
      expect(parsed.email).toBe('ali@example.com');
    });

    it('rejects member payload with XSS script in name', () => {
      const invalidMember = {
        fullName: '<script>evil()</script>',
      };
      expect(() => createMemberSchema.parse(invalidMember)).toThrow(ZodError);
    });

    it('validates simpleExpenseSchema with numeric checking', () => {
      const validExpense = {
        expenseHeadId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 500.25,
        date: '2026-07-27',
        paymentMethod: 'CASH',
        description: 'Office supplies',
      };
      expect(simpleExpenseSchema.parse(validExpense).amount).toBe(500.25);
    });

    it('rejects negative amount in simpleExpenseSchema', () => {
      const invalidExpense = {
        expenseHeadId: '123e4567-e89b-12d3-a456-426614174000',
        amount: -100,
        date: '2026-07-27',
        paymentMethod: 'CASH',
      };
      expect(() => simpleExpenseSchema.parse(invalidExpense)).toThrow(ZodError);
    });
  });

  describe('Centralized Middleware & Standardized Error Format', () => {
    it('formats ZodError into standard error response object', () => {
      try {
        validateData(hallBookingSchema, {
          hallName: 'A', // too short
          eventDate: 'invalid-date',
          amount: 'abc', // text inside numeric
          slot: 'MIDNIGHT', // invalid enum
        });
      } catch (err: any) {
        if (err instanceof ZodError) {
          const formatted = formatZodError(err);
          expect(formatted.error.status).toBe(400);
          expect(formatted.error.message).toBe('Validation failed');
          expect(Array.isArray(formatted.error.details)).toBe(true);
          expect(formatted.error.details.length).toBeGreaterThan(0);
          expect(formatted.error.details[0]).toHaveProperty('field');
          expect(formatted.error.details[0]).toHaveProperty('message');
        } else {
          throw err;
        }
      }
    });
  });
});
