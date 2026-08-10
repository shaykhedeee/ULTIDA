import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const packages = [
  '@ultida/contracts', '@ultida/geometry-core', '@ultida/scene-core',
  '@ultida/drawing-core', '@ultida/scene-compiler', '@ultida/layout-core',
  '@ultida/design-core', '@ultida/material-core', '@ultida/module-framework',
  '@ultida/catalog-core', '@ultida/commercial-core', '@ultida/plan-core',
  '@ultida/provider-gateway', '@ultida/render-pipeline', '@ultida/rule-core',
  '@ultida/spaces-core', '@ultida/agent-core', '@ultida/aura-tools',
];
const applications = ['@ultida/api', '@ultida/cloudflare-ai-worker', '@ultida/web', '@ultida/worker', '@ultida/aura-tools'];

function run(label, args, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    process.stdout.write(`\n[check] ${label} started\n`);
    // npm.cmd is a Windows command shim and must be launched through the
    // command shell; on POSIX the real npm executable is spawned directly.
    const child = spawn(npm, args, { stdio: 'inherit', shell: process.platform === 'win32' });
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

try {
  for (const workspace of packages) await run(`${workspace} build`, ['run', 'build', '--workspace', workspace]);
  for (const workspace of applications) await run(`${workspace} type check`, ['run', 'check', '--workspace', workspace]);
  process.stdout.write('\n[check] complete\n');
} catch (error) {
  process.stderr.write(`\n[check] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
