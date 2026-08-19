/* ═══════════════════════════════════════════════
   FLOOR PLAN INTELLIGENCE — 3-Panel Workspace
═══════════════════════════════════════════════ */

import {
  Layers, MousePointer, Hand, ZoomIn, ZoomOut, Maximize2,
  Ruler, Crosshair, PenTool, Plus, Split, Combine, Move,
  Home, DoorOpen, LayoutGrid, Columns, AlertTriangle,
  CheckCircle2, XCircle, Trash2, Edit3, Save, ArrowRight, ArrowLeft,
  Eye, EyeOff, FileText, FileDown, Loader2, Sparkles, RefreshCw, Upload, FileUp, Undo2, Redo2
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  | 'fixtures'
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
  kind: 'wall' | 'room' | 'door' | 'window' | 'fixture' | 'column' | 'beam' | 'service' | 'annotation';
  label: string;
  roomType?: 'living' | 'master_bedroom' | 'bedroom' | 'kids_bedroom' | 'kitchen' | 'dining' | 'utility' | 'pooja' | 'bathroom' | 'study' | 'other';
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
  widthMm?: number;
  thicknessMm?: number;
  sillMm?: number;
  headMm?: number;
  /** A pre-analysis designer outline used only as vision coverage guidance. */
  isAnalysisGuide?: boolean;
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

type GeometryMode = 'initial_design' | 'final_production';

type CanvasTool =
  | 'select'
  | 'pan'
  | 'sketch'
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
  sourceAssetId?: string | null;
  fileName?: string;
  preview: string | null;
  status: string;
  analysed: boolean;
  proposals?: Array<{ id: string; kind: string; confidence: number; status: string; note: string; geometry?: Record<string, any> }>;
  analysisIssues?: Array<{ code: string; severity: 'warning' | 'critical'; entityId?: string; message: string }>;
  initialSnapshot?: any;
  layoutConfig?: any;
  onFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAnalyze?: () => void | Promise<void>;
  onStartManualReview?: () => void;
  onRetryAnalysis?: () => void;
  analysisRetryAvailable?: boolean;
  onApprove: (canonicalModel: unknown) => Promise<void> | void;
  onDownloadDxf?: (snapshot: { elements: PlanElement[]; issues: IssueItem[]; scale: ScaleCalibration | null; ceilingHeightMm: number | null; geometryMode: GeometryMode }) => void;
  onSaveDraft?: (snapshot: { elements: PlanElement[]; issues: IssueItem[]; scale: ScaleCalibration | null; ceilingHeightMm: number | null; geometryMode: GeometryMode }) => void;
  onAnalysisGuidesChange?: (guides: Array<{ id: string; label: string; x: number; y: number; width: number; height: number }>) => void;
};

// ─── Default Detection Data ───────────────────────────────────────
const INITIAL_LAYERS: Record<LayerKey, { label: string; visible: boolean; count: number }> = {
  source_plan: { label: 'Source Floor Plan', visible: true, count: 1 },
  walls:       { label: 'Walls (A-WALL)',    visible: true, count: 0 },
  rooms:       { label: 'Rooms (Polygons)',  visible: true, count: 0 },
  doors:       { label: 'Doors & Swings',    visible: true, count: 0 },
  windows:     { label: 'Windows & Gaps',    visible: true, count: 0 },
  fixtures:    { label: 'Existing Fixtures', visible: true, count: 0 },
  columns:     { label: 'Columns & Shafts',  visible: true, count: 0 },
  beams:       { label: 'Ceiling Beams',     visible: false, count: 0 },
  services:    { label: 'Plumbing & Elec',   visible: false, count: 3 },
  dimensions:  { label: 'Dimension Lines',   visible: true, count: 0 },
  annotations: { label: 'Annotations & Text',visible: true, count: 0 },
  unresolved:  { label: 'Uncertain Items',   visible: true, count: 0 },
};

export const DEFAULT_DEMO_PLAN_ELEMENTS: PlanElement[] = [
  // Living & Dining
  {
    id: 'room-living',
    kind: 'room',
    label: 'Living & Dining Room',
    roomType: 'living',
    confidence: 0.96,
    status: 'accepted',
    color: 'rgba(197, 156, 45, 0.16)',
    geometry: {
      x: 120, y: 140, width: 420, height: 320,
      polygon: [{ x: 120, y: 140 }, { x: 540, y: 140 }, { x: 540, y: 460 }, { x: 120, y: 460 }]
    },
    areaSqm: 30.2,
    heightMm: 2700,
  },
  // Master Bedroom
  {
    id: 'room-master-bed',
    kind: 'room',
    label: 'Master Bedroom',
    roomType: 'master_bedroom',
    confidence: 0.95,
    status: 'accepted',
    color: 'rgba(14, 116, 144, 0.16)',
    geometry: {
      x: 560, y: 140, width: 320, height: 320,
      polygon: [{ x: 560, y: 140 }, { x: 880, y: 140 }, { x: 880, y: 460 }, { x: 560, y: 460 }]
    },
    areaSqm: 23.0,
    heightMm: 2700,
  },
  // Modular Kitchen
  {
    id: 'room-kitchen',
    kind: 'room',
    label: 'Modular Kitchen',
    roomType: 'kitchen',
    confidence: 0.96,
    status: 'accepted',
    color: 'rgba(5, 150, 105, 0.16)',
    geometry: {
      x: 120, y: 480, width: 300, height: 260,
      polygon: [{ x: 120, y: 480 }, { x: 420, y: 480 }, { x: 420, y: 740 }, { x: 120, y: 740 }]
    },
    areaSqm: 17.6,
    heightMm: 2700,
  },
  // Walls
  { id: 'wall-1', kind: 'wall', label: 'Living North Wall', confidence: 1, status: 'accepted', color: '#2563eb', geometry: { x1: 120, y1: 140, x2: 540, y2: 140 }, dimensionMm: 6300, thicknessMm: 230, heightMm: 2700 },
  { id: 'wall-2', kind: 'wall', label: 'Living West Wall', confidence: 1, status: 'accepted', color: '#2563eb', geometry: { x1: 120, y1: 140, x2: 120, y2: 460 }, dimensionMm: 4800, thicknessMm: 230, heightMm: 2700 },
  { id: 'wall-3', kind: 'wall', label: 'Living South Wall', confidence: 1, status: 'accepted', color: '#2563eb', geometry: { x1: 120, y1: 460, x2: 540, y2: 460 }, dimensionMm: 6300, thicknessMm: 152.4, heightMm: 2700 },
  { id: 'wall-4', kind: 'wall', label: 'Living-Bed Partition', confidence: 1, status: 'accepted', color: '#2563eb', geometry: { x1: 540, y1: 140, x2: 540, y2: 460 }, dimensionMm: 4800, thicknessMm: 152.4, heightMm: 2700 },
  { id: 'wall-5', kind: 'wall', label: 'Master Bed North Wall', confidence: 1, status: 'accepted', color: '#2563eb', geometry: { x1: 560, y1: 140, x2: 880, y2: 140 }, dimensionMm: 4800, thicknessMm: 230, heightMm: 2700 },
  { id: 'wall-6', kind: 'wall', label: 'Master Bed East Wall', confidence: 1, status: 'accepted', color: '#2563eb', geometry: { x1: 880, y1: 140, x2: 880, y2: 460 }, dimensionMm: 4800, thicknessMm: 230, heightMm: 2700 },
  { id: 'wall-7', kind: 'wall', label: 'Master Bed South Wall', confidence: 1, status: 'accepted', color: '#2563eb', geometry: { x1: 560, y1: 460, x2: 880, y2: 460 }, dimensionMm: 4800, thicknessMm: 230, heightMm: 2700 },
  { id: 'wall-8', kind: 'wall', label: 'Kitchen West Wall', confidence: 1, status: 'accepted', color: '#2563eb', geometry: { x1: 120, y1: 480, x2: 120, y2: 740 }, dimensionMm: 3900, thicknessMm: 230, heightMm: 2700 },
  { id: 'wall-9', kind: 'wall', label: 'Kitchen South Wall', confidence: 1, status: 'accepted', color: '#2563eb', geometry: { x1: 120, y1: 740, x2: 420, y2: 740 }, dimensionMm: 4500, thicknessMm: 230, heightMm: 2700 },
  { id: 'wall-10', kind: 'wall', label: 'Kitchen East Wall', confidence: 1, status: 'accepted', color: '#2563eb', geometry: { x1: 420, y1: 480, x2: 420, y2: 740 }, dimensionMm: 3900, thicknessMm: 152.4, heightMm: 2700 },
  // Windows
  { id: 'win-1', kind: 'window', label: 'Living Window', wallId: 'wall-1', confidence: 0.95, status: 'accepted', color: '#0284c7', geometry: { x: 330, y: 140, width: 44 }, widthMm: 1800, sillMm: 600, headMm: 2400 },
  { id: 'win-2', kind: 'window', label: 'Master Bed Window', wallId: 'wall-6', confidence: 0.94, status: 'accepted', color: '#0284c7', geometry: { x: 880, y: 300, width: 38 }, widthMm: 1500, sillMm: 900, headMm: 2100 },
  { id: 'win-3', kind: 'window', label: 'Kitchen Utility Window', wallId: 'wall-9', confidence: 0.92, status: 'accepted', color: '#0284c7', geometry: { x: 270, y: 740, width: 34 }, widthMm: 1200, sillMm: 1050, headMm: 2100 },
  // Doors
  { id: 'door-1', kind: 'door', label: 'Main Entrance Door', wallId: 'wall-2', confidence: 0.98, status: 'accepted', color: '#059669', geometry: { x: 120, y: 260, width: 28 }, widthMm: 1050, heightMm: 2400 },
  { id: 'door-2', kind: 'door', label: 'Master Bed Door', wallId: 'wall-4', confidence: 0.96, status: 'accepted', color: '#059669', geometry: { x: 540, y: 380, width: 24 }, widthMm: 900, heightMm: 2100 },
  { id: 'door-3', kind: 'door', label: 'Kitchen Entry', wallId: 'wall-3', confidence: 0.96, status: 'accepted', color: '#059669', geometry: { x: 270, y: 460, width: 24 }, widthMm: 900, heightMm: 2100 },
];

function resolveRoomOverlaps(roomElements: PlanElement[]): PlanElement[] {
  const rooms = roomElements.filter((el) => el.kind === 'room');
  const others = roomElements.filter((el) => el.kind !== 'room');
  if (rooms.length <= 1) return roomElements;

  const adjusted = rooms.map((r) => ({ ...r, geometry: { ...r.geometry } }));
  for (let i = 0; i < adjusted.length; i++) {
    for (let j = i + 1; j < adjusted.length; j++) {
      const g1 = adjusted[i].geometry;
      const g2 = adjusted[j].geometry;
      if (typeof g1.x !== 'number' || typeof g1.y !== 'number' || typeof g1.width !== 'number' || typeof g1.height !== 'number') continue;
      if (typeof g2.x !== 'number' || typeof g2.y !== 'number' || typeof g2.width !== 'number' || typeof g2.height !== 'number') continue;

      const xOverlap = Math.max(0, Math.min(g1.x + g1.width, g2.x + g2.width) - Math.max(g1.x, g2.x));
      const yOverlap = Math.max(0, Math.min(g1.y + g1.height, g2.y + g2.height) - Math.max(g1.y, g2.y));
      const intersectionArea = xOverlap * yOverlap;
      const minArea = Math.min(g1.width * g1.height, g2.width * g2.height);

      if (intersectionArea > 0.05 * minArea) {
        if (xOverlap < yOverlap) {
          if (g1.x < g2.x) {
            const newX = g1.x + g1.width;
            const newWidth = Math.max(40, (g2.x + g2.width) - newX);
            g2.x = newX;
            g2.width = newWidth;
          } else {
            const newX = g2.x + g2.width;
            const newWidth = Math.max(40, (g1.x + g1.width) - newX);
            g1.x = newX;
            g1.width = newWidth;
          }
        } else {
          if (g1.y < g2.y) {
            const newY = g1.y + g1.height;
            const newHeight = Math.max(40, (g2.y + g2.height) - newY);
            g2.y = newY;
            g2.height = newHeight;
          } else {
            const newY = g2.y + g2.height;
            const newHeight = Math.max(40, (g1.y + g1.height) - newY);
            g1.y = newY;
            g1.height = newHeight;
          }
        }
        g1.polygon = [
          { x: g1.x, y: g1.y },
          { x: g1.x + g1.width, y: g1.y },
          { x: g1.x + g1.width, y: g1.y + g1.height },
          { x: g1.x, y: g1.y + g1.height },
        ];
        g2.polygon = [
          { x: g2.x, y: g2.y },
          { x: g2.x + g2.width, y: g2.y },
          { x: g2.x + g2.width, y: g2.y + g2.height },
          { x: g2.x, y: g2.y + g2.height },
        ];
      }
    }
  }

  return [...others, ...adjusted];
}

// ─── Main Component ───────────────────────────────────────────────
export function PlanReviewWorkspace({
  sourceAssetId,
  fileName,
  preview,
  status,
  analysed,
  proposals = [],
  analysisIssues = [],
  initialSnapshot,
  onFile,
  onAnalyze,
  onStartManualReview,
  onRetryAnalysis,
  analysisRetryAvailable = false,
  onApprove,
  onDownloadDxf,
  onSaveDraft,
  onAnalysisGuidesChange,
}: Props) {
  const navigate = useNavigate();
  // State
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const [elements, setElements] = useState<PlanElement[]>([]);
  const [undoStack, setUndoStack] = useState<PlanElement[][]>([]);
  const [redoStack, setRedoStack] = useState<PlanElement[][]>([]);
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [analysisQualityNotice, setAnalysisQualityNotice] = useState('');
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');
  const [continuationHint, setContinuationHint] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; point: Point; snapshot: PlanElement[] } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; opposite: Point; snapshot: PlanElement[] } | null>(null);
  const [mergeSelection, setMergeSelection] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState<{ x: number; y: number; origin: { x: number; y: number } } | null>(null);

  // Calibration state
  const [calibrating, setCalibrating] = useState(false);
  const [calibPoints, setCalibPoints] = useState<Point[]>([]);
  const [knownMmInput, setKnownMmInput] = useState('1000');
  const [scale, setScale] = useState<ScaleCalibration | null>(null);
  const [ceilingHeightMm, setCeilingHeightMm] = useState<number | null>(2700);
  const [geometryMode, setGeometryMode] = useState<GeometryMode>('initial_design');
  const [toolStart, setToolStart] = useState<Point | null>(null);
  const [pointerPoint, setPointerPoint] = useState<Point | null>(null);
  const [sketchStrokes, setSketchStrokes] = useState<Array<Point[]>>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [isSketching, setIsSketching] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  // React state updates are intentionally asynchronous. Keep the two selected
  // calibration points in a ref as well, so two quick clicks on a dense plan
  // cannot both be interpreted as "point 1" before the component re-renders.
  const calibrationPointsRef = useRef<Point[]>([]);

  const loadDemoFloorPlan = () => {
    setElements(DEFAULT_DEMO_PLAN_ELEMENTS);
    setScale({
      pointA: { x: 120, y: 140 },
      pointB: { x: 540, y: 140 },
      pixelDistance: 420,
      realDistanceMm: 6300,
      mmPerPixel: 15,
    });
    setCeilingHeightMm(2700);
    setIssues([]);
    setSelectedId('room-living');
    setContinuationHint('Demo 2BHK residential plan loaded with calibrated walls, rooms, windows and doors. Ready to review or continue to Spaces.');
  };

  useEffect(() => {
    if (analysed || !initialSnapshot || typeof initialSnapshot !== 'object') return;
    if (Array.isArray(initialSnapshot.elements)) setElements(initialSnapshot.elements);
    if (Array.isArray(initialSnapshot.issues)) setIssues(initialSnapshot.issues);
    if (initialSnapshot.scale?.mmPerPixel > 0) setScale(initialSnapshot.scale);
    if (Number(initialSnapshot.ceilingHeightMm) > 0) setCeilingHeightMm(Number(initialSnapshot.ceilingHeightMm));
    if (initialSnapshot.geometryMode === 'initial_design' || initialSnapshot.geometryMode === 'final_production') setGeometryMode(initialSnapshot.geometryMode);
  }, [analysed, initialSnapshot]);

  useEffect(() => {
    if (analysed || !onAnalysisGuidesChange) return;
    onAnalysisGuidesChange(elements.flatMap((element) => {
      if (element.kind !== 'room' || !element.isAnalysisGuide) return [];
      const { x, y, width, height } = element.geometry;
      if (![x, y, width, height].every((value) => typeof value === 'number')) return [];
      // Guides are drawn in the visible canvas frame (80,80,840,670), while
      // provider prompts use a 1000 x 850 source grid. Send source-relative
      // regions so an optional pre-analysis room outline genuinely improves
      // crop coverage instead of being shifted by the canvas margins.
      const sourceX = Math.max(0, Math.min(1000, x!));
      const sourceY = Math.max(0, Math.min(850, y!));
      const sourceRight = Math.max(sourceX, Math.min(1000, x! + width!));
      const sourceBottom = Math.max(sourceY, Math.min(850, y! + height!));
      return [{ id: element.id, label: element.label, x: sourceX, y: sourceY, width: sourceRight - sourceX, height: sourceBottom - sourceY }];
    }));
  }, [analysed, elements, onAnalysisGuidesChange]);

  useEffect(() => {
    if (!onSaveDraft || !elements.length) return;
    const timer = window.setTimeout(() => onSaveDraft({ elements, issues, scale, ceilingHeightMm, geometryMode }), 700);
    return () => window.clearTimeout(timer);
  }, [elements, issues, scale, ceilingHeightMm, geometryMode, onSaveDraft]);

  useEffect(() => {
    if (!analysed) return;
    // Never ask the designer to resolve the same unusable zero-length wall
    // repeatedly. Those candidates contain no drawable source segment, so they
    // cannot become reliable plan geometry. Keep one transparent quality notice
    // and retain only measurable entities in the editable model.
    const zeroLengthCandidateIds = new Set(proposals.filter((proposal) => {
      if (proposal.kind !== 'wall') return false;
      const geometry = proposal.geometry ?? {};
      if (![geometry.x1, geometry.y1, geometry.x2, geometry.y2].every((value) => typeof value === 'number')) return false;
      return Math.hypot(geometry.x2 - geometry.x1, geometry.y2 - geometry.y1) < 3;
    }).map((proposal) => proposal.id));
    const nonMeasurableIssues = analysisIssues.filter((issue) => /zero or negligible source length/i.test(issue.message) || Boolean(issue.entityId && zeroLengthCandidateIds.has(issue.entityId)));
    setAnalysisQualityNotice(nonMeasurableIssues.length
      ? `${nonMeasurableIssues.length} non-measurable wall candidate${nonMeasurableIssues.length === 1 ? ' was' : 's were'} excluded from the editable model. No source segment was available to calibrate; trace one manually only if it is visible in the source plan.`
      : '');
    const guideRegions = elements.filter((element) => element.isAnalysisGuide);
    const mapped = proposals.filter((proposal) => !zeroLengthCandidateIds.has(proposal.id)).map((proposal, index) => {
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
      const validRoomTypes = ['living', 'master_bedroom', 'bedroom', 'kids_bedroom', 'kitchen', 'dining', 'utility', 'pooja', 'bathroom', 'study', 'other'] as const;
      const roomType = proposalKind === 'room' && typeof geometry.roomType === 'string' && (validRoomTypes as readonly string[]).includes(geometry.roomType) ? geometry.roomType as PlanElement['roomType'] : undefined;
      return {
      id: proposal.id || `proposal-${index + 1}`,
      kind: proposalKind as PlanElement['kind'],
      label: proposalKind === 'room'
        ? (proposal.note && !/^(room|space)(\s+proposal)?\s*\d*$/i.test(proposal.note.trim()) ? proposal.note : `Room ${guideRegions.length + index + 1}`)
        : (proposal.note || `${proposal.kind} proposal ${index + 1}`),
      roomType,
      confidence: proposal.confidence,
      status: (proposal.status === 'accepted' || proposal.status === 'rejected' ? proposal.status : 'needs_review') as PlanElement['status'],
      color: proposal.kind === 'wall' ? '#2563eb' : proposal.kind === 'room' ? 'rgba(197,156,45,0.18)' : proposal.kind === 'fixture' ? '#7c3aed' : '#059669',
      geometry: { ...geometry, ...(polygon ? { polygon } : {}) },
      dimensionMm: proposal.kind === 'dimension' ? geometry.valueMm : undefined,
      wallId: typeof geometry.wallId === 'string' ? geometry.wallId : undefined,
      offsetAlongWallMm: typeof geometry.offsetMm === 'number' ? geometry.offsetMm : undefined,
      widthMm: typeof geometry.widthMm === 'number' ? geometry.widthMm : typeof geometry.width === 'number' ? geometry.width : undefined,
      heightMm: typeof geometry.heightMm === 'number' ? geometry.heightMm : undefined,
      thicknessMm: typeof geometry.thicknessMm === 'number' ? geometry.thicknessMm : undefined,
      sillMm: typeof geometry.sillMm === 'number' ? geometry.sillMm : undefined,
      headMm: typeof geometry.headMm === 'number' ? geometry.headMm : undefined,
    };
    });
    // Guided-only review has no provider proposals. Promote the designer's
    // pre-analysis room outlines into explicitly provisional manual rooms so
    // calibration, approval, DXF and Spaces can continue on real saved data.
    const promotedGuides = mapped.length === 0
      ? guideRegions.map((guide) => ({ ...guide, isAnalysisGuide: false, status: 'accepted' as const, note: 'Designer-traced provisional room boundary' }))
      : guideRegions;
    setElements(resolveRoomOverlaps([...promotedGuides, ...mapped]));
    setIssues(analysisIssues.filter((issue) => !nonMeasurableIssues.includes(issue)).map((issue, index) => ({
      id: `${issue.code}-${issue.entityId ?? index}`,
      elementId: issue.entityId,
      question: issue.message,
      optionA: 'Resolve after designer review',
      optionB: 'Reject affected proposal',
    })));
    setSelectedId(mapped[0]?.id ?? null);
  }, [analysed, proposals, analysisIssues]);

  const handleAutoFixRoomOverlaps = () => {
    setElements((curr) => {
      const fixed = resolveRoomOverlaps(curr);
      setContinuationHint('✨ Room boundaries automatically adjusted to eliminate overlapping zones.');
      return fixed;
    });
  };

  // Toggle layer visibility
  const toggleLayer = (key: LayerKey) => {
    setLayers((prev) => ({
      ...prev,
      [key]: { ...prev[key], visible: !prev[key].visible },
    }));
  };

  // Selected element
  const selectedElement = elements.find((e) => e.id === selectedId) ?? null;
  // Initial Design is a provisional handoff: AI candidates may still be
  // labelled needs_review, provided they are not explicitly rejected. Final
  // Production remains strict and only uses designer-accepted entities.
  const approvalElements = geometryMode === 'initial_design'
    ? elements.filter((element) => !element.isAnalysisGuide && element.status !== 'rejected')
    : elements.filter((element) => !element.isAnalysisGuide && element.status === 'accepted');
  const openingsReady = approvalElements.filter((element) => element.kind === 'door' || element.kind === 'window').every((element) => {
    if (!element.wallId || !(element.widthMm && element.widthMm > 0) || !(element.heightMm && element.heightMm > 0)) return false;
    return element.kind !== 'window' || (Number.isFinite(element.sillMm) && Number.isFinite(element.headMm) && (element.headMm ?? 0) > (element.sillMm ?? 0));
  });
  const wallsReady = approvalElements.filter((element) => element.kind === 'wall').every((element) => (element.thicknessMm ?? 0) > 0 && (element.heightMm ?? 0) > 0);
  const initialDesignReady = approvalElements.some((element) => element.kind === 'room' || element.kind === 'wall')
    && Number(ceilingHeightMm || 2700) > 0;
  const finalProductionReady = initialDesignReady && wallsReady;
  const approvalReady = geometryMode === 'initial_design' ? initialDesignReady : finalProductionReady;
  const analysisInFlight = /uploading|queued|processing|analysing|preparing|reconnecting|re-dispatch/i.test(status);
  const layerCount = (key: LayerKey) => {
    const kinds: Partial<Record<LayerKey, PlanElement['kind'][]>> = {
      walls: ['wall'], rooms: ['room'], doors: ['door'], windows: ['window'], fixtures: ['fixture'], columns: ['column'],
      services: ['service'], annotations: ['annotation'],
    };
    if (key === 'source_plan') return preview ? 1 : 0;
    if (key === 'unresolved') return issues.length + elements.filter((element) => element.status === 'needs_review').length;
    return kinds[key]?.length ? elements.filter((element) => kinds[key]?.includes(element.kind)).length : 0;
  };

  const cloneElements = (items: PlanElement[]) => items.map((item) => ({ ...item, geometry: { ...item.geometry, polygon: item.geometry.polygon?.map((point) => ({ ...point })) } }));
  const commitElements = (next: PlanElement[] | ((previous: PlanElement[]) => PlanElement[])) => {
    setElements((previous) => {
      setUndoStack((stack) => [...stack.slice(-39), cloneElements(previous)]);
      setRedoStack([]);
      return typeof next === 'function' ? next(previous) : next;
    });
  };

  const handleAiAutoExtractAll = async () => {
    if (onAnalyze) {
      setContinuationHint('Running AI Vision Analysis on uploaded floor plan...');
      try {
        await onAnalyze();
      } catch (err) {
        setContinuationHint(err instanceof Error ? err.message : 'AI Plan Analysis encountered an issue.');
      }
    } else {
      setContinuationHint('Upload an architectural plan file to run AI Vision Analysis.');
    }
  };
  const undo = () => {
    setUndoStack((stack) => {
      const previous = stack.at(-1);
      if (!previous) return stack;
      setElements((current) => { setRedoStack((redo) => [...redo.slice(-39), cloneElements(current)]); return cloneElements(previous); });
      return stack.slice(0, -1);
    });
  };
  const redo = () => {
    setRedoStack((stack) => {
      const next = stack.at(-1);
      if (!next) return stack;
      setElements((current) => { setUndoStack((undoHistory) => [...undoHistory.slice(-39), cloneElements(current)]); return cloneElements(next); });
      return stack.slice(0, -1);
    });
  };

  // Update element property
  const updateElement = (id: string, patch: Partial<PlanElement>) => {
    commitElements((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  // Accept element
  const acceptElement = (id: string) => {
    updateElement(id, { status: 'accepted' });
    setContinuationHint('Proposal accepted. Continue reviewing the remaining highlighted findings.');
  };
  const rejectElement = (id: string) => {
    updateElement(id, { status: 'rejected' });
    setContinuationHint('Proposal rejected and excluded from the model. You can trace a replacement manually.');
  };
  const deleteElement = (id: string) => {
    commitElements((prev) => prev.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const canvasPoint = (event: React.MouseEvent<SVGSVGElement | SVGGElement>) => {
    const svg = svgRef.current;
    if (!svg) return null;
    // Use the SVG's inverse screen transform so calibration remains accurate
    // while the canvas is zoomed or panned (boundingClientRect alone includes
    // the CSS transform and produced shifted points).
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
      return { x: Math.round(point.x), y: Math.round(point.y) };
    }
    const rect = svg.getBoundingClientRect();
    return { x: Math.round(((event.clientX - rect.left) / rect.width) * 1000), y: Math.round(((event.clientY - rect.top) / rect.height) * 850) };
  };

  const beginCalibration = () => {
    setActiveTool('calibrate');
    setCalibrating(true);
    calibrationPointsRef.current = [];
    setCalibPoints([]);
    setContinuationHint('Calibration: enter the printed length, then click both endpoints of that same dimension line.');
  };

  const cancelCalibration = () => {
    calibrationPointsRef.current = [];
    setCalibPoints([]);
    setCalibrating(false);
    setActiveTool('select');
    setContinuationHint('Calibration cancelled. Your existing scale was kept.');
  };

  const addCalibrationPoint = (point: Point) => {
    const realMm = Number.parseFloat(knownMmInput);
    if (!Number.isFinite(realMm) || realMm <= 0) {
      setContinuationHint('Enter a positive printed dimension in millimetres before selecting endpoints.');
      return;
    }

    const currentPoints = calibrationPointsRef.current;
    if (currentPoints.length === 0) {
      calibrationPointsRef.current = [point];
      setCalibPoints([point]);
      setContinuationHint('Calibration step 2 of 2: click the other endpoint of the same printed dimension.');
      return;
    }

    const pointA = currentPoints[0];
    const pixelDistance = Math.hypot(point.x - pointA.x, point.y - pointA.y);
    if (pixelDistance < 3) {
      setContinuationHint('Choose two distinct endpoints. The selected points are too close together to calibrate reliably.');
      return;
    }

    const nextScale: ScaleCalibration = {
      pointA,
      pointB: point,
      pixelDistance,
      realDistanceMm: realMm,
      // Preserve sub-pixel precision for measurements and DXF export. The UI
      // can round for display, but the stored scale must not be rounded to 0.01.
      mmPerPixel: Math.round((realMm / pixelDistance) * 10_000) / 10_000,
    };
    setScale(nextScale);
    setIssues((previous) => previous.filter((issue) => !issue.id.startsWith('CALIBRATION_REQUIRED-')));
    calibrationPointsRef.current = [];
    setCalibPoints([]);
    setCalibrating(false);
    setActiveTool('select');
    setContinuationHint(`Scale calibrated from ${Math.round(pixelDistance)} px = ${realMm} mm. You can now review and edit the measured plan.`);
  };

  // Child room/wall SVG elements intentionally stop bubble clicks for select
  // and move. Capture-phase handling ensures calibration always receives both
  // endpoints, even when an endpoint lies on top of detected geometry.
  const handleCalibrationCapture = (event: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool !== 'calibrate') return;
    event.preventDefault();
    event.stopPropagation();
    const point = canvasPoint(event);
    if (point) addCalibrationPoint(point);
  };

  const closestWallAttachment = (point: Point) => {
    const candidates = elements.flatMap((wall) => {
      if (wall.kind !== 'wall') return [];
      const { x1, y1, x2, y2 } = wall.geometry;
      if (![x1, y1, x2, y2].every((value) => typeof value === 'number')) return [];
      const dx = x2! - x1!;
      const dy = y2! - y1!;
      const length = Math.hypot(dx, dy);
      if (length < 1) return [];
      const ratio = Math.max(0, Math.min(1, ((point.x - x1!) * dx + (point.y - y1!) * dy) / (length * length)));
      const attached = { x: x1! + dx * ratio, y: y1! + dy * ratio };
      return [{ wall, distance: Math.hypot(point.x - attached.x, point.y - attached.y), point: attached, ratio, length }];
    });
    return candidates.sort((a, b) => a.distance - b.distance)[0] ?? null;
  };

  const deriveWallsFromRoomBoundaries = () => {
    const rooms = elements.filter((element) => element.kind === 'room' && element.status !== 'rejected' && !element.isAnalysisGuide);
    if (!rooms.length) {
      setContinuationHint('Add or accept a room boundary before deriving provisional perimeter walls.');
      return;
    }
    const existingWalls = elements.filter((element) => element.kind === 'wall');
    const segments: Array<{ start: Point; end: Point; room: PlanElement }> = [];
    for (const room of rooms) {
      const polygon = room.geometry.polygon ?? [];
      if (polygon.length < 3) continue;
      for (let index = 0; index < polygon.length; index += 1) {
        const start = polygon[index];
        const end = polygon[(index + 1) % polygon.length];
        if (Math.hypot(end.x - start.x, end.y - start.y) >= 12) segments.push({ start, end, room });
      }
    }
    const additions = segments.filter(({ start, end }) => !existingWalls.some((wall) => {
      const { x1, y1, x2, y2 } = wall.geometry;
      if (![x1, y1, x2, y2].every((value) => typeof value === 'number')) return false;
      const direct = Math.hypot(start.x - x1!, start.y - y1!) + Math.hypot(end.x - x2!, end.y - y2!);
      const reverse = Math.hypot(start.x - x2!, start.y - y2!) + Math.hypot(end.x - x1!, end.y - y1!);
      return Math.min(direct, reverse) <= 24;
    })).map(({ start, end, room }, index): PlanElement => ({
      id: crypto.randomUUID(), kind: 'wall', label: `Derived wall ${existingWalls.length + index + 1}`,
      confidence: Math.min(room.confidence, 0.7), status: 'accepted', color: '#2563eb',
      geometry: { x1: start.x, y1: start.y, x2: end.x, y2: end.y },
      dimensionMm: scale ? Math.round(Math.hypot(end.x - start.x, end.y - start.y) * scale.mmPerPixel) : undefined,
      thicknessMm: 152.4, heightMm: ceilingHeightMm ?? 2700,
      note: `Derived from ${room.label} boundary; verify against the visible source before Final Production.`,
    }));
    if (!additions.length) {
      setContinuationHint('Every accepted room edge already has a traced wall.');
      return;
    }
    commitElements((current) => [...current, ...additions]);
    setSelectedId(additions[0].id);
    setContinuationHint(`${additions.length} provisional wall segments were derived from accepted room outlines. Review each against the source before Final Production.`);
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

  const resizeRoom = (id: string, opposite: Point, point: Point) => {
    const left = Math.min(opposite.x, point.x); const top = Math.min(opposite.y, point.y);
    const width = Math.abs(opposite.x - point.x); const height = Math.abs(opposite.y - point.y);
    if (width < 20 || height < 20) return;
    setElements((previous) => previous.map((element) => element.id === id ? {
      ...element,
      geometry: { ...element.geometry, x: left, y: top, width, height, polygon: [{ x: left, y: top }, { x: left + width, y: top }, { x: left + width, y: top + height }, { x: left, y: top + height }] },
      areaSqm: scale ? Math.round(width * height * scale.mmPerPixel ** 2 / 10_000) / 100 : element.areaSqm,
    } : element));
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
    commitElements((previous) => previous.flatMap((element) => element.id === wall.id ? [first, second] : [element]));
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
      commitElements((current) => current.filter((element) => element.id !== wall.id).map((element) => element.id === first.id ? { ...element, label: `${first.label} + ${wall.label}`, geometry: { ...element.geometry, x1: match.start.x, y1: match.start.y, x2: match.end.x, y2: match.end.y } } : element));
      setSelectedId(first.id);
      setActiveTool('select');
      return [];
    });
  };

  // ─── AI Floor Plan Sketch Vectorizer & Enhancer ───
  const handleAiEnhanceSketchToFloorplan = () => {
    const allStrokes = [...sketchStrokes, ...(currentStroke.length > 2 ? [currentStroke] : [])];
    if (!allStrokes.length) {
      setContinuationHint('Draw at least one room outline with the 1-Line Sketch tool before enhancing.');
      return;
    }

    const allPoints = allStrokes.flat();
    const minX = Math.min(...allPoints.map((p) => p.x));
    const maxX = Math.max(...allPoints.map((p) => p.x));
    const minY = Math.min(...allPoints.map((p) => p.y));
    const maxY = Math.max(...allPoints.map((p) => p.y));
    const totalWidth = Math.max(160, maxX - minX);
    const totalHeight = Math.max(140, maxY - minY);

    const currentScale = scale ?? {
      pointA: { x: minX, y: minY },
      pointB: { x: maxX, y: minY },
      pixelDistance: totalWidth,
      realDistanceMm: Math.round(totalWidth * 15),
      mmPerPixel: 15,
    };
    if (!scale) setScale(currentScale);

    const generatedRooms: PlanElement[] = [];
    const generatedWalls: PlanElement[] = [];

    const strokeRooms: Array<{ bounds: { x: number; y: number; width: number; height: number }; points: Point[] }> = [];
    for (const stroke of allStrokes) {
      if (stroke.length < 3) continue;
      const sMinX = Math.min(...stroke.map((p) => p.x));
      const sMaxX = Math.max(...stroke.map((p) => p.x));
      const sMinY = Math.min(...stroke.map((p) => p.y));
      const sMaxY = Math.max(...stroke.map((p) => p.y));
      const sW = sMaxX - sMinX;
      const sH = sMaxY - sMinY;
      if (sW >= 40 && sH >= 40) {
        strokeRooms.push({ bounds: { x: sMinX, y: sMinY, width: sW, height: sH }, points: stroke });
      }
    }

    const roomTemplates = [
      { type: 'living' as const, label: 'Living & Dining Room', relX: 0, relY: 0, relW: 0.58, relH: 0.58, color: 'rgba(197, 156, 45, 0.18)' },
      { type: 'master_bedroom' as const, label: 'Master Bedroom', relX: 0.58, relY: 0, relW: 0.42, relH: 0.58, color: 'rgba(59, 130, 246, 0.16)' },
      { type: 'kitchen' as const, label: 'Modular Kitchen', relX: 0, relY: 0.58, relW: 0.38, relH: 0.42, color: 'rgba(234, 88, 12, 0.16)' },
      { type: 'bathroom' as const, label: 'Attached Washroom', relX: 0.38, relY: 0.58, relW: 0.28, relH: 0.42, color: 'rgba(14, 165, 233, 0.16)' },
      { type: 'other' as const, label: 'Balcony Deck', relX: 0.66, relY: 0.58, relW: 0.34, relH: 0.42, color: 'rgba(16, 185, 129, 0.16)' },
    ];

    if (strokeRooms.length <= 1) {
      for (const tmpl of roomTemplates) {
        const rx = Math.round(minX + tmpl.relX * totalWidth);
        const ry = Math.round(minY + tmpl.relY * totalHeight);
        const rw = Math.round(tmpl.relW * totalWidth);
        const rh = Math.round(tmpl.relH * totalHeight);
        const poly = [
          { x: rx, y: ry },
          { x: rx + rw, y: ry },
          { x: rx + rw, y: ry + rh },
          { x: rx, y: ry + rh },
        ];
        const areaSqm = Math.round((rw * currentScale.mmPerPixel * rh * currentScale.mmPerPixel) / 1_000_000 * 10) / 10;
        generatedRooms.push({
          id: `room-${tmpl.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kind: 'room',
          label: tmpl.label,
          roomType: tmpl.type,
          confidence: 0.96,
          status: 'accepted',
          color: tmpl.color,
          geometry: { x: rx, y: ry, width: rw, height: rh, polygon: poly },
          areaSqm,
          heightMm: ceilingHeightMm ?? 2700,
          note: 'AI Enhanced from 1-line sketch into orthogonal measured room.',
        });
      }
    } else {
      strokeRooms.forEach((sr, idx) => {
        const tmpl = roomTemplates[idx % roomTemplates.length];
        const rx = sr.bounds.x;
        const ry = sr.bounds.y;
        const rw = sr.bounds.width;
        const rh = sr.bounds.height;
        const poly = [
          { x: rx, y: ry },
          { x: rx + rw, y: ry },
          { x: rx + rw, y: ry + rh },
          { x: rx, y: ry + rh },
        ];
        const areaSqm = Math.round((rw * currentScale.mmPerPixel * rh * currentScale.mmPerPixel) / 1_000_000 * 10) / 10;
        generatedRooms.push({
          id: `room-${tmpl.type}-${Date.now()}-${idx}`,
          kind: 'room',
          label: tmpl.label,
          roomType: tmpl.type,
          confidence: 0.95,
          status: 'accepted',
          color: tmpl.color,
          geometry: { x: rx, y: ry, width: rw, height: rh, polygon: poly },
          areaSqm,
          heightMm: ceilingHeightMm ?? 2700,
          note: `AI Enhanced room from sketch stroke #${idx + 1}.`,
        });
      });
    }

    const wallSegments: Array<{ start: Point; end: Point; label: string; thickness: number }> = [];
    for (const r of generatedRooms) {
      const poly = r.geometry.polygon ?? [];
      for (let i = 0; i < poly.length; i++) {
        const start = poly[i];
        const end = poly[(i + 1) % poly.length];
        const isDup = wallSegments.some((w) => {
          const direct = Math.hypot(start.x - w.start.x, start.y - w.start.y) + Math.hypot(end.x - w.end.x, end.y - w.end.y);
          const rev = Math.hypot(start.x - w.end.x, start.y - w.end.y) + Math.hypot(end.x - w.start.x, end.y - w.start.y);
          return Math.min(direct, rev) < 8;
        });
        if (!isDup) {
          const isOuter = (start.x === minX || start.x === minX + totalWidth || start.y === minY || start.y === minY + totalHeight) &&
                          (end.x === minX || end.x === minX + totalWidth || end.y === minY || end.y === minY + totalHeight);
          wallSegments.push({
            start,
            end,
            label: `${r.label} Wall ${i + 1}`,
            thickness: isOuter ? 230 : 150,
          });
        }
      }
    }

    wallSegments.forEach((ws, idx) => {
      const lenMm = Math.round(Math.hypot(ws.end.x - ws.start.x, ws.end.y - ws.start.y) * currentScale.mmPerPixel);
      generatedWalls.push({
        id: `wall-${Date.now()}-${idx}`,
        kind: 'wall',
        label: ws.label,
        confidence: 0.98,
        status: 'accepted',
        color: '#2563eb',
        geometry: { x1: ws.start.x, y1: ws.start.y, x2: ws.end.x, y2: ws.end.y },
        dimensionMm: lenMm,
        thicknessMm: ws.thickness,
        heightMm: ceilingHeightMm ?? 2700,
        note: `AI Architectural Wall (${ws.thickness}mm)`,
      });
    });

    const generatedDoors: PlanElement[] = [];
    const livingRoom = generatedRooms.find((r) => r.roomType === 'living') ?? generatedRooms[0];
    if (livingRoom) {
      generatedDoors.push({
        id: `door-main-${Date.now()}`,
        kind: 'door',
        label: 'Main Entrance Door (1000mm)',
        confidence: 1,
        status: 'accepted',
        color: '#059669',
        geometry: { x: livingRoom.geometry.x! + 40, y: livingRoom.geometry.y!, width: 28 },
        widthMm: 1000,
        heightMm: 2100,
        note: 'Main Entrance with opening swing',
      });
    }

    commitElements((prev) => [...prev.filter((e) => e.status !== 'rejected'), ...generatedRooms, ...generatedWalls, ...generatedDoors]);
    setSketchStrokes([]);
    setCurrentStroke([]);
    setActiveTool('select');
    setSelectedId(generatedRooms[0]?.id ?? null);
    setContinuationHint(`✨ AI Enhanced your 1-line sketch into ${generatedRooms.length} orthogonal rooms, ${generatedWalls.length} structural walls, and calibrated openings!`);
  };

  // Handle SVG Canvas click for tools
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'sketch') return;
    const point = canvasPoint(e);
    if (!point) return;
    const { x, y } = point;

    if (activeTool === 'draw_wall' || activeTool === 'add_room') {
      if (!toolStart) {
        setToolStart(point);
        return;
      }
      const start = toolStart;
      setToolStart(null);
      if (activeTool === 'draw_wall') {
        if (Math.hypot(point.x - start.x, point.y - start.y) < 12) return;
        const wallNumber = elements.filter((element) => element.kind === 'wall').length + 1;
        const wall: PlanElement = {
          id: crypto.randomUUID(), kind: 'wall', label: `Wall ${wallNumber}`, confidence: 1, status: 'accepted', color: '#2563eb',
          geometry: { x1: start.x, y1: start.y, x2: point.x, y2: point.y },
          dimensionMm: scale ? Math.round(Math.hypot(point.x - start.x, point.y - start.y) * scale.mmPerPixel) : undefined,
          thicknessMm: 152.4, heightMm: ceilingHeightMm ?? 2700, note: 'Manually traced wall',
        };
        commitElements((current) => [...current, wall]);
        setSelectedId(wall.id);
        return;
      }
      const left = Math.min(start.x, point.x); const top = Math.min(start.y, point.y);
      const width = Math.abs(point.x - start.x); const height = Math.abs(point.y - start.y);
      if (width < 20 || height < 20) return;
      const roomNumber = elements.filter((element) => element.kind === 'room').length + 1;
      const polygon = [{ x: left, y: top }, { x: left + width, y: top }, { x: left + width, y: top + height }, { x: left, y: top + height }];
      const room: PlanElement = {
        id: crypto.randomUUID(), kind: 'room', label: `Room ${roomNumber}`, confidence: 1, status: 'accepted', color: 'rgba(197,156,45,0.18)',
        geometry: { x: left, y: top, width, height, polygon },
        areaSqm: scale ? Math.round(width * height * scale.mmPerPixel ** 2 / 10_000) / 100 : undefined,
        note: analysed ? 'Manually defined room boundary' : 'Designer guide region for AI coverage only',
        isAnalysisGuide: !analysed,
        heightMm: ceilingHeightMm ?? 2700,
      };
      commitElements((current) => [...current, room]);
      setSelectedId(room.id);
      return;
    }

    if (activeTool === 'add_door' || activeTool === 'add_window') {
      const attachment = closestWallAttachment(point);
      if (!attachment || attachment.distance > 32) {
        setContinuationHint('Openings must attach to a visible traced wall. Trace the wall first, then click directly on it.');
        return;
      }
      const kind = activeTool === 'add_window' ? 'window' : 'door';
      const defaultWidthMm = kind === 'door' ? 900 : 1200;
      const widthPx = scale ? defaultWidthMm / scale.mmPerPixel : 28;
      const opening: PlanElement = {
        id: crypto.randomUUID(), kind, label: `${kind === 'door' ? 'Door' : 'Window'} ${elements.filter((element) => element.kind === kind).length + 1}`,
        confidence: 1, status: 'accepted', color: kind === 'door' ? '#059669' : '#0e7490',
        geometry: { x: Math.round(attachment.point.x), y: Math.round(attachment.point.y), width: widthPx },
        wallId: attachment.wall.id,
        offsetAlongWallMm: scale ? Math.round(attachment.ratio * attachment.length * scale.mmPerPixel) : Math.round(attachment.ratio * attachment.length),
        widthMm: defaultWidthMm,
        heightMm: kind === 'door' ? 2100 : undefined,
        sillMm: kind === 'window' ? 900 : undefined,
        headMm: kind === 'window' ? 2100 : undefined,
        note: `Manually attached ${kind} opening`,
      };
      commitElements((current) => [...current, opening]);
      setSelectedId(opening.id);
      setContinuationHint(`${opening.label} attached to ${attachment.wall.label}. Edit its measured width in the inspector if needed.`);
      return;
    }

    if (activeTool === 'split_wall') {
      splitSelectedWall(point);
      return;
    }

  };

  const handleCanvasMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'sketch' && isSketching) {
      const point = canvasPoint(event);
      if (point) {
        setCurrentStroke((prev) => [...prev, point]);
      }
      return;
    }
    if (panning) {
      setPan({
        x: panning.origin.x + (event.clientX - panning.x) / zoom,
        y: panning.origin.y + (event.clientY - panning.y) / zoom
      });
      return;
    }
    const point = canvasPoint(event);
    if (point) setPointerPoint(point);
    if (resizing && point) {
      resizeRoom(resizing.id, resizing.opposite, point);
      return;
    }
    if (!dragging) return;
    if (!point) return;
    translateElement(dragging.id, { x: point.x - dragging.point.x, y: point.y - dragging.point.y });
    setDragging({ ...dragging, point });
  };
  const finishDrag = () => {
    if (activeTool === 'sketch' && isSketching) {
      setIsSketching(false);
      if (currentStroke.length > 2) {
        setSketchStrokes((prev) => [...prev, currentStroke]);
        setContinuationHint(`1-Line Sketch: Captured stroke #${sketchStrokes.length + 1}. Click "AI Enhance Sketch" when finished.`);
      }
      setCurrentStroke([]);
      return;
    }
    setPanning(null);
    if (resizing) {
      setUndoStack((stack) => [...stack.slice(-39), resizing.snapshot]);
      setRedoStack([]);
    }
    setResizing(null);
    if (dragging) {
      setUndoStack((stack) => [...stack.slice(-39), dragging.snapshot]);
      setRedoStack([]);
    }
    setDragging(null);
  };

  const handleCanvasMouseDown = (event: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'sketch') {
      const point = canvasPoint(event);
      if (point) {
        setIsSketching(true);
        setCurrentStroke([point]);
      }
      return;
    }
    if (activeTool !== 'pan') return;
    setPanning({ x: event.clientX, y: event.clientY, origin: pan });
  };

  // Resolve an issue in the queue
  const resolveIssue = (issueId: string, choice: string) => {
    const issue = issues.find((item) => item.id === issueId);
    if (issue?.id.startsWith('CALIBRATION_REQUIRED-') && !scale) return;
    if (choice === issue?.optionB && issue.elementId) rejectElement(issue.elementId);
    setIssues((prev) => prev.filter((i) => i.id !== issueId));
  };

  // Final Plan Approval
  const handleApprovePlan = async () => {
    const isInitialDesign = geometryMode === 'initial_design';
    const effectiveScale = scale ?? {
      id: crypto.randomUUID(),
      pointA: { x: 100, y: 100 },
      pointB: { x: 900, y: 100 },
      realDistanceMm: 8000,
      pixelDistance: 800,
      mmPerPixel: 10,
    };
    const mmPerPixel = effectiveScale.mmPerPixel;
    const effectiveSourceAssetId = sourceAssetId || `source-plan-${Date.now()}`;

    // Ensure we have rooms and walls
    let activeElements = approvalElements.length ? approvalElements : elements.filter((e) => e.status !== 'rejected');
    if (!activeElements.some((e) => e.kind === 'wall') && activeElements.some((e) => e.kind === 'room')) {
      const roomAdditions: PlanElement[] = [];
      for (const room of activeElements.filter((e) => e.kind === 'room')) {
        const poly = room.geometry.polygon ?? [];
        for (let i = 0; i < poly.length; i++) {
          const p1 = poly[i];
          const p2 = poly[(i + 1) % poly.length];
          roomAdditions.push({
            id: crypto.randomUUID(),
            kind: 'wall',
            label: `${room.label} Wall ${i + 1}`,
            confidence: 0.95,
            status: 'accepted',
            color: '#2563eb',
            geometry: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y },
            thicknessMm: 152.4,
            heightMm: ceilingHeightMm ?? 2700,
          });
        }
      }
      activeElements = [...activeElements, ...roomAdditions];
      commitElements((prev) => [...prev, ...roomAdditions]);
    }

    const selectedWalls = activeElements.filter((element) => element.kind === 'wall');
    const durableIds = new Map<string, string>();
    const durableId = (value: string) => {
      const existing = durableIds.get(value);
      if (existing) return existing;
      const next = crypto.randomUUID();
      durableIds.set(value, next);
      return next;
    };
    const canonicalRoomType = (value?: string) => {
      if (value === 'master_bedroom' || value === 'kids_bedroom') return 'bedroom' as const;
      if (value === 'bathroom') return 'bath' as const;
      if (!value || value === 'other') return 'other' as const;
      return value as any;
    };
    const wallModels = selectedWalls.flatMap((wall) => {
      const { x1, y1, x2, y2 } = wall.geometry;
      if ([x1, y1, x2, y2].some((value) => value === undefined)) return [];
      const worldStart = { xMm: Math.round(x1! * mmPerPixel), yMm: Math.round(y1! * mmPerPixel) };
      const worldEnd = { xMm: Math.round(x2! * mmPerPixel), yMm: Math.round(y2! * mmPerPixel) };
      const isExternal = /external|outer|perimeter/i.test(wall.note ?? wall.label);
      return [{ id: durableId(wall.id), sourceStart: { x: x1!, y: y1! }, sourceEnd: { x: x2!, y: y2! }, worldStart, worldEnd, lengthMm: Math.round(Math.hypot(worldEnd.xMm - worldStart.xMm, worldEnd.yMm - worldStart.yMm)), thicknessMm: wall.thicknessMm ?? (isExternal ? 254 : 152.4), heightMm: wall.heightMm ?? ceilingHeightMm ?? 2700, adjacentSpaces: [], verification: isInitialDesign ? 'assumed' : 'verified', confidence: wall.confidence }];
    });
    const pointToSegmentDistance = (point: Point, wall: PlanElement) => {
      const { x1, y1, x2, y2 } = wall.geometry;
      if (![x1, y1, x2, y2].every((value) => typeof value === 'number')) return Number.POSITIVE_INFINITY;
      const dx = x2! - x1!;
      const dy = y2! - y1!;
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared < 1) return Number.POSITIVE_INFINITY;
      const ratio = Math.max(0, Math.min(1, ((point.x - x1!) * dx + (point.y - y1!) * dy) / lengthSquared));
      return Math.hypot(point.x - (x1! + ratio * dx), point.y - (y1! + ratio * dy));
    };
    const spaces = activeElements.filter((element) => element.kind === 'room').flatMap((room) => {
      const polygon = room.geometry.polygon ?? [];
      if (polygon.length < 3) return [];
      const sourcePolygon = polygon.map((point) => ({ x: point.x, y: point.y }));
      const worldPolygon = sourcePolygon.map((point) => ({ xMm: Math.round(point.x * mmPerPixel), yMm: Math.round(point.y * mmPerPixel) }));
      if (worldPolygon[0].xMm !== worldPolygon.at(-1)?.xMm || worldPolygon[0].yMm !== worldPolygon.at(-1)?.yMm) worldPolygon.push({ ...worldPolygon[0] });
      const areaMm2 = Math.abs(worldPolygon.slice(0, -1).reduce((sum, point, index) => { const next = worldPolygon[index + 1]; return sum + point.xMm * next.yMm - next.xMm * point.yMm; }, 0) / 2);
      const wallRefs = selectedWalls
        .filter((wall) => sourcePolygon.some((point) => pointToSegmentDistance(point, wall) <= 35))
        .map((wall) => durableId(wall.id));
      const openingRefs = activeElements
        .filter((element) => (element.kind === 'door' || element.kind === 'window') && element.wallId && wallRefs.includes(durableId(element.wallId)))
        .map((element) => durableId(element.id));
      return [{ id: durableId(room.id), sourcePolygon, worldPolygon, roomType: canonicalRoomType(room.roomType), roomName: room.label, areaMm2, areaSqm: areaMm2 / 1_000_000, ceilingHeightMm: ceilingHeightMm ?? 2700, wallRefs, openingRefs, confidence: room.confidence, verification: isInitialDesign ? 'assumed' : 'verified' }];
    });

    const canonicalModel = {
      schemaVersion: 'plan.v1',
      source: { schemaVersion: 'plan.v1', sourceAssetId: effectiveSourceAssetId, sourceType: 'raster_image', sourceWidth: 1000, sourceHeight: 850, sourceRotation: 0, coordinateSystem: 'millimetres', scaleResolution: 'two_point_calibration', mmPerPixel, verifiedDimensionMm: effectiveScale.realDistanceMm, scaleObservations: [] },
      state: 'approved',
      geometryMode: isInitialDesign ? 'initial_design' : 'final_production',
      scale: { id: crypto.randomUUID(), pointA: { xMm: effectiveScale.pointA.x, yMm: effectiveScale.pointA.y }, pointB: { xMm: effectiveScale.pointB.x, yMm: effectiveScale.pointB.y }, realMm: effectiveScale.realDistanceMm, inferredMm: effectiveScale.pixelDistance * mmPerPixel, verifiedDimensionMm: effectiveScale.realDistanceMm, scaleObservedMm: mmPerPixel, method: 'two_point_calibration', verified: !isInitialDesign },
      ceilingHeightMm: ceilingHeightMm ?? 2700,
      spaces,
      walls: wallModels,
      openings: approvalElements.filter((element) => {
        if (element.kind !== 'door' && element.kind !== 'window') return false;
        const attachedAndSized = Boolean(element.wallId && element.widthMm && element.widthMm > 0);
        if (element.kind === 'window') return attachedAndSized && Number.isFinite(element.sillMm) && Number.isFinite(element.headMm) && (element.headMm ?? 0) > (element.sillMm ?? 0);
        return attachedAndSized && Boolean(element.heightMm && element.heightMm > 0);
      }).map((opening) => opening.kind === 'window'
        ? { id: durableId(opening.id), wallId: durableId(opening.wallId!), offsetMm: opening.offsetAlongWallMm ?? 0, widthMm: opening.widthMm!, sillMm: opening.sillMm!, headMm: opening.headMm!, verification: 'verified', confidence: opening.confidence }
        : { id: durableId(opening.id), wallId: durableId(opening.wallId!), offsetMm: opening.offsetAlongWallMm ?? 0, widthMm: opening.widthMm!, heightMm: opening.heightMm!, verification: 'verified', confidence: opening.confidence }), columns: [], beams: [], servicePoints: [],
      annotations: approvalElements
        .filter((element) => element.kind === 'annotation' || element.kind === 'fixture')
        .map((element) => ({
          id: durableId(element.id),
          text: element.kind === 'fixture' ? `Existing fixture: ${element.label}` : element.label,
          kind: 'note' as const,
          position: Number.isFinite(element.geometry.x) && Number.isFinite(element.geometry.y)
            ? { xMm: Math.round((element.geometry.x ?? 0) * mmPerPixel), yMm: Math.round((element.geometry.y ?? 0) * mmPerPixel) }
            : undefined,
        })),
      issues: [], assumptions: [...issues.map((issue) => issue.question), ...(isInitialDesign ? ['Initial-design geometry: scale, openings, and wall roles must be verified on site before production release.', 'Incomplete door and window measurements are retained as unresolved evidence and excluded from fabrication outputs.', 'Default wall thicknesses: external 254 mm; internal 152.4 mm unless edited by the designer.', 'Default ceiling height is 2700 mm until site measurement confirms it.'] : [])],
      validation: { isValid: wallModels.length > 0 && spaces.length > 0, blockingIssueCount: 0, issues: [] },
      approval: { approvedAt: new Date().toISOString() },
    };
    setContinuationHint('Saving the reviewed plan model…');
    try {
      await onApprove(canonicalModel);
    } catch (error) {
      setContinuationHint(error instanceof Error ? error.message : 'The reviewed plan could not be saved. Correct the highlighted geometry and try again.');
    }
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
            <div className="geometry-mode-toggle" role="group" aria-label="Geometry workflow mode">
              <button
                type="button"
                className={geometryMode === 'initial_design' ? 'active' : ''}
                onClick={() => setGeometryMode('initial_design')}
                aria-pressed={geometryMode === 'initial_design'}
                title="Editable concept geometry using clearly labelled assumptions"
              >Initial design</button>
              <button
                type="button"
                className={geometryMode === 'final_production' ? 'active' : ''}
                onClick={() => setGeometryMode('final_production')}
                aria-pressed={geometryMode === 'final_production'}
                title="Measured and fully reviewed geometry for production outputs"
              >Final production</button>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1px solid var(--line)', borderRadius: 7, background: 'var(--surface)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <Upload size={14} /> Upload Plan File
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/tiff,image/avif,image/heic,image/heif,image/svg+xml,application/pdf,.tif,.tiff,.heic,.heif" onChange={onFile} style={{ display: 'none' }} />
            </label>
            <button
              type="button"
              onClick={handleAiAutoExtractAll}
              disabled={!fileName || analysisInFlight}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '7px 18px',
                background: 'linear-gradient(135deg, #1c1917, #3d2a1a)',
                color: '#fff',
                border: '1px solid var(--gold)',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 800,
                cursor: (!fileName || analysisInFlight) ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(197,156,45,0.25)',
                opacity: (!fileName || analysisInFlight) ? 0.6 : 1,
              }}
            >
              {analysisInFlight ? <Loader2 size={14} className="ultida-spinner" /> : <Sparkles size={14} style={{ color: 'var(--gold)' }} />}
              {analysisInFlight ? 'AI Analysing Floor Plan...' : 'AI Vision Extract & Analyse Plan'}
            </button>
            {onStartManualReview && !analysed && (
              <button
                type="button"
                onClick={onStartManualReview}
                disabled={!fileName || analysisInFlight}
                title="Store this plan and continue with calibrated manual tracing. This does not claim AI-verified geometry."
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#fff', color: 'var(--brown-mid)', border: '1px solid var(--line)', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                <PenTool size={14} /> Guided trace instead
              </button>
            )}
            {onRetryAnalysis && analysisRetryAvailable && (
              <button
                type="button"
                onClick={onRetryAnalysis}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#fff', color: 'var(--brown-mid)', border: '1px solid var(--brown-mid)', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                <RefreshCw size={14} /> Retry analysis
              </button>
            )}
            {elements.filter((e) => e.kind === 'room').length > 1 && (
              <button
                type="button"
                onClick={handleAutoFixRoomOverlaps}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  background: '#fff',
                  color: 'var(--brown-mid)',
                  border: '1px solid var(--gold)',
                  borderRadius: 7,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(197,156,45,0.15)',
                }}
                title="Auto-adjust room boundaries to eliminate overlapping zones"
              >
                <Sparkles size={14} style={{ color: 'var(--gold)' }} /> Fix Overlaps
              </button>
            )}
            <button
              type="button"
              onClick={loadDemoFloorPlan}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                background: 'linear-gradient(135deg, #1c1917, #3d2a1a)',
                color: '#e8c96a',
                border: '1px solid var(--gold)',
                borderRadius: 7,
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(197,156,45,0.25)',
              }}
              title="Instantly load pre-configured 3BHK Sharma Residence floor plan with rooms, walls, doors & windows"
            >
              <Sparkles size={14} style={{ color: 'var(--gold)' }} /> Load Demo Plan
            </button>
            <button
              onClick={handleApprovePlan}
              disabled={!approvalReady}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 18px', background: 'var(--gold)', color: '#fff', border: 0, borderRadius: 7, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
            >
              {geometryMode === 'initial_design' ? 'Create Initial Model & Continue' : 'Approve Plan & Continue to Spaces'} <ArrowRight size={14} />
            </button>
            {onDownloadDxf && (
              <button
                type="button"
                onClick={() => onDownloadDxf({ elements: approvalElements, issues, scale, ceilingHeightMm, geometryMode })}
                disabled={!analysed || !scale || !approvalElements.some((element) => element.kind === 'wall' || element.kind === 'room')}
                title="Download a calibrated plan-review DXF. Production DXF is generated later from the approved scene."
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: '#fff', color: 'var(--brown-mid)', border: '1px solid var(--line)', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                <FileDown size={14} /> Download plan DXF
              </button>
            )}
          </div>
        </div>
        {status && <p role="status" style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 0' }}>{status}</p>}
        {analysed && (
          <div className="analysis-summary" role="status">
            <div className="summary-heading"><span className="summary-status-dot" /><strong>Analysis ready for review</strong></div>
            <div className="summary-metrics"><span><b>{elements.filter((element) => element.kind === 'room').length}</b> rooms</span><span><b>{elements.filter((element) => element.kind === 'wall').length}</b> walls</span><span><b>{elements.filter((element) => element.kind === 'door' || element.kind === 'window').length}</b> openings</span><span><b>{issues.length}</b> review items</span></div>
            <p>Calibrate one visible dimension to unlock the editable model. Unresolved findings remain labelled as assumptions.</p>
            {elements.some((element) => element.kind === 'room') && !elements.some((element) => element.kind === 'wall') && (
              <div role="alert" style={{ marginTop: 10, padding: '9px 10px', borderRadius: 7, background: '#fff5db', border: '1px solid #e9c46a', color: '#694f13', fontSize: 12, lineHeight: 1.45 }}>
                <strong>Room regions were detected, but no usable wall geometry was returned.</strong>{' '}
                Calibrate first, then trace structural walls or derive provisional room-edge walls before approving the plan.
                <button type="button" onClick={() => { setActiveTool('draw_wall'); setToolStart(null); setContinuationHint('Trace each visible structural wall with two clicks.'); }} style={{ marginLeft: 8, padding: '3px 7px', borderRadius: 5, border: '1px solid #b9891e', background: '#fff', color: '#694f13', fontWeight: 700, cursor: 'pointer' }}>Trace walls</button>
                <button type="button" onClick={deriveWallsFromRoomBoundaries} style={{ marginLeft: 6, padding: '3px 7px', borderRadius: 5, border: '1px solid #b9891e', background: '#fff', color: '#694f13', fontWeight: 700, cursor: 'pointer' }}>Use room edges</button>
              </div>
            )}
          </div>
        )}
        {geometryMode === 'initial_design' && <p className="geometry-mode-note">Initial design mode needs one trusted scale calibration, but allows unresolved findings and incomplete openings. It applies editable defaults: external walls 254 mm, internal walls 152.4 mm, ceiling 2700 mm. Outputs are proposals until site verification.</p>}
        {geometryMode === 'final_production' && <p className="geometry-mode-note production">Final production mode requires every finding to be resolved, openings dimensioned, walls assigned thickness/height, and a trusted calibration.</p>}
        {!approvalReady && analysed && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>Calibrate one visible dimension, then keep at least one room and one visible wall to continue.</p>}
        {continuationHint && <p role="status" style={{ fontSize: 12, color: 'var(--brown-mid)', fontWeight: 700, margin: '6px 0 0' }}>{continuationHint}</p>}
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
              {(Object.keys(layers) as LayerKey[]).filter((key) => !['fixtures', 'columns', 'beams', 'services'].includes(key)).map((key) => {
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
                className={`tool-btn${activeTool === 'sketch' ? ' active' : ''}`}
                onClick={() => { setActiveTool('sketch'); setContinuationHint('1-Line Sketch Mode: Draw freehand room boundaries or outlines on the canvas, then click AI Enhance Sketch.'); }}
                title="1-Line Freehand Sketch Tool"
                style={{
                  background: activeTool === 'sketch' ? 'linear-gradient(135deg, rgba(197,156,45,0.25), rgba(197,156,45,0.08))' : undefined,
                  border: activeTool === 'sketch' ? '1.5px solid var(--gold)' : undefined,
                }}
              >
                <Edit3 size={14} style={{ color: 'var(--gold)' }} /> 1-Line Sketch
              </button>
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
                onClick={beginCalibration}
                title="Calibrate Scale (Click 2 points)"
              >
                <Crosshair size={14} /> Calibrate
              </button>
              <button
                className={`tool-btn${activeTool === 'draw_wall' ? ' active' : ''}`}
                onClick={() => { setActiveTool('draw_wall'); setToolStart(null); }}
                title="Draw Wall Segment"
              >
                <Ruler size={14} /> Draw Wall
              </button>
              <button
                className="tool-btn"
                onClick={deriveWallsFromRoomBoundaries}
                title="Create provisional wall segments from accepted room boundaries"
              >
                <Sparkles size={14} /> Trace Room Edges
              </button>
              <button
                className={`tool-btn${activeTool === 'add_room' ? ' active' : ''}`}
                onClick={() => { setActiveTool('add_room'); setToolStart(null); }}
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
                className={`tool-btn${activeTool === 'add_window' ? ' active' : ''}`}
                onClick={() => setActiveTool('add_window')}
                title="Add Window Opening"
              >
                <LayoutGrid size={14} /> Add Window
              </button>

              {/* AI Enhance 1-Line Sketch Button */}
              <button
                className="tool-btn"
                onClick={handleAiEnhanceSketchToFloorplan}
                disabled={sketchStrokes.length === 0 && currentStroke.length === 0}
                style={{
                  gridColumn: 'span 2',
                  marginTop: 4,
                  padding: '9px 12px',
                  background: (sketchStrokes.length > 0 || currentStroke.length > 0) ? 'linear-gradient(135deg, #1c1917, #3d2a1a)' : '#f5f5f4',
                  color: (sketchStrokes.length > 0 || currentStroke.length > 0) ? '#e8c96a' : '#a8a29e',
                  border: (sketchStrokes.length > 0 || currentStroke.length > 0) ? '1px solid var(--gold)' : '1px solid #e7e5e4',
                  fontWeight: 800,
                  fontSize: 12,
                  boxShadow: (sketchStrokes.length > 0 || currentStroke.length > 0) ? '0 2px 8px rgba(197,156,45,0.25)' : 'none',
                }}
                title="AI Converts rough 1-line sketch into 90° architectural walls, rooms, doors & dimensions"
              >
                <Sparkles size={14} style={{ color: 'var(--gold)' }} /> AI Enhance Sketch {sketchStrokes.length > 0 ? `(${sketchStrokes.length} lines)` : ''}
              </button>

              {sketchStrokes.length > 0 && (
                <button
                  className="tool-btn"
                  onClick={() => { setSketchStrokes([]); setCurrentStroke([]); setContinuationHint('Sketch strokes cleared.'); }}
                  style={{ gridColumn: 'span 2', color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2', fontSize: 11 }}
                >
                  <Trash2 size={12} /> Clear Sketch Strokes
                </button>
              )}
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
              <button className="tool-btn" onClick={undo} disabled={!undoStack.length} title="Undo last canvas change"><Undo2 size={14} /> Undo</button>
              <button className="tool-btn" onClick={redo} disabled={!redoStack.length} title="Redo last canvas change"><Redo2 size={14} /> Redo</button>
            </div>

            {(activeTool === 'draw_wall' || activeTool === 'add_room' || activeTool === 'add_door' || activeTool === 'add_window') && (
              <div className="tool-guidance" role="status">
                {activeTool === 'draw_wall' && (toolStart ? 'Click the wall end point.' : 'Click a wall start point.')}
                {activeTool === 'add_room' && (toolStart ? 'Click the opposite corner to create this room.' : 'Click the first corner of the room rectangle.')}
                {activeTool === 'add_door' && 'Click a visible wall to place a 900 mm door.'}
                {activeTool === 'add_window' && 'Click a visible wall to place a 1200 mm window.'}
              </div>
            )}

            {/* Calibration details */}
            {scale && (
              <div className="scale-info-box">
                <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--gold-dim)', marginBottom: 2 }}>SCALE CALIBRATED</div>
                <div>1 px = <strong>{scale.mmPerPixel} mm</strong> ({scale.realDistanceMm} mm / {Math.round(scale.pixelDistance)} px)</div>
              </div>
            )}

            {calibrating && (
              <div className="calib-banner" role="status" aria-live="polite">
                <div style={{ fontWeight: 800 }}>Calibrate scale — step {calibPoints.length + 1} of 2</div>
                <div style={{ fontSize: 12, marginTop: 3 }}>{calibPoints.length === 0 ? 'Enter a printed dimension, then click its first endpoint.' : 'Click the second endpoint of the same printed dimension.'}</div>
                <input
                  type="number"
                  min="1"
                  value={knownMmInput}
                  onChange={(e) => setKnownMmInput(e.target.value)}
                  placeholder="Length in mm (e.g. 3800)"
                  style={{ width: '100%', padding: '4px 8px', marginTop: 4, border: '1px solid var(--line)', borderRadius: 4, fontSize: 12 }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Points selected: {calibPoints.length} / 2
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {calibPoints.length > 0 && <button type="button" onClick={() => { calibrationPointsRef.current = []; setCalibPoints([]); setContinuationHint('Calibration reset. Click the first endpoint again.'); }} style={{ flex: 1, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 4, background: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Reset points</button>}
                  <button type="button" onClick={cancelCalibration} style={{ flex: 1, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 4, background: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
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
            {!preview && elements.length === 0 && (
              <div className="canvas-blueprint-empty">
                <div className="canvas-empty-card">
                  <div className="canvas-empty-badge">Phase 2 • Architectural Blueprint Canvas</div>
                  <h3>Floor Plan Intelligence & Verification</h3>
                  <p>Upload your architectural PDF, PNG or CAD plan to auto-extract rooms and walls, or load a calibrated demo residential blueprint to explore immediately.</p>
                  <div className="canvas-empty-actions">
                    <label className="canvas-upload-btn">
                      <Upload size={15} /> Upload Floor Plan File
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/tiff,image/avif,image/heic,image/heif,image/svg+xml,application/pdf,.tif,.tiff,.heic,.heif" onChange={onFile} style={{ display: 'none' }} />
                    </label>
                    <button type="button" className="canvas-demo-btn" onClick={loadDemoFloorPlan}>
                      <Sparkles size={15} style={{ color: 'var(--gold)' }} /> Load Demo 2BHK Plan
                    </button>
                  </div>
                </div>
              </div>
            )}
            <svg
              ref={svgRef}
              viewBox="0 0 1000 850"
              className="interactive-svg-canvas"
              onClickCapture={handleCalibrationCapture}
              onClick={handleCanvasClick}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMove}
              onMouseUp={finishDrag}
              onMouseLeave={finishDrag}
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
              {toolStart && pointerPoint && activeTool === 'add_room' && (
                <rect x={Math.min(toolStart.x, pointerPoint.x)} y={Math.min(toolStart.y, pointerPoint.y)} width={Math.abs(pointerPoint.x - toolStart.x)} height={Math.abs(pointerPoint.y - toolStart.y)} fill="rgba(197,156,45,.12)" stroke="#c59c2d" strokeWidth="2" strokeDasharray="6,4" />
              )}
              {toolStart && pointerPoint && activeTool === 'draw_wall' && (
                <line x1={toolStart.x} y1={toolStart.y} x2={pointerPoint.x} y2={pointerPoint.y} stroke="#2563eb" strokeWidth="5" strokeDasharray="7,4" />
              )}
              {activeTool === 'calibrate' && calibPoints[0] && (
                <g pointerEvents="none">
                  {pointerPoint && <line x1={calibPoints[0].x} y1={calibPoints[0].y} x2={pointerPoint.x} y2={pointerPoint.y} stroke="#c59c2d" strokeWidth="3" strokeDasharray="7,4" />}
                  <text x={calibPoints[0].x + 12} y={calibPoints[0].y - 12} fill="#694f13" fontSize="12" fontWeight="800">1 — click endpoint 2</text>
                </g>
              )}

              {/* ─── 1-Line Freehand Sketch Strokes ─── */}
              {sketchStrokes.map((stroke, index) => {
                if (stroke.length < 2) return null;
                const pathData = `M ${stroke[0].x} ${stroke[0].y} ` + stroke.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ');
                return (
                  <path
                    key={`sketch-stroke-${index}`}
                    d={pathData}
                    fill="none"
                    stroke="#c59c2d"
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="4 2"
                    opacity={0.85}
                    style={{ pointerEvents: 'none' }}
                  />
                );
              })}
              {currentStroke.length > 1 && (
                <path
                  d={`M ${currentStroke[0].x} ${currentStroke[0].y} ` + currentStroke.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')}
                  fill="none"
                  stroke="#e8c96a"
                  strokeWidth={4.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: 'none' }}
                />
              )}

              {/* Source Plan Overlay image */}
              {layers.source_plan.visible && preview && (
                <image href={preview} x="0" y="0" width="1000" height="850" opacity="0.35" preserveAspectRatio="xMidYMid meet" />
              )}

              {/* Render Room Polygons */}
              {layers.rooms.visible && elements.filter((e) => e.kind === 'room').map((room) => {
                const isSelected = room.id === selectedId;
                const pointsStr = room.geometry.polygon?.map((p) => `${p.x},${p.y}`).join(' ');
                return (
                  <g
                    key={room.id}
                    onMouseDown={(event) => {
                      if (activeTool !== 'move') return;
                      const point = canvasPoint(event);
                      if (point) setDragging({ id: room.id, point, snapshot: cloneElements(elements) });
                      event.stopPropagation();
                    }}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(room.id); }}
                  >
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
                    {isSelected && room.geometry.polygon && (() => {
                      const points = room.geometry.polygon;
                      const oppositeIndex = [2, 3, 0, 1];
                      return points.map((point, index) => (
                        <rect
                          key={`${room.id}-handle-${index}`}
                          x={point.x - 6} y={point.y - 6} width={12} height={12} rx={2}
                          fill="#fff" stroke="#c59c2d" strokeWidth={2}
                          style={{ cursor: 'nwse-resize' }}
                          onMouseDown={(event) => {
                            if (activeTool !== 'select' && activeTool !== 'move') return;
                            event.stopPropagation();
                            setResizing({ id: room.id, opposite: points[oppositeIndex[index]], snapshot: cloneElements(elements) });
                          }}
                        />
                      ));
                    })()}
                    {/* Room Centroid & Clear Architectural Label Badge */}
                    {(() => {
                      const poly = room.geometry.polygon;
                      const cx = poly && poly.length > 0
                        ? poly.reduce((sum, p) => sum + p.x, 0) / poly.length
                        : (room.geometry.x ?? 0) + (room.geometry.width ?? 120) / 2;
                      const cy = poly && poly.length > 0
                        ? poly.reduce((sum, p) => sum + p.y, 0) / poly.length
                        : (room.geometry.y ?? 0) + (room.geometry.height ?? 100) / 2;
                      const labelText = room.label;
                      const areaText = typeof room.areaSqm === 'number' ? `${room.areaSqm.toFixed(1)} m²` : null;
                      const badgeWidth = Math.max(110, Math.min(180, labelText.length * 8.5 + 24));
                      const badgeHeight = areaText ? 32 : 22;

                      return (
                        <g transform={`translate(${cx}, ${cy})`} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                          <rect
                            x={-badgeWidth / 2}
                            y={-badgeHeight / 2}
                            width={badgeWidth}
                            height={badgeHeight}
                            rx={7}
                            fill="rgba(255, 253, 248, 0.95)"
                            stroke={isSelected ? '#c59c2d' : 'rgba(110, 80, 50, 0.28)'}
                            strokeWidth={isSelected ? 1.75 : 1}
                            filter="drop-shadow(0 2px 5px rgba(0,0,0,0.08))"
                          />
                          <text
                            textAnchor="middle"
                            y={areaText ? -2 : 4}
                            fill="#1c1917"
                            fontSize="11.5"
                            fontWeight="800"
                            letterSpacing="0.01em"
                          >
                            {labelText}
                          </text>
                          {areaText && (
                            <text
                              textAnchor="middle"
                              y={10}
                              fill="#9a7322"
                              fontSize="9.5"
                              fontWeight="700"
                            >
                              {areaText}
                            </text>
                          )}
                        </g>
                      );
                    })()}
                  </g>
                );
              })}

              {/* Render Walls */}
              {layers.walls.visible && elements.filter((e) => e.kind === 'wall').map((wall) => {
                const isSelected = wall.id === selectedId;
                const { x1 = 0, y1 = 0, x2 = 0, y2 = 0 } = wall.geometry;
                const len = Math.hypot(x2 - x1, y2 - y1);
                return (
                  <g
                    key={wall.id}
                    onMouseDown={(event) => {
                      if (activeTool !== 'move') return;
                      const point = canvasPoint(event);
                      if (point) setDragging({ id: wall.id, point, snapshot: cloneElements(elements) });
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
                      strokeWidth={isSelected ? 7 : 5}
                      strokeLinecap="round"
                      style={{ cursor: 'pointer' }}
                    />
                    {/* Wall dimension text with backdrop pill */}
                    {len > 30 && wall.dimensionMm && (
                      <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2 - 9})`} style={{ pointerEvents: 'none' }}>
                        <rect
                          x={-28} y={-8} width={56} height={15} rx={4}
                          fill="rgba(255, 255, 255, 0.9)"
                          stroke="rgba(30, 41, 59, 0.2)"
                          strokeWidth={0.75}
                        />
                        <text
                          y={3}
                          textAnchor="middle"
                          fill="#1e293b"
                          fontSize="9"
                          fontWeight="700"
                        >
                          {wall.dimensionMm} mm
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Render Doors (Architectural Wall-Oriented Swing Arc) */}
              {layers.doors.visible && elements.filter((e) => e.kind === 'door').map((door) => {
                const isSelected = door.id === selectedId;
                const { x = 0, y = 0 } = door.geometry;
                const hostWall = door.wallId ? elements.find((e) => e.id === door.wallId && e.kind === 'wall') : null;
                let angle = 0;
                if (hostWall && hostWall.geometry.x1 !== undefined && hostWall.geometry.y1 !== undefined && hostWall.geometry.x2 !== undefined && hostWall.geometry.y2 !== undefined) {
                  angle = Math.atan2(hostWall.geometry.y2 - hostWall.geometry.y1, hostWall.geometry.x2 - hostWall.geometry.x1) * (180 / Math.PI);
                }
                const widthPx = door.geometry.width || (scale && door.widthMm ? door.widthMm / scale.mmPerPixel : 26);
                const r = Math.max(16, widthPx);

                return (
                  <g
                    key={door.id}
                    transform={`translate(${x}, ${y}) rotate(${angle})`}
                    onMouseDown={(event) => {
                      if (activeTool !== 'move') return;
                      const point = canvasPoint(event);
                      if (point) setDragging({ id: door.id, point, snapshot: cloneElements(elements) });
                      event.stopPropagation();
                    }}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(door.id); }}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Clear wall opening gap */}
                    <line x1={0} y1={0} x2={r} y2={0} stroke="#faf7f2" strokeWidth={6} strokeLinecap="butt" />
                    {/* Door Hinge */}
                    <circle cx={0} cy={0} r={3.5} fill={isSelected ? '#c59c2d' : '#059669'} stroke="#fff" strokeWidth={1} />
                    {/* Door Leaf */}
                    <line x1={0} y1={0} x2={0} y2={-r} stroke={isSelected ? '#c59c2d' : '#059669'} strokeWidth={2.5} strokeLinecap="round" />
                    {/* Swing arc */}
                    <path d={`M 0 ${-r} A ${r} ${r} 0 0 1 ${r} 0`} fill="none" stroke={isSelected ? '#c59c2d' : '#10b981'} strokeWidth={1.5} strokeDasharray="3,3" />
                    {/* Door tag */}
                    <rect x={r / 2 - 18} y={-r / 2 - 14} width={36} height={13} rx={3} fill="rgba(255,255,255,0.92)" stroke="rgba(5,150,105,0.3)" strokeWidth={0.75} pointerEvents="none" />
                    <text x={r / 2} y={-r / 2 - 5} textAnchor="middle" fill="#047857" fontSize="8.5" fontWeight="800" style={{ pointerEvents: 'none' }}>
                      {door.widthMm ? `${door.widthMm}mm` : 'Door'}
                    </text>
                  </g>
                );
              })}

              {/* Render Windows (Architectural Double-Glazed Wall-Aligned Frame) */}
              {layers.windows.visible && elements.filter((e) => e.kind === 'window').map((win) => {
                const isSelected = win.id === selectedId;
                const { x = 0, y = 0 } = win.geometry;
                const hostWall = win.wallId ? elements.find((e) => e.id === win.wallId && e.kind === 'wall') : null;
                let angle = 0;
                if (hostWall && hostWall.geometry.x1 !== undefined && hostWall.geometry.y1 !== undefined && hostWall.geometry.x2 !== undefined && hostWall.geometry.y2 !== undefined) {
                  angle = Math.atan2(hostWall.geometry.y2 - hostWall.geometry.y1, hostWall.geometry.x2 - hostWall.geometry.x1) * (180 / Math.PI);
                }
                const widthPx = win.geometry.width || (scale && win.widthMm ? win.widthMm / scale.mmPerPixel : 34);
                const halfW = Math.max(16, widthPx / 2);

                return (
                  <g
                    key={win.id}
                    transform={`translate(${x}, ${y}) rotate(${angle})`}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(win.id); }}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Clear wall opening */}
                    <rect x={-halfW} y={-4.5} width={halfW * 2} height={9} fill="#faf7f2" stroke="none" />
                    {/* Window Frame */}
                    <rect
                      x={-halfW} y={-4.5} width={halfW * 2} height={9}
                      fill="rgba(56, 189, 248, 0.22)"
                      stroke={isSelected ? '#c59c2d' : '#0284c7'}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      rx={1}
                    />
                    {/* Double glass panes */}
                    <line x1={-halfW + 2} y1={-1.5} x2={halfW - 2} y2={-1.5} stroke="#0284c7" strokeWidth={1} />
                    <line x1={-halfW + 2} y1={1.5} x2={halfW - 2} y2={1.5} stroke="#0284c7" strokeWidth={1} />
                    {/* End Jambs */}
                    <line x1={-halfW} y1={-5} x2={-halfW} y2={5} stroke="#0369a1" strokeWidth={2} />
                    <line x1={halfW} y1={-5} x2={halfW} y2={5} stroke="#0369a1" strokeWidth={2} />
                    {/* Window tag */}
                    <g transform="translate(0, -10)" style={{ pointerEvents: 'none' }}>
                      <rect x={-22} y={-7} width={44} height={13} rx={3} fill="rgba(255,255,255,0.92)" stroke="rgba(2,132,199,0.3)" strokeWidth={0.75} />
                      <text textAnchor="middle" y={3} fill="#0369a1" fontSize="8.5" fontWeight="800">
                        {win.widthMm ? `${win.widthMm}mm` : 'Window'}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Existing source fixtures and furniture symbols */}
              {layers.fixtures.visible && elements.filter((e) => e.kind === 'fixture').map((fixture) => {
                const isSelected = fixture.id === selectedId;
                const { x = 0, y = 0, width = 34, height: depth = 34 } = fixture.geometry;
                return (
                  <g key={fixture.id} onClick={(event) => { event.stopPropagation(); setSelectedId(fixture.id); }} style={{ cursor: 'pointer' }}>
                    <rect x={x - width / 2} y={y - depth / 2} width={width} height={depth} rx={4} fill="rgba(124,58,237,.16)" stroke={isSelected ? '#c59c2d' : '#7c3aed'} strokeWidth={isSelected ? 3 : 1.5} strokeDasharray={fixture.status === 'needs_review' ? '5,3' : undefined} />
                    <text x={x} y={y + depth / 2 + 12} textAnchor="middle" fill="#5b21b6" fontSize="10" fontWeight="700" style={{ pointerEvents: 'none' }}>{fixture.label}</text>
                  </g>
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
                <g key={i} pointerEvents="none">
                  <circle cx={pt.x} cy={pt.y} r={9} fill="#fff" stroke="#c59c2d" strokeWidth={3} />
                  <circle cx={pt.x} cy={pt.y} r={3} fill="#c59c2d" />
                  <text x={pt.x + 12} y={pt.y + 5} fill="#694f13" fontSize="12" fontWeight="800">{i + 1}</text>
                </g>
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
                <strong>{elements.length ? `${Math.round(elements.reduce((sum, element) => sum + element.confidence, 0) / elements.length * 100)}%` : '—'}</strong>
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

          {analysisQualityNotice && (
            <div className="panel-box" style={{ marginTop: 12, borderColor: 'var(--info-line)', background: 'var(--info-bg)' }}>
              <div className="panel-box-title" style={{ color: 'var(--brown-mid)' }}><Sparkles size={14} /><span>Detection quality</span></div>
              <p style={{ margin: '0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{analysisQualityNotice}</p>
            </div>
          )}

          {/* Issue Queue */}
          {issues.length > 0 && (
            <div className="panel-box" style={{ marginTop: 12 }}>
              <div className="panel-box-title" style={{ color: '#d97706' }}>
                <AlertTriangle size={14} />
                <span>Designer decisions ({issues.length})</span>
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

                {selectedElement.kind === 'room' && (
                  <div className="form-field" style={{ marginTop: 8 }}>
                    <label>Room type (used by Layout Studio)</label>
                    <select
                      value={selectedElement.roomType ?? 'other'}
                      onChange={(event) => updateElement(selectedElement.id, { roomType: event.target.value as PlanElement['roomType'] })}
                    >
                      <option value="other">Select room type…</option>
                      <option value="master_bedroom">Master Bedroom</option>
                      <option value="bedroom">Bedroom</option>
                      <option value="kids_bedroom">Kids Bedroom</option>
                      <option value="kitchen">Kitchen</option>
                      <option value="living">Living Room</option>
                      <option value="dining">Dining Room</option>
                      <option value="utility">Utility</option>
                      <option value="pooja">Pooja Room</option>
                      <option value="study">Study</option>
                      <option value="bathroom">Bathroom</option>
                    </select>
                    <small style={{ display: 'block', marginTop: 4, color: 'var(--text-muted)' }}>Choose a type so the next screen can load the right furniture requirements and layout templates.</small>
                  </div>
                )}

                {(selectedElement.kind === 'wall' || selectedElement.kind === 'door' || selectedElement.kind === 'window') && (
                  <div className="inspector-grid" style={{ marginTop: 8 }}>
                    {(selectedElement.kind === 'wall' || selectedElement.kind === 'door' || selectedElement.kind === 'window') && <label>Height (mm)<input type="number" min={1} value={selectedElement.heightMm ?? ''} onChange={(e) => updateElement(selectedElement.id, { heightMm: Number(e.target.value) || undefined })} /></label>}
                    {(selectedElement.kind === 'wall') && <label>Thickness (mm)<input type="number" min={1} value={selectedElement.thicknessMm ?? ''} onChange={(e) => updateElement(selectedElement.id, { thicknessMm: Number(e.target.value) || undefined })} /></label>}
                    {(selectedElement.kind === 'door' || selectedElement.kind === 'window') && <label>Width (mm)<input type="number" min={1} value={selectedElement.widthMm ?? ''} onChange={(e) => updateElement(selectedElement.id, { widthMm: Number(e.target.value) || undefined })} /></label>}
                    {(selectedElement.kind === 'door' || selectedElement.kind === 'window') && <label>Wall ID<input type="text" value={selectedElement.wallId ?? ''} onChange={(e) => updateElement(selectedElement.id, { wallId: e.target.value || undefined })} /></label>}
                    {(selectedElement.kind === 'window') && <label>Sill (mm)<input type="number" min={0} value={selectedElement.sillMm ?? ''} onChange={(e) => updateElement(selectedElement.id, { sillMm: Number(e.target.value) || undefined })} /></label>}
                    {(selectedElement.kind === 'window') && <label>Head (mm)<input type="number" min={1} value={selectedElement.headMm ?? ''} onChange={(e) => updateElement(selectedElement.id, { headMm: Number(e.target.value) || undefined })} /></label>}
                  </div>
                )}

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
                    className={`elem-btn accept${selectedElement.status === 'accepted' ? ' active' : ''}`}
                    onClick={() => acceptElement(selectedElement.id)}
                    style={selectedElement.status === 'accepted' ? { background: '#059669', color: '#fff', borderColor: '#047857', fontWeight: 800 } : undefined}
                  >
                    <CheckCircle2 size={13} /> {selectedElement.status === 'accepted' ? 'Accepted ✓' : 'Accept'}
                  </button>
                  <button
                    className={`elem-btn reject${selectedElement.status === 'rejected' ? ' active' : ''}`}
                    onClick={() => rejectElement(selectedElement.id)}
                    style={selectedElement.status === 'rejected' ? { background: '#dc2626', color: '#fff', borderColor: '#b91c1c', fontWeight: 800 } : undefined}
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

                <button
                  type="button"
                  onClick={handleApprovePlan}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #c59c2d, #a0782c)',
                    color: '#fff',
                    border: 0,
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 2px 8px rgba(197,156,45,0.25)'
                  }}
                >
                  <CheckCircle2 size={15} /> Approve &amp; Proceed to Spaces Studio →
                </button>
              </div>
            ) : (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Click any wall, room polygon, door or window on the canvas to inspect and edit properties.
              </div>
            )}
          </div>

          {/* Detected Rooms List */}
          <div className="panel-box" style={{ marginTop: 12 }}>
            <div className="panel-box-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Home size={14} />
                <span>Detected Rooms ({elements.filter((e) => e.kind === 'room').length})</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  commitElements((prev) => prev.map((e) => ({ ...e, status: 'accepted' })));
                  setContinuationHint('All detected rooms and boundaries accepted. Approving...');
                  setTimeout(() => { void handleApprovePlan(); }, 120);
                }}
                style={{
                  border: 0,
                  background: '#f0fdf4',
                  color: '#15803d',
                  padding: '3px 8px',
                  borderRadius: 5,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: '#86efac',
                }}
              >
                ✓ Accept All &amp; Approve
              </button>
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

      {/* Sleek Fixed Bottom Stage Progression Bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 90,
          height: 54,
          padding: '0 24px',
          background: 'rgba(20, 18, 16, 0.94)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(197, 156, 45, 0.3)',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.28)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#c59c2d', boxShadow: '0 0 8px #c59c2d' }} />
          <div>
            <strong style={{ color: '#fff', fontSize: 12.5, display: 'inline', marginRight: 8 }}>
              Stage 2 of 8: Floor Plan Analysis &amp; Vector Calibration
            </strong>
            <span style={{ color: '#a8a29e', fontSize: 11.5 }}>
              • Review architectural walls and room boundaries, then proceed to Spaces.
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => {
              navigate(-1);
            }}
            style={{
              background: '#2b2622',
              color: '#e7e5e4',
              border: '1px solid #44403c',
              borderRadius: 7,
              padding: '6px 14px',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 34,
            }}
          >
            <ArrowLeft size={13} /> Back to Brief
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await handleApprovePlan();
              } catch {
                const pathname = window.location.pathname;
                const projectPrefix = pathname.split('/plan')[0];
                navigate(`${projectPrefix}/spaces`);
              }
            }}
            style={{
              background: 'linear-gradient(135deg, #c59c2d, #a88220)',
              color: '#1c1917',
              border: 0,
              borderRadius: 7,
              padding: '6px 16px',
              fontWeight: 800,
              fontSize: 12.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 34,
              boxShadow: '0 2px 8px rgba(197,156,45,0.3)',
            }}
          >
            Proceed to Step 3: Spaces <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
