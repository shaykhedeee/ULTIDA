import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const testDir = dirname(fileURLToPath(import.meta.url));
const files = (await readdir(testDir)).filter((name) => name.endsWith('.test.ts')).sort();
let failed = false;
for (const file of files) {
  const startedAt = Date.now();
  console.log(`[test] ${file}`);
  const child = spawn(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', join(testDir, file)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' }
  });
  const code = await new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      console.error(`[test] timeout after 30s: ${file}`);
      child.kill();
      finish(124);
    }, 30_000);
    child.once('error', () => finish(1));
    child.once('exit', (exitCode, signal) => finish(exitCode ?? (signal ? 1 : 0)));
  });
  console.log(`[test] ${file}: ${code === 0 ? 'passed' : `failed (${code})`} in ${Date.now() - startedAt}ms`);
  if (code !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
