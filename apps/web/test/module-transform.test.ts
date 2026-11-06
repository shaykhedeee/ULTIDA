import test from 'node:test';
import assert from 'node:assert/strict';
import { transformModuleDraft } from '../src/features/spaces/module-transform';
const draft={widthMm:'600',depthMm:'560',heightMm:'720',offsetMm:'100'};
test('resize projects world movement onto the rotated module axes',()=>{
 assert.deepEqual(transformModuleDraft(draft,{xMm:0,yMm:150},90,'width',3000),{...draft,widthMm:'750'});
 assert.deepEqual(transformModuleDraft(draft,{xMm:-40,yMm:0},90,'depth',3000),{...draft,depthMm:'600'});
});
test('move and resize stay within wall bounds and never produce zero dimensions',()=>{
 assert.equal(transformModuleDraft(draft,{xMm:9000,yMm:0},0,'move',3000).offsetMm,'2400');
 assert.equal(transformModuleDraft(draft,{xMm:-9000,yMm:0},0,'width',3000).widthMm,'1');
 assert.equal(transformModuleDraft(draft,{xMm:9000,yMm:0},0,'width',3000).widthMm,'2900');
});
