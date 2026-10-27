type Event = {proposalId:string;toolId:string;eventType:string;payload:Record<string,any>;createdAt:string};
/** Reuse the existing immutable AURA ledger; later rejection/correction revokes proof. */
export function resolveKitchenAiSelection(events:Event[],roomId:string,planId:string) {
    const groups=new Map<string,Event[]>();
    for(const event of events) if(event.toolId==='place_modular_kitchen') groups.set(event.proposalId,[...(groups.get(event.proposalId)??[]),event]);
    const candidates=[...groups.values()].map(history=>history.sort((a,b)=>a.createdAt.localeCompare(b.createdAt))).filter(history=>{
        const proposal=history.find(e=>e.eventType==='proposal_created')?.payload.proposal;
        return proposal?.roomId===roomId && proposal?.sourcePlanVersionId===planId;
    }).sort((a,b)=>b[0]!.createdAt.localeCompare(a[0]!.createdAt));
    const history=candidates[0]; if(!history) return null;
    const proposal=history.find(e=>e.eventType==='proposal_created')?.payload.proposal;
    if(!Array.isArray(proposal?.modules) || !proposal.modules.length) return null;
    return {proposalId:history[0]!.proposalId,roomId,sourcePlanVersionId:planId,approved:history.at(-1)?.eventType==='proposal_approved',templateIds:proposal.modules.map((m:any)=>m.moduleId).filter((id:any)=>typeof id==='string')};
}
