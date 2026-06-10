import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { checkDatabaseConnection } from './_config/database';
import { logger } from './_utils/logger';

// Import Vercel serverless handlers
import loginHandler from './auth/login';
import registerHandler from './auth/register';
import refreshHandler from './auth/refresh';
import logoutHandler from './auth/logout';
import forgotPasswordHandler from './auth/forgot-password';
import resetPasswordHandler from './auth/reset-password';
import changePasswordHandler from './auth/change-password';
import healthHandler from './health';

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
