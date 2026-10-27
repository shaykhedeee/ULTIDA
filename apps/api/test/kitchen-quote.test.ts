// @ts-nocheck — adversarial runtime contract fixtures.
import { test } from 'node:test';import assert from 'node:assert/strict';
import { previewKitchenQuote, KitchenQuoteError } from '../src/kitchen-quote.ts';
const request=()=>({projectId:'p',roomId:'r',sceneVersionId:'s',lines:[{partInstanceId:'a',unitRateInr:1000},{partInstanceId:'b',unitRateInr:400}],labourInr:100,marginRate:0.1,gstRate:0.18});
const parts=[{partInstanceId:'a'},{partInstanceId:'b'}];
const err=(fn,code)=>assert.throws(fn,e=>e instanceof KitchenQuoteError && e.code===code);
test('exact scene quote computes explicit materials labour margin GST',()=>{const q=previewKitchenQuote(request(),parts);assert.equal(q.totals.materialInr,1400);assert.equal(q.totals.labourInr,100);assert.equal(q.totals.marginInr,150);assert.equal(q.totals.gstInr,297);assert.equal(q.totals.grandTotalInr,1947);assert.equal(q.status,'draft_unapproved')});
test('must specify every cutlist part',()=>{const x=request();x.lines.pop();err(()=>previewKitchenQuote(x,parts),'UNPRICED_PARTS')});
test('unknown part ID rejected',()=>{const x=request();x.lines[0].partInstanceId='invented';err(()=>previewKitchenQuote(x,parts),'UNKNOWN_OR_INVALID_PRICE_LINE')});
test('duplicate part price rejected',()=>{const x=request();x.lines[1].partInstanceId='a';err(()=>previewKitchenQuote(x,parts),'DUPLICATE_QUOTE_LINE')});
test('null negative NaN rates rejected',()=>{const x=request();x.lines[0].unitRateInr=Number.NaN;err(()=>previewKitchenQuote(x,parts),'UNKNOWN_OR_INVALID_PRICE_LINE')});
test('margin rate must be explicit',()=>{const x=request();delete x.marginRate;err(()=>previewKitchenQuote(x,parts),'INVALID_QUOTE_INPUT')});
test('GST rate must be explicit',()=>{const x=request();delete x.gstRate;err(()=>previewKitchenQuote(x,parts),'INVALID_QUOTE_INPUT')});
test('cutlist requires stable part IDs',()=>err(()=>previewKitchenQuote(request(),[{partInstanceId:'a'},{}]),'UNVERIFIED_CUTLIST'));
test('duplicate cutlist IDs fail',()=>err(()=>previewKitchenQuote(request(),[{partInstanceId:'a'},{partInstanceId:'a'}]),'DUPLICATE_PRODUCTION_PART'));
test('zero GST allowed when explicitly set',()=>{const x=request();x.gstRate=0;assert.equal(previewKitchenQuote(x,parts).totals.grandTotalInr,1650)});
