import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('project operations exposes job lifecycle metadata without job payloads', async () => {
  const source = await readFile(fileURLToPath(new URL('../src/index.ts', import.meta.url)), 'utf8');
  const route = source.slice(source.indexOf("app.get('/api/projects/:projectId/operations'"), source.indexOf("app.put('/api/projects/:projectId/operations/reviews/:stage'"));

  assert.match(route, /client\.from\('jobs'\)/);
  assert.match(route, /last_error_code/);
  assert.match(route, /progress_stage/);
  assert.match(route, /lease_expires_at/);
  assert.match(route, /jobs: jobs\.data/);
  assert.doesNotMatch(route, /client\.from\('jobs'\)\.select\('\*'\)/);
});
