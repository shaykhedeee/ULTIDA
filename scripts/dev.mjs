import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const rootEnv = resolve(process.cwd(), '.env');
if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

const commands = [
  ['api', ['run', 'dev', '--workspace', '@ultida/api']],
  ['web', ['run', 'dev', '--workspace', '@ultida/web']],
  ['worker', ['run', 'dev', '--workspace', '@ultida/worker']]
];

const children = commands.map(([name, args]) => {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('npm_execpath is unavailable; start with npm run dev.');
  const child = spawn(process.execPath, [npmCli, ...args], { stdio: 'inherit', env: process.env });
  child.on('exit', (code) => { if (code) console.error(`[${name}] exited with ${code}`); });
  return child;
});

const stop = () => children.forEach((child) => child.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
