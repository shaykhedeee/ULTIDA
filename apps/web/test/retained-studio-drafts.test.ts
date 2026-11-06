import test from 'node:test';import assert from 'node:assert/strict';
import { retainedStudioDraft } from '../src/features/spaces/retained-studio-drafts';
function storage(values:Record<string,string>){return {length:Object.keys(values).length,key:(i:number)=>Object.keys(values)[i]??null,getItem:(key:string)=>values[key]??null};}
test('review discovers an unopened module draft and a finish in a different room',()=>{
 const draft=retainedStudioDraft(storage({'ultida.module-draft.v1:u/p/old-room/module':'{}'}),'u','p');assert.equal(draft?.roomId,'old-room');assert.equal(draft?.kind,'furniture');
 const finish=retainedStudioDraft(storage({'ultida.finish-draft.v1:u/p/other-room':'{}'}),'u','p');assert.equal(finish?.kind,'finish');
 assert.equal(retainedStudioDraft(storage({'ultida.module-draft.v1:other/p/r/m':'{}'}),'u','p'),null);
});
test('review also detects an unconfirmed placement from the same account and project',()=>{
 const key='ultida.pending-placement.v1:'+JSON.stringify(['u','p','room','cabinet',600,560,720,'wall',0,null]);
 assert.equal(retainedStudioDraft(storage({[key]:'request'}),'u','p')?.kind,'placement');
 assert.equal(retainedStudioDraft(storage({[key]:'request'}),'other','p'),null);
});
