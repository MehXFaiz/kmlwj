import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from './_utils/handler.js';
import { MongoClient } from 'mongodb';

interface HealthStatus {
  status: 'OK' | 'DEGRADED' | 'ERROR';
  timestamp: string;
  database: {
    status: 'connected' | 'disconnected' | 'unknown';
    type: 'mongodb' | 'postgresql' | 'unknown';
    message?: string;
  };
  version?: string;
}

export default makeHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  const health: HealthStatus = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: {
      status: 'unknown',
      type: 'unknown',
    },
  };

  // Check MongoDB connection
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      health.status = 'ERROR';
      health.database.status = 'disconnected';
      health.database.message = 'MONGODB_URI not configured';
    } else {
      const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
      await client.connect();
      await client.db('kmlwj').command({ ping: 1 });
      await client.close();

      health.database.status = 'connected';
      health.database.type = 'mongodb';
      health.database.message = 'Successfully connected to MongoDB';
    }
  } catch (error) {
    health.status = 'DEGRADED';
    health.database.status = 'disconnected';
    health.database.type = 'mongodb';
    health.database.message = error instanceof Error ? error.message : 'Unknown MongoDB error';
  }

  const statusCode = health.status === 'OK' ? 200 : health.status === 'DEGRADED' ? 503 : 500;
  return res.status(statusCode).json(health);
});
