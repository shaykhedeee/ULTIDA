import {useEffect,useState} from 'react';
import {supabase} from '../../lib/supabase';import {getApiBase} from '../../lib/api-base';
export default function KitchenAiReview({projectId,roomId}:{projectId:string;roomId:string}) {
 const [width,setWidth]=useState(''),[aisle,setAisle]=useState(''),[proposal,setProposal]=useState<any>(null),[event,setEvent]=useState<any>(null),[status,setStatus]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function request(path:string,body?:unknown,signal?:AbortSignal){
  const session=(await supabase?.auth.getSession())?.data.session;if(!session)throw new Error('Sign in to review AURA proposals.');
  const response=await fetch(`${getApiBase()}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal});
  const data=await response.json();if(!response.ok||!data.success)throw new Error(data.message??data.code??'AURA persistence is unavailable.');return data;
 }
 useEffect(()=>{const controller=new AbortController();void request(`/aura/audit-events?projectId=${encodeURIComponent(projectId)}&limit=500`,undefined,controller.signal).then(data=>{
   if(controller.signal.aborted)return;
   const created=data.events.find((e:any)=>e.toolId==='place_modular_kitchen'&&e.eventType==='proposal_created'&&e.payload?.proposal?.roomId===roomId);
   if(created){setEvent(created);setProposal(created.payload.proposal);const latest=data.events.find((e:any)=>e.proposalId===created.proposalId);setStatus(latest?.eventType??'proposal_created');}
 }).catch(err=>{if(!controller.signal.aborted)setError(err.message);});return()=>controller.abort();},[projectId,roomId]);
 async function preview(){setBusy(true);setError('');try{const data=await request('/aura/tools/place_modular_kitchen/preview',{projectId,roomId,widthMm:Number(width),clearanceMm:Number(aisle)});setProposal(data.proposal);setEvent(data.audit.event);setStatus('proposal_created');}catch(err){setError(err instanceof Error?err.message:'Preview failed.');}finally{setBusy(false);}}
 async function review(decision:'proposal_approved'|'proposal_rejected'){setBusy(true);setError('');try{
   const session=(await supabase?.auth.getSession())?.data.session;if(!session||!event)throw new Error('Load a saved proposal first.');
   await request('/aura/audit-events',{id:crypto.randomUUID(),projectId,actorId:session.user.id,toolId:'place_modular_kitchen',sourceVersionId:event.sourceVersionId,proposalId:event.proposalId,eventType:decision,payload:{},createdAt:new Date().toISOString()});setStatus(decision);
 }catch(err){setError(err instanceof Error?err.message:'Approval save failed.');}finally{setBusy(false);}}
 return <section className="moodboard-maker" aria-label="Measured kitchen AURA proposal"><h3>Review kitchen module selection</h3>
 <p>AURA uses the approved measured plan and real catalog identities. Designer approval is saved separately from geometry and production approval.</p>
 {error&&<p role="alert" className="mb-alert">{error}</p>}
 <fieldset disabled={busy} style={{border:0,padding:0}}><label>Measured available wall run mm<input type="number" min="1200" value={width} onChange={e=>setWidth(e.target.value)}/></label><label>Measured clear aisle mm<input type="number" min="900" value={aisle} onChange={e=>setAisle(e.target.value)}/></label><button type="button" disabled={!width||!aisle} onClick={()=>void preview()}>Create saved proposal</button>
 {proposal&&<><p role="status">{status.replaceAll('_',' ')} · plan {proposal.sourcePlanVersionId} · proposal {event?.proposalId}</p><ul>{proposal.modules.map((module:any,i:number)=><li key={i}>{module.moduleId} · {module.widthMm} × {module.depthMm} × {module.heightMm} mm</li>)}</ul><p>Unfilled run: {proposal.unfilledWidthMm} mm. Review opening clearances, fillers and corners before placing these modules in the room.</p><button type="button" disabled={status!=='proposal_created'} onClick={()=>void review('proposal_approved')}>Approve saved selection</button><button type="button" disabled={status!=='proposal_created'} onClick={()=>void review('proposal_rejected')}>Reject saved selection</button></>}
 </fieldset></section>;
}
