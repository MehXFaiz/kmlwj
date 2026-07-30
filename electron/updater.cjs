'use strict';

// Wraps electron-updater. Actual auto-update only fires once a real `publish`
// target is configured in electron-builder.yml (a GitHub repo or a generic
// static file host serving latest.yml + the installer) — see the comments
// there. Until then this module simply no-ops on checkForUpdates() failures
// instead of throwing, so a dev build without a publish target never crashes.

const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

autoUpdater.logger = log;
autoUpdater.autoDownload = false; // ask before pulling a multi-hundred-MB installer over the user's connection
autoUpdater.autoInstallOnAppQuit = true;

function initUpdater(mainWindow) {
  const send = (channel, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  };

  autoUpdater.on('checking-for-update', () => send('updater:status', { state: 'checking' }));
  autoUpdater.on('update-available', (info) => send('updater:status', { state: 'available', version: info.version }));
  autoUpdater.on('update-not-available', () => send('updater:status', { state: 'up-to-date' }));
  autoUpdater.on('download-progress', (progress) => send('updater:progress', { percent: progress.percent }));
  autoUpdater.on('update-downloaded', (info) => send('updater:status', { state: 'downloaded', version: info.version }));
  autoUpdater.on('error', (error) => {
    log.warn('[updater] error (expected until a publish target is configured):', error?.message);
    send('updater:status', { state: 'error', message: error?.message });
  });

  return {
    checkForUpdates: () => autoUpdater.checkForUpdates().catch((error) => log.warn('[updater] check failed:', error?.message)),
    downloadUpdate: () => autoUpdater.downloadUpdate().catch((error) => log.warn('[updater] download failed:', error?.message)),
    quitAndInstall: () => autoUpdater.quitAndInstall(),
  };
}

module.exports = { initUpdater };
