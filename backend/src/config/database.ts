import { prisma } from '../prisma';
import { logger } from '../utils/logger';

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection established successfully.');
    return true;
  } catch (error) {
    logger.error({ error }, 'Database connection failed.');
    return false;
  }
}
