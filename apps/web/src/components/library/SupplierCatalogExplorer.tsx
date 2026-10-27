import { useMemo, useState } from 'react';
import { ArrowUpRight, Boxes, Check, Clipboard, PackageSearch, Ruler, ShieldAlert, Sparkles, SwatchBook } from 'lucide-react';
import {
  VERIFIED_IKEA_REFERENCES,
  VERIFIED_MERINO_REFERENCES,
  proposeModularRuns,
  type RealModuleTemplate,
} from '@ultida/catalog-core';
import './supplier-catalog-explorer.css';

type ModuleInput = {
  id: string; sku: string; family: string; name: string;
  widthMm: number; depthMm: number; heightMm: number;
  minClearanceMm: number; tags: string[];
  production: { panelBased?: boolean; cutlistSupported?: boolean };
};

export default function SupplierCatalogExplorer({ modules }: { modules: ModuleInput[] }) {
  const [tab, setTab] = useState<'merino' | 'ikea' | 'composer'>('merino');
  const [search, setSearch] = useState('');
  const [family, setFamily] = useState('kitchen-base');
  const [wallLength, setWallLength] = useState('3000');
  const [aisle, setAisle] = useState('900');
  const [leftKeepout, setLeftKeepout] = useState('0');
  const [rightKeepout, setRightKeepout] = useState('0');
  const [protectedSpan, setProtectedSpan] = useState('');
  const [showProposals, setShowProposals] = useState(false);
  const [message, setMessage] = useState('');
  const families = useMemo(() => [...new Set(modules.filter(m => m.production.panelBased).map(m => m.family))].sort(), [modules]);
  const matches = (term: string) => term.toLowerCase().includes(search.trim().toLowerCase());
  const merino = VERIFIED_MERINO_REFERENCES.filter(m => matches(`${m.name} ${m.decorCode} ${m.productLine}`));
  const ikea = VERIFIED_IKEA_REFERENCES.filter(p => matches(`${p.name} ${p.productNumber} ${p.category}`));
  const runInput = useMemo(() => {
    const restriction = protectedSpan.trim();
    const pieces = restriction.split('-').map(x => Number(x.trim()));
    return {
      family, wallLengthMm:Number(wallLength), availableAisleMm:Number(aisle),
      leftReturnMm:Number(leftKeepout), rightReturnMm:Number(rightKeepout),
      restrictions: restriction ? (pieces.length===2 && pieces.every(Number.isInteger)
        ? [{ startMm:pieces[0], endMm:pieces[1], reason:'Designer-protected opening/keepout' }]
        : [{ startMm:NaN, endMm:NaN, reason:'Invalid protected interval' }]) : [],
      maxFillerMm: 250,
    };
  },[family,wallLength,aisle,leftKeepout,rightKeepout,protectedSpan]);
  const runResult = useMemo(() => {
    if(!showProposals) return null;
    const catalog:RealModuleTemplate[]=modules.map(m=>({
      id:m.id,sku:m.sku,family:m.family,name:m.name,widthMm:m.widthMm,depthMm:m.depthMm,
      heightMm:m.heightMm,minClearanceMm:m.minClearanceMm,tags:m.tags,
      production:{panelBased:Boolean(m.production.panelBased),cutlistSupported:Boolean(m.production.cutlistSupported)},
    }));
    return proposeModularRuns(runInput,catalog);
  },[showProposals,runInput,modules]);
  async function copy(item: unknown) {
    try { await navigator.clipboard.writeText(JSON.stringify(item,null,2)); setMessage('Source-linked specification copied.'); }
    catch { setMessage('Clipboard permission unavailable. Use the supplier link instead.'); }
  }
  const setMode=(next: typeof tab) => {setTab(next);setMessage('');};
  return (
    <section className="ult-supplier-explorer" aria-label="Verified suppliers and modular run composer">
      <div className="ult-supplier-heading">
        <div>
          <p className="ult-supplier-eyebrow">ULTIDA VERIFIED LIBRARY · EARLY ACCESS</p>
          <h2>Real materials. Real products. Buildable modules.</h2>
          <p>Manufacturer-linked Merino references and IKEA items sit alongside your own production modules. Visual proxies are never presented as licensed product geometry.</p>
        </div>
        <div className="ult-supplier-head-note"><ShieldAlert size={17}/> Supplier samples, 3D licenses, current stock and factory approval remain separate checks.</div>
      </div>
      <div className="ult-supplier-tabs" role="tablist" aria-label="Catalog view">
        <button type="button" role="tab" aria-selected={tab==='merino'} className={tab==='merino'?'active':''} onClick={()=>setMode('merino')}><SwatchBook size={16}/> Merino finishes <span>{VERIFIED_MERINO_REFERENCES.length}</span></button>
        <button type="button" role="tab" aria-selected={tab==='ikea'} className={tab==='ikea'?'active':''} onClick={()=>setMode('ikea')}><PackageSearch size={16}/> IKEA products <span>{VERIFIED_IKEA_REFERENCES.length}</span></button>
        <button type="button" role="tab" aria-selected={tab==='composer'} className={tab==='composer'?'active':''} onClick={()=>setMode('composer')}><Boxes size={16}/> Compose modular run</button>
      </div>
      {tab!=='composer' ? (
        <>
          <label className="ult-supplier-search-label" htmlFor="ult-supplier-search">Search verified {tab==='merino'?'decors and ranges':'product names and SKUs'}</label>
          <input id="ult-supplier-search" className="ult-supplier-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==='merino'?'Search 14149, Oak, Walnut, Senses…':'Search BILLY, BESTÅ, 102.945.25…'}/>
          <div className="ult-supplier-cards">
            {tab==='merino' && merino.map(item=>(
              <article key={item.id} className="ult-supplier-card">
                <div className="ult-supplier-material-sample" aria-label="Color and grain sample not yet licensed"><SwatchBook size={25}/><span>Supplier texture required</span></div>
                <div className="ult-supplier-card-content">
                  <strong>{item.name}</strong><small>{item.productLine} · Decor {item.decorCode}{item.finishCode?` · ${item.finishCode}`:''}</small>
                  <span className="ult-supplier-source">Manufacturer-listed · texture/sample not imported</span>
                  <div className="ult-supplier-actions"><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Source <ArrowUpRight size={13}/></a><button type="button" onClick={()=>void copy(item)}><Clipboard size={13}/> Copy specification</button></div>
                </div>
              </article>
            ))}
            {tab==='ikea' && ikea.map(item=>(
              <article key={item.id} className="ult-supplier-card">
                <div className="ult-supplier-product-proxy" aria-label="Measured bounding-box proxy, not actual product image"><Boxes size={29}/><span>3D asset pending</span></div>
                <div className="ult-supplier-card-content">
                  <strong>{item.name}</strong><small>{item.productNumber} · {item.category}</small>
                  <span>{item.dimensionsMm.width} W × {item.dimensionsMm.depth} D × {item.dimensionsMm.height} H mm</span>
                  <span className="ult-supplier-source">Purchased product · source verified · stock not checked</span>
                  <div className="ult-supplier-actions"><a href={item.productUrl} target="_blank" rel="noopener noreferrer">View IKEA <ArrowUpRight size={13}/></a><button type="button" onClick={()=>void copy(item)}><Clipboard size={13}/> Copy specification</button></div>
                </div>
              </article>
            ))}
            {((tab==='merino'&&!merino.length)||(tab==='ikea'&&!ikea.length))&&<p role="status">No verified references match. Clear the search or consult the supplier catalog.</p>}
          </div>
        </>
      ) : (
        <div className="ult-run-composer">
          <div className="ult-run-head"><Ruler size={19}/><div><strong>Measured wall-run proposals</strong><p>Composes real cabinet template IDs; does not place objects into an approved room or certify production.</p></div></div>
          <div className="ult-run-fields">
            <label>Cabinet family<select value={family} onChange={e=>{setFamily(e.target.value);setShowProposals(false);}}>{!families.includes(family)&&<option value={family}>{family}</option>}{families.map(v=><option value={v} key={v}>{v.replaceAll('-',' ')}</option>)}</select></label>
            <label>Verified wall length (mm)<input inputMode="numeric" type="number" min="300" max="20000" value={wallLength} onChange={e=>{setWallLength(e.target.value);setShowProposals(false);}}/></label>
            <label>Available aisle (mm)<input inputMode="numeric" type="number" min="300" value={aisle} onChange={e=>{setAisle(e.target.value);setShowProposals(false);}}/></label>
            <label>Left keepout (mm)<input inputMode="numeric" type="number" min="0" value={leftKeepout} onChange={e=>{setLeftKeepout(e.target.value);setShowProposals(false);}}/></label>
            <label>Right keepout (mm)<input inputMode="numeric" type="number" min="0" value={rightKeepout} onChange={e=>{setRightKeepout(e.target.value);setShowProposals(false);}}/></label>
            <label>Protected span, optional (mm)<input value={protectedSpan} onChange={e=>{setProtectedSpan(e.target.value);setShowProposals(false);}} placeholder="e.g. 900-1700"/><small>Reserve a door/window interval along the wall. Additional openings require the project plan.</small></label>
          </div>
          <button type="button" className="ult-compose-cta" onClick={()=>setShowProposals(true)}><Sparkles size={17}/> Generate measured configurations</button>
          {runResult && <div className="ult-run-results" role="status">
            {runResult.issues.map((issue,i)=><p key={i} className="ult-run-issue"><ShieldAlert size={14}/>{issue}</p>)}
            {runResult.proposals.map(plan=><article className="ult-run-result" key={plan.id}>
              <div className="ult-run-result-top"><strong>{plan.strategy.toUpperCase()} · {plan.placements.length} genuine modules</strong><button type="button" onClick={()=>void copy(plan)}><Clipboard size={14}/> Copy measured proposal</button></div>
              <div className="ult-run-schematic" aria-label="Proposed modules in order">{plan.placements.map((m,i)=><div key={`${i}-${m.templateId}`} style={{flex:m.widthMm}} title={`${m.label} — ${m.widthMm} mm`}>{m.widthMm}<small>{m.sku}</small></div>)}</div>
              <p>Usable wall span {plan.segmentMm.startMm}–{plan.segmentMm.endMm} mm · fillers {plan.fillerLeftMm} / {plan.fillerRightMm} mm · {Math.round(plan.coverageRatio*100)}% modular coverage</p>
              <small>{plan.warnings[0]}</small>
            </article>)}
          </div>}
          <p className="ult-run-disclaimer"><ShieldAlert size={15}/> Dimension-only feasibility. AURA and Layout Studio must still check full room geometry, appliance services, real hardware, door swings and manufacturing before any scene approval.</p>
        </div>
      )}
      {message&&<p className="ult-supplier-feedback" role="status"><Check size={14}/>{message}</p>}
    </section>
  );
}
