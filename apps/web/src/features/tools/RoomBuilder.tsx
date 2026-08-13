import { ArrowRight, Download, DoorOpen, Save, Sparkles, Upload, PanelsTopLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './room-builder.css';

type OpeningKind = 'door' | 'window';
type Opening = { id: string; kind: OpeningKind; wall: 'north' | 'east' | 'south' | 'west'; offsetMm: number; widthMm: number; sillMm?: number; headMm?: number };
type RoomDraft = {
  schema: 'ultida.room-builder.v1';
  updatedAt: string;
  name: string;
  roomType: string;
  widthMm: number;
  depthMm: number;
  ceilingHeightMm: number;
  floorFinish: string;
  ceilingIntent: string;
  camera: string;
  openings: Opening[];
};

const STORAGE_KEY = 'ultida.room-builder.v1';
const roomTypes = ['Living room', 'Kitchen', 'Master bedroom', 'Bedroom', 'Study', 'Pooja room', 'Dining', 'Utility', 'Other'];

function safeNumber(value: number, fallback: number) { return Number.isFinite(value) && value > 0 ? value : fallback; }

/** A local-first measured room draft. It never creates production geometry by itself. */
export function RoomBuilder() {
  const navigate = useNavigate();
  const [name, setName] = useState('New room');
  const [roomType, setRoomType] = useState('Living room');
  const [widthMm, setWidthMm] = useState(4200);
  const [depthMm, setDepthMm] = useState(3600);
  const [ceilingHeightMm, setCeilingHeightMm] = useState(2700);
  const [floorFinish, setFloorFinish] = useState('Matte tile');
  const [ceilingIntent, setCeilingIntent] = useState('Simple false ceiling');
  const [camera, setCamera] = useState('Wide corner from entry');
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [message, setMessage] = useState('This local room draft is ready to measure and save.');

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<RoomDraft> | null;
      if (!saved || saved.schema !== 'ultida.room-builder.v1') return;
      setName(saved.name ?? 'New room'); setRoomType(saved.roomType ?? 'Living room');
      setWidthMm(safeNumber(Number(saved.widthMm), 4200)); setDepthMm(safeNumber(Number(saved.depthMm), 3600));
      setCeilingHeightMm(safeNumber(Number(saved.ceilingHeightMm), 2700)); setFloorFinish(saved.floorFinish ?? 'Matte tile');
      setCeilingIntent(saved.ceilingIntent ?? 'Simple false ceiling'); setCamera(saved.camera ?? 'Wide corner from entry');
      setOpenings(Array.isArray(saved.openings) ? saved.openings.filter((item) => item && (item.kind === 'door' || item.kind === 'window')) as Opening[] : []);
      setMessage('Restored your local room draft.');
    } catch { window.localStorage.removeItem(STORAGE_KEY); }
  }, []);

  const draft = useMemo<RoomDraft>(() => ({
    schema: 'ultida.room-builder.v1', updatedAt: new Date().toISOString(), name: name.trim() || 'Untitled room', roomType,
    widthMm: safeNumber(widthMm, 1), depthMm: safeNumber(depthMm, 1), ceilingHeightMm: safeNumber(ceilingHeightMm, 1),
    floorFinish: floorFinish.trim(), ceilingIntent: ceilingIntent.trim(), camera: camera.trim(), openings,
  }), [name, roomType, widthMm, depthMm, ceilingHeightMm, floorFinish, ceilingIntent, camera, openings]);
  const valid = draft.widthMm >= 600 && draft.depthMm >= 600 && draft.ceilingHeightMm >= 1800 && openings.every((opening) => opening.widthMm >= 300 && opening.offsetMm >= 0);
  const areaSqm = Math.round((draft.widthMm * draft.depthMm / 1_000_000) * 100) / 100;
  const maxWall = Math.max(draft.widthMm, draft.depthMm);

  function saveLocal() {
    if (!valid) { setMessage('Use practical room dimensions before saving the draft.'); return; }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setMessage('Saved locally. Choose a project when you want to continue this room into its verified workflow.');
  }
  function download() {
    if (!valid) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `${draft.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'ultida-room'}-draft.json`; link.click(); URL.revokeObjectURL(url);
    setMessage('Measured room draft downloaded. It remains Initial Design evidence until attached and approved in a project.');
  }
  function addOpening(kind: OpeningKind) {
    setOpenings((items) => [...items, { id: crypto.randomUUID(), kind, wall: 'north', offsetMm: 600, widthMm: kind === 'door' ? 900 : 1200, ...(kind === 'window' ? { sillMm: 900, headMm: 2100 } : {}) }]);
  }
  function updateOpening(id: string, patch: Partial<Opening>) { setOpenings((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item)); }
  function continueToProject() {
    if (!valid) { setMessage('Complete the measured room first.'); return; }
    window.localStorage.setItem('ultida.pendingRoomDraft.v1', JSON.stringify(draft));
    navigate('/projects?attachRoom=1');
  }

  return <main className="room-builder">
    <section className="room-builder-hero">
      <div><p>ROOM BUILDER</p><h1>Create a measured room without waiting for AI.</h1><span>Use this for a quick client demo, incomplete plan, or a room you already measured. The room remains clearly marked Initial Design until it is brought into an approved project plan.</span></div>
      <div className="room-builder-stats"><strong>{areaSqm} m²</strong><small>{draft.widthMm} × {draft.depthMm} × {draft.ceilingHeightMm} mm</small></div>
    </section>
    <div className="room-builder-layout">
      <section className="room-builder-card room-builder-form">
        <div className="room-builder-step"><span>1</span><div><strong>Measured geometry</strong><small>All values are stored in millimetres.</small></div></div>
        <div className="room-builder-grid">
          <label>Room name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Room type<select value={roomType} onChange={(event) => setRoomType(event.target.value)}>{roomTypes.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
          <label>Width (mm)<input type="number" min="600" value={widthMm} onChange={(event) => setWidthMm(Number(event.target.value))} /></label>
          <label>Depth (mm)<input type="number" min="600" value={depthMm} onChange={(event) => setDepthMm(Number(event.target.value))} /></label>
          <label>Ceiling height (mm)<input type="number" min="1800" value={ceilingHeightMm} onChange={(event) => setCeilingHeightMm(Number(event.target.value))} /></label>
        </div>
        <div className="room-builder-step"><span>2</span><div><strong>Openings and fixed context</strong><small>Add only the openings you can see or measure.</small></div></div>
        <div className="opening-actions"><button type="button" onClick={() => addOpening('door')}><DoorOpen size={15} /> Add door</button><button type="button" onClick={() => addOpening('window')}><PanelsTopLeft size={15} /> Add window</button></div>
        {openings.length ? <div className="opening-list">{openings.map((opening) => <div className="opening-row" key={opening.id}><strong>{opening.kind === 'door' ? 'Door' : 'Window'}</strong><label>Wall<select value={opening.wall} onChange={(event) => updateOpening(opening.id, { wall: event.target.value as Opening['wall'] })}>{['north','east','south','west'].map((wall) => <option key={wall} value={wall}>{wall}</option>)}</select></label><label>Offset<input type="number" min="0" max={maxWall} value={opening.offsetMm} onChange={(event) => updateOpening(opening.id, { offsetMm: Number(event.target.value) })} /></label><label>Width<input type="number" min="300" value={opening.widthMm} onChange={(event) => updateOpening(opening.id, { widthMm: Number(event.target.value) })} /></label>{opening.kind === 'window' && <><label>Sill<input type="number" min="0" value={opening.sillMm ?? 900} onChange={(event) => updateOpening(opening.id, { sillMm: Number(event.target.value) })} /></label><label>Head<input type="number" min="1" value={opening.headMm ?? 2100} onChange={(event) => updateOpening(opening.id, { headMm: Number(event.target.value) })} /></label></>}<button type="button" className="opening-remove" onClick={() => setOpenings((items) => items.filter((item) => item.id !== opening.id))}>Remove</button></div>)}</div> : <p className="room-builder-empty">No openings added. You can add them now or finish them later in the Plan Tracer.</p>}
        <div className="room-builder-step"><span>3</span><div><strong>Scene intent</strong><small>These guide later layouts and renders; they do not change the measured shell.</small></div></div>
        <div className="room-builder-grid"><label>Floor finish<input value={floorFinish} onChange={(event) => setFloorFinish(event.target.value)} /></label><label>Ceiling intent<input value={ceilingIntent} onChange={(event) => setCeilingIntent(event.target.value)} /></label><label className="span-2">Preferred camera<input value={camera} onChange={(event) => setCamera(event.target.value)} /></label></div>
      </section>
      <aside className="room-builder-card room-builder-preview"><div className="preview-heading"><div><p>DETERMINISTIC SHELL PREVIEW</p><h2>{draft.name}</h2></div><Sparkles size={19} /></div><svg viewBox="0 0 420 300" role="img" aria-label="Measured room shell preview"><polygon points="54,95 255,35 370,96 160,167" className="shell-ceiling" /><polygon points="54,95 160,167 160,270 54,195" className="shell-left" /><polygon points="160,167 370,96 370,195 160,270" className="shell-right" /><polygon points="54,195 160,270 370,195 255,135" className="shell-floor" /><line x1="54" y1="195" x2="370" y2="195" className="shell-line" />{openings.filter((opening) => opening.kind === 'door').slice(0, 2).map((opening, index) => <rect key={opening.id} x={190 + index * 55} y={185} width="36" height="60" className="shell-door" />)}{openings.filter((opening) => opening.kind === 'window').slice(0, 2).map((opening, index) => <rect key={opening.id} x={266 + index * 40} y={134} width="30" height="25" className="shell-window" />)}<text x="210" y="288" textAnchor="middle">{draft.widthMm} W × {draft.depthMm} D × {draft.ceilingHeightMm} H mm</text></svg><div className="preview-notes"><span>Floor: {draft.floorFinish || 'Not selected'}</span><span>Ceiling: {draft.ceilingIntent || 'Not selected'}</span><span>Camera: {draft.camera || 'Not selected'}</span></div><div className="room-builder-actions"><button type="button" onClick={saveLocal} disabled={!valid}><Save size={15} /> Save offline draft</button><button type="button" onClick={download} disabled={!valid}><Download size={15} /> Download JSON</button><button type="button" className="primary" onClick={continueToProject} disabled={!valid}><Upload size={15} /> Attach to project <ArrowRight size={15} /></button></div><p role="status" className="room-builder-message">{message}</p></aside>
    </div>
  </main>;
}
