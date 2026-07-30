/**
 * Compiles the ENTIRE api/ TypeScript tree + the Electron server entry point to
 * plain JavaScript, mirrored into electron-dist/server/.
 *
 * This is deliberately separate from scripts/compile-api-shared.mjs, which only
 * compiles the underscore-prefixed "shared" folders because Vercel's own builder
 * compiles the top-level route entry (api/index.ts) itself. The desktop app has
 * no Vercel builder, so every .ts file under api/ — including api/index.ts and
 * api/_health.ts — has to be compiled here. Output goes to a separate directory
 * so this never collides with (or needs to touch) the Vercel build pipeline.
 *
 * Each file is transpiled individually (not bundled) with `packages: 'external'`,
 * exactly like compile-api-shared.mjs, because:
 *   - Every import in the source already uses the compiled `.js` extension
 *     (NodeNext style), so a 1:1 file mirror needs no import-rewriting.
 *   - node_modules (express, pg, @prisma/client, bcrypt, ...) stay real
 *     dependencies on disk, which is required for native addons (bcrypt,
 *     Prisma's query engine) — bundling them would break native bindings.
 */
import { readdirSync, statSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import * as esbuild from 'esbuild';

const ROOT = process.cwd();
const API_DIR = join(ROOT, 'api');
const OUT_DIR = join(ROOT, 'electron-dist', 'server');

function collectTsFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
    } else if (entry.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

async function compileFile(srcFile, outFile) {
  mkdirSync(dirname(outFile), { recursive: true });
  await esbuild.build({
    entryPoints: [srcFile],
    outfile: outFile,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    packages: 'external',
    logLevel: 'warning',
  });
}

async function main() {
  console.log('[build-electron-server] Cleaning electron-dist/server...');
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  if (!existsSync(API_DIR)) {
    throw new Error('api/ directory not found — run this from the project root.');
  }

  const apiFiles = collectTsFiles(API_DIR);
  console.log(`[build-electron-server] Compiling ${apiFiles.length} api/ file(s)...`);
  for (const file of apiFiles) {
    const rel = relative(ROOT, file).replace(/\.ts$/, '.js');
    await compileFile(file, join(OUT_DIR, rel));
  }

  const entry = join(ROOT, 'scripts', 'electron-server-entry.ts');
  const entryOut = join(OUT_DIR, 'scripts', 'electron-server-entry.js');
  console.log('[build-electron-server] Compiling scripts/electron-server-entry.ts...');
  await compileFile(entry, entryOut);

  console.log(`[build-electron-server] Done. Output: ${relative(ROOT, OUT_DIR)}`);
  console.log(`[build-electron-server] Server entry: ${relative(ROOT, entryOut)}`);
}

main().catch((error) => {
  console.error('[build-electron-server] Build failed:', error);
  process.exit(1);
});
