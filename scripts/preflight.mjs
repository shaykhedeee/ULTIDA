import fs from 'node:fs';

const required = ['apps/web', 'apps/api', 'apps/worker', 'packages/contracts', 'packages/scene-core', 'supabase/migrations'];
const checks = required.map((path) => ({ name: path, ok: fs.existsSync(new URL(`../${path}`, import.meta.url)) }));
const failed = checks.filter((check) => !check.ok);
for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}`);
process.exitCode = failed.length ? 1 : 0;
