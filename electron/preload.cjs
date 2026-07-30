'use strict';

// Secure bridge between the sandboxed renderer (the unmodified React app) and
// the main process. contextIsolation + sandbox are both on and nodeIntegration
// is off (see main.cjs), so this is the ONLY surface the renderer can reach —
// no direct `require`, no raw ipcRenderer, no Node globals leak through.
//
// The React app itself needs none of this to function: it is loaded live from
// https://kmlwj.com and already talks to its backend over relative `/api/...`
// fetches (same-origin) and already uses window.print() / <a download> for
// printing and exports, both of which work unmodified in a Chromium renderer.
// This bridge only adds desktop-native extras (toast notifications,
// connectivity status, native print, offline-screen retry, auto-update).

const { contextBridge, ipcRenderer } = require('electron');

// Every channel the renderer can reach is named explicitly below — no generic
// `send(channel, ...)`/`invoke(channel, ...)` passthrough is exposed, so the
// renderer can never reach an IPC channel this file didn't intentionally wire up.
contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
  platform: process.platform,
  versions: { app: process.env.npm_package_version },

  getAppVersion: () => ipcRenderer.invoke('app:get-version'),

  notify: (title, body) => ipcRenderer.invoke('app:notify', { title, body }),

  printNative: () => ipcRenderer.send('app:print-native'),

  /** Re-probe the live site and reload it — used by the branded offline screen's Retry button. */
  retryConnection: () => ipcRenderer.send('app:retry-connection'),

  /** Backend readiness / connectivity pushed from main (a periodic health ping against the live /api/health). */
  onBackendStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('backend:status', listener);
    return () => ipcRenderer.removeListener('backend:status', listener);
  },

  checkForUpdates: () => ipcRenderer.send('app:check-for-updates'),
  downloadUpdate: () => ipcRenderer.send('app:download-update'),
  quitAndInstall: () => ipcRenderer.send('app:quit-and-install'),
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('updater:status', listener);
    return () => ipcRenderer.removeListener('updater:status', listener);
  },
  onUpdateProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('updater:progress', listener);
    return () => ipcRenderer.removeListener('updater:progress', listener);
  },
});

// ── Offline / backend-unreachable banner ─────────────────────────────────
// Injected directly into the page DOM from the isolated preload world — this
// satisfies "show an offline banner" without touching a single line of the
// React source (contextIsolation isolates JS *contexts*, not the DOM tree,
// so a preload script can still append real elements to document.body).
window.addEventListener('DOMContentLoaded', () => {
  const banner = document.createElement('div');
  banner.textContent = 'You are offline — retrying automatically…';
  Object.assign(banner.style, {
    position: 'fixed', top: '0', left: '0', right: '0', zIndex: '2147483647',
    background: '#7a2e2e', color: '#fff', textAlign: 'center',
    font: '600 12px "Plus Jakarta Sans", system-ui, sans-serif',
    padding: '6px 12px', letterSpacing: '0.02em',
    transform: 'translateY(-100%)', transition: 'transform 0.25s ease',
    boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
  });
  document.body.appendChild(banner);

  let backendUp = true;
  let internetUp = navigator.onLine;

  const render = () => {
    if (!internetUp) {
      banner.textContent = 'No internet connection — retrying automatically…';
    } else if (!backendUp) {
      banner.textContent = 'Cannot reach the KMLWJ server — retrying automatically…';
    }
    banner.style.transform = internetUp && backendUp ? 'translateY(-100%)' : 'translateY(0)';
  };

  window.addEventListener('online', () => { internetUp = true; render(); });
  window.addEventListener('offline', () => { internetUp = false; render(); });
  ipcRenderer.on('backend:status', (_event, status) => {
    backendUp = status?.reachable !== false;
    render();
  });
});
