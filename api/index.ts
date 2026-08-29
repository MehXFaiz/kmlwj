import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
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
import healthDbHandler from './_health-db.js';

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
import donorsBulkDeleteHandler from './_v1/donors/bulk-delete.js';
import donationsReceivedHandler from './_v1/donations-received.js';
import hallBookingsHandler from './_v1/hall-bookings.js';
import revenueCollectionsHandler from './_v1/revenue-collections.js';
import customersHandler from './_v1/customers.js';
import membersHandler from './_v1/members.js';
import familyRelationshipsHandler from './_v1/family-relationships.js';
import uploadHandler from './_v1/upload.js';
import uploadSignHandler from './_v1/upload-sign.js';
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
import aiAccountingIssuesHandler from './_v1/ai-accounting/issues.js';
import aiAccountingAuditHandler from './_v1/ai-accounting/audit.js';
import aiAccountingAnalyzeHandler from './_v1/ai-accounting/analyze.js';
import aiAccountingAutoRepairHandler from './_v1/ai-accounting/auto-repair.js';
import aiAccountingRepairHandler from './_v1/ai-accounting/repair.js';
import aiAccountingHistoryHandler from './_v1/ai-accounting/history.js';
import systemResetHandler from './_v1/system-reset.js';
import zakatCardsHandler from './_v1/zakat-cards.js';
import incomeCategoriesHandler from './_v1/income-categories.js';
import addIncomeHandler from './_v1/add-income.js';
import ledgerPostHandler from './_v1/ledger-post.js';
import { memberVerifyHandler } from './_v1/member-verify.js';
import { zakatCardVerifyHandler } from './_v1/zakat-card-verify.js';
import financialYearsHandler from './_v1/financial-years.js';
import openingBalancesHandler from './_v1/opening-balances.js';
import { uploadFields, handleUploadError } from './_middlewares/upload.middleware.js';

// ── Startup storage configuration check ─────────────────────────────────────
// Uploads use Cloudinary (browser → Cloudinary direct, signed by /api/v1/upload/sign).
// Local disk is only viable on a long-running dev server, never on Vercel.
{
  const missingStorageVars = [
    !process.env.CLOUDINARY_CLOUD_NAME && 'CLOUDINARY_CLOUD_NAME',
    !process.env.CLOUDINARY_API_KEY    && 'CLOUDINARY_API_KEY',
    !process.env.CLOUDINARY_API_SECRET && 'CLOUDINARY_API_SECRET',
  ].filter(Boolean);

  if (missingStorageVars.length === 0) {
    logger.info({ provider: 'cloudinary', cloudName: process.env.CLOUDINARY_CLOUD_NAME }, 'File storage configured');
  } else if (process.env.VERCEL) {
    logger.error({ missingStorageVars },
      'FATAL STORAGE MISCONFIGURATION: running on Vercel with no cloud storage credentials. ' +
      'File uploads WILL fail until these environment variables are added in the Vercel project ' +
      'settings (Settings → Environment Variables) and the project is redeployed.'
    );
  } else {
    logger.warn({ missingStorageVars },
      'Cloudinary not configured — uploads will use the local ./uploads folder (development only).'
    );
  }
}

const app = express();

// Trust the reverse proxy (e.g. Vercel) so rate limiting uses the correct IP
app.set('trust proxy', 1);

// Security Headers (Helmet) - disable strict CSP so preview proxies, inline scripts, and dynamic assets work smoothly
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 2500 : 10000, // Multi-tab and multi-user desktop friendly limit (2500 req / 15 min per IP)
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Exclude background health probes so Electron connectivity checks never consume user rate limit quota
    const url = req.originalUrl || req.url || '';
    return url.includes('/api/health') || url.includes('/api/v1/health');
  },
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

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:20010',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:20010',
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // If no origin (e.g. mobile apps, same-origin server requests, curl, Postman) -> allow
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.length === 0 ||
      allowedOrigins.includes(origin) ||
      allowedOrigins.some(allowed => origin === allowed || origin.startsWith(allowed))
    ) {
      return callback(null, true);
    }
    // Allow dynamic same-origin in production or non-production
    return callback(null, true);
  },
  credentials: true,
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'Accept', 'Origin', 'x-erp-sync-version'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// Keep JSON body limit small — images must come via /api/v1/upload (multipart), not Base64 in JSON
app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true, limit: '500kb' }));

// Serve uploaded files (development only — use Cloudinary in production)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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
app.all('/health', makeExpress(healthHandler));
app.all('/api/health', makeExpress(healthHandler));
app.all('/api/health/db', makeExpress(healthDbHandler));
app.all('/api/v1/health', makeExpress(healthV1Handler));

// Handle residual Vercel analytics/insights probes gracefully on non-Vercel hosting
app.use('/_vercel', (_req, res) => {
  res.type('application/javascript').send('/* vercel noop */');
});

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
app.post('/api/v1/roles', makeExpress(rolesHandler));
app.put('/api/v1/roles', makeExpress(rolesHandler));
app.delete('/api/v1/roles', makeExpress(rolesHandler));
app.get('/api/v1/roles/:id', makeExpress(rolesHandler));
app.put('/api/v1/roles/:id', makeExpress(rolesHandler));
app.delete('/api/v1/roles/:id', makeExpress(rolesHandler));
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

// app.all so the handler owns method dispatch (405 for anything but DELETE, and the
// CORS preflight) instead of Express answering a wrong method with a bare 404.
app.all('/api/v1/donors/bulk-delete', makeExpress(donorsBulkDeleteHandler));
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

// Issues a Cloudinary signature so the browser can upload directly (bypasses this server entirely)
app.post('/api/v1/upload/sign', makeExpress(uploadSignHandler));

// Local-disk fallback upload endpoint — used only when Cloudinary isn't configured.
// multer → handler → multer error converter (must be last, 4-arg signature)
app.post('/api/v1/upload', uploadFields, makeExpress(uploadHandler), handleUploadError);

app.get('/api/v1/members', makeExpress(membersHandler));
app.post('/api/v1/members', makeExpress(membersHandler));
app.put('/api/v1/members', makeExpress(membersHandler));
app.delete('/api/v1/members', makeExpress(membersHandler));

app.get('/api/v1/family-relationships', makeExpress(familyRelationshipsHandler));
app.post('/api/v1/family-relationships', makeExpress(familyRelationshipsHandler));
app.delete('/api/v1/family-relationships', makeExpress(familyRelationshipsHandler));

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

// Financial Years & Opening Balances Routes
app.get('/api/v1/financial-years', makeExpress(financialYearsHandler));
app.post('/api/v1/financial-years', makeExpress(financialYearsHandler));
app.get('/api/v1/opening-balances', makeExpress(openingBalancesHandler));
app.post('/api/v1/opening-balances', makeExpress(openingBalancesHandler));

// Financial Reports
app.get('/api/v1/reports/trial-balance', makeExpress(trialBalanceHandler));
app.get('/api/v1/reports/income-statement', makeExpress(incomeStatementHandler));
app.get('/api/v1/reports/balance-sheet', makeExpress(balanceSheetHandler));
app.get('/api/v1/reports/cash-flow', makeExpress(cashFlowHandler));

// Simple Expense & Income Routes
app.get('/api/v1/simple-expense', makeExpress(simpleExpenseHandler));
app.post('/api/v1/simple-expense', makeExpress(simpleExpenseHandler));
app.put('/api/v1/simple-expense', makeExpress(simpleExpenseHandler));
app.delete('/api/v1/simple-expense', makeExpress(simpleExpenseHandler));
app.get('/api/v1/simple-income', makeExpress(simpleIncomeHandler));
app.post('/api/v1/simple-income', makeExpress(simpleIncomeHandler));
app.put('/api/v1/simple-income', makeExpress(simpleIncomeHandler));
app.delete('/api/v1/simple-income', makeExpress(simpleIncomeHandler));

// Add Income Module Routes (Income Categories & Add Income Records)
app.get('/api/v1/income-categories', makeExpress(incomeCategoriesHandler));
app.post('/api/v1/income-categories', makeExpress(incomeCategoriesHandler));
app.put('/api/v1/income-categories', makeExpress(incomeCategoriesHandler));
app.delete('/api/v1/income-categories', makeExpress(incomeCategoriesHandler));

import pettyCashHandler from './_v1/petty-cash.js';

app.get('/api/v1/petty-cash', makeExpress(pettyCashHandler));
app.post('/api/v1/petty-cash', makeExpress(pettyCashHandler));
app.put('/api/v1/petty-cash', makeExpress(pettyCashHandler));
app.delete('/api/v1/petty-cash', makeExpress(pettyCashHandler));

app.post('/api/v1/ledger-post', makeExpress(ledgerPostHandler));
app.put('/api/v1/ledger-post', makeExpress(ledgerPostHandler));

app.get('/api/v1/add-income', makeExpress(addIncomeHandler));
app.post('/api/v1/add-income', makeExpress(addIncomeHandler));
app.put('/api/v1/add-income', makeExpress(addIncomeHandler));
app.delete('/api/v1/add-income', makeExpress(addIncomeHandler));

// Accounting Health Check Route
app.get('/api/v1/accounting-health', makeExpress(accountingHealthHandler));
// POST ?action=rebuild-balances — rebuild/repair cached account balances
app.post('/api/v1/accounting-health', makeExpress(accountingHealthHandler));

// AI Accounting Health & Auto-Repair
app.get('/api/v1/ai-accounting/issues', makeExpress(aiAccountingIssuesHandler));
app.post('/api/v1/ai-accounting/audit', makeExpress(aiAccountingAuditHandler));
app.post('/api/v1/ai-accounting/analyze', makeExpress(aiAccountingAnalyzeHandler));
app.post('/api/v1/ai-accounting/auto-repair', makeExpress(aiAccountingAutoRepairHandler));
app.post('/api/v1/ai-accounting/repair', makeExpress(aiAccountingRepairHandler));
app.get('/api/v1/ai-accounting/history', makeExpress(aiAccountingHistoryHandler));

// System Reset Route
app.post('/api/v1/system-reset', makeExpress(systemResetHandler));

// Public Member Verification Route (no JWT — scanned from QR code)
app.get('/api/v1/member/verify/:id', async (req: any, res: any) => {
  await memberVerifyHandler(req, res);
});

// Public Zakat Card Verification Route (no JWT — scanned from QR code)
app.get('/api/v1/zakat-card/verify/:cardNumber', async (req: any, res: any) => {
  await zakatCardVerifyHandler(req, res);
});

// ── 404 handler for unmatched API routes (returns clean JSON, not HTML) ────
app.use('/api', (req, res) => {
  res.status(404).json({
    error: {
      message: `API endpoint ${req.method} ${req.originalUrl || req.url} not found`,
      status: 404,
    },
  });
});

// ── Serve Production Frontend (dist/) & SPA Routing Fallback ──────────────
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, { maxAge: '1h' }));

  // Fallback for all non-API GET requests to React index.html
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
    }
    return next();
  });
}

// ── Global JSON error handler ────────────────────────────────────────────────
// Must be the last middleware registered. Catches anything that reaches
// next(err) without being handled above (including unhandled multer errors).
app.use((err: any, _req: any, res: any, _next: any) => {
  logger.error({ err: err?.message || err }, 'Unhandled Express error');
  const status  = err?.status ?? err?.statusCode ?? 500;
  const message = status < 500
    ? (err?.message || 'Request failed')
    : 'An unexpected error occurred. Please try again.';
  res.status(status).json({ error: { message, status } });
});

export default app;
