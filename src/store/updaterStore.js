import { create } from 'zustand';

// Bridges the Electron desktop shell's auto-updater (electron/updater.cjs,
// exposed via electron/preload.cjs's `window.desktop`) into React state. A
// complete no-op when the app is loaded in a regular browser tab — every
// consumer should check `isElectron` before rendering update UI.
export const useUpdaterStore = create((set, get) => ({
  isElectron: typeof window !== 'undefined' && !!window.desktop?.isElectron,
  initialized: false,

  version: null,
  // idle | checking | available | downloading | downloaded | up-to-date | error
  status: 'idle',
  latestVersion: null,
  releaseNotes: null,
  progress: 0,
  errorMessage: null,
  // ISO timestamp of the most recent checking-for-update event, for the
  // Settings page's "Last Checked" field.
  lastChecked: null,

  init: () => {
    if (get().initialized || !window.desktop?.isElectron) return;
    set({ initialized: true });

    window.desktop.getAppVersion().then((version) => set({ version }));

    window.desktop.onUpdateStatus((payload) => {
      const { state, version: latestVersion, message, releaseNotes } = payload || {};
      if (state === 'checking') set({ status: 'checking', errorMessage: null, lastChecked: new Date().toISOString() });
      else if (state === 'available') set({ status: 'available', latestVersion, releaseNotes: releaseNotes || null, progress: 0, errorMessage: null });
      else if (state === 'up-to-date') set({ status: 'up-to-date', errorMessage: null });
      // A downloaded event's releaseNotes can be empty if info.releaseNotes wasn't
      // populated on this particular event — fall back to what 'available' already gave us.
      else if (state === 'downloaded') set((s) => ({ status: 'downloaded', latestVersion, releaseNotes: releaseNotes || s.releaseNotes, progress: 100 }));
      else if (state === 'error') set({ status: 'error', errorMessage: message || 'Update check failed' });
    });

    window.desktop.onUpdateProgress(({ percent } = {}) => {
      set((s) => ({
        progress: Math.round(percent || 0),
        // A progress event only ever fires mid-download, so this is the
        // reliable signal that "available" has moved into "downloading".
        status: s.status === 'downloaded' ? s.status : 'downloading',
      }));
    });
  },

  checkForUpdates: () => window.desktop?.checkForUpdates(),
  restartAndInstall: () => window.desktop?.quitAndInstall(),
}));
