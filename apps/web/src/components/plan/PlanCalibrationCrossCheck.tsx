import { useMemo, useState } from 'react';
import { Ruler, ShieldCheck, AlertTriangle } from 'lucide-react';
import { calculateScaleCrossCheck, type CalibrationWall } from './scale-cross-check';
import './plan-calibration-cross-check.css';

type Props={scaleMmPerPixel:number|null|undefined;walls:CalibrationWall[]};
export default function PlanCalibrationCrossCheck({scaleMmPerPixel,walls}:Props){
  const [wallId,setWallId]=useState('');
  const [knownLength,setKnownLength]=useState('');
  const candidates=useMemo(()=>walls.filter(w=>w.geometry.x1!==undefined&&w.geometry.y1!==undefined&&w.geometry.x2!==undefined&&w.geometry.y2!==undefined),[walls]);
  const selected=candidates.find(w=>w.id===wallId);
  const entered=knownLength.trim()?Number(knownLength):NaN;
  const result=selected&&scaleMmPerPixel?calculateScaleCrossCheck(selected,scaleMmPerPixel,entered):null;
  return <details className="ultida-calib-check">
    <summary><Ruler size={16}/> Verify against a second known dimension <span>Optional quality check</span></summary>
    <p>Select a different wall with a <strong>printed or site-surveyed length</strong>. Enter the actual length in millimetres, not the inferred wall dimension. This independent check is not saved as fabrication evidence.</p>
    <div className="ultida-calib-check-form">
      <label>Reference wall<select value={wallId} onChange={e=>setWallId(e.target.value)} disabled={!scaleMmPerPixel}>
        <option value="">Choose a wall...</option>
        {candidates.map(w=><option value={w.id} key={w.id}>{w.label} · {w.status}</option>)}
      </select></label>
      <label>Known length (mm)<input inputMode="decimal" type="number" min="1" placeholder="e.g. 3600" value={knownLength} onChange={e=>setKnownLength(e.target.value)} disabled={!scaleMmPerPixel}/></label>
    </div>
    {!scaleMmPerPixel?<p className="ultida-calib-check-note"><AlertTriangle size={14}/> First set the main two-point calibration on the plan canvas.</p>:null}
    {result&&result.state!=='invalid'?<div className={`ultida-calib-result is-${result.state}`} role="status">
      {result.state==='consistent'?<ShieldCheck size={17}/>:<AlertTriangle size={17}/>}
      <div><strong>{result.state==='consistent'?'Second dimension is consistent':result.state==='advisory'?'Check scale or measured points':'Conflicting dimensions — review calibration'}</strong>
        <span>Predicted {Math.round(result.predictedMm)} mm · Entered {entered} mm · Difference {result.discrepancyPct.toFixed(2)}%</span>
      </div>
    </div>:null}
    <small className="ultida-calib-check-legend">Informational interpretation: &lt;2% consistent; 2–5% review; ≥5% conflict. These are proposed UI tolerances, not statutory limits.</small>
  </details>;
}
