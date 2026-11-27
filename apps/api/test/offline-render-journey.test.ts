import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createVisualJob, listProjectRenders } from '../src/visual-jobs.js';

test('measured kitchen uses a saved camera and reloads the stored offline render from its gallery', async () => {
  const scene = JSON.parse(readFileSync(new URL('../../../packages/scene-core/fixtures/kitchen.scene.v1.json', import.meta.url), 'utf8'));
  const projectId = scene.projectId;
  const room = scene.rooms[0];
  scene.walls[0].spaceIds = [room.spaceId];
  scene.openings.push({ id: 'door', wallId: scene.walls[0].id, kind: 'door', offsetMm: 2100, widthMm: 900, heightMm: 2100, sillHeightMm: 0, confidence: 1 });
  scene.cameras.push({ id: 'saved-camera', name: 'Kitchen', position: { xMm: 1500, yMm: 2700, zMm: 1400 },
    target: { xMm: 1100, yMm: 0, zMm: 1000 }, lensMm: 24 });

  const rows: Record<string, any[]> = {
    projects: [{ id: projectId, organization_id: 'studio' }],
    scene_versions: [{ id: 'scene-1', project_id: projectId, status: 'approved', scene }],
  };
  const objects = new Map<string, Buffer>();
  const client = {
    from(table: string) {
      const items = rows[table] ??= [];
      const filters = new Map<string, unknown>();
      let patch: object | undefined;
      let created: object | undefined;
      const resolve = () => {
        if (created) return { data: created };
        const matches = items.filter(row => [...filters].every(([field, value]) => row[field] === value));
        if (patch) matches.forEach(row => Object.assign(row, patch));
        return { data: matches };
      };
      const query = {
        select() { return query; },
        eq(field: string, value: unknown) { filters.set(field, value); return query; },
        order() { return query; },
        limit() { return query; },
        insert(value: object) { created = { id: table + '-' + (items.length + 1), ...value }; items.push(created); return query; },
        update(value: object) { patch = value; return query; },
        async single() { const result = resolve(); return { data: created ?? (result.data as any[])[0] }; },
        async maybeSingle() { return query.single(); },
        then(resolvePromise: (value: unknown) => void) { resolvePromise(resolve()); },
      };
      return query;
    },
    storage: { from: () => ({
      async upload(path: string, bytes: Buffer) { objects.set(path, bytes); return {}; },
      async createSignedUrl(path: string) {
        return objects.has(path) ? { data: { signedUrl: 'https://fixture.invalid/' + path } } : { error: { message: 'Object missing' } };
      },
    }) },
  };
  let providerCalls = 0;
  const gateway = { async createVisualProposal(request: any) {
    providerCalls++;
    assert.equal(request.cameraId, 'saved-camera');
    return { status: 'succeeded', provider: 'offline-fixture', operation: request.operation,
      image: { encoding: 'base64', mimeType: 'image/png', data: request.sourceAssets[0].split(',')[1] } };
  } };
  const request = { projectId, sceneVersionId: 'scene-1', roomId: room.id, cameraId: 'saved-camera', operation: 'render', style: 'neutral', quality: 'review' };
  const invalidCamera = await createVisualJob({}, gateway as never, { ...request, cameraId: 'missing' } as never, 'designer', client as never);
  assert.equal(invalidCamera.status, 'failed');
  assert.equal(invalidCamera.code, 'RENDER_CAMERA_NOT_IN_SCENE', JSON.stringify(invalidCamera));
  assert.equal(providerCalls, 0);
  const render = await createVisualJob({}, gateway as never, request as never, 'designer', client as never);
  assert.equal(render.status, 'succeeded', JSON.stringify({ status: render.status, code: render.code, message: render.message, jobId: render.jobId }));
  assert.equal(providerCalls, 1);
  assert.equal(rows.jobs[0].status, 'succeeded');
  assert.equal(rows.project_assets[0].metadata.sourceSceneVersionId, 'scene-1');
  assert.ok(objects.has(rows.project_assets[0].storage_path));
  const gallery = await listProjectRenders({}, projectId, client as never);
  assert.equal(gallery.status, 'succeeded');
  assert.equal(gallery.renders?.length, 1);
  assert.equal(gallery.renders?.[0].scene_version_id, 'scene-1');
  assert.ok(gallery.renders?.[0].signedUrl);
});
