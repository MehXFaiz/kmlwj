import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore in environments where custom DNS servers cannot be bound
}

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL || process.env.DIRECT_URL || '';
}

export function getDatabaseType(): string {
  return 'postgres';
}

export function isMySQL(): boolean {
  return false;
}

export function isPostgres(): boolean {
  return true;
}

const connectionString = getDatabaseUrl();

if (!connectionString) {
  console.warn('[DATABASE WARNING] DATABASE_URL is not set in environment variables.');
}

const globalForDb = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: pg.Pool;
};

export const pool = globalForDb.pool ?? new pg.Pool({
  connectionString: connectionString || undefined,
  max: 20,
  idleTimeoutMillis: 10000,
  ssl: connectionString.includes('sslmode=require') || connectionString.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});

const adapter = connectionString ? new PrismaPg(pool) : undefined;

export const prisma = globalForDb.prisma ?? new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pool = pool;
  globalForDb.prisma = prisma;
}
