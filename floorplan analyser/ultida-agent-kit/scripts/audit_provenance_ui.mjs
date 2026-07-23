#!/usr/bin/env node
/**
 * audit_provenance_ui.mjs
 *
 * ULTIDA's differentiator vs. Agent B is that every render/drawing/document
 * should visibly show its scene-version provenance and synthetic-vs-approved
 * state in the UI -- not just store it in the database. This script finds
 * components that LOOK like they render visual output (by filename pattern)
 * and flags ones that don't reference any provenance-shaped prop, so a human
 * can check whether the badge is actually wired in or just planned.
 *
 * This is a heuristic, not a proof. Read the flagged files yourself.
 *
 * Usage: node scripts/audit_provenance_ui.mjs [rootDir]
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : process.cwd();
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.next', 'coverage']);

const NAME_SUGGESTS_VISUAL_OUTPUT = /(Render|Card|Preview|Elevation|Drawing|Document|Quote|Cutlist|Proposal)\.(tsx|jsx)$/;
const PROVENANCE_HINTS = /(sceneVersionId|scene_version_id|provenance|synthetic|isApproved|providerName|provider_id|approvalState)/;

function walk(dir, files = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return files; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (NAME_SUGGESTS_VISUAL_OUTPUT.test(entry.name)) files.push(full);
  }
  return files;
}

const dir = path.join(root, 'apps/web/src');
if (!fs.existsSync(dir)) {
  console.log(`\napps/web/src not found under ${root} -- pass the correct repo root as an argument.\n`);
  process.exit(0);
}

const candidates = walk(dir);
console.log(`\n=== Provenance UI Audit ===`);
console.log(`Found ${candidates.length} component(s) whose name suggests they render visual output.\n`);

const missing = [];
const ok = [];

for (const file of candidates) {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file);
  if (PROVENANCE_HINTS.test(content)) ok.push(rel);
  else missing.push(rel);
}

if (ok.length) {
  console.log(`References provenance-shaped data (verify it's actually rendered, not just typed):`);
  ok.forEach(f => console.log(`  \u2713 ${f}`));
}
if (missing.length) {
  console.log(`\nNo provenance reference found -- check these manually:`);
  missing.forEach(f => console.log(`  \u2717 ${f}`));
  console.log(`\nEvery one of these that shows a render, drawing, quote, or cutlist to a user`);
  console.log(`should carry a visible scene-version + synthetic/approved badge. That's the`);
  console.log(`in-product proof of ULTIDA's "we don't fake dimensions" claim -- if it's only`);
  console.log(`in ARCHITECTURE.md and not on screen, a customer can't see the difference.\n`);
}
if (!candidates.length) {
  console.log('No components matched the naming heuristic -- widen NAME_SUGGESTS_VISUAL_OUTPUT in this script for your actual naming conventions.\n');
}
