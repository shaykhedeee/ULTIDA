import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProductionReleaseAuthority, productionReviewFingerprint } from '../src/production-release-authority.ts';
const snapshot = {parts:[{partInstanceId:'a'},{partInstanceId:'b'}],fabricationRules:{version:'v1'},status:'review_required'} as any;
const review = {status:'approved',approved_part_ids:['a','b'],fabrication_rules_version:'v1',source_fingerprint:productionReviewFingerprint(snapshot)};
test('only exact matching reviewed parts and fabrication rules authorize release',()=>{
 assert.equal(applyProductionReleaseAuthority(snapshot,review,'released').status,'approved');
 assert.equal(snapshot.status,'review_required');
 for(const invalid of [null,{...review,status:'rejected'},{...review,approved_part_ids:['a']},{...review,approved_part_ids:['a','b','c']},{...review,approved_part_ids:['a','b','b']},{...review,fabrication_rules_version:'old'}]) {
  assert.throws(()=>applyProductionReleaseAuthority(snapshot,invalid,'released'),/PRODUCTION_REVIEW_REQUIRED/);
  const draft=applyProductionReleaseAuthority(snapshot,invalid,'draft');
  assert.equal(draft.status,'review_required');
  assert.ok(draft.parts.every(p=>p.status==='review_required'));
 }
});
test('empty snapshot cannot be released',()=>{
 assert.throws(()=>applyProductionReleaseAuthority({...snapshot,parts:[]}, {...review,approved_part_ids:[]},'released'));
});

test('changed panel facts cannot reuse a review with the same IDs',()=>{
 assert.throws(()=>applyProductionReleaseAuthority({...snapshot,parts:[{partInstanceId:'a',lengthMm:700},{partInstanceId:'b'}]},review,'released'),/PRODUCTION_REVIEW_REQUIRED/);
 assert.equal(productionReviewFingerprint({...snapshot,parts:[...snapshot.parts].reverse()}),productionReviewFingerprint(snapshot));
});
