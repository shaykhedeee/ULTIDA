import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleStyleGuidance } from '../src/module-style-guidance.js';
test('style images are bundled, room scoped, and never accepted from caller URLs', () => {
  const scene = { modules: [
    { id: 'crockery-1', roomId: 'dining', family: 'crockery', designIntent: { style: 'Warm oak', referenceAssetIds: ['studio-crockery-warm-oak'] } },
    { id: 'other', roomId: 'bedroom', family: 'crockery', designIntent: { style: 'Wrong room', referenceAssetIds: ['https://attacker.invalid/image'] } }
  ] };
  const result = moduleStyleGuidance(scene as any, 'dining');
  assert.match(result.prompt, /Module crockery-1/);
  assert.doesNotMatch(result.prompt, /Wrong room/);
  assert.deepEqual(result.referenceAssets, ['https://ultida.vercel.app/reference-vault/018-b7dd5f1492fe.png']);
  assert.match(result.prompt, /do not copy the reference room/);
});
