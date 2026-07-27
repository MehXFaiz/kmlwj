import { z } from 'zod';
import {
  sanitizedString,
  optionalSanitizedString,
  uuidSchema,
  optionalUuidSchema,
  nonNegativeAmountSchema,
  optionalNonNegativeAmountSchema,
  dateSchema,
  optionalDateSchema,
} from './common.schema.js';

export const accountSchema = z.object({
  code: sanitizedString({ min: 1, max: 20, fieldName: 'Account Code' }),
  name: sanitizedString({ min: 2, max: 100, fieldName: 'Account Name' }),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'], {
    errorMap: () => ({ message: 'Account type must be one of ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE' }),
  }),
  parentId: optionalUuidSchema,
  openingBalance: optionalNonNegativeAmountSchema.default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateAccountSchema = accountSchema.partial();

export const revenueHeadSchema = z.object({
  code: sanitizedString({ min: 1, max: 20, fieldName: 'Revenue Head Code' }),
  name: sanitizedString({ min: 2, max: 100, fieldName: 'Revenue Head Name' }),
  description: optionalSanitizedString({ max: 255, fieldName: 'Description' }),
  isActive: z.boolean().optional().default(true),
});

export const expenseHeadSchema = z.object({
  code: sanitizedString({ min: 1, max: 20, fieldName: 'Expense Head Code' }),
  name: sanitizedString({ min: 2, max: 100, fieldName: 'Expense Head Name' }),
  description: optionalSanitizedString({ max: 255, fieldName: 'Description' }),
  isActive: z.boolean().optional().default(true),
});

export const simpleExpenseSchema = z.object({
  expenseHeadId: uuidSchema,
  amount: nonNegativeAmountSchema,
  date: optionalDateSchema,
  paymentMethod: z.enum(['CASH', 'BANK', 'CHEQUE', 'ONLINE'], {
    errorMap: () => ({ message: 'Payment method must be CASH, BANK, CHEQUE, or ONLINE' }),
  }).optional().default('CASH'),
  paidTo: optionalSanitizedString({ max: 100, fieldName: 'Paid To' }),
  bankAccountId: optionalUuidSchema,
  reference: optionalSanitizedString({ max: 100, fieldName: 'Reference' }),
  description: optionalSanitizedString({ max: 500, fieldName: 'Description' }),
  accountNumber: optionalSanitizedString({ max: 50, fieldName: 'Account Number' }),
});

export const simpleIncomeSchema = z.object({
  revenueHeadId: uuidSchema,
  amount: nonNegativeAmountSchema,
  date: optionalDateSchema,
  paymentMethod: z.enum(['CASH', 'BANK', 'CHEQUE', 'ONLINE'], {
    errorMap: () => ({ message: 'Payment method must be CASH, BANK, CHEQUE, or ONLINE' }),
  }).optional().default('CASH'),
  receivedFrom: optionalSanitizedString({ max: 100, fieldName: 'Received From' }),
  bankAccountId: optionalUuidSchema,
  reference: optionalSanitizedString({ max: 100, fieldName: 'Reference' }),
  description: optionalSanitizedString({ max: 500, fieldName: 'Description' }),
  accountNumber: optionalSanitizedString({ max: 50, fieldName: 'Account Number' }),
});

export const revenueCollectionSchema = z.object({
  collectionType: sanitizedString({ min: 1, max: 50, fieldName: 'Collection Type' }),
  amount: nonNegativeAmountSchema,
  date: dateSchema,
  memberId: optionalUuidSchema,
  donorId: optionalUuidSchema,
  paymentMethod: z.enum(['CASH', 'BANK', 'CHEQUE', 'ONLINE'], {
    errorMap: () => ({ message: 'Payment method must be CASH, BANK, CHEQUE, or ONLINE' }),
  }),
  remarks: optionalSanitizedString({ max: 500, fieldName: 'Remarks' }),
});

export const journalEntryLineSchema = z.object({
  accountId: uuidSchema,
  debit: optionalNonNegativeAmountSchema.default(0),
  credit: optionalNonNegativeAmountSchema.default(0),
  description: optionalSanitizedString({ max: 255, fieldName: 'Line Description' }),
});

export const journalEntrySchema = z.object({
  date: dateSchema,
  description: sanitizedString({ min: 2, max: 500, fieldName: 'Journal Entry Description' }),
  reference: optionalSanitizedString({ max: 100, fieldName: 'Reference' }),
  lines: z.array(journalEntryLineSchema).min(2, 'Journal entry must have at least 2 lines'),
});
