import {useEffect,useState} from 'react';
import {supabase} from '../../lib/supabase';
import {getApiBase} from '../../lib/api-base';
type Part={partInstanceId:string;partName:string;lengthMm:number;widthMm:number};
type Quote={id:string;revision:number;status:string;document:any};
export default function KitchenQuoteReview({projectId,roomId,sceneVersionId}:{projectId:string;roomId:string;sceneVersionId:string}) {
 const [parts,setParts]=useState<Part[]>([]),[rates,setRates]=useState<Record<string,string>>({}),[quote,setQuote]=useState<Quote|null>(null);
 const [labour,setLabour]=useState(''),[margin,setMargin]=useState(''),[gst,setGst]=useState(''),[source,setSource]=useState(''),[effectiveDate,setEffectiveDate]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(true),[dirty,setDirty]=useState(false),[confirmed,setConfirmed]=useState(false),[productionApproved,setProductionApproved]=useState(false),[reload,setReload]=useState(0);
 const base=`${getApiBase()}/projects/${encodeURIComponent(projectId)}/scenes/${encodeURIComponent(sceneVersionId)}`;
 async function request(path:string,body?:unknown,signal?:AbortSignal) {
   const session=(await supabase?.auth.getSession())?.data.session;if(!session)throw new Error('Sign in to review kitchen pricing.');
   const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal});
   const data=await response.json();if(!response.ok||!data.success)throw new Error(data.message??(response.status===409?'Quote or scene changed. Reload before saving.':'Quotation is unavailable.'));return data;
 }
 useEffect(()=>{const controller=new AbortController();setBusy(true);setError('');
   void Promise.all([request('/production-snapshot',undefined,controller.signal),request(`/kitchen/quote?roomId=${encodeURIComponent(roomId)}`,undefined,controller.signal)]).then(([snapshot,saved])=>{
     if(controller.signal.aborted)return;
     setParts(snapshot.cutlist.parts);setProductionApproved(snapshot.review?.status==='approved');setQuote(saved.quote);
     const doc=saved.quote?.document;setRates(Object.fromEntries((doc?.lines??[]).map((line:any)=>[line.sourcePartId,String(line.unitRateInr)])));
     setLabour(doc?String(doc.labourInr):'');setMargin(doc?String(doc.marginRate*100):'');setGst(doc?String(doc.gstRate*100):'');
     const sources=new Set((doc?.lines??[]).map((l:any)=>l.rateSource));setSource(sources.size===1?String(doc.lines[0].rateSource??''):'');setEffectiveDate(doc?.lines?.[0]?.effectiveDate??'');setDirty(false);setConfirmed(false);
   }).catch(err=>{if(!controller.signal.aborted)setError(err.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});return()=>controller.abort();
 },[projectId,roomId,sceneVersionId,reload]);
 function changed(){setDirty(true);setConfirmed(false);}
 async function save(status:'draft'|'approved'|'rejected') {
   if(!parts.length || parts.some(part=>!rates[part.partInstanceId]?.trim()) || [labour,margin,gst].some(value=>!value.trim())) {setError('Every exact part needs an explicit per-piece price, labour, margin and GST.');return;}
   setBusy(true);setError('');
   try {
     const payload=await request('/kitchen/quote',{roomId,expectedRevision:quote?.revision??0,status,lines:parts.map(part=>({partInstanceId:part.partInstanceId,unitRateInr:Number(rates[part.partInstanceId]),rateSource:source,effectiveDate})),labourInr:Number(labour),marginRate:Number(margin)/100,gstRate:Number(gst)/100});
     setQuote(payload.quote);setDirty(false);setConfirmed(false);
   }catch(err){setError(err instanceof Error?err.message:'Quote save failed.');}finally{setBusy(false);}
 }
 return <section className="moodboard-maker" aria-label="Scene-linked kitchen quotation">
  <h3>Kitchen quotation</h3><p>Exact saved panel identities · scene {sceneVersionId.slice(0,8)} · {dirty?'Unsaved edits':quote?`${quote.status} revision ${quote.revision}`:'No saved quotation'}</p>
  {error&&<p role="alert" className="mb-alert">{error}</p>}
  <fieldset disabled={busy} style={{border:0,padding:0}}>
   <div style={{maxHeight:350,overflow:'auto'}}><table><thead><tr><th>Exact panel</th><th>Size mm</th><th>Price per piece ₹</th></tr></thead><tbody>{parts.map(part=><tr key={part.partInstanceId}><td>{part.partName}<small style={{display:'block'}}>{part.partInstanceId}</small></td><td>{part.lengthMm} × {part.widthMm}</td><td><input aria-label={`Price for ${part.partInstanceId}`} type="number" min="0" step="0.01" value={rates[part.partInstanceId]??''} onChange={e=>{setRates({...rates,[part.partInstanceId]:e.target.value});changed();}}/></td></tr>)}</tbody></table></div>
   <div className="mb-toolbar">{([['Labour ₹',labour,setLabour],['Margin %',margin,setMargin],['GST %',gst,setGst]] as const).map(([label,value,set])=><label key={label}>{label}<input type="number" min="0" step="0.01" value={value} onChange={e=>{set(e.target.value);changed();}}/></label>)}</div>
   <label>Supplier quotation / rate evidence<input maxLength={500} value={source} onChange={e=>{setSource(e.target.value);changed();}}/></label>
   <label>Rate effective date<input type="date" value={effectiveDate} onChange={e=>{setEffectiveDate(e.target.value);changed();}}/></label>
   <p>Panel estimate only. Hardware, transport, installation, wastage and services require separate quotations.</p>
   <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed the exact parts, supplier rates, exclusions and tax.</label>
   <div className="mb-toolbar"><button type="button" disabled={!parts.length} onClick={()=>void save('draft')}>Save draft revision</button><button type="button" disabled={!confirmed||!productionApproved||!source.trim()||!effectiveDate} onClick={()=>void save('approved')}>Approve quotation revision</button><button type="button" disabled={!quote} onClick={()=>void save('rejected')}>Reject quotation revision</button><button type="button" onClick={()=>setReload(n=>n+1)}>Reload saved · discard edits</button></div>
   {!productionApproved&&<p>Approve the exact production snapshot before commercial approval.</p>}
  </fieldset>
  {quote&&!dirty&&<p>Saved total: ₹{Number(quote.document.totals.grandTotalInr).toLocaleString('en-IN',{maximumFractionDigits:2})} · {quote.status}</p>}
 </section>;
}
