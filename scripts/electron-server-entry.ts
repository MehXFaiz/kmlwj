// Backend bootstrap used ONLY when the app runs inside Electron (forked as a child
// process by electron/server-manager.cjs). It reuses the exact same consolidated
// Express app as the Vercel deployment (api/index.ts) and the local dev server
// (scripts/dev-server.ts) — the only things added here are:
//   1. Serving the pre-built React frontend (dist/) + SPA fallback, so the
//      Electron window and the Express server are same-origin (no CORS, no
//      base-path/router changes needed in the frontend at all).
//   2. Binding to an OS-assigned free port instead of a fixed one, so the
//      desktop app never collides with something else already using :4000.
//   3. Reporting readiness/failure back to the Electron main process over the
//      parent/child IPC channel instead of just logging and exiting.
//   4. Retrying the initial database connection with backoff instead of
//      hard-exiting the process on the first failed check — a laptop that
//      wakes from sleep or a Postgres host that takes a moment to accept
//      connections shouldn't kill the whole desktop app.
//
// This file is compiled to plain JS by scripts/build-electron-server.mjs; it is
// never imported by the web/Vercel build and never ships tsx/ts-node at runtime.

import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import http from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// electron/env.cjs writes a real .env into userData and passes its path via
// KMLWJ_ENV_PATH before forking this process. Fall back to a local .env for
// `npm run start:electron-server` standalone testing outside Electron.
const envPath = process.env.KMLWJ_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const { checkDatabaseConnection } = await import('../api/_config/database.js');
const { logger } = await import('../api/_utils/logger.js');
const app = (await import('../api/index.js')).default;
const { AccountingIntegrityService } = await import('../api/_services/accounting-integrity.service.js');

// electron/server-manager.cjs forks this file via Electron's utilityProcess.fork(),
// whose IPC is process.parentPort (a MessagePortMain), NOT Node's classic
// process.send()/process.on('message') — those only exist under
// child_process.fork(), which this app deliberately avoids (see server-manager.cjs
// for why). Running this file standalone via plain `node` for local testing
// leaves parentPort undefined, so reportToParent silently no-ops there.
const parentPort = (process as any).parentPort;
const isElectronChild = !!parentPort;

function reportToParent(message: Record<string, unknown>) {
  if (isElectronChild) {
    parentPort.postMessage(message);
  }
}

// ── Serve the built frontend from the same Express app/port as the API ──────
// electron/server-manager.cjs passes the absolute path to the packaged app's
// dist/ folder (electron-builder ships it under resources/dist).
const frontendDist = process.env.KMLWJ_FRONTEND_DIST || path.resolve(__dirname, '../dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { index: false }));
  // SPA fallback: anything that isn't /api/* or /uploads/* resolves to index.html
  // so BrowserRouter deep links and hard reloads on nested routes both work,
  // exactly like the "/(.*) -> /index.html" rewrite Vercel applies in production.
  app.get(/^(?!\/api\/|\/uploads\/).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
  logger.info({ frontendDist }, 'Serving built frontend from Express (desktop mode)');
} else {
  logger.warn({ frontendDist }, 'Frontend dist/ not found — desktop window will show an API-only server');
}

async function waitForDatabase(maxAttempts = 10, baseDelayMs = 2000): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const connected = await checkDatabaseConnection();
    if (connected) return true;

    const delay = Math.min(baseDelayMs * attempt, 15000);
    reportToParent({ type: 'server-status', status: 'db-retry', attempt, maxAttempts });
    logger.warn({ attempt, maxAttempts, delayMs: delay }, 'Database not reachable yet, retrying...');
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return false;
}

async function startServer() {
  logger.info('Starting KMLWJ desktop backend...');
  reportToParent({ type: 'server-status', status: 'starting' });

  const dbConnected = await waitForDatabase();
  if (!dbConnected) {
    logger.error('Database connection could not be established after retries.');
    reportToParent({
      type: 'server-error',
      message: 'Could not connect to the database. Check your .env configuration and network connection.',
    });
    return;
  }

  try {
    const checkResult = await AccountingIntegrityService.runFullCheck();
    if (checkResult.totalIssues > 0) {
      logger.warn(`Accounting Integrity Check found ${checkResult.totalIssues} issue(s).`);
    } else {
      logger.info('Accounting Integrity Check passed.');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to run accounting integrity check');
  }

  // PORT=0 lets the OS assign a free ephemeral port — avoids clashing with
  // anything else already bound to :4000 on the user's machine.
  const requestedPort = Number(process.env.PORT) || 0;
  const server: http.Server = app.listen(requestedPort, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : requestedPort;
    logger.info(`Desktop backend listening on http://127.0.0.1:${port}`);
    reportToParent({ type: 'server-ready', port, url: `http://127.0.0.1:${port}` });
  });

  server.on('error', (error) => {
    logger.error({ error }, 'Backend server error');
    reportToParent({ type: 'server-error', message: (error as Error).message });
  });

  const shutdown = () => {
    logger.info('Shutting down desktop backend...');
    server.close(() => process.exit(0));
    // Force-exit if close() hangs on an open keep-alive connection.
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  // electron/server-manager.cjs asks the child to exit cleanly via
  // parentPort.postMessage() before falling back to child.kill() on app quit.
  if (isElectronChild) {
    parentPort.on('message', (event: any) => {
      const msg = event?.data ?? event;
      if (msg?.type === 'shutdown') shutdown();
    });
    parentPort.start?.();
  }
}

startServer().catch((error) => {
  logger.error({ error }, 'Fatal error starting desktop backend');
  reportToParent({ type: 'server-error', message: error?.message || 'Unknown startup error' });
});
