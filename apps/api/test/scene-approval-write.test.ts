import test from 'node:test';
import assert from 'node:assert/strict';
import { approveUnchangedDraft } from '../src/scene-approval-write.js';
test('approval cannot overwrite a scene made stale after validation', async () => {
  for (const currentStatus of ['draft', 'stale', 'approved']) {
    const row = { project_id: 'project-a', id: 'scene-a', status: currentStatus };
    const predicates: Array<[string, unknown]> = [];
    let changes: any;
    const query = { update(value: any) { changes = value; return query; }, eq(key: string, value: unknown) { predicates.push([key, value]); return query; }, select() { return query; }, async maybeSingle() { const matches = predicates.every(([key, value]) => row[key as keyof typeof row] === value); if (matches) Object.assign(row, changes); return { data: matches ? row : null, error: null }; } };
    const result = await approveUnchangedDraft({ from: () => query }, 'project-a', 'scene-a', { metadata: {} });
    assert.equal(result.data !== null, currentStatus === 'draft');
    assert.equal(row.status, currentStatus === 'draft' ? 'approved' : currentStatus);
  }
});
