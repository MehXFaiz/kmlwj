import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const globalForDb = globalThis as unknown as {
  prisma?: PrismaClient;
};

const connectionString = process.env.DATABASE_URL || '';
if (!connectionString) {
  console.warn('[DATABASE WARNING] DATABASE_URL is not set in environment variables.');
}

export const prisma = globalForDb.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.prisma = prisma;
}

