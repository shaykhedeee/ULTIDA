import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getApiBase } from '../../lib/api-base';

type Panel = { partInstanceId: string; partName: string; moduleId: string };
export function SurfaceRecipeEditor({ projectId, sceneVersionId, parts, onCreated }: { projectId: string; sceneVersionId: string; parts: Panel[]; onCreated?: (id: string) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState('laminate_after_cut');
  const [a, setA] = useState(''), [b, setB] = useState('');
  const [grain, setGrain] = useState('none'), [allowance, setAllowance] = useState(10);
  const [width, setWidth] = useState(2440), [height, setHeight] = useState(1220), [thickness, setThickness] = useState(1);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function save() {
    setBusy(true);setMessage('');
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) throw new Error('Sign in to save finishes.');
      const face = (code: string) => code.trim() ? { code: code.trim(), thicknessMm: thickness, grain, allowanceMm: mode === 'prelaminated' ? 0 : allowance, stockWidthMm: width, stockHeightMm: height } : null;
      const surfaceRecipe = { mode, faceA: face(a), faceB: face(b) };
      const response = await fetch(`${getApiBase()}/projects/${projectId}/scenes/${sceneVersionId}/surface-recipes`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ assignments: selected.map(partId => ({ partId, surfaceRecipe })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? data.code);
      setMessage('Saved a new draft. Review and approve its 3D design before downloading production documents.');
      onCreated?.(data.sceneVersionId);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed'); } finally { setBusy(false); }
  }
  return <details className="release-section"><summary>Assign laminate faces to physical panels</summary>
    <p>Choose panels, then assign their ordered A/B faces. Blank finish codes explicitly mean bare faces. Saving creates a new draft and requires fresh design and production reviews.</p>
    <label>Panels <select multiple aria-label="Panels to finish" value={selected} onChange={e => setSelected(Array.from(e.target.selectedOptions, o => o.value))} style={{ display: 'block', width: '100%', minHeight: 120 }}>{parts.map(p => <option key={p.partInstanceId} value={p.partInstanceId}>{p.moduleId} · {p.partName} · {p.partInstanceId}</option>)}</select></label>
    <button type="button" onClick={() => setSelected(parts.map(p => p.partInstanceId))}>Select all panels</button>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, margin: '16px 0' }}>
      <label>Process <select value={mode} onChange={e=>setMode(e.target.value)}><option value="laminate_after_cut">Laminate after core cutting</option><option value="prelaminated">Cut prelaminated board</option></select></label>
      <label>Face A finish code <input value={a} onChange={e=>setA(e.target.value)} placeholder="Blank = bare"/></label>
      <label>Face B finish code <input value={b} onChange={e=>setB(e.target.value)} placeholder="Blank = bare"/></label>
      <label>Both faces grain <select value={grain} onChange={e=>setGrain(e.target.value)}><option value="none">No directional grain</option><option value="length">Along panel length</option><option value="width">Along panel width</option></select></label>
      <label>Laminate thickness mm <input type="number" min="0.1" step="0.1" value={thickness} onChange={e=>setThickness(Number(e.target.value))}/></label>
      <label>Allowance per edge mm <input type="number" min="0" value={allowance} disabled={mode==='prelaminated'} onChange={e=>setAllowance(Number(e.target.value))}/></label>
      <label>Laminate stock X mm <input type="number" min="1" value={width} onChange={e=>setWidth(Number(e.target.value))}/></label>
      <label>Laminate stock Y mm <input type="number" min="1" value={height} onChange={e=>setHeight(Number(e.target.value))}/></label>
    </div>
    <p>Stock grain runs along X. For prelaminated boards, core stock sizes come from the fabrication rules. This editor applies the same grain and laminate stock profile to both faces.</p>
    <button type="button" disabled={busy || !selected.length} onClick={()=>void save()}>{busy ? 'Saving…' : `Save finishes for ${selected.length} panels`}</button><p role="status">{message}</p>
  </details>;
}
