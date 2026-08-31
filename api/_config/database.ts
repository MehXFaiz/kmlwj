import { prisma } from '../_prisma.js';
import { logger } from '../_utils/logger.js';
import { checkDatabaseConnection as checkMongoConnection, getMongoClient, getMongoDb } from './mongodb.js';

export { getMongoClient, getMongoDb };

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const mongoStatus = await checkMongoConnection();
    if (!mongoStatus.success) {
      return false;
    }
    await prisma.$runCommandRaw({ ping: 1 });
    logger.info('MongoDB Atlas database connection established successfully.');
    return true;
  } catch (error: any) {
    logger.error({ error: error?.message || error }, 'Database connection failed.');
    return false;
  }
}
