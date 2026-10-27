import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const org='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',room='33333333-3333-4333-8333-333333333333';
async function database() {
 const db=new PGlite();
 await db.exec(`create schema auth; create schema private; create role anon; create role authenticated; create table auth.users(id uuid primary key); insert into auth.users values('${user}'); create function auth.uid() returns uuid language sql as $$select '${user}'::uuid$$; create function private.is_org_member(uuid) returns boolean language sql as $$select $1='${org}'::uuid$$;
 create table organizations(id uuid primary key);insert into organizations values('${org}');
 create table projects(id text primary key,organization_id uuid);insert into projects values('p','${org}');
 create table spaces(id uuid primary key,project_id text,organization_id uuid,room_type text);insert into spaces values('${room}','p','${org}','kitchen');
 create table jobs(id text primary key,project_id text,status text,output jsonb);
 create table artifacts(id text primary key,project_id text,provenance jsonb);
 create table scene_versions(id text primary key,project_id text,status text,scene jsonb);
 create table module_instances(id text,project_id text,space_id uuid);
 create table material_assignments(project_id text,target_kind text,target_id text,module_instance_id text,semantic_slot text,material_id uuid,revision integer,status text);
 create table material_library_items(id uuid,organization_id uuid,texture_asset_id uuid,updated_at timestamptz,metadata jsonb);
 create table project_assets(id uuid,project_id text,organization_id uuid,kind text,mime_type text,storage_path text);
 create table production_snapshot_reviews(project_id text,scene_version_id text,status text,approved_part_ids text[]);
 create table floor_plan_versions(id text,project_id text,status text,approved_at timestamptz,active_version boolean,canonical_model jsonb);
 create table aura_audit_events(id uuid primary key,organization_id uuid,project_id text,actor_id uuid,tool_id text,event_type text,source_version_id text,proposal_id text,payload jsonb,provenance jsonb,created_at timestamptz);
 `);
 for(const name of ['20261017223419_room_moodboard_versions.sql','20261017223424_atomic_visual_review.sql','20261017223425_kitchen_quote_versions.sql','20261017223427_atomic_moodboard_save.sql','20261017223429_atomic_aura_review.sql']) await db.exec(readFileSync(new URL('../../../supabase/migrations/'+name,import.meta.url),'utf8'));
 return db;
}
test('render review rolls back the job when the linked artifact is missing',async()=>{
 const db=await database();try {
 await db.exec(`insert into jobs values('j','p','succeeded','{"artifactId":"missing","renderQa":{"issues":[]}}');`);
 await assert.rejects(db.query("select review_visual_job_atomic('p','j','approved','checked')"));
 const row=await db.query<any>("select output from jobs where id='j'");assert.equal(row.rows[0].output.reviewStatus,undefined);
 await db.exec("insert into artifacts values('missing','p','{}');");
 await db.query("select review_visual_job_atomic('p','j','approved','checked')");
 assert.equal((await db.query<any>("select provenance from artifacts")).rows[0].provenance.reviewStatus,'approved');
 }finally{await db.close();}
});
test('quote approval requires approved exact parts, recalculates totals and conflicts on stale revision',async()=>{
 const db=await database();try{
 const scene={modules:[{id:'m'}],moduleParts:[{id:'part'}]};
 await db.query('insert into scene_versions values($1,$2,$3,$4)', ['s','p','approved',JSON.stringify(scene)]);
 await db.exec(`insert into module_instances values('m','p','${room}');`);
 const document={source:{projectId:'p',roomId:room,sceneVersionId:'s'},lines:[{sourcePartId:'part',unitRateInr:100,rateSource:'Supplier quotation #1',effectiveDate:'2026-10-14'}],labourInr:20,marginRate:.1,gstRate:.18,totals:{grandTotalInr:1}};
 const args=['p',room,'s',0,'approved',JSON.stringify(document),JSON.stringify(scene)];
 const sql='select save_kitchen_quote_atomic($1,$2,$3,$4,$5,$6,$7) as saved';
 await assert.rejects(db.query(sql,args));assert.equal((await db.query<any>('select count(*)::int n from kitchen_quote_versions')).rows[0].n,0);
 await db.query('insert into production_snapshot_reviews values($1,$2,$3,$4)',['p','s','approved',['part']]);
 const saved=(await db.query<any>(sql,args)).rows[0].saved;assert.equal(saved.document.totals.grandTotalInr,155.76);
 await assert.rejects(db.query(sql,args));
 }finally{await db.close();}
});
test('board revision and source checks occur in the append transaction',async()=>{
 const db=await database();try{
 const document={schema:'ultida.moodboard.v1',title:'Kitchen',template:'grid',canvas:{width:800,height:800,background:'#ffffff'},projectId:'p',roomId:room,sourceFingerprint:'source',sceneVersionId:null,cards:[]};
 const sources={assignments:[],materials:[],moduleIds:[]};
 const sql='select save_room_moodboard_atomic($1,$2,$3,$4,$5) as saved';
 const args=['p',room,0,JSON.stringify(document),JSON.stringify(sources)];
 assert.equal((await db.query<any>(sql,args)).rows[0].saved.revision,1);
 await assert.rejects(db.query(sql,args));
 await db.exec(`insert into material_assignments values('p','room','${room}',null,'wall','${org}',1,'draft');`);
 args[2]=1;await assert.rejects(db.query(sql,args));
 assert.equal((await db.query<any>('select count(*)::int n from room_moodboard_versions')).rows[0].n,1);
 }finally{await db.close();}
});

test('AURA decisions serialize, preserve lineage and reject a second terminal decision',async()=>{
 const db=await database();try{
 const event={id:'44444444-4444-4444-8444-444444444444',projectId:'p',actorId:user,toolId:'generate_tv_unit',eventType:'proposal_created',sourceVersionId:'plan',proposalId:'proposal',payload:{}};
 await db.query('select append_aura_event_atomic($1)',[JSON.stringify(event)]);
 event.id='55555555-5555-4555-8555-555555555555';event.eventType='proposal_approved';
 await db.query('select append_aura_event_atomic($1)',[JSON.stringify(event)]);
 event.id='66666666-6666-4666-8666-666666666666';event.eventType='proposal_rejected';
 await assert.rejects(db.query('select append_aura_event_atomic($1)',[JSON.stringify(event)]));
 assert.equal((await db.query<any>('select count(*)::int n from aura_audit_events')).rows[0].n,2);
 }finally{await db.close();}
});

test('privileged append functions deny another organization and anonymous callers',async()=>{
 const db=await database();try{
 await db.exec("insert into projects values('alien','77777777-7777-4777-8777-777777777777');grant usage on schema auth,private to authenticated;set role authenticated;");
 await assert.rejects(db.query("select save_room_moodboard_atomic('alien',$1,0,'{}','{}')",[room]));
 await assert.rejects(db.query("select save_kitchen_quote_atomic('alien',$1,'s',0,'approved','{}','{}')",[room]));
 await assert.rejects(db.query('select append_aura_event_atomic($1)',[JSON.stringify({projectId:'alien',actorId:user})]));
 await db.exec('reset role;set role anon;');
 await assert.rejects(db.query("select save_room_moodboard_atomic('p',$1,0,'{}','{}')",[room]));
 await assert.rejects(db.query("select review_visual_job_atomic('p','j','approved','')"));
 }finally{await db.close();}
});

test('nonempty material snapshots survive serialization and concurrent texture changes invalidate a save',async()=>{
 const db=await database();try{
 const material='88888888-8888-4888-8888-888888888888';
 await db.query('insert into material_library_items values($1,$2,null,$3,$4)',[material,org,'2026-10-14T00:00:00+00:00','{"supplierCode":"real-reference"}']);
 const materials=(await db.query<any>('select to_jsonb(m) m from (select id,texture_asset_id,updated_at,metadata from material_library_items) m')).rows.map(row=>row.m);
 const sources={assignments:[],materials,moduleIds:[]};const document={schema:'ultida.moodboard.v1',title:'Kitchen',template:'grid',canvas:{width:800,height:800,background:'#ffffff'},projectId:'p',roomId:room,sourceFingerprint:'source',sceneVersionId:null,cards:[{id:'card',kind:'material',materialId:material,x:0,y:0,width:100,height:100}]};
 const sql='select save_room_moodboard_atomic($1,$2,$3,$4,$5)';
 await db.query(sql,['p',room,0,JSON.stringify(document),JSON.stringify(sources)]);
 await db.query('update material_library_items set texture_asset_id=$1 where id=$2',[org,material]);
 await assert.rejects(db.query(sql,['p',room,1,JSON.stringify(document),JSON.stringify(sources)]));
 }finally{await db.close();}
});
