import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewVisualJob } from '../src/visual-jobs.js';
test('review cannot report success without configured persistence', async()=>assert.equal((await reviewVisualJob({},'j','p','approved')).status,'failed'));
test('review uses one atomic database call for job and artifact', async()=>{
  const calls:any[]=[];
  const client={rpc:async(name:string,args:any)=>{calls.push({name,args});return {data:{status:'succeeded',jobId:'j',reviewStatus:'approved'},error:null};}} as any;
  assert.equal((await reviewVisualJob({},'j','p','approved','reviewed',client)).status,'succeeded');
  assert.deepEqual(calls,[{name:'review_visual_job_atomic',args:{p_project_id:'p',p_job_id:'j',p_decision:'approved',p_note:'reviewed'}}]);
});
test('atomic failure or unconfirmed response cannot claim approval', async()=>{
  for(const result of [{data:null,error:{message:'Artifact denied; rollback'}},{data:null,error:null},{data:{status:'unknown'},error:null}]) {
    assert.equal((await reviewVisualJob({},'j','p','approved','',{rpc:async()=>result} as any)).status,'failed');
  }
});
test('database conflict and cancellation retain their status', async()=>{
  for(const status of ['conflict','cancelled','not_found']) assert.equal((await reviewVisualJob({},'j','p','cancelled','',{rpc:async()=>({data:{status},error:null})} as any)).status,status);
});
