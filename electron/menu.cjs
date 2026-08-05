'use strict';

const { Menu, app, shell, dialog } = require('electron');

/** Native "About" dialog — shows the installed version per the auto-update spec (users need to see what they're currently running, separate from the Settings page's live updater status). */
function showAboutDialog(mainWindow) {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About KMLWJ ERP',
    message: 'KMLWJ Enterprise Financial Suite',
    detail: `Version ${app.getVersion()}\nCopyright © ${new Date().getFullYear()} Kutchi Muslim Loharwada Welfare Jamat\n\nhttps://kmlwj.com`,
    buttons: ['OK'],
    noLink: true,
  });
}

/**
 * Native application menu. DevTools / reload-from-source items only appear in
 * dev builds — the "remove dev features" requirement keeps them out of
 * `app.isPackaged` production installs entirely (not just hidden/disabled).
 */
function buildMenu({ mainWindow, isDev }) {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Print',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow.webContents.print({ silent: false, printBackground: true }),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }] : []),
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About KMLWJ',
          click: () => showAboutDialog(mainWindow),
        },
        {
          label: 'Visit kmlwj.com',
          click: () => shell.openExternal('https://kmlwj.com'),
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

module.exports = { buildMenu };
