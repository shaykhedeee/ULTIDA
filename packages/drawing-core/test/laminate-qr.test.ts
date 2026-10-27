import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { nestPanels2D, nestLaminateFaces, productionQrSvg, productionLabelPayload } from '../src/index.js';
const face = (code: string) => ({ code, thicknessMm: 1, grain: 'length' as const, allowanceMm: 10, stockWidthMm: 2440, stockHeightMm: 1220 });
const part = (id: string, a = 'oak', b = 'white') => ({ id, partInstanceId: id, partName: id, lengthMm: 500, widthMm: 300, thicknessMm: 18, quantity: 1, materialCode: 'ply', grainDirection: 'none', surfaceRecipe: { mode: 'prelaminated', faceA: face(a), faceB: face(b) } } as any);
test('prelaminated opposite and distinct faces cannot share stock; identical recipes can', () => {
 const r = nestPanels2D([part('a'),part('b'),part('c','white','oak'),part('d','oak','grey')]);
 assert.equal(r.totalSheets,3);
 assert.equal(new Set(r.sheets.map(s=>s.sheetId)).size,3);
 assert.equal(r.sheets[0].placedPanels.length,2);
});
test('loose laminate counts both faces with allowances and physical identity', () => {
 const p=part('a');p.surfaceRecipe.mode='laminate_after_cut';
 const r=nestLaminateFaces({ parts:[p],fabricationRules:{kerfMm:3,trimMm:10} } as any);
 assert.equal(r.sheets.length,2);assert.equal(r.complete,true);
 assert.deepEqual(r.parts.map(p=>[p.sourcePartId,p.lengthMm,p.widthMm]),[['a',520,320],['a',520,320]]);
});
test('unassigned faces remain unresolved and explicit bare faces create no sheets',()=>{
 const p=part('a');delete p.surfaceRecipe;
 const s={parts:[p],fabricationRules:{kerfMm:3,trimMm:10}} as any;
 assert.deepEqual(nestLaminateFaces(s).unresolvedPartIds,['a']);
 p.surfaceRecipe={mode:'laminate_after_cut',faceA:null,faceB:null};
 assert.equal(nestLaminateFaces(s).complete,true);assert.equal(nestLaminateFaces(s).sheets.length,0);
});
test('QR actually decodes to project scene and panel including unicode',async()=>{
 const payload=productionLabelPayload({projectId:'project-123',sceneVersion:'scene-456'} as any,part('panel-नमस्ते'));
 const svg=productionQrSvg(payload,0,0,512).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
 const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const decoded=jsQR(new Uint8ClampedArray(data),info.width,info.height);
 assert.equal(decoded?.data,payload);
});
test('invalid nesting dimensions, counts and duplicate IDs fail before packing',()=>{
 assert.throws(()=>nestPanels2D([part('a'),part('a')]),/DUPLICATE/);
 assert.throws(()=>nestPanels2D([{...part('a'),quantity:-1}]),/INVALID/);
 assert.throws(()=>nestPanels2D([part('a')],10,10,3,10),/INVALID/);
});
test('prelaminated width grain forces rotation and opposite face grains are rejected',()=>{
 const p=part('width');p.surfaceRecipe.faceA.grain='width';p.surfaceRecipe.faceB.grain='width';
 const r=nestPanels2D([p]);assert.equal(r.updatedParts[0].placedPos?.rotated,true);
 p.surfaceRecipe.faceB.grain='length';assert.throws(()=>nestPanels2D([p]),/CONFLICTING_PRELAMINATED_GRAIN/);
});
test('QR uses persisted scene UUID instead of a reusable design label',()=>{
 const value=JSON.parse(productionLabelPayload({projectId:'p',sceneVersion:'spaces.v1',savedSceneVersionId:'saved-uuid'} as any,part('a')));
 assert.equal(value.scene,'saved-uuid');
});
