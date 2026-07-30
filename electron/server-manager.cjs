'use strict';

// Forks the pre-compiled Express backend (electron-dist/server/scripts/electron-server-entry.js)
// as a real child process, tracks its lifecycle over Electron's IPC, and
// restarts it with backoff if it crashes unexpectedly (a dropped DB connection
// or an unhandled exception shouldn't force the whole desktop app to close).
//
// Uses Electron's utilityProcess.fork() rather than Node's child_process.fork().
// child_process.fork() spawns via `process.execPath`, which inside a packaged
// Electron app IS the app's own installed .exe — if that path doesn't resolve
// cleanly at runtime (seen in practice with a per-user NSIS install pointed at
// Program Files without admin rights, where the installer's write silently
// redirects and the shortcut/registered path disagrees with reality), fork()
// fails with `spawn ...\App.exe ENOENT`. utilityProcess.fork() is Electron's
// own first-class API for exactly this (spawn a Node.js script from the main
// process) and isn't affected by that class of path mismatch at all.

const { utilityProcess } = require('electron');
const path = require('node:path');
const { app } = require('electron');

const MAX_RESTART_ATTEMPTS = 5;
const RESTART_BASE_DELAY_MS = 2000;

let child = null;
let restartAttempts = 0;
let intentionalShutdown = false;
let restartTimer = null;
let handlers = {};
let lastLaunchOptions = null;

/** Root of the packaged/dev file tree that electron-dist/ and dist/ live under. */
function appRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar')
    : path.join(__dirname, '..');
}

function serverEntryPath() {
  return path.join(appRoot(), 'electron-dist', 'server', 'scripts', 'electron-server-entry.js');
}

function frontendDistPath() {
  return path.join(appRoot(), 'dist');
}

/**
 * @param {object} opts
 * @param {Record<string,string>} opts.env - parsed userData .env values
 * @param {string} opts.envFilePath - absolute path to the .env file itself
 * @param {(status: object) => void} opts.onStatus - db-retry / starting updates
 * @param {(info: {port:number, url:string}) => void} opts.onReady
 * @param {(message: string) => void} opts.onError
 * @param {(line: string) => void} [opts.onLog]
 */
function startServer(opts) {
  lastLaunchOptions = opts;
  handlers = opts;

  const entry = serverEntryPath();
  const env = {
    ...process.env,
    ...opts.env,
    NODE_ENV: 'production',
    KMLWJ_ENV_PATH: opts.envFilePath,
    KMLWJ_FRONTEND_DIST: frontendDistPath(),
    PORT: opts.env.PORT || '0',
  };

  child = utilityProcess.fork(entry, [], {
    cwd: path.dirname(entry),
    env,
    stdio: 'pipe', // capture stdio instead of inheriting Electron's console
  });

  child.stdout?.on('data', (buf) => handlers.onLog?.(buf.toString().trim()));
  child.stderr?.on('data', (buf) => handlers.onLog?.(buf.toString().trim()));

  child.on('message', (raw) => {
    // The child sends via process.parentPort.postMessage(msg); the main-side
    // listener is documented to receive the raw value, but fall back to
    // `.data` defensively in case a future Electron version wraps it.
    const msg = raw && typeof raw === 'object' && 'data' in raw && !('type' in raw) ? raw.data : raw;
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case 'server-ready':
        restartAttempts = 0;
        handlers.onReady?.({ port: msg.port, url: msg.url });
        break;
      case 'server-status':
        handlers.onStatus?.(msg);
        break;
      case 'server-error':
        handlers.onError?.(msg.message || 'Unknown backend error');
        break;
      default:
        break;
    }
  });

  child.on('exit', (code) => {
    child = null;
    if (intentionalShutdown) return;

    if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
      handlers.onError?.(
        `Backend process exited (code ${code}) and failed to recover after ${MAX_RESTART_ATTEMPTS} attempts.`
      );
      return;
    }

    restartAttempts += 1;
    const delay = RESTART_BASE_DELAY_MS * restartAttempts;
    handlers.onStatus?.({ type: 'server-status', status: 'restarting', attempt: restartAttempts, delay });
    restartTimer = setTimeout(() => {
      if (!intentionalShutdown) startServer(lastLaunchOptions);
    }, delay);
  });

  return child;
}

/** Graceful stop: ask the child to close its DB pool/HTTP server, then force-kill if it hangs. */
function stopServer() {
  intentionalShutdown = true;
  if (restartTimer) clearTimeout(restartTimer);
  if (!child) return Promise.resolve();

  return new Promise((resolve) => {
    const target = child;
    const timer = setTimeout(() => {
      target?.kill();
      resolve();
    }, 3000);
    target.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    target.postMessage({ type: 'shutdown' });
  });
}

module.exports = { startServer, stopServer, frontendDistPath };
