import { Check, FileText, Image, Layers3, Plus, Send, Sofa, Utensils, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader } from '../ui/primitives';

type Stage = 'Design' | 'Visualize' | 'Document';
type Module = { id: string; roomId: string; family: string; label: string; widthMm: number; depthMm: number; heightMm: number };
type Provider = { id: string; configured: boolean; operations: string[] };
type Props = { stage: Stage; projectId: string | null; planApproved: boolean; briefComplete: boolean; sceneVersionId: string | null; modules: Module[]; onSceneCreated: (id: string, modules: Module[]) => void };
const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
const catalog = [
  { family: 'kitchen-base', label: 'Base cabinet', widthMm: 600, depthMm: 600, heightMm: 750, icon: <Utensils size={16} /> },
  { family: 'kitchen-tall', label: 'Tall unit', widthMm: 600, depthMm: 600, heightMm: 2100, icon: <Layers3 size={16} /> },
  { family: 'wardrobe', label: 'Wardrobe module', widthMm: 900, depthMm: 600, heightMm: 2400, icon: <Layers3 size={16} /> },
  { family: 'sofa', label: 'Three-seat sofa', widthMm: 2200, depthMm: 900, heightMm: 850, icon: <Sofa size={16} /> },
  { family: 'tv-unit', label: 'TV console', widthMm: 1800, depthMm: 400, heightMm: 600, icon: <Image size={16} /> },
];
const ids: Record<string, string> = { 'kitchen-base': 'kit-base-600', 'kitchen-tall': 'kit-tall-600', wardrobe: 'wardrobe-900', sofa: 'sofa-2200', 'tv-unit': 'tv-1800' };

export function DesignFlowWorkspace({ stage, projectId, planApproved, briefComplete, sceneVersionId, modules, onSceneCreated }: Props) {
  const [room, setRoom] = useState('kitchen');
  const [visualState, setVisualState] = useState('No visual proposal requested');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [drawingState, setDrawingState] = useState('Generate drawing package');
  const [dxfState, setDxfState] = useState('Export DXF');
  const [placementNotice, setPlacementNotice] = useState('Placement rules are checked before a module enters the scene.');

  useEffect(() => {
    if (stage !== 'Visualize') return;
    fetch(`${apiBase}/providers`)
      .then((response) => response.json())
      .then((payload) => setProviders(Array.isArray(payload.providers) ? payload.providers : []))
      .catch(() => setProviders([]));
  }, [stage]);

  async function addModule(item: typeof catalog[number]) {
    if (!briefComplete) { setPlacementNotice('Complete and save the client brief before creating a scene.'); return; }
    if (!planApproved) { setPlacementNotice('Approve the reviewed floor plan before creating a scene.'); return; }
    setPlacementNotice('Checking room compatibility and circulation...');
    try {
      const response = await fetch(`${apiBase}/catalog/validate-placement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ moduleId: ids[item.family], roomType: room, clearanceMm: room === 'living' ? 800 : 1200 }) });
      const result = await response.json();
      if (!response.ok || !result.valid) { setPlacementNotice(result.issues?.join(' ') ?? 'This module cannot be placed here.'); return; }
      const next = [...modules, { id: crypto.randomUUID(), roomId: room, family: item.family, label: item.label, widthMm: item.widthMm, depthMm: item.depthMm, heightMm: item.heightMm }];
      onSceneCreated(sceneVersionId ?? crypto.randomUUID(), next);
      setPlacementNotice(`${item.label} passed placement checks and was added.`);
    } catch { setPlacementNotice('Placement validator unavailable. The module was not added.'); }
  }

  async function createVisual() {
    if (!sceneVersionId) { setVisualState('Create and save a scene first.'); return; }
    setVisualState('Checking visual providers...');
    try { const response = await fetch(`${apiBase}/visual-proposals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: projectId ?? 'demo-project', sceneVersionId, roomId: room, sourceAssets: ['approved-scene'], referenceAssets: [], masks: [], operation: 'generate', style: 'professional modular interior', structuredPrompt: `Create a realistic ${room} interior proposal using only the approved scene modules and room proportions. Preserve openings and circulation.`, providerPreference: [] }) }); const payload = await response.json(); setVisualState(payload.success ? 'Visual job queued with scene provenance.' : payload.result?.reason ?? payload.message ?? 'No provider is available.'); } catch { setVisualState('Visual service unavailable. The approved scene is unchanged.'); }
  }

  async function createDrawings() {
    if (!sceneVersionId) { setDrawingState('Create and save a scene first.'); return; }
    setDrawingState('Preparing scene-linked drawing package...');
    try { const response = await fetch(`${apiBase}/drawings/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: projectId ?? 'demo-project', sceneVersionId, modules }) }); const payload = await response.json(); setDrawingState(payload.success ? `${payload.package.sheets} drawing sheets prepared from this scene.` : payload.message ?? 'Drawing preparation failed.'); } catch { setDrawingState('Drawing service unavailable.'); }
  }

  async function downloadDxf() {
    if (!sceneVersionId) { setDxfState('Scene required'); return; }
    setDxfState('Exporting DXF...');
    try {
      const response = await fetch(`${apiBase}/drawings/dxf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: projectId ?? 'demo-project', sceneVersionId, scene: { modules: modules.map((module) => ({ ...module, position: { xMm: 0, yMm: 0 } })) } }) });
      if (!response.ok) { setDxfState('DXF export failed'); return; }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `ultida-${sceneVersionId}.dxf`; link.click(); URL.revokeObjectURL(url);
      setDxfState('DXF exported');
    } catch { setDxfState('DXF service unavailable'); }
  }

  if (stage === 'Visualize') return <section className="design-flow-workspace"><div className="workspace-heading"><div><small>VISUAL STUDIO / SCENE-LINKED</small><h2>Show the room before you refine it.</h2><p>Every proposal references the saved scene, room and approved geometry.</p></div><Badge tone={sceneVersionId ? 'success' : 'accent'}>{sceneVersionId ? 'Scene linked' : 'Scene required'}</Badge></div><Card className="visual-studio-panel"><CardContent><div className="visual-preview-placeholder"><Image size={38} /><h3>AI visual proposal canvas</h3><p>{visualState}</p></div><div className="provider-strip" aria-label="Visual provider availability">{providers.length ? providers.map((provider) => <span className="provider-status" key={provider.id}><span className={`provider-dot${provider.configured ? ' provider-dot-ready' : ''}`} />{provider.id}{provider.configured ? ' ready' : ' unavailable'}</span>) : <span className="provider-status">Provider status unavailable</span>}</div><div className="visual-controls"><label>Space<select value={room} onChange={(event) => setRoom(event.target.value)}><option value="kitchen">Kitchen</option><option value="living">Living room</option><option value="bedroom">Bedroom</option></select></label><Button onClick={createVisual} disabled={!sceneVersionId}><Wand2 size={16} /> Generate proposal</Button></div></CardContent></Card></section>;
  if (stage === 'Document') return <section className="design-flow-workspace"><div className="workspace-heading"><div><small>DRAWINGS / PRODUCTION HANDOFF</small><h2>Turn the approved scene into working documents.</h2><p>Drawing requests stay attached to the same scene version as the visual proposal.</p></div><Badge tone={sceneVersionId ? 'success' : 'accent'}>{sceneVersionId ? 'Scene linked' : 'Scene required'}</Badge></div><Card className="drawing-panel"><CardHeader><small>OUTPUTS</small><h3>Production-ready package</h3></CardHeader><CardContent><div className="output-row"><FileText size={20} /><div><strong>Floor plan and wall elevations</strong><span>Vector drawing projection from scene geometry</span></div><Badge>DXF / PDF</Badge></div><div className="output-row"><Layers3 size={20} /><div><strong>Module schedule</strong><span>{modules.length} approved modules currently in the scene</span></div><Badge>Schedule</Badge></div><div className="drawing-actions"><Button onClick={createDrawings} disabled={!sceneVersionId}><Send size={16} /> {drawingState}</Button><Button variant="outline" onClick={downloadDxf} disabled={!sceneVersionId || dxfState === 'Exporting DXF...'}><FileText size={16} /> {dxfState}</Button></div></CardContent></Card></section>;
  return <section className="design-flow-workspace"><div className="workspace-heading"><div><small>SCENE CORE / MODULAR PLACEMENT</small><h2>Compose the room from buildable modules.</h2><p>Choose a room, place a catalog module, then save one scene version for every downstream output.</p></div><Badge tone={briefComplete && planApproved ? 'success' : 'accent'}>{!briefComplete ? 'Brief required' : planApproved ? 'Approved plan linked' : 'Approved plan required'}</Badge></div><div className="module-layout"><Card className="catalog-panel"><CardHeader><small>MODULE CATALOG</small><h3>Modular building blocks</h3></CardHeader><CardContent><label>Place in<select value={room} onChange={(event) => setRoom(event.target.value)}><option value="kitchen">Kitchen</option><option value="living">Living room</option><option value="bedroom">Bedroom</option></select></label><p className="placement-notice" role="status">{placementNotice}</p>{catalog.map((item) => <button className="catalog-item" key={item.family} onClick={() => addModule(item)} disabled={!briefComplete || !planApproved}>{item.icon}<span><strong>{item.label}</strong><small>{item.widthMm} x {item.depthMm} x {item.heightMm} mm</small></span><Plus size={15} /></button>)}</CardContent></Card><Card className="scene-panel"><CardHeader><div><small>SCENE V1</small><h3>{sceneVersionId ? `Version ${sceneVersionId.slice(0, 8)}` : 'Draft scene'}</h3></div><Badge>{modules.length} modules</Badge></CardHeader><CardContent><div className="scene-canvas"><div className="scene-room-label">{room.toUpperCase()}</div>{modules.map((item, index) => <div className={`scene-module module-${item.family}`} key={item.id} style={{ left: `${12 + (index % 4) * 22}%`, top: `${20 + Math.floor(index / 4) * 24}%` }}><Check size={13} />{item.label}</div>)}</div><div className="module-list">{modules.length ? modules.map((item) => <div key={item.id}><span>{item.label}</span><small>{item.widthMm} mm</small></div>) : <p>Add a module to begin the scene.</p>}</div></CardContent></Card></div></section>;
}
