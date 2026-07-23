#!/usr/bin/env node
/**
 * audit_fake_truth.mjs
 *
 * ULTIDA's core invariant is "AI/defaults never silently become measured
 * truth." This script sweeps the repo for the specific bug classes that
 * have already been found twice in this codebase:
 *   1. Hardcoded calibration/measurement constants standing in for real data
 *      (e.g. `pixelPerMm: 0.18`, `scale: 1.0`, `confidence: 1`) especially
 *      when paired with a label implying review happened.
 *   2. Machine-specific hardcoded paths (Windows user paths, absolute local
 *      paths) that only work on one developer's machine -- breaks in CI/prod.
 *   3. Swallowed-error patterns: catch blocks that only console.warn/log
 *      and continue, hiding a real failure (root cause of the app_settings
 *      fresh-install bug found earlier).
 *   4. Mock/stub/fake/TODO/FIXME markers left in non-test source.
 *
 * Usage: node scripts/audit_fake_truth.mjs [rootDir]
 * This is a report tool. Read the output, don't just count it.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : process.cwd();
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.next', 'coverage', '.cache']);
const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py']);

const PATTERNS = [
  {
    label: 'hardcoded calibration/measurement constant',
    re: /\b(pixelPerMm|scale|confidence|pixelsPerMeter|mmPerPixel)\s*:\s*(0?\.\d+|1(\.0+)?|[0-9]+)\b/g,
    hint: 'Verify this is a real fallback with an explicit "unreviewed" UI state, not a silent stand-in for reviewed data.',
  },
  {
    label: 'suspicious "reviewed/approved" label near a literal',
    re: /source\s*:\s*['"](designer-review|approved|verified|reviewed)['"]/g,
    hint: 'Confirm the paired value is genuinely designer-entered, not a hardcoded default wearing a reviewed label.',
  },
  {
    label: 'machine-specific absolute path',
    re: /(C:\\\\Users\\\\[A-Za-z0-9_]+|\/Users\/[A-Za-z0-9_]+\/(?!\.)|X:[\\/]|[A-Za-z]:\\\\(Program Files|OFFLINEGANG))/g,
    hint: 'Will fail in CI/production/any other machine. Use env vars or auto-discovery instead.',
  },
  {
    label: 'swallowed error (catch that only logs)',
    re: /catch\s*\([^)]*\)\s*\{\s*console\.(warn|log)\([^;]*\)\s*;?\s*\}/g,
    hint: 'Confirm the caller can tell this failed. A silently-swallowed schema/migration error caused a real production bug already.',
  },
  {
    label: 'mock/stub/fake marker in source',
    re: /\b(TODO|FIXME|HACK|MOCK_|STUB_|FAKE_|placeholder value|not really)\b/g,
    hint: 'Confirm this isn\'t shipping. Fine in comments during active work, not fine forgotten in production paths.',
  },
];

function walk(dir, files = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return files; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (CODE_EXTS.has(path.extname(entry.name)) && !/\.test\.|\.spec\./.test(entry.name)) files.push(full);
  }
  return files;
}

const files = walk(root);
let totalFindings = 0;
const byPattern = {};

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    for (const p of PATTERNS) {
      p.re.lastIndex = 0;
      if (p.re.test(line)) {
        totalFindings++;
        byPattern[p.label] = byPattern[p.label] || [];
        byPattern[p.label].push({ file: path.relative(root, file), line: i + 1, snippet: line.trim().slice(0, 110), hint: p.hint });
      }
    }
  });
}

console.log(`\n=== Fake-Truth / Silent-Failure Audit ===`);
console.log(`Files scanned: ${files.length}\n`);

if (totalFindings === 0) {
  console.log('No matches. Either genuinely clean, or the patterns need widening for this codebase -- read the script and add cases you know about.\n');
} else {
  for (const [label, items] of Object.entries(byPattern)) {
    console.log(`\n--- ${label} (${items.length}) ---`);
    console.log(`  ${items[0].hint}`);
    for (const it of items) console.log(`  ${it.file}:${it.line}  ${it.snippet}`);
  }
  console.log(`\nTotal: ${totalFindings} finding(s). Each needs a human judgment call, not an auto-fix.\n`);
}
