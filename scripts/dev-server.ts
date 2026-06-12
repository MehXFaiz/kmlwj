import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { checkDatabaseConnection } from '../api/_config/database.js';
import { logger } from '../api/_utils/logger.js';

// Import Vercel serverless handlers
import loginHandler from '../api/auth/login.js';
import registerHandler from '../api/auth/register.js';
import refreshHandler from '../api/auth/refresh.js';
import logoutHandler from '../api/auth/logout.js';
import forgotPasswordHandler from '../api/auth/forgot-password.js';
import resetPasswordHandler from '../api/auth/reset-password.js';
import changePasswordHandler from '../api/auth/change-password.js';
import healthHandler from '../api/health.js';
import healthV1Handler from '../api/v1/health.js';

const PORT = process.env.PORT || 4000;
const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper to convert Vercel handler to Express-compatible middleware
const makeExpress = (handler: any) => {
  return async (req: any, res: any) => {
    try {
      await handler(req, res);
    } catch (err) {
      logger.error(err, 'Express dev server handler error');
      res.status(500).json({ error: { message: 'Internal Dev Server Error', status: 500 } });
    }
  };
};

// API Routing matching Vercel Serverless Function architecture
app.post('/api/auth/login', makeExpress(loginHandler));
app.post('/api/auth/register', makeExpress(registerHandler));
app.post('/api/auth/refresh', makeExpress(refreshHandler));
app.post('/api/auth/logout', makeExpress(logoutHandler));
app.post('/api/auth/forgot-password', makeExpress(forgotPasswordHandler));
app.post('/api/auth/reset-password', makeExpress(resetPasswordHandler));
app.post('/api/auth/change-password', makeExpress(changePasswordHandler));
app.get('/api/health', makeExpress(healthHandler));
app.get('/api/v1/health', makeExpress(healthV1Handler));

async function startServer() {
  logger.info('Initializing Dev Express server mounting Vercel handlers...');

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
