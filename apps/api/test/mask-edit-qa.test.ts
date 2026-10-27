import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';
import {measureMaskEdit} from '../src/visual-jobs.js';
async function png(data:Buffer){return sharp(data,{raw:{width:512,height:384,channels:4}}).png().toBuffer();}
test('mask QA allows inside changes and blocks outside collateral edits',async()=>{
 const source=Buffer.alloc(512*384*4,255),mask=Buffer.alloc(source.length),edited=Buffer.from(source);
 for(let y=0;y<384;y++)for(let x=0;x<512;x++)if(x<256){const i=(y*512+x)*4;mask.fill(255,i,i+4);edited[i]=0;}
 const original=await png(source),region=await png(mask);
 assert.equal((await measureMaskEdit(original,await png(edited),region)).passed,true);
 edited.fill(0);assert.equal((await measureMaskEdit(original,await png(edited),region)).passed,false);
 assert.equal((await measureMaskEdit(original,original,await png(Buffer.alloc(mask.length)))).passed,false);
});
