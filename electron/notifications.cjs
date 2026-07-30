'use strict';

const { Notification, nativeImage } = require('electron');
const path = require('node:path');

const iconPath = path.join(__dirname, '..', 'build', 'icon.png');

/**
 * Fires a native Windows toast notification. `silent: false` (the default)
 * plays the system notification sound, matching the "sound support" requirement.
 */
function showNotification({ title, body, silent = false, onClick } = {}) {
  if (!Notification.isSupported()) return null;

  const notification = new Notification({
    title: title || 'KMLWJ',
    body: body || '',
    icon: nativeImage.createFromPath(iconPath),
    silent,
  });

  if (onClick) notification.on('click', onClick);
  notification.show();
  return notification;
}

module.exports = { showNotification };
