import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import mysql from 'mysql2/promise';

/**
 * Resolves the GoDaddy MySQL connection URL from DATABASE_URL
 * or discrete DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD environment variables.
 */
export function getMySQLDatabaseUrl(): string {
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
    process.env.DATABASE_URL = generatedUrl;
    return generatedUrl;
  }

  return process.env.DATABASE_URL || '';
}

export const getDatabaseUrl = getMySQLDatabaseUrl;
export function isMySQL(): boolean { return true; }
export function isPostgres(): boolean { return false; }
export function getDatabaseType(): string { return 'mysql'; }

const connectionUrl = getMySQLDatabaseUrl();

if (!connectionUrl) {
  console.warn('[DATABASE WARNING] Neither DATABASE_URL (mysql://) nor DB_HOST/DB_USER/DB_NAME are configured.');
}

const globalForDb = globalThis as unknown as {
  prisma?: PrismaClient;
  mysqlPool?: mysql.Pool;
};

export const pool = globalForDb.mysqlPool ?? (
  process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME
    ? mysql.createPool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      })
    : (connectionUrl && connectionUrl.startsWith('mysql://') ? mysql.createPool(connectionUrl) : undefined)
);

export const prisma = globalForDb.prisma ?? new PrismaClient({
  datasources: connectionUrl && connectionUrl.startsWith('mysql://')
    ? { db: { url: connectionUrl } }
    : undefined,
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.prisma = prisma;
  if (pool) globalForDb.mysqlPool = pool;
}
