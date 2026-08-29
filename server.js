import dotenv from 'dotenv';
dotenv.config();

import app from './api/index.js';
import { checkDatabaseConnection } from './api/_config/database.js';
import { logger } from './api/_utils/logger.js';
import { prisma, pool, getDatabaseUrl } from './api/_prisma.js';

const isPassenger = typeof globalThis.PhusionPassenger !== 'undefined' || process.env.PASSENGER_APP_ENV !== undefined || process.env.PORT === 'passenger';
const rawPort = process.env.PORT || 5000;
const isNumericPort = !isNaN(Number(rawPort));
const PORT = isNumericPort ? Number(rawPort) : rawPort;
const HOST = '0.0.0.0';

const resolvedDbUrl = getDatabaseUrl();
const maskedUrl = resolvedDbUrl ? resolvedDbUrl.replace(/:([^:@]+)@/, ':****@') : '';

logger.info('Starting ERP Production Server on GoDaddy Node.js Hosting...');
logger.info(`Environment: ${process.env.NODE_ENV || 'production'}`);
logger.info(`Port/Socket: ${isPassenger ? 'passenger' : PORT}`);
logger.info(`Database: ${maskedUrl ? 'GoDaddy MySQL configured' : 'DATABASE_URL or DB_* not set'}`);

// Bind HTTP server IMMEDIATELY so platform/hosting detects the process as ready
let server;
if (isPassenger) {
  if (typeof globalThis.PhusionPassenger !== 'undefined') {
    globalThis.PhusionPassenger.configure({ autoInstall: false });
  }
  server = app.listen('passenger', () => {
    logger.info('Express server started successfully under Phusion Passenger');
  });
} else if (isNumericPort) {
  server = app.listen(PORT, HOST, () => {
    logger.info(`Express server started successfully on http://${HOST}:${PORT}`);
  });
} else {
  server = app.listen(PORT, () => {
    logger.info(`Express server started successfully on socket ${PORT}`);
  });
}

// Perform non-blocking database connectivity check after server is listening
(async () => {
  if (!resolvedDbUrl) {
    logger.warn('DATABASE_URL is not set. Database operations will fail until configured.');
    return;
  }
  try {
    const dbConnected = await checkDatabaseConnection();
    if (dbConnected) {
      logger.info('GoDaddy MySQL database connection established successfully.');
    } else {
      logger.warn('Initial database connectivity check did not respond — server is running and will retry on requests.');
    }
  } catch (dbErr) {
    logger.warn({ error: dbErr?.message }, 'Initial database check warning — server remains active.');
  }
})();

// Graceful shutdown handling
let isShuttingDown = false;
const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'Received shutdown signal. Closing HTTP server and database connections...');

  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      if (prisma?.$disconnect) await prisma.$disconnect();
      if (pool?.end) await pool.end();
      logger.info('Database pool and Prisma client closed successfully.');
    } catch (err) {
      logger.error({ error: err?.message }, 'Error closing database connections during shutdown');
    }
    process.exit(0);
  });

  // Force terminate after 10 seconds if connections linger
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason: reason?.message || reason }, 'Unhandled Promise Rejection (non-fatal)');
});

process.on('uncaughtException', (err) => {
  logger.error({ error: err?.message, stack: err?.stack }, 'Uncaught Exception');
});
