import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore in environments where setting DNS servers is not allowed
}

import { MongoClient, Db } from 'mongodb';
import { logger } from '../_utils/logger.js';

interface MongoGlobal {
  mongoClient?: MongoClient;
  mongoDbPromise?: Promise<MongoClient>;
}

const globalForMongo = globalThis as unknown as MongoGlobal;

const MONGODB_URI = process.env.MONGODB_URI;

/**
 * Returns a pooled, reusable MongoClient instance.
 * In serverless and dev environments, reuses the client across invocations
 * to prevent connection exhaustion.
 */
export async function getMongoClient(): Promise<MongoClient> {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  if (globalForMongo.mongoClient) {
    return globalForMongo.mongoClient;
  }

  if (!globalForMongo.mongoDbPromise) {
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      maxIdleTimeMS: 30000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    globalForMongo.mongoDbPromise = client.connect().then((connectedClient) => {
      globalForMongo.mongoClient = connectedClient;
      logger.info('Reusable MongoDB client connection established.');
      return connectedClient;
    }).catch((err) => {
      globalForMongo.mongoDbPromise = undefined;
      logger.error({ error: err.message }, 'Failed to establish MongoDB client connection.');
      throw err;
    });
  }

  return globalForMongo.mongoDbPromise;
}

/**
 * Returns the default MongoDB database instance.
 */
export async function getMongoDb(dbName?: string): Promise<Db> {
  const client = await getMongoClient();
  return client.db(dbName);
}

/**
 * Reliable database health verification.
 * Pings the database and returns structured connectivity status.
 */
export async function checkDatabaseConnection(): Promise<{
  success: boolean;
  database: 'connected' | 'disconnected';
  error?: string;
}> {
  try {
    const client = await getMongoClient();
    await client.db().command({ ping: 1 });
    return {
      success: true,
      database: 'connected',
    };
  } catch (err: any) {
    logger.error({ error: err.message }, 'Database health ping failed.');
    return {
      success: false,
      database: 'disconnected',
      error: 'Database connectivity unavailable',
    };
  }
}
