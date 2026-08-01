'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// KMLWJ ERP — Desktop shell (thin client)
//
// The React frontend and the Express/Prisma backend both run live on Vercel
// (https://kmlwj.com) against the hosted Neon Postgres database. This desktop
// app is a native, branded window around that live deployment — it does NOT run
// a local backend and needs NO configuration or secrets on the user's machine.
//
// Why this design: the database is cloud-hosted, so a local backend copy would
// still require internet and would just duplicate the same cloud DB connection
// while adding a whole class of packaging failures (spawn ENOENT, write EPIPE,
// Prisma native-engine bundling, per-machine .env secrets). A thin client
// removes all of that — it installs and works instantly on any computer, and
// backend/frontend updates ship server-side with zero desktop redeploys.
// ─────────────────────────────────────────────────────────────────────────────

const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const log = require('electron-log');

const { showNotification } = require('./notifications.cjs');
const { buildMenu } = require('./menu.cjs');
const { initUpdater } = require('./updater.cjs');

const isDev = !app.isPackaged;

// The live production deployment. Overridable at launch via KMLWJ_APP_URL for
// staging/testing, but defaults to the canonical apex domain in every build.
const LIVE_URL = (process.env.KMLWJ_APP_URL || 'https://kmlwj.com').replace(/\/+$/, '');

log.transports.file.level = 'info';
log.transports.console.level = isDev ? 'debug' : false; // no console noise in production
Object.assign(console, log.functions); // route any stray console.* through electron-log too

let mainWindow = null;
let splashWindow = null;
let updater = null;
let healthCheckTimer = null;
let startupWatchdog = null;

// Longest we'll sit on the splash screen before showing the offline screen.
// A cold Vercel serverless start plus TLS can legitimately take ~10s on a slow
// connection, so this is generous — but bounded, so the app can never hang.
const STARTUP_TIMEOUT_MS = 30000;

function iconPath() {
  const ico = path.join(__dirname, '..', 'build', 'icon.ico');
  const png = path.join(__dirname, '..', 'build', 'icon.png');
  return fs.existsSync(ico) ? ico : png;
}

function setSplashStatus(text) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('splash:status', text);
  }
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  splashWindow = null;
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    resizable: false,
    movable: true,
    transparent: false,
    backgroundColor: '#080808',
    show: false,
    icon: iconPath(),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'splash-preload.cjs'),
    },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.once('ready-to-show', () => splashWindow.show());
}

/** One quick HEAD/GET to /api/health so we can show a clean offline screen instead of a white flash + browser error page when there's no internet. */
function checkReachable(timeoutMs = STARTUP_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    try {
      const client = LIVE_URL.startsWith('https') ? https : http;
      const req = client.get(`${LIVE_URL}/api/health`, { timeout: timeoutMs }, (res) => {
        res.resume();
        done(res.statusCode >= 200 && res.statusCode < 500); // any real HTTP answer means the server is up
      });
      req.on('error', () => done(false));
      req.on('timeout', () => { req.destroy(); done(false); });
    } catch {
      done(false);
    }
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    resizable: true,
    frame: true, // native OS window frame, per spec
    backgroundColor: '#080808', // dark theme — avoids a white flash before first paint
    show: false,
    icon: iconPath(),
    title: 'KMLWJ Enterprise Financial Suite',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      devTools: isDev, // DevTools binary path is only wired up in dev builds
    },
  });

  Menu.setApplicationMenu(buildMenu({ mainWindow, isDev }));

  // Keep in-app navigation on the live origin inside the window; send anything
  // that points elsewhere (target=_blank, external links) to the OS browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Native "Save As" dialog for the app's existing PDF/Excel/CSV exports
  // (jsPDF / xlsx already trigger a browser-style download; Electron's default
  // download behavior just saves to Downloads — this upgrades it to a picker).
  mainWindow.webContents.session.on('will-download', (_event, item) => {
    const suggested = item.getFilename();
    const savePath = dialog.showSaveDialogSync(mainWindow, { defaultPath: suggested });
    if (savePath) item.setSavePath(savePath);
    else item.cancel();
  });

  // If the live site can't load (dropped connection mid-session, DNS hiccup),
  // show our branded offline screen instead of Chromium's raw error page.
  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDesc, validatedURL, isMainFrame) => {
    // -3 (ABORTED) fires on ordinary in-app redirects — ignore it.
    if (!isMainFrame || errorCode === -3) return;
    log.warn('[load-failed]', errorCode, errorDesc, validatedURL);
    loadOfflineScreen();
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    closeSplash();
    if (!isDev) updater?.checkForUpdates();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (healthCheckTimer) clearInterval(healthCheckTimer);
  });
}

function loadOfflineScreen() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.loadFile(path.join(__dirname, 'offline.html')).catch((err) => log.error('[offline-screen]', err));
  mainWindow.show();
  closeSplash();
}

/** Periodically pings the live /api/health so the injected offline banner reflects reality, not just raw internet status. */
function startHealthCheck() {
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  healthCheckTimer = setInterval(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const reachable = await checkReachable(4000);
    mainWindow.webContents.send('backend:status', { reachable });
  }, 30000);
}

// Only the first fatal error should ever reach the user — otherwise a flaky
// connection could stack up identical modal dialogs to dismiss.
let fatalErrorShown = false;
function showFatalError(message) {
  if (fatalErrorShown) {
    log.error('[fatal-suppressed]', message);
    return;
  }
  fatalErrorShown = true;
  if (startupWatchdog) clearTimeout(startupWatchdog);
  dialog.showErrorBox('KMLWJ could not start', message);
  app.quit();
}

async function boot() {
  createSplashWindow();
  setSplashStatus('Connecting to KMLWJ...');
  log.info(`[boot] thin client target: ${LIVE_URL}`);

  createMainWindow();
  updater = initUpdater(mainWindow);

  // Probe once so a truly offline machine lands on the branded offline screen
  // rather than staring at a spinner. If it's reachable we load the live app;
  // if not, the offline screen offers a Retry that re-runs this whole flow.
  const reachable = await checkReachable();
  if (reachable) {
    setSplashStatus('Loading application...');
    mainWindow.loadURL(LIVE_URL);
  } else {
    log.warn('[boot] live site unreachable at startup — showing offline screen');
    loadOfflineScreen();
  }

  startHealthCheck();
}

// ── Single instance ──────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(boot);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) boot();
  });
}

// ── IPC handlers (renderer → main), matching preload.cjs's exposed surface ──
ipcMain.handle('app:get-version', () => app.getVersion());

ipcMain.handle('app:notify', (_event, { title, body }) => {
  showNotification({ title, body });
  return true;
});

ipcMain.on('app:print-native', () => {
  mainWindow?.webContents.print({ silent: false, printBackground: true });
});

// Retry from the offline screen re-runs the reachability probe + load.
ipcMain.on('app:retry-connection', async () => {
  fatalErrorShown = false;
  if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
  const reachable = await checkReachable();
  if (reachable) mainWindow.loadURL(LIVE_URL);
  else loadOfflineScreen();
});

ipcMain.on('app:check-for-updates', () => updater?.checkForUpdates());
ipcMain.on('app:download-update', () => updater?.downloadUpdate());
ipcMain.on('app:quit-and-install', () => updater?.quitAndInstall());
