import test from 'node:test';import assert from 'node:assert/strict';
import { updateRoomAtRevision } from '../src/room-save-content';
test('competing room writes from the same revision cannot overwrite the first save',async()=>{
 let saved:any={id:'room',project_id:'project',updated_at:'v1',name:'Original'};
 const client={from:()=>({update:(patch:any)=>{const filters:Record<string,string>={};const query={eq:(key:string,value:string)=>{filters[key]=value;return query;},select:()=>query,maybeSingle:async()=>{if(!Object.entries(filters).every(([key,value])=>saved[key]===value))return {data:null,error:null};saved={...saved,...patch};return {data:saved,error:null};}};return query;}})};
 const first=await updateRoomAtRevision(client,'project','room','v1',{name:'First',updated_at:'v2'});
 const second=await updateRoomAtRevision(client,'project','room','v1',{name:'Second',updated_at:'v3'});
 assert.equal(first.data.name,'First');assert.equal(second.data,null);assert.equal(saved.name,'First');
});
