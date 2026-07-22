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
  sourceGeometry?: PlanElement['geometry'];
  worldGeometry?: {
    start?: { xMm: number; yMm: number };
    end?: { xMm: number; yMm: number };
    polygon?: Array<{ xMm: number; yMm: number }>;
    xMm?: number; yMm?: number; widthMm?: number; heightMm?: number;
  };
  wallId?: string;
  offsetAlongWallMm?: number;
  dimensionMm?: number;
  areaSqm?: number;
  note?: string;
  usableWalls?: number;
  potentialTvWall?: string;
  heightMm?: number;
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
  schemaVersion: 'plan.v1';
  units: 'mm';
  coordinateSystem: 'x-right-y-down-source-x-right-z-forward-world';
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
  | 'add_column'
  | 'move'
  | 'split_wall'
  | 'merge_walls';

type Props = {
  fileName?: string;
  preview: string | null;
  status: string;
  analysed: boolean;
  proposals?: Array<{ id: string; kind: string; confidence: number; status: string; note: string; geometry?: Record<string, number> }>;
  analysisIssues?: Array<{ code: string; severity: 'warning' | 'critical'; entityId?: string; message: string }>;
  initialSnapshot?: any;
  layoutConfig?: any;
  onFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAnalyze?: () => void;
  onApprove: (canonicalModel: CanonicalPlanModel) => void;
  onSaveDraft?: (snapshot: { elements: PlanElement[]; issues: IssueItem[]; scale: ScaleCalibration | null; ceilingHeightMm: number | null }) => void;
};

// ─── Default Detection Data ───────────────────────────────────────
const INITIAL_LAYERS: Record<LayerKey, { label: string; visible: boolean; count: number }> = {
  source_plan: { label: 'Source Floor Plan', visible: true, count: 1 },
  walls:       { label: 'Walls (A-WALL)',    visible: true, count: 0 },
  rooms:       { label: 'Rooms (Polygons)',  visible: true, count: 0 },
  doors:       { label: 'Doors & Swings',    visible: true, count: 0 },
  windows:     { label: 'Windows & Gaps',    visible: true, count: 0 },
  columns:     { label: 'Columns & Shafts',  visible: true, count: 0 },
  beams:       { label: 'Ceiling Beams',     visible: false, count: 0 },
  services:    { label: 'Plumbing & Elec',   visible: false, count: 3 },
  dimensions:  { label: 'Dimension Lines',   visible: true, count: 0 },
  annotations: { label: 'Annotations & Text',visible: true, count: 0 },
  unresolved:  { label: 'Uncertain Items',   visible: true, count: 0 },
};

// ─── Main Component ───────────────────────────────────────────────
export function PlanReviewWorkspace({
  fileName,
  preview,
  status,
  analysed,
  proposals = [],
  analysisIssues = [],
  initialSnapshot,
  onFile,
  onAnalyze,
  onApprove,
  onSaveDraft,
}: Props) {
  // State
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const [elements, setElements] = useState<PlanElement[]>([]);
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; point: Point } | null>(null);
  const [mergeSelection, setMergeSelection] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Calibration state
  const [calibrating, setCalibrating] = useState(false);
  const [calibPoints, setCalibPoints] = useState<Point[]>([]);
  const [knownMmInput, setKnownMmInput] = useState('');
  const [scale, setScale] = useState<ScaleCalibration | null>(null);
  const [ceilingHeightMm, setCeilingHeightMm] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (analysed || !initialSnapshot || typeof initialSnapshot !== 'object') return;
    if (Array.isArray(initialSnapshot.elements)) setElements(initialSnapshot.elements);
    if (Array.isArray(initialSnapshot.issues)) setIssues(initialSnapshot.issues);
    if (initialSnapshot.scale?.mmPerPixel > 0) setScale(initialSnapshot.scale);
    if (Number(initialSnapshot.ceilingHeightMm) > 0) setCeilingHeightMm(Number(initialSnapshot.ceilingHeightMm));
  }, [analysed, initialSnapshot]);

  useEffect(() => {
    if (!onSaveDraft || !elements.length) return;
    const timer = window.setTimeout(() => onSaveDraft({ elements, issues, scale, ceilingHeightMm }), 700);
    return () => window.clearTimeout(timer);
  }, [elements, issues, scale, ceilingHeightMm, onSaveDraft]);

  useEffect(() => {
    if (!analysed) return;
    const mapped = proposals.map((proposal, index) => {
      const geometry = proposal.geometry ?? {};
      const proposalKind = proposal.kind === 'opening'
        ? (geometry.kind === 1 ? 'window' : 'door')
        : proposal.kind === 'dimension' ? 'annotation' : proposal.kind;
      const polygon = proposalKind === 'room' && geometry.x !== undefined && geometry.y !== undefined && geometry.width !== undefined && geometry.height !== undefined
        ? [
            { x: geometry.x, y: geometry.y },
            { x: geometry.x + geometry.width, y: geometry.y },
            { x: geometry.x + geometry.width, y: geometry.y + geometry.height },
            { x: geometry.x, y: geometry.y + geometry.height },
          ]
        : undefined;
      return {
      id: proposal.id || `proposal-${index + 1}`,
      kind: proposalKind as PlanElement['kind'],
      label: proposal.note || `${proposal.kind} proposal ${index + 1}`,
      confidence: proposal.confidence,
      status: (proposal.status === 'accepted' || proposal.status === 'rejected' ? proposal.status : 'needs_review') as PlanElement['status'],
      color: proposal.kind === 'wall' ? '#2563eb' : proposal.kind === 'room' ? 'rgba(197,156,45,0.18)' : '#059669',
      geometry: { ...geometry, ...(polygon ? { polygon } : {}) },
      dimensionMm: proposal.kind === 'dimension' ? geometry.valueMm : undefined,
    };
    });
    setElements(mapped);
    setIssues(analysisIssues.map((issue, index) => ({
      id: `${issue.code}-${issue.entityId ?? index}`,
      elementId: issue.entityId,
      question: issue.message,
      optionA: 'Resolve after designer review',
      optionB: 'Reject affected proposal',
    })));
    setSelectedId(mapped[0]?.id ?? null);
  }, [analysed, proposals, analysisIssues]);

  // Toggle layer visibility
  const toggleLayer = (key: LayerKey) => {
    setLayers((prev) => ({
      ...prev,
      [key]: { ...prev[key], visible: !prev[key].visible },
    }));
  };

  // Selected element
  const selectedElement = elements.find((e) => e.id === selectedId) ?? null;
  const approvalReady = analysed && elements.length > 0 && Boolean(scale) && Number(ceilingHeightMm) > 0 && issues.length === 0 && !elements.some((element) => element.status === 'needs_review' || element.status === 'proposed');
  const analysisInFlight = /uploading|queued|processing|waiting|preparing/i.test(status);
  const layerCount = (key: LayerKey) => {
    const kinds: Partial<Record<LayerKey, PlanElement['kind'][]>> = {
      walls: ['wall'], rooms: ['room'], doors: ['door'], windows: ['window'], columns: ['column'],
      services: ['service'], annotations: ['annotation'],
    };
    if (key === 'source_plan') return preview ? 1 : 0;
    if (key === 'unresolved') return issues.length + elements.filter((element) => element.status === 'needs_review').length;
    return kinds[key]?.length ? elements.filter((element) => kinds[key]?.includes(element.kind)).length : 0;
  };

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

  const canvasPoint = (event: React.MouseEvent<SVGSVGElement | SVGGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.round(((event.clientX - rect.left) / rect.width) * 1000),
      y: Math.round(((event.clientY - rect.top) / rect.height) * 850),
    };
  };

  const translateElement = (id: string, delta: Point) => {
    setElements((previous) => previous.map((element) => {
      if (element.id !== id) return element;
      const geometry = { ...element.geometry };
      for (const key of ['x', 'x1', 'x2'] as const) if (geometry[key] !== undefined) geometry[key] += delta.x;
      for (const key of ['y', 'y1', 'y2'] as const) if (geometry[key] !== undefined) geometry[key] += delta.y;
      if (geometry.polygon) geometry.polygon = geometry.polygon.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y }));
      return { ...element, geometry };
    }));
  };

  const splitSelectedWall = (point: Point) => {
    const wall = elements.find((element) => element.id === selectedId && element.kind === 'wall');
    if (!wall || wall.geometry.x1 === undefined || wall.geometry.y1 === undefined || wall.geometry.x2 === undefined || wall.geometry.y2 === undefined) return;
    const deltaX = wall.geometry.x2 - wall.geometry.x1;
    const deltaY = wall.geometry.y2 - wall.geometry.y1;
    const lengthSquared = deltaX ** 2 + deltaY ** 2;
    if (lengthSquared === 0) return;
    const ratio = Math.max(0, Math.min(1, ((point.x - wall.geometry.x1) * deltaX + (point.y - wall.geometry.y1) * deltaY) / lengthSquared));
    const splitPoint = { x: Math.round(wall.geometry.x1 + ratio * deltaX), y: Math.round(wall.geometry.y1 + ratio * deltaY) };
    const distanceFromStart = Math.hypot(splitPoint.x - wall.geometry.x1, splitPoint.y - wall.geometry.y1);
    const distanceFromEnd = Math.hypot(splitPoint.x - wall.geometry.x2, splitPoint.y - wall.geometry.y2);
    if (distanceFromStart < 8 || distanceFromEnd < 8) return;
    const first: PlanElement = { ...wall, id: `${wall.id}-a`, label: `${wall.label} A`, geometry: { ...wall.geometry, x2: splitPoint.x, y2: splitPoint.y } };
    const second: PlanElement = { ...wall, id: `${wall.id}-b`, label: `${wall.label} B`, geometry: { ...wall.geometry, x1: splitPoint.x, y1: splitPoint.y } };
    setElements((previous) => previous.flatMap((element) => element.id === wall.id ? [first, second] : [element]));
    setSelectedId(first.id);
    setActiveTool('select');
  };

  const chooseWallForMerge = (id: string) => {
    const wall = elements.find((element) => element.id === id && element.kind === 'wall');
    if (!wall) return;
    setMergeSelection((previous) => {
      if (!previous.length) return [id];
      if (previous[0] === id) return [];
      const first = elements.find((element) => element.id === previous[0]);
      if (!first || first.geometry.x1 === undefined || first.geometry.y1 === undefined || first.geometry.x2 === undefined || first.geometry.y2 === undefined || wall.geometry.x1 === undefined || wall.geometry.y1 === undefined || wall.geometry.x2 === undefined || wall.geometry.y2 === undefined) return previous;
      const firstVector = { x: first.geometry.x2 - first.geometry.x1, y: first.geometry.y2 - first.geometry.y1 };
      const secondVector = { x: wall.geometry.x2 - wall.geometry.x1, y: wall.geometry.y2 - wall.geometry.y1 };
      const firstLength = Math.hypot(firstVector.x, firstVector.y);
      const secondLength = Math.hypot(secondVector.x, secondVector.y);
      const normalizedCross = firstLength && secondLength ? Math.abs(firstVector.x * secondVector.y - firstVector.y * secondVector.x) / (firstLength * secondLength) : 1;
      if (normalizedCross > 0.03) return previous;
      const candidates = [
        { distance: Math.hypot(first.geometry.x1 - wall.geometry.x1, first.geometry.y1 - wall.geometry.y1), start: { x: first.geometry.x2, y: first.geometry.y2 }, end: { x: wall.geometry.x2, y: wall.geometry.y2 } },
        { distance: Math.hypot(first.geometry.x1 - wall.geometry.x2, first.geometry.y1 - wall.geometry.y2), start: { x: first.geometry.x2, y: first.geometry.y2 }, end: { x: wall.geometry.x1, y: wall.geometry.y1 } },
        { distance: Math.hypot(first.geometry.x2 - wall.geometry.x1, first.geometry.y2 - wall.geometry.y1), start: { x: first.geometry.x1, y: first.geometry.y1 }, end: { x: wall.geometry.x2, y: wall.geometry.y2 } },
        { distance: Math.hypot(first.geometry.x2 - wall.geometry.x2, first.geometry.y2 - wall.geometry.y2), start: { x: first.geometry.x1, y: first.geometry.y1 }, end: { x: wall.geometry.x1, y: wall.geometry.y1 } },
      ].sort((a, b) => a.distance - b.distance);
      const match = candidates[0];
      if (!match || match.distance > 24) return previous;
      setElements((current) => current.filter((element) => element.id !== wall.id).map((element) => element.id === first.id ? { ...element, label: `${first.label} + ${wall.label}`, geometry: { ...element.geometry, x1: match.start.x, y1: match.start.y, x2: match.end.x, y2: match.end.y } } : element));
      setSelectedId(first.id);
      setActiveTool('select');
      return [];
    });
  };

  // Handle SVG Canvas click for tools
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const point = canvasPoint(e);
    if (!point) return;
    const { x, y } = point;

    if (activeTool === 'split_wall') {
      splitSelectedWall(point);
      return;
    }

    if (activeTool === 'calibrate') {
      if (calibPoints.length === 0) {
        setCalibPoints([{ x, y }]);
      } else if (calibPoints.length === 1) {
        const ptA = calibPoints[0];
        const ptB = { x, y };
        const pixDist = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
        const realMm = parseFloat(knownMmInput);
        if (!Number.isFinite(realMm) || realMm <= 0 || pixDist <= 0) return;
        const DerivedScale: ScaleCalibration = {
          pointA: ptA, pointB: ptB,
          pixelDistance: pixDist, realDistanceMm: realMm,
          mmPerPixel: Math.round((realMm / pixDist) * 100) / 100,
        };
        setScale(DerivedScale);
        setIssues((previous) => previous.filter((issue) => !issue.id.startsWith('CALIBRATION_REQUIRED-')));
        setCalibPoints([]);
        setActiveTool('select');
        setCalibrating(false);
      }
    }
  };

  const handleCanvasMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const point = canvasPoint(event);
    if (!point) return;
    translateElement(dragging.id, { x: point.x - dragging.point.x, y: point.y - dragging.point.y });
    setDragging({ ...dragging, point });
  };

  // Resolve an issue in the queue
  const resolveIssue = (issueId: string, choice: string) => {
    const issue = issues.find((item) => item.id === issueId);
    if (issue?.id.startsWith('CALIBRATION_REQUIRED-') && !scale) return;
    if (choice === issue?.optionB && issue.elementId) rejectElement(issue.elementId);
    setIssues((prev) => prev.filter((i) => i.id !== issueId));
  };

  // Final Plan Approval
  const handleApprovePlan = () => {
    if (!approvalReady) return;
    const mmPerPixel = scale!.mmPerPixel;
    const withWorldGeometry = (element: PlanElement): PlanElement => {
      const geometry = element.geometry;
      const worldGeometry: PlanElement['worldGeometry'] = geometry.polygon
        ? { polygon: geometry.polygon.map((point) => ({ xMm: Math.round(point.x * mmPerPixel), yMm: Math.round(point.y * mmPerPixel) })) }
        : geometry.x1 !== undefined && geometry.y1 !== undefined && geometry.x2 !== undefined && geometry.y2 !== undefined
          ? { start: { xMm: Math.round(geometry.x1 * mmPerPixel), yMm: Math.round(geometry.y1 * mmPerPixel) }, end: { xMm: Math.round(geometry.x2 * mmPerPixel), yMm: Math.round(geometry.y2 * mmPerPixel) } }
          : { xMm: Math.round((geometry.x ?? 0) * mmPerPixel), yMm: Math.round((geometry.y ?? 0) * mmPerPixel), widthMm: Math.round((geometry.width ?? 0) * mmPerPixel), heightMm: Math.round((geometry.height ?? 0) * mmPerPixel) };
      return { ...element, sourceGeometry: geometry, worldGeometry };
    };
    const walls = elements.filter((element) => element.kind === 'wall' && element.status !== 'rejected').map((element) => ({ ...withWorldGeometry(element), heightMm: ceilingHeightMm! }));
    const rooms = elements.filter((element) => element.kind === 'room' && element.status !== 'rejected').map((element) => {
      const mapped = withWorldGeometry(element);
      const polygon = mapped.worldGeometry?.polygon ?? [];
      const areaMm2 = polygon.reduce((sum, point, index) => {
        const next = polygon[(index + 1) % polygon.length];
        return sum + point.xMm * next.yMm - next.xMm * point.yMm;
      }, 0) / 2;
      return { ...mapped, areaSqm: polygon.length >= 3 ? Math.round(Math.abs(areaMm2) / 10_000) / 100 : element.areaSqm, ceilingHeightMm: ceilingHeightMm! } as PlanElement & { ceilingHeightMm: number };
    });
    const openings = elements.filter((element) => (element.kind === 'door' || element.kind === 'window') && element.status !== 'rejected').map((element) => {
      const mapped = withWorldGeometry(element);
      const point = { x: element.geometry.x ?? 0, y: element.geometry.y ?? 0 };
      const nearest = walls.map((wall) => {
        const source = wall.sourceGeometry ?? wall.geometry;
        const x1 = source.x1 ?? 0; const y1 = source.y1 ?? 0; const x2 = source.x2 ?? 0; const y2 = source.y2 ?? 0;
        const length2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        const ratio = length2 ? Math.max(0, Math.min(1, ((point.x - x1) * (x2 - x1) + (point.y - y1) * (y2 - y1)) / length2)) : 0;
        const projected = { x: x1 + ratio * (x2 - x1), y: y1 + ratio * (y2 - y1) };
        return { wall, ratio, distance: Math.hypot(point.x - projected.x, point.y - projected.y) };
      }).sort((a, b) => a.distance - b.distance)[0];
      return { ...mapped, wallId: nearest?.wall.id, offsetAlongWallMm: nearest ? Math.round((nearest.wall.dimensionMm ?? 0) * nearest.ratio) : undefined };
    });
    const canonicalModel: CanonicalPlanModel = {
      schemaVersion: 'plan.v1',
      units: 'mm',
      coordinateSystem: 'x-right-y-down-source-x-right-z-forward-world',
      scale,
      ceilingHeightMm: ceilingHeightMm!,
      walls,
      rooms,
      openings,
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
              <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={onFile} style={{ display: 'none' }} />
            </label>
            {onAnalyze && (
              <button
                onClick={onAnalyze}
                disabled={!fileName || analysisInFlight}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: 'var(--brown-mid)', color: '#fff', border: 0, borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                {analysisInFlight ? <RefreshCw size={14} className="spin" /> : <Sparkles size={14} />} {analysisInFlight ? 'Analysing source' : 'Run AI Analysis'}
              </button>
            )}
            <button
              onClick={handleApprovePlan}
              disabled={!approvalReady}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 18px', background: 'var(--gold)', color: '#fff', border: 0, borderRadius: 7, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
            >
              Approve Plan & Continue to Spaces <ArrowRight size={14} />
            </button>
          </div>
        </div>
        {status && <p role="status" style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 0' }}>{status}</p>}
        {!approvalReady && analysed && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>Approval unlocks after every proposal is accepted or rejected, critical issues are resolved, and one trusted dimension is calibrated.</p>}
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
                    <span className="layer-count">{layerCount(key)}</span>
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
              <button
                className={`tool-btn${activeTool === 'move' ? ' active' : ''}`}
                onClick={() => setActiveTool('move')}
                title="Drag a selected entity"
              >
                <Move size={14} /> Move
              </button>
              <button
                className={`tool-btn${activeTool === 'split_wall' ? ' active' : ''}`}
                onClick={() => setActiveTool('split_wall')}
                title="Select a wall, then click its split point"
              >
                <Split size={14} /> Split Wall
              </button>
              <button
                className={`tool-btn${activeTool === 'merge_walls' ? ' active' : ''}`}
                onClick={() => { setActiveTool('merge_walls'); setMergeSelection([]); }}
                title="Click two connected walls to merge them"
              >
                <Combine size={14} /> Merge Walls
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
              onMouseMove={handleCanvasMove}
              onMouseUp={() => setDragging(null)}
              onMouseLeave={() => setDragging(null)}
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
                  <g
                    key={wall.id}
                    onMouseDown={(event) => {
                      if (activeTool !== 'move') return;
                      const point = canvasPoint(event);
                      if (point) setDragging({ id: wall.id, point });
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (activeTool === 'merge_walls') chooseWallForMerge(wall.id);
                      else setSelectedId(wall.id);
                    }}
                  >
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
            <div className="form-field" style={{ marginTop: 12 }}>
              <label>Confirmed ceiling height (mm)</label>
              <input
                type="number"
                min={1}
                value={ceilingHeightMm ?? ''}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setCeilingHeightMm(Number.isFinite(value) && value > 0 ? value : null);
                }}
                placeholder="Required before plan approval"
              />
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
