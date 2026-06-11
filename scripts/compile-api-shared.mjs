/**
 * Pre-compiles private api/ shared modules (_utils, _services, etc.) to .js
 * before Vercel packages serverless functions.
 *
 * Vercel compiles route entry points (api/auth/*.ts) but does not emit .js for
 * underscore-prefixed helper folders, so runtime imports like '../_utils/handler.js'
 * fail unless those files exist as compiled JavaScript.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as esbuild from 'esbuild';

const API_DIR = 'api';

function collectSharedTsFiles(dir, insidePrivateFolder = false) {
  const files = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (entry.startsWith('_')) {
        files.push(...collectSharedTsFiles(fullPath, true));
      }
      continue;
    }

    if (entry.endsWith('.ts') && insidePrivateFolder) {
      files.push(fullPath);
    }
  }

  return files;
}

const sharedFiles = [
  ...collectSharedTsFiles(API_DIR),
  join(API_DIR, '_prisma.ts'),
].filter((file, index, all) => all.indexOf(file) === index);

if (sharedFiles.length === 0) {
  console.warn('[compile-api-shared] No shared api TypeScript files found.');
  process.exit(0);
}

console.log(`[compile-api-shared] Compiling ${sharedFiles.length} shared module(s)...`);

for (const file of sharedFiles) {
  const outfile = file.replace(/\.ts$/, '.js');
  await esbuild.build({
    entryPoints: [file],
    outfile,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    packages: 'external',
    logLevel: 'warning',
  });
  console.log(`  ${relative(process.cwd(), file)} -> ${relative(process.cwd(), outfile)}`);
}

console.log('[compile-api-shared] Done.');
