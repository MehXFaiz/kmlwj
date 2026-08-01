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
  progress: 0,
  errorMessage: null,

  init: () => {
    if (get().initialized || !window.desktop?.isElectron) return;
    set({ initialized: true });

    window.desktop.getAppVersion().then((version) => set({ version }));

    window.desktop.onUpdateStatus((payload) => {
      const { state, version: latestVersion, message } = payload || {};
      if (state === 'checking') set({ status: 'checking', errorMessage: null });
      else if (state === 'available') set({ status: 'available', latestVersion, progress: 0, errorMessage: null });
      else if (state === 'up-to-date') set({ status: 'up-to-date', errorMessage: null });
      else if (state === 'downloaded') set({ status: 'downloaded', latestVersion, progress: 100 });
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
