import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore in environments where setting DNS servers is not allowed
}

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { AsyncLocalStorage } from 'async_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

import { PrismaClient } from '@prisma/client';

/**
 * Models in schema.prisma that support centralized soft deletion
 * (`isDeleted`, `deletedAt`, `deletedBy`).
 */
export const SOFT_DELETE_MODELS = new Set<string>([
  'User',
  'Account',
  'ReservedCode',
  'RevenueHead',
  'ExpenseHead',
  'JournalEntry',
  'Beneficiary',
  'Donation',
  'SimpleIncome',
  'IncomeCategory',
  'AddIncomeRecord',
  'SimpleExpense',
  'HallBooking',
  'Customer',
  'Invoice',
  'RevenueCollection',
  'Member',
  'FamilyRelationship',
  'ZakatCard',
  'Donor',
  'DonationReceived',
  'PettyCashTransaction',
]);

export interface SoftDeleteQueryContext {
  includeDeleted?: boolean;
  allowPermanentDelete?: boolean;
}

export const softDeleteAsyncContext = new AsyncLocalStorage<SoftDeleteQueryContext>();

/**
 * Checks whether a Prisma `where` clause already contains an explicit `isDeleted` key
 * (including `{ isDeleted: undefined }` from `getDeletedFilter({ includeDeleted: true })`)
 * at the top level or inside logical combinators (`AND`, `OR`, `NOT`).
 */
function hasExplicitIsDeletedFilter(where: any): boolean {
  if (!where || typeof where !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(where, 'isDeleted')) {
    return true;
  }
  for (const key of ['AND', 'OR', 'NOT']) {
    const branch = where[key];
    if (Array.isArray(branch)) {
      if (branch.some((item) => hasExplicitIsDeletedFilter(item))) return true;
    } else if (branch && typeof branch === 'object') {
      if (hasExplicitIsDeletedFilter(branch)) return true;
    }
  }
  return false;
}

function applyDefaultSoftDeleteWhere(model: string | undefined, args: any): any {
  if (!model || !SOFT_DELETE_MODELS.has(model)) return args;
  const ctx = softDeleteAsyncContext.getStore();
  if (ctx?.includeDeleted) return args;

  const nextArgs = args ? { ...args } : {};
  if (!hasExplicitIsDeletedFilter(nextArgs.where)) {
    nextArgs.where = {
      ...(nextArgs.where || {}),
      isDeleted: false,
    };
  } else if (nextArgs.where && Object.prototype.hasOwnProperty.call(nextArgs.where, 'isDeleted') && nextArgs.where.isDeleted === undefined) {
    const cleanWhere = { ...nextArgs.where };
    delete cleanWhere.isDeleted;
    nextArgs.where = cleanWhere;
  }
  return nextArgs;
}

function createProtectedPrismaClient(): PrismaClient {
  const baseClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  const extended = baseClient.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          return query(applyDefaultSoftDeleteWhere(model, args));
        },
        async findFirst({ model, args, query }) {
          return query(applyDefaultSoftDeleteWhere(model, args));
        },
        async count({ model, args, query }) {
          return query(applyDefaultSoftDeleteWhere(model, args));
        },
        async aggregate({ model, args, query }) {
          return query(applyDefaultSoftDeleteWhere(model, args));
        },
        async groupBy({ model, args, query }) {
          return query(applyDefaultSoftDeleteWhere(model, args));
        },
      },
    },
  });

  return extended as unknown as PrismaClient;
}

const globalForDb = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForDb.prisma ?? createProtectedPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.prisma = prisma;
}

export default prisma;
