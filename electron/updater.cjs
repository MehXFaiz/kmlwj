'use strict';

// Wraps electron-updater. Actual auto-update only fires once a real `publish`
// target is configured in electron-builder.yml (a GitHub repo or a generic
// static file host serving latest.yml + the installer) — see the comments
// there. Until then this module simply no-ops on checkForUpdates() failures
// instead of throwing, so a dev build without a publish target never crashes.

const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// electron-updater logs its own failures at [error] level *before* our
// on('error') handler runs. Auto-update is a background, non-blocking subsystem
// (a failed check never affects the user), and the most common "failure" is
// simply "no GitHub Release published yet" — which is expected, not a bug. So we
// hand the library a logger that downgrades its error() to warn(), keeping the
// log clean and honest: real problems still appear (as warnings), but a routine
// pre-release check never litters the log with scary [error] lines.
autoUpdater.logger = {
  info: (...a) => log.info(...a),
  warn: (...a) => log.warn(...a),
  debug: (...a) => log.debug(...a),
  error: (...a) => log.warn('[updater]', ...a),
};
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
