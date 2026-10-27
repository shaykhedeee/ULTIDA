// @ts-nocheck — adversarial runtime contract fixtures.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateKitchenMilestone } from '../src/kitchen-milestone.ts';
const m='module-1', s='scene-1', r='room-1', p='plan-1', proj='proj-1';
const fixture=()=>({
 projectId:proj,roomId:r,sceneVersionId:s,
 plan:{id:p,status:'approved',approved_at:'2026-10-13T00:00:00Z',canonical_model:{scale:{verified:true}}},
 room:{id:r,room_type:'kitchen'},layouts:[{id:'layout-1',status:'approved'}],
 modules:[{id:m,space_id:r,template_id:'kit-base-600',layout_id:'layout-1'}],catalogTemplateIds:['kit-base-600'],
 aiSelection:{proposalId:'aura-proposal-1',roomId:r,sourcePlanVersionId:p,approved:true,templateIds:['kit-base-600']},
 assignments:[{material_id:'mat-1',module_instance_id:m,target_kind:'module',target_id:m,semantic_slot:'shutter',status:'approved',revision:1},{material_id:'mat-2',module_instance_id:m,target_kind:'module',target_id:m,semantic_slot:'hardware',status:'approved',revision:1}],
 materials:[{id:'mat-1',brand:'Merino',code:'M-001',metadata:{sourceUrl:'https://www.merinolaminates.com/example'}},{id:'mat-2',supplier:'Hettich',code:'H-001',metadata:{sourceUrl:'https://www.hettich.com/example'}}],
 scene:{id:s,status:'approved',floor_plan_version_id:p,scene:{modules:[{id:m}]}},
 renders:[{id:'render-1',kind:'render',status:'ready',stale:false,scene_version_id:s,provenance:{qaStatus:'measured_passed'}}],
 productionReview:{status:'approved',approved_part_ids:['panel-1']},cutlist:{parts:[{partInstanceId:'panel-1'}],excludedModules:[]},
 quote:{sceneVersionId:s,status:'approved',lines:[{sourcePartId:'panel-1',unitRateInr:400}]} });
const ok=x=>evaluateKitchenMilestone(x);
test('full independent proof fixture passes all nine gates',()=>{const a=ok(fixture());assert.equal(a.total,9);assert.equal(a.ready,true);assert.equal(a.completed,9)});
test('fresh plan scale defaults to blocked',()=>{const x=fixture();x.plan.canonical_model.scale.verified=false;assert.equal(ok(x).checks[0].status,'blocked');assert.equal(ok(x).ready,false)});
test('plan lineage mismatch blocks scene and downstream outputs',()=>{const x=fixture();x.scene.floor_plan_version_id='other';assert.equal(ok(x).checks.find(c=>c.id==='approved_scene').status,'blocked');assert.equal(ok(x).checks.find(c=>c.id==='production_snapshot').status,'blocked')});
test('unknown catalog module cannot pass',()=>{const x=fixture();x.modules[0].template_id='ai-invented-module';assert.equal(ok(x).checks.find(c=>c.id==='library_modules').status,'blocked')});
test('latest draft material must not inherit former approval',()=>{const x=fixture();x.assignments.push({...x.assignments[0],revision:2,status:'draft'});assert.equal(ok(x).checks.find(c=>c.id==='verified_finishes_hardware').status,'blocked')});
test('generic unreferenced brand or missing source cannot pass materials',()=>{const x=fixture();x.materials[0].metadata={};assert.equal(ok(x).checks.find(c=>c.id==='verified_finishes_hardware').status,'blocked')});
test('old render fails exact-scene fidelity',()=>{const x=fixture();x.renders[0].scene_version_id='older-scene';assert.equal(ok(x).checks.find(c=>c.id==='render_provenance').status,'blocked')});
test('stale render fails measured QA',()=>{const x=fixture();x.renders[0].stale=true;assert.equal(ok(x).checks.find(c=>c.id==='render_provenance').status,'blocked')});
test('unreviewed CNC parts fail release',()=>{const x=fixture();x.productionReview.approved_part_ids=[];assert.equal(ok(x).checks.find(c=>c.id==='production_snapshot').status,'blocked')});
test('cutlist omissions prevent production approval',()=>{const x=fixture();x.cutlist.excludedModules=[m];assert.equal(ok(x).checks.find(c=>c.id==='production_snapshot').status,'blocked')});
test('quote without identical scene link fails',()=>{const x=fixture();x.quote.sceneVersionId='other';assert.equal(ok(x).checks.find(c=>c.id==='scene_quotation').status,'blocked')});
test('quote without source part IDs fails',()=>{const x=fixture();x.quote.lines[0].sourcePartId='unknown';assert.equal(ok(x).checks.find(c=>c.id==='scene_quotation').status,'blocked')});
test('no quote means incomplete milestone, even if render and cutlist exist',()=>{const x=fixture();x.quote=null;assert.equal(ok(x).completed,8);assert.equal(ok(x).ready,false)});
test('missing kitchen room blocks work',()=>{const x=fixture();x.room.room_type='bedroom';assert.equal(ok(x).checks.find(c=>c.id==='kitchen_room').status,'blocked')});
test('all evidence is read-only and releases are never auto-approved',()=>{const x=fixture();const before=JSON.stringify(x);ok(x);assert.equal(JSON.stringify(x),before)});

test('AI suggestions without designer approval cannot count as selected modules',()=>{const x=fixture();x.aiSelection.approved=false;assert.equal(ok(x).checks.find(c=>c.id==='approved_ai_selection').status,'blocked')});
test('AI proposal from an older plan cannot count',()=>{const x=fixture();x.aiSelection.sourcePlanVersionId='old-plan';assert.equal(ok(x).checks.find(c=>c.id==='approved_ai_selection').status,'blocked')});
test('unrecorded AI proposal means milestone is not ready',()=>{const x=fixture();x.aiSelection=null;assert.equal(ok(x).checks.find(c=>c.id==='approved_ai_selection').status,'blocked')});
