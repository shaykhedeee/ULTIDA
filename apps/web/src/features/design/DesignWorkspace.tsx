import { useMemo, useState, useEffect } from 'react';
import {
  compileModule, builderPlanToSymbols, buildAutoLayoutPrompt, parseAutoLayoutResponse,
  validateDesign, approveDesign, invalidateDownstream, MODULE_TEMPLATES,
  type SymbolicPlacement, type DesignMode, type DesignValidationContext,
} from '@ultida/design-core';
import { Layers, Sparkles, MousePointer2, CheckCircle2, AlertTriangle, Save } from 'lucide-react';
import './design.css';

const DESIGN_MODES: { id: DesignMode; label: string; icon: typeof Layers; hint: string }[] = [
  { id: 'builder', label: 'Builder Plan', icon: Layers, hint: 'Interpret furniture symbols from plan analysis → confirm placements' },
  { id: 'ai_auto', label: 'AI Auto-Layout', icon: Sparkles, hint: 'Send structured geometry to planning model → symbolic proposals' },
  { id: 'manual', label: 'Manual Design', icon: MousePointer2, hint: 'Direct placement & configuration' },
];

const LAYOUT_SHAPES = [
  { id: 'living', label: 'Living' },
  { id: 'bedroom', label: 'Bedroom' },
  { id: 'tv_unit', label: 'TV Unit' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'wardrobe', label: 'Wardrobe' },
];

interface RoomLike { id: string; name: string; roomType: string; widthMm: number; depthMm: number; }

async function loadDesignSession() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const client = createClient(url, key, { auth: { persistSession: true } });
  const { data } = await client.auth.getSession();
  return { client, session: data.session };
}

export function DesignWorkspace({ projectId, rooms: initialRooms = [] }: { projectId: string; rooms?: RoomLike[] }) {
  const [mode, setMode] = useState<DesignMode>('manual');
  const [shape, setShape] = useState<string>('living');
  const [fetchedRooms, setFetchedRooms] = useState<RoomLike[]>([]);
  const rooms = initialRooms.length ? initialRooms : fetchedRooms;
  const [activeRoomId, setActiveRoomId] = useState<string>(rooms[0]?.id ?? '');
  const [placements, setPlacements] = useState<SymbolicPlacement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [approved, setApproved] = useState<ReturnType<typeof approveDesign> | null>(null);
  const [invalidated, setInvalidated] = useState<ReturnType<typeof invalidateDownstream> | null>(null);
  const [builderCandidates, setBuilderCandidates] = useState<any[]>([]);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiRaw, setAiRaw] = useState<string>('');
  const [geometryNotice, setGeometryNotice] = useState('Load and approve a floor plan to unlock measured design geometry.');

  useEffect(() => {
    if (initialRooms.length || !projectId) return;
    let alive = true;
    (async () => {
      const { session } = await loadDesignSession();
      if (!session) return;
      const base = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8800/api';
      const res = await fetch(`${base}/projects/${projectId}/floor-plan/active`, { headers: { authorization: `Bearer ${session.access_token}` } });
      if (!res.ok) return;
      const data = await res.json();
      const p = data.plan ?? {};
      const mapped: RoomLike[] = (p.rooms ?? []).map((r: any, i: number) => {
        const poly = r.worldGeometry?.polygon ?? r.polygon ?? [];
        const xs = poly.map((pt: any) => pt[0]); const ys = poly.map((pt: any) => pt[1]);
        const w = xs.length ? Math.max(...xs) - Math.min(...xs) : 4000;
        const d = ys.length ? Math.max(...ys) - Math.min(...ys) : 4000;
        return { id: r.id ?? `room-${i}`, name: r.name ?? r.roomType ?? `Room ${i + 1}`, roomType: r.roomType ?? 'living', widthMm: w, depthMm: d };
      });
      if (alive) {
        const usable = mapped.filter((room) => room.widthMm > 0 && room.depthMm > 0);
        setFetchedRooms(usable.length > 0 ? usable : mapped);
        setActiveRoomId((cur) => cur || usable.length > 0 ? usable[0].id : mapped[0]?.id || '');
        setGeometryNotice(usable.length > 0 ? 'Measured room geometry loaded from the approved plan.' : 'The approved plan has no usable room geometry. Return to Plan Review and resolve dimensions.');
      }
    })();
    return () => { alive = false; };
  }, [projectId, initialRooms.length]);

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? rooms[0];

  const ctx = useMemo<DesignValidationContext>(() => ({
    projectId, spaceId: activeRoom?.id ?? '', roomCategory: (shape as any), floorPlanVersionId: 'fpv1',
    shape, candidateTypes: ['balanced'], requirements: {},
    roomBoundingBoxMm: { minX: 0, minY: 0, maxX: activeRoom?.widthMm ?? 0, maxY: activeRoom?.depthMm ?? 0 },
    usableWalls: [],
    openings: [],
    servicePoints: [], structuralElements: [], companyRules: {},
    curtainZones: [],
    acUnits: [],
  }), [projectId, activeRoom, shape]);

  const validation = useMemo(() => validateDesign(placements, ctx), [placements, ctx]);

  // Builder-plan interpretation
  function runBuilderInterpret() {
    if (!activeRoom || activeRoom.widthMm <= 0 || activeRoom.depthMm <= 0 || !builderCandidates.length) {
      setGeometryNotice('No measured layout candidate exists for this room. Complete Plan Review and Spaces first.');
      return;
    }
    const symbols = builderPlanToSymbols(builderCandidates, { requireConfirmation: true });
    setPlacements(symbols);
  }
  function confirmPlacement(id: string) {
    setPlacements((ps) => ps.map((p) => (p.id === id ? { ...p, confirmed: true } : p)));
  }
  function confirmAll() { setPlacements((ps) => ps.map((p) => ({ ...p, confirmed: true }))); }

  // AI auto-layout
  function buildPrompt() { setAiPrompt(buildAutoLayoutPrompt(ctx)); }
  function applyAiResponse() {
    try {
      const parsed = parseAutoLayoutResponse(JSON.parse(aiRaw || '{"placements":[]}'));
      setPlacements(parsed);
    } catch (e) { alert('Malformed AI layout response: ' + (e as Error).message); }
  }

  // Manual placement
  function addManual(templateFamily: string) {
    if (!activeRoom || activeRoom.widthMm <= 0 || activeRoom.depthMm <= 0) {
      setGeometryNotice('Manual furniture placement is locked until this room has measured geometry and verified walls.');
      return;
    }
    const wall = { id: activeRoom.wallId ?? 'verified-wall', widthMm: activeRoom.widthMm, heightMm: 2700, depthMm: 400 };
    const id = `man-${Date.now().toString(36)}`;
    const p: SymbolicPlacement = {
      id, spaceId: activeRoom?.id ?? '', category: (shape as any), templateFamily,
      anchor: 'wall', wallId: 'verified-wall-required', offsetMm: [Math.round(activeRoom.widthMm / 2 - 1000), 0, 0],
      rotationDeg: 0, widthMm: 2000, heightMm: 600, depthMm: 400, clearanceZoneMm: 150,
      requiredServicePoints: [], materialSlots: {}, source: 'manual', confirmed: true,
    };
    void compileModule({ family: (templateFamily as any), parameters: { totalWidthMm: p.widthMm, totalHeightMm: p.heightMm, totalDepthMm: p.depthMm }, wall });
    setPlacements((ps) => [...ps, p]);
    setSelectedId(id);
  }
  function updateMaterial(partSemantic: string, code: string) {
    if (!selectedId) return;
    setPlacements((ps) => ps.map((p) => (p.id === selectedId ? { ...p, materialSlots: { ...p.materialSlots, [partSemantic]: code } } : p)));
  }

  function doApprove() {
    try {
      if (!activeRoom || activeRoom.widthMm <= 0 || activeRoom.depthMm <= 0 || !placements.length) throw new Error('Measured room geometry and at least one confirmed placement are required.');
      const moduleParts: Record<string, any> = {};
      const materials: Record<string, Record<string, string>> = {};
      for (const p of placements) {
        const wall = { id: p.wallId ?? 'w1', widthMm: activeRoom?.widthMm ?? 4000, heightMm: 2700, depthMm: p.depthMm };
        moduleParts[p.id] = compileModule({ family: (p.templateFamily as any), parameters: { totalWidthMm: p.widthMm, totalHeightMm: p.heightMm, totalDepthMm: p.depthMm, materialZones: p.materialSlots }, wall });
        materials[p.id] = p.materialSlots;
      }
      const dv = approveDesign({
        projectId, spaceId: activeRoom?.id ?? '', floorPlanVersionId: 'fpv1', layoutShape: shape, mode,
        placements, moduleParts, materials, validation,
        inputVersionReferences: { floorPlanVersionId: 'fpv1' }, userId: 'designer',
      });
      setApproved(dv);
      setInvalidated(invalidateDownstream(dv, 'design approved'));
    } catch (e) { alert((e as Error).message); }
  }

  return (
    <div className="design-workspace phase5">
      <header className="dw-header">
        <div>
          <h2>Design Workspace</h2>
          <p className="dw-hint" role="status">{geometryNotice}</p>
          <p className="dw-sub">Unified layouts · modules · materials — the main design workflow</p>
        </div>
        <div className="dw-mode-tabs">
          {DESIGN_MODES.map((m) => (
            <button key={m.id} className={`dw-mode ${mode === m.id ? 'active' : ''}`} onClick={() => setMode(m.id)} title={m.hint}>
              <m.icon size={16} /> {m.label}
            </button>
          ))}
        </div>
      </header>

      <div className="dw-body">
        <aside className="dw-left">
          <section className="dw-section">
            <h4>Room</h4>
            <select value={activeRoomId} onChange={(e) => setActiveRoomId(e.target.value)} className="dw-select">
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </section>

          <section className="dw-section">
            <h4>Layout Shape <span className="dw-req">(choose before modules)</span></h4>
            <div className="dw-shapes">
              {LAYOUT_SHAPES.map((s) => (
                <button key={s.id} className={`dw-shape ${shape === s.id ? 'active' : ''}`} onClick={() => setShape(s.id)}>{s.label}</button>
              ))}
            </div>
          </section>

          <section className="dw-section">
            <h4>Modules ({MODULE_TEMPLATES.length} families)</h4>
            <div className="dw-modules">
              {MODULE_TEMPLATES.map((t) => (
                <button key={t.family} className="dw-mod" onClick={() => addManual(t.family)} disabled={mode !== 'manual'}>{t.label}</button>
              ))}
            </div>
          </section>

          {mode === 'builder' && (
            <section className="dw-section">
              <h4>Builder Plan</h4>
              <p className="dw-hint">Furniture symbols from plan analysis become editable placements. Confirm each.</p>
              <button className="dw-btn" onClick={runBuilderInterpret}>Interpret symbols</button>
              <button className="dw-btn ghost" onClick={confirmAll}>Confirm all</button>
            </section>
          )}
          {mode === 'ai_auto' && (
            <section className="dw-section">
              <h4>AI Auto-Layout</h4>
              <p className="dw-hint">Structured prompt (no screenshot). Paste symbolic JSON response.</p>
              <button className="dw-btn" onClick={buildPrompt}>Build prompt</button>
              <textarea className="dw-ta" value={aiPrompt} readOnly placeholder="prompt" />
              <textarea className="dw-ta" value={aiRaw} onChange={(e) => setAiRaw(e.target.value)} placeholder='{"placements":[...]}' />
              <button className="dw-btn" onClick={applyAiResponse}>Apply response</button>
            </section>
          )}
        </aside>

        <main className="dw-canvas-wrap">
          <DesignCanvas room={activeRoom} placements={placements} selectedId={selectedId} onSelect={setSelectedId} />
          <div className="dw-validation">
            <div className={`dw-valid-badge ${validation.valid ? 'ok' : 'bad'}`}>
              {validation.valid ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              {validation.valid ? 'Layout valid' : `${validation.issues.filter((i) => i.severity === 'blocking').length} blocking`}
            </div>
            <ul className="dw-issues">
              {validation.issues.map((i, k) => <li key={k} className={`dw-issue ${i.severity}`}>{i.code}: {i.message}</li>)}
            </ul>
          </div>
        </main>

        <aside className="dw-right">
          <ModuleInspector
            placement={placements.find((p) => p.id === selectedId) ?? null}
            onMaterial={updateMaterial}
            onConfirm={selectedId ? () => confirmPlacement(selectedId) : undefined}
          />
          <div className="dw-approve">
            <button className="dw-btn primary" onClick={doApprove} disabled={!validation.valid || placements.some((p) => !p.confirmed)}>
              <Save size={16} /> Approve Design
            </button>
            {approved && <div className="dw-approved">Approved {approved.id}<br />refs fpv1 · {approved.placements.length} placements · {approved.mode}</div>}
            {invalidated && <div className="dw-inv">Downstream invalidated: {invalidated.flatMap((e) => e.targets).join(', ')}</div>}
          </div>
        </aside>
      </div>
    </div>
  );
}

function DesignCanvas({ room, placements, selectedId, onSelect }: { room?: RoomLike; placements: SymbolicPlacement[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const w = room?.widthMm ?? 5000; const d = room?.depthMm ?? 4000;
  const scale = Math.min(360 / w, 260 / d);
  return (
    <div className="dw-canvas">
      <svg width={w * scale + 20} height={d * scale + 20} viewBox={`0 0 ${w * scale + 20} ${d * scale + 20}`}>
        <rect x={10} y={10} width={w * scale} height={d * scale} fill="#f5f5f0" stroke="#999" />
        {placements.map((p) => {
          const x = 10 + p.offsetMm[0] * scale; const y = 10 + p.offsetMm[1] * scale;
          const pw = p.widthMm * scale; const pd = p.depthMm * scale;
          return <g key={p.id} onClick={() => onSelect(p.id)} className={`dw-pl ${selectedId === p.id ? 'sel' : ''}`}>
            <rect x={x} y={y} width={pw} height={pd} fill={selectedId === p.id ? '#2b6cb0' : '#7aa7d6'} stroke="#1a4971" opacity={p.confirmed ? 0.95 : 0.5} />
            <text x={x + 4} y={y + 14} fontSize={9} fill="#fff">{p.templateFamily}</text>
            {!p.confirmed && <text x={x + 4} y={y + 26} fontSize={8} fill="#ffd">confirm</text>}
          </g>;
        })}
      </svg>
    </div>
  );
}

function ModuleInspector({ placement, onMaterial, onConfirm }: { placement: SymbolicPlacement | null; onMaterial: (semantic: string, code: string) => void; onConfirm?: () => void }) {
  if (!placement) return <section className="dw-section"><h4>Module Inspector</h4><p className="dw-hint">Select a placement.</p></section>;
  const semantics = ['carcass', 'shutter', 'drawer', 'shelf', 'back_panel', 'countertop', 'panel', 'glass', 'profile', 'hardware', 'filler', 'lighting_channel'];
  return (
    <section className="dw-section">
      <h4>Module Inspector — {placement.templateFamily}</h4>
      <div className="dw-prop"><span>Width</span><b>{placement.widthMm}mm</b></div>
      <div className="dw-prop"><span>Height</span><b>{placement.heightMm}mm</b></div>
      <div className="dw-prop"><span>Depth</span><b>{placement.depthMm}mm</b></div>
      <div className="dw-prop"><span>Offset</span><b>{placement.offsetMm.join(', ')}</b></div>
      <div className="dw-prop"><span>Rotation</span><b>{placement.rotationDeg}°</b></div>
      <div className="dw-prop"><span>Clearance</span><b>{placement.clearanceZoneMm}mm</b></div>
      <h5>Material assignment</h5>
      {semantics.map((s) => (
        <div key={s} className="dw-matrow">
          <span>{s}</span>
          <input value={placement.materialSlots[s] ?? ''} placeholder="material code" onChange={(e) => onMaterial(s, e.target.value)} />
        </div>
      ))}
      {!placement.confirmed && onConfirm && <button className="dw-btn" onClick={onConfirm}>Confirm placement</button>}
    </section>
  );
}
