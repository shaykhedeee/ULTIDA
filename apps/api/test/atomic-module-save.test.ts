import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const org='11111111-1111-4111-8111-111111111111', user='22222222-2222-4222-8222-222222222222', room='33333333-3333-4333-8333-333333333333', layout='44444444-4444-4444-8444-444444444444', id='55555555-5555-4555-8555-555555555555';
const stamp='2026-11-06T12:00:00Z';
async function database() {
 const db=new PGlite();
 await db.exec(`create schema auth;create schema private;create role anon;create role authenticated;
 create function auth.uid() returns uuid language sql as $$select '${user}'::uuid$$;
 create function private.is_org_member(uuid) returns boolean language sql as $$select $1='${org}'::uuid$$;
 create table projects(id text primary key,organization_id uuid);insert into projects values('p','${org}');
 create table spaces(id uuid primary key,project_id text,organization_id uuid,floor_plan_version_id text,updated_at timestamptz,requirements_json jsonb default '{}');insert into spaces(id,project_id,organization_id,floor_plan_version_id,updated_at) values('${room}','p','${org}','plan','${stamp}');
 create table floor_plan_versions(id text primary key,project_id text,status text,active_version boolean,canonical_model jsonb);insert into floor_plan_versions values('plan','p','approved',true,'{"scale":{"verified":true}}');
 create table layouts(id uuid primary key,project_id text,space_id uuid,status text,organization_id uuid,layout_shape text,label text,candidate_json jsonb,rule_score_json jsonb,created_by uuid,approved_by uuid,approved_at timestamptz);insert into layouts(id,project_id,space_id,status) values('${layout}','p','${room}','approved');
 create table layout_versions(id uuid default gen_random_uuid(),organization_id uuid,project_id text,space_id uuid,version_number integer,status text,config jsonb,candidate_json jsonb,source_plan_version_id text,created_by uuid,approved_by uuid,approved_at timestamptz);
 create table layout_invalidation_events(organization_id uuid,project_id text,source_layout_version_id uuid,reason text,metadata jsonb,created_by uuid);
 create table module_instances(id uuid primary key,organization_id uuid,project_id text,space_id uuid,layout_id uuid,template_id text,category text,label text,config_json jsonb,position_json jsonb,status text,validation_json jsonb,created_by uuid,updated_at timestamptz default clock_timestamp());
 create table scene_versions(project_id text,status text);insert into scene_versions values('p','approved');
 create table artifacts(project_id text,stale boolean);insert into artifacts values('p',false);
 create table material_library_items(id uuid,organization_id uuid);insert into material_library_items values('${id}','${org}');
 create table material_assignments(id uuid primary key,organization_id uuid,project_id text,material_id uuid,module_instance_id uuid,target_kind text,target_id text,semantic_slot text,revision integer,status text,created_by uuid);
 create table quotes(project_id text,stale boolean);insert into quotes values('p',false);`);
 await db.exec(readFileSync(new URL('../../../supabase/migrations/20261106194351_atomic_room_module_save.sql',import.meta.url),'utf8'));
 return db;
}
const candidate=()=>({id,organization_id:org,project_id:'p',space_id:room,layout_id:layout,template_id:'base',category:'kitchen-base',label:'Base',config_json:{widthMm:600},position_json:{wallId:'w'},status:'validated',validation_json:{requestId:id,request:{width:600}},created_by:user});
const call=(db:PGlite,row:any,neighbours:any[]=[],expected:string|null=null,setup:any=null)=>db.query<{saved:any}>(`select save_room_module_atomic($1,$2,$3,$4,$5,$6,$7,$8) saved`,['p',room,stamp,JSON.stringify({scale:{verified:true}}),JSON.stringify(neighbours),JSON.stringify(row),expected,setup?JSON.stringify(setup):null]);
test('module creation and output invalidation commit together; same request replays once',async()=>{
 const db=await database();try {
 const first=await call(db,candidate());const repeated=await call(db,candidate());
 assert.equal(first.rows[0].saved.id,repeated.rows[0].saved.id);
 assert.equal((await db.query<any>('select count(*)::int n from module_instances')).rows[0].n,1);
 assert.equal((await db.query<any>('select status from scene_versions')).rows[0].status,'stale');
 assert.equal((await db.query<any>('select stale from artifacts')).rows[0].stale,true);
 } finally {await db.close();}
});
test('a stale room snapshot refuses a competing module without invalidating outputs',async()=>{
 const db=await database();try {
 await call(db,candidate());await db.exec("update scene_versions set status='approved';update artifacts set stale=false;");
 await assert.rejects(call(db,{...candidate(),id:'66666666-6666-4666-8666-666666666666'}),/changed/i);
 assert.equal((await db.query<any>('select status from scene_versions')).rows[0].status,'approved');
 }finally{await db.close();}
});
test('failed invalidation rolls back the module write',async()=>{
 const db=await database();try {
 await db.exec("alter table quotes add constraint refuse_stale check (not stale);");
 await assert.rejects(call(db,candidate()));
 assert.equal((await db.query<any>('select count(*)::int n from module_instances')).rows[0].n,0);
 assert.equal((await db.query<any>('select status from scene_versions')).rows[0].status,'approved');
 }finally{await db.close();}
});
test('module edit compares acknowledged revision and rejects changed measured sources',async()=>{
 const db=await database();try {
 const saved=(await call(db,candidate())).rows[0].saved;
 const neighbours=[{id,updated_at:saved.updated_at}];
 const edit={...saved,config_json:{widthMm:800},validation_json:{partCount:3}};
 const updated=(await call(db,edit,neighbours,saved.updated_at)).rows[0].saved;
 assert.equal(updated.config_json.widthMm,800);
 await assert.rejects(call(db,edit,neighbours,saved.updated_at),/changed/i);
 await db.exec("update floor_plan_versions set canonical_model='{}';");
 await assert.rejects(call(db,{...candidate(),id:'77777777-7777-4777-8777-777777777777'}),/plan/i);
 }finally{await db.close();}
});
test('cross-project and unauthenticated calls are denied',async()=>{
 const db=await database();try {
 await assert.rejects(call(db,{...candidate(),project_id:'other'}),/denied|scope/i);
 await db.exec('create or replace function auth.uid() returns uuid language sql as $$select null::uuid$$;');
 await assert.rejects(call(db,candidate()),/denied/i);
 }finally{await db.close();}
});

test('placement prepares requirements, layout and approval version in the same transaction',async()=>{
 const db=await database();try{
 await db.exec('delete from layouts');
 const setup={requirements:{requiredFurniture:['kitchen_base']},candidate:{validation:{valid:true},candidateType:'balanced',floorPlanVersionId:'plan',spaceId:room}};
 await call(db,candidate(),[],null,setup);
 assert.equal((await db.query<any>('select requirements_json from spaces')).rows[0].requirements_json.requiredFurniture[0],'kitchen_base');
 assert.equal((await db.query<any>('select status from layouts')).rows[0].status,'approved');
 assert.equal((await db.query<any>('select count(*)::int n from layout_versions')).rows[0].n,1);
 }finally{await db.close();}
});
test('failed placement rolls back generated layout and changed requirements',async()=>{
 const db=await database();try{
 await db.exec("delete from layouts;alter table quotes add constraint refuse_stale check (not stale)");
 const setup={requirements:{requiredFurniture:['kitchen_base']},candidate:{validation:{valid:true},candidateType:'balanced',floorPlanVersionId:'plan',spaceId:room}};
 await assert.rejects(call(db,candidate(),[],null,setup));
 assert.equal((await db.query<any>('select count(*)::int n from layouts')).rows[0].n,0);
 assert.deepEqual((await db.query<any>('select requirements_json from spaces')).rows[0].requirements_json,{});
 }finally{await db.close();}
});
test('finish assignment checks revision, replays requests, and invalidates in the same transaction',async()=>{
 const db=await database();try {
 const assignment={id,material_id:id,target_kind:'semantic_slot',target_id:'p',semantic_slot:'carcass',status:'draft'};
 const save=(a:any,revision:number)=>db.query<any>('select save_studio_finish_atomic($1,$2,$3) saved',['p',JSON.stringify(a),revision]);
 const first=await save(assignment,0);assert.equal(first.rows[0].saved.revision,1);
 const replay=await save(assignment,0);assert.equal(replay.rows[0].saved.id,id);
 await assert.rejects(save({...assignment,status:'approved'},0),/changed/i);
 await assert.rejects(save({...assignment,id:'66666666-6666-4666-8666-666666666666'},0),/changed/i);
 await db.exec("update scene_versions set status='approved';update quotes set stale=false;alter table quotes add constraint refuse_stale check(not stale) not valid;");
 await assert.rejects(save({...assignment,id:'77777777-7777-4777-8777-777777777777'},1));
 assert.equal((await db.query<any>('select count(*)::int n from material_assignments')).rows[0].n,1);
 assert.equal((await db.query<any>('select status from scene_versions')).rows[0].status,'approved');
 }finally{await db.close();}
});
