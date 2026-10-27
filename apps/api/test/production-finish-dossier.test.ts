import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { PDFDocument } from 'pdf-lib';
import { app } from '../src/index.js';
const scene = (room: string) => ({ schema:'scene.v1',units:'mm',projectId:'p',floorPlanVersionId:'plan',coordinateSystem:'right-handed-z-up',
 floors:[{id:'f',name:'Floor',elevationMm:0,heightMm:2700}],spaces:[{id:room,floorId:'f',name:room,type:'kitchen'}],
 rooms:[{id:room,spaceId:room,name:room,type:'kitchen',boundary:[{xMm:0,yMm:0},{xMm:3000,yMm:0},{xMm:3000,yMm:3000},{xMm:0,yMm:3000},{xMm:0,yMm:0}],confidence:1}],
 walls:[],openings:[],fixedFixtures:[],materials:[],lighting:[],cameras:[],constraints:[],unresolvedDetections:[],
 modules:[{id:`m-${room}`,family:'kitchen-base',templateId:'kit-base-600',roomId:room,widthMm:600,depthMm:600,heightMm:800,position:{xMm:0,yMm:0},rotationDeg:0,anchor:'floor',confidence:1}],
 moduleParts:[{id:`part-${room}`,moduleId:`m-${room}`,roomId:room,semanticType:'shelf',name:'Shelf',widthMm:560,depthMm:500,heightMm:18,materialId:'ply',position:{xMm:0,yMm:0,zMm:0},rotationDeg:0,confidence:1}],
 metadata:{branch:'main',schemaVersion:'scene.v1',status:'approved',designVersion:`design-${room}`,changeReason:'fixture'} });
test('authenticated finish edits save a draft and project dossier covers both exact rooms',async()=>{
 const env={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_PUBLISHABLE_KEY};
 process.env.SUPABASE_URL='https://production-test.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='test';
 const original=globalThis.fetch;let inserted:any=null;
 const rows=['kitchen','bedroom'].map((room,i)=>({id:`scene-${room}`,status:'approved',version_number:2-i,branch_name:'main',floor_plan_version_id:'plan',scene:scene(room)}));
 const queries:string[]=[];
 globalThis.fetch=(async(input:any,init:any)=>{
  const url=new URL(input instanceof Request?input.url:String(input));
  if(url.hostname!=='production-test.supabase.co')return original(input,init);
  queries.push(url.pathname+url.search);
  if(url.pathname==='/auth/v1/user')return Response.json({id:'user',email:'test@example.test'});
  const table=url.pathname.split('/').at(-1);
  if(table==='projects')return Response.json([{id:'p',organization_id:'org'}]);
  if(table==='organization_members')return Response.json([{organization_id:'org',role:'designer'}]);
  if(table==='scene_versions') {
   if(init?.method==='POST'){inserted=JSON.parse(init.body);return Response.json({id:inserted.id});}
   const id=url.searchParams.get('id')?.replace(/^eq\./,'');return Response.json(id?rows.filter(r=>r.id===id):url.searchParams.get('limit')==='1'?rows.slice(0,1):rows);
  }
  if(table==='spaces')return Response.json([{id:'db-k',space_id:'kitchen',floor_plan_version_id:'plan'},{id:'db-b',space_id:'bedroom',floor_plan_version_id:'plan'}]);
  if(table==='floor_plan_versions')return Response.json([{id:'plan',status:'approved',canonical_model:{spaces:[{id:'kitchen'},{id:'bedroom'}]}}]);
  if(['production_snapshot_reviews','project_briefs','artifacts'].includes(table!))return Response.json([]);
  return Response.json({message:'Unexpected mock request'},{status:500});
 }) as typeof fetch;
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${(server.address() as any).port}/api/projects/p`;
 const headers={Authorization:'Bearer test','Content-Type':'application/json'};
 try {
  const recipe={mode:'laminate_after_cut',faceA:{code:'oak',thicknessMm:1,grain:'length',allowanceMm:10,stockWidthMm:2440,stockHeightMm:1220},faceB:null};
  const saved=await fetch(`${base}/scenes/scene-kitchen/surface-recipes`,{method:'POST',headers,body:JSON.stringify({assignments:[{partId:'part-kitchen',surfaceRecipe:recipe}]})});
  assert.equal(saved.status,201,await saved.text());assert.equal(inserted.status,'draft');assert.equal(inserted.scene.metadata.status,'draft');
  assert.deepEqual(inserted.scene.moduleParts[0].surfaceRecipe,recipe);assert.equal(rows[0].scene.moduleParts[0].surfaceRecipe,undefined);
  const bad=await fetch(`${base}/scenes/scene-kitchen/surface-recipes`,{method:'POST',headers,body:JSON.stringify({assignments:[{partId:'alien',surfaceRecipe:recipe}]})});assert.equal(bad.status,422);
  const result=await fetch(`${base}/dossier.pdf`,{headers});const bytes=await result.arrayBuffer();
  assert.equal(result.status,200,Buffer.from(bytes).toString());assert.ok((await PDFDocument.load(bytes)).getPageCount()>8);
  assert.equal(result.headers.get('x-ultida-scene-version'),null);assert.equal(result.headers.get('x-ultida-dossier-scene-count'),'2');assert.equal(result.headers.get('x-ultida-production-status'),'review_required');assert.equal(result.headers.get('x-ultida-visual-completeness'),'missing-approved-renders');
  assert.ok(queries.some(q=>q.includes('id=eq.scene-kitchen')));assert.ok(queries.some(q=>q.includes('id=eq.scene-bedroom')));
  rows[0].status='draft';const blocked=await fetch(`${base}/dossier.pdf`,{headers});assert.equal(blocked.status,422);assert.match((await blocked.json()).message,/NOT_APPROVED/);
 }finally{
  await new Promise<void>(resolve=>server.close(()=>resolve()));globalThis.fetch=original;
  if(env.url===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=env.url;
  if(env.key===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;else process.env.SUPABASE_PUBLISHABLE_KEY=env.key;
 }
});
