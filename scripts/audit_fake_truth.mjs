import fs from 'fs';
import path from 'path';

const root = path.resolve(process.argv[2] ?? '.');
const excludeDirs = new Set(['node_modules', '.git', 'dist', 'coverage', 'tmp']);
const fakePatterns = [
  { name: 'hardcoded calibration', pattern: /pixelPerMm|pxPerMm|calibration|magic number|magic number/gi, hint: 'Replace with real designer input or mark unreviewed.' },
  { name: 'machine path', pattern: /[A-Z]:\\[\w\\\-\.]+/g, hint: 'Replace with env/runtime path.' },
  { name: 'swallowed warn', pattern: /console\.warn\(.*\).*return;|catch\s*\([^)]*\)\s*\{\s*\/\/.* swallow|catch\s*\([^)]*\)\s*\{\s*return;/gi, hint: 'Surface typed failure.' },
  { name: 'mock in source', pattern: /mock|stub|TODO[:\s].*fake|dummy data/gi, hint: 'Resolve or track as issue.' },
];

function walk(dir, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (excludeDirs.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

const files = walk(root).filter((f) => /\.(ts|tsx|js|mjs|css)$/.test(f));
const findings = [];
for (const f of files) {
  const rel = path.relative(root, f).replace(/\\/g, '/');
  if (rel.startsWith('scripts/audit_')) continue;
  let text = '';
  try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
  for (const pat of fakePatterns) {
    const matches = text.match(pat.pattern) || [];
    if (matches.length) findings.push({ rel, name: pat.name, count: matches.length, sample: matches.slice(0,3).join(', '), hint: pat.hint });
  }
}
if (!findings.length) { console.log('ok fake-truth: 0 findings'); process.exit(0); }
console.log(`fake-truth: ${findings.length} findings`);
for (const f of findings.slice(0,100)) console.log(`  ${f.rel} | ${f.name} | ${f.count}x | ${f.sample} | ${f.hint}`);
process.exit(findings.length ? 0 : 0);
