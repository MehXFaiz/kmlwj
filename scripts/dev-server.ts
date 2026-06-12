import dotenv from 'dotenv';
dotenv.config();

import { checkDatabaseConnection } from '../api/_config/database.js';
import { logger } from '../api/_utils/logger.js';
import app from '../api/index.js'; // The consolidated express app

const PORT = process.env.PORT || 4000;

async function startServer() {
  logger.info('Initializing Dev Express server with consolidated API app...');

  // Verify Database Connection
  const dbConnected = await checkDatabaseConnection();
  if (!dbConnected) {
    logger.error('Database connection could not be established. Exiting dev process...');
    process.exit(1);
  }

  app.listen(PORT, () => {
    logger.info(`Dev Express server is running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  logger.error({ error }, 'Failed to start dev server');
  process.exit(1);
});
