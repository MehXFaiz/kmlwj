import dotenv from 'dotenv';
// Load environment variables before anything else
dotenv.config();

import app from './app';
import { checkDatabaseConnection } from './config/database';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 4000;

async function startServer() {
  logger.info('Initializing Accounting ERP server...');

  // 1. Verify Database Connectivity
  const dbConnected = await checkDatabaseConnection();
  if (!dbConnected) {
    logger.error('Database connection could not be established. Exiting process...');
    process.exit(1);
  }

  // 2. Start Listening
  app.listen(PORT, () => {
    logger.info(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
}

startServer().catch((error) => {
  logger.error({ error }, 'Failed to start server');
  process.exit(1);
});
