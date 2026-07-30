'use strict';

// Forks the pre-compiled Express backend (electron-dist/server/scripts/electron-server-entry.js)
// as a real child process, tracks its lifecycle over Electron's IPC, and
// restarts it with backoff if it crashes unexpectedly (a dropped DB connection
// or an unhandled exception shouldn't force the whole desktop app to close).
//
// Uses Electron's utilityProcess.fork() rather than Node's child_process.fork().
// utilityProcess is Electron's first-class API for running a Node.js script from
// the main process: it needs no ELECTRON_RUN_AS_NODE juggling and does not spawn
// through `process.execPath` (which, in a packaged app, is the app's own .exe).
//
// Historical note, because the symptom was badly misleading: the packaged build
// originally failed with `spawn C:\...\KMLWJ ERP.exe ENOENT`. That error names
// the executable, but the actual invalid argument was `cwd` — it pointed inside
// app.asar, which is an archive, not a real directory. Windows rejects a
// non-existent cwd and Node reports it against the executable. The fix was
// disabling asar (see electron-builder.yml), not anything about the exe path.

const { utilityProcess, app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const MAX_RESTART_ATTEMPTS = 5;
const RESTART_BASE_DELAY_MS = 2000;

let child = null;
let restartAttempts = 0;
let intentionalShutdown = false;
let restartTimer = null;
let handlers = {};
let lastLaunchOptions = null;

/**
 * Root of the packaged/dev file tree that electron-dist/ and dist/ live under.
 * Packaged builds set `asar: false` (see electron-builder.yml for why), so the
 * app tree is plain files under resources/app — real paths that are valid as a
 * child-process cwd and resolvable by Node's ESM loader.
 */
function appRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app')
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

  // Fail loudly and specifically if the compiled backend is missing, rather
  // than letting fork() fail in a way that surfaces as an opaque spawn error.
  if (!fs.existsSync(entry)) {
    handlers.onError?.(
      `The application backend is missing from this installation.\n\nExpected:\n${entry}\n\nReinstalling the app should resolve this.`
    );
    return null;
  }

  const env = {
    ...process.env,
    ...opts.env,
    NODE_ENV: 'production',
    KMLWJ_ENV_PATH: opts.envFilePath,
    KMLWJ_FRONTEND_DIST: frontendDistPath(),
    PORT: opts.env.PORT || '0',
  };

  try {
    child = utilityProcess.fork(entry, [], {
      // cwd must be a real directory on disk. It resolves to resources/app/...
      // in packaged builds because asar is disabled — see electron-builder.yml.
      cwd: path.dirname(entry),
      env,
      stdio: 'pipe', // capture stdio instead of inheriting Electron's console
    });
  } catch (error) {
    handlers.onError?.(`Could not start the application backend: ${error.message}`);
    return null;
  }

  // Pipe errors (EPIPE when the child goes away mid-write) are diagnostics
  // plumbing, never a reason to tear the app down — swallow them here so they
  // can't bubble up as an unhandled 'error' event or a fatal dialog.
  child.stdout?.on('data', (buf) => handlers.onLog?.(buf.toString().trim()));
  child.stderr?.on('data', (buf) => handlers.onLog?.(buf.toString().trim()));
  child.stdout?.on('error', () => {});
  child.stderr?.on('error', () => {});

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
      try { target?.kill(); } catch { /* already gone */ }
      resolve();
    }, 3000);
    target.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    // If the child already died, postMessage throws / EPIPEs — that's a
    // successful shutdown from our point of view, not an error to report.
    try {
      target.postMessage({ type: 'shutdown' });
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });
}

module.exports = { startServer, stopServer, frontendDistPath };
