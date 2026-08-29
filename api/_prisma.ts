import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore in environments where custom DNS servers cannot be bound
}

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import mysql from 'mysql2/promise';

/**
 * Resolves the active MySQL connection URL based on either:
 * 1. process.env.DATABASE_URL (e.g. mysql://user:pass@host:port/dbname)
 * 2. Individual GoDaddy cPanel variables (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)
 */
export function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mysql://')) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '3306';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'kmlwj_erp';

  if (host && user && database) {
    const encodedUser = encodeURIComponent(user);
    const encodedPassword = password ? encodeURIComponent(password) : '';
    const authPart = encodedPassword ? `${encodedUser}:${encodedPassword}` : encodedUser;
    return `mysql://${authPart}@${host}:${port}/${database}`;
  }

  return process.env.DATABASE_URL || '';
}

export function getDatabaseType(): string {
  return 'mysql';
}

export function isMySQL(): boolean {
  return true;
}

export function isPostgres(): boolean {
  return false;
}

const connectionString = getDatabaseUrl();

if (!connectionString) {
  console.warn('[DATABASE WARNING] MySQL DATABASE_URL or DB_* environment variables are not set.');
}

const globalForDb = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: mysql.Pool;
};

// Create mysql2 connection pool
export const pool = globalForDb.pool ?? mysql.createPool(
  connectionString || {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kmlwj_erp',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  }
);

export const prisma = globalForDb.prisma ?? new PrismaClient({
  datasources: connectionString ? { db: { url: connectionString } } : undefined,
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pool = pool;
  globalForDb.prisma = prisma;
}
