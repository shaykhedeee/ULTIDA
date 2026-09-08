import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const rootDir = process.cwd();

const packages = [
  '@ultida/contracts', '@ultida/geometry-core', '@ultida/scene-core',
  '@ultida/drawing-core', '@ultida/scene-compiler', '@ultida/layout-core',
  '@ultida/design-core', '@ultida/material-core', '@ultida/module-framework',
  '@ultida/catalog-core', '@ultida/commercial-core', '@ultida/plan-core',
  '@ultida/provider-gateway', '@ultida/render-pipeline', '@ultida/rule-core',
  '@ultida/spaces-core', '@ultida/agent-core', '@ultida/aura-tools',
];
const applications = ['@ultida/api', '@ultida/cloudflare-ai-worker', '@ultida/web', '@ultida/worker', '@ultida/aura-tools'];

const binDir = resolve(rootDir, 'node_modules/.bin');
const pathEnv = `${binDir};${process.env.PATH || process.env.Path || ''}`;

function run(label, args, timeoutMs = 180_000) {
  return new Promise((resolve, reject) => {
    process.stdout.write(`\n[check] ${label} started\n`);
    const child = spawn(npm, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        PATH: pathEnv,
        Path: pathEnv,
        ELECTRON_RUN_AS_NODE: '1',
      },
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${label} exceeded ${Math.round(timeoutMs / 1000)} seconds and was stopped.`));
    }, timeoutMs);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        process.stdout.write(`[check] ${label} passed\n`);
        resolve();
      } else {
        reject(new Error(`${label} failed${signal ? ` (${signal})` : ` (exit ${code ?? 'unknown'})`}.`));
      }
    });
  });
}

let isPnpm = false;
try {
  const v = (await import('node:child_process')).execSync(`${npm} --version`, { encoding: 'utf8', shell: process.platform === 'win32' }).trim();
  isPnpm = Boolean(process.env.npm_config_user_agent?.includes('pnpm') || v.startsWith('12.') || v.includes('pnpm'));
} catch {}

try {
  for (const workspace of packages) {
    const args = isPnpm ? ['--filter', workspace, 'run', 'build'] : ['run', 'build', '--workspace', workspace];
    await run(`${workspace} build`, args);
  }
  for (const workspace of applications) {
    const args = isPnpm ? ['--filter', workspace, 'run', 'check'] : ['run', 'check', '--workspace', workspace];
    await run(`${workspace} type check`, args);
  }
  process.stdout.write('\n[check] complete\n');
} catch (error) {
  process.stderr.write(`\n[check] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
