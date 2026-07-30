'use strict';

// Minimal preload for the splash window only — same contextIsolation +
// sandbox posture as the main window's preload.cjs, just a smaller surface.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('splashAPI', {
  onStatus: (callback) => {
    const listener = (_event, text) => callback(text);
    ipcRenderer.on('splash:status', listener);
    return () => ipcRenderer.removeListener('splash:status', listener);
  },
});
