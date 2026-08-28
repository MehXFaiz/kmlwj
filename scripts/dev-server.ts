import dotenv from 'dotenv';
dotenv.config();

import { checkDatabaseConnection } from '../api/_config/database.js';
import { logger } from '../api/_utils/logger.js';
import app from '../api/index.js'; // The consolidated express app
import { AccountingIntegrityService } from '../api/_services/accounting-integrity.service.js';

const PORT = process.env.API_PORT || process.env.BACKEND_PORT || 4000;

async function startServer() {
  logger.info('Initializing Dev Express server with consolidated API app...');

  // Verify Database Connection
  const dbConnected = await checkDatabaseConnection();
  if (!dbConnected) {
    logger.error('Database connection could not be established. Exiting dev process...');
    process.exit(1);
  }

  // Run Accounting Integrity Check on Startup
  try {
    const checkResult = await AccountingIntegrityService.runFullCheck();
    if (checkResult.totalIssues > 0) {
      logger.warn(`Accounting Integrity Check found ${checkResult.totalIssues} issues!`);
      checkResult.issues.forEach(issue => {
        logger[issue.severity === 'critical' ? 'error' : issue.severity === 'warning' ? 'warn' : 'info'](
          `${issue.type.toUpperCase()}: ${issue.description}`,
          issue.item
        );
      });
    } else {
      logger.info('Accounting Integrity Check passed - no issues found!');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to run accounting integrity check');
  }

  app.listen(PORT, () => {
    logger.info(`Dev Express server is running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  logger.error({ error }, 'Failed to start dev server');
  process.exit(1);
});
