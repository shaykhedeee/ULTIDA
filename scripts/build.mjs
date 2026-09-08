import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const rootDir = process.cwd();

const WORKSPACES = {
  '@ultida/contracts': 'packages/contracts',
  '@ultida/geometry-core': 'packages/geometry-core',
  '@ultida/scene-core': 'packages/scene-core',
  '@ultida/drawing-core': 'packages/drawing-core',
  '@ultida/scene-compiler': 'packages/scene-compiler',
  '@ultida/layout-core': 'packages/layout-core',
  '@ultida/design-core': 'packages/design-core',
  '@ultida/material-core': 'packages/material-core',
  '@ultida/module-framework': 'packages/module-framework',
  '@ultida/catalog-core': 'packages/catalog-core',
  '@ultida/commercial-core': 'packages/commercial-core',
  '@ultida/plan-core': 'packages/plan-core',
  '@ultida/provider-gateway': 'packages/provider-gateway',
  '@ultida/render-pipeline': 'packages/render-pipeline',
  '@ultida/rule-core': 'packages/rule-core',
  '@ultida/spaces-core': 'packages/spaces-core',
  '@ultida/agent-core': 'packages/agent-core',
  '@ultida/aura-tools': 'packages/aura-tools',
  '@ultida/api': 'apps/api',
  '@ultida/cloudflare-ai-worker': 'apps/cloudflare-ai-worker',
  '@ultida/web': 'apps/web',
  '@ultida/worker': 'apps/worker',
};

const packageKeys = Object.keys(WORKSPACES).filter(
  (k) => !['@ultida/api', '@ultida/cloudflare-ai-worker', '@ultida/web', '@ultida/worker'].includes(k)
);
const appKeys = ['@ultida/api', '@ultida/cloudflare-ai-worker', '@ultida/web', '@ultida/worker'];
const binDir = resolve(rootDir, 'node_modules/.bin');
const pathEnv = `${binDir};${process.env.PATH || process.env.Path || ''}`;

let isPnpm = false;
try {
  const v = (await import('node:child_process')).execSync(`${npm} --version`, { encoding: 'utf8', shell: process.platform === 'win32' }).trim();
  isPnpm = Boolean(process.env.npm_config_user_agent?.includes('pnpm') || v.startsWith('12.') || v.includes('pnpm'));
} catch {}

function runWorkspace(name, script = 'build', timeoutMs = 180_000) {
  return new Promise((resolvePromise, reject) => {
    process.stdout.write(`\n[build] ${name} ${script} started\n`);
    const args = isPnpm ? ['--filter', name, 'run', script] : ['run', script, '--workspace', name];
    const child = spawn(npm, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      cwd: rootDir,
      env: {
        ...process.env,
        PATH: pathEnv,
        Path: pathEnv,
        ELECTRON_RUN_AS_NODE: '1',
      },
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${name} exceeded ${Math.round(timeoutMs / 1000)} seconds.`));
    }, timeoutMs);
    child.once('error', (err) => { clearTimeout(timer); reject(err); });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        process.stdout.write(`[build] ${name} ${script} passed\n`);
        resolvePromise();
      } else {
        reject(new Error(`${name} ${script} failed with exit code ${code ?? signal}`));
      }
    });
  });
}

const mode = process.argv[2] || 'all';

try {
  if (mode === 'all' || mode === 'packages') {
    for (const workspace of packageKeys) {
      await runWorkspace(workspace, 'build');
    }
  }

  if (mode === 'all' || mode === 'apps') {
    for (const workspace of appKeys) {
      await runWorkspace(workspace, 'build');
    }
  }

  process.stdout.write('\n[build] complete\n');
} catch (error) {
  process.stderr.write(`\n[build] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
