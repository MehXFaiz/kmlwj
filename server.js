import dotenv from 'dotenv';
dotenv.config();

import app from './api/index.js';
import { checkDatabaseConnection } from './api/_config/database.js';
import { logger } from './api/_utils/logger.js';
import { prisma, pool } from './api/_prisma.js';

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

async function startServer() {
  logger.info({ port: PORT, host: HOST, nodeEnv: process.env.NODE_ENV }, 'Starting ERP Production Server on GoDaddy Node.js Hosting...');

  // Verify database connectivity on startup
  try {
    const dbConnected = await checkDatabaseConnection();
    if (dbConnected) {
      logger.info('Neon PostgreSQL connection established successfully.');
    } else {
      logger.warn('Initial database connectivity check did not respond — server will start and retry on incoming requests.');
    }
  } catch (dbErr) {
    logger.warn({ error: dbErr?.message }, 'Initial database ping error — continuing server startup');
  }

  const server = app.listen(PORT, HOST, () => {
    logger.info(`ERP Application is running on http://${HOST}:${PORT}`);
  });

  // Graceful shutdown handling
  let isShuttingDown = false;
  const gracefulShutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, 'Received shutdown signal. Closing HTTP server and database connections...');

    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await prisma.$disconnect();
        await pool.end();
        logger.info('Database pool and Prisma client closed successfully.');
      } catch (err) {
        logger.error({ error: err?.message }, 'Error closing database connections during shutdown');
      }
      process.exit(0);
    });

    // Force terminate after 10 seconds if connections are hanging
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout (active connections lingered).');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  logger.error({ reason: reason?.message || reason }, 'Unhandled Promise Rejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ error: err?.message, stack: err?.stack }, 'Uncaught Exception');
});

startServer().catch((err) => {
  logger.error({ error: err?.message, stack: err?.stack }, 'Failed to start server');
  process.exit(1);
});
