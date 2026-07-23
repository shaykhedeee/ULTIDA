import fs from 'fs';
import path from 'path';

const root = path.resolve(process.argv[2] ?? '.');
const excludeDirs = new Set(['node_modules', '.git', 'dist', 'coverage', 'tmp', 'packages/ui/src', 'node_modules']);
const misses = [];

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

function checkFile(rel, fullPath) {
  let text = '';
  try { text = fs.readFileSync(fullPath, 'utf8'); } catch { return; }
  if (!/\.(tsx?)$/.test(rel)) return;
  const imported = text.includes("ProvenanceBadge");
  if (!imported && /scene|render|module|layout|plan|estimate|proposal|cad|drawing/i.test(rel)) {
    misses.push({ rel, reason: 'scene/render/module/layout/plan/estimate/proposal/cad/drawing component likely needs provenance' });
  }
}

walk(root).forEach((f) => checkFile(path.relative(root, f).replace(/\\/g,'/'), f));
if (!misses.length) { console.log('ok provenance-ui: 0 missing'); process.exit(0); }
console.log(`provenance-ui: ${misses.length} potentially missing`);
for (const m of misses.slice(0,100)) console.log(`  ${m.rel}: ${m.reason}`);
process.exit(0);
