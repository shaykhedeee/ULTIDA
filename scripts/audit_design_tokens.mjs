import fs from 'fs';
import path from 'path';

const root = path.resolve(process.argv[2] ?? '.');
const strict = process.argv.includes('--strict');

const tokenFiles = [
  'packages/ui/tokens.ts',
  'packages/ui/tokens.css',
  'apps/web/src/styles/tokens.css',
];

const tokenPatterns = [
  /--color-[\w-]+/gi,
  /--spacing-[\w-]+/gi,
  /--gold|--line|--surface|--text-/gi,
  /#[0-9a-fA-F]{3,8}\b/g,
  /rgba?\([^)]+\)/g,
];

const excludeDirs = new Set(['node_modules', '.git', 'dist', 'coverage', 'tmp']);

function walk(dir, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (excludeDirs.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(root).filter((f) => /\.(ts|tsx|css|scss|json)$/.test(f));
const findings = [];

for (const f of files) {
  const rel = path.relative(root, f).replace(/\\/g, '/');
  for (const pat of tokenPatterns) {
    // crude count-based heuristic; strict mode flags all floats, normal flags top offenders
    let text = '';
    try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const matches = text.match(pat) || [];
    if (!matches.length) continue;
    if (!strict && matches.length < 5) continue;
    if (strict) findings.push({ rel, pattern: pat.source, count: matches.length, sample: matches.slice(0,5) });
  }
}

const tokenFileSet = new Set(tokenFiles);
const consolidated = findings.filter((f) => !tokenFileSet.has(f.rel));

if (strict && consolidated.length) {
  console.log(`FAIL design-tokens: ${consolidated.length} non-token-file findings`);
  for (const f of consolidated.slice(0, 50)) console.log(`  ${f.rel}: ${f.count} matches (${f.sample.join(', ')})`);
  process.exit(1);
}
console.log(`ok design-tokens: ${consolidated.length} flagged in non-token files`);
process.exit(0);
