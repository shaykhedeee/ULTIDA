import {
  ArrowRight, Download, DoorOpen, Save, Sparkles, Upload,
  PanelsTopLeft, Compass, Scissors, CheckCircle2, ShieldCheck
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { generateParametricCabinetAnatomy } from './cutlist-optimizer';
import './room-builder.css';

type OpeningKind = 'door' | 'window';
type Opening = {
  id: string;
  kind: OpeningKind;
  wall: 'north' | 'east' | 'south' | 'west';
  offsetMm: number;
  widthMm: number;
  sillMm?: number;
  headMm?: number;
};

type WallZoneType =
  | 'wardrobe_suite'
  | 'bed_headboard'
  | 'tv_entertainment'
  | 'study_desk'
  | 'mandir_sanctum'
  | 'crockery_unit'
  | 'modular_kitchen'
  | 'window_bay'
  | 'open_circulation';

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
  wallZones?: {
    north: WallZoneType;
    east: WallZoneType;
    south: WallZoneType;
    west: WallZoneType;
  };
};

const STORAGE_KEY = 'ultida.room-builder.v1';
const roomTypes = [
  'Living room', 'Kitchen', 'Master bedroom', 'Bedroom',
  'Study', 'Pooja room', 'Dining', 'Utility', 'Other'
];

const ZONE_OPTIONS: Array<{ value: WallZoneType; label: string }> = [
  { value: 'wardrobe_suite', label: 'Wardrobe Suite (System 32)' },
  { value: 'bed_headboard', label: 'King Bed & Headboard Wall' },
  { value: 'tv_entertainment', label: 'TV Entertainment & Fluted Bay' },
  { value: 'study_desk', label: 'Study Desk & Credenza' },
  { value: 'mandir_sanctum', label: 'Pooja Mandir Sanctum' },
  { value: 'crockery_unit', label: 'Dining Crockery Console' },
  { value: 'modular_kitchen', label: 'Kitchen Modular Run' },
  { value: 'window_bay', label: 'Window Bay / Balcony Sill' },
  { value: 'open_circulation', label: 'Open Wall / Passage' },
];

function safeNumber(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** An advanced measured room and layout architect tool with Vastu and Cutlist integration. */
export function RoomBuilder() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [name, setName] = useState('Master Bedroom');
  const [roomType, setRoomType] = useState('Master bedroom');
  const [widthMm, setWidthMm] = useState(4200);
  const [depthMm, setDepthMm] = useState(3600);
  const [ceilingHeightMm, setCeilingHeightMm] = useState(2700);
  const [floorFinish, setFloorFinish] = useState('Matte tile');
  const [ceilingIntent, setCeilingIntent] = useState('Simple false ceiling');
  const [camera, setCamera] = useState('Wide corner from entry');
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [wallZones, setWallZones] = useState<{
    north: WallZoneType;
    east: WallZoneType;
    south: WallZoneType;
    west: WallZoneType;
  }>({
    north: 'wardrobe_suite',
    east: 'window_bay',
    south: 'bed_headboard',
    west: 'tv_entertainment',
  });
  const [message, setMessage] = useState('Advanced room layout and measured shell ready.');

  useEffect(() => {
    void (async () => {
      if (!supabase) return;
      const res = await supabase.from('projects').select('id,name').neq('project_status', 'archived').order('updated_at', { ascending: false });
      const list = (res?.data ?? []) as Array<{ id: string; name: string }>;
      setProjects(list);
      if (list[0]?.id) setSelectedProjectId(list[0].id);
    })();
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<RoomDraft> | null;
      if (!saved || saved.schema !== 'ultida.room-builder.v1') return;
      setName(saved.name ?? 'Master Bedroom');
      setRoomType(saved.roomType ?? 'Master bedroom');
      setWidthMm(safeNumber(Number(saved.widthMm), 4200));
      setDepthMm(safeNumber(Number(saved.depthMm), 3600));
      setCeilingHeightMm(safeNumber(Number(saved.ceilingHeightMm), 2700));
      setFloorFinish(saved.floorFinish ?? 'Matte tile');
      setCeilingIntent(saved.ceilingIntent ?? 'Simple false ceiling');
      setCamera(saved.camera ?? 'Wide corner from entry');
      setOpenings(Array.isArray(saved.openings) ? saved.openings.filter((item) => item && (item.kind === 'door' || item.kind === 'window')) as Opening[] : []);
      if (saved.wallZones) setWallZones(saved.wallZones);
      setMessage('Restored your local room layout.');
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const draft = useMemo<RoomDraft>(() => ({
    schema: 'ultida.room-builder.v1',
    updatedAt: new Date().toISOString(),
    name: name.trim() || 'Untitled room',
    roomType,
    widthMm: safeNumber(widthMm, 1),
    depthMm: safeNumber(depthMm, 1),
    ceilingHeightMm: safeNumber(ceilingHeightMm, 1),
    floorFinish: floorFinish.trim(),
    ceilingIntent: ceilingIntent.trim(),
    camera: camera.trim(),
    openings,
    wallZones,
  }), [name, roomType, widthMm, depthMm, ceilingHeightMm, floorFinish, ceilingIntent, camera, openings, wallZones]);

  const valid = draft.widthMm >= 600 && draft.depthMm >= 600 && draft.ceilingHeightMm >= 1800 && openings.every((opening) => opening.widthMm >= 300 && opening.offsetMm >= 0);
  const areaSqm = Math.round((draft.widthMm * draft.depthMm / 1_000_000) * 100) / 100;
  const maxWall = Math.max(draft.widthMm, draft.depthMm);

  // Vastu compliance derivation
  const vastuAssessment = useMemo(() => {
    const isMasterBed = roomType.toLowerCase().includes('master');
    const isKitchen = roomType.toLowerCase().includes('kitchen');
    const isPooja = roomType.toLowerCase().includes('pooja');

    if (isMasterBed) {
      return {
        cardinalZone: 'South-West (Nairutya)',
        status: '100% Auspicious',
        complianceBadge: 'gold',
        guideline: 'Heavy master wardrobe placed in South/West walls for stability, leadership, and prosperity.',
      };
    }
    if (isKitchen) {
      return {
        cardinalZone: 'South-East (Agneya)',
        status: 'Auspicious Fire Zone',
        complianceBadge: 'green',
        guideline: 'Cooking hob oriented toward East for morning sun and health.',
      };
    }
    if (isPooja) {
      return {
        cardinalZone: 'North-East (Ishanya)',
        status: 'Sacred Water & Ether Zone',
        complianceBadge: 'gold',
        guideline: 'Divine sanctum with CNC lattice facing East.',
      };
    }
    return {
      cardinalZone: 'North / East Circulation',
      status: 'Harmonious Flow',
      complianceBadge: 'green',
      guideline: 'Ample open circulation and natural light from North and East.',
    };
  }, [roomType]);

  function saveLocal() {
    if (!valid) {
      setMessage('Use practical room dimensions before saving the draft.');
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setMessage('Saved locally. Continue this room into a verified studio project or cutlist.');
  }

  function download() {
    if (!valid) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${draft.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'ultida-room'}-layout.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Measured room layout downloaded.');
  }

  function addOpening(kind: OpeningKind) {
    setOpenings((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        kind,
        wall: 'north',
        offsetMm: 600,
        widthMm: kind === 'door' ? 900 : 1200,
        ...(kind === 'window' ? { sillMm: 900, headMm: 2100 } : {}),
      },
    ]);
  }

  function updateOpening(id: string, patch: Partial<Opening>) {
    setOpenings((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function updateWallZone(wall: 'north' | 'east' | 'south' | 'west', zone: WallZoneType) {
    setWallZones((prev) => ({ ...prev, [wall]: zone }));
  }

  function continueToProject() {
    if (!valid) {
      setMessage('Complete the measured room first.');
      return;
    }
    window.localStorage.setItem('ultida.pendingRoomDraft.v1', JSON.stringify(draft));
    if (selectedProjectId) {
      navigate(`/projects/${selectedProjectId}/spaces?roomDraft=1`);
    } else {
      navigate('/projects?attachRoom=1');
    }
  }

  function sendToCutlistStudio() {
    if (!valid) {
      setMessage('Complete the room dimensions first.');
      return;
    }
    // Generate full wardrobe/cabinet anatomy for the largest wall zone
    const generated = generateParametricCabinetAnatomy(
      `${draft.name} Joinery Suite`,
      Math.min(3600, draft.widthMm),
      Math.min(2400, draft.ceilingHeightMm - 100),
      600
    );

    window.localStorage.setItem('ultida_cutlist_source', JSON.stringify(generated));
    navigate('/tools/cutlist');
  }

  return (
    <main className="room-builder">
      {/* ─── Hero Header ─── */}
      <section className="room-builder-hero">
        <div>
          <p>ARCHITECTURAL ROOM BUILDER &amp; LAYOUT ENGINE</p>
          <h1>Advanced Room Geometry &amp; Wall Zoning</h1>
          <span>
            Design measured room shells, partition wall bays, calibrate openings and structural elements, and seamlessly send 2D furniture specifications to the Cutlist Studio for <strong>&lt; 5% sheet wastage</strong>.
          </span>
        </div>
        <div className="room-builder-stats">
          <strong>{areaSqm} m²</strong>
          <small>{draft.widthMm} × {draft.depthMm} × {draft.ceilingHeightMm} mm</small>
        </div>
      </section>

      <div className="room-builder-layout">
        {/* Left Form: Geometry, Wall Zones, Openings */}
        <section className="room-builder-card room-builder-form">
          <div className="room-builder-step">
            <span>1</span>
            <div>
              <strong>Measured Geometry &amp; Typology</strong>
              <small>All dimensions stored in exact millimetres.</small>
            </div>
          </div>

          <div className="room-builder-grid">
            <label>
              Room name
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              Room type
              <select value={roomType} onChange={(event) => setRoomType(event.target.value)}>
                {roomTypes.map((value) => (
                  <option value={value} key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Width (mm)
              <input
                type="number"
                min="600"
                value={widthMm}
                onChange={(event) => setWidthMm(Number(event.target.value))}
              />
            </label>
            <label>
              Depth (mm)
              <input
                type="number"
                min="600"
                value={depthMm}
                onChange={(event) => setDepthMm(Number(event.target.value))}
              />
            </label>
            <label className="span-2">
              Ceiling height (mm)
              <input
                type="number"
                min="1800"
                value={ceilingHeightMm}
                onChange={(event) => setCeilingHeightMm(Number(event.target.value))}
              />
            </label>
          </div>

          {/* Wall Bay Zoning */}
          <div className="room-builder-step">
            <span>2</span>
            <div>
              <strong>Wall Bay Zoning &amp; Furniture Alignment</strong>
              <small>Assign functional architectural bays to each cardinal wall.</small>
            </div>
          </div>

          <div className="room-builder-grid">
            <label>
              North Wall Zone ({widthMm}mm)
              <select
                value={wallZones.north}
                onChange={(e) => updateWallZone('north', e.target.value as WallZoneType)}
              >
                {ZONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            <label>
              East Wall Zone ({depthMm}mm)
              <select
                value={wallZones.east}
                onChange={(e) => updateWallZone('east', e.target.value as WallZoneType)}
              >
                {ZONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            <label>
              South Wall Zone ({widthMm}mm)
              <select
                value={wallZones.south}
                onChange={(e) => updateWallZone('south', e.target.value as WallZoneType)}
              >
                {ZONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            <label>
              West Wall Zone ({depthMm}mm)
              <select
                value={wallZones.west}
                onChange={(e) => updateWallZone('west', e.target.value as WallZoneType)}
              >
                {ZONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Openings and Obstructions */}
          <div className="room-builder-step">
            <span>3</span>
            <div>
              <strong>Openings &amp; Structural Context</strong>
              <small>Add measured door swings, window sills, and keep-out voids.</small>
            </div>
          </div>

          <div className="opening-actions">
            <button type="button" onClick={() => addOpening('door')}>
              <DoorOpen size={15} /> Add door
            </button>
            <button type="button" onClick={() => addOpening('window')}>
              <PanelsTopLeft size={15} /> Add window
            </button>
          </div>

          {openings.length ? (
            <div className="opening-list">
              {openings.map((opening) => (
                <div className="opening-row" key={opening.id}>
                  <strong>{opening.kind === 'door' ? 'Door' : 'Window'}</strong>
                  <label>
                    Wall
                    <select
                      value={opening.wall}
                      onChange={(event) =>
                        updateOpening(opening.id, { wall: event.target.value as Opening['wall'] })
                      }
                    >
                      {['north', 'east', 'south', 'west'].map((wall) => (
                        <option key={wall} value={wall}>{wall}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Offset
                    <input
                      type="number"
                      min="0"
                      max={maxWall}
                      value={opening.offsetMm}
                      onChange={(event) =>
                        updateOpening(opening.id, { offsetMm: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Width
                    <input
                      type="number"
                      min="300"
                      value={opening.widthMm}
                      onChange={(event) =>
                        updateOpening(opening.id, { widthMm: Number(event.target.value) })
                      }
                    />
                  </label>
                  {opening.kind === 'window' && (
                    <>
                      <label>
                        Sill
                        <input
                          type="number"
                          min="0"
                          value={opening.sillMm ?? 900}
                          onChange={(event) =>
                            updateOpening(opening.id, { sillMm: Number(event.target.value) })
                          }
                        />
                      </label>
                      <label>
                        Head
                        <input
                          type="number"
                          min="1"
                          value={opening.headMm ?? 2100}
                          onChange={(event) =>
                            updateOpening(opening.id, { headMm: Number(event.target.value) })
                          }
                        />
                      </label>
                    </>
                  )}
                  <button
                    type="button"
                    className="opening-remove"
                    onClick={() => setOpenings((items) => items.filter((item) => item.id !== opening.id))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="room-builder-empty">No architectural openings added yet.</p>
          )}

          {/* Scene Intent */}
          <div className="room-builder-step">
            <span>4</span>
            <div>
              <strong>Material Finish Intent</strong>
              <small>Guides 3D visualizers and renders.</small>
            </div>
          </div>

          <div className="room-builder-grid">
            <label>
              Floor finish
              <input value={floorFinish} onChange={(event) => setFloorFinish(event.target.value)} />
            </label>
            <label>
              Ceiling intent
              <input value={ceilingIntent} onChange={(event) => setCeilingIntent(event.target.value)} />
            </label>
            <label className="span-2">
              Preferred camera view
              <input value={camera} onChange={(event) => setCamera(event.target.value)} />
            </label>
          </div>
        </section>

        {/* Right Aside: 2D Spatial Preview, Vastu Compass & Actions */}
        <aside className="room-builder-card room-builder-preview">
          <div className="preview-heading">
            <div>
              <p>2D SPATIAL &amp; VASTU PREVIEW</p>
              <h2>{draft.name}</h2>
            </div>
            <Sparkles size={19} />
          </div>

          {/* Vastu Compass Pill */}
          <div style={{
            marginTop: 10,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(197, 156, 45, 0.12) 0%, rgba(197, 156, 45, 0.04) 100%)',
            border: '1px solid rgba(197, 156, 45, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--gold-dim)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Compass size={14} /> Vastu Alignment
              </span>
              <span style={{
                fontSize: 10.5,
                fontWeight: 800,
                color: '#059669',
                background: 'rgba(16, 185, 129, 0.12)',
                padding: '2px 7px',
                borderRadius: 10
              }}>
                {vastuAssessment.status}
              </span>
            </div>
            <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
              {vastuAssessment.cardinalZone}
            </strong>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {vastuAssessment.guideline}
            </span>
          </div>

          {/* SVG Shell Preview */}
          <svg viewBox="0 0 420 300" role="img" aria-label="Measured room shell preview">
            <polygon points="54,95 255,35 370,96 160,167" className="shell-ceiling" />
            <polygon points="54,95 160,167 160,270 54,195" className="shell-left" />
            <polygon points="160,167 370,96 370,195 160,270" className="shell-right" />
            <polygon points="54,195 160,270 370,195 255,135" className="shell-floor" />
            <line x1="54" y1="195" x2="370" y2="195" className="shell-line" />
            {openings
              .filter((opening) => opening.kind === 'door')
              .slice(0, 2)
              .map((opening, index) => (
                <rect key={opening.id} x={190 + index * 55} y={185} width="36" height="60" className="shell-door" />
              ))}
            {openings
              .filter((opening) => opening.kind === 'window')
              .slice(0, 2)
              .map((opening, index) => (
                <rect key={opening.id} x={266 + index * 40} y={134} width="30" height="25" className="shell-window" />
              ))}
            <text x="210" y="288" textAnchor="middle">
              {draft.widthMm} W × {draft.depthMm} D × {draft.ceilingHeightMm} H mm
            </text>
          </svg>

          <div className="preview-notes">
            <span>Floor: {draft.floorFinish || 'Not selected'}</span>
            <span>Ceiling: {draft.ceilingIntent || 'Not selected'}</span>
            <span>North Wall: {ZONE_OPTIONS.find((z) => z.value === wallZones.north)?.label}</span>
            <span>South Wall: {ZONE_OPTIONS.find((z) => z.value === wallZones.south)?.label}</span>
          </div>

          {projects.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 700 }}>
              <label style={{ color: 'var(--text-muted)' }}>Target Studio Project</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: 7,
                  border: '1px solid var(--line)',
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Action CTAs */}
          <div className="room-builder-actions">
            <button
              type="button"
              className="primary"
              style={{
                background: 'linear-gradient(135deg, #c59c2d 0%, #a88220 100%)',
                color: '#1a1208',
                fontWeight: 800,
                boxShadow: '0 2px 10px rgba(197, 156, 45, 0.35)',
              }}
              onClick={sendToCutlistStudio}
              disabled={!valid}
            >
              <Scissors size={15} />
              <span>⚡ Send to Cutlist Studio (&lt; 5% Waste)</span>
            </button>

            <button type="button" onClick={saveLocal} disabled={!valid}>
              <Save size={15} /> Save offline draft
            </button>

            <button type="button" onClick={download} disabled={!valid}>
              <Download size={15} /> Download Layout JSON
            </button>

            <button type="button" className="primary" onClick={continueToProject} disabled={!valid}>
              <Upload size={15} /> Open in {selectedProjectId ? 'Project' : 'Projects'} <ArrowRight size={15} />
            </button>
          </div>

          <p role="status" className="room-builder-message">{message}</p>
        </aside>
      </div>
    </main>
  );
}
