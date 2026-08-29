import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore in environments where custom DNS servers cannot be bound
}

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import mysql from 'mysql2/promise';

export type DatabaseDialect = 'postgres' | 'mysql';

/**
 * Detects whether the active database is PostgreSQL (Neon/Cloud) or MySQL (GoDaddy/Local).
 */
export function getDatabaseType(): DatabaseDialect {
  const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || '';
  if (dbUrl.startsWith('mysql://')) {
    return 'mysql';
  }
  if (process.env.DB_HOST && !dbUrl.startsWith('postgres')) {
    return 'mysql';
  }
  return 'postgres';
}

export function isMySQL(): boolean {
  return getDatabaseType() === 'mysql';
}

export function isPostgres(): boolean {
  return getDatabaseType() === 'postgres';
}

/**
 * Resolves the active connection URL based on dialect and available environment variables.
 */
export function getDatabaseUrl(): string {
  const type = getDatabaseType();
  if (type === 'mysql') {
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mysql://')) {
      return process.env.DATABASE_URL;
    }
    const host = process.env.DB_HOST;
    const user = process.env.DB_USER;
    const database = process.env.DB_NAME;
    const password = process.env.DB_PASSWORD || '';
    const port = process.env.DB_PORT || '3306';

    if (host && user && database) {
      const encodedUser = encodeURIComponent(user);
      const encodedPassword = encodeURIComponent(password);
      const generatedUrl = `mysql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}`;
      return generatedUrl;
    }
    return process.env.DATABASE_URL || '';
  }

  // PostgreSQL
  return process.env.DATABASE_URL || process.env.DIRECT_URL || '';
}

// Backward-compatibility alias
export const getMySQLDatabaseUrl = getDatabaseUrl;

const resolvedDbUrl = getDatabaseUrl();
const dbType = getDatabaseType();

if (!resolvedDbUrl) {
  console.warn('[DATABASE WARNING] DATABASE_URL is not set in environment variables.');
}

const globalForDb = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: pg.Pool;
  mysqlPool?: mysql.Pool;
};

let pgPoolInstance: pg.Pool | undefined = globalForDb.pgPool;
let mysqlPoolInstance: mysql.Pool | undefined = globalForDb.mysqlPool;
let prismaInstance: PrismaClient;

if (dbType === 'mysql') {
  if (!mysqlPoolInstance && resolvedDbUrl) {
    if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME) {
      mysqlPoolInstance = mysql.createPool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });
    } else {
      mysqlPoolInstance = mysql.createPool(resolvedDbUrl);
    }
  }

  prismaInstance = globalForDb.prisma ?? new PrismaClient({
    datasources: resolvedDbUrl ? { db: { url: resolvedDbUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
} else {
  // PostgreSQL
  if (!pgPoolInstance && resolvedDbUrl) {
    pgPoolInstance = new pg.Pool({
      connectionString: resolvedDbUrl,
      max: 20,
      idleTimeoutMillis: 10000,
      ssl: resolvedDbUrl.includes('sslmode=require') || resolvedDbUrl.includes('neon.tech')
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }

  const adapter = pgPoolInstance ? new PrismaPg(pgPoolInstance) : undefined;

  prismaInstance = globalForDb.prisma ?? new PrismaClient({
    adapter,
    datasources: !adapter && resolvedDbUrl ? { db: { url: resolvedDbUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = prismaInstance;
export const pgPool = pgPoolInstance;
export const mysqlPool = mysqlPoolInstance;
export const pool = (dbType === 'mysql' ? mysqlPoolInstance : pgPoolInstance) as any;

if (process.env.NODE_ENV !== 'production') {
  globalForDb.prisma = prisma;
  if (pgPoolInstance) globalForDb.pgPool = pgPoolInstance;
  if (mysqlPoolInstance) globalForDb.mysqlPool = mysqlPoolInstance;
}
