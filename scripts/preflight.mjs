import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const required = ['apps/web', 'apps/api', 'apps/worker', 'packages/contracts', 'packages/scene-core', 'supabase/migrations'];
const checks = required.map((path) => ({ name: path, ok: fs.existsSync(new URL(`../${path}`, import.meta.url)) }));
const failed = checks.filter((check) => !check.ok);
for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}`);
let secretScanFailed = false;
try { execFileSync(process.execPath, [fileURLToPath(new URL('./scan-secrets.mjs', import.meta.url))], { stdio: 'inherit' }); } catch { secretScanFailed = true; }
process.exitCode = failed.length || secretScanFailed ? 1 : 0;
