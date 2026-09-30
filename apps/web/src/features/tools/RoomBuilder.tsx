import {
  ArrowRight, Download, DoorOpen, Save, Sparkles, Upload,
  PanelsTopLeft, Compass, CheckCircle2, ShieldCheck, Columns3, LayoutGrid, Layers
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { roomBuilderGeometryIssues, usableWallRunMm, type RoomBuilderOpening } from './room-builder-geometry';
import './room-builder.css';

type OpeningKind = 'door' | 'window' | 'structural_column';
type Opening = {
  id: string;
  kind: OpeningKind;
  wall: 'north' | 'east' | 'south' | 'west';
  offsetMm: number;
  widthMm: number;
  depthMm?: number;
  heightMm?: number;
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
  wallThicknessMm?: number;
  floorFinish: string;
  ceilingIntent: string;
  camera: string;
  openings: Opening[];
  dimensionsConfirmed?: boolean;
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

const ZONE_COLORS: Record<WallZoneType, { fill: string; stroke: string; labelColor: string; shortLabel: string }> = {
  wardrobe_suite: { fill: 'rgba(197, 156, 45, 0.28)', stroke: '#c59c2d', labelColor: '#855e0c', shortLabel: 'Wardrobe Bay' },
  bed_headboard: { fill: 'rgba(99, 102, 241, 0.22)', stroke: '#6366f1', labelColor: '#3730a3', shortLabel: 'Bed Headboard' },
  tv_entertainment: { fill: 'rgba(6, 182, 212, 0.22)', stroke: '#06b6d4', labelColor: '#0e7490', shortLabel: 'TV Media Unit' },
  study_desk: { fill: 'rgba(16, 185, 129, 0.22)', stroke: '#10b981', labelColor: '#065f46', shortLabel: 'Study / Desk' },
  mandir_sanctum: { fill: 'rgba(249, 115, 22, 0.28)', stroke: '#f97316', labelColor: '#9a3412', shortLabel: 'Mandir Sanctum' },
  crockery_unit: { fill: 'rgba(244, 63, 94, 0.22)', stroke: '#f43f5e', labelColor: '#9f1239', shortLabel: 'Crockery Unit' },
  modular_kitchen: { fill: 'rgba(239, 68, 68, 0.22)', stroke: '#ef4444', labelColor: '#991b1b', shortLabel: 'Kitchen Modular' },
  window_bay: { fill: 'rgba(2, 132, 199, 0.22)', stroke: '#0284c7', labelColor: '#0369a1', shortLabel: 'Window Bay' },
  open_circulation: { fill: 'rgba(148, 163, 184, 0.16)', stroke: '#94a3b8', labelColor: '#475569', shortLabel: 'Open Wall' },
};

/** A local room proposal that must be confirmed before it enters a project. */
export function RoomBuilder() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [name, setName] = useState('Master Bedroom');
  const [roomType, setRoomType] = useState('Master bedroom');
  // A fresh room starts unmeasured. Never prefill example dimensions as if they
  // were surveyed geometry; zero is represented as an empty input in the UI.
  const [widthMm, setWidthMm] = useState(0);
  const [depthMm, setDepthMm] = useState(0);
  const [ceilingHeightMm, setCeilingHeightMm] = useState(0);
  const [wallThicknessMm, setWallThicknessMm] = useState(0);
  const [dimensionsConfirmed, setDimensionsConfirmed] = useState(false);
  const [floorFinish, setFloorFinish] = useState('Matte tile');
  const [ceilingIntent, setCeilingIntent] = useState('Simple false ceiling');
  const [camera, setCamera] = useState('Wide corner from entry');
  const [previewMode, setPreviewMode] = useState<'2d_plan' | '3d_shell'>('2d_plan');
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
  const [message, setMessage] = useState('Review the example dimensions and enter the measured room and opening sizes.');

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
      setWidthMm(Number.isFinite(Number(saved.widthMm)) ? Number(saved.widthMm) : 0);
      setDepthMm(Number.isFinite(Number(saved.depthMm)) ? Number(saved.depthMm) : 0);
      setCeilingHeightMm(Number.isFinite(Number(saved.ceilingHeightMm)) ? Number(saved.ceilingHeightMm) : 0);
      setWallThicknessMm(Number(saved.wallThicknessMm ?? 230));
      setDimensionsConfirmed(saved.dimensionsConfirmed === true);
      setFloorFinish(saved.floorFinish ?? 'Matte tile');
      setCeilingIntent(saved.ceilingIntent ?? 'Simple false ceiling');
      setCamera(saved.camera ?? 'Wide corner from entry');
      setOpenings(Array.isArray(saved.openings) ? saved.openings.filter((item) => item && (item.kind === 'door' || item.kind === 'window' || item.kind === 'structural_column')) as Opening[] : []);
      if (saved.wallZones) setWallZones(saved.wallZones);
      setMessage('Restored your local room proposal. Confirm its dimensions before adding it to a project.');
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const draft = useMemo<RoomDraft>(() => ({
    schema: 'ultida.room-builder.v1',
    updatedAt: new Date().toISOString(),
    name: name.trim() || 'Untitled room',
    roomType,
    widthMm,
    depthMm,
    ceilingHeightMm,
    wallThicknessMm,
    floorFinish: floorFinish.trim(),
    ceilingIntent: ceilingIntent.trim(),
    camera: camera.trim(),
    openings,
    dimensionsConfirmed,
    wallZones,
  }), [name, roomType, widthMm, depthMm, ceilingHeightMm, wallThicknessMm, floorFinish, ceilingIntent, camera, openings, dimensionsConfirmed, wallZones]);

  const geometryIssues = useMemo(() => roomBuilderGeometryIssues(draft, openings as RoomBuilderOpening[]), [draft, openings]);
  const valid = geometryIssues.length === 0;
  const readyForProject = valid && dimensionsConfirmed;
  const areaSqm = Number.isFinite(draft.widthMm * draft.depthMm) ? Math.round((draft.widthMm * draft.depthMm / 1_000_000) * 100) / 100 : 0;
  const maxWall = Math.max(0, draft.widthMm, draft.depthMm);

  // Vastu compliance derivation
  const vastuAssessment = useMemo(() => {
    const isMasterBed = roomType.toLowerCase().includes('master');
    const isKitchen = roomType.toLowerCase().includes('kitchen');
    const isPooja = roomType.toLowerCase().includes('pooja');

    if (isMasterBed) {
      return {
        cardinalZone: 'South-West (Nairutya)',
        status: 'Traditional guideline',
        complianceBadge: 'gold',
        guideline: 'Heavy master wardrobe placed in South/West walls for stability, leadership, and prosperity.',
      };
    }
    if (isKitchen) {
      return {
        cardinalZone: 'South-East (Agneya)',
        status: 'Traditional guideline',
        complianceBadge: 'green',
        guideline: 'Cooking hob oriented toward East for morning sun and health.',
      };
    }
    if (isPooja) {
      return {
        cardinalZone: 'North-East (Ishanya)',
        status: 'Traditional guideline',
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

  // Usable casework length per cardinal wall after subtracting openings and structural columns
  const wallUsableStats = useMemo(() => {
    const calc = (wallKey: 'north' | 'east' | 'south' | 'west', totalMm: number) => {
      const items = openings.filter((o) => o.wall === wallKey);
      const usableMm = usableWallRunMm(totalMm, items);
      const obstructedMm = totalMm - usableMm;
      return { totalMm, obstructedMm, usableMm, openingsCount: items.length, items };
    };
    return {
      north: calc('north', widthMm),
      east: calc('east', depthMm),
      south: calc('south', widthMm),
      west: calc('west', depthMm),
    };
  }, [widthMm, depthMm, openings]);

  // 2D Architectural Floor Plan Layout Calculations
  const planSvg = useMemo(() => {
    const svgW = 440;
    const svgH = 310;
    const pad = 52;
    const maxDrawW = svgW - pad * 2;
    const maxDrawH = svgH - pad * 2;
    const safeWidth = Number.isFinite(widthMm) ? Math.max(0, widthMm) : 0;
    const safeDepth = Number.isFinite(depthMm) ? Math.max(0, depthMm) : 0;
    const scale = Math.min(maxDrawW / Math.max(100, safeWidth), maxDrawH / Math.max(100, safeDepth));
    const roomW = safeWidth * scale;
    const roomH = safeDepth * scale;
    const rx = (svgW - roomW) / 2;
    const ry = (svgH - roomH) / 2;
    const wallThick = Math.max(8, Math.round(wallThicknessMm * scale));
    const zoneThick = Math.max(12, Math.round(450 * scale));

    return {
      svgW,
      svgH,
      rx,
      ry,
      roomW,
      roomH,
      scale,
      wallThick,
      zoneThick,
    };
  }, [widthMm, depthMm, wallThicknessMm]);

  function saveLocal() {
    if (!valid) {
      setMessage('Use practical room dimensions before saving the draft.');
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setMessage(dimensionsConfirmed
      ? 'Room proposal saved locally. Project geometry still needs review and approval.'
      : 'Draft saved locally as an unconfirmed room proposal.');
  }

  function download() {
    if (!valid) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${draft.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'ultida-room'}-layout.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage(dimensionsConfirmed ? 'Room proposal downloaded.' : 'Unconfirmed room proposal downloaded for reference.');
  }

  function addOpening(kind: OpeningKind) {
    setDimensionsConfirmed(false);
    setOpenings((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        kind,
        wall: 'north',
        offsetMm: 0,
        widthMm: 0,
        ...(kind === 'door' ? { heightMm: 0 } : {}),
        ...(kind === 'window' ? { sillMm: 0, headMm: 0 } : {}),
        ...(kind === 'structural_column' ? { depthMm: 0 } : {}),
      },
    ]);
  }

  function updateOpening(id: string, patch: Partial<Opening>) {
    setDimensionsConfirmed(false);
    setOpenings((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function updateWallZone(wall: 'north' | 'east' | 'south' | 'west', zone: WallZoneType) {
    setWallZones((prev) => ({ ...prev, [wall]: zone }));
  }

  function continueToProject() {
    if (!readyForProject) {
      setMessage(!valid ? geometryIssues[0] ?? 'Correct the room geometry first.' : 'Confirm the entered room dimensions before continuing.');
      return;
    }
    window.localStorage.setItem('ultida.pendingRoomDraft.v1', JSON.stringify(draft));
    if (selectedProjectId) {
      navigate(`/projects/${selectedProjectId}/spaces?roomDraft=1`);
    } else {
      navigate('/projects?attachRoom=1');
    }
  }

  return (
    <main className="room-builder">
      {/* ─── Hero Header ─── */}
      <section className="room-builder-hero">
        <div>
          <p>ROOM BUILDER · DESIGN PROPOSAL</p>
          <h1>Set up one room</h1>
          <span>
            Enter room and opening measurements, arrange wall zones, then continue to your project for geometry review. This standalone proposal does not create fabrication drawings or a cutlist.
          </span>
        </div>
        <div className="room-builder-stats">
          <strong>{areaSqm} m²</strong>
          <small>{draft.widthMm || '—'} × {draft.depthMm || '—'} × {draft.ceilingHeightMm || '—'} mm · measured values required</small>
        </div>
      </section>

      <div className="room-builder-layout">
        {/* Left Form: Geometry, Wall Zones, Openings */}
        <section className="room-builder-card room-builder-form">
          <div className="room-builder-step">
            <span>1</span>
            <div>
              <strong>Room dimensions &amp; typology</strong>
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
                value={widthMm || ''}
                onChange={(event) => { setDimensionsConfirmed(false); setWidthMm(event.target.value === '' ? 0 : Number(event.target.value)); }}
              />
            </label>
            <label>
              Depth (mm)
              <input
                type="number"
                min="600"
                value={depthMm || ''}
                onChange={(event) => { setDimensionsConfirmed(false); setDepthMm(event.target.value === '' ? 0 : Number(event.target.value)); }}
              />
            </label>
            <label className="span-2">
              Ceiling height (mm)
              <input
                type="number"
                min="1800"
                value={ceilingHeightMm || ''}
                onChange={(event) => { setDimensionsConfirmed(false); setCeilingHeightMm(event.target.value === '' ? 0 : Number(event.target.value)); }}
              />
            </label>
            <label className="span-2">
              Wall thickness (mm)
              <input
                type="number"
                min="75"
                value={wallThicknessMm || ''}
                onChange={(event) => { setDimensionsConfirmed(false); setWallThicknessMm(event.target.value === '' ? 0 : Number(event.target.value)); }}
              />
            </label>
            <label className="span-2" style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <input
                type="checkbox"
                checked={dimensionsConfirmed}
                disabled={!valid}
                onChange={(event) => setDimensionsConfirmed(event.target.checked)}
                style={{ width: 16, marginTop: 3 }}
              />
              <span>I checked these room and opening measurements against the site plan.</span>
            </label>
            {!valid && geometryIssues.length > 0 && (
              <div className="span-2" role="alert" style={{ color: '#9a3412', fontSize: 12 }}>
                {geometryIssues.map((issue) => <div key={issue}>{issue}</div>)}
              </div>
            )}
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
              North Wall Zone ({widthMm || 'unmeasured'} mm)
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
              East Wall Zone ({depthMm || 'unmeasured'} mm)
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
              South Wall Zone ({widthMm || 'unmeasured'} mm)
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
              West Wall Zone ({depthMm || 'unmeasured'} mm)
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
            <button type="button" onClick={() => addOpening('structural_column')}>
              <Columns3 size={15} /> Add RCC Column
            </button>
          </div>

          {openings.length ? (
            <div className="opening-list">
              {openings.map((opening) => (
                <div className="opening-row" key={opening.id}>
                  <strong>{opening.kind === 'door' ? 'Door' : opening.kind === 'window' ? 'Window' : 'RCC Column'}</strong>
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
                      value={opening.offsetMm || ''}
                      onChange={(event) =>
                        updateOpening(opening.id, { offsetMm: event.target.value === '' ? 0 : Number(event.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Width
                    <input
                      type="number"
                      min="200"
                      value={opening.widthMm || ''}
                      onChange={(event) =>
                        updateOpening(opening.id, { widthMm: event.target.value === '' ? 0 : Number(event.target.value) })
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
                          value={opening.sillMm || ''}
                          onChange={(event) =>
                            updateOpening(opening.id, { sillMm: event.target.value === '' ? 0 : Number(event.target.value) })
                          }
                        />
                      </label>
                      <label>
                        Head
                        <input
                          type="number"
                          min="1"
                          value={opening.headMm || ''}
                          onChange={(event) =>
                            updateOpening(opening.id, { headMm: event.target.value === '' ? 0 : Number(event.target.value) })
                          }
                        />
                      </label>
                    </>
                  )}
                  {opening.kind === 'door' && (
                    <label>
                      Height (mm)
                      <input
                        type="number"
                        min="1"
                        max={ceilingHeightMm || undefined}
                        value={opening.heightMm || ''}
                        onChange={(event) => updateOpening(opening.id, { heightMm: event.target.value === '' ? 0 : Number(event.target.value) })}
                      />
                    </label>
                  )}
                  {opening.kind === 'structural_column' && (
                    <label>
                      Depth (mm)
                      <input
                        type="number"
                        min="100"
                        value={opening.depthMm || ''}
                        onChange={(event) =>
                          updateOpening(opening.id, { depthMm: event.target.value === '' ? 0 : Number(event.target.value) })
                        }
                      />
                    </label>
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
              <p>2D ROOM PREVIEW</p>
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
                <Compass size={14} /> Optional Vastu reference
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

          {/* Mode Switcher: 2D Architectural Plan vs 3D Axonometric Shell */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12, marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => setPreviewMode('2d_plan')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 7,
                border: previewMode === '2d_plan' ? '1px solid #c59c2d' : '1px solid var(--line)',
                background: previewMode === '2d_plan' ? 'linear-gradient(135deg, rgba(197, 156, 45, 0.15), rgba(197, 156, 45, 0.05))' : '#fff',
                color: previewMode === '2d_plan' ? '#855e0c' : 'var(--text-secondary)',
                fontWeight: 800,
                fontSize: 11.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                cursor: 'pointer',
              }}
            >
              <LayoutGrid size={13} />
              <span>2D Architectural Plan</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('3d_shell')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 7,
                border: previewMode === '3d_shell' ? '1px solid #c59c2d' : '1px solid var(--line)',
                background: previewMode === '3d_shell' ? 'linear-gradient(135deg, rgba(197, 156, 45, 0.15), rgba(197, 156, 45, 0.05))' : '#fff',
                color: previewMode === '3d_shell' ? '#855e0c' : 'var(--text-secondary)',
                fontWeight: 800,
                fontSize: 11.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                cursor: 'pointer',
              }}
            >
              <Layers size={13} />
              <span>3D Axonometric Shell</span>
            </button>
          </div>

          {previewMode === '2d_plan' ? (
            /* ─── 2D Architectural Top-Down Floor Plan ─── */
            <svg
              viewBox={`0 0 ${planSvg.svgW} ${planSvg.svgH}`}
              role="img"
              aria-label="2D Architectural Plan & Wall Zoning"
              style={{
                display: 'block',
                width: '100%',
                borderRadius: 10,
                background: '#fdfcf9',
                border: '1px solid #e8e0d4',
                boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.03)',
              }}
            >
              <defs>
                <pattern id="planGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="1" />
                </pattern>
                <pattern id="columnHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#334155" strokeWidth="2" />
                </pattern>
              </defs>

              {/* Grid background */}
              <rect width={planSvg.svgW} height={planSvg.svgH} fill="url(#planGrid)" />

              {/* Room proposal boundary using the selected wall thickness. */}
              <rect
                x={planSvg.rx - planSvg.wallThick}
                y={planSvg.ry - planSvg.wallThick}
                width={planSvg.roomW + planSvg.wallThick * 2}
                height={planSvg.roomH + planSvg.wallThick * 2}
                fill="#475569"
                stroke="#1e293b"
                strokeWidth="1.5"
                rx="2"
              />

              {/* Room Interior Floor */}
              <rect
                x={planSvg.rx}
                y={planSvg.ry}
                width={planSvg.roomW}
                height={planSvg.roomH}
                fill="#fffdfa"
                stroke="#64748b"
                strokeWidth="1"
              />

              {/* ─── Wall Functional Zone Stripes ─── */}
              {/* North Wall Zone (Top) */}
              <rect
                x={planSvg.rx}
                y={planSvg.ry}
                width={planSvg.roomW}
                height={planSvg.zoneThick}
                fill={ZONE_COLORS[wallZones.north].fill}
                stroke={ZONE_COLORS[wallZones.north].stroke}
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <text
                x={planSvg.rx + planSvg.roomW / 2}
                y={planSvg.ry + planSvg.zoneThick / 2 + 4}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="800"
                fill={ZONE_COLORS[wallZones.north].labelColor}
              >
                NORTH · {ZONE_COLORS[wallZones.north].shortLabel.toUpperCase()}
              </text>

              {/* East Wall Zone (Right) */}
              <rect
                x={planSvg.rx + planSvg.roomW - planSvg.zoneThick}
                y={planSvg.ry}
                width={planSvg.zoneThick}
                height={planSvg.roomH}
                fill={ZONE_COLORS[wallZones.east].fill}
                stroke={ZONE_COLORS[wallZones.east].stroke}
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />

              {/* South Wall Zone (Bottom) */}
              <rect
                x={planSvg.rx}
                y={planSvg.ry + planSvg.roomH - planSvg.zoneThick}
                width={planSvg.roomW}
                height={planSvg.zoneThick}
                fill={ZONE_COLORS[wallZones.south].fill}
                stroke={ZONE_COLORS[wallZones.south].stroke}
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <text
                x={planSvg.rx + planSvg.roomW / 2}
                y={planSvg.ry + planSvg.roomH - planSvg.zoneThick / 2 + 4}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="800"
                fill={ZONE_COLORS[wallZones.south].labelColor}
              >
                SOUTH · {ZONE_COLORS[wallZones.south].shortLabel.toUpperCase()}
              </text>

              {/* West Wall Zone (Left) */}
              <rect
                x={planSvg.rx}
                y={planSvg.ry}
                width={planSvg.zoneThick}
                height={planSvg.roomH}
                fill={ZONE_COLORS[wallZones.west].fill}
                stroke={ZONE_COLORS[wallZones.west].stroke}
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />

              {/* ─── Openings (Doors, Windows, Columns) ─── */}
              {openings.map((op, idx) => {
                if (op.wall === 'north') {
                  const ox = planSvg.rx + op.offsetMm * planSvg.scale;
                  const ow = op.widthMm * planSvg.scale;
                  const oy = planSvg.ry - planSvg.wallThick;
                  if (op.kind === 'door') {
                    return (
                      <g key={op.id}>
                        <rect x={ox} y={oy} width={ow} height={planSvg.wallThick} fill="#fffdfa" />
                        <line x1={ox} y1={planSvg.ry} x2={ox} y2={planSvg.ry + ow} stroke="#92400e" strokeWidth="2.5" />
                        <path d={`M ${ox} ${planSvg.ry + ow} A ${ow} ${ow} 0 0 0 ${ox + ow} ${planSvg.ry}`} fill="none" stroke="#b45309" strokeDasharray="3 3" strokeWidth="1.2" />
                        <text x={ox + ow / 2} y={oy - 3} textAnchor="middle" fontSize="9" fontWeight="700" fill="#92400e">D{idx + 1} {op.widthMm}</text>
                      </g>
                    );
                  }
                  if (op.kind === 'window') {
                    return (
                      <g key={op.id}>
                        <rect x={ox} y={oy} width={ow} height={planSvg.wallThick} fill="#fffdfa" stroke="#0284c7" strokeWidth="1" />
                        <line x1={ox} y1={oy + planSvg.wallThick / 2} x2={ox + ow} y2={oy + planSvg.wallThick / 2} stroke="#0284c7" strokeWidth="2" />
                        <text x={ox + ow / 2} y={oy - 3} textAnchor="middle" fontSize="9" fontWeight="700" fill="#0284c7">W{idx + 1} {op.widthMm}</text>
                      </g>
                    );
                  }
                  if (op.kind === 'structural_column') {
                    const cd = Math.max(10, (op.depthMm ?? 230) * planSvg.scale);
                    return (
                      <g key={op.id}>
                        <rect x={ox} y={planSvg.ry} width={ow} height={cd} fill="url(#columnHatch)" stroke="#0f172a" strokeWidth="1.5" />
                        <text x={ox + ow / 2} y={planSvg.ry + cd + 10} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#0f172a">RCC</text>
                      </g>
                    );
                  }
                }
                if (op.wall === 'south') {
                  const ox = planSvg.rx + op.offsetMm * planSvg.scale;
                  const ow = op.widthMm * planSvg.scale;
                  const oy = planSvg.ry + planSvg.roomH;
                  if (op.kind === 'door') {
                    return (
                      <g key={op.id}>
                        <rect x={ox} y={oy} width={ow} height={planSvg.wallThick} fill="#fffdfa" />
                        <line x1={ox} y1={oy} x2={ox} y2={oy - ow} stroke="#92400e" strokeWidth="2.5" />
                        <path d={`M ${ox} ${oy - ow} A ${ow} ${ow} 0 0 1 ${ox + ow} ${oy}`} fill="none" stroke="#b45309" strokeDasharray="3 3" strokeWidth="1.2" />
                        <text x={ox + ow / 2} y={oy + planSvg.wallThick + 10} textAnchor="middle" fontSize="9" fontWeight="700" fill="#92400e">D{idx + 1} {op.widthMm}</text>
                      </g>
                    );
                  }
                  if (op.kind === 'window') {
                    return (
                      <g key={op.id}>
                        <rect x={ox} y={oy} width={ow} height={planSvg.wallThick} fill="#fffdfa" stroke="#0284c7" strokeWidth="1" />
                        <line x1={ox} y1={oy + planSvg.wallThick / 2} x2={ox + ow} y2={oy + planSvg.wallThick / 2} stroke="#0284c7" strokeWidth="2" />
                        <text x={ox + ow / 2} y={oy + planSvg.wallThick + 10} textAnchor="middle" fontSize="9" fontWeight="700" fill="#0284c7">W{idx + 1} {op.widthMm}</text>
                      </g>
                    );
                  }
                  if (op.kind === 'structural_column') {
                    const cd = Math.max(10, (op.depthMm ?? 230) * planSvg.scale);
                    return (
                      <g key={op.id}>
                        <rect x={ox} y={oy - cd} width={ow} height={cd} fill="url(#columnHatch)" stroke="#0f172a" strokeWidth="1.5" />
                        <text x={ox + ow / 2} y={oy - cd - 4} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#0f172a">RCC</text>
                      </g>
                    );
                  }
                }
                if (op.wall === 'east') {
                  const oy = planSvg.ry + op.offsetMm * planSvg.scale;
                  const oh = op.widthMm * planSvg.scale;
                  const ox = planSvg.rx + planSvg.roomW;
                  if (op.kind === 'door') {
                    return (
                      <g key={op.id}>
                        <rect x={ox} y={oy} width={planSvg.wallThick} height={oh} fill="#fffdfa" />
                        <line x1={ox} y1={oy} x2={ox - oh} y2={oy} stroke="#92400e" strokeWidth="2.5" />
                        <path d={`M ${ox - oh} ${oy} A ${oh} ${oh} 0 0 0 ${ox} ${oy + oh}`} fill="none" stroke="#b45309" strokeDasharray="3 3" strokeWidth="1.2" />
                        <text x={ox + planSvg.wallThick + 12} y={oy + oh / 2 + 3} textAnchor="start" fontSize="9" fontWeight="700" fill="#92400e">D{idx + 1}</text>
                      </g>
                    );
                  }
                  if (op.kind === 'window') {
                    return (
                      <g key={op.id}>
                        <rect x={ox} y={oy} width={planSvg.wallThick} height={oh} fill="#fffdfa" stroke="#0284c7" strokeWidth="1" />
                        <line x1={ox + planSvg.wallThick / 2} y1={oy} x2={ox + planSvg.wallThick / 2} y2={oy + oh} stroke="#0284c7" strokeWidth="2" />
                        <text x={ox + planSvg.wallThick + 12} y={oy + oh / 2 + 3} textAnchor="start" fontSize="9" fontWeight="700" fill="#0284c7">W{idx + 1}</text>
                      </g>
                    );
                  }
                  if (op.kind === 'structural_column') {
                    const cd = Math.max(10, (op.depthMm ?? 230) * planSvg.scale);
                    return (
                      <g key={op.id}>
                        <rect x={ox - cd} y={oy} width={cd} height={oh} fill="url(#columnHatch)" stroke="#0f172a" strokeWidth="1.5" />
                        <text x={ox - cd - 4} y={oy + oh / 2 + 3} textAnchor="end" fontSize="8.5" fontWeight="800" fill="#0f172a">RCC</text>
                      </g>
                    );
                  }
                }
                if (op.wall === 'west') {
                  const oy = planSvg.ry + op.offsetMm * planSvg.scale;
                  const oh = op.widthMm * planSvg.scale;
                  const ox = planSvg.rx - planSvg.wallThick;
                  if (op.kind === 'door') {
                    return (
                      <g key={op.id}>
                        <rect x={ox} y={oy} width={planSvg.wallThick} height={oh} fill="#fffdfa" />
                        <line x1={planSvg.rx} y1={oy} x2={planSvg.rx + oh} y2={oy} stroke="#92400e" strokeWidth="2.5" />
                        <path d={`M ${planSvg.rx + oh} ${oy} A ${oh} ${oh} 0 0 1 ${planSvg.rx} ${oy + oh}`} fill="none" stroke="#b45309" strokeDasharray="3 3" strokeWidth="1.2" />
                        <text x={ox - 4} y={oy + oh / 2 + 3} textAnchor="end" fontSize="9" fontWeight="700" fill="#92400e">D{idx + 1}</text>
                      </g>
                    );
                  }
                  if (op.kind === 'window') {
                    return (
                      <g key={op.id}>
                        <rect x={ox} y={oy} width={planSvg.wallThick} height={oh} fill="#fffdfa" stroke="#0284c7" strokeWidth="1" />
                        <line x1={ox + planSvg.wallThick / 2} y1={oy} x2={ox + planSvg.wallThick / 2} y2={oy + oh} stroke="#0284c7" strokeWidth="2" />
                        <text x={ox - 4} y={oy + oh / 2 + 3} textAnchor="end" fontSize="9" fontWeight="700" fill="#0284c7">W{idx + 1}</text>
                      </g>
                    );
                  }
                  if (op.kind === 'structural_column') {
                    const cd = Math.max(10, (op.depthMm ?? 230) * planSvg.scale);
                    return (
                      <g key={op.id}>
                        <rect x={planSvg.rx} y={oy} width={cd} height={oh} fill="url(#columnHatch)" stroke="#0f172a" strokeWidth="1.5" />
                        <text x={planSvg.rx + cd + 4} y={oy + oh / 2 + 3} textAnchor="start" fontSize="8.5" fontWeight="800" fill="#0f172a">RCC</text>
                      </g>
                    );
                  }
                }
                return null;
              })}

              {/* Center Room Stamp */}
              <g transform={`translate(${planSvg.rx + planSvg.roomW / 2}, ${planSvg.ry + planSvg.roomH / 2})`}>
                <rect x="-85" y="-28" width="170" height="56" rx="8" fill="rgba(255,255,255,0.92)" stroke="#dcd1c2" strokeWidth="1" />
                <text x="0" y="-10" textAnchor="middle" fontSize="12" fontWeight="800" fill="#1c1917">
                  {draft.name}
                </text>
                <text x="0" y="5" textAnchor="middle" fontSize="10" fontWeight="600" fill="#78716c">
                  {widthMm} × {depthMm} mm
                </text>
                <text x="0" y="19" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#c59c2d">
                  {areaSqm} m² ({Math.round(areaSqm * 10.764)} sq.ft)
                </text>
              </g>

              {/* 8-Direction Vastu Compass Rose (Top Right) */}
              <g transform="translate(395, 36)">
                <circle cx="0" cy="0" r="22" fill="rgba(255,255,255,0.96)" stroke="#c59c2d" strokeWidth="1.2" />
                <line x1="0" y1="-19" x2="0" y2="19" stroke="#a88220" strokeWidth="1" />
                <line x1="-19" y1="0" x2="19" y2="0" stroke="#a88220" strokeWidth="1" />
                <line x1="-13" y1="-13" x2="13" y2="13" stroke="rgba(168,130,32,0.4)" strokeWidth="0.8" />
                <line x1="-13" y1="13" x2="13" y2="-13" stroke="rgba(168,130,32,0.4)" strokeWidth="0.8" />
                <polygon points="0,-21 -3.5,-10 0,-13 3.5,-10" fill="#dc2626" />
                <polygon points="0,21 -3.5,10 0,13 3.5,10" fill="#475569" />
                <text x="0" y="-24" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#dc2626">N</text>
                <text x="18" y="-16" textAnchor="start" fontSize="6.5" fontWeight="700" fill="#78716c">NE</text>
                <text x="25" y="3" textAnchor="start" fontSize="7.5" fontWeight="800" fill="#78716c">E</text>
                <text x="18" y="20" textAnchor="start" fontSize="6.5" fontWeight="700" fill="#78716c">SE</text>
                <text x="0" y="30" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#78716c">S</text>
                <text x="-18" y="20" textAnchor="end" fontSize="6.5" fontWeight="700" fill="#78716c">SW</text>
                <text x="-25" y="3" textAnchor="end" fontSize="7.5" fontWeight="800" fill="#78716c">W</text>
                <text x="-18" y="-16" textAnchor="end" fontSize="6.5" fontWeight="700" fill="#78716c">NW</text>
              </g>
            </svg>
          ) : (
            /* ─── 3D Axonometric Shell Preview ─── */
            <svg viewBox="0 0 420 300" role="img" aria-label="Schematic 3D room shell. Exact opening offsets are shown in the 2D plan.">
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
              <text x="210" y="18" textAnchor="middle" fontSize="9" fill="#92400e">Schematic opening positions · use the 2D plan for measured offsets</text>
            </svg>
          )}

          {/* 4-Wall Architectural Usable Bay Status Strip */}
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {(['north', 'east', 'south', 'west'] as const).map((wKey) => {
              const stat = wallUsableStats[wKey];
              const zVal = wallZones[wKey];
              const zColor = ZONE_COLORS[zVal];
              return (
                <div
                  key={wKey}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: '#fff',
                    border: `1px solid ${zColor.stroke}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: zColor.labelColor }}>
                      {wKey} Wall · {zColor.shortLabel}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: 'rgba(22, 163, 74, 0.1)', padding: '1px 6px', borderRadius: 6 }}>
                      {stat.usableMm} mm usable
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#44403c', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total: <strong>{stat.totalMm} mm</strong></span>
                    {stat.obstructedMm > 0 ? (
                      <span style={{ color: '#b45309', fontSize: 10.5 }}>
                        -{stat.obstructedMm}mm ({stat.openingsCount} openings)
                      </span>
                    ) : (
                      <span style={{ color: '#78716c', fontSize: 10.5 }}>Clear wall</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

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
            <button type="button" onClick={saveLocal} disabled={!valid}>
              <Save size={15} /> Save offline draft
            </button>

            <button type="button" onClick={download} disabled={!valid}>
              <Download size={15} /> Download Layout JSON
            </button>

            <button type="button" className="primary" onClick={continueToProject} disabled={!readyForProject}>
              <Upload size={15} /> Open in {selectedProjectId ? 'Project' : 'Projects'} <ArrowRight size={15} />
            </button>
          </div>

          <p className="room-builder-note">A local room proposal cannot create a manufacturing cutlist. First add it to a project, review its measured geometry, then place a catalog module in Spaces.</p>
          <p role="status" className="room-builder-message">{message}</p>
        </aside>
      </div>
    </main>
  );
}
