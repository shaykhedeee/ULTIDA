import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
let server,browser,url;
before(async()=>{
 const names=['catalog-core','contracts','drawing-core','plan-core','scene-core','scene-compiler','spaces-core','module-framework','geometry-core','layout-core','rule-core'];
 server=await createServer({configFile:false,root:resolve('apps/web'),resolve:{alias:Object.fromEntries(names.map(name=>['@ultida/'+name,resolve('packages/'+name+'/src')]))},server:{host:'127.0.0.1',port:0},plugins:[{
 name:'studio-edit-fixture',enforce:'pre',resolveId(source){if(/\/lib\/supabase(?:\.ts)?$/.test(source))return '\0studio-auth';},load(id){if(id==='\0studio-auth')return `const session={access_token:'fixture-only',user:{id:'fixture-user'}};export const supabase={auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};`;},
 configureServer(vite){vite.middlewares.use('/__studio-test',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/__studio-test',`<div id="root"></div><script type="module">
 import '/src/styles.css';import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route,Link} from 'react-router-dom';import {SpacesWorkspace} from '/src/features/spaces/SpacesWorkspace.tsx';
 createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,{initialEntries:['/projects/p/spaces']},React.createElement(Link,{to:'/projects/q/spaces'},'Switch project'),React.createElement(Routes,null,React.createElement(Route,{path:'/projects/:projectId/spaces',element:React.createElement(SpacesWorkspace)}))));</script>`));});}
 }]});await server.listen();url=`http://127.0.0.1:${server.httpServer.address().port}`;browser=await chromium.launch({headless:true});
});
after(async()=>{await browser?.close();await server?.close();});
const point=(xMm,yMm)=>({xMm,yMm});
async function fixture(){
 const page=await browser.newPage({viewport:{width:1600,height:1000}});page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error' && !/Failed to load resource:.*(?:409|503)/.test(message.text()))errors.push(message.text());});
 let module={id:'module',label:'Kitchen base',updated_at:'2026-11-06T00:00:00Z',status:'validated',config_json:{widthMm:600,depthMm:560,heightMm:720},position_json:{wallId:'w1',offsetMm:100,xMm:100,yMm:0,rotationDeg:0}};
 const patches=[];const placements=[];const finishWrites=[];const assignments=[];const placed=[];const writes=[];let releasePlacement=()=>{};let mode='ok';
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;let payload={};if(route.request().method()!=='GET')writes.push(path);
  if(path.endsWith('/floor-plan/active'))payload={floorPlanVersionId:'plan',scaleVerified:true,ceilingHeightMm:2700,rooms:[{id:'room',spaceRecordId:path.includes('/projects/q/')?'space-other':'space',name:'Kitchen',roomType:'kitchen',polygon:[point(0,0),point(4000,0),point(4000,3000),point(0,3000)],requiredFurniture:['kitchen_base'],wallRefs:['w1','w2','w3','w4'],verificationStatus:'verified'}],walls:[{id:'w1',start:point(0,0),end:point(4000,0)},{id:'w2',start:point(4000,0),end:point(4000,3000)},{id:'w3',start:point(4000,3000),end:point(0,3000)},{id:'w4',start:point(0,3000),end:point(0,0)}],openings:[],issues:[]};
  if(path.endsWith('/layouts'))payload={layouts:[{id:'layout',space_id:'space',status:'approved'}]};
  if(path.endsWith('/module-instances'))payload={modules:path.includes('/projects/q/')?[{...module,id:'other-base',label:'Other project base'}]:[module,...placed]};
  if(path.endsWith('/module-instances')&&route.request().method()==='POST'){const body=route.request().postDataJSON();placements.push(body);if(mode==='hold-placement')await new Promise(resolve=>{releasePlacement=resolve;});const item={...module,id:body.requestId,label:body.label,config_json:body.config,position_json:{...body.position,xMm:body.position.offsetMm,yMm:0,rotationDeg:0}};placed.push(item);payload={module:item};}
  if(path.endsWith('/design-context'))payload={context:{materialLibrary:[{id:'finish-one',name:'Merino One',code:'M001',category:'laminate'},{id:'finish-two',name:'Merino Two',code:'M002',category:'laminate'}],materialAssignments:assignments}};
  if(path.endsWith('/material-assignments')&&route.request().method()==='POST'){
   const body=route.request().postDataJSON();finishWrites.push(body);
   if(mode==='offline')return route.fulfill({status:503,json:{message:'Fixture connection unavailable'}});
   if(mode==='conflict'){mode='ok';assignments.push({id:'competing-finish',material_id:'finish-one',semantic_slot:body.semanticSlot,module_instance_id:body.moduleInstanceId,target_kind:body.targetKind,target_id:body.targetId,revision:1});return route.fulfill({status:409,json:{code:'MATERIAL_ASSIGNMENT_STALE'}});}
   const assignment={id:body.requestId,material_id:body.materialId,semantic_slot:body.semanticSlot,module_instance_id:body.moduleInstanceId,target_kind:body.targetKind,target_id:body.targetId,revision:body.expectedRevision+1};assignments.push(assignment);payload={assignment};
  }
  if(path.endsWith('/module-instances/module')&&route.request().method()==='PATCH'){
   const body=route.request().postDataJSON();patches.push(body);
   if(mode==='offline')return route.fulfill({status:503,json:{message:'Fixture connection unavailable'}});
   if(mode==='conflict'){mode='ok';module={...module,updated_at:'2026-11-06T01:00:00Z',config_json:{...module.config_json,widthMm:650}};return route.fulfill({status:409,json:{code:'MODULE_EDIT_STALE'}});}
   module={...module,updated_at:new Date(Date.parse(module.updated_at)+1000).toISOString(),config_json:{...module.config_json,...body.config},position_json:{...module.position_json,...body.position,xMm:body.position.offsetMm}};payload={module};
  }
  await route.fulfill({json:payload});
 });
 await page.goto(url+'/__studio-test');try { await page.getByRole('button',{name:'Kitchen base',exact:true}).click(); } catch (error) { console.log({errors,body:(await page.locator('body').innerText()).slice(0,1200)}); throw error; }
 return {page,patches,placements,finishWrites,writes,errors,releasePlacement:()=>releasePlacement(),setMode:value=>{mode=value;}};
}
test('studio autosaves numeric changes, retains failed drafts after reload and resolves conflicts explicitly',async()=>{
 const {page,patches,errors,setMode}=await fixture();try {
 const width=page.getByLabel('Width (mm)',{exact:true});await width.fill('750');await expect.poll(()=>patches.length).toBe(1);await expect(page.locator('.studio-save-status')).toHaveText('Saved');
 setMode('conflict');await width.fill('800');await width.blur();await expect(page.getByRole('region',{name:'Resolve furniture conflict'})).toBeVisible();await expect(width).toHaveValue('800');
 await page.getByRole('button',{name:'Keep my changes and retry'}).click();await expect(page.locator('.studio-save-status')).toHaveText('Saved');assert.equal(patches.at(-1).expectedUpdatedAt,'2026-11-06T01:00:00Z');
 setMode('offline');await width.fill('900');await width.blur();await expect(page.getByRole('button',{name:'Retry save',exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Kitchen base · recover draft'}).click();await expect(width).toHaveValue('900');
 setMode('ok');await page.getByRole('button',{name:'Retry save',exact:true}).click();await expect(page.locator('.studio-save-status')).toHaveText('Saved');assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
test('canvas resize sends no requests during pointer movement and commits on release',async()=>{
 const {page,patches,errors}=await fixture();try{
 const handle=page.getByRole('button',{name:'Resize furniture width · arrow keys adjust 10 mm'});await expect(handle).toBeVisible();const box=await handle.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+35,box.y+box.height/2,{steps:5});
 await page.waitForTimeout(900);assert.equal(patches.length,0);await page.mouse.up();await expect.poll(()=>patches.length).toBe(1);assert.ok(patches[0].config.widthMm>600);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(()=>patches.length).toBe(2);assert.equal(patches[1].config.widthMm,600);assert.deepEqual(errors,[]);
 }finally{await page.close();}
});

test('failed finishes recover after reload and competing assignments require a deliberate choice',async()=>{
 const {page,finishWrites,errors,setMode}=await fixture();try{
 setMode('offline');await page.getByLabel('Project internal laminate · inherited').selectOption('finish-one');await expect(page.getByRole('button',{name:'Retry finish save'})).toBeEnabled();
 const originalId=finishWrites[0].requestId;await page.reload();await expect(page.getByRole('button',{name:'Retry finish save'})).toBeEnabled();setMode('ok');await page.getByRole('button',{name:'Retry finish save'}).click();await expect(page.getByText('Unsaved finish selection',{exact:true})).toHaveCount(0);assert.equal(finishWrites[1].requestId,originalId);
 await page.getByRole('button',{name:'Kitchen base',exact:true}).click();setMode('conflict');await page.getByLabel('This unit’s external finish').selectOption('finish-two');await expect(page.getByText('Finish conflict',{exact:true})).toBeVisible();
 await expect(page.getByText('Saved: Merino One',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Keep proposed finish and retry'}).click();await expect(page.getByText('Finish conflict',{exact:true})).toHaveCount(0);assert.equal(finishWrites.at(-1).expectedRevision,1);assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
test('placement opens size and finish controls and keeps the furniture library ready',async()=>{
 const {page,placements,writes,errors}=await fixture();try{
 await page.getByRole('button',{name:'Add furniture',exact:true}).click();await page.getByLabel('Filter by module family').selectOption('kitchen-base');
 await page.locator('.dld-btn-place').first().click();await expect.poll(()=>placements.length).toBe(1);
 await expect(page.getByLabel('Width (mm)',{exact:true})).toHaveValue(String(placements[0].config.widthMm));await expect(page.getByLabel('This unit’s external finish')).toBeVisible();
 await expect(page.getByLabel('Filter by module family')).toHaveValue('kitchen-base');assert.equal(placements[0].prepareRoom,true);assert.match(placements[0].requestId,/^[0-9a-f-]{36}$/);assert.equal(writes.some(path=>path.endsWith('/layouts')||path.includes('/spaces/')),false);await expect(page.getByText('FRIDGE',{exact:true})).toHaveCount(0);await expect(page.locator('.toolbar .tool-btn').filter({hasText:'Draw room'})).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});
 const mobileInspector = await page.locator('.props-region').boundingBox();assert.ok(mobileInspector.x>=0 && mobileInspector.x+mobileInspector.width<=391,'Inspector remains within the mobile viewport');
 const mobileHeader=await page.locator('.page-header-text').boundingBox();assert.ok(mobileHeader.height<180,'Mobile header does not reserve desktop flex basis as height');
 if(process.env.ULTIDA_QA_SCREENSHOTS){await page.setViewportSize({width:1600,height:1000});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:process.env.ULTIDA_QA_SCREENSHOTS+'/studio-desktop.png',fullPage:false});await page.setViewportSize({width:390,height:844});await page.screenshot({path:process.env.ULTIDA_QA_SCREENSHOTS+'/studio-mobile.png',fullPage:true});}
 assert.deepEqual(errors,[]);
 }finally{await page.close();}
});

test('review discovers unopened drafts after reload and pending finishes from another room',async()=>{
 const {page,writes,setMode}=await fixture();try{
 setMode('offline');await page.getByLabel('Width (mm)',{exact:true}).fill('999');await page.getByLabel('Width (mm)',{exact:true}).blur();await expect(page.getByRole('button',{name:'Retry save',exact:true})).toBeVisible();
 await page.reload();const before=writes.length;await page.getByRole('button',{name:'Review in 3D'}).click();await expect(page.getByText('Retained furniture changes',{exact:true})).toBeVisible();assert.equal(writes.length,before);
 await page.getByRole('button',{name:'Discard this retained draft'}).click();await page.evaluate(()=>localStorage.setItem('ultida.finish-draft.v1:fixture-user/p/other-space',JSON.stringify({slot:'shutter',materialId:'finish-two',requestId:'pending',expectedRevision:0})));
 await page.getByRole('button',{name:'Review in 3D'}).click();await expect(page.getByText('Retained finish changes',{exact:true})).toBeVisible();assert.equal(writes.length,before);
 }finally{await page.close();}
});
test('review waits for placement and late placement cannot enter another project with the same canonical room id',async()=>{
 const {page,placements,writes,setMode,releasePlacement,errors}=await fixture();try{
 setMode('hold-placement');await page.getByRole('button',{name:'Add furniture',exact:true}).click();await page.getByLabel('Filter by module family').selectOption('kitchen-base');await page.locator('.dld-btn-place').first().click();await expect.poll(()=>placements.length).toBe(1);
 await page.getByRole('button',{name:'Review in 3D'}).click();await expect(page.getByText('Wait for furniture placement to finish before reviewing.',{exact:true})).toBeVisible();assert.equal(writes.length,1);
 await page.getByRole('link',{name:'Switch project'}).click();await expect(page.getByRole('button',{name:'Other project base',exact:true})).toBeVisible();releasePlacement();await expect(page.getByRole('button',{name:placements[0].label,exact:true})).toHaveCount(0);assert.deepEqual(errors,[]);
 }finally{releasePlacement();await page.close();}
});
