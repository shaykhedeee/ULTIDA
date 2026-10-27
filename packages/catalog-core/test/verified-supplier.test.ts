// @ts-nocheck — runtime contract fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VERIFIED_MERINO_REFERENCES, VERIFIED_IKEA_REFERENCES, findVerifiedProduct,
  assertRetailIsNotCutlistPart,
} from '../src/verified-supplier-catalog.ts';
import { proposeModularRuns } from '../src/modular-run-intelligence.ts';

const modules = [300,450,600,750,900].map(width => ({
  id:`kit-base-${width}`,sku:`ULT-KB-${width}`,family:'kitchen-base',name:`${width} Base Cabinet`,
  widthMm:width,depthMm:600,heightMm:750,minClearanceMm:900,tags:['base','drawer'],
  production:{panelBased:true,cutlistSupported:true},
}));
const serviceUnit={...modules[2],id:'kit-sink-600',sku:'ULT-K-SINK',name:'600 Sink Base',tags:['sink']};

test('merino catalogue is deduplicated and uses manufacturer-listed real decor codes',()=>{
  assert.ok(VERIFIED_MERINO_REFERENCES.length>=10);
  assert.equal(new Set(VERIFIED_MERINO_REFERENCES.map(x=>x.id)).size,VERIFIED_MERINO_REFERENCES.length);
  assert.equal(VERIFIED_MERINO_REFERENCES.find(x=>x.decorCode==='14149')?.name,'Alameda Oak Dune');
  assert.ok(VERIFIED_MERINO_REFERENCES.every(x=>x.sourceUrl.includes('merinolaminates.com')&&x.visualSwatchUrl===null&&x.actualThicknessMm===null));
});
test('IKEA SKUs are actual product references, never fabrication parts',()=>{
  assert.ok(VERIFIED_IKEA_REFERENCES.length>=5);
  assert.ok(VERIFIED_IKEA_REFERENCES.every(x=>x.productUrl.includes('ikea.com/in/')&&x.modelUrl===null&&assertRetailIsNotCutlistPart(x)));
  assert.deepEqual(findVerifiedProduct('ikea-billy-00522047')?.dimensionsMm,{width:800,depth:280,height:2020});
});
test('three alternatives use actual IDs and do not fake more than feasible',()=>{
  const result=proposeModularRuns({wallLengthMm:3000,availableAisleMm:1000,family:'kitchen-base'}, [...modules,serviceUnit]);
  assert.equal(result.proposals.length,3);
  const ids=new Set(modules.map(m=>m.id));
  for(const p of result.proposals){
    assert.ok(p.placements.length>=1);
    assert.ok(p.placements.every(x=>ids.has(x.templateId)));
    assert.equal(p.validationState,'requires-room-and-hardware-verification');
    assert.ok(p.placements.at(-1).xEndMm<=3000);
    assert.ok(p.coverageRatio<=1);
    assert.equal(p.placements.reduce((n,m)=>n+m.widthMm,0)+p.fillerLeftMm+p.fillerRightMm,3000);
  }
});
test('door or window intervals are never crossed',()=>{
  const result=proposeModularRuns({wallLengthMm:3200,availableAisleMm:1000,family:'kitchen-base',restrictions:[{startMm:1100,endMm:1900,reason:'window'}]},modules);
  for(const p of result.proposals){
    for(const m of p.placements)assert.ok(m.xEndMm<=1100||m.xStartMm>=1900);
  }
  assert.equal(result.examinedSegments.length,2);
});
test('invalid wall measurements and invalid blocked interval reject safely',()=>{
  assert.equal(proposeModularRuns({wallLengthMm:0,availableAisleMm:900,family:'kitchen-base'},modules).proposals.length,0);
  assert.equal(proposeModularRuns({wallLengthMm:3200,availableAisleMm:900,family:'kitchen-base',restrictions:[{startMm:800,endMm:500,reason:'bad'}]},modules).proposals.length,0);
});
test('aisle constraint is a hard feasibility check',()=>{
  const result=proposeModularRuns({wallLengthMm:3000,availableAisleMm:700,family:'kitchen-base'},modules);
  assert.equal(result.proposals.length,0);
});
test('unsupported geometry services and non panel-based items are excluded',()=>{
  const result=proposeModularRuns({wallLengthMm:1200,availableAisleMm:900,family:'kitchen-base'},[serviceUnit,{...modules[2],production:{panelBased:false,cutlistSupported:false}}]);
  assert.equal(result.proposals.length,0);
});
test('unmatched modules never silently become invented product IDs',()=>{
  const result=proposeModularRuns({wallLengthMm:3000,availableAisleMm:900,family:'wardrobe'},modules);
  assert.equal(result.proposals.length,0);
});
test('side returns are honored',()=>{
  const result=proposeModularRuns({wallLengthMm:3200,leftReturnMm:200,rightReturnMm:200,availableAisleMm:900,family:'kitchen-base'},modules);
  for(const p of result.proposals)for(const m of p.placements){assert.ok(m.xStartMm>=200);assert.ok(m.xEndMm<=3000);}
});

import { checkSupplierAssetRights } from '../src/supplier-asset-rights.ts';
const licensedAsset={supplier:'IKEA',productSku:'005.220.47',kind:'glb',sourceUrl:'https://licensed-assets.example.com/billy.glb',sha256:'a'.repeat(64),boundingBoxMm:{width:800,depth:280,height:2020}};
const grant={supplier:'IKEA',scope:['hosted-3d'],proofReference:'vendor-contract-123',approvedBy:'IKEA partner manager',validFrom:'2026-01-01',validUntil:'2027-01-01',territory:'IN',permittedSkuIds:['005.220.47']};
test('reported IKEA permission alone never grants right to rehost GLB',()=>{
  assert.equal(checkSupplierAssetRights({grant:null,asset:licensedAsset,intendedUse:'hosted-3d',atDate:'2026-10-13'}).allowed,false);
  assert.equal(checkSupplierAssetRights({grant:null,asset:licensedAsset,intendedUse:'catalog-metadata',atDate:'2026-10-13'}).allowed,true);
});
test('documented rights allow only scoped SKU and usage',()=>{
  assert.equal(checkSupplierAssetRights({grant,asset:licensedAsset,intendedUse:'hosted-3d',atDate:'2026-10-13'}).allowed,true);
  assert.equal(checkSupplierAssetRights({grant,asset:licensedAsset,intendedUse:'display-thumbnail',atDate:'2026-10-13'}).allowed,false);
  assert.equal(checkSupplierAssetRights({grant,asset:{...licensedAsset,productSku:'999.999.99'},intendedUse:'hosted-3d',atDate:'2026-10-13'}).allowed,false);
});
test('missing 3D geometry evidence is rejected',()=>{
  assert.equal(checkSupplierAssetRights({grant,asset:{...licensedAsset,boundingBoxMm:undefined},intendedUse:'hosted-3d',atDate:'2026-10-13'}).allowed,false);
});
