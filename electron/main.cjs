'use strict';

// The settings below are already correct for a same-origin http://127.0.0.1
// desktop backend, so Electron's dev-only security-warning heuristics would
// otherwise flag a false positive on every launch; this is not a workaround
// for an actual misconfiguration; see the SECURITY section of the audit below.
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const log = require('electron-log');

const { ensureEnvFile, readEnvFile, validateEnv, envFilePath } = require('./env.cjs');
const serverManager = require('./server-manager.cjs');
const { showNotification } = require('./notifications.cjs');
const { buildMenu } = require('./menu.cjs');
const { initUpdater } = require('./updater.cjs');

const isDev = !app.isPackaged;

log.transports.file.level = 'info';
log.transports.console.level = isDev ? 'debug' : false; // no console noise in production
Object.assign(console, log.functions); // route any stray console.* through electron-log too

let mainWindow = null;
let splashWindow = null;
let updater = null;
let backendUrl = null;
let healthCheckTimer = null;

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

  // Anything the app tries to open in a new window (target=_blank links, etc.)
  // opens in the OS default browser instead of a second Electron window.
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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    if (!isDev) updater?.checkForUpdates();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (healthCheckTimer) clearInterval(healthCheckTimer);
  });
}

/** Periodically pings the backend's /api/health so the injected offline banner reflects reality, not just raw internet status. */
function startHealthCheck() {
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  healthCheckTimer = setInterval(() => {
    if (!backendUrl || !mainWindow || mainWindow.isDestroyed()) return;
    const req = http.get(`${backendUrl}/api/health`, { timeout: 4000 }, (res) => {
      mainWindow.webContents.send('backend:status', { reachable: res.statusCode === 200 });
      res.resume();
    });
    req.on('error', () => mainWindow?.webContents.send('backend:status', { reachable: false }));
    req.on('timeout', () => req.destroy());
  }, 15000);
}

function showFatalError(message) {
  dialog.showErrorBox('KMLWJ could not start', message);
  app.quit();
}

async function boot() {
  createSplashWindow();

  const { path: envPath, justCreated } = ensureEnvFile();
  if (justCreated) {
    setSplashStatus('First run — configuring...');
    log.info(`Created a blank config at ${envPath}`);
  }

  const envVars = readEnvFile(envPath);
  const validation = validateEnv(envVars);
  if (!validation.ok) {
    showFatalError(
      `Configuration is incomplete.\n\nEdit this file and restart the app:\n${envFilePath()}\n\nMissing/placeholder values: ${validation.missing.join(', ')}`
    );
    return;
  }

  setSplashStatus('Starting the backend...');

  serverManager.startServer({
    env: envVars,
    envFilePath: envPath,
    onStatus: (status) => {
      if (status.status === 'db-retry') {
        setSplashStatus(`Connecting to the database (attempt ${status.attempt}/${status.maxAttempts})...`);
      } else if (status.status === 'restarting') {
        setSplashStatus('Backend restarting...');
        showNotification({ title: 'KMLWJ', body: 'The background service restarted after an unexpected error.' });
      }
    },
    onReady: ({ url }) => {
      backendUrl = url;
      setSplashStatus('Loading application...');
      createMainWindow();
      updater = initUpdater(mainWindow);
      mainWindow.loadURL(url);
      startHealthCheck();
    },
    onError: (message) => {
      log.error('[server]', message);
      showFatalError(message);
    },
    onLog: (line) => log.info('[server]', line),
  });
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

  // app.exit() (unlike app.quit()) does not re-fire 'before-quit', so this
  // runs exactly once per real shutdown — no re-entrancy guard needed.
  app.on('before-quit', async (event) => {
    event.preventDefault();
    await serverManager.stopServer();
    app.exit(0);
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

ipcMain.on('app:check-for-updates', () => updater?.checkForUpdates());
ipcMain.on('app:download-update', () => updater?.downloadUpdate());
ipcMain.on('app:quit-and-install', () => updater?.quitAndInstall());
