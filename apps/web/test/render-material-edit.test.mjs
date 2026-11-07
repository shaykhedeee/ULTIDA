import {test} from 'node:test';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
test('a failed render preview retains the saved component material and reports a preview failure',async()=>{
 const vite=await createServer({configFile:false,root:resolve('apps/web'),server:{host:'127.0.0.1',port:0},plugins:[{name:'render-material-fixture',enforce:'pre',resolveId(source){if(/\/lib\/supabase(?:\.ts)?$/.test(source))return '\0fixture-auth';},load(id){if(id==='\0fixture-auth')return `export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'fixture'}}})}};`;},configureServer(server){server.middlewares.use('/__render-material',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/__render-material',`<div id="root"></div><script type="module">
 import React from 'react';import {createRoot} from 'react-dom/client';import {MaterialSwapPanel} from '/src/components/design/MaterialSwapPanel.tsx';
 createRoot(document.getElementById('root')).render(React.createElement(MaterialSwapPanel,{entityId:'unit',moduleInstanceId:'unit',projectId:'project',onConfirmCatalogSwap:()=>{window.saved=true;},onPreviewCatalogSwap:async()=>{throw Error('Renderer unavailable');}}));</script>`));});}}]});
 let browser;try{
 await vite.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage();
 await page.route('**/api/**',route=>route.fulfill({json:route.request().method()==='POST'?{assignment:{id:'assignment'}}:{materials:[{id:'oak',name:'Oak',code:'OAK1',category:'laminate'}]}}));
 await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__render-material`);
 await page.getByRole('button',{name:'Generate QA-reviewed preview'}).click();
 await expect(page.getByRole('status')).toContainText('saved');
 await expect(page.getByRole('status')).toContainText('preview');
 await expect(page.getByRole('status')).not.toContainText('No material was changed');
 await expect.poll(()=>page.evaluate(()=>window.saved)).toBe(true);
 }finally{await browser?.close();await vite.close();}
});
