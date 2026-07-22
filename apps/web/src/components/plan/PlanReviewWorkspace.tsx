/* ═══════════════════════════════════════════════
   FLOOR PLAN INTELLIGENCE — 3-Panel Workspace
═══════════════════════════════════════════════ */

import {
  Layers, MousePointer, Hand, ZoomIn, ZoomOut, Maximize2,
  Ruler, Crosshair, PenTool, Plus, Split, Combine, Move,
  Home, DoorOpen, LayoutGrid, Columns, AlertTriangle,
  CheckCircle2, XCircle, Trash2, Edit3, Save, ArrowRight,
  Eye, EyeOff, FileText, Sparkles, RefreshCw, Upload, FileUp
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Badge, Button, Card, CardContent, CardHeader } from '../ui/primitives';
import './plan-review.css';

// ─── Types ────────────────────────────────────────────────────────
export type Point = { x: number; y: number };

export type LayerKey =
  | 'source_plan'
  | 'walls'
  | 'rooms'
  | 'doors'
  | 'windows'
  | 'columns'
  | 'beams'
  | 'services'
  | 'dimensions'
  | 'annotations'
  | 'unresolved';

export type ScaleCalibration = {
  pointA: Point;
  pointB: Point;
  pixelDistance: number;
  realDistanceMm: number;
  mmPerPixel: number;
};

export type PlanElement = {
  id: string;
  kind: 'wall' | 'room' | 'door' | 'window' | 'column' | 'beam' | 'service' | 'annotation';
  label: string;
  confidence: number;
  status: 'proposed' | 'accepted' | 'rejected' | 'needs_review';
  color: string;
  // Geometry in canvas pixels (0-1000 norm scale)
  geometry: {
    x1?: number; y1?: number; x2?: number; y2?: number;
    x?: number; y?: number; width?: number; height?: number;
    polygon?: Point[];
  };
  dimensionMm?: number;
  areaSqm?: number;
  note?: string;
  usableWalls?: number;
  potentialTvWall?: string;
};

export type IssueItem = {
  id: string;
  elementId?: string;
  question: string;
  optionA: string;
  optionB: string;
  resolvedOption?: string;
};

export type CanonicalPlanModel = {
  units: 'mm';
  scale: ScaleCalibration | null;
  ceilingHeightMm: number;
  walls: PlanElement[];
  rooms: PlanElement[];
  openings: PlanElement[];
  columns: PlanElement[];
  services: PlanElement[];
  annotations: PlanElement[];
  unresolvedItems: IssueItem[];
  approvedAt?: string;
};

type CanvasTool =
  | 'select'
  | 'pan'
  | 'measure'
  | 'calibrate'
  | 'draw_wall'
  | 'add_room'
  | 'add_door'
  | 'add_window'
  | 'add_column';

type Props = {
  fileName?: string;
  preview: string | null;
  status: string;
  analysed: boolean;
  proposals?: Array<{ id: string; kind: string; confidence: number; status: string; note: string; geometry?: Record<string, number> }>;
  initialSnapshot?: any;
  layoutConfig?: any;
  onFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAnalyze?: () => void;
  onApprove: (canonicalModel: CanonicalPlanModel) => void;
  onSaveScene?: (snapshot: any) => void;
};

// ─── Default Detection Data ───────────────────────────────────────
const INITIAL_LAYERS: Record<LayerKey, { label: string; visible: boolean; count: number }> = {
  source_plan: { label: 'Source Floor Plan', visible: true, count: 1 },
  walls:       { label: 'Walls (A-WALL)',    visible: true, count: 4 },
  rooms:       { label: 'Rooms (Polygons)',  visible: true, count: 3 },
  doors:       { label: 'Doors & Swings',    visible: true, count: 2 },
  windows:     { label: 'Windows & Gaps',    visible: true, count: 2 },
  columns:     { label: 'Columns & Shafts',  visible: true, count: 2 },
  beams:       { label: 'Ceiling Beams',     visible: false, count: 0 },
  services:    { label: 'Plumbing & Elec',   visible: false, count: 3 },
  dimensions:  { label: 'Dimension Lines',   visible: true, count: 4 },
  annotations: { label: 'Annotations & Text',visible: true, count: 3 },
  unresolved:  { label: 'Uncertain Items',   visible: true, count: 2 },
};

const DEFAULT_ELEMENTS: PlanElement[] = [
  // Walls
  { id: 'wall-1', kind: 'wall', label: 'North Outer Wall (L-01)', confidence: 0.96, status: 'accepted', color: '#2563eb', geometry: { x1: 100, y1: 100, x2: 900, y2: 100 }, dimensionMm: 5200 },
  { id: 'wall-2', kind: 'wall', label: 'East Wall (L-02)', confidence: 0.94, status: 'accepted', color: '#2563eb', geometry: { x1: 900, y1: 100, x2: 900, y2: 750 }, dimensionMm: 3800 },
  { id: 'wall-3', kind: 'wall', label: 'South Wall (L-03)', confidence: 0.95, status: 'accepted', color: '#2563eb', geometry: { x1: 900, y1: 750, x2: 100, y2: 750 }, dimensionMm: 5200 },
  { id: 'wall-4', kind: 'wall', label: 'West Wall (L-04)', confidence: 0.92, status: 'accepted', color: '#2563eb', geometry: { x1: 100, y1: 750, x2: 100, y2: 100 }, dimensionMm: 3800 },
  { id: 'wall-div', kind: 'wall', label: 'Partition Wall (P-01)', confidence: 0.88, status: 'accepted', color: '#3b82f6', geometry: { x1: 520, y1: 100, x2: 520, y2: 750 }, dimensionMm: 3800 },

  // Rooms
  {
    id: 'room-living', kind: 'room', label: 'Living Room', confidence: 0.94, status: 'accepted', color: 'rgba(197,156,45,0.18)',
    areaSqm: 19.8, usableWalls: 3, potentialTvWall: 'Partition Wall (P-01)',
    geometry: { polygon: [{ x: 100, y: 100 }, { x: 520, y: 100 }, { x: 520, y: 750 }, { x: 100, y: 750 }] }
  },
  {
    id: 'room-bed', kind: 'room', label: 'Master Bedroom', confidence: 0.91, status: 'accepted', color: 'rgba(59,130,246,0.15)',
    areaSqm: 14.4, usableWalls: 3, potentialTvWall: 'East Wall (L-02)',
    geometry: { polygon: [{ x: 520, y: 100 }, { x: 900, y: 100 }, { x: 900, y: 500 }, { x: 520, y: 500 }] }
  },
  {
    id: 'room-kitchen', kind: 'room', label: 'Kitchen & Utility', confidence: 0.87, status: 'needs_review', color: 'rgba(16,185,129,0.15)',
    areaSqm: 9.5, usableWalls: 2, potentialTvWall: 'None',
    geometry: { polygon: [{ x: 520, y: 500 }, { x: 900, y: 500 }, { x: 900, y: 750 }, { x: 520, y: 750 }] }
  },

  // Openings
  { id: 'door-main', kind: 'door', label: 'Main Entrance Door', confidence: 0.93, status: 'accepted', color: '#059669', geometry: { x: 100, y: 400, width: 90, height: 900 }, dimensionMm: 900 },
  { id: 'door-bed', kind: 'door', label: 'Bedroom Door', confidence: 0.89, status: 'accepted', color: '#059669', geometry: { x: 520, y: 300, width: 80, height: 800 }, dimensionMm: 800 },
  { id: 'win-living', kind: 'window', label: 'Living Balcony Window', confidence: 0.95, status: 'accepted', color: '#d97706', geometry: { x: 300, y: 100, width: 150, height: 1500 }, dimensionMm: 1500 },
  { id: 'win-bed', kind: 'window', label: 'Bedroom Window', confidence: 0.91, status: 'accepted', color: '#d97706', geometry: { x: 900, y: 280, width: 120, height: 1200 }, dimensionMm: 1200 },

  // Structural
  { id: 'col-1', kind: 'column', label: 'Column C-01 (300×300)', confidence: 0.97, status: 'accepted', color: '#ef4444', geometry: { x: 505, y: 85, width: 30, height: 30 }, dimensionMm: 300 },
  { id: 'col-2', kind: 'column', label: 'Column C-02 (300×300)', confidence: 0.96, status: 'accepted', color: '#ef4444', geometry: { x: 505, y: 735, width: 30, height: 30 }, dimensionMm: 300 },
];

const DEFAULT_ISSUES: IssueItem[] = [
  {
    id: 'issue-1', elementId: 'win-living',
    question: 'Is the opening on the North wall a full-height balcony slider or a standard window?',
    optionA: 'Balcony Sliding Door (2100mm ht)',
    optionB: 'Standard Window (1200mm ht)',
  },
  {
    id: 'issue-2', elementId: 'room-kitchen',
    question: 'Is space 3 a Kitchen only, or a Kitchen with integrated Utility?',
    optionA: 'Open Kitchen + Utility',
    optionB: 'Kitchen Only',
  },
];

// ─── Main Component ───────────────────────────────────────────────
export function PlanReviewWorkspace({
  fileName,
  preview,
  status,
  analysed,
  proposals = [],
  onFile,
  onAnalyze,
  onApprove,
}: Props) {
  // State
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const [elements, setElements] = useState<PlanElement[]>(DEFAULT_ELEMENTS);
  const [issues, setIssues] = useState<IssueItem[]>(DEFAULT_ISSUES);
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');
  const [selectedId, setSelectedId] = useState<string | null>('room-living');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Calibration state
  const [calibrating, setCalibrating] = useState(false);
  const [calibPoints, setCalibPoints] = useState<Point[]>([]);
  const [knownMmInput, setKnownMmInput] = useState('3800');
  const [scale, setScale] = useState<ScaleCalibration | null>({
    pointA: { x: 900, y: 100 },
    pointB: { x: 900, y: 750 },
    pixelDistance: 650,
    realDistanceMm: 3800,
    mmPerPixel: 5.84,
  });

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Toggle layer visibility
  const toggleLayer = (key: LayerKey) => {
    setLayers((prev) => ({
      ...prev,
      [key]: { ...prev[key], visible: !prev[key].visible },
    }));
  };

  // Selected element
  const selectedElement = elements.find((e) => e.id === selectedId) ?? null;

  // Update element property
  const updateElement = (id: string, patch: Partial<PlanElement>) => {
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  // Accept element
  const acceptElement = (id: string) => updateElement(id, { status: 'accepted' });
  const rejectElement = (id: string) => updateElement(id, { status: 'rejected' });
  const deleteElement = (id: string) => {
    setElements((prev) => prev.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // Handle SVG Canvas click for tools
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000);

    if (activeTool === 'calibrate') {
      if (calibPoints.length === 0) {
        setCalibPoints([{ x, y }]);
      } else if (calibPoints.length === 1) {
        const ptA = calibPoints[0];
        const ptB = { x, y };
        const pixDist = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
        const realMm = parseFloat(knownMmInput) || 3800;
        const DerivedScale: ScaleCalibration = {
          pointA: ptA, pointB: ptB,
          pixelDistance: pixDist, realDistanceMm: realMm,
          mmPerPixel: Math.round((realMm / pixDist) * 100) / 100,
        };
        setScale(DerivedScale);
        setCalibPoints([]);
        setActiveTool('select');
        setCalibrating(false);
      }
    }
  };

  // Resolve an issue in the queue
  const resolveIssue = (issueId: string, choice: string) => {
    setIssues((prev) => prev.filter((i) => i.id !== issueId));
  };

  // Final Plan Approval
  const handleApprovePlan = () => {
    const canonicalModel: CanonicalPlanModel = {
      units: 'mm',
      scale,
      ceilingHeightMm: 2700,
      walls: elements.filter((e) => e.kind === 'wall' && e.status !== 'rejected'),
      rooms: elements.filter((e) => e.kind === 'room' && e.status !== 'rejected'),
      openings: elements.filter((e) => (e.kind === 'door' || e.kind === 'window') && e.status !== 'rejected'),
      columns: elements.filter((e) => e.kind === 'column' && e.status !== 'rejected'),
      services: elements.filter((e) => e.kind === 'service' && e.status !== 'rejected'),
      annotations: elements.filter((e) => e.kind === 'annotation'),
      unresolvedItems: issues,
      approvedAt: new Date().toISOString(),
    };
    onApprove(canonicalModel);
  };

  return (
    <div className="plan-review-workspace">
      {/* Page Header */}
      <div className="workspace-heading">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <small>Phase 2 — Floor Plan Intelligence</small>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: '2px 0 0' }}>Floor Plan Verification & Layer Canvas</h1>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1px solid var(--line)', borderRadius: 7, background: 'var(--surface)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <Upload size={14} /> Upload Plan File
              <input type="file" accept="image/*,.pdf,.dxf,.dwg,.svg" onChange={onFile} style={{ display: 'none' }} />
            </label>
            {onAnalyze && (
              <button
                onClick={onAnalyze}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: 'var(--brown-mid)', color: '#fff', border: 0, borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                <Sparkles size={14} /> Run Deep AI Analysis
              </button>
            )}
            <button
              onClick={handleApprovePlan}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 18px', background: 'var(--gold)', color: '#fff', border: 0, borderRadius: 7, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
            >
              Approve Plan & Continue to Spaces <ArrowRight size={14} />
            </button>
          </div>
        </div>
        {status && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 0' }}>{status}</p>}
      </div>

      {/* 3-PANEL GRID LAYOUT */}
      <div className="plan-intelligence-grid">
        {/* ─── LEFT PANEL: Analysis Layers & Tools ─── */}
        <div className="panel-left">
          {/* Layer toggles */}
          <div className="panel-box">
            <div className="panel-box-title">
              <Layers size={14} />
              <span>Analysis Layers</span>
            </div>
            <div className="layer-list">
              {(Object.keys(layers) as LayerKey[]).map((key) => {
                const layer = layers[key];
                return (
                  <button
                    key={key}
                    className={`layer-item${layer.visible ? ' active' : ''}`}
                    onClick={() => toggleLayer(key)}
                  >
                    {layer.visible ? <Eye size={13} style={{ color: 'var(--gold)' }} /> : <EyeOff size={13} style={{ color: '#9ca3af' }} />}
                    <span className="layer-label">{layer.label}</span>
                    <span className="layer-count">{layer.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Canvas Tools */}
          <div className="panel-box" style={{ marginTop: 12 }}>
            <div className="panel-box-title">
              <PenTool size={14} />
              <span>Canvas Tools</span>
            </div>
            <div className="tool-grid">
              <button
                className={`tool-btn${activeTool === 'select' ? ' active' : ''}`}
                onClick={() => setActiveTool('select')}
                title="Select & Edit Element"
              >
                <MousePointer size={14} /> Select
              </button>
              <button
                className={`tool-btn${activeTool === 'pan' ? ' active' : ''}`}
                onClick={() => setActiveTool('pan')}
                title="Pan View"
              >
                <Hand size={14} /> Pan
              </button>
              <button
                className={`tool-btn${activeTool === 'calibrate' ? ' active' : ''}`}
                onClick={() => { setActiveTool('calibrate'); setCalibrating(true); setCalibPoints([]); }}
                title="Calibrate Scale (Click 2 points)"
              >
                <Crosshair size={14} /> Calibrate
              </button>
              <button
                className={`tool-btn${activeTool === 'draw_wall' ? ' active' : ''}`}
                onClick={() => setActiveTool('draw_wall')}
                title="Draw Wall Segment"
              >
                <Ruler size={14} /> Draw Wall
              </button>
              <button
                className={`tool-btn${activeTool === 'add_room' ? ' active' : ''}`}
                onClick={() => setActiveTool('add_room')}
                title="Add Room Polygon"
              >
                <Home size={14} /> Add Room
              </button>
              <button
                className={`tool-btn${activeTool === 'add_door' ? ' active' : ''}`}
                onClick={() => setActiveTool('add_door')}
                title="Add Door Opening"
              >
                <DoorOpen size={14} /> Add Door
              </button>
            </div>

            {/* Calibration details */}
            {scale && (
              <div className="scale-info-box">
                <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--gold-dim)', marginBottom: 2 }}>SCALE CALIBRATED</div>
                <div>1 px = <strong>{scale.mmPerPixel} mm</strong> ({scale.realDistanceMm} mm / {Math.round(scale.pixelDistance)} px)</div>
              </div>
            )}

            {calibrating && (
              <div className="calib-banner">
                <div>Click 2 points on a wall with known length:</div>
                <input
                  type="number"
                  value={knownMmInput}
                  onChange={(e) => setKnownMmInput(e.target.value)}
                  placeholder="Length in mm (e.g. 3800)"
                  style={{ width: '100%', padding: '4px 8px', marginTop: 4, border: '1px solid var(--line)', borderRadius: 4, fontSize: 12 }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Points selected: {calibPoints.length} / 2
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── CENTER PANEL: Floor Plan Canvas ─── */}
        <div className="panel-center">
          <div className="canvas-header-bar">
            <div className="canvas-header-title">
              <span style={{ fontWeight: 700, fontSize: 13 }}>{fileName ?? 'Floor Plan Canvas'}</span>
              {scale && <span className="canvas-scale-chip">Scale: {scale.mmPerPixel} mm/px</span>}
            </div>
            <div className="canvas-controls">
              <button className="canvas-icon-btn" onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}><ZoomIn size={14} /></button>
              <span style={{ fontSize: 11, fontWeight: 700 }}>{Math.round(zoom * 100)}%</span>
              <button className="canvas-icon-btn" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}><ZoomOut size={14} /></button>
              <button className="canvas-icon-btn" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><Maximize2 size={14} /></button>
            </div>
          </div>

          <div className="canvas-viewport">
            <svg
              ref={svgRef}
              viewBox="0 0 1000 850"
              className="interactive-svg-canvas"
              onClick={handleCanvasClick}
              style={{
                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                transformOrigin: 'center center',
              }}
            >
              {/* Background grid */}
              <defs>
                <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                  <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e8e0d4" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="1000" height="850" fill="url(#grid)" />

              {/* Source Plan Overlay image */}
              {layers.source_plan.visible && preview && (
                <image href={preview} x="80" y="80" width="840" height="670" opacity="0.35" preserveAspectRatio="xMidYMid meet" />
              )}

              {/* Render Room Polygons */}
              {layers.rooms.visible && elements.filter((e) => e.kind === 'room').map((room) => {
                const isSelected = room.id === selectedId;
                const pointsStr = room.geometry.polygon?.map((p) => `${p.x},${p.y}`).join(' ');
                return (
                  <g key={room.id} onClick={(e) => { e.stopPropagation(); setSelectedId(room.id); }}>
                    {pointsStr && (
                      <polygon
                        points={pointsStr}
                        fill={room.color}
                        stroke={isSelected ? '#c59c2d' : '#3d2a1a'}
                        strokeWidth={isSelected ? 3 : 1.5}
                        strokeDasharray={room.status === 'needs_review' ? '6,4' : undefined}
                        style={{ cursor: 'pointer' }}
                      />
                    )}
                    {/* Room Label */}
                    {room.geometry.polygon && room.geometry.polygon[0] && (
                      <text
                        x={(room.geometry.polygon[0].x + room.geometry.polygon[1].x) / 2}
                        y={(room.geometry.polygon[0].y + room.geometry.polygon[2].y) / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#1a1208"
                        fontSize="14"
                        fontWeight="800"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {room.label} ({room.areaSqm} m²)
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Render Walls */}
              {layers.walls.visible && elements.filter((e) => e.kind === 'wall').map((wall) => {
                const isSelected = wall.id === selectedId;
                const { x1 = 0, y1 = 0, x2 = 0, y2 = 0 } = wall.geometry;
                return (
                  <g key={wall.id} onClick={(e) => { e.stopPropagation(); setSelectedId(wall.id); }}>
                    <line
                      x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={isSelected ? '#c59c2d' : wall.color}
                      strokeWidth={isSelected ? 8 : 6}
                      strokeLinecap="round"
                      style={{ cursor: 'pointer' }}
                    />
                    {/* Wall dimension text */}
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 - 8}
                      textAnchor="middle"
                      fill="#1e293b"
                      fontSize="10"
                      fontWeight="700"
                    >
                      {wall.dimensionMm} mm
                    </text>
                  </g>
                );
              })}

              {/* Render Doors */}
              {layers.doors.visible && elements.filter((e) => e.kind === 'door').map((door) => {
                const isSelected = door.id === selectedId;
                const { x = 0, y = 0 } = door.geometry;
                return (
                  <g key={door.id} onClick={(e) => { e.stopPropagation(); setSelectedId(door.id); }}>
                    <circle cx={x} cy={y} r={12} fill="#059669" stroke={isSelected ? '#c59c2d' : '#fff'} strokeWidth={2} style={{ cursor: 'pointer' }} />
                    <path d={`M ${x} ${y} A 30 30 0 0 1 ${x + 30} ${y + 30}`} fill="none" stroke="#059669" strokeWidth="2" strokeDasharray="3,3" />
                  </g>
                );
              })}

              {/* Render Windows */}
              {layers.windows.visible && elements.filter((e) => e.kind === 'window').map((win) => {
                const isSelected = win.id === selectedId;
                const { x = 0, y = 0 } = win.geometry;
                return (
                  <rect
                    key={win.id}
                    x={x - 20} y={y - 6} width={40} height={12}
                    fill="#d97706" stroke={isSelected ? '#c59c2d' : '#fff'}
                    strokeWidth={2} rx={2}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(win.id); }}
                    style={{ cursor: 'pointer' }}
                  />
                );
              })}

              {/* Render Columns */}
              {layers.columns.visible && elements.filter((e) => e.kind === 'column').map((col) => {
                const { x = 0, y = 0, width = 30, height = 30 } = col.geometry;
                return (
                  <rect
                    key={col.id}
                    x={x} y={y} width={width} height={height}
                    fill="#ef4444" stroke="#7f1d1d" strokeWidth={1}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(col.id); }}
                    style={{ cursor: 'pointer' }}
                  />
                );
              })}

              {/* Calibration points indicator */}
              {calibPoints.map((pt, i) => (
                <circle key={i} cx={pt.x} cy={pt.y} r={6} fill="#c59c2d" stroke="#fff" strokeWidth={2} />
              ))}
            </svg>
          </div>
        </div>

        {/* ─── RIGHT PANEL: AI Findings, Object Properties & Issue Queue ─── */}
        <div className="panel-right">
          {/* Summary Findings Box */}
          <div className="panel-box">
            <div className="panel-box-title">
              <Sparkles size={14} style={{ color: 'var(--gold)' }} />
              <span>AI Spatial Findings</span>
            </div>
            <div className="findings-summary-grid">
              <div className="finding-chip">
                <small>Confidence</small>
                <strong>93.4%</strong>
              </div>
              <div className="finding-chip">
                <small>Units</small>
                <strong>Millimetres</strong>
              </div>
              <div className="finding-chip">
                <small>Rooms Found</small>
                <strong>{elements.filter((e) => e.kind === 'room').length}</strong>
              </div>
              <div className="finding-chip">
                <small>Walls Found</small>
                <strong>{elements.filter((e) => e.kind === 'wall').length}</strong>
              </div>
            </div>
          </div>

          {/* Issue Queue */}
          {issues.length > 0 && (
            <div className="panel-box" style={{ marginTop: 12 }}>
              <div className="panel-box-title" style={{ color: '#d97706' }}>
                <AlertTriangle size={14} />
                <span>Issue Queue ({issues.length} Need Review)</span>
              </div>
              <div className="issue-queue-list">
                {issues.map((issue) => (
                  <div key={issue.id} className="issue-item-card">
                    <p className="issue-question">{issue.question}</p>
                    <div className="issue-options">
                      <button
                        className="issue-opt-btn"
                        onClick={() => resolveIssue(issue.id, issue.optionA)}
                      >
                        A. {issue.optionA}
                      </button>
                      <button
                        className="issue-opt-btn"
                        onClick={() => resolveIssue(issue.id, issue.optionB)}
                      >
                        B. {issue.optionB}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Element Editor */}
          <div className="panel-box" style={{ marginTop: 12 }}>
            <div className="panel-box-title">
              <Edit3 size={14} />
              <span>Properties & Inspector</span>
            </div>
            {selectedElement ? (
              <div className="element-editor">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Badge tone={selectedElement.status === 'accepted' ? 'success' : selectedElement.status === 'needs_review' ? 'warn' : 'neutral'}>
                    {selectedElement.status}
                  </Badge>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {selectedElement.id}</span>
                </div>

                <div className="form-field" style={{ marginTop: 10 }}>
                  <label>Label / Name</label>
                  <input
                    type="text"
                    value={selectedElement.label}
                    onChange={(e) => updateElement(selectedElement.id, { label: e.target.value })}
                  />
                </div>

                {selectedElement.dimensionMm !== undefined && (
                  <div className="form-field">
                    <label>Dimension (mm)</label>
                    <input
                      type="number"
                      value={selectedElement.dimensionMm}
                      onChange={(e) => updateElement(selectedElement.id, { dimensionMm: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                )}

                {selectedElement.areaSqm !== undefined && (
                  <div className="form-field">
                    <label>Area (m²)</label>
                    <input
                      type="number"
                      value={selectedElement.areaSqm}
                      onChange={(e) => updateElement(selectedElement.id, { areaSqm: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                )}

                {selectedElement.usableWalls !== undefined && (
                  <div className="form-field">
                    <label>Usable Walls</label>
                    <input
                      type="number"
                      value={selectedElement.usableWalls}
                      onChange={(e) => updateElement(selectedElement.id, { usableWalls: parseInt(e.target.value, 10) || 0 })}
                    />
                  </div>
                )}

                {selectedElement.potentialTvWall !== undefined && (
                  <div className="form-field">
                    <label>Potential TV Wall</label>
                    <input
                      type="text"
                      value={selectedElement.potentialTvWall}
                      onChange={(e) => updateElement(selectedElement.id, { potentialTvWall: e.target.value })}
                    />
                  </div>
                )}

                <div className="element-action-row">
                  <button
                    className="elem-btn accept"
                    onClick={() => acceptElement(selectedElement.id)}
                  >
                    <CheckCircle2 size={13} /> Accept
                  </button>
                  <button
                    className="elem-btn reject"
                    onClick={() => rejectElement(selectedElement.id)}
                  >
                    <XCircle size={13} /> Reject
                  </button>
                  <button
                    className="elem-btn delete"
                    onClick={() => deleteElement(selectedElement.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Click any wall, room polygon, door or window on the canvas to inspect and edit properties.
              </div>
            )}
          </div>

          {/* Detected Rooms List */}
          <div className="panel-box" style={{ marginTop: 12 }}>
            <div className="panel-box-title">
              <Home size={14} />
              <span>Detected Rooms ({elements.filter((e) => e.kind === 'room').length})</span>
            </div>
            <div className="room-summary-list">
              {elements.filter((e) => e.kind === 'room').map((room) => (
                <div
                  key={room.id}
                  className={`room-summary-card${room.id === selectedId ? ' active' : ''}`}
                  onClick={() => setSelectedId(room.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 13 }}>{room.label}</strong>
                    <Badge tone="success">{Math.round(room.confidence * 100)}%</Badge>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Area: <strong>{room.areaSqm} m²</strong> • Usable walls: <strong>{room.usableWalls ?? 3}</strong>
                  </div>
                  {room.potentialTvWall && (
                    <div style={{ fontSize: 11, color: 'var(--gold-dim)', marginTop: 2 }}>
                      TV wall candidate: <strong>{room.potentialTvWall}</strong>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
