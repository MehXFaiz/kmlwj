import express from 'express';
import cors from 'cors';
import { logger } from './_utils/logger.js';

// Import Vercel serverless handlers from the hidden directories
import loginHandler from './_auth/login.js';
import registerHandler from './_auth/register.js';
import refreshHandler from './_auth/refresh.js';
import logoutHandler from './_auth/logout.js';
import forgotPasswordHandler from './_auth/forgot-password.js';
import resetPasswordHandler from './_auth/reset-password.js';
import changePasswordHandler from './_auth/change-password.js';
import healthHandler from './_health.js';
import healthV1Handler from './_v1/health.js';

// New dynamic api/v1 route handlers
import meHandler from './_v1/auth/me.js';
import statsHandler from './_v1/dashboard/stats.js';
import accountsHandler from './_v1/accounts.js';
import accountsTreeHandler from './_v1/accounts/tree.js';
import revenueHandler from './_v1/revenue-heads.js';
import expenseHandler from './_v1/expense-heads.js';
import usersHandler from './_v1/users.js';
import rolesHandler from './_v1/roles.js';
import auditLogsHandler from './_v1/audit-logs.js';
import reservedCodesHandler from './_v1/reserved-codes.js';
import beneficiariesHandler from './_v1/beneficiaries.js';
import donationsHandler from './_v1/donations.js';

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
      res.status(500).json({ error: { message: 'Internal Server Error', status: 500 } });
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

// Register new API v1 route handlers
app.get('/api/v1/auth/me', makeExpress(meHandler));
app.get('/api/v1/dashboard/stats', makeExpress(statsHandler));
app.get('/api/v1/accounts/tree', makeExpress(accountsTreeHandler));
app.get('/api/v1/accounts', makeExpress(accountsHandler));
app.post('/api/v1/accounts', makeExpress(accountsHandler));
app.put('/api/v1/accounts', makeExpress(accountsHandler));
app.delete('/api/v1/accounts', makeExpress(accountsHandler));
app.get('/api/v1/revenue-heads', makeExpress(revenueHandler));
app.post('/api/v1/revenue-heads', makeExpress(revenueHandler));
app.put('/api/v1/revenue-heads', makeExpress(revenueHandler));
app.delete('/api/v1/revenue-heads', makeExpress(revenueHandler));
app.get('/api/v1/expense-heads', makeExpress(expenseHandler));
app.post('/api/v1/expense-heads', makeExpress(expenseHandler));
app.put('/api/v1/expense-heads', makeExpress(expenseHandler));
app.delete('/api/v1/expense-heads', makeExpress(expenseHandler));
app.get('/api/v1/users', makeExpress(usersHandler));
app.post('/api/v1/users', makeExpress(usersHandler));
app.put('/api/v1/users', makeExpress(usersHandler));
app.get('/api/v1/roles', makeExpress(rolesHandler));
app.put('/api/v1/roles', makeExpress(rolesHandler));
app.get('/api/v1/audit-logs', makeExpress(auditLogsHandler));
app.get('/api/v1/reserved-codes', makeExpress(reservedCodesHandler));
app.post('/api/v1/reserved-codes', makeExpress(reservedCodesHandler));
app.put('/api/v1/reserved-codes', makeExpress(reservedCodesHandler));
app.delete('/api/v1/reserved-codes', makeExpress(reservedCodesHandler));

// Donation Management Routes
app.get('/api/v1/beneficiaries', makeExpress(beneficiariesHandler));
app.post('/api/v1/beneficiaries', makeExpress(beneficiariesHandler));
app.put('/api/v1/beneficiaries', makeExpress(beneficiariesHandler));
app.delete('/api/v1/beneficiaries', makeExpress(beneficiariesHandler));

app.get('/api/v1/donations', makeExpress(donationsHandler));
app.post('/api/v1/donations', makeExpress(donationsHandler));
app.put('/api/v1/donations', makeExpress(donationsHandler));

export default app;
