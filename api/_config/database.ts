import { prisma } from '../_prisma.js';
import { logger } from '../_utils/logger.js';

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$runCommandRaw({ ping: 1 });
    logger.info('MongoDB Atlas database connection established successfully.');
    return true;
  } catch (error) {
    logger.error({ error }, 'Database connection failed.');
    return false;
  }
}
