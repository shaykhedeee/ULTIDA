import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const packageRoot = path.join(root, 'packages');

async function jsFiles(dir) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await jsFiles(full));
    else if (entry.isFile() && full.endsWith('.js')) files.push(full);
  }
  return files;
}

const packageNames = (await readdir(packageRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const files = [
  ...await jsFiles(path.join(root, 'apps', 'api', 'dist')),
  ...(await Promise.all(packageNames.map((name) => jsFiles(path.join(packageRoot, name, 'dist'))))).flat(),
];

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const rewritten = source.replace(/(['"])@ultida\/([A-Za-z0-9-]+)\1/g, (match, quote, name) => {
    if (!packageNames.includes(name)) return match;
    const target = path.join(packageRoot, name, 'dist', 'index.js');
    let relative = path.relative(path.dirname(file), target).replaceAll(path.sep, '/');
    if (!relative.startsWith('.')) relative = `./${relative}`;
    return `${quote}${relative}${quote}`;
  });
  if (rewritten !== source) await writeFile(file, rewritten);
}
