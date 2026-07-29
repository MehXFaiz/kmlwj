/**
 * i18n coverage audit.
 *
 * Walks every .jsx/.js file under src/ and reports user-visible strings that
 * are still hardcoded rather than routed through a translation key, so the
 * path to full Urdu coverage is measurable rather than guessed at.
 *
 * Detects four categories:
 *   text   - JSX text nodes            <div>Save Changes</div>
 *   attr   - user-visible attributes   placeholder="Search donors"
 *   toast  - notification/alert copy   showToast('Saved successfully')
 *   throw  - user-facing error copy    throw new Error('Amount required')
 *
 * Usage:
 *   node scripts/i18n-audit.mjs            summary per file
 *   node scripts/i18n-audit.mjs --detail   every individual string
 *   node scripts/i18n-audit.mjs --json     machine-readable, for CI
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = 'src';
const args = process.argv.slice(2);
const DETAIL = args.includes('--detail');
const JSON_OUT = args.includes('--json');

// Files that legitimately contain no user-visible copy.
const SKIP_FILES = [/\/locales\//, /\/i18n\.js$/, /\.test\./, /\.spec\./];

// Attributes whose values are rendered to or announced at the user.
const VISIBLE_ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'label'];

/**
 * Strings that are not user-visible copy even though they look like prose:
 * CSS class soups, import paths, format tokens, enum/status values compared
 * against the database, and single words that are almost always identifiers.
 */
function isNotCopy(s) {
  const t = s.trim();
  if (t.length < 3) return true;
  if (!/[a-zA-Z]/.test(t)) return true;               // digits/punctuation only
  if (/^[a-z0-9_-]+$/.test(t)) return true;           // slug / identifier
  if (/^[A-Z0-9_]+$/.test(t)) return true;            // CONSTANT / enum value
  if (/(^|\s)(bg|text|border|flex|grid|px|py|mt|mb|rounded|hover:|dark:|w-|h-)-?/.test(t)) return true;
  if (/^https?:|^\/|^\.\.?\//.test(t)) return true;   // url / path
  if (/^[#@.]/.test(t)) return true;
  if (/^(YYYY|DD|MM|HH|mm|ss)/.test(t)) return true;  // date format token
  if (!/\s/.test(t) && t.length < 4) return true;
  return false;
}

function collect(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { collect(full, out); continue; }
    if (!/\.(jsx|js)$/.test(entry)) continue;
    const rel = full.replace(/\\/g, '/');
    if (SKIP_FILES.some(re => re.test(rel))) continue;
    out.push(full);
  }
  return out;
}

function auditFile(file) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const findings = [];
  const hasHook = /useTranslation/.test(src);

  lines.forEach((line, i) => {
    const lineNo = i + 1;
    // Skip comment-only lines — comments are not shipped to users.
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

    // 1. JSX text nodes: >Some Text<
    for (const m of line.matchAll(/>\s*([A-Za-z][^<>{}\n]{2,80}?)\s*</g)) {
      const s = m[1];
      if (isNotCopy(s)) continue;
      findings.push({ kind: 'text', line: lineNo, value: s.trim() });
    }

    // 2. User-visible attributes
    for (const attr of VISIBLE_ATTRS) {
      const re = new RegExp(`${attr}=["']([^"'{}]{3,90})["']`, 'g');
      for (const m of line.matchAll(re)) {
        if (isNotCopy(m[1])) continue;
        findings.push({ kind: 'attr', line: lineNo, value: `${attr}="${m[1].trim()}"` });
      }
    }

    // 3. Toast / alert copy
    for (const m of line.matchAll(/(?:showToast|toast\.\w+|alert)\(\s*["'`]([^"'`]{3,120})["'`]/g)) {
      if (isNotCopy(m[1])) continue;
      findings.push({ kind: 'toast', line: lineNo, value: m[1].trim() });
    }

    // 4. User-facing thrown errors
    for (const m of line.matchAll(/new Error\(\s*["'`]([^"'`]{3,120})["'`]/g)) {
      if (isNotCopy(m[1])) continue;
      findings.push({ kind: 'throw', line: lineNo, value: m[1].trim() });
    }

    // 5. Copy held in object/config literals rather than inline JSX — nav item
    //    labels, table column headers, select options, status maps, tab names.
    //    e.g. { icon: ShieldCheck, label: 'Bank-Grade Security', desc: '...' }
    const COPY_KEYS = /\b(label|title|desc|description|header|heading|message|text|caption|tooltip|placeholder|emptyText|subtitle|name)\s*:\s*["']([^"']{3,120})["']/g;
    for (const m of line.matchAll(COPY_KEYS)) {
      if (isNotCopy(m[2])) continue;
      findings.push({ kind: 'config', line: lineNo, value: `${m[1]}: "${m[2].trim()}"` });
    }

    // 6. Multi-line JSX text nodes — a line that is bare prose sitting between
    //    tags, which the single-line >text< pattern above cannot see:
    //        <h1 className="...">
    //          Welcome Back
    //        </h1>
    if (/^[A-Z][A-Za-z0-9 ,.'’&()/!?:-]{2,90}$/.test(trimmed)) {
      const prev = (lines[i - 1] || '').trim();
      const next = (lines[i + 1] || '').trim();
      const insideJsx = prev.endsWith('>') || prev.endsWith('{') || next.startsWith('<');
      // Exclude lines that are really code: object keys, JSX props, calls.
      const looksLikeCode = /[{}=;]|=>|\bconst\b|\bimport\b|\breturn\b/.test(trimmed);
      if (insideJsx && !looksLikeCode && next.startsWith('<')) {
        findings.push({ kind: 'text', line: lineNo, value: trimmed });
      }
    }
  });

  return { file: relative(process.cwd(), file).replace(/\\/g, '/'), hasHook, findings };
}

const results = collect(SRC).map(auditFile).filter(r => r.findings.length > 0);
results.sort((a, b) => b.findings.length - a.findings.length);

if (JSON_OUT) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

const total = results.reduce((s, r) => s + r.findings.length, 0);
const byKind = {};
for (const r of results) for (const f of r.findings) byKind[f.kind] = (byKind[f.kind] || 0) + 1;

console.log('\n  i18n COVERAGE AUDIT');
console.log('  ' + '='.repeat(62));
console.log(`  Files with hardcoded copy : ${results.length}`);
console.log(`  Total hardcoded strings   : ${total}`);
console.log(`  By kind                   : ${Object.entries(byKind).map(([k, v]) => `${k}=${v}`).join('  ')}`);
console.log('  ' + '='.repeat(62) + '\n');

for (const r of results) {
  console.log(`  ${String(r.findings.length).padStart(4)}  ${r.hasHook ? ' ' : '!'} ${r.file}`);
  if (DETAIL) {
    for (const f of r.findings) {
      console.log(`          ${String(f.line).padStart(5)}  [${f.kind.padEnd(5)}] ${f.value}`);
    }
  }
}
console.log('\n  ("!" marks a file that does not import useTranslation at all)\n');
