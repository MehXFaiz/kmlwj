import dotenv from 'dotenv';
dotenv.config();

import { checkDatabaseConnection } from '../api/_config/database.js';
import { logger } from '../api/_utils/logger.js';
import app from '../api/index.js'; // The consolidated express app
import { AccountingIntegrityService } from '../api/_services/accounting-integrity.service.js';

const rawPort = process.env.PORT || process.env.API_PORT || process.env.BACKEND_PORT || 5000;
const isNumericPort = !isNaN(Number(rawPort));
const PORT = isNumericPort ? Number(rawPort) : rawPort;
const HOST = '0.0.0.0';

logger.info('Initializing Express server with consolidated API & frontend app...');

// Bind HTTP server IMMEDIATELY so preview/container platforms detect the process as ready
const server = isNumericPort
  ? app.listen(PORT, HOST, () => {
      logger.info(`Server is running and listening on http://${HOST}:${PORT}`);
    })
  : app.listen(PORT, () => {
      logger.info(`Server is running and listening on socket ${PORT}`);
    });

// Perform non-blocking database connectivity check and startup integrity check in background
(async () => {
  try {
    const dbConnected = await checkDatabaseConnection();
    if (dbConnected) {
      logger.info('Database connection established successfully.');
      try {
        const checkResult = await AccountingIntegrityService.runFullCheck();
        if (checkResult.totalIssues > 0) {
          logger.warn(`Accounting Integrity Check found ${checkResult.totalIssues} issues.`);
        } else {
          logger.info('Accounting Integrity Check passed — 0 issues found.');
        }
      } catch (checkErr: any) {
        logger.warn({ error: checkErr?.message }, 'Accounting integrity check warning (non-fatal)');
      }
    } else {
      logger.warn('Initial database connectivity probe did not respond — server is active and will retry on requests.');
    }
  } catch (err: any) {
    logger.warn({ error: err?.message }, 'Initial database check warning — server remains active.');
  }
})();

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down server...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down server...');
  server.close(() => process.exit(0));
});

process.on('unhandledRejection', (reason: any) => {
  logger.error({ reason: reason?.message || reason }, 'Unhandled Promise Rejection (non-fatal)');
});

process.on('uncaughtException', (err: any) => {
  logger.error({ error: err?.message, stack: err?.stack }, 'Uncaught Exception');
});
