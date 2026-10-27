/**
 * Deterministic, catalog-grounded one-dimensional MODULAR RUN proposals.
 * This is intentionally NOT a whole-room AI placement engine: it does not
 * know wall thickness, opening swings, electrical/plumbing or manufacturer
 * fitting cutouts. It returns measured wall-offset proposals only.
 */
export type RealModuleTemplate = {
  id: string; sku: string; family: string; name: string;
  widthMm: number; depthMm: number; heightMm: number;
  minClearanceMm: number;
  tags: readonly string[];
  production: { panelBased: boolean; cutlistSupported: boolean };
};
export type RestrictedInterval = { startMm: number; endMm: number; reason: string };
export type RunInput = {
  wallLengthMm: number;
  family: string;
  availableAisleMm: number;
  leftReturnMm?: number;
  rightReturnMm?: number;
  restrictions?: readonly RestrictedInterval[];
  maxFillerMm?: number;
  maxModules?: number;
};
export type RunPlacement = {
  templateId: string;
  sku: string;
  label: string;
  xStartMm: number;
  xEndMm: number;
  widthMm: number;
  depthMm: number;
  heightMm: number;
};
export type RunProposal = {
  id: string;
  strategy: 'simple' | 'balanced' | 'storage';
  source: 'ultida-catalog-grounded';
  validationState: 'requires-room-and-hardware-verification';
  segmentMm: { startMm: number; endMm: number };
  placements: RunPlacement[];
  fillerLeftMm: number;
  fillerRightMm: number;
  coverageRatio: number;
  warnings: string[];
};
export type RunResult = { proposals: RunProposal[]; issues: string[]; examinedSegments: Array<{ startMm: number; endMm: number }> };

const hazardousTags = /sink|hob|chimney|gas|appliance|dishwash|microwave|fridge|refrigerator|washing|basin/i;
const positiveInteger = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
function usableSegments(input: RunInput): { segments: Array<{ startMm: number; endMm: number }>; issues: string[] } {
  const issues: string[] = [];
  if (!positiveInteger(input.wallLengthMm) || input.wallLengthMm < 300 || input.wallLengthMm > 20000) return {segments:[],issues:['Enter a measured wall length between 300 and 20,000 mm.']};
  const left = input.leftReturnMm ?? 0, right = input.rightReturnMm ?? 0;
  if (!positiveInteger(left) || !positiveInteger(right) || left + right >= input.wallLengthMm) return {segments:[],issues:['The wall returns or keep-outs leave no usable span.']};
  if (!positiveInteger(input.availableAisleMm) || input.availableAisleMm < 300 || input.availableAisleMm > 10000) return {segments:[],issues:['Enter the actual available clear aisle in millimetres.']};
  const max = input.wallLengthMm-right;
  const blocked = [...(input.restrictions ?? [])];
  for (const r of blocked) {
    if (!positiveInteger(r.startMm)||!positiveInteger(r.endMm)||r.endMm<=r.startMm||r.startMm>input.wallLengthMm||r.endMm>input.wallLengthMm) return {segments:[],issues:['One or more protected wall intervals are invalid; nothing has been placed.']};
  }
  const sorted = blocked.sort((a,b)=>a.startMm-b.startMm);
  const segments: Array<{startMm:number;endMm:number}> = [];
  let cursor=left;
  for(const item of sorted){
    const start = Math.max(left, Math.min(max,item.startMm)), end=Math.max(left,Math.min(max,item.endMm));
    if (start>cursor && start-cursor>=300) segments.push({startMm:cursor,endMm:start});
    cursor=Math.max(cursor,end);
  }
  if(max>cursor && max-cursor>=300) segments.push({startMm:cursor,endMm:max});
  if(!segments.length) issues.push('Doors, windows, protected intervals or wall returns leave no segment long enough for a modular unit.');
  return {segments,issues};
}

type Candidate = { templateIds: string[]; used: number; count: number; distinct: number; narrow: number };
function score(candidate: Candidate, segmentLength: number, strategy: RunProposal['strategy']) {
  const gap=segmentLength-candidate.used;
  const seams = Math.max(0,candidate.count-1);
  const diversity = candidate.distinct;
  if(strategy==='simple') return gap*2 + seams*100 + diversity*8;
  if(strategy==='storage') return gap*4 - candidate.count*40 - candidate.narrow*20;
  return gap*3 + Math.abs(candidate.count-4)*25 - diversity*25;
}
function enumerateCandidates(modules: RealModuleTemplate[], length: number, maxModules: number, maxFillerMm: number): Candidate[] {
  const states: Candidate[] = [{templateIds:[],used:0,count:0,distinct:0,narrow:0}];
  const final: Candidate[]=[];
  const seen=new Set<string>();
  const byId=new Map(modules.map(m=>[m.id,m]));
  for(let depth=0;depth<maxModules;depth++){
    const additions: Candidate[]=[];
    for(const state of states){
      if(state.count>0 && length-state.used<=maxFillerMm) final.push(state);
      if(state.count!==depth) continue;
      for(const m of modules){
        const next=state.used+m.widthMm;
        if(next>length) continue;
        // Canonical sorted combinations prevent equivalent permutations of the same unit list.
        if(state.templateIds.length && m.id < state.templateIds[state.templateIds.length-1]) continue;
        const ids=[...state.templateIds,m.id];
        const signature=ids.join('|');
        if(seen.has(signature)) continue;
        seen.add(signature);
        const usedTypes=new Set(ids).size;
        additions.push({templateIds:ids,used:next,count:ids.length,distinct:usedTypes,narrow:state.narrow+(m.widthMm<=300?1:0)});
      }
    }
    if(!additions.length) break;
    // Beam protects the browser against huge catalogs and long walls. Keep diversity
    // by coverage, number of modules, and model IDs; never invent a template.
    additions.sort((a,b)=>a.used!==b.used?b.used-a.used:a.count!==b.count?a.count-b.count:b.distinct-a.distinct);
    states.splice(0,states.length,...additions.slice(0,3000));
  }
  for(const state of states) if(state.count && length-state.used<=maxFillerMm) final.push(state);
  return final.filter(x=>x.templateIds.every(id=>byId.has(id)));
}
export function proposeModularRuns(input: RunInput, templates: readonly RealModuleTemplate[]): RunResult {
  const {segments,issues}=usableSegments(input);
  const maxModules=input.maxModules??9, maxFillerMm=input.maxFillerMm??250;
  if(!positiveInteger(maxModules)||maxModules<1||maxModules>12 || !positiveInteger(maxFillerMm)||maxFillerMm>1000){return {proposals:[],issues:[...issues,'Module count or filler allowance is outside safe limits.'],examinedSegments:segments};}
  const matching=templates.filter(m=>m.family===input.family && Number.isSafeInteger(m.widthMm) && m.widthMm>=150 && m.widthMm<=1800 && Number.isSafeInteger(m.depthMm) && m.depthMm>0 && Number.isSafeInteger(m.heightMm) && m.heightMm>0 && m.minClearanceMm<=input.availableAisleMm && m.production.panelBased && !hazardousTags.test(`${m.name} ${m.tags.join(' ')}`));
  if(!matching.length)return {proposals:[],issues:[...issues,`No compatible ordinary panel-based ${input.family} templates were found. Service-dependent units need explicit service checks.`],examinedSegments:segments};
  // A single cabinet run uses the longest uninterrupted, designer-verified segment.
  const segment=[...segments].sort((a,b)=>(b.endMm-b.startMm)-(a.endMm-a.startMm))[0];
  if(!segment)return {proposals:[],issues,examinedSegments:segments};
  const length=segment.endMm-segment.startMm;
  const candidates=enumerateCandidates(matching,length,maxModules,maxFillerMm);
  if(!candidates.length) return {proposals:[],issues:[...issues,`No ${input.family} run fits the largest usable span within ${maxFillerMm} mm total filler. Check cabinet sizes, clearance or the wall.`],examinedSegments:segments};
  const lookup=new Map(matching.map(m=>[m.id,m]));
  const strategies=['simple','balanced','storage'] as const;
  const used=new Set<string>();
  const proposals:RunProposal[]=[];
  for(const strategy of strategies){
    const best=[...candidates].sort((a,b)=>score(a,length,strategy)-score(b,length,strategy)).find(c=>!used.has(c.templateIds.join('|')));
    if(!best) continue;
    used.add(best.templateIds.join('|'));
    const gap=length-best.used;
    const fillerLeftMm=Math.floor(gap/2),fillerRightMm=gap-fillerLeftMm;
    let x=segment.startMm+fillerLeftMm;
    const placements=best.templateIds.map(id=>{
      const m=lookup.get(id)!;
      const p:RunPlacement={templateId:m.id,sku:m.sku,label:m.name,xStartMm:x,xEndMm:x+m.widthMm,widthMm:m.widthMm,depthMm:m.depthMm,heightMm:m.heightMm};
      x+=m.widthMm;
      return p;
    });
    proposals.push({id:`run-${strategy}-${best.templateIds.join('-')}`,strategy,source:'ultida-catalog-grounded',validationState:'requires-room-and-hardware-verification',segmentMm:segment,placements,fillerLeftMm,fillerRightMm,coverageRatio:best.used/length,warnings:['Concept-only wall offsets. Verify opening swings, service points, full-room collision, cabinet adjacency, manufacturer fittings and actual fabrication rules before approval.',...(segments.length>1?['Additional usable wall spans were not automatically furnished.']:[])]});
  }
  if(proposals.length<3)issues.push(`Only ${proposals.length} distinct catalog-grounded option(s) met current constraints; no additional alternatives were fabricated.`);
  return {proposals,issues,examinedSegments:segments};
}
