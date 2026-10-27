import test from 'node:test';
import assert from 'node:assert/strict';
import { selectProjectDossierScenes as select } from '../src/project-dossier-manifest.js';
const row=(id:string, rooms:string[], status='approved')=>({id,status,scene:{rooms:rooms.map(spaceId=>({spaceId}))}});
test('project manifest includes newest exact revision of every room without older duplicates',()=>{
 assert.deepEqual(select([row('k2',['k']),row('b1',['b']),row('k1',['k'])],['k','b']).map(r=>r.id),['k2','b1']);
});
test('new draft, missing room and overlapping scenes block incomplete dossiers',()=>{
 assert.throws(()=>select([row('k2',['k'],'draft'),row('k1',['k'])],['k']),/NOT_APPROVED/);
 assert.throws(()=>select([row('k1',['k'])],['k','b']),/ROOMS_MISSING/);
 assert.throws(()=>select([row('k1',['k']),row('all',['k','b'])],['k','b']),/OVERLAPPING/);
});
