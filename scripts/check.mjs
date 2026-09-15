import { spawn } from 'node:child_process';
import { resolve, delimiter } from 'node:path';
import { existsSync } from 'node:fs';

const hermesNpm = process.platform === 'win32' && process.env.LOCALAPPDATA
  ? resolve(process.env.LOCALAPPDATA, 'hermes/node/npm.cmd')
  : null;
const npm = (hermesNpm && existsSync(hermesNpm))
  ? hermesNpm
  : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
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

const packageKeys = [
  '@ultida/contracts', '@ultida/geometry-core', '@ultida/scene-core',
  '@ultida/drawing-core', '@ultida/scene-compiler', '@ultida/layout-core',
  '@ultida/design-core', '@ultida/material-core', '@ultida/module-framework',
  '@ultida/catalog-core', '@ultida/commercial-core', '@ultida/plan-core',
  '@ultida/provider-gateway', '@ultida/render-pipeline', '@ultida/rule-core',
  '@ultida/spaces-core', '@ultida/agent-core', '@ultida/aura-tools',
];
const appKeys = ['@ultida/api', '@ultida/cloudflare-ai-worker', '@ultida/web', '@ultida/worker', '@ultida/aura-tools'];

const binDir = resolve(rootDir, 'node_modules/.bin');
const pathEnv = `${binDir}${delimiter}${process.env.PATH || process.env.Path || ''}`;

function runWorkspace(name, script = 'build', timeoutMs = 180_000) {
  const dir = WORKSPACES[name];
  const cwd = resolve(rootDir, dir);
  return new Promise((resolvePromise, reject) => {
    process.stdout.write(`\n[check] ${name} ${script} started\n`);
    const child = spawn(npm, ['run', script], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      cwd,
      env: {
        ...process.env,
        PATH: pathEnv,
        Path: pathEnv,
        ELECTRON_RUN_AS_NODE: '1',
      },
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${name} exceeded ${Math.round(timeoutMs / 1000)} seconds and was stopped.`));
    }, timeoutMs);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        process.stdout.write(`[check] ${name} ${script} passed\n`);
        resolvePromise();
      } else {
        reject(new Error(`${name} ${script} failed${signal ? ` (${signal})` : ` (exit ${code ?? 'unknown'})`}.`));
      }
    });
  });
}

try {
  for (const workspace of packageKeys) {
    await runWorkspace(workspace, 'build');
  }
  for (const workspace of appKeys) {
    await runWorkspace(workspace, 'check');
  }
  process.stdout.write('\n[check] complete\n');
} catch (error) {
  process.stderr.write(`\n[check] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
