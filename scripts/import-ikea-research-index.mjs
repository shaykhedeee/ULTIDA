import { mkdir, writeFile } from 'node:fs/promises';
const revision = '6f316e3fecf8ce95069eaef5f2021405c536168a';
const response = await fetch(`https://api.github.com/repos/IvonaTau/ikea/git/trees/${revision}?recursive=1`, { signal: AbortSignal.timeout(20000) });
if (!response.ok) throw new Error(`GitHub index unavailable: ${response.status}`);
const tree = await response.json();
if (tree.truncated || !Array.isArray(tree.tree)) throw new Error('Incomplete dataset tree');
const images = tree.tree.filter(item => item.type === 'blob' && /^images\/.+\.(jpg|jpeg|png)$/i.test(item.path))
  .map(item => ({ path: item.path, sha: item.sha, category: item.path.split('/')[1], title: item.path.split('/').at(-1).replace(/\.[^.]+$/, '') }));
if (!images.length) throw new Error('No source images found');
await mkdir('apps/web/public/research', { recursive: true });
await writeFile('apps/web/public/research/ikea-index.json', JSON.stringify({
  source: 'https://github.com/IvonaTau/ikea', revision,
  usage: 'non-commercial-reference-only', geometryCertified: false, images,
}));
console.log(`Indexed ${images.length} remote image references; no image binaries downloaded.`);
