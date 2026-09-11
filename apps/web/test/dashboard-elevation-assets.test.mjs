import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const elevationDir = resolve('apps/web/public/elevations');

test('dashboard elevation SVG assets are valid XML-safe image sources', async () => {
  const files = (await readdir(elevationDir)).filter((file) => file.endsWith('.svg')).sort();
  assert.ok(files.length >= 4, 'the dashboard requires its four elevation preview assets');

  for (const file of files) {
    const svg = await readFile(resolve(elevationDir, file), 'utf8');
    assert.match(svg, /^<svg\b/, `${file} must remain an SVG document`);
    assert.doesNotMatch(
      svg,
      /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-f]+;)/i,
      `${file} contains an unescaped ampersand that browsers reject as malformed XML`,
    );
  }
});
