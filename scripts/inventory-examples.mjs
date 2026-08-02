import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'docs/examples');
const out = resolve(process.argv[3] ?? 'docs/examples-inventory.json');
const rows = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else {
      const bytes = await readFile(path);
      const info = await stat(path);
      rows.push({ path: relative(process.cwd(), path).replaceAll('\\', '/'), bytes: info.size,
        sha256: createHash('sha256').update(bytes).digest('hex'), extension: entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.') + 1).toLowerCase() : '' });
    }
  }
}
await walk(root);
rows.sort((a, b) => a.sha256.localeCompare(b.sha256) || a.path.localeCompare(b.path));
const groups = new Map();
for (const row of rows) groups.set(row.sha256, [...(groups.get(row.sha256) ?? []), row.path]);
await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), root: relative(process.cwd(), root), fileCount: rows.length,
  duplicateSets: [...groups.values()].filter((paths) => paths.length > 1).map((paths) => ({ canonical: paths[0], duplicates: paths.slice(1) })), files: rows }, null, 2) + '\n');
console.log(`Inventoried ${rows.length} files; ${[...groups.values()].filter((p) => p.length > 1).length} byte-duplicate sets. Wrote ${out}`);
