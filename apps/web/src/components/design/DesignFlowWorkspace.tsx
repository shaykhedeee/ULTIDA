import { Check, FileText, Image, Layers3, Palette, Plus, RefreshCw, Send, Sofa, ThumbsDown, ThumbsUp, Utensils, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader } from '../ui/primitives';
import { supabase } from '../../lib/supabase';
import MaterialSwapPanel from './MaterialSwapPanel';
import './visual-studio.css';

type Stage = 'Design' | 'Visualize' | 'Document';
type Module = { id: string; roomId: string; family: string; label: string; widthMm: number; depthMm: number; heightMm: number; wallId?: string; offsetMm?: number; xMm?: number; yMm?: number; rotationDeg?: number };
type CatalogItem = { id: string; family: string; name: string; widthMm: number; depthMm: number; heightMm: number; tags: string[] };
type Provider = { id: string; configured: boolean; operations: string[] };
type StoredRender = { id: string; scene_version_id: string; status: string; stale?: boolean; signedUrl: string | null; created_at: string; provenance?: { provider?: string; model?: string; promptVersion?: string; reviewStatus?: string } };
type Props = { stage: Stage; projectId: string | null; planApproved: boolean; briefComplete: boolean; sceneVersionId: string | null; sceneApproved: boolean; modules: Module[]; materials: any[]; onSceneCreated: (id: string, modules: Module[], materials: any[]) => void; onSceneApproved: () => Promise<void> };
const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
const catalog = [
  { family: 'kitchen-base', label: 'Base cabinet', widthMm: 600, depthMm: 600, heightMm: 750, icon: <Utensils size={16} /> },
  { family: 'kitchen-base-drawers', label: 'Base drawer cabinet', widthMm: 600, depthMm: 600, heightMm: 750, icon: <Utensils size={16} /> },
  { family: 'kitchen-wall-glass', label: 'Wall overhead glass unit', widthMm: 600, depthMm: 350, heightMm: 600, icon: <Layers3 size={16} /> },
  { family: 'kitchen-corner', label: 'L-shape kitchen corner', widthMm: 1050, depthMm: 1050, heightMm: 750, icon: <Utensils size={16} /> },
  { family: 'kitchen-tall', label: 'Tall unit', widthMm: 600, depthMm: 600, heightMm: 2100, icon: <Layers3 size={16} /> },
  { family: 'kitchen-tall-appliance', label: 'Tall pantry appliance unit', widthMm: 600, depthMm: 600, heightMm: 2100, icon: <Layers3 size={16} /> },
  { family: 'wardrobe', label: 'Wardrobe module', widthMm: 900, depthMm: 600, heightMm: 2400, icon: <Layers3 size={16} /> },
  { family: 'sofa', label: 'Three-seat sofa', widthMm: 2200, depthMm: 900, heightMm: 850, icon: <Sofa size={16} /> },
  { family: 'living-armchair', label: 'Accent armchair', widthMm: 900, depthMm: 900, heightMm: 800, icon: <Sofa size={16} /> },
  { family: 'tv-unit', label: 'TV console', widthMm: 1800, depthMm: 400, heightMm: 600, icon: <Image size={16} /> },
  { family: 'bedroom-desk', label: 'Study desk console', widthMm: 1200, depthMm: 600, heightMm: 750, icon: <Image size={16} /> },
  { family: 'dining-set', label: 'Dining table set', widthMm: 1600, depthMm: 900, heightMm: 750, icon: <Sofa size={16} /> },
];
const ids: Record<string, string> = {
  'kitchen-base': 'kit-base-600',
  'kitchen-base-drawers': 'kit-base-drawers-600',
  'kitchen-wall-glass': 'kit-wall-glass-600',
  'kitchen-corner': 'kit-corner-1050',
  'kitchen-tall': 'kit-tall-600',
  'kitchen-tall-appliance': 'kit-tall-appliance-600',
  wardrobe: 'wardrobe-900',
  sofa: 'sofa-2200',
  'living-armchair': 'armchair-900',
  'tv-unit': 'tv-1800',
  'bedroom-desk': 'desk-1200',
  'dining-set': 'dining-1600',
};

const themes = [
  { id: 'japandi', name: 'Minimalist Japandi', styleText: 'minimalist warm Japandi style, serene wood texture, clean lines, oatmeal colors', colors: ['#D4C5B9', '#E6DFD9', '#8C7B70', '#5C524A'] },
  { id: 'industrial', name: 'Industrial Loft', styleText: 'raw industrial loft interior style, dark concrete, matte black steel, rich dark walnut wood', colors: ['#3E3D3C', '#2B2B2A', '#8F8E8C', '#54463C'] },
  { id: 'indian', name: 'Warm Contemporary Indian', styleText: 'rich warm contemporary Indian style, polished wood, brass accents, terracotta highlights', colors: ['#C05C3E', '#F4E4C1', '#A67B5B', '#4E3629'] },
  { id: 'parisian', name: 'Classic Parisian Elegance', styleText: 'classic Parisian elegant interior style, white panelled walls, marble counters, rose gold hardware', colors: ['#F3EBE9', '#D9C3C0', '#4A3B39', '#FFFFFF'] },
];

export function DesignFlowWorkspace({ stage, projectId, planApproved, briefComplete, sceneVersionId, sceneApproved, modules, materials, onSceneCreated, onSceneApproved }: Props) {
  const [room, setRoom] = useState('kitchen');
  const [spaces, setSpaces] = useState<Array<{ id: string; name: string; roomType: string }>>([]);
  const [walls, setWalls] = useState<Array<{ id: string; start?: { xMm: number; yMm: number }; end?: { xMm: number; yMm: number } }>>([]);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [wallId, setWallId] = useState<string | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [designMode, setDesignMode] = useState<'layout' | 'moodboard'>('layout');
  const [visualState, setVisualState] = useState('No visual proposal requested');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [drawingState, setDrawingState] = useState('Generate drawing package');
  const [dxfState, setDxfState] = useState('Export DXF');
  const [cutlistState, setCutlistState] = useState('Generate cutlist');
  const [elevationState, setElevationState] = useState('Export elevations');
  const [pdfState, setPdfState] = useState('Export PDF');
  const [placementNotice, setPlacementNotice] = useState('Placement rules are checked before a module enters the scene.');
  const [renders, setRenders] = useState<StoredRender[]>([]);
  const [selectedRenderId, setSelectedRenderId] = useState<string | null>(null);
  const [activeVisualJobId, setActiveVisualJobId] = useState<string | null>(null);
  const [reviewVisualJobId, setReviewVisualJobId] = useState<string | null>(null);
  const [visualBusy, setVisualBusy] = useState(false);

  // Moodboard States
  const [activeTheme, setActiveTheme] = useState('japandi');
  const [activeLaminate, setActiveLaminate] = useState('');
  const [activeHardware, setActiveHardware] = useState('');
  const catalogLaminates = materials.filter((item: any) => ['laminate', 'veneer', 'acrylic', 'stone', 'countertop'].includes(String(item.category ?? '').toLowerCase())).map((item: any) => ({ id: String(item.id), name: String(item.name), code: String(item.code ?? item.id), hex: String(item.metadata?.hex ?? '#d6c7b8'), unitCost: Number(item.unit_cost ?? item.unitCost ?? 0) }));
  const catalogHardwares = materials.filter((item: any) => ['hardware', 'handle', 'profile', 'glass'].includes(String(item.category ?? '').toLowerCase())).map((item: any) => ({ id: String(item.id), name: String(item.name), code: String(item.code ?? item.id), unitCost: Number(item.unit_cost ?? item.unitCost ?? 0) }));
  
  const selectedThemeObj = themes.find((t) => t.id === activeTheme) ?? themes[0];
  const selectedLaminateObj = catalogLaminates.find((l) => l.id === activeLaminate) ?? catalogLaminates[0] ?? { id: '', name: 'No laminate selected', code: '', hex: '#d6c7b8', unitCost: 0 };
  const selectedHardwareObj = catalogHardwares.find((h) => h.id === activeHardware) ?? catalogHardwares[0] ?? { id: '', name: 'No hardware selected', code: '', unitCost: 0 };
  
  const compiledStylePrompt = `${selectedThemeObj.styleText} with ${selectedLaminateObj.name} and ${selectedHardwareObj.name}`;
  const [style, setStyle] = useState(compiledStylePrompt);
  const [quality, setQuality] = useState<'draft' | 'review' | 'final'>('review');

  useEffect(() => {
    setStyle(`${selectedThemeObj.styleText} with ${selectedLaminateObj.name} and ${selectedHardwareObj.name}`);
    if (!activeLaminate && catalogLaminates[0]) setActiveLaminate(catalogLaminates[0].id);
    if (!activeHardware && catalogHardwares[0]) setActiveHardware(catalogHardwares[0].id);
  }, [activeTheme, activeLaminate, activeHardware, materials]);

  async function authenticatedHeaders() {
    const session = await supabase?.auth.getSession();
    const token = session?.data.session?.access_token;
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  }

  async function loadRenders() {
    if (!projectId) return;
    try {
      const response = await fetch(`${apiBase}/projects/${projectId}/renders`, { headers: await authenticatedHeaders() });
      const payload = await response.json();
      const next: StoredRender[] = response.ok && Array.isArray(payload.renders) ? payload.renders : [];
      setRenders(next);
      setSelectedRenderId((current) => current && next.some((render) => render.id === current) ? current : next[0]?.id ?? null);
    } catch {
      setRenders([]);
      setSelectedRenderId(null);
    }
  }

  useEffect(() => {
    if (stage !== 'Visualize') return;
    fetch(`${apiBase}/providers`)
      .then((response) => response.json())
      .then((payload) => setProviders(Array.isArray(payload.providers) ? payload.providers : []))
      .catch(() => setProviders([]));
    void loadRenders();
  }, [stage, projectId]);

  useEffect(() => {
    if (!projectId || !planApproved) return;
    void (async () => {
      try {
        const headers = await authenticatedHeaders();
        const [spaceResponse, planResponse] = await Promise.all([
          fetch(`${apiBase}/projects/${projectId}/spaces`, { headers }),
          fetch(`${apiBase}/projects/${projectId}/floor-plan/active`, { headers }),
        ]);
        const spacePayload = await spaceResponse.json();
        const planPayload = await planResponse.json();
        const nextSpaces = Array.isArray(spacePayload.spaces) ? spacePayload.spaces : [];
        const nextWalls = Array.isArray(planPayload.walls) ? planPayload.walls : [];
        setSpaces(nextSpaces);
        setWalls(nextWalls);
        setSpaceId((current) => current ?? nextSpaces[0]?.id ?? null);
        setWallId((current) => current ?? nextWalls[0]?.id ?? null);
        if (nextSpaces[0]?.room_type) setRoom(nextSpaces[0].room_type);
      } catch {
        setSpaces([]); setWalls([]); setSpaceId(null); setWallId(null);
      }
    })();
  }, [projectId, planApproved]);

  useEffect(() => {
    if (!planApproved) {
      setCatalogItems([]);
      return;
    }
    void (async () => {
      try {
        const response = await fetch(`${apiBase}/catalog/modules?room=${encodeURIComponent(room)}`, { headers: await authenticatedHeaders() });
        const payload = await response.json();
        setCatalogItems(response.ok && Array.isArray(payload.modules) ? payload.modules : []);
      } catch {
        setCatalogItems([]);
      }
    })();
  }, [room, planApproved]);

  useEffect(() => {
    if (!activeVisualJobId || !projectId) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`${apiBase}/projects/${projectId}/renders`, { headers: await authenticatedHeaders() });
        const payload = await response.json();
        const latest = Array.isArray(payload.renders) ? payload.renders.find((render: any) => render.id === activeVisualJobId) ?? payload.renders[0] : null;
        const status = latest?.status;
        if (status === 'succeeded' && latest?.signedUrl) {
          setVisualState('Render stored privately and ready for review.'); setVisualBusy(false); setActiveVisualJobId(null); await loadRenders();
        } else if (status === 'failed') {
          setVisualState(latest?.reason ?? latest?.error ?? 'Render generation failed. No image was stored.'); setVisualBusy(false); setActiveVisualJobId(null);
        } else setVisualState(status === 'running' ? 'Rendering in progress...' : 'Render queued...');
      } catch { setVisualState('Render status is temporarily unavailable.'); }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeVisualJobId, projectId]);

  async function addModule(item: CatalogItem) {
    if (!briefComplete) { setPlacementNotice('Complete and save the client brief before creating a scene.'); return; }
    if (!planApproved) { setPlacementNotice('Approve the reviewed floor plan before creating a scene.'); return; }
    if (!spaceId || !wallId) { setPlacementNotice('Select a verified room and wall before placing a module.'); return; }
    const anchorWall = walls.find((wall) => wall.id === wallId);
    if (!anchorWall?.start) { setPlacementNotice('The selected wall has no canonical coordinates.'); return; }
    setPlacementNotice('Checking room compatibility and circulation...');
    try {
      const response = await fetch(`${apiBase}/catalog/validate-placement`, { method: 'POST', headers: await authenticatedHeaders(), body: JSON.stringify({ moduleId: item.id, roomType: room, clearanceMm: room === 'living' ? 800 : 1200 }) });
      const result = await response.json();
      if (!response.ok || !result.valid) { setPlacementNotice(result.issues?.join(' ') ?? 'This module cannot be placed here.'); return; }
      const moduleResponse = await fetch(`${apiBase}/projects/${projectId}/module-instances`, { method: 'POST', headers: await authenticatedHeaders(), body: JSON.stringify({ spaceId, templateId: item.id, category: item.family, label: item.name, config: { family: item.family, widthMm: item.widthMm, depthMm: item.depthMm, heightMm: item.heightMm }, position: { wallId, offsetMm: 0 } }) });
      const modulePayload = await moduleResponse.json();
      if (!moduleResponse.ok || !modulePayload.module) { setPlacementNotice(modulePayload.message ?? 'Module anchor could not be saved.'); return; }
      const saved = modulePayload.module;
      const resolved = saved.position_json ?? {};
      const next = [...modules, { id: saved.id, roomId: spaceId, family: item.family, label: item.name, widthMm: item.widthMm, depthMm: item.depthMm, heightMm: item.heightMm, wallId: resolved.wallId, offsetMm: resolved.offsetMm, xMm: resolved.xMm, yMm: resolved.yMm, rotationDeg: resolved.rotationDeg }];
      onSceneCreated(sceneVersionId ?? crypto.randomUUID(), next, materials);
      setPlacementNotice(`${item.name} was saved with a wall anchor and passed placement checks.`);
    } catch { setPlacementNotice('Placement validator unavailable. The module was not added.'); }
  }

  async function saveMoodboard() {
    const nextMaterials = [
      { id: 'laminate-selected', name: selectedLaminateObj.name, code: selectedLaminateObj.code, unitCost: 180 },
      { id: 'hardware-selected', name: selectedHardwareObj.name, code: `HDW-${activeHardware.toUpperCase()}`, unitCost: 25 },
      { id: 'palette-theme', name: `Moodboard: ${selectedThemeObj.name}`, code: `PAL-${activeTheme.toUpperCase()}`, unitCost: 0 }
    ];
    onSceneCreated(sceneVersionId ?? crypto.randomUUID(), modules, nextMaterials);
    setPlacementNotice('Moodboard materials applied to scene.');
  }

  async function createVisual() {
    if (!sceneVersionId) { setVisualState('Create and save a scene first.'); return; }
    if (!sceneApproved) { setVisualState('Approve the scene before generating a scene-linked render.'); return; }
    if (!projectId) { setVisualState('Select a project before generating a render.'); return; }
    setVisualBusy(true); setVisualState('Validating scene and visual providers...');
    try {
      const response = await fetch(`${apiBase}/projects/${projectId}/renders`, { method: 'POST', headers: await authenticatedHeaders(), body: JSON.stringify({ sceneVersionId, idempotencyKey: `${sceneVersionId}:${room}:${style}:${quality}:${Date.now()}`, options: { roomId: room, style, quality } }) });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setVisualBusy(false);
      if (payload.result?.code === 'IMAGE_PROVIDER_NOT_CONFIGURED' || payload.code === 'IMAGE_PROVIDER_NOT_CONFIGURED') {
          setVisualState('No real image provider is configured. No render was generated or substituted.');
          return;
        }
        setVisualState(payload.result?.message ?? payload.result?.reason ?? payload.message ?? 'Image generation failed.');
        return;
      }
      if (payload.result?.jobId) { setReviewVisualJobId(payload.result.jobId); setActiveVisualJobId(payload.result.jobId); }
      if (payload.result?.status === 'succeeded' && payload.result?.signedUrl) { setVisualBusy(false); setVisualState('Render stored privately and ready for review.'); await loadRenders(); return; }
      if (payload.result?.jobId) { setActiveVisualJobId(payload.result.jobId); setVisualState('Render queued with scene provenance.'); return; }
      setVisualBusy(false); setVisualState('Render request returned no durable job.');
    } catch { setVisualBusy(false); setVisualState('Visual service unavailable. The approved scene is unchanged.'); }
  }

  async function reviewRender(decision: 'approve' | 'reject') {
    const latestJobId = reviewVisualJobId;
    if (!latestJobId || !projectId) { setVisualState('Generate or select a render job before recording a decision.'); return; }
    const response = await fetch(`${apiBase}/projects/${projectId}/renders/${latestJobId}/review`, { method: 'POST', headers: await authenticatedHeaders(), body: JSON.stringify({ decision: decision === 'approve' ? 'approved' : 'rejected', note: decision === 'approve' ? 'Approved in Visual Studio' : 'Rejected in Visual Studio' }) });
    setVisualState(response.ok ? `Render ${decision === 'approve' ? 'approved' : 'rejected'}.` : 'Render review could not be saved.');
    if (response.ok) { setActiveVisualJobId(null); await loadRenders(); }
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
      const response = await fetch(`${apiBase}/drawings/dxf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: projectId ?? 'demo-project', sceneVersionId, scene: { metadata: { status: 'approved' }, modules: modules.map((module) => ({ ...module, position: { xMm: 0, yMm: 0 } })) } }) });
      if (!response.ok) { setDxfState('DXF export failed'); return; }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `ultida-${sceneVersionId}.dxf`; link.click(); URL.revokeObjectURL(url);
      setDxfState('DXF exported');
    } catch { setDxfState('DXF service unavailable'); }
  }

  async function createCutlist() {
    if (!sceneVersionId || !sceneApproved) { setCutlistState('Approve scene first'); return; }
    setCutlistState('Preparing cutlist...');
    try {
      const response = await fetch(`${apiBase}/production/cutlist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: projectId ?? 'demo-project', sceneVersionId, scene: { metadata: { status: 'approved' }, modules } }) });
      const payload = await response.json();
      if (!response.ok || !payload.success) { setCutlistState(payload.message ?? 'Cutlist unavailable'); return; }
      setCutlistState(`${payload.cutlist.partCount} parts ready for review`);
    } catch { setCutlistState('Cutlist service unavailable'); }
  }

  async function downloadFile(path: string, filename: string, setState: (value: string) => void) {
    if (!sceneVersionId || !sceneApproved) { setState('Approve scene first'); return; }
    setState('Preparing file...');
    try {
      const response = await fetch(`${apiBase}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: projectId ?? 'demo-project', sceneVersionId, scene: { metadata: { status: 'approved' }, modules: modules.map((module) => ({ ...module, position: { xMm: 0, yMm: 0 } })) } }) });
      if (!response.ok) { setState('File export failed'); return; }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); setState('File exported');
    } catch { setState('Export service unavailable'); }
  }

  if (stage === 'Visualize') {
    const latest = renders.find((render) => render.id === selectedRenderId) ?? renders[0];
    return (
      <section className="design-flow-workspace">
        <div className="workspace-heading">
          <div>
            <small>VISUAL STUDIO / SCENE-LINKED</small>
            <h2>Review the room as a stored design proposal.</h2>
            <p>Every render records its scene, prompt, provider and review state.</p>
          </div>
          <Badge tone={sceneApproved ? 'success' : 'accent'}>{sceneApproved ? 'Approved scene linked' : 'Scene approval required'}</Badge>
        </div>
        <div className="visual-studio-layout">
          <div className="visual-render-stage">
            {latest?.signedUrl ? (
              <img src={latest.signedUrl} alt={`Generated ${room} interior proposal`} />
            ) : (
              <div className="visual-preview-placeholder">
                <Image size={38} />
                <h3>No stored render yet</h3>
                <p>{visualState}</p>
              </div>
            )}
            <div className="visual-stage-status">
              <Badge tone={latest?.stale ? 'accent' : latest ? 'success' : 'accent'}>{latest?.stale ? 'Stale' : latest ? 'Ready' : visualBusy ? 'Processing' : 'Waiting'}</Badge>
              <span>{visualState}</span>
            </div>
          </div>
          <Card className="visual-studio-panel">
            <CardContent>
              <div className="provider-strip" aria-label="Visual provider availability">
                {providers.length ? (
                  providers.map((provider) => (
                    <span className="provider-status" key={provider.id}>
                      <span className={`provider-dot${provider.configured ? ' provider-dot-ready' : ''}`} />
                      {provider.id}
                      {provider.configured ? ' ready' : ' unavailable'}
                    </span>
                  ))
                ) : (
                  <span className="provider-status">Provider status unavailable</span>
                )}
              </div>
              <div className="visual-controls visual-controls-stack">
                <label>
                  Space
                  <select value={room} onChange={(event) => setRoom(event.target.value)}>
                    <option value="kitchen">Kitchen</option>
                    <option value="living">Living room</option>
                    <option value="bedroom">Bedroom</option>
                  </select>
                </label>

                <div className="visual-tool-section" style={{ borderTop: '1px solid #e8ded2', paddingTop: '10px', marginTop: '4px' }}>
                  <MaterialSwapPanel
                    projectId={projectId}
                    entityId={modules[0]?.id ?? `room:${room}`}
                    moduleInstanceId={modules[0]?.id ?? null}
                    currentLaminate={selectedLaminateObj.name}
                    onConfirmCatalogSwap={({ laminate }) => {
                      setStyle((current) => `${current}; selected persisted material: ${laminate}`);
                      setVisualState('Material assignment saved. Create a new scene revision before requesting a render.');
                    }}
                    onConfirmAiProposal={() => setVisualState('AI material proposals require an approved scene revision before rendering.')}
                  />
                </div>

                <div className="visual-tool-section" style={{ borderTop: '1px solid #e8ded2', paddingTop: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text)', display: 'block', marginBottom: '8px' }}>🛋️ OBJECT CHANGER</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {catalogHardwares.map((hw) => (
                      <button
                        key={hw.id}
                        type="button"
                        onClick={() => setActiveHardware(hw.id)}
                        style={{
                          border: activeHardware === hw.id ? '2px solid #2563eb' : '1px solid #d8ccbd',
                          borderRadius: '6px',
                          padding: '6px 8px',
                          background: activeHardware === hw.id ? '#eff6ff' : '#fff',
                          cursor: 'pointer',
                          fontSize: '10px',
                          textAlign: 'left'
                        }}
                      >
                        {hw.name.split(' ')[0]} {hw.name.split(' ')[1]}
                      </button>
                    ))}
                  </div>
                </div>

                <label style={{ marginTop: '6px' }}>
                  Direction & Prompt
                  <input value={style} onChange={(event) => setStyle(event.target.value)} />
                </label>
                <label>
                  Quality
                  <select value={quality} onChange={(event) => setQuality(event.target.value as typeof quality)}>
                    <option value="draft">Draft</option>
                    <option value="review">Review</option>
                    <option value="final">Final</option>
                  </select>
                </label>
                <Button onClick={createVisual} disabled={!sceneApproved || visualBusy}>
                  {visualBusy ? <RefreshCw className="spin" size={16} /> : <Wand2 size={16} />} {visualBusy ? 'Processing' : 'Generate proposal'}
                </Button>
              </div>
              {latest && (
                <div className="render-provenance">
                  <small>PROVENANCE</small>
                  <span>Scene {latest.scene_version_id.slice(0, 8)}</span>
                  <span>
                    {latest.provenance?.provider ?? 'provider'} / {latest.provenance?.model ?? 'configured model'}
                  </span>
                  <span>{new Date(latest.created_at).toLocaleString()}</span>
                </div>
              )}
              <div className="render-review-actions">
                <Button variant="outline" onClick={() => reviewRender('reject')} disabled={!activeVisualJobId}>
                  <ThumbsDown size={16} /> Reject
                </Button>
                <Button onClick={() => reviewRender('approve')} disabled={!activeVisualJobId}>
                  <ThumbsUp size={16} /> Approve
                </Button>
              </div>
              <div className="render-variants">
                <small>RECENT OUTPUTS</small>
                {renders.slice(0, 4).map((render) => (
                  <button key={render.id} className="render-variant" type="button" aria-pressed={render.id === latest?.id} onClick={() => setSelectedRenderId(render.id)}>
                    <span>{render.stale ? 'Stale' : render.status}</span>
                    <small>{new Date(render.created_at).toLocaleDateString()}</small>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  if (stage === 'Document') {
    return (
      <section className="design-flow-workspace">
        <div className="workspace-heading">
          <div>
            <small>DRAWINGS / PRODUCTION HANDOFF</small>
            <h2>Turn the approved scene into working documents.</h2>
            <p>Drawing requests stay attached to the same scene version as the visual proposal.</p>
          </div>
          <Badge tone={sceneApproved ? 'success' : sceneVersionId ? 'accent' : 'accent'}>{sceneApproved ? 'Production approved' : sceneVersionId ? 'Scene needs approval' : 'Scene required'}</Badge>
        </div>
        <Card className="drawing-panel">
          <CardHeader>
            <small>OUTPUTS</small>
            <h3>Production-ready package</h3>
          </CardHeader>
          <CardContent>
            <div className="output-row">
              <FileText size={20} />
              <div>
                <strong>Floor plan and wall elevations</strong>
                <span>Scene-linked SVG elevation file and DXF geometry</span>
              </div>
              <Badge>SVG / DXF / PDF</Badge>
            </div>
            <div className="output-row">
              <Layers3 size={20} />
              <div>
                <strong>Module schedule and cutlist</strong>
                <span>{modules.length} approved modules currently in the scene</span>
              </div>
              <Badge>CSV</Badge>
            </div>
            <div className="drawing-actions">
              <Button onClick={onSceneApproved} disabled={!sceneVersionId || sceneApproved}>
                {' '}
                <Check size={16} /> {sceneApproved ? 'Scene approved' : 'Approve scene for production'}
              </Button>
              <Button onClick={createDrawings} disabled={!sceneVersionId || !sceneApproved}>
                <Send size={16} /> {drawingState}
              </Button>
              <Button variant="outline" onClick={downloadDxf} disabled={!sceneVersionId || !sceneApproved || dxfState === 'Exporting DXF...'}>
                <FileText size={16} /> {dxfState}
              </Button>
              <Button variant="outline" onClick={() => downloadFile('/drawings/elevations.svg', `ultida-${sceneVersionId}-elevations.svg`, setElevationState)} disabled={!sceneVersionId || !sceneApproved}>
                <FileText size={16} /> {elevationState}
              </Button>
              <Button variant="outline" onClick={() => downloadFile('/drawings/elevations.pdf', `ultida-${sceneVersionId}-elevations.pdf`, setPdfState)} disabled={!sceneVersionId || !sceneApproved}>
                <FileText size={16} /> {pdfState}
              </Button>
              <Button variant="outline" onClick={createCutlist} disabled={!sceneVersionId || !sceneApproved}>
                <Layers3 size={16} /> {cutlistState}
              </Button>
              <Button variant="outline" onClick={() => downloadFile('/production/cutlist.csv', `ultida-${sceneVersionId}-cutlist.csv`, setCutlistState)} disabled={!sceneVersionId || !sceneApproved}>
                <Layers3 size={16} /> Export cutlist CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="design-flow-workspace">
      <div className="workspace-heading">
        <div>
          <small>SCENE CORE / MODULAR PLACEMENT</small>
          <h2>Compose the room from buildable modules.</h2>
          <p>Choose a room, place a catalog module, then save one scene version for every downstream output.</p>
        </div>
        <Badge tone={briefComplete && planApproved ? 'success' : 'accent'}>{!briefComplete ? 'Brief required' : planApproved ? 'Approved plan linked' : 'Approved plan required'}</Badge>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <Button variant={designMode === 'layout' ? 'default' : 'outline'} onClick={() => setDesignMode('layout')}>
          <Layers3 size={16} style={{ marginRight: '0.5rem' }} /> Modular Layout
        </Button>
        <Button variant={designMode === 'moodboard' ? 'default' : 'outline'} onClick={() => setDesignMode('moodboard')}>
          <Palette size={16} style={{ marginRight: '0.5rem' }} /> Moodboard & Materials
        </Button>
      </div>

      <div className="module-layout">
        {designMode === 'layout' ? (
          <Card className="catalog-panel">
            <CardHeader>
              <small>MODULE CATALOG</small>
              <h3>Modular building blocks</h3>
            </CardHeader>
            <CardContent>
              <label>
                Place in
                <select value={spaceId ?? ''} onChange={(event) => { const next = spaces.find((item) => item.id === event.target.value); setSpaceId(event.target.value); if (next) setRoom(next.roomType); }}>
                  {spaces.length ? spaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">No approved rooms</option>}
                </select>
              </label>
              <label>
                Anchor wall
                <select value={wallId ?? ''} onChange={(event) => setWallId(event.target.value || null)}>
                  {walls.length ? walls.map((wall) => <option key={wall.id} value={wall.id}>{wall.id}</option>) : <option value="">No verified walls</option>}
                </select>
              </label>
              <p className="placement-notice" role="status">
                {placementNotice}
              </p>
              <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {catalogItems.map((item) => (
                  <button className="catalog-item" key={item.id} onClick={() => addModule(item)} disabled={!briefComplete || !planApproved}>
                    {item.family.startsWith('kitchen') ? <Utensils size={16} /> : item.family === 'sofa' || item.family === 'dining' || item.family === 'bed' ? <Sofa size={16} /> : <Layers3 size={16} />}
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.widthMm} x {item.depthMm} x {item.heightMm} mm
                      </small>
                    </span>
                    <Plus size={15} />
                  </button>
                ))}
                {!catalogItems.length && <p className="placement-notice">No compatible templates are available for this approved room.</p>}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="catalog-panel" style={{ minWidth: '400px' }}>
            <CardHeader>
              <small>MOODBOARD STUDIO</small>
              <h3>Aesthetic Material Curation</h3>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ fontWeight: 'bold', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>1. Select Theme & Palette</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
      {themes.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setActiveTheme(theme.id)}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '0.375rem',
                        border: activeTheme === theme.id ? '2px solid #c59c2d' : '1px solid #e5e7eb',
                        backgroundColor: activeTheme === theme.id ? '#fafaf9' : '#ffffff',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      <strong style={{ fontSize: '0.8rem', display: 'block' }}>{theme.name}</strong>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                        {theme.colors.map((c) => (
                          <span key={c} style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: c }} />
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 'bold', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>2. Selected Laminate Finish</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {catalogLaminates.map((laminate) => (
                    <button
                      key={laminate.id}
                      onClick={() => setActiveLaminate(laminate.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.375rem',
                        border: activeLaminate === laminate.id ? '2px solid #c59c2d' : '1px solid #e5e7eb',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <span style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: laminate.hex, border: '1px solid #d1d5db' }} />
                      <span style={{ fontSize: '0.8rem', flex: 1 }}>{laminate.name}</span>
                      <small style={{ fontSize: '0.7rem', color: '#6b7280' }}>{laminate.code}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 'bold', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>3. Accent Hardware</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {catalogHardwares.map((hardware) => (
                    <button
                      key={hardware.id}
                      onClick={() => setActiveHardware(hardware.id)}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        fontSize: '0.75rem',
                        borderRadius: '0.375rem',
                        border: activeHardware === hardware.id ? '2px solid #c59c2d' : '1px solid #e5e7eb',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      {hardware.name}
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={saveMoodboard} style={{ marginTop: '0.5rem' }}>
                <Check size={16} style={{ marginRight: '0.5rem' }} /> Save Moodboard to Scene
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="scene-panel">
          <CardHeader>
            <div>
              <small>SCENE V1</small>
              <h3>{sceneVersionId ? `Version ${sceneVersionId.slice(0, 8)}` : 'Draft scene'}</h3>
            </div>
            <Badge>{modules.length} modules</Badge>
          </CardHeader>
          <CardContent>
            <div className="scene-canvas">
              <div className="scene-room-label">{room.toUpperCase()}</div>
              {modules.map((item, index) => (
                <div className={`scene-module module-${item.family}`} key={item.id} style={{ left: `${12 + (index % 4) * 22}%`, top: `${20 + Math.floor(index / 4) * 24}%` }}>
                  <Check size={13} />
                  {item.label}
                </div>
              ))}
            </div>
            
            {materials.length > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#fafaf9', borderRadius: '0.375rem', border: '1px dashed #e5e7eb' }}>
                <small style={{ fontWeight: 'bold', color: '#c59c2d', display: 'block', marginBottom: '0.25rem' }}>ACTIVE MOODBOARD MATERIALS</small>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {materials.map((m) => (
                    <Badge key={m.id} tone="success">{m.name}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="module-list">
              {modules.length ? (
                modules.map((item) => (
                  <div key={item.id}>
                    <span>{item.label}</span>
                    <small>{item.widthMm} mm</small>
                  </div>
                ))
              ) : (
                <p>Add a module to begin the scene.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
