#!/usr/bin/env node
/**
 * audit_design_tokens.mjs
 *
 * Scans apps/web/src and packages/ui/src for hardcoded design values that
 * bypass a shared token system: raw hex colors, arbitrary Tailwind bracket
 * values for color/spacing, and inline style objects with literal px/color
 * values. This does NOT assume anything about the current repo state --
 * it just walks whatever .tsx/.ts/.css files exist.
 *
 * Usage:
 *   node scripts/audit_design_tokens.mjs [rootDir]
 *
 * Exit code 0 always (this is a report tool, not a gate) unless you pass
 * --strict, in which case it exits 1 if any findings exist.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2]
  : process.cwd();
const strict = process.argv.includes('--strict');

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.next', 'coverage']);
const EXTS = new Set(['.tsx', '.ts', '.css']);

const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/g;
const TAILWIND_ARBITRARY_COLOR = /\b(?:bg|text|border|ring|fill|stroke)-\[(#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\))\]/g;
const INLINE_STYLE_PX = /style=\{\{[^}]*\d+px[^}]*\}\}/g;
const ARBITRARY_SPACING = /\b(?:p|m|gap|w|h)-\[\d+px\]/g;

function walk(dir, files = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return files; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (EXTS.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

function scanFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const findings = [];
  lines.forEach((line, i) => {
    // Skip the tokens file itself and obvious comments
    if (/tokens\.(ts|css)$/.test(file)) return;
    if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) return;

    for (const [label, re] of [
      ['hardcoded hex color', HEX_COLOR],
      ['tailwind arbitrary color', TAILWIND_ARBITRARY_COLOR],
      ['inline px style', INLINE_STYLE_PX],
      ['arbitrary spacing', ARBITRARY_SPACING],
    ]) {
      re.lastIndex = 0;
      const m = re.exec(line);
      if (m) findings.push({ line: i + 1, label, snippet: line.trim().slice(0, 100) });
    }
  });
  return findings;
}

const targets = ['apps/web/src', 'packages/ui/src', 'packages/ui'].map(p => path.join(root, p));
let total = 0;
const report = [];

for (const dir of targets) {
  if (!fs.existsSync(dir)) continue;
  for (const file of walk(dir)) {
    const findings = scanFile(file);
    if (findings.length) {
      total += findings.length;
      report.push({ file: path.relative(root, file), findings });
    }
  }
}

console.log(`\n=== Design Token Audit ===`);
console.log(`Scanned: ${targets.filter(fs.existsSync).join(', ') || '(no matching dirs found)'}\n`);

if (report.length === 0) {
  console.log('No hardcoded design values found outside the token system. Clean.\n');
} else {
  for (const { file, findings } of report) {
    console.log(`${file}`);
    for (const f of findings) {
      console.log(`  L${f.line}  [${f.label}]  ${f.snippet}`);
    }
  }
  console.log(`\nTotal: ${total} finding(s) across ${report.length} file(s).`);
  console.log('Each of these should reference a token (packages/ui/tokens.ts) instead of a literal value.\n');
}

if (strict && total > 0) process.exit(1);
