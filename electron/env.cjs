'use strict';

// Resolves and bootstraps the runtime .env file the desktop backend reads its
// DATABASE_URL / JWT secrets / Cloudinary keys from.
//
// The installer never bakes real secrets into the app package (that would ship
// production credentials to every machine the .exe is copied to). Instead, on
// first launch we copy a blank `.env.template` into the per-user, per-machine
// userData folder (writable without admin rights, unlike Program Files), and
// the admin fills in real values there. Electron restarts pick it straight up.

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

function templatePath() {
  // electron/.env.template ships inside the asar via the "files" list — a
  // plain text read, so it's fine to read directly from inside the archive.
  return path.join(__dirname, '.env.template');
}

function envFilePath() {
  return path.join(app.getPath('userData'), '.env');
}

/**
 * Ensures a real, editable .env exists in userData. Returns:
 *   { path, justCreated }
 */
function ensureEnvFile() {
  const target = envFilePath();
  if (fs.existsSync(target)) {
    return { path: target, justCreated: false };
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  const template = templatePath();
  if (fs.existsSync(template)) {
    fs.copyFileSync(template, target);
  } else {
    fs.writeFileSync(target, '# KMLWJ desktop configuration\n# Fill in DATABASE_URL, JWT secrets and Cloudinary keys, then restart the app.\n');
  }
  return { path: target, justCreated: true };
}

/**
 * Parses the userData .env into a plain object (does NOT mutate
 * process.env — the values are handed to the forked backend's own env
 * instead, so the Electron main process never carries production DB
 * credentials in its own process environment longer than necessary).
 */
function readEnvFile(filePath) {
  const dotenv = require('dotenv');
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath);
  return dotenv.parse(raw);
}

/** Quick sanity check so the UI can explain *why* startup is stuck instead of hanging silently. */
function validateEnv(envVars) {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((key) => !envVars[key] || envVars[key].includes('your_') || envVars[key].includes('_here'));
  return { ok: missing.length === 0, missing };
}

module.exports = { ensureEnvFile, readEnvFile, validateEnv, envFilePath };
