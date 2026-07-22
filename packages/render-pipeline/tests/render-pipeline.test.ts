import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildRenderRecord, validateRenderOptions, validateRenderQA, applyProviderFailure, applyQA, buildEnhancementPrompt, resolveRenderState } from '../dist/index.js';

const baseOptions = {
  room: 'living',
  sourceSceneId: 'scene-1',
  renderType: 'photoreal_render',
  quality: 'review',
  aspectRatio: '16:9',
  geometryLock: 'strict',
  styleIntensity: 0.4,
  cameraPreset: 'perspective',
  lighting: 'day',
  selectedMaterials: []
};

describe('render-pipeline', () => {
  test('blocks render with technical_preview type', () => {
    assert.throws(() => buildRenderRecord({
      projectId: 'project-1',
      sceneVersionId: 'scene-1',
      options: { ...baseOptions, renderType: 'technical_preview' },
      provenance: { promptVersion: 'prompt-1', moduleSnapshotId: 'module-1' }
    }));
  });

  test('builds a valid persisted render record', () => {
    const record = buildRenderRecord({
      projectId: 'project-1',
      sceneVersionId: 'scene-1',
      options: baseOptions,
      provenance: { planVersionId: 'plan-1', moduleSnapshotId: 'module-1', promptVersion: 'prompt-1', provider: 'provider-1', model: 'model-1' }
    });
    assert.strictEqual(record.state, 'queued');
    assert.strictEqual(record.provider, 'provider-1');
    assert.strictEqual(record.options.renderType, 'photoreal_render');
  });

  test('marks provider-not-configured failure as terminal', () => {
    const record = buildRenderRecord({ projectId: 'project-1', sceneVersionId: 'scene-1', options: baseOptions, provenance: { promptVersion: 'prompt-1', moduleSnapshotId: 'module-1' } });
    const failed = applyProviderFailure(record, { code: 'provider_not_configured', message: 'No provider configured.', retryable: false });
    assert.strictEqual(failed.state, 'failed');
    assert.strictEqual(failed.failure?.retryable, false);
  });

  test('marks retryable timeout failure', () => {
    const record = buildRenderRecord({ projectId: 'project-1', sceneVersionId: 'scene-1', options: baseOptions, provenance: { promptVersion: 'prompt-1', moduleSnapshotId: 'module-1' } });
    const failed = applyProviderFailure(record, { code: 'timeout', message: 'Render timed out.', retryable: true });
    assert.strictEqual(failed.state, 'failed');
    assert.strictEqual(failed.failure?.retryable, true);
  });

  test('applies QA with warnings without failing', () => {
    const record = buildRenderRecord({ projectId: 'project-1', sceneVersionId: 'scene-1', options: baseOptions, provenance: { promptVersion: 'prompt-1', moduleSnapshotId: 'module-1' } });
    const qa = validateRenderQA({ issues: [{ kind: 'camera_similarity', message: 'Slight camera drift', severity: 'warning' }], wallEdgesAligned: true, openingCountMatches: true, focalModuleVisible: true, cameraSimilarityMm: 40, inventedObjectsDetected: false, missingObjects: [] });
    const updated = applyQA(record, qa);
    assert.strictEqual(updated.state, 'completed_with_warnings');
    assert.strictEqual(updated.qaResult?.issues.length, 1);
  });

  test('fails render on blocking QA', () => {
    const record = buildRenderRecord({ projectId: 'project-1', sceneVersionId: 'scene-1', options: baseOptions, provenance: { promptVersion: 'prompt-1', moduleSnapshotId: 'module-1' } });
    const qa = validateRenderQA({ issues: [{ kind: 'missing_object', message: 'Missing cabinet', severity: 'blocking' }], wallEdgesAligned: false, openingCountMatches: false, focalModuleVisible: false, cameraSimilarityMm: 200, inventedObjectsDetected: true, missingObjects: ['cabinet-1'] });
    const updated = applyQA(record, qa);
    assert.strictEqual(updated.state, 'failed');
  });

  test('returns render-enhancement prompt with forbidden changes', () => {
    const prompt = buildEnhancementPrompt(baseOptions, ['Geometry: 1 room'], ['Camera 24mm']);
    assert.ok(prompt.sceneFacts.includes('Geometry: 1 room'));
    assert.ok(prompt.forbiddenChanges.includes('Do not move walls'));
  });

  test('render state resolver stays queued while scene draft', () => {
    const state = resolveRenderState({ scene: { status: 'draft' }, options: baseOptions });
    assert.ok(['queued', 'compiling_scene'].includes(state));
  });
});
