import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const node = process.execPath;
const rootDir = process.cwd();

const WORKSPACES = {
  '@ultida/drawing-core': 'packages/drawing-core',
  '@ultida/api': 'apps/api',
  '@ultida/aura-tools': 'packages/aura-tools',
  '@ultida/render-pipeline': 'packages/render-pipeline',
};

function runWorkspace(name, script = 'test', timeoutMs = 240_000) {
  const dir = WORKSPACES[name];
  const cwd = resolve(rootDir, dir);
  return new Promise((resolvePromise, reject) => {
    process.stdout.write(`\n[test] ${name} ${script} started\n`);
    const child = spawn(npm, ['run', script], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      cwd,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${name} exceeded ${Math.round(timeoutMs / 1000)} seconds.`));
    }, timeoutMs);
    child.once('error', (err) => { clearTimeout(timer); reject(err); });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        process.stdout.write(`[test] ${name} ${script} passed\n`);
        resolvePromise();
      } else {
        reject(new Error(`${name} ${script} failed with exit code ${code ?? signal}`));
      }
    });
  });
}

function runCommand(cmd, args, cwd = rootDir, timeoutMs = 240_000) {
  return new Promise((resolvePromise, reject) => {
    process.stdout.write(`\n[test] running: ${cmd} ${args.join(' ')}\n`);
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      cwd,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Command exceeded ${Math.round(timeoutMs / 1000)} seconds.`));
    }, timeoutMs);
    child.once('error', (err) => { clearTimeout(timer); reject(err); });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`Command failed with exit code ${code ?? signal}`));
      }
    });
  });
}

const target = process.argv[2] || 'all';

try {
  switch (target) {
    case 'drawing':
      await runWorkspace('@ultida/drawing-core', 'test');
      break;
    case 'api':
      await runWorkspace('@ultida/api', 'test');
      break;
    case 'aura':
      await runWorkspace('@ultida/aura-tools', 'test');
      break;
    case 'render':
      await runWorkspace('@ultida/render-pipeline', 'test');
      break;
    case 'rooms':
      await runCommand(node, ['--import', 'tsx', '--test', 'apps/web/test/plan-calibration.test.ts', 'apps/web/test/prepared-module-plan.test.ts', 'apps/web/test/vastu-readiness.test.ts', 'apps/web/test/wall-bay-editor.test.ts', 'apps/web/test/dashboard-elevation-assets.test.mjs']);
      await runCommand(node, ['--test', 'apps/web/test/room-catalog.test.mjs']);
      break;
    case 'all':
    default:
      await runCommand(node, ['scripts/build.mjs', 'packages']);
      await runWorkspace('@ultida/drawing-core', 'test');
      await runWorkspace('@ultida/api', 'test');
      await runWorkspace('@ultida/aura-tools', 'test');
      await runWorkspace('@ultida/render-pipeline', 'test');
      await runCommand(node, ['--import', 'tsx', '--test', 'apps/web/test/plan-calibration.test.ts', 'apps/web/test/prepared-module-plan.test.ts', 'apps/web/test/vastu-readiness.test.ts', 'apps/web/test/wall-bay-editor.test.ts', 'apps/web/test/dashboard-elevation-assets.test.mjs']);
      await runCommand(node, ['--test', 'apps/web/test/room-catalog.test.mjs']);
      break;
  }
  process.stdout.write('\n[test] complete\n');
} catch (error) {
  process.stderr.write(`\n[test] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
