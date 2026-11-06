import test from 'node:test';import assert from 'node:assert/strict';
import { placementRequestId, completePlacementRequest } from '../src/features/spaces/placement-request';
test('an unconfirmed placement retains its identity across reload; confirmed placements start a new request',()=>{
 const data=new Map<string,string>();const store={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}};
 const first=placementRequestId(store,'alice/project/room/position');assert.equal(placementRequestId(store,'alice/project/room/position'),first);
 assert.notEqual(placementRequestId(store,'bob/project/room/position'),first);
 completePlacementRequest(store,'alice/project/room/position');assert.notEqual(placementRequestId(store,'alice/project/room/position'),first);
});
