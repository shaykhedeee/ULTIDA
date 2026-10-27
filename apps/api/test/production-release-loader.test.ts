import test from 'node:test';
import assert from 'node:assert/strict';
import { readApprovedProductionContext } from '../src/index.ts';
const scene = {floors:[{id:"f",name:"Floor",elevationMm:0,heightMm:2700}],spaces:[],rooms:[],walls:[],openings:[],fixedFixtures:[],materials:[],lighting:[],cameras:[],constraints:[],unresolvedDetections:[],schema:'scene.v1',projectId:'p',floorPlanVersionId:'plan',units:'mm',coordinateSystem:'right-handed-z-up',modules:[{id:'m',family:'wardrobe',templateId:'wardrobe-2100-four-shutter',roomId:'r',widthMm:600,depthMm:600,heightMm:600,position:{xMm:0,yMm:0},rotationDeg:0,anchor:'wall',confidence:1}],moduleParts:[{id:'panel',moduleId:'m',roomId:'r',semanticType:'shelf',name:'Shelf',widthMm:600,depthMm:500,heightMm:18,materialId:'ply',position:{xMm:0,yMm:0,zMm:0},rotationDeg:0,confidence:1}],metadata:{branch:'main',changeReason:'Test',schemaVersion:'scene.v1',status:'approved',designVersion:'exact'}};
function client(sceneResult: any, reviewResult: any) {
 const queries: any[]=[];
 return {queries,from(table:string) { const filters:any={}; queries.push({table,filters}); return {select(){return this},eq(key:string,value:string){filters[key]=value;return this},async maybeSingle(){return table==='scene_versions'?sceneResult:reviewResult}}; }};
}
const request = (intent='draft') => ({params:{projectId:'p',sceneVersionId:'exact'},query:{intent},body:{}} as any);
test('loader uses exact scene and project keys and keeps drafts unapproved',async()=>{
 const c=client({data:{id:'exact',status:'approved',scene}}, {data:null});
 const result=await readApprovedProductionContext(request(),c as any);
 assert.equal(result.snapshot.sceneVersion,'exact');
 assert.equal(result.snapshot.status,'review_required');
 assert.deepEqual(c.queries.map(q=>q.filters),[{project_id:'p',id:'exact'},{project_id:'p',scene_version_id:'exact'}]);
 await assert.rejects(readApprovedProductionContext(request('released'),c as any),{code:'PRODUCTION_REVIEW_REQUIRED',status:409});
});
test('loader refuses missing, unapproved or unavailable source evidence',async()=>{
 for(const [source,review,code] of [
 [{data:null},{data:null},'SCENE_VERSION_NOT_FOUND'],
 [{error:{message:'offline'}},{data:null},'SCENE_VERSION_READ_FAILED'],
 [{data:{status:'draft',scene}},{data:null},'SCENE_NOT_PRODUCTION_READY'],
 [{data:{status:'approved',scene}},{error:{code:'PGRST205'}},'PRODUCTION_REVIEW_UNAVAILABLE'],
 ] as const) await assert.rejects(readApprovedProductionContext(request(),client(source,review) as any),{code});
});
