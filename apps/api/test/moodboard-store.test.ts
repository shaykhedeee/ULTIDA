import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { saveMoodboard, loadMoodboardContext, signedMoodboardAssets, moodboardFingerprint, attachMoodboardSwatch } from '../src/moodboard-store.js';
const room='11111111-1111-4111-8111-111111111111', material='22222222-2222-4222-8222-222222222222';
const fingerprint=moodboardFingerprint([],new Set(),room);
const document={schema:'ultida.moodboard.v1',projectId:'p',roomId:room,sceneVersionId:null,sourceFingerprint:fingerprint,title:'Kitchen',template:'grid',canvas:{width:800,height:800,background:'#ffffff'},cards:[{id:'a',kind:'material',materialId:material,title:'Oak',x:0,y:0,width:200,height:200}]};
function client(overrides: Record<string, unknown>={},insertError:unknown=null) {
  const rows:Record<string,unknown>={projects:{id:'p',organization_id:'org'},spaces:{id:room,project_id:'p',organization_id:'org'},module_instances:[],material_assignments:[],material_library_items:[{id:material}],project_assets:[],room_moodboard_versions:null,...overrides};
  let inserts=0; const updates:unknown[]=[];
  const db={rpc:async(name:string,args:any)=>{inserts++;return {data:{revision:args.p_revision+1,document:args.p_document},error:insertError};},from(table:string){let inserting=false,updating=false;const query:any={select(){return query;},update(value:unknown){updating=true;updates.push(value);return query;},is(){return query;},eq(){return query;},order(){return query;},limit(){return query;},maybeSingle(){return query;},single(){return query;},insert(){inserting=true;inserts++;return query;},then(resolve:any){return Promise.resolve({data:inserting?{revision:1,document}:updating?('__updateResult' in rows?rows.__updateResult:rows[table]):rows[table],error:inserting?insertError:updating?(rows.__updateError ?? null):table in rows?null:{code:'42P01'}}).then(resolve);}};return query;},storage:{from(){return {createSignedUrl:async()=>({data:{signedUrl:'https://signed.example/asset'},error:null})};}}};
  return {db:db as unknown as SupabaseClient,inserts:()=>inserts,updates};
}
test('durable saves append only after identities and revision are checked',async()=>{
  const fixture=client(); const result=await saveMoodboard(fixture.db,'p',room,'u',{expectedRevision:0,document});
  assert.equal(result.revision,1);assert.equal(fixture.inserts(),1);
});
test('cross-project, cross-organization and unauthorized card identities never save',async()=>{
  for(const [overrides,board] of [[{}, {...document,projectId:'other'}],[{spaces:{id:room,organization_id:'other'}},document],[{material_library_items:[]},document]] as const){
    const fixture=client(overrides);await assert.rejects(saveMoodboard(fixture.db,'p',room,'u',{expectedRevision:0,document:board}));assert.equal(fixture.inserts(),0);
  }
});
test('stale fingerprints and concurrent revisions return conflicts',async()=>{
  for(const fixture of [client({room_moodboard_versions:{revision:1}}),client({}, {code:'23505'})]){
    await assert.rejects(saveMoodboard(fixture.db,'p',room,'u',{expectedRevision:0,document}), (e:any)=>e.status===409);
  }
  await assert.rejects(saveMoodboard(client().db,'p',room,'u',{expectedRevision:0,document:{...document,sourceFingerprint:'outdated'}}),(e:any)=>e.code==='MOODBOARD_SOURCE_CHANGED');
});
test('missing migration and failed inserts are unavailable, never fake success',async()=>{
  const missing=client(); const original=missing.db.from.bind(missing.db);
  missing.db.from=((table:string)=> table==='room_moodboard_versions'?{select(){return this;},eq(){return this;},order(){return this;},limit(){return this;},maybeSingle:async()=>({data:null,error:{code:'42P01'}})}:original(table)) as any;
  await assert.rejects(loadMoodboardContext(missing.db,'p',room),(e:any)=>e.status===503);
  await assert.rejects(saveMoodboard(client({}, {code:'42501'}).db,'p',room,'u',{expectedRevision:0,document}),(e:any)=>e.status===503);
});
test('schema refuses saved remote URLs and out-of-bounds cards',async()=>{
  for(const board of [{...document,signedUrl:'https://external.example'}, {...document,cards:[{...document.cards[0],x:790}]}]) await assert.rejects(saveMoodboard(client().db,'p',room,'u',{expectedRevision:0,document:board}),(e:any)=>e.status===422);
});
test('fingerprints isolate room identity and include latest revoked source',()=>{
  const row={target_kind:'room',target_id:room,semantic_slot:'wall',material_id:material,revision:1,status:'draft'};
  assert.equal(moodboardFingerprint([row],new Set(),'other'),moodboardFingerprint([],new Set(),'other'));
  assert.notEqual(moodboardFingerprint([row],new Set(),room),moodboardFingerprint([{...row,revision:2,status:'rejected'},row],new Set(),room));
});
test('swatches are signed only through authorized asset storage paths',async()=>{
  const fixture=client({project_assets:[{id:'asset',kind:'texture',mime_type:'image/png',storage_path:'org/p/sw.png'}],material_library_items:[{id:material,texture_asset_id:'asset'}]});
  const signed=await signedMoodboardAssets(fixture.db,await loadMoodboardContext(fixture.db,'p',room));assert.equal(signed.swatches.length,1);assert.equal(signed.imageAssets.length,0);
  const svg=client({project_assets:[{id:'unsafe',kind:'reference_image',mime_type:'image/svg+xml',storage_path:'org/p/a.svg'}]});assert.equal((await signedMoodboardAssets(svg.db,await loadMoodboardContext(svg.db,'p',room))).imageAssets.length,0);
});
test('migration grants append/read only and checks project-room-org linkage',()=>{
  const sql=readFileSync(new URL('../../../supabase/migrations/20261017223419_room_moodboard_versions.sql', import.meta.url),'utf8');
  assert.match(sql,/grant select, insert/);assert.doesNotMatch(sql,/for update|for delete/i);assert.match(sql,/created_by=\(select auth.uid\(\)\)/);assert.match(sql,/s.organization_id=room_moodboard_versions.organization_id/);assert.match(sql,/unique \(project_id, room_id, revision\)/);
});
test('cross-project storage paths and signing failures never expose fake previews',async()=>{
  const alien=client({project_assets:[{id:'alien',kind:'reference_image',mime_type:'image/png',storage_path:'other/project/image.png'}]});
  assert.equal((await signedMoodboardAssets(alien.db,await loadMoodboardContext(alien.db,'p',room))).imageAssets.length,0);
  const fixture=client({project_assets:[{id:'asset',kind:'reference_image',mime_type:'image/png',storage_path:'org/p/image.png'}]});
  fixture.db.storage.from=(()=>({createSignedUrl:async()=>({data:null,error:{message:'Denied'}})})) as any;
  await assert.rejects(signedMoodboardAssets(fixture.db,await loadMoodboardContext(fixture.db,'p',room)),(e:any)=>e.status===503);
});
test('assigned texture and material version changes make saved boards stale',()=>{
  const row={target_kind:'room',target_id:room,semantic_slot:'wall',material_id:material,revision:1,status:'draft'};
  const first=moodboardFingerprint([row],new Set(),room,[{id:material,texture_asset_id:'first',updated_at:'one'}]);
  assert.notEqual(first,moodboardFingerprint([row],new Set(),room,[{id:material,texture_asset_id:'second',updated_at:'one'}]));
  assert.notEqual(first,moodboardFingerprint([row],new Set(),room,[{id:material,texture_asset_id:'first',updated_at:'two'}]));
});

const assetId='33333333-3333-4333-8333-333333333333';
const swatchInput={materialId:material,assetId,expectedTextureAssetId:null,rightsConfirmed:true};
function swatchFixture(extra:Record<string,unknown>={}) {
  return client({material_assignments:[{target_kind:'room',target_id:room,semantic_slot:'wall',material_id:material,revision:1,status:'draft'}],material_library_items:[{id:material,texture_asset_id:null,updated_at:'2026-10-13',metadata:{supplierCode:'123'}}],project_assets:[{id:assetId,kind:'reference_image',mime_type:'image/png',storage_path:'org/p/references/image.png'}],...extra});
}
test('swatch attaches actual room material and preserves source metadata',async()=>{
  const fixture=swatchFixture();await attachMoodboardSwatch(fixture.db,'p',room,swatchInput);
  const update=fixture.updates[0] as any;assert.equal(update.texture_asset_id,assetId);assert.equal(update.metadata.supplierCode,'123');assert.equal(update.metadata.sampleNotColorCalibrated,true);assert.equal(update.metadata.swatchSource,'uploaded-sample');assert.equal('unit_cost' in update,false);
});
test('swatch rejects rights refusal, unassigned materials and unauthorized images',async()=>{
  for(const [fixture,input] of [[swatchFixture(),{...swatchInput,rightsConfirmed:false}],[swatchFixture({material_assignments:[]}),swatchInput],[swatchFixture({project_assets:[{id:assetId,kind:'reference_image',mime_type:'image/png',storage_path:'other/p/references/image.png'}]}),swatchInput]] as const) {
    await assert.rejects(attachMoodboardSwatch(fixture.db,'p',room,input),(e:any)=>e.status===422);assert.equal(fixture.updates.length,0);
  }
});
test('swatch rejects stale expected identity and zero-row concurrent update',async()=>{
  await assert.rejects(attachMoodboardSwatch(swatchFixture().db,'p',room,{...swatchInput,expectedTextureAssetId:assetId}),(e:any)=>e.status===409);
  await assert.rejects(attachMoodboardSwatch(swatchFixture({__updateResult:null}).db,'p',room,swatchInput),(e:any)=>e.status===409);
});

test('failed swatch writes return unavailable rather than success',async()=>{
  await assert.rejects(attachMoodboardSwatch(swatchFixture({__updateError:{code:'42501'}}).db,'p',room,swatchInput),(e:any)=>e.status===503);
});
