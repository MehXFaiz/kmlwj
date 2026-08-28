import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Gracefully ignore custom DNS failures on restricted hosting environments
}

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForDb = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: pg.Pool;
};

const connectionString = process.env.DATABASE_URL || '';
if (!connectionString) {
  console.warn('[DATABASE WARNING] DATABASE_URL is not set in environment variables.');
}

export const pool = globalForDb.pool ?? new pg.Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 10000,
  ssl: connectionString.includes('sslmode=require') || connectionString.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});

const adapter = new PrismaPg(pool);

export const prisma = globalForDb.prisma ?? new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pool = pool;
  globalForDb.prisma = prisma;
}
