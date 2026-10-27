import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveKitchenAiSelection} from '../src/kitchen-ai-selection.js';
const created={proposalId:'one',toolId:'place_modular_kitchen',eventType:'proposal_created',createdAt:'2026-10-14T01:00:00Z',payload:{proposal:{roomId:'r',sourcePlanVersionId:'p',modules:[{moduleId:'kit-base-600'}]}}};
test('only persisted approval with exact room and plan proves AI selection',()=>{
 const approved={...created,eventType:'proposal_approved',createdAt:'2026-10-14T02:00:00Z',payload:{}};
 assert.equal(resolveKitchenAiSelection([created,approved],'r','p')?.approved,true);
 assert.equal(resolveKitchenAiSelection([created],'r','p')?.approved,false);
 assert.equal(resolveKitchenAiSelection([created,approved],'other','p'),null);
 assert.equal(resolveKitchenAiSelection([created,approved],'r','other'),null);
 assert.equal(resolveKitchenAiSelection([created,approved,{...approved,eventType:'correction_recorded',createdAt:'2026-10-14T03:00:00Z'}],'r','p')?.approved,false);
});
