/* ═══════════════════════════════════════════════
   PHASE 4 — SPACES WORKSPACE
   Consumes the active approved floor-plan version.
   No re-entry of measurements that already exist in the plan.
═══════════════════════════════════════════════ */
import {
  Home, CheckCircle2, Circle, Edit3, AlertTriangle, Layers, Ruler, Square, SplitSquareHorizontal,
  Merge, Columns, Plug, DoorOpen, Pencil, Undo2, Redo2, Eye, EyeOff, Sparkles,
  MapPin, TriangleAlert, Save, Plus, X, Maximize
} from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button } from '../../components/ui/primitives';
import { supabase } from '../../lib/supabase';
import {
  computeUsableWallLength, computeSpaceReadiness, canApproveSpaces, polygonsOverlap,
  editSplitRoom, editMergeRooms, editAddWall, editAddOpening, editAddColumn, type CanonicalPlanFragment
} from '@ultida/spaces-core';
import './spaces.css';

type Pt = { xMm: number; yMm: number };

interface PlanRoom { id: string; name: string; roomType: string; polygon: Pt[]; areaSqm: number; ceilingHeightMm?: number; included?: boolean; }
interface PlanWall { id: string; start: Pt; end: Pt; isExterior?: boolean }
interface PlanOpening { id: string; wallId: string; kind: string; offsetAlongWallMm: number; widthMm?: number }
interface PlanColumn { id: string; position: Pt; sizeMm?: number }
interface PlanBeam { id: string; start: Pt; end: Pt }
interface PlanService { id: string; kind: string; position: Pt }
interface PlanAnnotation { id: string; text: string; kind: string; position?: Pt }

const ROOM_TYPES: Record<string, string> = {
  living: 'Living Room', bedroom: 'Bedroom', kitchen: 'Kitchen', dining: 'Dining Room',
  utility: 'Utility', pooja: 'Pooja Room', bathroom: 'Bathroom', other: 'Other'
};

function bbox(points: Pt[]) {
  const xs = points.map(p => p.xMm), ys = points.map(p => p.yMm);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}
function polyArea(points: Pt[]) {
  let a = 0; for (let i = 0; i < points.length; i++) { const j = (i + 1) % points.length; a += points[i].xMm * points[j].yMm - points[j].xMm * points[i].yMm; } return Math.abs(a) / 2 / 1e6;
}
function wallLen(w: PlanWall) { return Math.hypot(w.end.xMm - w.start.xMm, w.end.yMm - w.start.yMm); }

export function SpacesWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<CanonicalPlanFragment | null>(null);
  const [rooms, setRooms] = useState<PlanRoom[]>([]);
  const [walls, setWalls] = useState<PlanWall[]>([]);
  const [openings, setOpenings] = useState<PlanOpening[]>([]);
  const [columns, setColumns] = useState<PlanColumn[]>([]);
  const [beams, setBeams] = useState<PlanBeam[]>([]);
  const [services, setServices] = useState<PlanService[]>([]);
  const [annotations, setAnnotations] = useState<PlanAnnotation[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [scaleVerified, setScaleVerified] = useState(false);
  const [ceilingHeightMm, setCeilingHeightMm] = useState(2700);
  const [floorPlanVersionId, setFloorPlanVersionId] = useState<string>('');

  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedWall, setSelectedWall] = useState<string | null>(null);
  const [layers, setLayers] = useState({ walls: true, openings: true, columns: true, beams: true, services: true, annotations: true, rooms: true });
  const [tool, setTool] = useState<string>('select');
  const [measureFrom, setMeasureFrom] = useState<Pt | null>(null);
  const [measureTo, setMeasureTo] = useState<Pt | null>(null);
  const [saveState, setSaveState] = useState('');
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'blocked' | 'empty' | 'error'>('loading');
  const [history, setHistory] = useState<any[]>([]);
  const [future, setFuture] = useState<any[]>([]);
  const [annotationDraft, setAnnotationDraft] = useState('');
  const [annotationDialogOpen, setAnnotationDialogOpen] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // ── Load approved plan geometry (no measurement re-entry) ──
  useEffect(() => {
    if (!supabase || !projectId) return;
    let live = true;
    void (async () => {
      setLoadState('loading');
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) { if (live) { setLoadState('error'); setSaveState('Your session expired. Sign in again.'); } return; }
      const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
      const response = await fetch(`${apiBase}/projects/${projectId}/floor-plan/active`, { headers: { authorization: `Bearer ${session.access_token}` } });
      const payload = await response.json().catch(() => null);
      if (!live) return;
      if (!response.ok) { setLoadState(response.status === 409 ? 'blocked' : 'error'); setSaveState(payload?.message ?? 'Approved plan could not be loaded.'); return; }
      const roomsP: PlanRoom[] = (payload.rooms ?? []).map((r: any) => ({ id: r.id, name: r.name, roomType: r.roomType ?? 'other', polygon: r.polygon ?? [], areaSqm: r.areaSqm ?? polyArea(r.polygon ?? []), ceilingHeightMm: r.ceilingHeightMm, included: true }));
      if (!live) return;
      setPlan({ ceilingHeightMm: payload.ceilingHeightMm, walls: payload.walls, rooms: payload.rooms, openings: payload.openings, services: payload.services, obstacles: payload.columns } as any);
      setRooms(roomsP); setWalls(payload.walls ?? []); setOpenings(payload.openings ?? []);
      setColumns(payload.columns ?? []); setBeams(payload.beams ?? []); setServices(payload.services ?? []);
      setAnnotations(payload.annotations ?? []); setIssues(payload.issues ?? []);
      setScaleVerified(payload.scaleVerified); setCeilingHeightMm(payload.ceilingHeightMm ?? 2700); setFloorPlanVersionId(payload.floorPlanVersionId ?? '');
      setLoadState(roomsP.length ? 'ready' : 'empty');
    })();
    return () => { live = false; };
  }, [projectId]);

  // ── History helpers (undo/redo) ──
  function snapshot() { setHistory(h => [...h, { rooms, walls, openings, columns, beams, services, annotations, ceilingHeightMm }]); setFuture([]); }
  function undo() { setHistory(h => { if (!h.length) return h; const prev = h[h.length - 1]; const cur = { rooms, walls, openings, columns, beams, services, annotations, ceilingHeightMm }; setFuture(f => [cur, ...f]); setRooms(prev.rooms); setWalls(prev.walls); setOpenings(prev.openings); setColumns(prev.columns); setBeams(prev.beams); setServices(prev.services); setAnnotations(prev.annotations); setCeilingHeightMm(prev.ceilingHeightMm); return h.slice(0, -1); }); }
  function redo() { setFuture(f => { if (!f.length) return f; const next = f[0]; const cur = { rooms, walls, openings, columns, beams, services, annotations, ceilingHeightMm }; setHistory(h => [...h, cur]); setRooms(next.rooms); setWalls(next.walls); setOpenings(next.openings); setColumns(next.columns); setBeams(next.beams); setServices(next.services); setAnnotations(next.annotations); setCeilingHeightMm(next.ceilingHeightMm); return f.slice(1); }); }

  // ── Derive room metrics (dimensions from plan, usable walls) ──
  const roomMetrics = useMemo(() => rooms.map(room => {
    const b = bbox(room.polygon);
    const widthMm = b.maxX - b.minX, depthMm = b.maxY - b.minY;
    const roomWalls = walls.filter(w => room.polygon.some(p => (Math.abs(p.xMm - w.start.xMm) < 1 && Math.abs(p.yMm - w.start.yMm) < 1) || (Math.abs(p.xMm - w.end.xMm) < 1 && Math.abs(p.yMm - w.end.yMm) < 1)));
    const roomOpenings = openings.filter(o => roomWalls.some(w => w.id === o.wallId));
    const roomCols = columns.filter(c => c.position.xMm >= b.minX && c.position.xMm <= b.maxX && c.position.yMm >= b.minY && c.position.yMm <= b.maxY);
    const deductions = [
      ...roomOpenings.map(o => ({ id: o.id, kind: 'opening' as const, widthMm: o.widthMm ?? 900, clearanceMm: 120 })),
      ...roomCols.map(c => ({ id: c.id, kind: 'column' as const, widthMm: c.sizeMm ?? 300, clearanceMm: 200 })),
    ];
    const usable = computeUsableWallLength(roomWalls.map(w => ({ id: w.id, lengthMm: wallLen(w) })), deductions);
    const readiness = computeSpaceReadiness(
      { spaceId: room.id, areaSqm: room.areaSqm, ceilingHeightMm: room.ceilingHeightMm ?? ceilingHeightMm, usableWalls: roomWalls.map(w => ({ id: w.id, lengthMm: Math.round(wallLen(w)), openings: [], isExterior: false })) } as any,
      room.included !== false,
      issues.filter(i => i.entityId === room.id)
    );
    return { room, widthMm, depthMm, wallCount: roomWalls.length, openingCount: roomOpenings.length, usable, readiness };
  }), [rooms, walls, openings, columns, issues, ceilingHeightMm]);

  const overallReadiness = useMemo(() => canApproveSpaces(roomMetrics.map(m => m.readiness)), [roomMetrics]);

  // ── Canvas projection ──
  const view = useMemo(() => {
    const all: Pt[] = [...rooms.flatMap(r => r.polygon), ...walls.flatMap(w => [w.start, w.end]), ...columns.map(c => c.position), ...services.map(s => s.position)];
    if (!all.length) return { minX: 0, minY: 0, scale: 0.1, w: 600, h: 400 };
    const b = bbox(all); const pad = 60; const W = 720, H = 460;
    const s = Math.min((W - 2 * pad) / (b.maxX - b.minX || 1), (H - 2 * pad) / (b.maxY - b.minY || 1));
    return { minX: b.minX, minY: b.minY, scale: s, w: W, h: H };
  }, [rooms, walls, columns, services]);
  const toPx = (p: Pt) => ({ x: (p.xMm - view.minX) * view.scale + 30, y: (p.yMm - view.minY) * view.scale + 30 });
  const pxToMm = (x: number, y: number): Pt => ({ xMm: (x - 30) / view.scale + view.minX, yMm: (y - 30) / view.scale + view.minY });

  function svgPoint(e: React.MouseEvent) {
    const svg = svgRef.current!; const rect = svg.getBoundingClientRect();
    return pxToMm(e.clientX - rect.left, e.clientY - rect.top);
  }

  function onCanvasClick(e: React.MouseEvent) {
    const pt = svgPoint(e);
    if (tool === 'measure') { if (!measureFrom) setMeasureFrom(pt); else { setMeasureTo(pt); } return; }
    if (tool === 'draw_room' || tool === 'redraw') { /* drag handled by mousedown/up; simplified: append point */ }
    if (tool === 'add_column' || tool === 'add_service') {
      snapshot();
      if (tool === 'add_column') setColumns(c => [...c, { id: `col-${Date.now()}`, position: pt, sizeMm: 300 }]);
      else setServices(s => [...s, { id: `svc-${Date.now()}`, kind: 'electrical', position: pt }]);
      setTool('select');
    }
  }

  // ── Tools ──
  function includeRoom(id: string, inc: boolean) { snapshot(); setRooms(rs => rs.map(r => r.id === id ? { ...r, included: inc } : r)); }
  function setRoomCeiling(id: string, h: number) { snapshot(); setRooms(rs => rs.map(r => r.id === id ? { ...r, ceilingHeightMm: h } : r)); }
  function setRoomType(id: string, t: string) { snapshot(); setRooms(rs => rs.map(r => r.id === id ? { ...r, roomType: t } : r)); }
  function splitSelected() { if (!selectedRoom) return; snapshot(); const r = rooms.find(x => x.id === selectedRoom); if (!r) return; const b = bbox(r.polygon); const midX = (b.minX + b.maxX) / 2; const pa = r.polygon.filter(p => p.xMm <= midX); const pb = r.polygon.filter(p => p.xMm >= midX); if (pa.length < 3 || pb.length < 3) { setSaveState('Cannot split: room must have points on both sides.'); return; } setRooms(rs => rs.flatMap(x => x.id === r.id ? [{ ...x, id: r.id + '-a', polygon: pa }, { ...x, id: r.id + '-b', polygon: pb }] : [x])); setTool('select'); }
  function mergeSelected() { const sel = rooms.filter(r => r.id === selectedRoom); if (selectedRoom && selectedRoom.includes('-')) { const base = selectedRoom.split('-')[0]; const grp = rooms.filter(r => r.id.startsWith(base)); if (grp.length < 2) return; snapshot(); const poly = grp.flatMap(g => g.polygon); setRooms(rs => [...rs.filter(r => !r.id.startsWith(base)), { id: base, name: grp[0].name, roomType: grp[0].roomType, polygon: poly, areaSqm: polyArea(poly), included: true }]); setTool('select'); } }
  function addWall() { snapshot(); setWalls(w => [...w, { id: `w-${Date.now()}`, start: { xMm: 0, yMm: 0 }, end: { xMm: 1000, yMm: 0 } }]); }
  function addOpening(kind: 'door' | 'window') { snapshot(); setOpenings(o => [...o, { id: `${kind}-${Date.now()}`, wallId: selectedWall ?? walls[0]?.id ?? '', kind, offsetAlongWallMm: 500, widthMm: kind === 'door' ? 900 : 1200 }]); }
  function addBeam() { snapshot(); setBeams(b => [...b, { id: `beam-${Date.now()}`, start: { xMm: 0, yMm: 0 }, end: { xMm: 1000, yMm: 0 } }]); }
  function addService() { snapshot(); setServices(s => [...s, { id: `svc-${Date.now()}`, kind: 'electrical', position: { xMm: 500, yMm: 500 } }]); }
  function addAnnotation(text: string) { snapshot(); setAnnotations(a => [...a, { id: `ann-${Date.now()}`, text, kind: 'note' }]); }

  async function persistRoom(room: PlanRoom) {
    if (!supabase || !projectId) return;
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) { setSaveState('Session expired.'); return; }
    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
    const res = await fetch(`${apiBase}/projects/${projectId}/spaces/${room.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ name: room.name, roomType: room.roomType, ceilingHeightMm: room.ceilingHeightMm ?? ceilingHeightMm, designInclusion: room.included })
    });
    const p = await res.json().catch(() => null);
    setSaveState(res.ok ? 'Room saved.' : (p?.message ?? 'Save failed.'));
  }

  const sel = roomMetrics.find(m => m.room.id === selectedRoom);

  return (
    <div className="spaces-workspace phase4">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-text">
          <small>Phase 4 — Spaces Workspace (consumes approved plan)</small>
          <h1>Configured Spaces ({rooms.filter(r => r.included !== false).length})</h1>
          <p>Measurements are read from the approved floor-plan version. Edit structurally only via derived plan versions — the approved plan is immutable.</p>
        </div>
        <div className="page-header-actions">
          <div className="history-btns">
            <button className="icon-btn" onClick={undo} title="Undo"><Undo2 size={15} /></button>
            <button className="icon-btn" onClick={redo} title="Redo"><Redo2 size={15} /></button>
          </div>
          <Badge tone={overallReadiness.approved ? 'success' : 'warn'}>{overallReadiness.approved ? 'Ready for Layout' : `${overallReadiness.readyRooms}/${overallReadiness.totalRooms} ready`}</Badge>
          <button className="btn-primary" onClick={() => navigate(`/projects/${projectId}/layouts`)}>Open Layout Studio →</button>
        </div>
      </div>
      {saveState && <p role="status" className="save-state">{saveState}</p>}

      {loadState === 'loading' && <div className="spaces-empty"><Layers size={22} /><strong>Loading approved plan spaces...</strong></div>}
      {loadState === 'blocked' && <div className="spaces-empty"><AlertTriangle size={22} /><strong>Floor Plan approval required</strong><Button variant="outline" onClick={() => navigate(`/projects/${projectId}/plan`)}>Open Floor Plan Intelligence</Button></div>}
      {loadState === 'empty' && <div className="spaces-empty"><Home size={22} /><strong>No room polygons derived</strong></div>}

      {loadState === 'ready' && (
        <div className="spaces-layout">
          {/* Region: Room list */}
          <aside className="region room-list">
            <div className="region-title"><Home size={14} /> Rooms</div>
            <div className="room-cards">
              {roomMetrics.map(({ room, widthMm, depthMm, wallCount, openingCount, usable, readiness }) => (
                <div key={room.id} className={`room-card ${selectedRoom === room.id ? 'sel' : ''}`} onClick={() => setSelectedRoom(room.id)}>
                  <div className="rc-head">
                    <strong>{room.name}</strong>
                    <span className="rc-type">{ROOM_TYPES[room.roomType] ?? room.roomType}</span>
                  </div>
                  <div className="rc-dims">{((widthMm) / 1000).toFixed(2)}m × {((depthMm) / 1000).toFixed(2)}m • {room.areaSqm.toFixed(1)} m²</div>
                  <div className="rc-row"><span>Ceiling</span><strong>{room.ceilingHeightMm ?? ceilingHeightMm} mm</strong></div>
                  <div className="rc-row"><span>Walls / Openings</span><strong>{wallCount} / {openingCount}</strong></div>
                  <div className="rc-row"><span>Usable wall</span><strong>{usable.usableWallMm} mm</strong></div>
                  <div className="rc-foot">
                    <Badge tone={readiness.ready ? 'success' : 'warn'}>{readiness.ready ? 'Ready' : 'Incomplete'}</Badge>
                    <label className="inc-toggle"><input type="checkbox" checked={room.included !== false} onChange={(e) => includeRoom(room.id, e.target.checked)} onClick={(e) => e.stopPropagation()} /> include</label>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* Region: Plan canvas + tools */}
          <section className="region canvas-region">
            <div className="toolbar">
              {[['select', 'Choose'], ['measure', 'Measure'], ['draw_room', 'Draw room'], ['redraw', 'Redraw'], ['split', 'Split'], ['merge', 'Merge'], ['wall', 'Add wall'], ['door', 'Add door'], ['window', 'Add window'], ['column', 'Column'], ['beam', 'Beam'], ['service', 'Service'], ['annotate', 'Annotate']].map(([t, label]) => (
                <button key={t} className={`tool-btn ${tool === t ? 'active' : ''}`} onClick={() => { if (t === 'split') splitSelected(); else if (t === 'merge') mergeSelected(); else if (t === 'wall') addWall(); else if (t === 'door') addOpening('door'); else if (t === 'window') addOpening('window'); else if (t === 'beam') addBeam(); else if (t === 'service') addService(); else if (t === 'annotate') { setAnnotationDraft(''); setAnnotationDialogOpen(true); } else setTool(t); }}>
                  {label}
                </button>
              ))}
            </div>
            {annotationDialogOpen && <div className="annotation-dialog" role="dialog" aria-label="Add annotation"><label htmlFor="annotation-text">Annotation</label><input id="annotation-text" autoFocus value={annotationDraft} onChange={(e) => setAnnotationDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && annotationDraft.trim()) { addAnnotation(annotationDraft.trim()); setAnnotationDialogOpen(false); } if (e.key === 'Escape') setAnnotationDialogOpen(false); }} /><div><button type="button" onClick={() => setAnnotationDialogOpen(false)}>Cancel</button><button type="button" disabled={!annotationDraft.trim()} onClick={() => { addAnnotation(annotationDraft.trim()); setAnnotationDialogOpen(false); }}>Add annotation</button></div></div>}
            <svg ref={svgRef} className="plan-canvas" viewBox={`0 0 ${view.w} ${view.h}`} onClick={onCanvasClick}>
              {layers.rooms && rooms.filter(r => r.included !== false).map(r => {
                const pts = r.polygon.map(p => { const q = toPx(p); return `${q.x},${q.y}`; }).join(' ');
                return <polygon key={r.id} points={pts} fill={selectedRoom === r.id ? 'rgba(197,156,45,.18)' : 'rgba(120,92,64,.10)'} stroke={selectedRoom === r.id ? 'var(--gold)' : '#7a5c3a'} strokeWidth={selectedRoom === r.id ? 2.5 : 1.5} onClick={(e) => { e.stopPropagation(); setSelectedRoom(r.id); }} />;
              })}
              {layers.walls && walls.map(w => { const a = toPx(w.start), b = toPx(w.end); return <line key={w.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={selectedWall === w.id ? 'var(--gold)' : '#2b2b2b'} strokeWidth={selectedWall === w.id ? 5 : 3} onClick={(e) => { e.stopPropagation(); setSelectedWall(w.id); setSelectedRoom(null); }} />; })}
              {layers.openings && openings.map(o => { const w = walls.find(x => x.id === o.wallId); if (!w) return null; const a = toPx(w.start), b = toPx(w.end); const t = (o.offsetAlongWallMm) / (wallLen(w) || 1); const px = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; const col = o.kind === 'door' ? '#c97b2c' : '#2f6fb0'; return <rect key={o.id} x={px.x - 4} y={px.y - 4} width={8} height={8} fill={col} stroke="#fff" strokeWidth={1} />; })}
              {layers.columns && columns.map(c => { const p = toPx(c.position); return <rect key={c.id} x={p.x - 5} y={p.y - 5} width={10} height={10} fill="#444" stroke="#fff" />; })}
              {layers.beams && beams.map(b => { const a = toPx(b.start), e2 = toPx(b.end); return <line key={b.id} x1={a.x} y1={a.y} x2={e2.x} y2={e2.y} stroke="#9b59b6" strokeWidth={3} strokeDasharray="4 3" />; })}
              {layers.services && services.map(s => { const p = toPx(s.position); return <circle key={s.id} cx={p.x} cy={p.y} r={5} fill="#27ae60" stroke="#fff" />; })}
              {layers.annotations && annotations.map(a => { if (!a.position) return null; const p = toPx(a.position); return <text key={a.id} x={p.x} y={p.y} fontSize={10} fill="#7a3b00">{a.text}</text>; })}
              {measureFrom && measureTo && (() => { const a = toPx(measureFrom), b = toPx(measureTo); const d = Math.hypot(measureTo.xMm - measureFrom.xMm, measureTo.yMm - measureFrom.yMm); return <g><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="red" strokeWidth={2} /><text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6} fontSize={11} fill="red">{(d / 1000).toFixed(2)} m</text></g>; })()}
            </svg>
            {measureFrom && !measureTo && <div className="measure-hint">Click a second point to measure.</div>}
            {!scaleVerified && <div className="scale-warn"><TriangleAlert size={13} /> Scale not verified — dimensions are approximate.</div>}
          </section>

          {/* Region: Layer controls */}
          <aside className="region layers-region">
            <div className="region-title"><Layers size={14} /> Layers</div>
            {Object.entries(layers).map(([k, v]) => (
              <button key={k} className="layer-row" onClick={() => setLayers(l => ({ ...l, [k]: !l[k as keyof typeof l] }))}>
                {v ? <Eye size={14} /> : <EyeOff size={14} />} {k}
              </button>
            ))}
          </aside>

          {/* Region: Properties (room / wall) */}
          <aside className="region props-region">
            <div className="region-title"><Edit3 size={14} /> Properties</div>
            {sel ? (
              <div className="props-body">
                <label>Room name</label><input value={sel.room.name} onChange={(e) => setRooms(rs => rs.map(r => r.id === sel.room.id ? { ...r, name: e.target.value } : r))} />
                <label>Type</label>
                <select value={sel.room.roomType} onChange={(e) => setRoomType(sel.room.id, e.target.value)}>{Object.entries(ROOM_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <label>Ceiling height (mm)</label>
                <input type="number" value={sel.room.ceilingHeightMm ?? ceilingHeightMm} onChange={(e) => setRoomCeiling(sel.room.id, parseInt(e.target.value, 10) || ceilingHeightMm)} />
                <div className="props-read">
                  <div><span>Dimensions</span><strong>{((sel.widthMm) / 1000).toFixed(2)}m × {((sel.depthMm) / 1000).toFixed(2)}m</strong></div>
                  <div><span>Area</span><strong>{sel.room.areaSqm.toFixed(1)} m²</strong></div>
                  <div><span>Usable wall</span><strong>{sel.usable.usableWallMm} mm</strong></div>
                  <div><span>Deductions</span><strong>{sel.usable.deductionsMm} mm</strong></div>
                </div>
                <Button variant="outline" onClick={() => persistRoom(sel.room)}><Save size={13} /> Save room</Button>
              </div>
            ) : selectedWall ? (
              <div className="props-body">
                <label>Selected wall</label>
                <div className="wall-id">{selectedWall}</div>
                <div className="props-read"><div><span>Length</span><strong>{Math.round(wallLen(walls.find(w => w.id === selectedWall)!))} mm</strong></div></div>
              </div>
            ) : <div className="props-empty">Select a room or wall.</div>}
          </aside>

          {/* Region: AI findings */}
          <aside className="region ai-region">
            <div className="region-title"><Sparkles size={14} /> AI Findings</div>
            {annotations.length ? annotations.map(a => <div key={a.id} className="finding"><MapPin size={12} /> {a.text}</div>) : <div className="empty-note">No AI annotations.</div>}
          </aside>

          {/* Region: Geometry issues */}
          <aside className="region issues-region">
            <div className="region-title"><TriangleAlert size={14} /> Geometry Issues</div>
            {issues.length ? issues.map((i, idx) => <div key={idx} className={`issue ${i.severity}`}><AlertTriangle size={12} /> {i.code} — {i.message}</div>) : <div className="empty-note">No blocking geometry issues.</div>}
          </aside>

          {/* Region: Readiness state */}
          <aside className="region readiness-region">
            <div className="region-title"><CheckCircle2 size={14} /> Readiness</div>
            <div className="readiness-summary">
              <div className={overallReadiness.approved ? 'ok' : 'bad'}>{overallReadiness.approved ? 'All rooms ready' : `${overallReadiness.blockedRooms.length} room(s) blocked`}</div>
              {roomMetrics.map(m => <div key={m.room.id} className="readiness-room"><CheckCircle2 size={12} color={m.readiness.ready ? '#2e9e4f' : '#c0392b'} /> {m.room.name}</div>)}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
