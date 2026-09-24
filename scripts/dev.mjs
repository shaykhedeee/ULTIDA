import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, delimiter } from 'node:path';

function loadEnvFileSafe(envPath) {
  if (existsSync(envPath)) {
    if (typeof process.loadEnvFile === 'function') {
      try { process.loadEnvFile(envPath); } catch {}
    }
  }
}

const rootEnv = resolve(process.cwd(), '.env');
loadEnvFileSafe(rootEnv);

// Local browser configuration is intentionally separate from server secrets.
// The API can use the publishable key for caller-scoped JWT validation in development.
const localEnv = resolve(process.cwd(), '.env.local');
loadEnvFileSafe(localEnv);

process.env.SUPABASE_URL ||= process.env.VITE_SUPABASE_URL;
process.env.SUPABASE_PUBLISHABLE_KEY ||= process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const hermesNpm = process.platform === 'win32' && process.env.LOCALAPPDATA
  ? resolve(process.env.LOCALAPPDATA, 'hermes/node/npm.cmd')
  : null;
const npm = (hermesNpm && existsSync(hermesNpm))
  ? hermesNpm
  : (process.platform === 'win32' ? 'npm.cmd' : 'npm');

const binDir = resolve(process.cwd(), 'node_modules/.bin');
const pathEnv = `${binDir}${delimiter}${process.env.PATH || process.env.Path || ''}`;

const services = [
  { name: 'api', cwd: resolve(process.cwd(), 'apps/api') },
  { name: 'web', cwd: resolve(process.cwd(), 'apps/web') },
  { name: 'worker', cwd: resolve(process.cwd(), 'apps/worker') }
];

const children = services.map(({ name, cwd }) => {
  const child = spawn(npm, ['run', 'dev'], {
    stdio: 'inherit',
    cwd,
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      PATH: pathEnv,
      Path: pathEnv,
    }
  });
  child.on('exit', (code) => { if (code) console.error(`[${name}] exited with ${code}`); });
  return child;
});

const stop = () => children.forEach((child) => child.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
