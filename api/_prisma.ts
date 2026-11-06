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
 * Checks whether a Prisma `where` clause already contains an explicit `isDeleted` filter
 * at the top level or inside logical combinators (`AND`, `OR`, `NOT`).
 */
function hasExplicitIsDeletedFilter(where: any): boolean {
  if (!where || typeof where !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(where, 'isDeleted') && where.isDeleted !== undefined) {
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

const READ_ACTIONS_WITH_WHERE = new Set<string>([
  'findMany',
  'findFirst',
  'count',
  'aggregate',
  'groupBy',
]);

function attachSoftDeleteProtection(client: PrismaClient): PrismaClient {
  if ((client as any).__softDeleteAttached) {
    return client;
  }
  (client as any).__softDeleteAttached = true;

  if (typeof (client as any).$use === 'function') {
    (client as any).$use(async (params: any, next: (p: any) => Promise<any>) => {
      const model = params.model;
      const action = params.action;

      if (model && SOFT_DELETE_MODELS.has(model)) {
        const ctx = softDeleteAsyncContext.getStore();

        if (READ_ACTIONS_WITH_WHERE.has(action) && !ctx?.includeDeleted) {
          params.args = params.args || {};
          if (!hasExplicitIsDeletedFilter(params.args.where)) {
            params.args.where = {
              ...params.args.where,
              isDeleted: false,
            };
          }
        }
      }

      return next(params);
    });
  }

  return client;
}

const globalForDb = globalThis as unknown as {
  prisma?: PrismaClient;
};

const baseClient =
  globalForDb.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

export const prisma = attachSoftDeleteProtection(baseClient);

if (process.env.NODE_ENV !== 'production') {
  globalForDb.prisma = prisma;
}

export default prisma;
