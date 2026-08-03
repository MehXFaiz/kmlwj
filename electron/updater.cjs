'use strict';

// Wraps electron-updater. Actual auto-update only fires once a real `publish`
// target is configured in electron-builder.yml (a GitHub repo or a generic
// static file host serving latest.yml + the installer) — see the comments
// there. Until then this module simply no-ops on checkForUpdates() failures
// instead of throwing, so a dev build without a publish target never crashes.
//
// Rollback / data-safety guarantees, and why nothing extra is implemented here:
// - electron-updater verifies the downloaded installer's sha512 (from
//   latest.yml) before ever emitting 'update-downloaded' — a corrupted or
//   truncated download (e.g. connection dropped mid-transfer, which is how
//   "offline mid-update" actually manifests) fails verification and the app
//   just keeps running the current version; quitAndInstall() is never reached.
// - This app has no local database or local uploaded files to protect (see
//   the "thin client" note in main.cjs — all data lives in the cloud DB /
//   Cloudinary). NSIS-based electron-builder updates only ever replace files
//   under the installation directory; they never touch `app.getPath('userData')`
//   (where things like the persisted theme preference live), and
//   `deleteAppDataOnUninstall: false` in electron-builder.yml keeps that true
//   on uninstall too. There is nothing update-specific to preserve beyond that.

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
autoUpdater.autoDownload = true; // download in the background as soon as an update is found, per spec
autoUpdater.autoInstallOnAppQuit = true; // falls back to installing on natural quit if the user never clicks "Restart Now"

// electron-updater's UpdateInfo.releaseNotes is either a plain string or (when
// a single check spans multiple published versions) an array of per-version
// {version, note} entries — normalize both into one string for the renderer.
function normalizeReleaseNotes(notes) {
  if (!notes) return null;
  if (typeof notes === 'string') return notes;
  if (Array.isArray(notes)) return notes.map((n) => n?.note).filter(Boolean).join('\n\n') || null;
  return null;
}

function initUpdater(mainWindow) {
  const send = (channel, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  };

  autoUpdater.on('checking-for-update', () => {
    log.info('[updater] checking for update');
    send('updater:status', { state: 'checking' });
  });
  autoUpdater.on('update-available', (info) => {
    log.info('[updater] update available:', info.version);
    send('updater:status', { state: 'available', version: info.version, releaseNotes: normalizeReleaseNotes(info.releaseNotes) });
  });
  autoUpdater.on('update-not-available', () => {
    log.info('[updater] up to date');
    send('updater:status', { state: 'up-to-date' });
  });
  autoUpdater.on('download-progress', (progress) => {
    log.debug('[updater] download progress:', `${Math.round(progress.percent)}%`);
    send('updater:progress', { percent: progress.percent });
  });
  autoUpdater.on('update-downloaded', (info) => {
    log.info('[updater] update downloaded, ready to install:', info.version);
    send('updater:status', { state: 'downloaded', version: info.version, releaseNotes: normalizeReleaseNotes(info.releaseNotes) });
  });
  autoUpdater.on('error', (error) => {
    log.warn('[updater] error (expected until a publish target is configured):', error?.message);
    send('updater:status', { state: 'error', message: error?.message });
  });

  return {
    checkForUpdates: () => autoUpdater.checkForUpdates().catch((error) => log.warn('[updater] check failed:', error?.message)),
    downloadUpdate: () => autoUpdater.downloadUpdate().catch((error) => log.warn('[updater] download failed:', error?.message)),
    // isSilent=true: the NSIS installer runs with no UI of its own — the only
    // user-facing confirmation is the "Restart Now" click that triggers this.
    // isForceRunAfter=true: relaunches the app once the silent install finishes,
    // so "Restart Now" actually restarts rather than just quitting.
    quitAndInstall: () => autoUpdater.quitAndInstall(true, true),
  };
}

module.exports = { initUpdater };
