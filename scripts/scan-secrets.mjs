import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const patterns = [
  /sb_secret_[A-Za-z0-9_-]{20,}/g,
  /sk-(?:proj-|or-v1-)?[A-Za-z0-9_-]{24,}/g,
  /AIza[A-Za-z0-9_-]{30,}/g,
  /gsk_[A-Za-z0-9_-]{24,}/g,
  /pplx-[A-Za-z0-9_-]{24,}/g,
  /hf_[A-Za-z0-9_-]{24,}/g
];
const allowed = new Set(['package-lock.json']);
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean).filter((file) => !allowed.has(file));
const findings = [];
for (const file of files) {
  let content;
  try { content = readFileSync(file, 'utf8'); } catch { continue; }
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) findings.push(file);
  }
}
if (findings.length) {
  console.error(`FAIL tracked secret-like values detected in: ${[...new Set(findings)].join(', ')}`);
  process.exitCode = 1;
} else console.log('PASS no tracked provider or Supabase secret keys detected');
