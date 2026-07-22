import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const testDir = dirname(fileURLToPath(import.meta.url));
const files = (await readdir(testDir)).filter((name) => name.endsWith('.test.ts')).sort();
let failed = false;
for (const file of files) {
  const child = spawn(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', join(testDir, file)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' }
  });
  const code = await new Promise((resolve) => child.on('exit', resolve));
  if (code !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
