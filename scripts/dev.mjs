import { spawn } from 'node:child_process';

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
