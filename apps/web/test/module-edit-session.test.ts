import test from 'node:test';
import assert from 'node:assert/strict';
import { ModuleEditSession, moduleDraftFromRow } from '../src/features/spaces/module-edit-session';
const row = (version = 'v1', width = 600) => ({ id: 'm', updated_at: version, config_json: { widthMm: width, depthMm: 560, heightMm: 720 }, position_json: { wallId: 'w', offsetMm: 0 } });
function storage() { const data = new Map<string,string>(); return { getItem: (k:string) => data.get(k) ?? null, setItem: (k:string,v:string) => {data.set(k,v);}, removeItem: (k:string) => {data.delete(k);} }; }
test('edits made while a save is in flight survive and use the acknowledged revision on the next save', async () => {
 let release!: (r: any) => void; let started!: () => void; const ready = new Promise<void>(resolve => { started = resolve; }); const calls: any[] = [];
 const editor = new ModuleEditSession(row(), 'user/project/room/m', storage(), async (base, draft) => { calls.push([base.updated_at, draft.widthMm]); if (calls.length === 1) return new Promise(resolve => { release = resolve; started(); }); return row('v3', Number(draft.widthMm)); });
 editor.edit({ widthMm: '700' }); const first = editor.save(); await ready;
 editor.edit({ widthMm: '800' }); release(row('v2',700)); await first;
 assert.equal(editor.snapshot().draft.widthMm,'800'); assert.equal(editor.snapshot().status,'unsaved');
 await editor.save(); assert.deepEqual(calls,[['v1','700'],['v2','800']]); assert.equal(editor.snapshot().status,'saved');
});
test('failed drafts survive reload; retries do not silently overwrite a newer saved version', async () => {
 const store = storage(); const fail = async () => { throw new Error('offline'); };
 const editor = new ModuleEditSession(row(), 'user/project/room/m', store, fail);
 editor.edit({widthMm:'750'}); await editor.save(); assert.equal(editor.snapshot().status,'attention');
 const recovered = new ModuleEditSession(row('v2',650),'user/project/room/m',store,fail);
 assert.equal(recovered.snapshot().draft.widthMm,'750'); assert.equal(recovered.snapshot().status,'conflict');
 recovered.resolve('proposed'); assert.equal(recovered.snapshot().base.updated_at,'v2'); assert.equal(recovered.snapshot().draft.widthMm,'750');
});
test('conflict shows saved and proposed values and waits for explicit resolution', async () => {
 let calls=0;
 const editor = new ModuleEditSession(row(),'u/p/r/m',storage(),async()=>{calls++; return { conflict: row('v2',640) };});
 editor.edit({widthMm:'740'}); await editor.save(); await editor.save();
 assert.equal(calls,1); assert.equal(editor.snapshot().conflict?.config_json.widthMm,640); assert.equal(editor.snapshot().draft.widthMm,'740');
 editor.resolve('saved'); assert.equal(editor.snapshot().draft.widthMm,'640'); assert.equal(editor.snapshot().status,'saved');
});
test('invalid numeric drafts are retained without sending requests; undo and redo use the same save path', async()=>{
 let calls=0; const editor=new ModuleEditSession(row(),'u/p/r/m',storage(),async(base,draft)=>{calls++; return row('v'+(calls+1),Number(draft.widthMm));});
 editor.edit({widthMm:''}); await editor.save(); assert.equal(calls,0); assert.equal(editor.snapshot().status,'attention');
 editor.edit({widthMm:'800'}); await editor.save(); editor.undo(); assert.equal(editor.snapshot().draft.widthMm,'600'); await editor.save();
 editor.redo(); assert.equal(editor.snapshot().draft.widthMm,'800'); await editor.save(); assert.equal(calls,3);
});
test('a storage failure is visible and user-scoped keys do not recover another user draft',()=>{
 const store=storage(); const editor=new ModuleEditSession(row(),'alice/p/r/m',store,async()=>row()); editor.edit({widthMm:'900'});
 const other=new ModuleEditSession(row(),'bob/p/r/m',store,async()=>row()); assert.deepEqual(other.snapshot().draft,moduleDraftFromRow(row()));
 const broken=new ModuleEditSession(row(),'broken',{...store,setItem:()=>{throw Error('quota');}},async()=>row()); broken.edit({widthMm:'900'}); assert.match(broken.snapshot().storageWarning,/browser/i);
});
test('recovered drafts require a deliberate retry and a failed save keeps newer typing',async()=>{
 const store=storage();const source=new ModuleEditSession(row(),'recovery/p/r/m',store,async()=>row());source.edit({widthMm:'900'});
 const recovered=new ModuleEditSession(row(),'recovery/p/r/m',store,async()=>row('v2',900));assert.equal(recovered.snapshot().status,'attention');
 let started!:()=>void,fail!:(e:Error)=>void;const ready=new Promise<void>(resolve=>{started=resolve;});
 const editor=new ModuleEditSession(row(),'failure/p/r/m',storage(),async()=>new Promise((_,reject)=>{fail=reject;started();}));
 editor.edit({widthMm:'700'});const saved=editor.save();await ready;editor.edit({widthMm:'800'});fail(Error('offline'));await saved;
 assert.equal(editor.snapshot().draft.widthMm,'800');assert.equal(editor.snapshot().status,'attention');
});
test('rapid undo and redo preserve intermediate committed edits before autosave',async()=>{
 let revision=1;const editor=new ModuleEditSession(row(),'history/p/r/m',storage(),async(_base,draft)=>row('v'+(++revision),Number(draft.widthMm)));
 editor.edit({widthMm:'700'});await editor.save();editor.edit({widthMm:'800'});await editor.save();editor.undo();editor.undo();await editor.save();editor.redo();assert.equal(editor.snapshot().draft.widthMm,'700');
});
test('editing a recovered conflict and reloading does not acknowledge the competing revision',async()=>{
 const store=storage();const original=new ModuleEditSession(row(),'origin/p/r/m',store,async()=>{throw Error('offline');});original.edit({widthMm:'750'});await original.save();
 const recovered=new ModuleEditSession(row('v2',650),'origin/p/r/m',store,async()=>row());recovered.edit({widthMm:'760'});
 let requests=0;const again=new ModuleEditSession(row('v2',650),'origin/p/r/m',store,async()=>{requests++;return row('v3',760);});
 assert.equal(again.snapshot().status,'conflict');await again.save();assert.equal(requests,0);
 again.resolve('proposed');await again.save();assert.equal(requests,1);
});
