import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
import userPreferencesHandler from './_v1/user-preferences.js';
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
import donorsHandler from './_v1/donors.js';
import donationsReceivedHandler from './_v1/donations-received.js';
import hallBookingsHandler from './_v1/hall-bookings.js';
import revenueCollectionsHandler from './_v1/revenue-collections.js';
import customersHandler from './_v1/customers.js';
import membersHandler from './_v1/members.js';
import invoicesHandler from './_v1/invoices.js';
import generalLedgerHandler from './_v1/general-ledger.js';
import journalEntriesHandler from './_v1/journal-entries.js';
import trialBalanceHandler from './_v1/reports/trial-balance.js';
import incomeStatementHandler from './_v1/reports/income-statement.js';
import balanceSheetHandler from './_v1/reports/balance-sheet.js';
import cashFlowHandler from './_v1/reports/cash-flow.js';
import searchHandler from './_v1/search.js';
import simpleExpenseHandler from './_v1/simple-expense.js';
import simpleIncomeHandler from './_v1/simple-income.js';
import accountingHealthHandler from './_v1/accounting-health.js';
import zakatCardsHandler from './_v1/zakat-cards.js';
import { memberVerifyHandler } from './_v1/member-verify.js';
import notificationsHandler from './_v1/notifications.js';

const app = express();

// Trust the reverse proxy (e.g. Vercel) so rate limiting uses the correct IP
app.set('trust proxy', 1);

// Security Headers (Helmet)
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 200 : 10000, // Limit each IP to 200 requests per `window` (here, per 15 minutes)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests from this IP, please try again after 15 minutes', status: 429 } }
});

// Apply global rate limiter to all /api/ routes
app.use('/api/', globalLimiter);

// Strict Rate Limiting for Authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 10000, // Limit each IP to 10 authentication requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many authentication attempts, please try again after 15 minutes', status: 429 } }
});

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
app.post('/api/auth/login', authLimiter, makeExpress(loginHandler));
app.post('/api/auth/register', authLimiter, makeExpress(registerHandler));
app.post('/api/auth/refresh', makeExpress(refreshHandler));
app.post('/api/auth/logout', makeExpress(logoutHandler));
app.post('/api/auth/forgot-password', authLimiter, makeExpress(forgotPasswordHandler));
app.post('/api/auth/reset-password', authLimiter, makeExpress(resetPasswordHandler));
app.post('/api/auth/change-password', authLimiter, makeExpress(changePasswordHandler));
app.all('/api/health', makeExpress(healthHandler));
app.all('/api/v1/health', makeExpress(healthV1Handler));

// Register new API v1 route handlers
app.get('/api/v1/auth/me', makeExpress(meHandler));
app.get('/api/v1/user-preferences', makeExpress(userPreferencesHandler));
app.patch('/api/v1/user-preferences', makeExpress(userPreferencesHandler));
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
app.delete('/api/v1/users', makeExpress(usersHandler));
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
app.patch('/api/v1/donations', makeExpress(donationsHandler));
app.delete('/api/v1/donations', makeExpress(donationsHandler));

app.get('/api/v1/donors', makeExpress(donorsHandler));
app.post('/api/v1/donors', makeExpress(donorsHandler));
app.put('/api/v1/donors', makeExpress(donorsHandler));
app.delete('/api/v1/donors', makeExpress(donorsHandler));

app.get('/api/v1/donations-received', makeExpress(donationsReceivedHandler));
app.post('/api/v1/donations-received', makeExpress(donationsReceivedHandler));
app.put('/api/v1/donations-received', makeExpress(donationsReceivedHandler));
app.patch('/api/v1/donations-received', makeExpress(donationsReceivedHandler));
app.delete('/api/v1/donations-received', makeExpress(donationsReceivedHandler));

// Revenue Collection Routes (Zakat, Fitra, Membership Fee, Bus Booking)
app.get('/api/v1/revenue-collections', makeExpress(revenueCollectionsHandler));
app.post('/api/v1/revenue-collections', makeExpress(revenueCollectionsHandler));
app.put('/api/v1/revenue-collections', makeExpress(revenueCollectionsHandler));
app.delete('/api/v1/revenue-collections', makeExpress(revenueCollectionsHandler));

// Hall Booking Routes
app.get('/api/v1/hall-bookings/check-availability', makeExpress(hallBookingsHandler));
app.get('/api/v1/hall-bookings', makeExpress(hallBookingsHandler));
app.post('/api/v1/hall-bookings', makeExpress(hallBookingsHandler));
app.put('/api/v1/hall-bookings', makeExpress(hallBookingsHandler));
app.delete('/api/v1/hall-bookings', makeExpress(hallBookingsHandler));

// Invoice & Customer Management Routes
app.get('/api/v1/customers', makeExpress(customersHandler));
app.post('/api/v1/customers', makeExpress(customersHandler));
app.put('/api/v1/customers', makeExpress(customersHandler));
app.delete('/api/v1/customers', makeExpress(customersHandler));

app.get('/api/v1/members', makeExpress(membersHandler));
app.post('/api/v1/members', makeExpress(membersHandler));
app.put('/api/v1/members', makeExpress(membersHandler));
app.delete('/api/v1/members', makeExpress(membersHandler));

app.get('/api/v1/invoices', makeExpress(invoicesHandler));
app.post('/api/v1/invoices', makeExpress(invoicesHandler));
app.put('/api/v1/invoices', makeExpress(invoicesHandler));
app.delete('/api/v1/invoices', makeExpress(invoicesHandler));

// Zakat Card Routes
app.get('/api/v1/zakat-cards', makeExpress(zakatCardsHandler));
app.post('/api/v1/zakat-cards', makeExpress(zakatCardsHandler));
app.delete('/api/v1/zakat-cards', makeExpress(zakatCardsHandler));

// Ledger & Journals
app.get('/api/v1/general-ledger', makeExpress(generalLedgerHandler));
app.post('/api/v1/general-ledger', makeExpress(generalLedgerHandler));
app.delete('/api/v1/general-ledger', makeExpress(generalLedgerHandler));
app.get('/api/v1/journal-entries', makeExpress(journalEntriesHandler));
app.post('/api/v1/journal-entries', makeExpress(journalEntriesHandler));
app.put('/api/v1/journal-entries', makeExpress(journalEntriesHandler));
app.patch('/api/v1/journal-entries', makeExpress(journalEntriesHandler));
app.delete('/api/v1/journal-entries', makeExpress(journalEntriesHandler));

// Global Search Route
app.get('/api/v1/search', makeExpress(searchHandler));

// Financial Reports
app.get('/api/v1/reports/trial-balance', makeExpress(trialBalanceHandler));
app.get('/api/v1/reports/income-statement', makeExpress(incomeStatementHandler));
app.get('/api/v1/reports/balance-sheet', makeExpress(balanceSheetHandler));
app.get('/api/v1/reports/cash-flow', makeExpress(cashFlowHandler));

// Simple Expense & Income Routes
app.get('/api/v1/simple-expense', makeExpress(simpleExpenseHandler));
app.post('/api/v1/simple-expense', makeExpress(simpleExpenseHandler));
app.get('/api/v1/simple-income', makeExpress(simpleIncomeHandler));
app.post('/api/v1/simple-income', makeExpress(simpleIncomeHandler));

// Accounting Health Check Route
app.get('/api/v1/accounting-health', makeExpress(accountingHealthHandler));

// Notification Routes
app.get('/api/v1/notifications', makeExpress(notificationsHandler));
app.patch('/api/v1/notifications', makeExpress(notificationsHandler));

// Public Member Verification Route (no JWT — scanned from QR code)
app.get('/api/v1/member/verify/:id', async (req: any, res: any) => {
  await memberVerifyHandler(req, res);
});

export default app;
