import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const rootEnv = resolve(process.cwd(), '.env');
if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

// Local browser configuration is intentionally separate from server secrets.
// The API can use the publishable key for caller-scoped JWT validation in development.
const localEnv = resolve(process.cwd(), '.env.local');
if (existsSync(localEnv)) {
  dotenv.config({ path: localEnv });
  process.env.SUPABASE_URL ||= process.env.VITE_SUPABASE_URL;
  process.env.SUPABASE_PUBLISHABLE_KEY ||= process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
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
