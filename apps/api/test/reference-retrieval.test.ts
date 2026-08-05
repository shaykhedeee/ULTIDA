import assert from 'node:assert/strict';
import test from 'node:test';
import { compileReferenceContext, retrieveReferences, type ReferenceVaultRecord } from '../src/reference-retrieval.js';

const references: ReferenceVaultRecord[] = [
  { id: 'approved-tv', title: 'Balanced TV wall with tall cabinet', source_path: 'vault/tv.png', room: 'living', module_family: 'tv', style: 'warm-minimal', material_tags: ['walnut', 'fluted'], review_state: 'approved' },
  { id: 'review-tv', title: 'TV wall alternative', source_path: 'vault/tv-review.png', room: 'living', module_family: 'tv', style: 'warm-minimal', material_tags: ['oak'], review_state: 'needs_review' },
  { id: 'wardrobe', title: 'Four shutter wardrobe', source_path: 'vault/wardrobe.png', room: 'bedroom', module_family: 'wardrobe', style: 'minimal', material_tags: ['beige'], review_state: 'approved' },
  { id: 'archived', title: 'Old TV wall', source_path: 'vault/old-tv.png', room: 'living', module_family: 'tv', style: 'warm-minimal', review_state: 'archived' },
];

test('reference retrieval ranks reviewed, scoped visual evidence and excludes archived records', () => {
  const results = retrieveReferences(references, { text: 'fluted tv walnut', room: 'living', moduleFamily: 'tv' });
  assert.deepEqual(results.map((entry) => entry.id), ['approved-tv', 'review-tv']);
  assert.equal(results[0]?.matchedTerms.includes('fluted'), true);
  assert.equal(results.some((entry) => entry.id === 'archived'), false);
});

test('reference context explicitly keeps geometry authoritative', () => {
  const results = retrieveReferences(references, { moduleFamily: 'tv' });
  const context = compileReferenceContext(results);
  assert.match(context.summary, /visual guidance only/i);
  assert.match(context.rules.join(' '), /geometry unchanged/i);
});
