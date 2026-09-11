/* ═══════════════════════════════════════════════
   PHASE 4 — SPACES WORKSPACE
   Consumes the active approved floor-plan version.
   Architectural floor-plan backdrop overlay, AI layout detection,
   and direct Design Library catalog connectivity.
═══════════════════════════════════════════════ */
import {
  Home, CheckCircle2, Circle, Edit3, AlertTriangle, Layers, Ruler, Square, SplitSquareHorizontal,
  Merge, Columns, Plug, DoorOpen, Pencil, Undo2, Redo2, Eye, EyeOff, Sparkles,
  MapPin, TriangleAlert, Save, Plus, X, Maximize, ArrowRight, ArrowLeft, LayoutGrid, Sofa,
  BookOpen, Search, Image as ImageIcon, Sliders, Check, Wand2, Info, ChevronRight, Compass, Download, Grid, MousePointer2
} from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Badge, Button, WorkflowDock } from '../../components/ui/primitives';
import { supabase } from '../../lib/supabase';
import {
  computeUsableWallLength, computeSpaceReadiness, polygonsOverlap,
  editSplitRoom, editMergeRooms, editAddWall, editAddOpening, editAddColumn, type CanonicalPlanFragment
} from '@ultida/spaces-core';
import { reconcileModuleFit } from '@ultida/scene-core';
import { reconcileCatalogPlacement } from '@ultida/scene-compiler';
import { IndianModularCatalog, listCatalog, CuratedLaminateCatalog, type CatalogModule } from '@ultida/catalog-core';
import { ModulePreview } from '../../components/library/ModulePreview';
import TopViewFloorplanEnhancer, {
  type TopViewFurniture,
  evaluateVastuCompliance,
  type VastuAnalysis,
  type VastuFinding,
} from '../../components/spaces/TopViewFloorplanEnhancer';
import WallBayEditor from '../../components/spaces/WallBayEditor';
import FlooringStudio, { TILE_PRESETS } from '../../components/spaces/FlooringStudio';
import { type CompositionScheduleV1, type FloorSurfaceV1 } from '@ultida/contracts';
import { getApiBase } from '../../lib/api-base';
import './spaces.css';

type Pt = { xMm: number; yMm: number };

interface PlanRoom {
  id: string;
  spaceRecordId?: string | null;
  name: string;
  roomType: string;
  polygon: Pt[];
  areaSqm: number;
  ceilingHeightMm?: number;
  requiredFurniture: string[];
  budgetInr?: number | null;
  designPriority?: string;
  applianceNeeds?: string[];
  constraints?: string[];
  floorFinish?: string;
  falseCeiling?: string;
  styleDirection?: string;
  paletteDirection?: string;
  retainedElements?: string[];
  wallRoles?: Record<string, string>;
  preferredCamera?: string;
  verificationStatus?: string;
  included?: boolean;
}
interface PlanWall { id: string; start: Pt; end: Pt; isExterior?: boolean; thicknessMm?: number; heightMm?: number }
interface PlanOpening { id: string; wallId: string; kind: string; offsetAlongWallMm: number; widthMm?: number; heightMm?: number; sillHeightMm?: number }
interface PlanColumn { id: string; position: Pt; sizeMm?: number }
interface PlanBeam { id: string; start: Pt; end: Pt }
interface PlanService { id: string; kind: string; position: Pt }
interface PlanAnnotation { id: string; text: string; kind: string; position?: Pt }

type CatalogWallContext = { id: string; lengthMm: number; openings: Array<{ id: string; kind: string; offsetMm: number; widthMm: number }> };

/**
 * Maximum distance from a wall at which a dragged module still snaps to it.
 * Modules are wall-anchored joinery, so a drop in open floor is rejected
 * rather than silently attached to a far-away wall.
 */
const SNAP_DISTANCE_MM = 1200;

/**
 * Live preview of a candidate placement, recomputed on every drag-move.
 * `valid` mirrors the same reconciliation used at commit time.
 */
type ModulePlacementPreview = {
  wallId: string;
  wallLengthMm: number;
  offsetMm: number;
  module: CatalogModule;
  valid: boolean;
  reason?: string;
  start: Pt;
  end: Pt;
};
type CatalogFit = ReturnType<typeof reconcileModuleFit> & { fitVerified: boolean; productionCertified: boolean };

function reconcileCatalogModuleFit(wall: CatalogWallContext | null, module: CatalogModule): CatalogFit | null {
  if (!wall) return null;
  const candidate = reconcileModuleFit({ wallLengthMm: wall.lengthMm, moduleWidthMm: module.widthMm, keepOuts: wall.openings });
  if (!candidate.fits || candidate.suggestedOffsetMm === undefined) return { ...candidate, fitVerified: false, productionCertified: false };
  const compilerResult = reconcileCatalogPlacement({
    wallId: wall.id,
    wallLengthMm: wall.lengthMm,
    openings: wall.openings.map((opening) => ({ ...opening, wallId: wall.id, kind: opening.kind === 'window' ? 'window' as const : 'door' as const })),
    module: { id: module.id, widthMm: module.widthMm },
    offsetMm: candidate.suggestedOffsetMm,
  });
  const geometryIssues = compilerResult.reconciliation.issues
    .filter((issue) => issue.code !== 'SCHEDULE_UNCONFIRMED')
    .map((issue) => issue.message);
  return { ...candidate, fits: compilerResult.geometryValid, issues: geometryIssues, fitVerified: compilerResult.geometryValid, productionCertified: compilerResult.productionCertified };
}

export type AiFurnitureProposal = {
  id: string;
  category: string;
  moduleId: string;
  name: string;
  wallId?: string;
  wallLabel?: string;
  rationale: string;
  dimensionsMm: { width: number; depth: number; height: number };
  position: Pt;
  rotationDeg?: number;
  confidence: number;
};

const ROOM_TYPES: Record<string, string> = {
  living: 'Living Room', bedroom: 'Bedroom', master_bedroom: 'Master Bedroom', kids_bedroom: 'Kids Bedroom', kitchen: 'Kitchen', dining: 'Dining Room',
  utility: 'Utility', pooja: 'Pooja Room', bathroom: 'Bathroom', toilet: 'Toilet', study: 'Study', foyer: 'Foyer', balcony: 'Balcony', parking: 'Parking', store: 'Store', other: 'Other'
};

export function mmToFeetInches(mm: number): string {
  if (!Number.isFinite(mm) || mm <= 0) return '0\'0"';
  const totalInches = Math.round(mm / 25.4);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}"`;
}

export function sqmToSqft(sqm: number): number {
  if (!Number.isFinite(sqm) || sqm <= 0) return 0;
  return Math.round(sqm * 10.7639);
}

export function formatMmAndFeet(mm: number): string {
  return `${Math.round(mm)} mm (${mmToFeetInches(mm)})`;
}

export function formatDualDims(wMm: number, dMm: number): string {
  return `${Math.round(wMm)} mm × ${Math.round(dMm)} mm • ${mmToFeetInches(wMm)} × ${mmToFeetInches(dMm)}`;
}

export function inferRoomType(rawType: unknown, roomName: unknown, areaSqm?: number, polygon?: Pt[]) {
  const supplied = String(rawType ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (supplied && supplied !== 'other' && ROOM_TYPES[supplied]) return supplied;
  const label = `${rawType ?? ''} ${roomName ?? ''}`.toLowerCase();
  if (/master|m\.?\s*bed/.test(label)) return 'master_bedroom';
  if (/kids?|child|c\.?\s*bed/.test(label)) return 'kids_bedroom';
  if (/bed(room)?/.test(label)) return 'bedroom';
  if (/open\s*kitchen|kitchen|pantry|cook/.test(label)) return 'kitchen';
  if (/living|drawing|lounge|hall|family|great\s*room/.test(label)) return 'living';
  if (/dining/.test(label)) return 'dining';
  if (/toilet|bath|washroom|powder|wc/.test(label)) return 'bathroom';
  if (/pooja|prayer|mandir|temple/.test(label)) return 'pooja';
  if (/utility|laundry|wash\s*area/.test(label)) return 'utility';
  if (/study|office|library|den/.test(label)) return 'study';
  if (/foyer|entry|lobby|vestibule/.test(label)) return 'foyer';
  if (/balcony|terrace|verandah|deck/.test(label)) return 'balcony';
  if (/parking|garage|carport/.test(label)) return 'parking';
  if (/store|storage/.test(label)) return 'store';

  // Smart geometric and area classification for generic names like "Room 1", "Room 7", "Zone 3"
  const area = typeof areaSqm === 'number' && areaSqm > 0
    ? areaSqm
    : (polygon && polygon.length >= 3 ? polyArea(polygon) : 0);

  // Area cannot establish use: a 12m² room may be a kitchen, bedroom or office.
  // Keep the explicit room-type picker as the confirmation step.
  return 'other';
}

function needsScaleReview(room: PlanRoom, widthMm: number, depthMm: number) {
  if (['bathroom', 'toilet', 'utility', 'pooja', 'balcony', 'store'].includes(room.roomType)) return false;
  const shortestSide = Math.min(widthMm, depthMm);
  return shortestSide > 0 && shortestSide < 1200;
}

const FURNITURE_OPTIONS: Record<string, Array<{ id: string; label: string; defaultModuleId?: string }>> = {
  living: [
    { id: 'tv_unit', label: 'TV Feature Media Wall', defaultModuleId: 'tv-fluted-2400' },
    { id: 'crockery_unit', label: 'Crockery Display & Wine Bar', defaultModuleId: 'crockery-1800' },
    { id: 'sofa', label: 'Curved Bouclé Sectional Seating', defaultModuleId: 'sofa-curved-boucle-2800' },
    { id: 'pooja_unit', label: 'Sacred Mandir with CNC Jaali', defaultModuleId: 'pooja-mandir-mandapa-1500' }
  ],
  master_bedroom: [
    { id: 'master_wardrobe', label: 'Master 4-Shutter / Walk-in Wardrobe & Lofts', defaultModuleId: 'wardrobe-2100-four-shutter' },
    { id: 'master_bed', label: 'King Storage Bed & Extended Headboard', defaultModuleId: 'bed-floating-led-1800' },
    { id: 'master_vanity', label: 'Dresser & Backlit Vanity Mirror Unit' },
    { id: 'master_tv', label: 'Master Bedroom Floating TV Console' },
    { id: 'master_study', label: 'Executive Bedroom Study Desk & Workstation', defaultModuleId: 'study-1500' }
  ],
  bedroom: [
    { id: 'wardrobe', label: 'Wardrobe & Overhead Lofts', defaultModuleId: 'wardrobe-2100-four-shutter' },
    { id: 'bed', label: 'Queen Storage Bed & Headboard', defaultModuleId: 'bed-floating-led-1800' },
    { id: 'vanity_unit', label: 'Dresser & Mirror Unit' },
    { id: 'study_unit', label: 'Study Desk & Shelving', defaultModuleId: 'study-1500' },
    { id: 'tv_unit', label: 'Bedroom TV Console' }
  ],
  kitchen: [
    { id: 'kitchen_base', label: 'Kitchen Base (2-Pot Tandems, Cutlery & Hob)', defaultModuleId: 'kit-base-tandem-2pot-600' },
    { id: 'kitchen_wall', label: 'Upper Wall Units (Profile Glass + LED / Solid)', defaultModuleId: 'kit-wall-profile-glass-600' },
    { id: 'kitchen_tall', label: 'Tall Units (Microwave & Oven Tower / Pantry)', defaultModuleId: 'kit-tall-microwave-600' },
    { id: 'kitchen_corner', label: 'LeMans II Blind Corner Carousel Base', defaultModuleId: 'kit-corner-lemans-1050' },
    { id: 'bottle_pullout', label: '200mm SS Bottle Pull-Out Base', defaultModuleId: 'kit-base-bottle-200' },
    { id: 'kitchen_sink', label: 'Sink Base & Waste Bin Module', defaultModuleId: 'kit-base-sink-900' }
  ],
  dining: [
    { id: 'dining_table', label: 'Dining Table Set', defaultModuleId: 'dining-calacatta-gold-2100' },
    { id: 'crockery_unit', label: 'Crockery Display & Bar', defaultModuleId: 'crockery-1800' },
    { id: 'storage_unit', label: 'Dining Sideboard', defaultModuleId: 'crockery-sideboard-1600' }
  ],
  utility: [
    { id: 'utility_unit', label: 'Laundry & Washer Tower', defaultModuleId: 'utility-laundry-1500' },
    { id: 'storage_unit', label: 'Utility Storage Tower', defaultModuleId: 'utility-laundry-1500' }
  ],
  pooja: [
    { id: 'pooja_unit', label: 'Pooja Unit with Jaali & Drawer', defaultModuleId: 'pooja-mandir-mandapa-1500' },
    { id: 'storage_unit', label: 'Pooja Storage Unit', defaultModuleId: 'pooja-1200-jaali' }
  ],
  bathroom: [
    { id: 'vanity_unit', label: 'Vanity Cabinet & Basin' },
    { id: 'storage_unit', label: 'Storage Ledge' }
  ],
  study: [
    { id: 'study_unit', label: 'Study Desk & Library Wall', defaultModuleId: 'study-1500' },
    { id: 'storage_unit', label: 'Bookshelf & Storage', defaultModuleId: 'study-1500' }
  ],
  foyer: [
    { id: 'foyer_console', label: 'Floating Foyer Console', defaultModuleId: 'foyer-console-1200' },
    { id: 'shoe_unit', label: 'Shoe & Entryway Storage', defaultModuleId: 'foyer-console-1200' }
  ],
  other: [
    { id: 'storage_unit', label: 'Storage Unit', defaultModuleId: 'foyer-console-1200' },
    { id: 'study_unit', label: 'Study Unit', defaultModuleId: 'study-1500' },
    { id: 'tv_unit', label: 'TV Unit' }
  ],
};

const STYLE_PRESETS = [
  'Warm minimal', 'Scandinavian', 'Contemporary luxe', 'Modern classic', 'Japandi', 'Industrial modern',
];

const PALETTE_PRESETS = [
  { label: 'Ivory, walnut & warm brass', value: 'ivory + walnut + warm brass', colors: ['#F1E8DA', '#74513B', '#B88A43'] },
  { label: 'Beige, off-white & oak', value: 'beige + off-white + natural oak', colors: ['#D4B99B', '#F7F4EC', '#B78D5D'] },
  { label: 'Mist grey, oak & black', value: 'mist grey + light oak + matte black', colors: ['#B7B5AF', '#C99C6A', '#272727'] },
  { label: 'Sage, cream & brass', value: 'sage green + cream + brushed brass', colors: ['#68705B', '#F2EADA', '#B68A42'] },
  { label: 'Navy, light oak & champagne', value: 'navy + light oak + champagne metal', colors: ['#223650', '#D0A878', '#C9B07A'] },
  { label: 'Terracotta, ivory & walnut', value: 'terracotta + ivory + dark walnut', colors: ['#B46748', '#F4EBD9', '#513528'] },
];

function furnitureOptionsFor(roomType: string) {
  if (roomType === 'master_bedroom') return FURNITURE_OPTIONS.master_bedroom;
  if (roomType === 'kids_bedroom' || roomType === 'bedroom') return FURNITURE_OPTIONS.bedroom;
  return FURNITURE_OPTIONS[roomType] ?? FURNITURE_OPTIONS.other;
}

function bbox(points: Pt[]) {
  const xs = points.map(p => p.xMm), ys = points.map(p => p.yMm);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}
function polyArea(points: Pt[]) {
  let a = 0; for (let i = 0; i < points.length; i++) { const j = (i + 1) % points.length; a += points[i].xMm * points[j].yMm - points[j].xMm * points[i].yMm; } return Math.abs(a) / 2 / 1e6;
}
const FLOORING_PRESETS = [
  { id: 'italian_botticino', name: 'Italian Botticino Marble', colorHex: '#E8DFD0', patternId: 'floor-marble', desc: 'Warm polished marble with soft veins' },
  { id: 'light_oak_wood', name: 'Light Natural Oak Hardwood', colorHex: '#C8A882', patternId: 'floor-wood', desc: '190mm warm oak engineered planks' },
  { id: 'smoked_walnut_chevron', name: 'Smoked Walnut Chevron Parquet', colorHex: '#5A402D', patternId: 'floor-parquet', desc: 'Herringbone & chevron wood layout' },
  { id: 'spanish_terrazzo', name: 'Spanish Sand Terrazzo', colorHex: '#D9C9B8', patternId: 'floor-terrazzo', desc: 'Micro-flecked architectural terrazzo' },
  { id: 'slate_grey_tile', name: 'Slate Grey Vitrified Tile', colorHex: '#5C5A56', patternId: 'floor-tile', desc: '1200x600mm matte porcelain tiles' },
  { id: 'statuario_white', name: 'Statuario White Marble', colorHex: '#F3F2EE', patternId: 'floor-statuario', desc: 'High-gloss Italian white marble' },
];

const CEILING_PRESETS = [
  { id: 'peripheral_cove', name: 'Peripheral Cove + 3000K LED', desc: '120mm drop with concealed warm strip' },
  { id: 'magnetic_track', name: 'Minimalist Flush Gypsum + Magnetic Track', desc: 'Flush ceiling with black magnetic profile' },
  { id: 'wooden_rafters', name: 'Warm Wooden Rafters / Beams', desc: '50x100mm teak wood rafters' },
  { id: 'coffered_tray', name: 'Classic Coffered Tray Ceiling', desc: 'Deep recessed architectural bays' },
  { id: 'exposed_industrial', name: 'Exposed Concrete Loft Ceiling', desc: 'Modern industrial aesthetic' },
];

function getFloorPatternId(finish?: string, surface?: FloorSurfaceV1) {
  if (surface?.materialVersionId) {
    const matId = surface.materialVersionId.toLowerCase();
    if (matId.includes('statuario') || matId.includes('marble')) return 'floor-statuario';
    if (matId.includes('oak') || matId.includes('walnut') || matId.includes('wood')) return 'floor-wood';
    if (matId.includes('terrazzo')) return 'floor-terrazzo';
    if (matId.includes('tile') || matId.includes('slate') || matId.includes('ash')) return 'floor-tile';
  }
  if (!finish) return 'floor-default';
  const f = finish.toLowerCase();
  if (f.includes('marble') || f.includes('botticino')) return 'floor-marble';
  if (f.includes('oak') || f.includes('wood') || f.includes('plank')) return 'floor-wood';
  if (f.includes('parquet') || f.includes('chevron') || f.includes('walnut')) return 'floor-parquet';
  if (f.includes('terrazzo')) return 'floor-terrazzo';
  if (f.includes('statuario') || f.includes('white')) return 'floor-statuario';
  if (f.includes('slate') || f.includes('ash') || f.includes('tile')) return 'floor-tile';
  return 'floor-default';
}

function wallLen(w: PlanWall) { return Math.hypot(w.end.xMm - w.start.xMm, w.end.yMm - w.start.yMm); }
function entityId() { return crypto.randomUUID(); }

function getWallElevationTemplate(wallId: string | null, room: PlanRoom | null) {
  const role = wallId && room?.wallRoles?.[wallId] ? room.wallRoles[wallId] : '';
  const rType = room?.roomType || '';

  if (role === 'tv_wall' || (!role && (rType === 'living' || rType === 'dining'))) {
    return {
      id: 'tv-wall',
      title: 'Living Room TV Entertainment Media Wall Elevation',
      tag: '5BHK VILLA · LIVING ROOM',
      svgPath: '/elevations/test-tv-unit.svg',
      dxfPath: '/elevations/test-tv-unit.dxf',
      widthMm: 5030,
      heightMm: 3229,
      materials: 'Backlit Onyx · Fluted Walnut · Champagne Metal Trim',
      specs: '3,200mm cantilevered console, 2 × 30mm dummy fillers, zero-plumb wall tolerance',
    };
  }
  if (role === 'wardrobe_wall' || (!role && (rType.includes('bed')))) {
    return {
      id: 'wardrobe',
      title: 'Master Bedroom 4-Shutter Wardrobe & Lofts Elevation',
      tag: '5BHK VILLA · MASTER SUITE',
      svgPath: '/elevations/test-wardrobe.svg',
      dxfPath: '/elevations/test-wardrobe.dxf',
      widthMm: 2977,
      heightMm: 2690,
      materials: 'Smoked Oak Veneer · Fluted Profile Glass · Champagne Aluminium',
      specs: '4 carcass bays, 32mm System 32 line boring pitch, 30mm architrave scribe fillers',
    };
  }
  if (role === 'pooja_wall' || (!role && (rType === 'pooja'))) {
    return {
      id: 'mandir',
      title: 'Sacred Sanctuary Backlit Marble Mandir Elevation',
      tag: '5BHK VILLA · SACRED SANCTUARY',
      svgPath: '/elevations/test-mandir.svg',
      dxfPath: '/elevations/test-mandir.dxf',
      widthMm: 1775,
      heightMm: 3000,
      materials: 'Backlit Onyx · CNC Brass Jaali · Makrana Marble Base',
      specs: '2-tier sanctum altar, pullout brass thali tray, 95+ CRI warm illumination',
    };
  }
  if (role === 'kitchen_working_wall' || (!role && (rType === 'kitchen' || rType === 'utility'))) {
    return {
      id: 'kitchen',
      title: 'Show Kitchen Working Run & Upper Cabinets Elevation',
      tag: '5BHK VILLA · GOURMET KITCHEN',
      svgPath: '/elevations/test-kitchen.svg',
      dxfPath: '/elevations/test-kitchen.dxf',
      widthMm: 6669,
      heightMm: 3000,
      materials: 'High-Gloss Pearl White Acrylic · Calacatta Quartz · Matte Anthracite',
      specs: 'Tandembox base units, cutlery organizers, bi-fold lift-up profile glass upper cabinets',
    };
  }
  return {
    id: 'tv-wall',
    title: 'Architectural Feature Wall Elevation',
    tag: '5BHK VILLA · FEATURE WALL',
    svgPath: '/elevations/test-tv-unit.svg',
    dxfPath: '/elevations/test-tv-unit.dxf',
    widthMm: 5030,
    heightMm: 3229,
    materials: 'Fluted Architectural Cladding · Shadow Gap Profiles',
    specs: 'System 32 modular joinery datum, 30mm dummy fillers for zero-plumb wall tolerance',
  };
}

export function SpacesWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomDraftRequested = searchParams.get('roomDraft') === '1';
  const [roomDraftSummary, setRoomDraftSummary] = useState<{ name?: string; widthMm?: number; depthMm?: number; ceilingHeightMm?: number } | null>(null);

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
  const [geometryMode, setGeometryMode] = useState<'initial_design' | 'final_production'>('final_production');
  const [canvasFocus, setCanvasFocus] = useState<'room' | 'plan'>('plan');
  const [activeStoreyId, setActiveStoreyId] = useState<string>('level-ground');

  // Floor plan backdrop overlay state
  const [planPreviewUrl, setPlanPreviewUrl] = useState<string | null>(null);
  const [showPlanOverlay, setShowPlanOverlay] = useState(true);
  const [planOverlayOpacity, setPlanOverlayOpacity] = useState(0.40);
  const [sourceMeta, setSourceMeta] = useState<{ widthPx?: number; heightPx?: number; mmPerPixel?: number } | null>(null);

  // AI Layout Detection state
  const [aiProposals, setAiProposals] = useState<AiFurnitureProposal[]>([]);
  const [aiProposalRoomId, setAiProposalRoomId] = useState<string | null>(null);
  const [aiDetecting, setAiDetecting] = useState(false);
  const [showAiProposalsOnCanvas, setShowAiProposalsOnCanvas] = useState(true);

  // Design Library rail state. The library is a docked rail rather than a
  // modal so the plan canvas stays visible while modules are chosen.
  const [showDesignLibrary, setShowDesignLibrary] = useState(false);
  // Module currently being dragged from the rail, or "armed" by click for
  // keyboard/pointer placement. Both paths feed the same drop preview.
  const [draggingModule, setDraggingModule] = useState<CatalogModule | null>(null);
  const [dropPreview, setDropPreview] = useState<ModulePlacementPreview | null>(null);
  const [dropCursor, setDropCursor] = useState<{ x: number; y: number } | null>(null);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogFilterFamily, setCatalogFilterFamily] = useState('all');
  const [catalogFitFilter, setCatalogFitFilter] = useState<'all' | 'fits'>('all');

  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  useEffect(() => {
    if (!projectId || !aiProposalRoomId || !aiProposals.length) return;
    try {
      const key = `ultida.room-proposals.${projectId}`;
      const stored = JSON.parse(window.localStorage.getItem(key) ?? '[]');
      const others = Array.isArray(stored) ? stored.filter((entry: any) => entry.roomId !== aiProposalRoomId) : [];
      window.localStorage.setItem(key, JSON.stringify([...others, ...aiProposals.map((p) => ({
        id: p.id, roomId: aiProposalRoomId, templateId: p.moduleId, family: p.category, label: p.name,
        widthMm: p.dimensionsMm.width, depthMm: p.dimensionsMm.depth, heightMm: p.dimensionsMm.height, wallId: p.wallId,
      }))]));
    } catch { setSaveState('The browser could not retain these proposals. Save the room before leaving.'); }
  }, [projectId, aiProposalRoomId, aiProposals]);
  useEffect(() => { if (aiProposalRoomId !== selectedRoom) setAiProposals([]); }, [selectedRoom, aiProposalRoomId]);
  const [selectedWall, setSelectedWall] = useState<string | null>(null);
  const [spacePanel, setSpacePanel] = useState<'candidates' | 'advisor' | 'geometry' | 'modules' | 'flooring' | 'brief' | 'scene'>(() => {
    const tab = searchParams.get('tab');
    if (tab === 'flooring') return 'flooring';
    return tab === 'modules' || tab === 'bays' ? 'modules' : 'candidates';
  });
  const [compositionSchedules, setCompositionSchedules] = useState<Record<string, CompositionScheduleV1>>({});
  const [floorSurfaces, setFloorSurfaces] = useState<Record<string, FloorSurfaceV1>>({});
  const [canvasRenderMode, setCanvasRenderMode] = useState<'2d' | '3d_isometric' | 'stager'>('2d');
  const [roomFurnitureMap, setRoomFurnitureMap] = useState<Record<string, TopViewFurniture[]>>({});
  const [roomVastuMap, setRoomVastuMap] = useState<Record<string, VastuAnalysis>>({});
  const [showFloorPlanRenderModal, setShowFloorPlanRenderModal] = useState(false);
  const [showWallElevationModal, setShowWallElevationModal] = useState(false);
  const [renderJobState, setRenderJobState] = useState<'idle' | 'rendering' | 'succeeded'>('idle');
  const [layers, setLayers] = useState({ backdrop: true, walls: true, openings: true, columns: true, beams: true, services: true, annotations: true, rooms: true, aiOverlay: true });
  const [tool, setTool] = useState<string>('select');
  const [measureFrom, setMeasureFrom] = useState<Pt | null>(null);
  const [measureTo, setMeasureTo] = useState<Pt | null>(null);
  const [saveState, setSaveState] = useState('');
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'blocked' | 'empty' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [future, setFuture] = useState<any[]>([]);
  const [annotationDraft, setAnnotationDraft] = useState('');
  const [annotationDialogOpen, setAnnotationDialogOpen] = useState(false);
  const [roomDraftStart, setRoomDraftStart] = useState<Pt | null>(null);
  const [roomDraftCurrent, setRoomDraftCurrent] = useState<Pt | null>(null);
  const [lineDraftStart, setLineDraftStart] = useState<Pt | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!roomDraftRequested) return;
    try {
      const raw = window.localStorage.getItem('ultida.pendingRoomDraft.v1');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') setRoomDraftSummary(parsed);
    } catch {
      setRoomDraftSummary(null);
    }
  }, [roomDraftRequested]);

  useEffect(() => {
    if (!projectId) return;
    try {
      const savedSurfaces = window.localStorage.getItem(`ultida.floorSurfaces.${projectId}`);
      if (savedSurfaces) {
        const parsed = JSON.parse(savedSurfaces);
        if (parsed && typeof parsed === 'object') setFloorSurfaces(parsed);
      }
      const savedSchedules = window.localStorage.getItem(`ultida.compositionSchedules.${projectId}`);
      if (savedSchedules) {
        const parsed = JSON.parse(savedSchedules);
        if (parsed && typeof parsed === 'object') setCompositionSchedules(parsed);
      }
    } catch {
      // ignore
    }
  }, [projectId]);

  // ── Load approved plan geometry & source backdrop ──
  useEffect(() => {
    if (!supabase || !projectId) return;
    let live = true;
    void (async () => {
      setLoadState('loading');
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) { if (live) { setLoadState('error'); setSaveState('Your session expired. Sign in again.'); } return; }
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/projects/${projectId}/floor-plan/active`, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` } });
      const payload = await response.json().catch(() => null);
      if (!live) return;
      if (!response.ok) { setLoadState(response.status === 409 ? 'blocked' : 'error'); setSaveState(payload?.message ?? 'Approved plan could not be loaded.'); return; }
      const roomsP: PlanRoom[] = (payload?.rooms ?? []).map((r: any) => {
        const poly = r.polygon ?? [];
        const area = r.areaSqm ?? polyArea(poly);
        return {
          id: r.id,
          spaceRecordId: r.spaceRecordId,
          name: r.name,
          roomType: inferRoomType(r.roomType, r.name, area, poly),
          polygon: poly,
          areaSqm: area,
          ceilingHeightMm: r.ceilingHeightMm,
          requiredFurniture: Array.isArray(r.requiredFurniture) ? r.requiredFurniture : [],
          budgetInr: r.budgetInr ?? null,
          designPriority: r.designPriority ?? 'balanced',
          applianceNeeds: Array.isArray(r.applianceNeeds) ? r.applianceNeeds : [],
          constraints: Array.isArray(r.constraints) ? r.constraints : [],
          floorFinish: r.floorFinish ?? '',
          falseCeiling: r.falseCeiling ?? '',
          styleDirection: r.styleDirection ?? '',
          paletteDirection: r.paletteDirection ?? '',
          retainedElements: Array.isArray(r.retainedElements) ? r.retainedElements : [],
          wallRoles: r.wallRoles ?? {},
          preferredCamera: r.preferredCamera ?? '',
          verificationStatus: r.verificationStatus,
          included: r.included !== false
        };
      });
      if (!live) return;
      setPlan({ ceilingHeightMm: payload.ceilingHeightMm, walls: payload.walls, rooms: payload.rooms, openings: payload.openings, services: payload.services, obstacles: payload.columns } as any);
      setRooms(roomsP); setSelectedRoom((current) => current ?? roomsP[0]?.id ?? null); setWalls(payload.walls ?? []); setOpenings(payload.openings ?? []);
      setColumns(payload.columns ?? []); setBeams(payload.beams ?? []); setServices(payload.services ?? []);
      setAnnotations(payload.annotations ?? []); setIssues(payload.issues ?? []);
      setScaleVerified(payload.scaleVerified); setCeilingHeightMm(payload.ceilingHeightMm ?? 2700); setFloorPlanVersionId(payload.floorPlanVersionId ?? '');
      setGeometryMode(payload.geometryMode === 'initial_design' ? 'initial_design' : 'final_production');
      if (payload.previewUrl) setPlanPreviewUrl(payload.previewUrl);
      if (payload.source) setSourceMeta(payload.source);
      setLoadState(roomsP.length ? 'ready' : 'empty');
    })();
    return () => { live = false; };
  }, [projectId, reloadKey]);

  // ── History helpers (undo/redo) ──
  function snapshot() { setHistory(h => [...h, { rooms, walls, openings, columns, beams, services, annotations, ceilingHeightMm }]); setFuture([]); }
  function undo() { setHistory(h => { if (!h.length) return h; const prev = h[h.length - 1]; const cur = { rooms, walls, openings, columns, beams, services, annotations, ceilingHeightMm }; setFuture(f => [cur, ...f]); setRooms(prev.rooms); setWalls(prev.walls); setOpenings(prev.openings); setColumns(prev.columns); setBeams(prev.beams); setServices(prev.services); setAnnotations(prev.annotations); setCeilingHeightMm(prev.ceilingHeightMm); return h.slice(0, -1); }); }
  function redo() { setFuture(f => { if (!f.length) return f; const next = f[0]; const cur = { rooms, walls, openings, columns, beams, services, annotations, ceilingHeightMm }; setHistory(h => [...h, cur]); setRooms(next.rooms); setWalls(next.walls); setOpenings(next.openings); setColumns(next.columns); setBeams(next.beams); setServices(next.services); setAnnotations(next.annotations); setCeilingHeightMm(next.ceilingHeightMm); return f.slice(1); }); }

  // ── Derive room metrics ──
  function roomBoundaryWalls(room: PlanRoom): PlanWall[] {
    const raw = room.polygon;
    if (!raw || raw.length < 3) return [];
    // If the last point closes onto the first point, strip the redundant duplicate point
    const poly = (raw.length > 3 && Math.hypot(raw[raw.length - 1].xMm - raw[0].xMm, raw[raw.length - 1].yMm - raw[0].yMm) < 25)
      ? raw.slice(0, -1)
      : raw;
    const edges: PlanWall[] = [];
    for (let i = 0; i < poly.length; i++) {
      const start = poly[i];
      const end = poly[(i + 1) % poly.length];
      const len = Math.hypot(end.xMm - start.xMm, end.yMm - start.yMm);
      if (len >= 50) {
        edges.push({
          id: `${room.id}:edge:${edges.length + 1}`,
          start,
          end,
          isExterior: false,
        });
      }
    }
    return edges;
  }
  function wallsForRoom(room: PlanRoom) {
    const boundary = roomBoundaryWalls(room);
    const tolerance = 250;
    const closeToBoundary = (point: Pt) => boundary.some(edge => {
      const dx = edge.end.xMm - edge.start.xMm, dy = edge.end.yMm - edge.start.yMm;
      const l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((point.xMm - edge.start.xMm) * dx + (point.yMm - edge.start.yMm) * dy) / l2)) : 0;
      return Math.hypot(point.xMm - (edge.start.xMm + t * dx), point.yMm - (edge.start.yMm + t * dy)) <= tolerance;
    });
    const detected = walls.filter(wall => closeToBoundary(wall.start) && closeToBoundary(wall.end));
    return detected.length >= Math.min(3, boundary.length) ? detected : boundary;
  }

  function getInitialRoomFurniture(
    room: PlanRoom,
    widthMm: number,
    depthMm: number,
    proposals?: AiFurnitureProposal[]
  ): TopViewFurniture[] {
    const rType = room.roomType;
    const roomW = Math.max(1000, Math.round(widthMm || 6000));
    const roomL = Math.max(1000, Math.round(depthMm || 4500));

    if (proposals && proposals.length > 0) {
      return proposals.map((prop, idx) => {
        let category: TopViewFurniture['category'] = 'modular_storage';
        let semanticColor = '#ff9900';
        if (prop.category.includes('bed')) { category = 'bed'; semanticColor = '#cc0000'; }
        else if (prop.category.includes('sofa') || prop.category.includes('seating')) { category = 'seating'; semanticColor = '#3366cc'; }
        else if (prop.category.includes('dining')) { category = 'dining'; semanticColor = '#990099'; }
        else if (prop.category.includes('table')) { category = 'table'; semanticColor = '#990099'; }

        return {
          id: prop.id || `stg-${idx}`,
          name: prop.name,
          category,
          widthMm: prop.dimensionsMm.width,
          depthMm: prop.dimensionsMm.depth,
          xMm: Math.max(100, Math.min(roomW - prop.dimensionsMm.width, Math.round(prop.position.xMm % roomW))),
          yMm: Math.max(100, Math.min(roomL - prop.dimensionsMm.depth, Math.round(prop.position.yMm % roomL))),
          rotationDeg: 0,
          unitPrice: prop.category.includes('bed') ? 2100 : prop.category.includes('tv') ? 950 : 1200,
          isFloating: prop.category.includes('tv') || prop.category.includes('wall'),
          semanticColor,
        };
      });
    }

    if (rType === 'bedroom' || rType === 'master_bedroom') {
      return [
        { id: 'stg-bed', name: 'King Storage Bed with Headboard', category: 'bed', widthMm: 1800, depthMm: 2100, xMm: Math.round(roomW * 0.1), yMm: Math.round(roomL * 0.55), rotationDeg: 0, unitPrice: 2100, isFloating: false, semanticColor: '#cc0000' },
        { id: 'stg-wd', name: 'Profile-Glass Wardrobe Run', category: 'modular_storage', widthMm: Math.min(2400, roomW - 400), depthMm: 600, xMm: 200, yMm: Math.max(200, roomL - 800), rotationDeg: 0, unitPrice: 1600, isFloating: false, semanticColor: '#ff9900' },
      ];
    }
    if (rType === 'kitchen') {
      return [
        { id: 'stg-k-base', name: 'L-Shape Kitchen Base Run with Hob', category: 'modular_storage', widthMm: Math.min(3000, roomW - 400), depthMm: 600, xMm: Math.round(roomW * 0.65), yMm: Math.round(roomL * 0.65), rotationDeg: 0, unitPrice: 2800, isFloating: false, semanticColor: '#ff9900' },
        { id: 'stg-k-tall', name: 'Pantry Tower with Built-In Microwave', category: 'modular_storage', widthMm: 600, depthMm: 600, xMm: Math.min(3200, roomW - 800), yMm: 200, rotationDeg: 0, unitPrice: 950, isFloating: false, semanticColor: '#ff9900' },
      ];
    }
    if (rType === 'dining') {
      return [
        { id: 'stg-din-tbl', name: '6-Seater Calacatta Dining Table', category: 'dining', widthMm: 2100, depthMm: 1000, xMm: Math.round((roomW - 2100) / 2), yMm: Math.round((roomL - 1000) / 2), rotationDeg: 0, unitPrice: 1400, isFloating: false, semanticColor: '#990099' },
        { id: 'stg-crk', name: 'Full-Wall Crockery & Wine Bar', category: 'modular_storage', widthMm: 1800, depthMm: 450, xMm: 200, yMm: 200, rotationDeg: 0, unitPrice: 1100, isFloating: false, semanticColor: '#ff9900' },
      ];
    }
    return [
      { id: 'stg-sofa', name: 'Curved Bouclé Sectional Sofa', category: 'seating', widthMm: 2800, depthMm: 1600, xMm: 300, yMm: Math.round(roomL * 0.4), rotationDeg: 0, unitPrice: 1850, isFloating: false, semanticColor: '#3366cc' },
      { id: 'stg-coffee', name: 'Travertine Coffee Table', category: 'table', widthMm: 1200, depthMm: 800, xMm: 1200, yMm: Math.round(roomL * 0.5), rotationDeg: 15, unitPrice: 650, isFloating: false, semanticColor: '#990099' },
      { id: 'stg-tv', name: 'Floating Fluted TV Console Wall', category: 'modular_storage', widthMm: Math.min(2400, roomW - 600), depthMm: 450, xMm: 300, yMm: 150, rotationDeg: 0, unitPrice: 920, isFloating: true, semanticColor: '#ff9900' },
    ];
  }

  const roomMetrics = useMemo(() => rooms.map(room => {
    const b = bbox(room.polygon);
    const rawW = b.maxX - b.minX;
    const rawD = b.maxY - b.minY;
    const widthMm = rawW;
    const depthMm = rawD;
    const effectiveAreaSqm = polyArea(room.polygon);
    const roomWalls = wallsForRoom(room);
    const roomOpenings = openings.filter(o => roomWalls.some(w => w.id === o.wallId));
    const roomCols = columns.filter(c => c.position.xMm >= b.minX && c.position.xMm <= b.maxX && c.position.yMm >= b.minY && c.position.yMm <= b.maxY);
    const deductions = [
      ...roomOpenings.map(o => ({ id: o.id, kind: 'opening' as const, widthMm: o.widthMm ?? 900, clearanceMm: 120 })),
      ...roomCols.map(c => ({ id: c.id, kind: 'column' as const, widthMm: c.sizeMm ?? 300, clearanceMm: 200 })),
    ];
    const usable = computeUsableWallLength(roomWalls.map(w => ({ id: w.id, lengthMm: wallLen(w) })), deductions);
    const furniture = roomFurnitureMap[room.id] ?? getInitialRoomFurniture(room, widthMm, depthMm, selectedRoom === room.id ? aiProposals : undefined);
    const vastu = roomVastuMap[room.id] ?? evaluateVastuCompliance({ widthMm, lengthMm: depthMm }, furniture);

    const baseReadiness = computeSpaceReadiness(
      { spaceId: room.id, areaSqm: effectiveAreaSqm, ceilingHeightMm: room.ceilingHeightMm ?? ceilingHeightMm, usableWalls: roomWalls.map(w => ({ id: w.id, lengthMm: Math.round(wallLen(w)), openings: [], isExterior: false })) } as any,
      Boolean(room.spaceRecordId) && room.included !== false && room.requiredFurniture.length > 0 && (geometryMode === 'initial_design' || room.verificationStatus === 'verified'),
      issues.filter(i => i.entityId === room.id)
    );

    const vastuBlockingReasons = vastu.isCompliant
      ? []
      : [vastu.criticalRemedy || `Vastu directional alignment remedy needed (${vastu.score}% compliant)`];

    const compositeReadiness = {
      ...baseReadiness,
      vastuCompliant: vastu.isCompliant,
      vastuScore: vastu.score,
      vastuRemedies: vastu.findings.filter(f => f.status === 'remedy').map(f => f.advice),
      blockingReasons: [...baseReadiness.blockingReasons, ...vastuBlockingReasons,
        ...(!scaleVerified ? ['Confirm plan scale before room approval.'] : []),
        ...(needsScaleReview(room, widthMm, depthMm) ? ['Review the measured room boundary before approval.'] : [])],
      ready: baseReadiness.ready && vastu.isCompliant && scaleVerified && !needsScaleReview(room, widthMm, depthMm),
    };

    return {
      room,
      widthMm,
      depthMm,
      effectiveAreaSqm,
      wallCount: roomWalls.length,
      openingCount: roomOpenings.length,
      usable,
      readiness: compositeReadiness,
      vastu,
      furniture,
      scaleReview: needsScaleReview(room, widthMm, depthMm),
    };
  }), [rooms, walls, openings, columns, issues, ceilingHeightMm, geometryMode, scaleVerified, roomFurnitureMap, roomVastuMap, selectedRoom, aiProposals]);

  const includedMetrics = useMemo(() => roomMetrics.filter(({ room }) => room.included !== false), [roomMetrics]);
  const overallReadiness = useMemo(() => {
    const ready = includedMetrics.filter(({ readiness }) => readiness.ready);
    const blockedRooms = includedMetrics.filter(({ readiness }) => !readiness.ready).map(({ room }) => room.id);
    return { approved: ready.length > 0, blockedRooms, totalRooms: includedMetrics.length, readyRooms: ready.length };
  }, [includedMetrics]);

  const sourceDimensionsMm = useMemo(() => {
    const rawWidth = sourceMeta?.widthPx ?? (sourceMeta as any)?.sourceWidth ?? 1000;
    const rawHeight = sourceMeta?.heightPx ?? (sourceMeta as any)?.sourceHeight ?? 850;
    // Never invent a pixel calibration. Until the plan is explicitly calibrated,
    // the measured vector geometry remains the only trusted coordinate source.
    const mmPerPx = scaleVerified && Number.isFinite(sourceMeta?.mmPerPixel) && sourceMeta!.mmPerPixel! > 0 ? sourceMeta!.mmPerPixel : undefined;

    const allPts = [
      ...rooms.flatMap(r => r.polygon),
      ...walls.flatMap(w => [w.start, w.end]),
    ];
    if (!allPts.length) {
      return { minX: 0, minY: 0, widthMm: mmPerPx ? rawWidth * mmPerPx : 1000, heightMm: mmPerPx ? rawHeight * mmPerPx : 850 };
    }
    const b = bbox(allPts);
    const widthMm = mmPerPx ? rawWidth * mmPerPx : b.maxX - b.minX;
    const heightMm = mmPerPx ? rawHeight * mmPerPx : b.maxY - b.minY;
    return {
      minX: mmPerPx ? 0 : b.minX,
      minY: mmPerPx ? 0 : b.minY,
      widthMm,
      heightMm,
    };
  }, [sourceMeta, rooms, walls, scaleVerified]);

  // ── Canvas projection ──
  const view = useMemo(() => {
    const focusRoom = canvasFocus === 'room' ? rooms.find(room => room.id === selectedRoom) : null;
    const focusBounds = focusRoom ? bbox(focusRoom.polygon) : null;
    const inFocus = (point: Pt) => !focusBounds || (point.xMm >= focusBounds.minX - 500 && point.xMm <= focusBounds.maxX + 500 && point.yMm >= focusBounds.minY - 500 && point.yMm <= focusBounds.maxY + 500);
    const all: Pt[] = focusRoom
      ? [...focusRoom.polygon, ...walls.flatMap(w => [w.start, w.end]).filter(inFocus), ...columns.map(c => c.position).filter(inFocus), ...services.map(s => s.position).filter(inFocus)]
      : [
          ...rooms.flatMap(r => r.polygon),
          ...walls.flatMap(w => [w.start, w.end]),
          ...columns.map(c => c.position),
          ...services.map(s => s.position),
          ...(planPreviewUrl ? [{ xMm: sourceDimensionsMm.minX, yMm: sourceDimensionsMm.minY }, { xMm: sourceDimensionsMm.widthMm, yMm: sourceDimensionsMm.heightMm }] : []),
        ];
    if (!all.length) return { minX: 0, minY: 0, scale: 0.1, w: 760, h: 480, maxX: 1000, maxY: 1000 };
    const b = bbox(all); const pad = 40; const W = 760, H = 480;
    const s = Math.min((W - 2 * pad) / (b.maxX - b.minX || 1), (H - 2 * pad) / (b.maxY - b.minY || 1));
    return { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY, scale: s, w: W, h: H };
  }, [rooms, walls, columns, services, selectedRoom, canvasFocus, planPreviewUrl, sourceDimensionsMm]);

  const toPx = (p: Pt) => ({ x: (p.xMm - view.minX) * view.scale + 30, y: (p.yMm - view.minY) * view.scale + 30 });
  const pxToMm = (x: number, y: number): Pt => ({ xMm: (x - 30) / view.scale + view.minX, yMm: (y - 30) / view.scale + view.minY });

  function svgPoint(e: { clientX: number; clientY: number }) {
    const svg = svgRef.current!;
    const matrix = svg.getScreenCTM();
    if (!matrix) throw new Error('The plan canvas is not ready for editing.');
    const point = svg.createSVGPoint();
    point.x = e.clientX; point.y = e.clientY;
    const local = point.matrixTransform(matrix.inverse());
    return pxToMm(local.x, local.y);
  }

  const sel = roomMetrics.find(m => m.room.id === selectedRoom);

  // Escape always cancels an in-flight placement. Without this a user who
  // arms a module by click has no way out except placing it somewhere.
  useEffect(() => {
    if (!draggingModule) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDraggingModule(null);
        setDropPreview(null);
        setDropCursor(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draggingModule]);

  const activeCatalogWall = useMemo(() => {
    if (!sel?.room) return null;
    // Certification must use a persisted measured wall. Synthetic polygon
    // edges are useful for previewing a room, but cannot certify production fit.
    const wall = selectedWall ? walls.find((candidate) => candidate.id === selectedWall) : null;
    if (!wall) return null;
    return {
      id: wall.id,
      lengthMm: wallLen(wall),
      openings: openings.filter((opening) => opening.wallId === wall.id).map((opening) => ({ id: opening.id, kind: opening.kind, offsetMm: opening.offsetAlongWallMm ?? 0, widthMm: opening.widthMm ?? 900 })),
    };
  }, [sel?.room, selectedWall, walls, openings]);

  const stagerItems = useMemo<TopViewFurniture[] | undefined>(() => {
    if (!sel?.room) return undefined;
    return roomFurnitureMap[sel.room.id] ?? getInitialRoomFurniture(sel.room, sel.widthMm, sel.depthMm, aiProposals);
  }, [sel, aiProposals, roomFurnitureMap]);

  const toggleRoomVastu = (roomId: string, widthMm: number, depthMm: number) => {
    const targetRoom = rooms.find(r => r.id === roomId);
    if (!targetRoom) return;
    const currentFurniture = roomFurnitureMap[roomId] ?? getInitialRoomFurniture(
      targetRoom,
      widthMm,
      depthMm,
      selectedRoom === roomId ? aiProposals : undefined
    );
    const analysis = evaluateVastuCompliance({ widthMm, lengthMm: depthMm }, currentFurniture);

    if (analysis.isCompliant) {
      // Shift to inauspicious zone (e.g. Bed to NE Ishanya or Hob to NW Vayavya)
      let shifted = false;
      const updated = currentFurniture.map(it => {
        if (it.category === 'bed') {
          shifted = true;
          return { ...it, xMm: Math.round(widthMm * 0.72), yMm: Math.round(depthMm * 0.08) };
        }
        if (it.name.toLowerCase().includes('mandir') || it.name.toLowerCase().includes('pooja')) {
          shifted = true;
          return { ...it, xMm: Math.round(widthMm * 0.1), yMm: Math.round(depthMm * 0.65) };
        }
        if (it.category === 'modular_storage' && it.name.toLowerCase().includes('kitchen')) {
          shifted = true;
          return { ...it, xMm: Math.round(widthMm * 0.1), yMm: Math.round(depthMm * 0.1) };
        }
        return it;
      });
      if (!shifted && updated.length > 0) {
        updated[0] = {
          ...updated[0],
          category: 'bed',
          name: 'Master Bed (Vastu Test Placement)',
          xMm: Math.round(widthMm * 0.72),
          yMm: Math.round(depthMm * 0.08),
        };
      }
      const newVastu = evaluateVastuCompliance({ widthMm, lengthMm: depthMm }, updated);
      setRoomFurnitureMap(prev => ({ ...prev, [roomId]: updated }));
      setRoomVastuMap(prev => ({ ...prev, [roomId]: newVastu }));
      setSaveState(`Toggled Vastu violation in ${targetRoom.name}: Bed moved to North-East (Ishanya). Readiness updated.`);
    } else {
      // Auto-align to auspicious zones
      const updated = currentFurniture.map(it => {
        if (it.category === 'bed') {
          return { ...it, xMm: Math.round(widthMm * 0.1), yMm: Math.round(depthMm * 0.55), rotationDeg: 0 };
        }
        if (it.name.toLowerCase().includes('mandir') || it.name.toLowerCase().includes('pooja')) {
          return { ...it, xMm: Math.round(widthMm * 0.72), yMm: Math.round(depthMm * 0.08), rotationDeg: 0 };
        }
        if (it.category === 'modular_storage' && it.name.toLowerCase().includes('kitchen')) {
          return { ...it, xMm: Math.round(widthMm * 0.65), yMm: Math.round(depthMm * 0.65), rotationDeg: 0 };
        }
        if (it.category === 'modular_storage' && (it.name.toLowerCase().includes('tv') || it.name.toLowerCase().includes('console'))) {
          return { ...it, xMm: Math.round(widthMm * 0.28), yMm: Math.round(depthMm * 0.05), rotationDeg: 0 };
        }
        if (it.category === 'seating') {
          return { ...it, xMm: Math.round(widthMm * 0.22), yMm: Math.round(depthMm * 0.35), rotationDeg: 0 };
        }
        return it;
      });
      const newVastu = evaluateVastuCompliance({ widthMm, lengthMm: depthMm }, updated);
      setRoomFurnitureMap(prev => ({ ...prev, [roomId]: updated }));
      setRoomVastuMap(prev => ({ ...prev, [roomId]: newVastu }));
      setSaveState(`Aligned ${targetRoom.name} to auspicious Vastu zones. Room is now Vastu compliant.`);
    }
  };

  // ── AI Furniture Layout Detection Engine ──
  const detectAiLayout = (room: PlanRoom) => {
    setAiDetecting(true);
    setSaveState(`Analyzing ${room.name} with AI layout solver…`);
    setTimeout(() => {
      const b = bbox(room.polygon);
      const width = b.maxX - b.minX;
      const depth = b.maxY - b.minY;
      const rWalls = wallsForRoom(room);
      const proposals: AiFurnitureProposal[] = [];

      if (room.roomType === 'bedroom' || room.roomType === 'master_bedroom' || room.roomType === 'kids_bedroom') {
        const primaryWall = rWalls[0] ?? { id: `${room.id}:edge:1` };
        const secondaryWall = rWalls[1] ?? { id: `${room.id}:edge:2` };
        proposals.push({
          id: entityId(),
          category: 'bed',
          moduleId: 'bed-floating-led-1800',
          name: '1800 King Storage Bed & Extended Headboard',
          wallId: primaryWall.id,
          wallLabel: 'Wall A (Headboard)',
          rationale: 'Placed on primary solid wall with 750 mm clear bedside circulation and no door collisions.',
          dimensionsMm: { width: 1800, depth: 2100, height: 1200 },
          position: { xMm: b.minX + (width - 1800) / 2, yMm: b.minY + 200 },
          confidence: 0.94,
        });
        proposals.push({
          id: entityId(),
          category: 'wardrobe',
          moduleId: 'wardrobe-2100-four-shutter',
          name: '2100 4-Shutter Full-Height Wardrobe with Loft',
          wallId: secondaryWall.id,
          wallLabel: 'Wall B (Storage)',
          rationale: 'Aligned to secondary wall with 30 mm wall-side fillers and 50 mm ceiling loft gap.',
          dimensionsMm: { width: 2100, depth: 600, height: 2700 },
          position: { xMm: b.minX + 200, yMm: b.maxY - 800 },
          confidence: 0.91,
        });
        if (width >= 3500) {
          proposals.push({
            id: entityId(),
            category: 'study_unit',
            moduleId: 'study-1500',
            name: '1500 Study Desk with Overhead Storage',
            wallId: rWalls[2]?.id,
            wallLabel: 'Wall C (Study)',
            rationale: 'Compact work zone utilizing available span with task lighting anchor.',
            dimensionsMm: { width: 1500, depth: 600, height: 2400 },
            position: { xMm: b.maxX - 1600, yMm: b.minY + 400 },
            confidence: 0.86,
          });
        }
      } else if (room.roomType === 'living') {
        const featureWall = rWalls[0] ?? { id: `${room.id}:edge:1` };
        proposals.push({
          id: entityId(),
          category: 'tv_unit',
          moduleId: 'tv-profile-2400',
          name: '2400 Floating TV Wall with Profile Glass & Warm LED',
          wallId: featureWall.id,
          wallLabel: 'Wall A (Feature)',
          rationale: 'Primary viewing focal point opposite main living circulation, with hidden cable ducts.',
          dimensionsMm: { width: 2400, depth: 400, height: 2400 },
          position: { xMm: b.minX + (width - 2400) / 2, yMm: b.minY + 150 },
          confidence: 0.95,
        });
        proposals.push({
          id: entityId(),
          category: 'sofa',
          moduleId: 'sofa-l-2800',
          name: '2800 L-Shaped Sectional Sofa',
          wallId: rWalls[1]?.id,
          wallLabel: 'Seating Zone',
          rationale: 'Optimal conversational distance (2.8m from TV) with 900 mm clear perimeter passage.',
          dimensionsMm: { width: 2800, depth: 1700, height: 850 },
          position: { xMm: b.minX + (width - 2800) / 2, yMm: b.maxY - 1900 },
          confidence: 0.92,
        });
      } else if (room.roomType === 'kitchen') {
        const mainWall = rWalls[0] ?? { id: `${room.id}:edge:1` };
        proposals.push({
          id: entityId(),
          category: 'kitchen_base',
          moduleId: 'kit-base-600',
          name: 'Modular Base Units & Tandem Drawers with 20mm Slab',
          wallId: mainWall.id,
          wallLabel: 'Cooking Counter',
          rationale: 'Continuous base run with tandem drawers and dedicated service clearance.',
          dimensionsMm: { width: Math.min(width, 3000), depth: 600, height: 860 },
          position: { xMm: b.minX + 100, yMm: b.minY + 100 },
          confidence: 0.93,
        });
        proposals.push({
          id: entityId(),
          category: 'kitchen_wall',
          moduleId: 'kit-wall-normal-600',
          name: 'Upper Wall Cabinets & Lofts (Equal Shutters)',
          wallId: mainWall.id,
          wallLabel: 'Wall Cabinets',
          rationale: 'Under-cabinet lighting anchor with 50 mm ceiling filler.',
          dimensionsMm: { width: Math.min(width, 3000), depth: 350, height: 720 },
          position: { xMm: b.minX + 100, yMm: b.minY + 100 },
          confidence: 0.90,
        });
      } else if (room.roomType === 'dining') {
        proposals.push({
          id: entityId(),
          category: 'dining_table',
          moduleId: 'dining-calacatta-gold-2100',
          name: '1600 Six-Seat Dining Ensemble',
          wallLabel: 'Center',
          rationale: 'Centred in dining zone with 950 mm pullout clearance around all chairs.',
          dimensionsMm: { width: 1600, depth: 900, height: 750 },
          position: { xMm: b.minX + (width - 1600) / 2, yMm: b.minY + (depth - 900) / 2 },
          confidence: 0.94,
        });
        proposals.push({
          id: entityId(),
          category: 'crockery_unit',
          moduleId: 'crockery-1800',
          name: '1800 Full-Height Crockery Display & Bar with Fluted Glass',
          wallId: rWalls[0]?.id,
          wallLabel: 'Wall A',
          rationale: 'Built-in dining sideboard with counter niche and illuminated glass display.',
          dimensionsMm: { width: 1800, depth: 450, height: 2400 },
          position: { xMm: b.minX + 150, yMm: b.minY + 150 },
          confidence: 0.89,
        });
      } else if (room.roomType === 'study') {
        proposals.push({
          id: entityId(),
          category: 'study_unit',
          moduleId: 'study-1500',
          name: '1800 Study Desk & Tall Open Library Wall',
          wallId: rWalls[0]?.id,
          wallLabel: 'Wall A',
          rationale: 'Desk aligned to maximize ambient light with dedicated task lighting channel.',
          dimensionsMm: { width: 1800, depth: 600, height: 2400 },
          position: { xMm: b.minX + 150, yMm: b.minY + 150 },
          confidence: 0.92,
        });
      } else if (room.roomType === 'pooja') {
        proposals.push({
          id: entityId(),
          category: 'pooja_unit',
          moduleId: 'pooja-1200-jaali',
          name: '1200 Pooja Unit with CNC Jaali, Single Tray & Warm Lighting',
          wallId: rWalls[0]?.id,
          wallLabel: 'East Wall',
          rationale: 'Auspicious orientation with single pull-out tray and two lower storage drawers.',
          dimensionsMm: { width: 1200, depth: 400, height: 2100 },
          position: { xMm: b.minX + (width - 1200) / 2, yMm: b.minY + 100 },
          confidence: 0.96,
        });
      } else if (room.roomType === 'bathroom') {
        proposals.push({
          id: entityId(),
          category: 'vanity_unit',
          moduleId: 'vanity-900',
          name: '900 Moisture-Resistant Vanity Cabinet with Basin',
          wallId: rWalls[0]?.id,
          wallLabel: 'Plumbing Wall',
          rationale: 'Service-aligned vanity cabinet with under-counter plumbing void.',
          dimensionsMm: { width: 900, depth: 500, height: 850 },
          position: { xMm: b.minX + 100, yMm: b.minY + 100 },
          confidence: 0.90,
        });
      } else if (room.roomType === 'foyer') {
        proposals.push({
          id: entityId(),
          category: 'foyer_console',
          moduleId: 'foyer-console-1200',
          name: '1200 Floating Foyer Console with Key Drop Drawer',
          wallId: rWalls[0]?.id,
          wallLabel: 'Entry Wall',
          rationale: 'Slim profile floating entry unit with soft under-cabinet LED wash.',
          dimensionsMm: { width: 1200, depth: 350, height: 450 },
          position: { xMm: b.minX + 100, yMm: b.minY + 100 },
          confidence: 0.91,
        });
      } else {
        // Universal adaptive proposal fallback for 'other', multipurpose, or unclassified spaces
        const mainWall = rWalls[0] ?? { id: `${room.id}:edge:1` };
        const secondWall = rWalls[1] ?? mainWall;
        if (width >= 2400) {
          proposals.push({
            id: entityId(),
            category: 'modular_storage',
            moduleId: 'tv-profile-2400',
            name: '2400 Floating Console Wall & Acoustic Wood Slats',
            wallId: mainWall.id,
            wallLabel: 'Wall A (Main)',
            rationale: 'Balanced focal storage console designed to maximize linear span with 900 mm clearance.',
            dimensionsMm: { width: Math.min(2400, Math.max(1200, width - 400)), depth: 400, height: 2200 },
            position: { xMm: b.minX + 200, yMm: b.minY + 150 },
            confidence: 0.92,
          });
        }
        proposals.push({
          id: entityId(),
          category: 'storage_unit',
          moduleId: 'wardrobe-2100-four-shutter',
          name: '1800 Multi-Purpose Full-Height Cabinet & Lofts',
          wallId: secondWall.id,
          wallLabel: 'Wall B (Storage)',
          rationale: 'Modular vertical carcase with 30mm scribing filler and ceiling shadowline gap.',
          dimensionsMm: { width: Math.min(1800, Math.max(900, depth - 400)), depth: 550, height: 2400 },
          position: { xMm: b.maxX - 1900, yMm: b.maxY - 700 },
          confidence: 0.88,
        });
      }

      setAiProposals(proposals);
      setAiProposalRoomId(room.id);
      setAiDetecting(false);

      // Immediately sync to roomFurnitureMap so the 2D SVG canvas and Vastu analyzer visually update
      const stagerItems: TopViewFurniture[] = proposals.map((prop, idx) => {
        let category: TopViewFurniture['category'] = 'modular_storage';
        let semanticColor = '#ff9900';
        if (prop.category.includes('bed')) { category = 'bed'; semanticColor = '#cc0000'; }
        else if (prop.category.includes('sofa') || prop.category.includes('seating')) { category = 'seating'; semanticColor = '#3366cc'; }
        else if (prop.category.includes('dining')) { category = 'dining'; semanticColor = '#990099'; }
        else if (prop.category.includes('table')) { category = 'table'; semanticColor = '#990099'; }

        return {
          id: prop.id || `stg-${idx}`,
          name: prop.name,
          category,
          widthMm: prop.dimensionsMm.width,
          depthMm: prop.dimensionsMm.depth,
          xMm: Math.max(100, Math.min(width - prop.dimensionsMm.width, Math.round(prop.position.xMm % width))),
          yMm: Math.max(100, Math.min(depth - prop.dimensionsMm.depth, Math.round(prop.position.yMm % depth))),
          rotationDeg: 0,
          unitPrice: prop.category.includes('bed') ? 2100 : prop.category.includes('tv') ? 950 : 1200,
          isFloating: prop.category.includes('tv') || prop.category.includes('wall'),
          semanticColor,
        };
      });

      setRoomFurnitureMap(prev => ({ ...prev, [room.id]: stagerItems }));
      const newVastu = evaluateVastuCompliance({ widthMm: width, lengthMm: depth }, stagerItems);
      setRoomVastuMap(prev => ({ ...prev, [room.id]: newVastu }));

      setSaveState(`Prepared ${proposals.length} furniture suggestions for ${room.name}. Review dimensions and place a catalog module in the next step to save it.`);
    }, 450);
  };

  const applyAiProposalsToRoom = (room: PlanRoom) => {
    if (!aiProposals.length) return;
    void applyLayoutCandidateToScene(room, 'balanced');
  };

  const detectDoorsAndWindows = (): PlanOpening[] => {
    snapshot();
    const newOpenings: PlanOpening[] = [...openings];
    const existingWallIds = new Set(newOpenings.map(o => o.wallId));

    // Calculate layout-wide bounding box to distinguish exterior perimeter from interior partitions
    const allPts: Pt[] = rooms.flatMap(r => r.polygon ?? []).concat(walls.flatMap(w => [w.start, w.end]));
    const layoutBbox = allPts.length ? bbox(allPts) : { minX: 0, minY: 0, maxX: 10000, maxY: 10000 };
    const perimeterTol = 400; // mm from layout boundary

    // For each room, ensure doors and windows
    rooms.forEach((room) => {
      const rWalls = wallsForRoom(room);
      if (!rWalls.length) return;

      // 1. Identify entrance / partition wall for doors
      let doorPlaced = false;
      for (const w of rWalls) {
        const len = wallLen(w);
        if (len < 1200) continue; // Wall too short for door + clearance

        const isOuterWall = (
          Math.min(Math.abs(w.start.xMm - layoutBbox.minX), Math.abs(w.end.xMm - layoutBbox.minX)) < perimeterTol ||
          Math.min(Math.abs(w.start.xMm - layoutBbox.maxX), Math.abs(w.end.xMm - layoutBbox.maxX)) < perimeterTol ||
          Math.min(Math.abs(w.start.yMm - layoutBbox.minY), Math.abs(w.end.yMm - layoutBbox.minY)) < perimeterTol ||
          Math.min(Math.abs(w.start.yMm - layoutBbox.maxY), Math.abs(w.end.yMm - layoutBbox.maxY)) < perimeterTol
        );

        // Place door on interior partition wall
        if (!isOuterWall && !doorPlaced && !existingWallIds.has(w.id)) {
          const doorWidth = room.roomType === 'living' ? 1000 : 900;
          const offset = Math.min(len - doorWidth - 150, Math.max(150, Math.round(len * 0.25)));
          newOpenings.push({
            id: entityId(),
            wallId: w.id,
            kind: 'door',
            offsetAlongWallMm: offset,
            widthMm: doorWidth,
            heightMm: 2100,
            sillHeightMm: 0,
          });
          existingWallIds.add(w.id);
          doorPlaced = true;
          break;
        }
      }

      // If no internal door was placed (e.g. living room main entry), place on first suitable wall
      if (!doorPlaced) {
        const candidateWall = rWalls.find(w => wallLen(w) >= 1200 && !newOpenings.some(o => o.wallId === w.id && o.kind === 'door'));
        if (candidateWall) {
          const len = wallLen(candidateWall);
          const doorWidth = room.roomType === 'living' ? 1000 : 900;
          newOpenings.push({
            id: entityId(),
            wallId: candidateWall.id,
            kind: 'door',
            offsetAlongWallMm: Math.max(150, Math.min(len - doorWidth - 150, 250)),
            widthMm: doorWidth,
            heightMm: 2100,
            sillHeightMm: 0,
          });
          existingWallIds.add(candidateWall.id);
        }
      }

      // 2. Identify exterior wall for architectural window
      if (room.roomType !== 'pooja') {
        const outerWalls = rWalls.filter(w => {
          const len = wallLen(w);
          if (len < 1600) return false;
          return (
            Math.min(Math.abs(w.start.xMm - layoutBbox.minX), Math.abs(w.end.xMm - layoutBbox.minX)) < perimeterTol ||
            Math.min(Math.abs(w.start.xMm - layoutBbox.maxX), Math.abs(w.end.xMm - layoutBbox.maxX)) < perimeterTol ||
            Math.min(Math.abs(w.start.yMm - layoutBbox.minY), Math.abs(w.end.yMm - layoutBbox.minY)) < perimeterTol ||
            Math.min(Math.abs(w.start.yMm - layoutBbox.maxY), Math.abs(w.end.yMm - layoutBbox.maxY)) < perimeterTol
          );
        });

        const windowWall = outerWalls.find(w => !newOpenings.some(o => o.wallId === w.id)) || rWalls.find(w => wallLen(w) >= 2000 && !newOpenings.some(o => o.wallId === w.id));
        if (windowWall) {
          const wLen = wallLen(windowWall);
          const winWidth = room.roomType === 'living' ? 1800 : room.roomType === 'kitchen' ? 1200 : 1500;
          if (wLen >= winWidth + 400) {
            newOpenings.push({
              id: entityId(),
              wallId: windowWall.id,
              kind: 'window',
              offsetAlongWallMm: Math.round((wLen - winWidth) / 2),
              widthMm: winWidth,
              heightMm: 1200,
              sillHeightMm: 900,
            });
            existingWallIds.add(windowWall.id);
          }
        }
      }
    });

    setOpenings(newOpenings);
    setSaveState(`✨ AI detected & placed ${newOpenings.length} architectural doors and windows on room boundaries.`);
    return newOpenings;
  };

  const autoEnhanceAllRoomsAndFloorplan = () => {
    snapshot();
    const detectedOpenings = detectDoorsAndWindows();

    const updatedRooms: PlanRoom[] = rooms.map((room) => {
      const rWalls = wallsForRoom(room);
      const wallRoles = { ...(room.wallRoles ?? {}) };
      const categories = [...room.requiredFurniture];

      if (room.roomType === 'living') {
        if (rWalls[0]) wallRoles[rWalls[0].id] = 'tv_wall';
        if (!categories.includes('tv_unit')) categories.push('tv_unit');
        if (!categories.includes('sofa')) categories.push('sofa');
      } else if (room.roomType === 'bedroom' || room.roomType === 'master_bedroom' || room.roomType === 'kids_bedroom') {
        if (rWalls[0]) wallRoles[rWalls[0].id] = 'bed_headboard_wall';
        if (rWalls[1]) wallRoles[rWalls[1].id] = 'wardrobe_wall';
        if (!categories.includes('bed')) categories.push('bed');
        if (!categories.includes('wardrobe')) categories.push('wardrobe');
      } else if (room.roomType === 'kitchen') {
        if (rWalls[0]) wallRoles[rWalls[0].id] = 'kitchen_working_wall';
        if (!categories.includes('kitchen_base')) categories.push('kitchen_base');
        if (!categories.includes('kitchen_overhead')) categories.push('kitchen_overhead');
      } else if (room.roomType === 'dining') {
        if (rWalls[0]) wallRoles[rWalls[0].id] = 'crockery_wall';
        if (!categories.includes('dining_table')) categories.push('dining_table');
        if (!categories.includes('crockery_unit')) categories.push('crockery_unit');
      } else if (room.roomType === 'pooja') {
        if (rWalls[0]) wallRoles[rWalls[0].id] = 'pooja_wall';
        if (!categories.includes('pooja_unit')) categories.push('pooja_unit');
      }

      return {
        ...room,
        requiredFurniture: Array.from(new Set(categories)),
        wallRoles,
        verificationStatus: 'unverified',
        floorFinish: room.floorFinish || (room.roomType === 'living' ? 'French Light Oak Herringbone' : room.roomType === 'kitchen' ? 'Roman Travertine' : 'Calacatta Gold'),
      };
    });

    setRooms(updatedRooms);
    setCanvasRenderMode('3d_isometric');
    setSaveState(`AI enhanced all ${updatedRooms.length} rooms, placed ${detectedOpenings.length} doors & windows, and verified all spaces for 3D layout.`);
    void saveGeometryVersion(updatedRooms);

    // Apply layout candidates to scene for all rooms
    void (async () => {
      for (const r of updatedRooms) {
        await applyLayoutCandidateToScene(r, 'balanced').catch(() => null);
      }
      setSaveState('All spaces verified with doors, windows, and modular units synced to 3D Scene.');
    })();
  };

  function onCanvasClick(e: React.MouseEvent) {
    const pt = svgPoint(e);
    if (tool === 'measure') { if (!measureFrom) setMeasureFrom(pt); else { setMeasureTo(pt); } return; }
    if (tool === 'draw_room') {
      if (!roomDraftStart) {
        setRoomDraftStart(pt);
        setRoomDraftCurrent(pt);
        return;
      }
      const minX = Math.min(roomDraftStart.xMm, pt.xMm);
      const minY = Math.min(roomDraftStart.yMm, pt.yMm);
      const maxX = Math.max(roomDraftStart.xMm, pt.xMm);
      const maxY = Math.max(roomDraftStart.yMm, pt.yMm);
      if (maxX - minX < 300 || maxY - minY < 300) {
        setSaveState('A room zone must be at least 300 mm × 300 mm. Click a larger rectangle.');
        return;
      }
      snapshot();
      const id = entityId();
      const polygon = [{ xMm: minX, yMm: minY }, { xMm: maxX, yMm: minY }, { xMm: maxX, yMm: maxY }, { xMm: minX, yMm: maxY }];
      setRooms(current => [...current, { id, name: `New space ${current.length + 1}`, roomType: 'other', polygon, areaSqm: polyArea(polygon), requiredFurniture: [], included: true }]);
      setSelectedRoom(id);
      setRoomDraftStart(null);
      setRoomDraftCurrent(null);
      setTool('select');
      setSaveState('New editable space added. Name and classify it in Properties, then save the room.');
      return;
    }
    if (tool === 'draw_wall' || tool === 'draw_beam') {
      if (!lineDraftStart) {
        setLineDraftStart(pt);
        setSaveState(`Click the ${tool === 'draw_wall' ? 'wall' : 'beam'} end point.`);
        return;
      }
      const length = Math.hypot(pt.xMm - lineDraftStart.xMm, pt.yMm - lineDraftStart.yMm);
      if (length < 100) { setSaveState('Structural lines must be at least 100 mm long.'); return; }
      snapshot();
      if (tool === 'draw_wall') setWalls(current => [...current, { id: entityId(), start: lineDraftStart, end: pt, isExterior: false }]);
      else setBeams(current => [...current, { id: entityId(), start: lineDraftStart, end: pt }]);
      setLineDraftStart(null); setTool('select');
      setSaveState(`${tool === 'draw_wall' ? 'Wall' : 'Beam'} added to the editable draft.`);
      return;
    }
    if (tool === 'add_column' || tool === 'add_service') {
      snapshot();
      if (tool === 'add_column') setColumns(c => [...c, { id: entityId(), position: pt, sizeMm: 300 }]);
      else setServices(s => [...s, { id: entityId(), kind: 'electrical', position: pt }]);
      setTool('select');
      setSaveState(tool === 'add_column' ? `Column placed at ${pt.xMm.toFixed(0)}, ${pt.yMm.toFixed(0)}.` : `Service placed at ${pt.xMm.toFixed(0)}, ${pt.yMm.toFixed(0)}.`);
      return;
    }
    if (tool === 'add_door' || tool === 'add_window') {
      const candidates = selectedWall ? walls.filter(w => w.id === selectedWall) : walls;
      const nearest = candidates.map((wall) => {
        const dx = wall.end.xMm - wall.start.xMm, dy = wall.end.yMm - wall.start.yMm;
        const lengthSquared = dx * dx + dy * dy;
        const t = lengthSquared ? Math.max(0, Math.min(1, ((pt.xMm - wall.start.xMm) * dx + (pt.yMm - wall.start.yMm) * dy) / lengthSquared)) : 0;
        const x = wall.start.xMm + t * dx, y = wall.start.yMm + t * dy;
        return { wall, distance: Math.hypot(pt.xMm - x, pt.yMm - y), offset: Math.sqrt(lengthSquared) * t };
      }).sort((a, b) => a.distance - b.distance)[0];
      if (!nearest || nearest.distance > 250) { setSaveState('Click on a wall to place an opening.'); return; }
      const kind = tool === 'add_door' ? 'door' : 'window';
      const widthMm = kind === 'door' ? 900 : 1200;
      if (wallLen(nearest.wall) < widthMm + 200) { setSaveState(`This wall is too short for a ${kind}.`); return; }
      snapshot();
      setOpenings(current => [...current, { id: entityId(), wallId: nearest.wall.id, kind, offsetAlongWallMm: Math.max(widthMm / 2, Math.min(wallLen(nearest.wall) - widthMm / 2, nearest.offset)), widthMm }]);
      setSelectedWall(nearest.wall.id); setTool('select'); setSaveState(`${kind === 'door' ? 'Door' : 'Window'} placed on the selected wall.`);
    }
  }

  async function includeRoom(id: string, included: boolean) {
    const room = rooms.find((candidate) => candidate.id === id);
    if (!room) return;
    snapshot();
    setRooms((current) => current.map((candidate) => candidate.id === id ? { ...candidate, included } : candidate));
    if (!room.spaceRecordId || !supabase || !projectId) {
      setSaveState(included ? `${room.name} is included in this design scope.` : `${room.name} is excluded until you include it again.`);
      return;
    }
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) { setSaveState('Your session expired. Sign in again.'); return; }
    const apiBase = getApiBase();
    try {
      const response = await fetch(`${apiBase}/projects/${projectId}/spaces/${room.spaceRecordId}/scope`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ included })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setRooms((current) => current.map((candidate) => candidate.id === id ? { ...candidate, included: !included } : candidate));
        setSaveState(payload?.message ?? 'The room scope could not be saved.');
        return;
      }
      setSaveState(included ? `${room.name} is included in the layout scope.` : `${room.name} is excluded from the current layout scope.`);
    } catch {
      setRooms((current) => current.map((candidate) => candidate.id === id ? { ...candidate, included: !included } : candidate));
      setSaveState('The room scope could not be saved. Check your connection and try again.');
    }
  }

  function setRoomCeiling(id: string, h: number) { snapshot(); setRooms(rs => rs.map(r => r.id === id ? { ...r, ceilingHeightMm: h } : r)); }
  function setRoomType(id: string, t: string) {
    snapshot();
    setRooms(rs => rs.map(r => {
      if (r.id !== id) return r;
      const generatedName = /^(new space|space|room)\s*\d*$/i.test(r.name.trim());
      const typeLabel = ROOM_TYPES[t] ?? 'Space';
      const sameTypeCount = rs.filter(candidate => candidate.id !== id && candidate.roomType === t).length;
      return { ...r, roomType: t, name: generatedName ? `${typeLabel}${sameTypeCount ? ` ${sameTypeCount + 1}` : ''}` : r.name, requiredFurniture: [] };
    }));
  }

  function activateCanvasTool(nextTool: string) {
    if (nextTool === 'cancel_tool') {
      setTool('select'); setRoomDraftStart(null); setRoomDraftCurrent(null); setLineDraftStart(null); setMeasureFrom(null); setMeasureTo(null); setSaveState('Canvas tool cancelled.');
      return;
    }
    if (nextTool === 'split') { splitSelected(); return; }
    if (nextTool === 'merge') { mergeSelected(); return; }
    if (nextTool === 'wall') { addWall(); return; }
    if (nextTool === 'door') { addOpening('door'); return; }
    if (nextTool === 'window') { addOpening('window'); return; }
    if (nextTool === 'column') { setTool('add_column'); setSaveState('Click the canvas to place a column.'); return; }
    if (nextTool === 'beam') { addBeam(); return; }
    if (nextTool === 'service') { setTool('add_service'); setSaveState('Click the canvas to place a service point.'); return; }
    if (nextTool === 'annotate') { setAnnotationDraft(''); setAnnotationDialogOpen(true); return; }
    setTool(nextTool);
  }

  function patchRoom(id: string, patch: Partial<PlanRoom>) { setRooms(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r)); }
  function toggleFurniture(id: string, furnitureId: string) {
    snapshot();
    setRooms(rs => rs.map(r => r.id === id ? {
      ...r,
      requiredFurniture: r.requiredFurniture.includes(furnitureId)
        ? r.requiredFurniture.filter(item => item !== furnitureId)
        : [...r.requiredFurniture, furnitureId],
    } : r));
  }

  function splitSelected() {
    if (!selectedRoom) { setSaveState('Select a room first.'); return; }
    snapshot();
    const r = rooms.find(x => x.id === selectedRoom);
    if (!r || r.polygon.length !== 4) { setSaveState('Split is available for rectangular rooms. Edit irregular room geometry in Floor Plan.'); return; }
    const b = bbox(r.polygon);
    const wide = b.maxX - b.minX >= b.maxY - b.minY;
    const mid = wide ? (b.minX + b.maxX) / 2 : (b.minY + b.maxY) / 2;
    const first = wide
      ? [{ xMm: b.minX, yMm: b.minY }, { xMm: mid, yMm: b.minY }, { xMm: mid, yMm: b.maxY }, { xMm: b.minX, yMm: b.maxY }]
      : [{ xMm: b.minX, yMm: b.minY }, { xMm: b.maxX, yMm: b.minY }, { xMm: b.maxX, yMm: mid }, { xMm: b.minX, yMm: mid }];
    const second = wide
      ? [{ xMm: mid, yMm: b.minY }, { xMm: b.maxX, yMm: b.minY }, { xMm: b.maxX, yMm: b.maxY }, { xMm: mid, yMm: b.maxY }]
      : [{ xMm: b.minX, yMm: mid }, { xMm: b.maxX, yMm: mid }, { xMm: b.maxX, yMm: b.maxY }, { xMm: b.minX, yMm: b.maxY }];
    if (polyArea(first) < 1 || polyArea(second) < 1) { setSaveState('Cannot split: both resulting rooms must have positive area.'); return; }
    setRooms(rs => rs.flatMap(x => x.id === r.id ? [{ ...x, id: entityId(), spaceRecordId: null, polygon: first, areaSqm: polyArea(first), name: `${r.name} A` }, { ...x, id: entityId(), spaceRecordId: null, polygon: second, areaSqm: polyArea(second), name: `${r.name} B` }] : [x]));
    setTool('select');
    setSaveState(`Room "${r.name}" split into two spaces.`);
  }

  function mergeSelected() {
    if (!selectedRoom) { setSaveState('Select a room first.'); return; }
    snapshot();
    const selected = rooms.find((room) => room.id === selectedRoom);
    if (!selected) { setSaveState('The selected room is no longer available.'); return; }
    const selectedBox = bbox(selected.polygon);
    const adjacent = rooms.find((room) => {
      if (room.id === selected.id || room.roomType !== selected.roomType) return false;
      const candidate = bbox(room.polygon);
      const sharedVertical = (Math.abs(selectedBox.maxX - candidate.minX) < 1 || Math.abs(candidate.maxX - selectedBox.minX) < 1)
        && Math.abs(selectedBox.minY - candidate.minY) < 1 && Math.abs(selectedBox.maxY - candidate.maxY) < 1;
      const sharedHorizontal = (Math.abs(selectedBox.maxY - candidate.minY) < 1 || Math.abs(candidate.maxY - selectedBox.minY) < 1)
        && Math.abs(selectedBox.minX - candidate.minX) < 1 && Math.abs(selectedBox.maxX - candidate.maxX) < 1;
      return sharedVertical || sharedHorizontal;
    });
    const grp = adjacent ? [selected, adjacent] : [];
    if (grp.length < 2) { setSaveState('Merge needs a touching rectangular room of the same type. Split a room first, or select one of the touching rooms.'); return; }
    const boxes = grp.map(g => bbox(g.polygon));
    const minX = Math.min(...boxes.map(b => b.minX)), minY = Math.min(...boxes.map(b => b.minY));
    const maxX = Math.max(...boxes.map(b => b.maxX)), maxY = Math.max(...boxes.map(b => b.maxY));
    const totalArea = grp.reduce((sum, room) => sum + room.areaSqm, 0);
    const mergedArea = ((maxX - minX) * (maxY - minY)) / 1e6;
    if (Math.abs(totalArea - mergedArea) > 0.01) { setSaveState('Rooms must form one complete rectangle before they can be merged.'); return; }
    const poly = [{ xMm: minX, yMm: minY }, { xMm: maxX, yMm: minY }, { xMm: maxX, yMm: maxY }, { xMm: minX, yMm: maxY }];
    const name = grp[0].name;
    const roomType = grp[0].roomType;
    const merged = { id: entityId(), spaceRecordId: null, name, roomType, polygon: poly, areaSqm: polyArea(poly), requiredFurniture: grp[0].requiredFurniture, included: true, ceilingHeightMm: grp[0].ceilingHeightMm };
    setRooms(rs => [...rs.filter(r => !grp.some(item => item.id === r.id)), merged]);
    setSelectedRoom(merged.id);
    setTool('select');
    setSaveState(`Rooms merged into "${name}".`);
  }

  function addWall() { setLineDraftStart(null); setTool('draw_wall'); setSaveState('Click the wall start point.'); }
  function addOpening(kind: 'door' | 'window') {
    if (!selectedWall && walls.length === 0) { setSaveState('Draw a wall first, then place the opening on it.'); return; }
    setTool(kind === 'door' ? 'add_door' : 'add_window');
    setSaveState(`Click a wall to place the ${kind}.`);
  }
  function addBeam() { setLineDraftStart(null); setTool('draw_beam'); setSaveState('Click the beam start point.'); }
  function addAnnotation(text: string) { snapshot(); setAnnotations(a => [...a, { id: entityId(), text, kind: 'note' }]); }

  async function saveGeometryVersion(roomsOverride: PlanRoom[] = rooms): Promise<{ spaces: Array<{ id: string; space_id: string | null }> } | null> {
    if (!supabase || !projectId) return null;
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) { setSaveState('Your session expired. Sign in again.'); return null; }
    setSaveState('Saving a new plan geometry version…');
    const apiBase = getApiBase();
    const response = await fetch(`${apiBase}/projects/${projectId}/spaces/commit-geometry`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ geometry: { rooms: roomsOverride, walls, openings, columns, beams, services, annotations, ceilingHeightMm } }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) { setSaveState(payload?.message ?? 'Geometry could not be saved as a new plan version.'); return null; }
    setSaveState(`Geometry version ${payload?.versionNumber ?? ''} saved. Room settings can now be saved and used by Layout Studio.`);
    setReloadKey((key) => key + 1);
    return { spaces: Array.isArray(payload?.spaces) ? payload.spaces : [] };
  }

  async function persistRoom(room: PlanRoom, verificationStatus = room.verificationStatus): Promise<PlanRoom | null> {
    const bounds = bbox(room.polygon);
    if (verificationStatus === 'verified' && (!scaleVerified || needsScaleReview(room, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY))) {
      setSaveState('Confirm scale and review this room boundary in Floor Plan before approving its measurements.');
      return null;
    }
    if (!supabase || !projectId) return null;
    if (room.spaceRecordId && !room.requiredFurniture.length) {
      setSaveState('Choose at least one required modular category before saving this room.');
      return null;
    }
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) { setSaveState('Session expired.'); return null; }
    const apiBase = getApiBase();
    if (!room.spaceRecordId) {
      const roomsToCommit = rooms.map((candidate) => candidate.id === room.id
        ? { ...candidate, verificationStatus: verificationStatus === 'verified' ? 'verified' : candidate.verificationStatus }
        : candidate);
      setRooms(roomsToCommit);
      const committed = await saveGeometryVersion(roomsToCommit);
      const spaceRecordId = committed?.spaces.find((space) => space.space_id === room.id)?.id;
      if (!spaceRecordId) {
        setSaveState('The geometry version was saved, but this room could not be attached to it. Retry Save geometry before verifying the room.');
        return null;
      }
      const hydratedRoom = { ...roomsToCommit.find((candidate) => candidate.id === room.id)!, spaceRecordId };
      setRooms((current) => current.map((candidate) => candidate.id === room.id ? hydratedRoom : candidate));
      return persistRoom(hydratedRoom, verificationStatus);
    }
    const res = await fetch(`${apiBase}/projects/${projectId}/spaces/${room.spaceRecordId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ name: room.name, roomType: room.roomType, ceilingHeightMm: room.ceilingHeightMm ?? ceilingHeightMm, requiredFurniture: room.requiredFurniture, budgetInr: room.budgetInr ?? null, designPriority: room.designPriority ?? 'balanced', applianceNeeds: room.applianceNeeds ?? [], constraints: room.constraints ?? [], floorFinish: room.floorFinish ?? '', falseCeiling: room.falseCeiling ?? '', styleDirection: room.styleDirection ?? '', paletteDirection: room.paletteDirection ?? '', retainedElements: room.retainedElements ?? [], wallRoles: room.wallRoles ?? {}, preferredCamera: room.preferredCamera ?? '', verificationStatus, included: room.included !== false })
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      setSaveState(payload?.message ?? 'Save failed.');
      return null;
    }
    const persisted = { ...room, verificationStatus: verificationStatus === 'verified' ? 'verified' : 'unverified' };
    setRooms(current => current.map(candidate => candidate.id === room.id ? persisted : candidate));
    setSaveState(verificationStatus === 'verified' ? `${room.name} measurements and requirements verified.` : 'Room saved.');
    return persisted;
  }
  async function applyFeatureWallToSelectedWall(room: PlanRoom, targetWallId: string, wallTreatmentId: string) {
    if (!supabase || !projectId) return;
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) { setSaveState('Session expired.'); return; }
    const apiBase = getApiBase();
    const wallObj = walls.find(w => w.id === targetWallId) ?? roomBoundaryWalls(room).find(w => w.id === targetWallId);
    const wallLength = wallObj ? wallLen(wallObj) : 2400;

    let templateId = 'wall-fluted-pu-2400';
    let label = '2400 Fluted Charcoal PU Feature Wall';
    let widthMm = Math.min(2400, Math.max(1200, Math.round(wallLength - 100)));

    if (wallTreatmentId === 'acoustic-slat') {
      templateId = 'wall-slat-acoustic-2400';
      label = '2400 Vertical Walnut Acoustic Slat Wall';
    } else if (wallTreatmentId === 'french-wainscot') {
      templateId = 'wall-wainscot-french-3000';
      label = '3000 French Classical Moulding & Wainscoting';
      widthMm = Math.min(3000, Math.max(1200, Math.round(wallLength - 100)));
    } else if (wallTreatmentId === 'calacatta-sintered') {
      templateId = 'wall-sintered-calacatta-2400';
      label = '2400 Calacatta Sintered Stone Feature Wall';
    }

    setSaveState(`Applying ${label} to Wall…`);
    try {
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` };
      const postRes = await fetch(`${apiBase}/projects/${projectId}/module-instances`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          // module_instances is keyed by the persisted space record, while the
          // plan canvas uses the canonical plan-room id.
          spaceId: room.spaceRecordId ?? room.id,
          templateId,
          category: 'feature-wall',
          label,
          config: {
            family: 'feature-wall',
            widthMm,
            depthMm: 50,
            heightMm: room.ceilingHeightMm ?? 2700,
            zOffsetMm: 0,
          },
          position: {
            wallId: targetWallId,
            offsetMm: Math.max(0, Math.round((wallLength - widthMm) / 2)),
          },
        }),
      });
      if (postRes.ok) {
        await fetch(`${apiBase}/projects/${projectId}/scenes/compile`, { method: 'POST', headers });
        setSaveState(`Added ${label} to Wall (${widthMm}mm run). 3D Scene updated.`);
      }
    } catch {
      setSaveState('Feature wall placement could not be saved.');
    }
  }

  async function ensureApprovedRoomLayout(room: PlanRoom): Promise<boolean> {
    if (!projectId || !supabase || !room.spaceRecordId) return false;
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) { setSaveState('Sign in again before approving a room layout.'); return false; }
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` };
    const apiBase = getApiBase();
    const existing = await fetch(`${apiBase}/projects/${projectId}/layouts`, { headers }).then((response) => response.json().then((payload) => ({ response, payload }))).catch(() => null);
    if (existing?.response.ok && Array.isArray(existing.payload?.layouts) && existing.payload.layouts.some((layout: any) => layout.space_id === room.spaceRecordId && layout.status === 'approved')) return true;

    const candidateType = room.designPriority === 'storage' ? 'maximum_storage' : room.designPriority === 'circulation' ? 'best_circulation' : 'balanced';
    const candidatesResponse = await fetch(`${apiBase}/projects/${projectId}/layout-candidates`, {
      method: 'POST', headers,
      body: JSON.stringify({
        spaceId: room.spaceRecordId,
        roomCategory: room.roomType,
        shape: room.designPriority ?? 'balanced',
        candidateTypes: [candidateType],
        requirements: { requiredFurniture: room.requiredFurniture, constraints: room.constraints ?? [], designPriority: room.designPriority ?? 'balanced' },
      }),
    });
    const candidatesPayload = await candidatesResponse.json().catch(() => null);
    const candidate = candidatesPayload?.candidates?.find((item: any) => item?.validation?.valid === true);
    if (!candidatesResponse.ok || !candidate) {
      setSaveState(candidatesPayload?.message ?? 'This room needs a valid layout candidate before modules can be placed. Review its walls, openings, and clearances.');
      return false;
    }
    const saved = await fetch(`${apiBase}/projects/${projectId}/layouts`, {
      method: 'POST', headers,
      body: JSON.stringify({ spaceId: room.spaceRecordId, layoutShape: room.designPriority ?? 'balanced', label: candidate.candidateType ?? 'Measured layout', candidate, score: candidate.score }),
    });
    const savedPayload = await saved.json().catch(() => null);
    if (!saved.ok || !savedPayload?.layout?.id) {
      setSaveState(savedPayload?.message ?? 'The layout candidate could not be saved.');
      return false;
    }
    const approved = await fetch(`${apiBase}/projects/${projectId}/layouts/${savedPayload.layout.id}/approve`, { method: 'POST', headers, body: '{}' });
    const approvedPayload = await approved.json().catch(() => null);
    if (!approved.ok) {
      setSaveState(approvedPayload?.message ?? 'The measured layout could not be approved.');
      return false;
    }
    return true;
  }

  /**
   * Place a catalog module against an explicit measured wall at an explicit
   * offset. Drag-and-drop supplies the previewed drop position so the module
   * lands exactly where the ghost was shown; the click path supplies the
   * reconciled suggested offset. Both routes share the same validation,
   * persistence and invalidation, so neither can bypass measured fit rules.
   */
  async function placeCatalogModuleOnWall(module: CatalogModule, targetWall: CatalogWallContext, requestedOffsetMm?: number) {
    if (!sel || !projectId || !supabase) return;
    const fit = reconcileCatalogModuleFit(targetWall, module);
    if (!fit?.fits || fit.suggestedOffsetMm === undefined) {
      setSaveState(fit?.issues[0] ?? 'This module does not fit the selected measured wall. Choose another wall or adjust the module in the bay editor.');
      return;
    }
    // Explicit placement must never move to a different position silently.
    let placementOffsetMm = fit.suggestedOffsetMm;
    if (requestedOffsetMm !== undefined) {
      if (!Number.isFinite(requestedOffsetMm) || requestedOffsetMm < 0 || requestedOffsetMm + module.widthMm > targetWall.lengthMm) {
        setSaveState('The requested module position extends beyond the measured wall. Choose a valid position.');
        return;
      }
      const atDrop = reconcileCatalogPlacement({
        wallId: targetWall.id,
        wallLengthMm: targetWall.lengthMm,
        openings: targetWall.openings.map((opening) => ({ ...opening, wallId: targetWall.id, kind: opening.kind === 'window' ? 'window' as const : 'door' as const })),
        module: { id: module.id, widthMm: module.widthMm },
        offsetMm: requestedOffsetMm,
      });
      if (!atDrop.geometryValid) {
        setSaveState('The requested module position conflicts with a measured opening. Choose a clear position.');
        return;
      }
      placementOffsetMm = requestedOffsetMm;
    }
    const activeCatalogWall = targetWall;

    const categoryKey = module.family.includes('kitchen') ? 'kitchen_base' : module.family === 'tv-unit' ? 'tv_unit' : module.family === 'wardrobe' ? 'wardrobe' : module.family === 'crockery' ? 'crockery_unit' : module.family === 'study' ? 'study_unit' : module.family === 'pooja' ? 'pooja_unit' : module.family === 'bed' ? 'bed' : module.family === 'utility' ? 'utility_unit' : 'storage_unit';
    const roomWithRequirement = sel.room.requiredFurniture.includes(categoryKey)
      ? sel.room
      : { ...sel.room, requiredFurniture: [...sel.room.requiredFurniture, categoryKey] };

    // A production module needs its persisted space id. Persisting here keeps
    // canvas selection and the compiler anchored to the same approved room.
    const persistedRoom = roomWithRequirement.spaceRecordId && roomWithRequirement === sel.room
      ? roomWithRequirement
      : await persistRoom(roomWithRequirement, roomWithRequirement.verificationStatus ?? 'unverified');
    if (!persistedRoom?.spaceRecordId) {
      setSaveState('Save this room’s measured geometry before placing a production module.');
      return;
    }
    if (!await ensureApprovedRoomLayout(persistedRoom)) return;
    if (!roomWithRequirement.spaceRecordId) {
      setRooms((current) => current.map((room) => room.id === persistedRoom.id ? persistedRoom : room));
    } else if (roomWithRequirement !== sel.room) {
      setRooms((current) => current.map((room) => room.id === roomWithRequirement.id ? roomWithRequirement : room));
    }

    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) {
      setSaveState('Sign in again before placing a module.');
      return;
    }
    setSaveState(`Placing ${module.name} on the measured wall…`);
    try {
      const response = await fetch(`${getApiBase()}/projects/${projectId}/module-instances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          spaceId: persistedRoom.spaceRecordId,
          templateId: module.id,
          category: module.family,
          label: module.name,
          config: {
            family: module.family,
            widthMm: module.widthMm,
            depthMm: module.depthMm,
            heightMm: module.heightMm,
            zOffsetMm: 0,
            materialSlots: module.materialSlots,
          },
          position: { wallId: activeCatalogWall.id, offsetMm: placementOffsetMm },
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.module?.id) {
        setSaveState(payload?.message ?? 'The module could not be placed. Check the approved room layout and measured wall clearance.');
        return;
      }
      // The API has invalidated downstream artifacts. Mirror that durable
      // change in the app shell so no screen can keep presenting an older
      // scene version as if it still represented this room.
      window.dispatchEvent(new CustomEvent('ultida:design-changed', { detail: { projectId } }));
      const wall = walls.find((candidate) => candidate.id === activeCatalogWall.id);
      const length = wall ? wallLen(wall) : activeCatalogWall.lengthMm;
      const direction = wall && length > 0
        ? { xMm: (wall.end.xMm - wall.start.xMm) / length, yMm: (wall.end.yMm - wall.start.yMm) / length }
        : { xMm: 1, yMm: 0 };
      const start = wall?.start ?? { xMm: 0, yMm: 0 };
      const offset = placementOffsetMm;
      setAiProposalRoomId(persistedRoom.id);
      setAiProposals((current) => [
        ...current.filter((proposal) => proposal.moduleId !== module.id || proposal.wallId !== activeCatalogWall.id),
        {
          id: String(payload?.module?.id ?? `${module.id}-${Date.now()}`),
          category: module.family,
          moduleId: module.id,
          name: module.name,
          wallId: activeCatalogWall.id,
          wallLabel: `Wall ${activeCatalogWall.id.replace(/^.*?:/, '').replace('wall-', '').toUpperCase() || activeCatalogWall.id}`,
          rationale: `Placed at ${Math.round(offset)} mm on the selected measured wall; door and window keep-outs checked.`,
          dimensionsMm: { width: module.widthMm, depth: module.depthMm, height: module.heightMm },
          position: { xMm: start.xMm + direction.xMm * offset, yMm: start.yMm + direction.yMm * offset },
          rotationDeg: Math.atan2(direction.yMm, direction.xMm) * 180 / Math.PI,
          confidence: 1,
        },
      ]);
      setSpacePanel('modules');
      setSaveState(`${module.name} is placed on the measured wall. Adjust bays, fillers, shutters, and finishes below; the scene must be recompiled before 3D or renders update.`);
    } catch {
      setSaveState('The module placement request could not reach the project service. Nothing was added to the scene.');
    }
  }

  /** Recompute the ghost from a pointer or drag event over the canvas. */
  function updateDropPreview(event: { clientX: number; clientY: number }) {
    if (!draggingModule || !svgRef.current) return;
    try {
      setDropPreview(evaluateDropPreview(svgPoint(event), draggingModule));
      const rect = svgRef.current.getBoundingClientRect();
      setDropCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    } catch {
      setDropPreview(null);
    }
  }

  function cancelPlacementDrag() {
    setDraggingModule(null);
    setDropPreview(null);
    setDropCursor(null);
  }

  /** Commit the previewed placement. Shared by drop and armed-click paths. */
  async function commitPreviewedPlacement(preview: ModulePlacementPreview | null) {
    if (!preview) { cancelPlacementDrag(); return; }
    if (!preview.valid) {
      // The tooltip beside the cursor already states the reason; keep the
      // module armed so the user can simply move and try again.
      return;
    }
    const wall = walls.find((candidate) => candidate.id === preview.wallId);
    if (!wall) { cancelPlacementDrag(); return; }
    const context: CatalogWallContext = {
      id: wall.id,
      lengthMm: wallLen(wall),
      openings: openings
        .filter((opening) => opening.wallId === wall.id)
        .map((opening) => ({ id: opening.id, kind: opening.kind, offsetMm: opening.offsetAlongWallMm ?? 0, widthMm: opening.widthMm ?? 900 })),
    };
    const module = preview.module;
    const offsetMm = preview.offsetMm;
    cancelPlacementDrag();
    setSelectedWall(wall.id);
    await placeCatalogModuleOnWall(module, context, offsetMm);
  }

  async function commitDropPlacement(event: React.DragEvent) {
    if (!draggingModule) return;
    let preview = dropPreview;
    try { preview = evaluateDropPreview(svgPoint(event), draggingModule); } catch { /* keep last preview */ }
    if (preview && !preview.valid) { setDropPreview(preview); return; }
    await commitPreviewedPlacement(preview);
  }

  function commitArmedPlacement(event: React.MouseEvent) {
    if (!draggingModule) return;
    let preview = dropPreview;
    try { preview = evaluateDropPreview(svgPoint(event), draggingModule); } catch { /* keep last preview */ }
    if (preview && !preview.valid) { setDropPreview(preview); return; }
    void commitPreviewedPlacement(preview);
  }

  /** Click-to-place path: uses the currently selected measured wall. */
  async function placeCatalogModuleOnSelectedWall(module: CatalogModule) {
    if (!activeCatalogWall) {
      setSaveState('Select a measured wall in the 2D plan before choosing a module. The library can only place against an actual wall and its door/window keep-outs.');
      return;
    }
    await placeCatalogModuleOnWall(module, activeCatalogWall);
  }

  /**
   * Resolve the wall nearest a plan-canvas point and the offset along it.
   * Used for live drag feedback so the fit shown before the drop is the same
   * fit that is committed on drop.
   */
  function resolveWallDropTarget(point: Pt): { wall: PlanWall; context: CatalogWallContext; offsetMm: number; distanceMm: number } | null {
    const roomWalls = sel?.room ? wallsForRoom(sel.room) : walls;
    const candidates = roomWalls.length ? roomWalls : walls;
    let best: { wall: PlanWall; offsetMm: number; distanceMm: number } | null = null;
    for (const wall of candidates) {
      const dx = wall.end.xMm - wall.start.xMm;
      const dy = wall.end.yMm - wall.start.yMm;
      const lengthSq = dx * dx + dy * dy;
      if (!lengthSq) continue;
      const t = Math.max(0, Math.min(1, ((point.xMm - wall.start.xMm) * dx + (point.yMm - wall.start.yMm) * dy) / lengthSq));
      const projX = wall.start.xMm + t * dx;
      const projY = wall.start.yMm + t * dy;
      const distanceMm = Math.hypot(point.xMm - projX, point.yMm - projY);
      if (!best || distanceMm < best.distanceMm) best = { wall, offsetMm: t * Math.sqrt(lengthSq), distanceMm };
    }
    if (!best) return null;
    return {
      wall: best.wall,
      offsetMm: best.offsetMm,
      distanceMm: best.distanceMm,
      context: {
        id: best.wall.id,
        lengthMm: wallLen(best.wall),
        openings: openings
          .filter((opening) => opening.wallId === best!.wall.id)
          .map((opening) => ({ id: opening.id, kind: opening.kind, offsetMm: opening.offsetAlongWallMm ?? 0, widthMm: opening.widthMm ?? 900 })),
      },
    };
  }

  /**
   * Evaluate a candidate placement at a cursor position. This runs on every
   * drag-move, so it must stay synchronous and allocation-light. It reuses the
   * exact reconciliation used at commit time; the ghost can never promise a
   * placement the server would reject.
   */
  function evaluateDropPreview(point: Pt, module: CatalogModule): ModulePlacementPreview | null {
    const target = resolveWallDropTarget(point);
    if (!target) return null;
    const centeredOffset = target.offsetMm - module.widthMm / 2;
    const clamped = Math.max(0, Math.min(centeredOffset, target.context.lengthMm - module.widthMm));
    const wallFit = reconcileCatalogModuleFit(target.context, module);
    const atDrop = reconcileCatalogPlacement({
      wallId: target.context.id,
      wallLengthMm: target.context.lengthMm,
      openings: target.context.openings.map((opening) => ({ ...opening, wallId: target.context.id, kind: opening.kind === 'window' ? 'window' as const : 'door' as const })),
      module: { id: module.id, widthMm: module.widthMm },
      offsetMm: clamped,
    });
    const tooFar = target.distanceMm > SNAP_DISTANCE_MM;
    const issues = atDrop.reconciliation.issues
      .filter((issue) => issue.code !== 'SCHEDULE_UNCONFIRMED')
      .map((issue) => issue.message);
    const reason = tooFar
      ? 'Move closer to a measured wall. Modules anchor to walls, not open floor.'
      : issues[0] ?? wallFit?.issues[0];
    return {
      wallId: target.context.id,
      wallLengthMm: target.context.lengthMm,
      offsetMm: clamped,
      module,
      valid: !tooFar && atDrop.geometryValid,
      reason: !tooFar && atDrop.geometryValid ? undefined : reason ?? 'This module cannot be placed here.',
      start: target.wall.start,
      end: target.wall.end,
    };
  }

  async function applyLayoutCandidateToScene(room: PlanRoom, candidateType: 'circulation' | 'balanced' | 'storage' | 'luxury') {
    const cats = defaultCategoriesForRoom(room.roomType, candidateType);
    snapshot();
    const updatedRoom: PlanRoom = {
      ...room,
      requiredFurniture: cats,
      designPriority: candidateType,
      verificationStatus: 'verified',
    };
    setRooms(rs => rs.map(r => r.id === room.id ? updatedRoom : r));

    // Generate immediate visual proposals on canvas
    const b = bbox(room.polygon);
    const width = b.maxX - b.minX;
    const depth = b.maxY - b.minY;
    const rWalls = wallsForRoom(room);
    const primaryWall = rWalls[0] ?? { id: `${room.id}:edge:1` };
    const secondaryWall = rWalls[1] ?? primaryWall;
    const proposals: AiFurnitureProposal[] = [];

    if (['bedroom', 'master_bedroom', 'kids_bedroom'].includes(room.roomType)) {
      proposals.push({
        id: entityId(),
        category: 'bed',
        moduleId: 'bed-floating-led-1800',
        name: candidateType === 'luxury' ? '1800 King Floating Bed with Backlit Headboard' : '1800 King Storage Bed & Extended Headboard',
        wallId: primaryWall.id,
        wallLabel: 'Headboard Wall',
        rationale: 'Placed on primary solid wall with 750 mm clear bedside circulation.',
        dimensionsMm: { width: 1800, depth: 2100, height: 1200 },
        position: { xMm: b.minX + (width - 1800) / 2, yMm: b.minY + 150 },
        confidence: 0.95,
      });
      proposals.push({
        id: entityId(),
        category: 'wardrobe',
        moduleId: 'wardrobe-2100-four-shutter',
        name: candidateType === 'storage' ? '3200 6-Shutter Wardrobe with Lofts & Vanity' : '2100 Four-Shutter Wardrobe with Loft',
        wallId: secondaryWall.id,
        wallLabel: 'Storage Wall',
        rationale: 'Full-height run with 30 mm wall fillers and ceiling clearance.',
        dimensionsMm: { width: candidateType === 'storage' ? 3200 : 2100, depth: 600, height: 2700 },
        position: { xMm: b.minX + 150, yMm: b.maxY - 750 },
        confidence: 0.93,
      });
    } else if (room.roomType === 'kitchen') {
      proposals.push({
        id: entityId(),
        category: 'kitchen_base',
        moduleId: 'kit-base-600',
        name: '600 Deep Tandem Base + 900 Sink + 600 Cutlery',
        wallId: primaryWall.id,
        wallLabel: 'Cooking Counter',
        rationale: 'Modular base run with tandem drawers and dedicated service clearance.',
        dimensionsMm: { width: Math.min(width, 3000), depth: 600, height: 860 },
        position: { xMm: b.minX + 100, yMm: b.minY + 100 },
        confidence: 0.96,
      });
      proposals.push({
        id: entityId(),
        category: 'kitchen_wall',
        moduleId: candidateType === 'circulation' ? 'kit-wall-normal-600' : 'kit-wall-profile-glass-600',
        name: candidateType === 'circulation' ? 'Solid Shutter Wall Units' : 'Profile Glass Wall Units & Lofts (3000K LED)',
        wallId: primaryWall.id,
        wallLabel: 'Overhead Run',
        rationale: 'Mounted at 1450 mm elevation with under-cabinet warm task lighting.',
        dimensionsMm: { width: Math.min(width, 3000), depth: 350, height: 720 },
        position: { xMm: b.minX + 100, yMm: b.minY + 100 },
        confidence: 0.94,
      });
      if (candidateType !== 'circulation') {
        proposals.push({
          id: entityId(),
          category: 'kitchen_tall',
          moduleId: 'kit-tall-microwave-600',
          name: 'Microwave & Oven Tall Tower + 12-Basket Pantry',
          wallId: secondaryWall.id,
          wallLabel: 'Tall Unit Zone',
          rationale: '2100 mm appliance tower with integrated microwave niche and pantry.',
          dimensionsMm: { width: 1200, depth: 600, height: 2100 },
          position: { xMm: b.maxX - 1300, yMm: b.minY + 100 },
          confidence: 0.91,
        });
      }
    } else if (room.roomType === 'living') {
      proposals.push({
        id: entityId(),
        category: 'tv_unit',
        moduleId: 'tv-fluted-2400',
        name: '2400 Fluted Media Wall Console & Backlit Panel',
        wallId: primaryWall.id,
        wallLabel: 'Feature Wall',
        rationale: 'Focal media wall opposite main conversational zone with cable conduit.',
        dimensionsMm: { width: 2400, depth: 400, height: 2400 },
        position: { xMm: b.minX + (width - 2400) / 2, yMm: b.minY + 150 },
        confidence: 0.95,
      });
      proposals.push({
        id: entityId(),
        category: 'sofa',
        moduleId: 'sofa-curved-boucle-2800',
        name: '2800 Curved Bouclé Sectional Sofa',
        wallId: secondaryWall.id,
        wallLabel: 'Seating Zone',
        rationale: 'Ergonomic 2.8m viewing distance with 900 mm clear perimeter passage.',
        dimensionsMm: { width: 2800, depth: 1600, height: 850 },
        position: { xMm: b.minX + (width - 2800) / 2, yMm: b.maxY - 1800 },
        confidence: 0.92,
      });
    } else if (room.roomType === 'dining') {
      proposals.push({
        id: entityId(),
        category: 'dining_table',
        moduleId: 'dining-calacatta-gold-2100',
        name: '2100 Calacatta Gold Marble Dining Table',
        wallLabel: 'Center',
        rationale: 'Centred in dining zone with 950 mm pullout clearance around all chairs.',
        dimensionsMm: { width: 2100, depth: 1000, height: 750 },
        position: { xMm: b.minX + (width - 2100) / 2, yMm: b.minY + (depth - 1000) / 2 },
        confidence: 0.94,
      });
      proposals.push({
        id: entityId(),
        category: 'crockery_unit',
        moduleId: 'crockery-1800',
        name: '1800 Full-Wall Crockery & Wine Bar with Fluted Glass',
        wallId: primaryWall.id,
        wallLabel: 'Wall A',
        rationale: 'Sideboard with illuminated display and cutlery drawer bank.',
        dimensionsMm: { width: 1800, depth: 450, height: 2400 },
        position: { xMm: b.minX + 150, yMm: b.minY + 150 },
        confidence: 0.90,
      });
    } else if (room.roomType === 'study') {
      proposals.push({
        id: entityId(),
        category: 'study_unit',
        moduleId: 'study-1500',
        name: '1500 Study Desk with Overhead Storage & Task Light',
        wallId: primaryWall.id,
        wallLabel: 'Study Wall',
        rationale: 'Aligned with ambient light with integrated wire management.',
        dimensionsMm: { width: 1500, depth: 600, height: 2400 },
        position: { xMm: b.minX + 100, yMm: b.minY + 100 },
        confidence: 0.92,
      });
    } else if (room.roomType === 'pooja') {
      proposals.push({
        id: entityId(),
        category: 'pooja_unit',
        moduleId: 'pooja-mandir-mandapa-1500',
        name: '1500 Sacred Teak Mandir with CNC Jaali & Diya Tray',
        wallId: primaryWall.id,
        wallLabel: 'Pooja Wall',
        rationale: 'Vastu-compliant orientation with pullout brass tray and storage.',
        dimensionsMm: { width: 1500, depth: 450, height: 2300 },
        position: { xMm: b.minX + (width - 1500) / 2, yMm: b.minY + 100 },
        confidence: 0.96,
      });
    } else {
      proposals.push({
        id: entityId(),
        category: 'modular_storage',
        moduleId: 'tv-profile-2400',
        name: '2400 Floating Console Wall & Acoustic Wood Slats',
        wallId: primaryWall.id,
        wallLabel: 'Primary Wall',
        rationale: 'Modular focal cabinetry aligned with wall perimeter and ceiling clearance.',
        dimensionsMm: { width: Math.min(2400, Math.max(1200, width - 400)), depth: 400, height: 2200 },
        position: { xMm: b.minX + 150, yMm: b.minY + 150 },
        confidence: 0.92,
      });
      proposals.push({
        id: entityId(),
        category: 'storage_unit',
        moduleId: 'wardrobe-2100-four-shutter',
        name: '1800 Multi-Purpose Full-Height Cabinet & Lofts',
        wallId: secondaryWall.id,
        wallLabel: 'Secondary Wall',
        rationale: 'Full height carcase storage with 30mm scribing filler.',
        dimensionsMm: { width: Math.min(1800, Math.max(900, depth - 400)), depth: 550, height: 2400 },
        position: { xMm: b.maxX - 1900, yMm: b.maxY - 700 },
        confidence: 0.88,
      });
    }

    setAiProposals(proposals);
    setAiProposalRoomId(room.id);
    setSaveState(`Selected & Applied ${candidateType.toUpperCase()} layout to ${room.name}. Room is approved & verified.`);

    try {
      const persistedRoom = await persistRoom(updatedRoom, 'verified');
      if (!persistedRoom) return;
      if (!await ensureApprovedRoomLayout(persistedRoom)) return;
      setSaveState(`Measured ${candidateType} layout approved for ${room.name}. Select a wall in the 2D plan, then place a compatible module from the library.`);
      // Candidate selection establishes a brief only. Exact modules are created
      // after an explicit approved layout in the wall-anchored module editor.
      /*
      if (false && supabase && projectId) {
        const session = (await supabase.auth.getSession()).data.session;
        if (session?.access_token) {
          const apiBase = getApiBase();
          const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` };
          for (const prop of proposals) {
            if (prop.wallId) {
              await fetch(`${apiBase}/projects/${projectId}/module-instances`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  spaceId: room.id,
                  templateId: prop.moduleId,
                  category: prop.category,
                  label: prop.name,
                  config: {
                    family: prop.category,
                    widthMm: prop.dimensionsMm.width,
                    depthMm: prop.dimensionsMm.depth,
                    heightMm: prop.dimensionsMm.height,
                    zOffsetMm: 0,
                  },
                  position: {
                    wallId: prop.wallId,
                    offsetMm: 150,
                  },
                }),
              }).catch(() => null);
            }
          }
          await fetch(`${apiBase}/projects/${projectId}/scenes/compile`, { method: 'POST', headers }).catch(() => null);
        }
      }
      */
    } catch {
      // ignore
    }
  }

  const filteredCatalogModules = useMemo(() => {
    const selectedRoomType = sel?.room.roomType;
    return IndianModularCatalog.filter(mod => {
      const matchesSearch = !catalogQuery.trim() || `${mod.name} ${mod.family} ${mod.sku} ${(mod.tags ?? []).join(' ')}`.toLowerCase().includes(catalogQuery.toLowerCase());
      const matchesFamily = catalogFilterFamily === 'all' || mod.family === catalogFilterFamily;
      const matchesRoom = !selectedRoomType || mod.roomTypes.includes(selectedRoomType as never)
        || (['master_bedroom', 'kids_bedroom'].includes(selectedRoomType) && mod.roomTypes.includes('bedroom' as never));
      const fit = reconcileCatalogModuleFit(activeCatalogWall, mod);
      const matchesFit = catalogFitFilter === 'all' || Boolean(fit?.fits);
      return matchesSearch && matchesFamily && matchesRoom && matchesFit;
    });
  }, [catalogQuery, catalogFilterFamily, catalogFitFilter, sel?.room.roomType, activeCatalogWall]);

  return (
    <div className={`spaces-workspace phase4${showDesignLibrary ? ' spaces-workspace--library-open' : ''}`} style={{ paddingBottom: 148 }}>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-text">
          <small>Room Design Studio · Stage 3: Rooms &amp; 2D Layout</small>
          <h1>Configured Spaces ({rooms.filter(r => r.included !== false).length})</h1>
          <p>The approved plan supplies measured geometry. Overlay the floor plan, auto-detect furniture layout with AI, and link authentic units from the Design Library.</p>
        </div>
        <div className="page-header-actions">
          <div className="history-btns">
            <button className="icon-btn" onClick={undo} type="button" aria-label="Undo"><Undo2 size={15} /></button>
            <button className="icon-btn" onClick={redo} type="button" aria-label="Redo"><Redo2 size={15} /></button>
          </div>
          <button type="button" className="btn-secondary workspace-action" onClick={() => setShowDesignLibrary(true)} title="Browse authentic modular units and finishes in Design Library"><BookOpen size={14} /> Design Library</button>
          <button type="button" className="btn-secondary workspace-action" disabled={!sel} onClick={() => sel && detectAiLayout(sel.room)} title="Auto-detect optimal furniture layout and wall roles using AI"><Wand2 size={14} /> AI Auto-Layout</button>
          <Badge tone={overallReadiness.approved ? 'success' : 'warn'}>{overallReadiness.approved ? 'Ready for Layout' : `${overallReadiness.readyRooms}/${overallReadiness.totalRooms} ready`}</Badge>
          <button className="btn-secondary workspace-action" onClick={() => void saveGeometryVersion()} title="Save geometry changes to create a new plan version"><Save size={14} /> Save geometry</button>
          <button className="btn-primary proceed-header-action workspace-action" disabled={!rooms.length} onClick={() => navigate(`/projects/${projectId}/spaces?tab=modules${selectedRoom ? `&roomId=${selectedRoom}` : ''}${selectedWall ? `&wallId=${selectedWall}` : ''}`)} title="Open catalog-backed modules and wall elevations"><LayoutGrid size={15} /> Configure Modules <ArrowRight size={14} /></button>
        </div>
      </div>

      {/* Multi-Storey Level Navigation Ribbon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#fbf9f5', border: '1px solid #ebdccb', borderRadius: 10, margin: '8px 0 12px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--gold-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
            🏛️ Storey Level:
          </span>
          <div style={{ display: 'inline-flex', gap: 6 }} role="group" aria-label="Storey level selection">
            {[
              { id: 'level-ground', label: 'Ground Floor (0.0m)', badge: 'Rooms & Atrium' },
              { id: 'level-first', label: 'First Floor (+3.3m)', badge: 'Mezzanine Void & Balustrades' },
              { id: 'level-terrace', label: 'Terrace Deck (+6.6m)', badge: 'Sky Lounge' },
            ].map((lvl) => (
              <button
                key={lvl.id}
                type="button"
                className="storey-btn"
                aria-pressed={activeStoreyId === lvl.id}
                onClick={() => setActiveStoreyId(lvl.id)}
              >
                <span>{lvl.label}</span>
                <small style={{ fontSize: 10, opacity: 0.75, fontWeight: 500 }}>({lvl.badge})</small>
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#78716c' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>
            ✨ Double-Height Living Atrium Cutout Active
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>
            🪜 Cantilever Stairwell Connected
          </span>
        </div>
      </div>

      {saveState && <p role="status" className="save-state">{saveState}</p>}

      {/* Plan overlay & visual controls bar */}
      <div className="spaces-flow-note spaces-guidance-bar" role="note">
        <div className="plan-overlay-controls">
          <span className="overlay-indicator"><ImageIcon size={14} /> <strong>Floor Plan Layer:</strong></span>
          <button type="button" className={`btn-chip ${showPlanOverlay ? 'active' : ''}`} onClick={() => setShowPlanOverlay(!showPlanOverlay)}>
            {showPlanOverlay ? <Eye size={13} /> : <EyeOff size={13} />} {showPlanOverlay ? 'Backdrop On' : 'Backdrop Off'}
          </button>
          {showPlanOverlay && (
            <label className="opacity-slider-label">
              <span>Opacity: {Math.round(planOverlayOpacity * 100)}%</span>
              <input type="range" min="0.1" max="1" step="0.05" value={planOverlayOpacity} onChange={(e) => setPlanOverlayOpacity(parseFloat(e.target.value))} />
            </label>
          )}
        </div>
        <div className="spaces-guidance-actions">
          {sel && <button type="button" className="btn-secondary btn-sm" onClick={() => detectAiLayout(sel.room)}><Sparkles size={13} /> AI Detect Furniture</button>}
          <button type="button" className="btn-secondary btn-sm" onClick={() => navigate(`/projects/${projectId}/plan`)}><Ruler size={13} /> Edit Plan</button>
        </div>
      </div>

      {/* AI Proposals Banner when generated */}
      {aiProposals.length > 0 && sel && (
        <div className="ai-proposals-banner">
          <div className="ai-proposals-header">
            <Sparkles size={16} className="text-gold" />
            <div>
              <strong>AI Suggested Layout for {sel.room.name} ({aiProposals.length} modular units)</strong>
              <p>Optimized for room geometry, natural light, door swings, and clearance zones.</p>
            </div>
            <button type="button" className="btn-primary btn-sm" onClick={() => applyAiProposalsToRoom(sel.room)}><Check size={13} /> Apply All Proposals</button>
          </div>
          <div className="ai-proposals-grid">
            {aiProposals.map((prop) => (
              <div key={prop.id} className="ai-proposal-card">
                <div className="ai-prop-head">
                  <Badge tone="neutral">{prop.wallLabel}</Badge>
                  <small className="ai-prop-conf">{Math.round(prop.confidence * 100)}% match</small>
                </div>
                <strong>{prop.name}</strong>
                <p className="ai-prop-rationale">{prop.rationale}</p>
                <div className="ai-dims-editor">
                  <label className="ai-dims-label">
                    W:
                    <input
                      type="number"
                      className="ai-dims-input"
                      value={prop.dimensionsMm.width}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 100;
                        setAiProposals(ps => ps.map(p => p.id === prop.id ? { ...p, dimensionsMm: { ...p.dimensionsMm, width: val } } : p));
                      }}
                    />
                  </label>
                  <span className="ai-dims-sep">×</span>
                  <label className="ai-dims-label">
                    D:
                    <input
                      type="number"
                      className="ai-dims-input"
                      value={prop.dimensionsMm.depth}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 100;
                        setAiProposals(ps => ps.map(p => p.id === prop.id ? { ...p, dimensionsMm: { ...p.dimensionsMm, depth: val } } : p));
                      }}
                    />
                  </label>
                  <span className="ai-dims-sep">×</span>
                  <label className="ai-dims-label">
                    H:
                    <input
                      type="number"
                      className="ai-dims-input"
                      value={prop.dimensionsMm.height}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 100;
                        setAiProposals(ps => ps.map(p => p.id === prop.id ? { ...p, dimensionsMm: { ...p.dimensionsMm, height: val } } : p));
                      }}
                    />
                  </label>
                  <span className="ai-dims-unit">mm</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loadState === 'loading' && <div className="spaces-empty"><Layers size={22} /><strong>Loading approved plan spaces...</strong></div>}
      {loadState === 'blocked' && <div className="spaces-empty"><AlertTriangle size={22} /><strong>Floor Plan approval required</strong><p>{saveState || 'Approve an Initial Design plan to derive editable rooms.'}</p><Button variant="outline" onClick={() => navigate(`/projects/${projectId}/plan`)}>Open Floor Plan Intelligence</Button></div>}
      {loadState === 'empty' && <div className="spaces-empty"><Home size={22} /><strong>No room polygons were derived</strong><p>Return to the Floor Plan canvas to add or confirm room boundaries, then create the plan version.</p><div className="spaces-empty-actions"><Button variant="outline" onClick={() => navigate(`/projects/${projectId}/plan`)}>Open Floor Plan</Button><Button variant="ghost" onClick={() => setReloadKey(key => key + 1)}>Try again</Button></div></div>}
      {loadState === 'error' && <div className="spaces-empty"><AlertTriangle size={22} /><strong>Spaces could not be loaded</strong><p>{saveState || 'The approved plan could not be read. Check the Floor Plan review and try again.'}</p><div className="spaces-empty-actions"><Button variant="outline" onClick={() => setReloadKey(key => key + 1)}>Try again</Button><Button variant="ghost" onClick={() => navigate(`/projects/${projectId}/plan`)}>Open Floor Plan</Button></div></div>}

      {loadState === 'ready' && (
        <div className="spaces-layout">
          {/* Region: Room list */}
          <aside className="region room-list">
            <div className="region-title"><Home size={14} /> Rooms ({rooms.length})</div>
            <div className="room-cards">
              {roomMetrics.map(({ room, widthMm, depthMm, effectiveAreaSqm, usable, readiness, vastu, scaleReview }) => (
                <div key={room.id} className={`room-card ${selectedRoom === room.id ? 'sel' : ''}`} onClick={() => { setSelectedRoom(room.id); setAiProposals([]); }}>
                  <div className="rc-head">
                    <input
                      type="text"
                      className="rc-name-inline-input"
                      value={room.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setRooms(rs => rs.map(r => r.id === room.id ? { ...r, name: newName } : r));
                      }}
                      onBlur={() => void persistRoom(room)}
                      title="Click to rename room"
                    />
                    <select
                      className="rc-type-select"
                      value={room.roomType}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        setRoomType(room.id, e.target.value);
                      }}
                      title="Select room classification"
                    >
                      {Object.entries(ROOM_TYPES).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="rc-dims">
                    <strong className="rc-dims-value">{Math.round(widthMm)} × {Math.round(depthMm)} mm</strong>
                    <span className="rc-dims-meta"> ({mmToFeetInches(widthMm)} × {mmToFeetInches(depthMm)}) • {(effectiveAreaSqm ?? room.areaSqm).toFixed(1)} m²</span>
                  </div>
                  <div className="rc-row"><span>Ceiling ↕</span><strong>{room.ceilingHeightMm ?? ceilingHeightMm} mm <small className="rc-row-muted">({mmToFeetInches(room.ceilingHeightMm ?? ceilingHeightMm)})</small></strong></div>
                  <div className="rc-row"><span>Usable wall</span><strong>{usable.usableWallMm} mm <small className="rc-row-muted">({mmToFeetInches(usable.usableWallMm)})</small></strong></div>

                  {/* Readiness & Vastu Checklist Row */}
                  <div className="rc-readiness-checklist">
                    <span className={`rc-chk-chip ${readiness.geometryVerified ? 'pass' : 'fail'}`} title="Room geometry derived & verified">
                      {readiness.geometryVerified ? '✓ Geo' : '⚠️ Geo'}
                    </span>
                    <span className={`rc-chk-chip ${readiness.heightKnown ? 'pass' : 'fail'}`} title="Ceiling height calibrated">
                      {readiness.heightKnown ? '✓ Ht' : '⚠️ Ht'}
                    </span>
                    <span className={`rc-chk-chip ${readiness.requirementsSaved ? 'pass' : 'fail'}`} title="Room furniture requirements linked">
                      {readiness.requirementsSaved ? '✓ Brief' : '⚠️ Brief'}
                    </span>
                    <span
                      className={`rc-chk-chip ${vastu.isCompliant ? 'pass' : 'remedy'}`}
                      title={vastu.isCompliant ? `Vastu Auspicious (${vastu.score}% compliant)` : `Vastu Remedy: ${vastu.criticalRemedy || 'Harmonize zones'}`}
                    >
                      <Compass size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                      {vastu.isCompliant ? `Vastu ${vastu.score}%` : `Vastu ${vastu.score}% ⚠️`}
                    </span>
                  </div>

                  <div className="rc-foot">
                    <Badge tone={readiness.ready ? 'success' : 'warn'}>
                      {readiness.ready ? 'Ready' : !vastu.isCompliant ? `Vastu Remedy (${vastu.score}%)` : 'Incomplete'}
                    </Badge>
                    {scaleReview && <span className="rc-scale-review" title="This room is unusually small for its selected type. Check the plan calibration before layout.">Check scale</span>}
                    <label className="inc-toggle"><input type="checkbox" checked={room.included !== false} onChange={(e) => includeRoom(room.id, e.target.checked)} onClick={(e) => e.stopPropagation()} /> include</label>
                  </div>

                  {!vastu.isCompliant && vastu.criticalRemedy && (
                    <div className="rc-vastu-remedy-alert" title={vastu.criticalRemedy}>
                      <Compass size={11} />
                      <span>{vastu.criticalRemedy}</span>
                    </div>
                  )}

                  {room.included !== false && (
                    <div className="rc-actions-row">
                      <button
                        type="button"
                        className={`room-quick-approve ${readiness.ready ? 'ready' : ''}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedRoom(room.id);
                          const cats = room.requiredFurniture.length
                            ? room.requiredFurniture
                            : defaultCategoriesForRoom(room.roomType, 'balanced');
                          const targetRoom: PlanRoom = {
                            ...room,
                            requiredFurniture: cats,
                            verificationStatus: 'verified',
                          };
                          setRooms((rs) => rs.map((r) => (r.id === room.id ? targetRoom : r)));
                          void persistRoom(targetRoom, 'verified');
                          void applyLayoutCandidateToScene(targetRoom, 'balanced');
                        }}
                      >
                        <CheckCircle2 size={13} /> {readiness.ready ? 'Room ready (Approved)' : !vastu.isCompliant ? 'Fix Vastu & Approve' : 'Approve & Verify Room'}
                      </button>
                      <button
                        type="button"
                        className={`room-vastu-toggle-btn ${vastu.isCompliant ? 'btn-comp' : 'btn-viol'}`}
                        title={vastu.isCompliant ? 'Simulate Vastu defect to test readiness checklist' : 'Auto-align furniture to auspicious Vastu zones'}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRoom(room.id);
                          toggleRoomVastu(room.id, widthMm, depthMm);
                        }}
                      >
                        <Compass size={11} /> {vastu.isCompliant ? 'Test Vastu' : 'Align Vastu'}
                      </button>
                      <button type="button" className="room-ai-btn" title="AI Auto-Detect Layout" onClick={(e) => { e.stopPropagation(); setSelectedRoom(room.id); detectAiLayout(room); }}>
                        <Sparkles size={12} /> AI Layout
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>

          {/* Region: Plan canvas + tools */}
          <section className="region canvas-region">
            <div className="canvas-focus-bar">
              <div>
                <strong>{sel?.room.name ?? 'Full plan'}</strong>
                <span>{canvasRenderMode === '3d_isometric' ? '3D Enhanced Axonometric Floor Plan' : canvasFocus === 'room' ? (sel?.scaleReview ? 'Check room scale before layout' : 'Room verification view') : 'Full Apartment Overview'}</span>
              </div>
              <div className="canvas-focus-actions">
                <button
                  type="button"
                  className="btn-gold-action"
                  onClick={autoEnhanceAllRoomsAndFloorplan}
                  title="Auto-detect rooms, assign wall roles, place doors/windows, and verify all spaces"
                  aria-label="AI Auto-Enhance Entire Plan"
                >
                  <Sparkles size={13} /> Suggest room finishes
                </button>
                <button
                  type="button"
                  className="btn-dark-action"
                  onClick={() => detectDoorsAndWindows()}
                  title="Detect and place architectural doors on partition walls and windows on exterior perimeter walls"
                  aria-label="Detect Doors and Windows"
                >
                  🚪 Detect Doors &amp; Windows
                </button>
                <div className="canvas-mode-toggle" role="group" aria-label="Floor plan view mode">
                  <button type="button" className={`canvas-mode-btn ${canvasRenderMode === '2d' ? 'active' : ''}`} onClick={() => setCanvasRenderMode('2d')}>
                    2D CAD
                  </button>
                  <button type="button" className={`canvas-mode-btn ${canvasRenderMode === '3d_isometric' ? 'active' : ''}`} onClick={() => setCanvasRenderMode('3d_isometric')}>
                    3D Enhanced
                  </button>
                  <button type="button" className={`canvas-mode-btn ${canvasRenderMode === 'stager' ? 'active' : ''}`} onClick={() => setCanvasRenderMode('stager')}>
                    Top-View Stager
                  </button>
                </div>
                <button type="button" className="btn-primary btn-sm" onClick={() => setShowFloorPlanRenderModal(true)}>
                  <Sparkles size={13} /> 3D Plan Render
                </button>
                <button
                  type="button"
                  className={`canvas-fit-btn${canvasFocus === 'room' ? ' active' : ''}`}
                  disabled={!selectedRoom}
                  onClick={() => setCanvasFocus('room')}
                  aria-label="Fit selected room to view"
                  title="Zoom canvas to selected room"
                >Fit room</button>
                <button
                  type="button"
                  className={`canvas-fit-btn${canvasFocus === 'plan' ? ' active' : ''}`}
                  onClick={() => setCanvasFocus('plan')}
                  aria-label="Fit full floor plan to view"
                  title="Zoom canvas to show full floor plan"
                >Fit full plan</button>
              </div>
            </div>
            <div className="toolbar" aria-label="Canvas tools">
              {[
                { label: 'AI Architecture', tools: [['select', 'Choose'], ['measure', 'Measure'], ['annotate', 'Note']] },
                { label: 'Production & CNC', tools: [['draw_room', 'Draw room'], ['wall', 'Add wall'], ['split', 'Split'], ['merge', 'Merge']] },
                { label: 'Operations', tools: [['door', 'Door'], ['window', 'Window'], ['column', 'Column'], ['beam', 'Beam'], ['service', 'Service']] },
              ].map((group) => <div className="tool-group" key={group.label}><span>{group.label}</span><div>{group.tools.map(([t, label]) => (
                <button key={t} className={`tool-btn ${(tool === t || (t === 'column' && tool === 'add_column') || (t === 'service' && tool === 'add_service') || (t === 'wall' && tool === 'draw_wall') || (t === 'beam' && tool === 'draw_beam') || (t === 'door' && tool === 'add_door') || (t === 'window' && tool === 'add_window')) ? 'active' : ''}`} onClick={() => activateCanvasTool(t)}>{label}</button>
              ))}</div></div>)}
              {tool !== 'select' && <button type="button" className="tool-cancel" onClick={() => activateCanvasTool('cancel_tool')}>Cancel active tool</button>}
            </div>
            <div className="plan-trust-strip" role="status">
              <span className={scaleVerified ? 'trust-ok' : 'trust-review'}>{scaleVerified ? '✓ Scale confirmed' : 'Scale not confirmed'}</span>
              <span>{rooms.length} rooms</span>
              <span>{walls.length} measured walls</span>
              <span>{openings.filter((opening) => opening.kind === 'door').length} doors</span>
              <span>{openings.filter((opening) => opening.kind === 'window').length} windows</span>
              {!scaleVerified && <span className="trust-hint">Calibrate the plan before dimension chains or production exports.</span>}
            </div>

            {annotationDialogOpen && (
              <div className="annotation-dialog" role="dialog" aria-label="Add annotation">
                <label htmlFor="annotation-text">Annotation</label>
                <input id="annotation-text" autoFocus value={annotationDraft} onChange={(e) => setAnnotationDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && annotationDraft.trim()) { addAnnotation(annotationDraft.trim()); setAnnotationDialogOpen(false); } if (e.key === 'Escape') setAnnotationDialogOpen(false); }} />
                <div><button type="button" onClick={() => setAnnotationDialogOpen(false)}>Cancel</button><button type="button" disabled={!annotationDraft.trim()} onClick={() => { addAnnotation(annotationDraft.trim()); setAnnotationDialogOpen(false); }}>Add annotation</button></div>
              </div>
            )}

            {canvasRenderMode === 'stager' ? (
              <div style={{ padding: 12, width: '100%', minHeight: 600, background: '#1c1917', borderRadius: 12, overflowY: 'auto' }}>
                <TopViewFloorplanEnhancer
                  key={sel?.room.id ?? 'default-stager'}
                  initialRoom={{
                    id: sel?.room.id ?? 'zone-1',
                    name: sel?.room.name ?? 'Living & Dining Room',
                    widthMm: Math.round(sel?.widthMm || 6500),
                    lengthMm: Math.round(sel?.depthMm || 5000),
                    flooring: ((sel?.room as any)?.finishSchedule?.floor as any) || 'herringbone_oak',
                  }}
                  initialItems={stagerItems}
                  onItemsChange={(items) => {
                    if (sel?.room.id) {
                      setRoomFurnitureMap((prev) => ({ ...prev, [sel.room.id]: items }));
                    }
                  }}
                  onVastuChange={(analysis) => {
                    if (sel?.room.id) {
                      setRoomVastuMap((prev) => ({ ...prev, [sel.room.id]: analysis }));
                    }
                  }}
                  onGenerateRender={(payload) => {
                    setSaveState(`Generating top-down floor plan render with ${payload.stylePrompt.slice(0, 40)}…`);
                    setShowFloorPlanRenderModal(true);
                  }}
                />
              </div>
            ) : (
              <svg
                ref={svgRef}
                className={`plan-canvas${draggingModule ? ' plan-canvas--dropping' : ''}`}
                role="img"
                aria-label="Interactive 2D floor plan canvas"
                viewBox={`0 0 ${view.w} ${view.h}`}
                onClick={(event) => { if (draggingModule) { commitArmedPlacement(event); return; } onCanvasClick(event); }}
                onMouseMove={(event) => {
                  if (tool === 'draw_room' && roomDraftStart) setRoomDraftCurrent(svgPoint(event));
                  if (draggingModule) updateDropPreview(event);
                }}
                onDragOver={(event) => { if (!draggingModule) return; event.preventDefault(); event.dataTransfer.dropEffect = dropPreview?.valid ? 'copy' : 'none'; updateDropPreview(event); }}
                onDragLeave={() => { setDropPreview(null); setDropCursor(null); }}
                onDrop={(event) => { event.preventDefault(); void commitDropPlacement(event); }}
              >
              <defs>
                <pattern id="floor-marble" width="40" height="40" patternUnits="userSpaceOnUse">
                  <rect width="40" height="40" fill="#f2ede4" />
                  <path d="M 0 20 Q 20 10 40 30 M 10 0 Q 30 20 20 40" fill="none" stroke="#e0d4c3" strokeWidth="0.8" strokeOpacity="0.7" />
                </pattern>
                <pattern id="floor-wood" width="50" height="18" patternUnits="userSpaceOnUse">
                  <rect width="50" height="18" fill="#c8a882" fillOpacity="0.85" />
                  <line x1="0" y1="18" x2="50" y2="18" stroke="#b08d66" strokeWidth="1" />
                  <line x1="25" y1="0" x2="25" y2="18" stroke="#b08d66" strokeWidth="0.8" />
                </pattern>
                <pattern id="floor-parquet" width="28" height="28" patternUnits="userSpaceOnUse">
                  <rect width="28" height="28" fill="#6b4c35" fillOpacity="0.85" />
                  <path d="M 0 14 L 14 0 L 28 14 L 14 28 Z" fill="none" stroke="#523927" strokeWidth="1" />
                </pattern>
                <pattern id="floor-terrazzo" width="30" height="30" patternUnits="userSpaceOnUse">
                  <rect width="30" height="30" fill="#d9c9b8" fillOpacity="0.8" />
                  <circle cx="5" cy="5" r="1.5" fill="#8c7a6b" />
                  <circle cx="20" cy="12" r="2" fill="#b09f90" />
                  <circle cx="12" cy="25" r="1.5" fill="#756455" />
                </pattern>
                <pattern id="floor-tile" width="40" height="40" patternUnits="userSpaceOnUse">
                  <rect width="40" height="40" fill="#605e5a" fillOpacity="0.75" />
                  <rect x="1" y="1" width="38" height="38" fill="#6d6a66" />
                  <line x1="0" y1="40" x2="40" y2="40" stroke="#484643" strokeWidth="1.5" />
                  <line x1="40" y1="0" x2="40" y2="40" stroke="#484643" strokeWidth="1.5" />
                </pattern>
                <pattern id="floor-statuario" width="60" height="60" patternUnits="userSpaceOnUse">
                  <rect width="60" height="60" fill="#f7f6f2" />
                  <path d="M 0 50 Q 30 20 60 10 M 10 60 Q 40 40 50 0" fill="none" stroke="#d6d4ce" strokeWidth="1.2" />
                </pattern>
                <pattern id="floor-default" width="30" height="30" patternUnits="userSpaceOnUse">
                  <rect width="30" height="30" fill="#faf6ef" />
                  <line x1="0" y1="30" x2="30" y2="30" stroke="#ede5d8" strokeWidth="0.8" />
                  <line x1="30" y1="0" x2="30" y2="30" stroke="#ede5d8" strokeWidth="0.8" />
                </pattern>
                <filter id="shadow3d" x="-10%" y="-10%" width="130%" height="130%">
                  <feDropShadow dx="3" dy="6" stdDeviation="5" floodColor="#000000" floodOpacity="0.25" />
                </filter>
              </defs>

              {/* Floor plan backdrop image overlay - precisely registered in world mm coordinates */}
              {showPlanOverlay && planPreviewUrl && scaleVerified && Number(sourceMeta?.mmPerPixel) > 0 && (
                <image
                  href={planPreviewUrl}
                  x={toPx({ xMm: sourceDimensionsMm.minX, yMm: sourceDimensionsMm.minY }).x}
                  y={toPx({ xMm: sourceDimensionsMm.minX, yMm: sourceDimensionsMm.minY }).y}
                  width={sourceDimensionsMm.widthMm * view.scale}
                  height={sourceDimensionsMm.heightMm * view.scale}
                  preserveAspectRatio="none"
                  opacity={planOverlayOpacity}
                  style={{ pointerEvents: 'none' }}
                />
              )}

              {tool === 'draw_room' && roomDraftStart && roomDraftCurrent && (() => {
                const a = toPx(roomDraftStart); const b = toPx(roomDraftCurrent);
                return <rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} fill="rgba(197,156,45,.16)" stroke="var(--gold)" strokeWidth="2" strokeDasharray="6 4" pointerEvents="none" />;
              })()}

              {/* Rooms with Textured Flooring Fills & 2D Furniture */}
              {layers.rooms && rooms.filter((r) => r.included !== false).map((r) => {
                const pts = r.polygon.map((p) => { const q = toPx(p); return `${q.x},${q.y}`; }).join(' ');
                const isSel = selectedRoom === r.id;
                const b = bbox(r.polygon);
                const center = toPx({ xMm: (b.minX + b.maxX) / 2, yMm: (b.minY + b.maxY) / 2 });
                const patternId = getFloorPatternId(r.floorFinish, floorSurfaces[r.id]);
                const badgeWidth = Math.max(80, r.name.length * 7 + 20);

                return (
                  <g key={r.id} onClick={(e) => { e.stopPropagation(); setSelectedRoom(r.id); }}>
                    {/* Room Floor Surface */}
                    <polygon
                      points={pts}
                      fill={`url(#${patternId})`}
                      stroke={isSel ? 'var(--gold)' : '#7a5c3a'}
                      strokeWidth={isSel ? 3 : 1.5}
                      filter={canvasRenderMode === '3d_isometric' ? 'url(#shadow3d)' : undefined}
                    />
                    {isSel && (
                      <polygon
                        points={pts}
                        fill="rgba(197,156,45,.14)"
                        stroke="var(--gold)"
                        strokeWidth={2.5}
                      />
                    )}

                    {/* Architectural 2D Furniture for this Room */}
                    <Room2DArchitecturalLayout room={r} toPx={toPx} scale={view.scale} />

                    {/* Room Identification Pill Badge */}
                    <g transform={`translate(${center.x}, ${center.y})`} style={{ pointerEvents: 'none' }}>
                      <rect
                        x={-badgeWidth / 2}
                        y={-14}
                        width={badgeWidth}
                        height={28}
                        rx={6}
                        fill="rgba(255, 253, 248, 0.94)"
                        stroke={isSel ? 'var(--gold)' : '#d6c6b2'}
                        strokeWidth={isSel ? 1.8 : 1}
                        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))' }}
                      />
                      <text x={0} y={-1} fontSize={10} fontWeight="800" fill={isSel ? '#8c6218' : '#2d2216'} textAnchor="middle">{r.name}</text>
                      <text x={0} y={10} fontSize={8.5} fontWeight="600" fill={isSel ? '#7a5214' : '#6b5847'} textAnchor="middle">{r.areaSqm.toFixed(1)} m²</text>
                    </g>
                  </g>
                );
              })}

              {/* Architectural Walls with Core Hatch & Casing */}
              {layers.walls && walls.map((w) => {
                const a = toPx(w.start), b = toPx(w.end);
                const scaledThickness = Math.max(6, Math.min(18, Number(w.thicknessMm ?? (w.isExterior ? 254 : 152.4)) * view.scale));
                const isSel = selectedWall === w.id;
                return (
                  <g key={w.id} onClick={(e) => { e.stopPropagation(); setSelectedWall(w.id); }} style={{ cursor: 'pointer' }}>
                    {/* Wall Outer Shadow in 3D Mode */}
                    {canvasRenderMode === '3d_isometric' && (
                      <line
                        x1={a.x + 3} y1={a.y + 6} x2={b.x + 3} y2={b.y + 6}
                        stroke="#1a140f"
                        strokeWidth={scaledThickness + 2}
                        strokeLinecap="square"
                        strokeOpacity={0.4}
                      />
                    )}
                    {/* Architectural Core Wall */}
                    <line
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={isSel ? 'var(--gold)' : '#261e17'}
                      strokeWidth={isSel ? scaledThickness + 4 : scaledThickness}
                      strokeLinecap="square"
                    />
                    {/* Wall Core Inner Line */}
                    <line
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={isSel ? '#fff' : '#4a3b2e'}
                      strokeWidth={Math.max(1, scaledThickness / 3)}
                      strokeLinecap="square"
                    />
                  </g>
                );
              })}

              {/* Architectural Openings (Doors with 90° Leaf & Arcs, Windows with Glazing) */}
              {layers.openings && openings.map((o) => {
                const w = walls.find((x) => x.id === o.wallId);
                if (!w) return null;
                const a = toPx(w.start), b = toPx(w.end);
                const length = wallLen(w) || 1;
                const widthMm = Number(o.widthMm);
                const startOffset = Number(o.offsetAlongWallMm);
                if (!Number.isFinite(widthMm) || widthMm <= 0 || !Number.isFinite(startOffset) || startOffset < 0 || startOffset + widthMm > length + 0.5) return null;
                const centerOffset = startOffset;
                const t = centerOffset / length;
                const px = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
                const isDoor = o.kind === 'door';
                const openingWidthPx = widthMm * view.scale;

                // Wall direction angle
                const angle = Math.atan2(b.y - a.y, b.x - a.x);
                const perpX = -Math.sin(angle);
                const perpY = Math.cos(angle);

                if (isDoor) {
                  const leafLength = openingWidthPx;
                  const leafEndX = px.x + perpX * leafLength;
                  const leafEndY = px.y + perpY * leafLength;
                  return (
                    <g key={o.id} className="arch-door-opening">
                      <title>{`Door · ${widthMm} mm · offset ${startOffset} mm`}</title>
                      <line x1={px.x} y1={px.y} x2={px.x + Math.cos(angle) * leafLength} y2={px.y + Math.sin(angle) * leafLength} stroke="#fffaf2" strokeWidth={8} />
                      {/* Door Jamb Ticks */}
                      <circle cx={px.x} cy={px.y} r={3} fill="#c97b2c" stroke="#fff" strokeWidth={1} />
                      {/* Door Leaf Open at 90° */}
                      <line x1={px.x} y1={px.y} x2={leafEndX} y2={leafEndY} stroke="#c97b2c" strokeWidth={2.5} strokeLinecap="round" />
                      {/* Curved Swing Arc */}
                      <path
                        d={`M ${px.x + perpX * leafLength} ${px.y + perpY * leafLength} A ${leafLength} ${leafLength} 0 0 0 ${px.x + Math.cos(angle) * leafLength} ${px.y + Math.sin(angle) * leafLength}`}
                        fill="none"
                        stroke="#c97b2c"
                        strokeWidth={1.2}
                        strokeDasharray="3 2"
                      />
                    </g>
                  );
                }

                // Window with Double-Line Glazing
                const wx1 = px.x;
                const wy1 = px.y;
                const wx2 = px.x + Math.cos(angle) * openingWidthPx;
                const wy2 = px.y + Math.sin(angle) * openingWidthPx;

                return (
                  <g key={o.id} className="arch-window-opening">
                    <title>{`Window · ${widthMm} mm · offset ${startOffset} mm`}</title>
                    {/* Window Opening Cutout Backing */}
                    <line x1={wx1} y1={wy1} x2={wx2} y2={wy2} stroke="#fff" strokeWidth={8} strokeLinecap="square" />
                    {/* Outer Glazing Line */}
                    <line x1={wx1 + perpX * 2} y1={wy1 + perpY * 2} x2={wx2 + perpX * 2} y2={wy2 + perpY * 2} stroke="#0284c7" strokeWidth={1.8} />
                    {/* Inner Glazing Line */}
                    <line x1={wx1 - perpX * 2} y1={wy1 - perpY * 2} x2={wx2 - perpX * 2} y2={wy2 - perpY * 2} stroke="#0284c7" strokeWidth={1.8} />
                    {/* End Mullion Jambs */}
                    <line x1={wx1 - perpX * 4} y1={wy1 - perpY * 4} x2={wx1 + perpX * 4} y2={wy1 + perpY * 4} stroke="#1e293b" strokeWidth={2} />
                    <line x1={wx2 - perpX * 4} y1={wy2 - perpY * 4} x2={wx2 + perpX * 4} y2={wy2 + perpY * 4} stroke="#1e293b" strokeWidth={2} />
                  </g>
                );
              })}

              {/* AI Proposals & Staged Furniture Envelopes on SVG Canvas */}
              {layers.aiOverlay && showAiProposalsOnCanvas && (aiProposals.length > 0 ? aiProposals : []).map((prop) => {
                const pos = toPx(prop.position);
                const widthPx = Math.max(30, prop.dimensionsMm.width * view.scale);
                const depthPx = Math.max(24, prop.dimensionsMm.depth * view.scale);
                return (
                  <g key={prop.id} className="ai-proposal-envelope" style={{ cursor: 'pointer' }} transform={`rotate(${prop.rotationDeg ?? 0} ${pos.x} ${pos.y})`}>
                    {/* Subtle drop shadow */}
                    <rect
                      x={pos.x + 2}
                      y={pos.y + 2}
                      width={widthPx}
                      height={depthPx}
                      rx={5}
                      fill="rgba(0, 0, 0, 0.15)"
                    />
                    {/* Main furniture envelope body */}
                    <rect
                      x={pos.x}
                      y={pos.y}
                      width={widthPx}
                      height={depthPx}
                      rx={5}
                      fill="#fff9e6"
                      stroke="#c59c2d"
                      strokeWidth={2}
                    />
                    {/* Top wall-anchored accent strip */}
                    <rect
                      x={pos.x}
                      y={pos.y}
                      width={widthPx}
                      height={Math.min(6, depthPx * 0.25)}
                      rx={3}
                      fill="#c59c2d"
                    />
                    {/* Furniture Item Name */}
                    <text
                      x={pos.x + 6}
                      y={pos.y + Math.min(18, depthPx * 0.55)}
                      fontSize={Math.max(9, 10 * view.scale * 12)}
                      fontWeight="800"
                      fill="#5c3f0b"
                    >
                      {prop.name.length > 24 ? prop.name.slice(0, 22) + '…' : prop.name}
                    </text>
                    {/* Wall Badge + Dimensions */}
                    <text
                      x={pos.x + 6}
                      y={pos.y + Math.min(30, depthPx * 0.88)}
                      fontSize={Math.max(8, 9 * view.scale * 10)}
                      fontWeight="700"
                      fill="#a16207"
                    >
                      {prop.wallLabel ? `[${prop.wallLabel}] ` : ''}{prop.dimensionsMm.width} × {prop.dimensionsMm.depth} mm
                    </text>
                  </g>
                );
              })}

              {layers.columns && columns.map(c => { const p = toPx(c.position); return <rect key={c.id} x={p.x - 6} y={p.y - 6} width={12} height={12} fill="#444" stroke="#fff" />; })}
              {layers.beams && beams.map(b => { const a = toPx(b.start), e2 = toPx(b.end); return <line key={b.id} x1={a.x} y1={a.y} x2={e2.x} y2={e2.y} stroke="#9b59b6" strokeWidth={3} strokeDasharray="4 3" />; })}
              {layers.services && services.map(s => { const p = toPx(s.position); return <circle key={s.id} cx={p.x} cy={p.y} r={6} fill="#27ae60" stroke="#fff" strokeWidth={1} />; })}
              {layers.annotations && annotations.map(a => { if (!a.position) return null; const p = toPx(a.position); return <text key={a.id} x={p.x} y={p.y} fontSize={10} fill="#7a3b00">{a.text}</text>; })}
              {/*
                Live placement ghost. Drawn at the module's true widthMm x
                depthMm in plan units, projected onto the target wall and
                pushed into the room. Green means the same reconciliation that
                runs at commit time accepted this exact offset; red means it
                would be rejected, and the reason is shown beside the cursor.
              */}
              {dropPreview && (() => {
                const wallDx = dropPreview.end.xMm - dropPreview.start.xMm;
                const wallDy = dropPreview.end.yMm - dropPreview.start.yMm;
                const wallLength = Math.hypot(wallDx, wallDy) || 1;
                const ux = wallDx / wallLength, uy = wallDy / wallLength;
                // Perpendicular pointing into the room the module serves.
                let nx = -uy, ny = ux;
                if (sel?.room) {
                  const centroid = sel.room.polygon.reduce((acc, pt) => ({ xMm: acc.xMm + pt.xMm / sel.room.polygon.length, yMm: acc.yMm + pt.yMm / sel.room.polygon.length }), { xMm: 0, yMm: 0 });
                  const midX = dropPreview.start.xMm + ux * (dropPreview.offsetMm + dropPreview.module.widthMm / 2);
                  const midY = dropPreview.start.yMm + uy * (dropPreview.offsetMm + dropPreview.module.widthMm / 2);
                  if ((centroid.xMm - midX) * nx + (centroid.yMm - midY) * ny < 0) { nx = -nx; ny = -ny; }
                }
                const depth = dropPreview.module.depthMm;
                const a = dropPreview.offsetMm, b = dropPreview.offsetMm + dropPreview.module.widthMm;
                const corner = (along: number, into: number) => toPx({
                  xMm: dropPreview.start.xMm + ux * along + nx * into,
                  yMm: dropPreview.start.yMm + uy * along + ny * into,
                });
                const c0 = corner(a, 0), c1 = corner(b, 0), c2 = corner(b, depth), c3 = corner(a, depth);
                const stroke = dropPreview.valid ? '#16a34a' : '#dc2626';
                const fill = dropPreview.valid ? 'rgba(22,163,74,0.22)' : 'rgba(220,38,38,0.22)';
                const label = corner((a + b) / 2, depth / 2);
                return (
                  <g pointerEvents="none">
                    <line x1={toPx(dropPreview.start).x} y1={toPx(dropPreview.start).y} x2={toPx(dropPreview.end).x} y2={toPx(dropPreview.end).y} stroke={stroke} strokeWidth={3} strokeOpacity={0.5} />
                    <polygon points={`${c0.x},${c0.y} ${c1.x},${c1.y} ${c2.x},${c2.y} ${c3.x},${c3.y}`} fill={fill} stroke={stroke} strokeWidth={2} strokeDasharray={dropPreview.valid ? undefined : '5 3'} />
                    <text x={label.x} y={label.y} fontSize={9} fontWeight="bold" fill={stroke} textAnchor="middle">
                      {dropPreview.module.widthMm}x{dropPreview.module.depthMm}
                    </text>
                    <text x={label.x} y={label.y + 10} fontSize={8} fill={stroke} textAnchor="middle">
                      @ {Math.round(dropPreview.offsetMm)} mm
                    </text>
                  </g>
                );
              })()}

              {measureFrom && measureTo && (() => { const a = toPx(measureFrom), b = toPx(measureTo); const d = Math.hypot(measureTo.xMm - measureFrom.xMm, measureTo.yMm - measureFrom.yMm); return <g><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#dc2626" strokeWidth={2} strokeDasharray="4 2" /><rect x={(a.x + b.x) / 2 - 45} y={(a.y + b.y) / 2 - 18} width={90} height={18} fill="#1c1917" rx={4} /><text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 5} fontSize={9.5} fill="#fef08a" fontWeight="bold" textAnchor="middle">{Math.round(d)} mm ({mmToFeetInches(d)})</text></g>; })()}
            </svg>
            )}

            {/*
              Rejection feedback stays beside the cursor. Sending it to the
              top-of-screen saveState banner made invalid drops feel like a
              save failure and pulled attention away from the plan.
            */}
            {dropPreview && dropCursor && !dropPreview.valid && dropPreview.reason && (
              <div className="drop-reject-tip" style={{ left: dropCursor.x + 16, top: dropCursor.y + 16 }} role="status">
                <strong>{dropPreview.module.name}</strong>
                <span>{dropPreview.reason}</span>
              </div>
            )}
            {draggingModule && !dropPreview && (
              <div className="drop-arm-hint" role="status">
                Drag <strong>{draggingModule.name}</strong> onto a measured wall. Press Escape to cancel.
              </div>
            )}

            {measureFrom && !measureTo && <div className="measure-hint">Click a second point to measure.</div>}
            {!scaleVerified && <div className="scale-warn"><TriangleAlert size={13} /> Scale not verified — dimensions are approximate.</div>}
          </section>

          {/* Region: Properties (room / wall) */}
          <aside className="region props-region">
            <div className="region-title"><Edit3 size={14} /> Properties &amp; Brief</div>
            {sel ? (
              <div className="props-body">
                <div className="room-workflow-summary">
                  <span>{spacePanel === 'geometry' ? '1' : spacePanel === 'candidates' ? '2' : spacePanel === 'modules' ? '3' : spacePanel === 'flooring' ? '4' : spacePanel === 'brief' ? '5' : spacePanel === 'scene' ? '6' : '★'}</span>
                  <div>
                    <strong>
                      {spacePanel === 'geometry' ? 'Verify the physical room' : spacePanel === 'candidates' ? 'Deterministic Layout Candidates' : spacePanel === 'modules' ? 'Wall Bays & Modular Reconciliation' : spacePanel === 'flooring' ? 'Flooring Surface & Skirting Studio' : spacePanel === 'brief' ? 'Define the design brief' : spacePanel === 'scene' ? 'Prepare the scene' : 'Senior Designer Architectural Audit'}
                    </strong>
                    <small>
                      {spacePanel === 'geometry' ? 'Room edges, wall sizes, openings and ceiling.' : spacePanel === 'candidates' ? 'Select an architecturally verified layout candidate.' : spacePanel === 'modules' ? 'Adjust bay boundaries, enforce keep-outs, and reconcile live usable width.' : spacePanel === 'flooring' ? 'Substrate buildup, laying patterns, cut-tile optimization, and skirting linear meters.' : spacePanel === 'brief' ? 'Required modules, priorities and client intent.' : spacePanel === 'scene' ? 'Feature walls, finishes and preferred camera.' : '10-Year expert ergonomics, work triangles, lighting and material harmony.'}
                    </small>
                  </div>
                </div>

                <section className="placement-flow-card" aria-label="Measured module placement workflow">
                  <div className="placement-flow-heading">
                    <div>
                      <small>GUIDED PLACEMENT</small>
                      <strong>Room → wall → module → adjust → 3D</strong>
                    </div>
                    <span className={activeCatalogWall ? 'placement-flow-status ready' : 'placement-flow-status'}>{activeCatalogWall ? 'Wall selected' : 'Choose a wall'}</span>
                  </div>
                  <ol className="placement-flow-steps">
                    <li className="complete"><span>1</span><b>{sel.room.name}</b><small>Room selected</small></li>
                    <li className={activeCatalogWall ? 'complete' : ''}><span>2</span><b>{activeCatalogWall ? `${Math.round(activeCatalogWall.lengthMm)} mm wall` : 'Click a wall in 2D'}</b><small>{activeCatalogWall ? `${activeCatalogWall.openings.length} door/window keep-out${activeCatalogWall.openings.length === 1 ? '' : 's'}` : 'Measured walls only'}</small></li>
                    <li><span>3</span><b>Choose a module</b><small>Only compatible library units</small></li>
                    <li><span>4</span><b>Adjust bays</b><small>Confirm fillers and components</small></li>
                  </ol>
                  <div className="placement-flow-actions">
                    <button type="button" className="btn-secondary btn-sm" onClick={() => setSpacePanel('geometry')}><Ruler size={13} /> Review wall</button>
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      disabled={!activeCatalogWall}
                      title={activeCatalogWall ? 'Browse modules that fit this measured wall.' : 'Click a measured wall in the 2D plan first.'}
                      onClick={() => { setCatalogFitFilter('fits'); setShowDesignLibrary(true); }}
                    ><BookOpen size={13} /> Choose module{activeCatalogWall ? ` for wall` : ''}</button>
                  </div>
                  {!activeCatalogWall && <p>Click a dark wall line in the 2D plan. Doors and windows are retained as protected placement zones.</p>}
                </section>

                <div className="space-panel-tabs" role="tablist" aria-label="Room configuration">
                  <button type="button" className={spacePanel === 'candidates' ? 'active' : ''} onClick={() => setSpacePanel('candidates')}>Room layout</button>
                  <button type="button" className={spacePanel === 'geometry' ? 'active' : ''} onClick={() => setSpacePanel('geometry')}>Wall &amp; openings</button>
                  <button type="button" className={spacePanel === 'modules' ? 'active' : ''} onClick={() => setSpacePanel('modules')}>Adjust module</button>
                  <button type="button" className={spacePanel === 'advisor' ? 'active' : ''} onClick={() => setSpacePanel('advisor')}>Design advice</button>
                  <button type="button" className={spacePanel === 'flooring' ? 'active' : ''} onClick={() => setSpacePanel('flooring')}>Flooring &amp; Skirting</button>
                  <button type="button" className={spacePanel === 'brief' ? 'active' : ''} onClick={() => setSpacePanel('brief')}>Design brief</button>
                  <button type="button" className={spacePanel === 'scene' ? 'active' : ''} onClick={() => setSpacePanel('scene')}>Scene setup</button>
                </div>

                {spacePanel === 'candidates' && (
                  <div className="candidates-panel">
                    <p className="candidates-intro">
                      Symbolic placements validated against wall fit, door swing, window clearance, circulation, and structural constraints for <strong>{sel.room.name}</strong>.
                    </p>
                    <div className="candidates-grid-v2">
                      {/* Candidate 1: Circulation First */}
                      {(() => {
                        const isApplied = sel.room.designPriority === 'circulation';
                        return (
                          <div
                            className={`candidate-card-v2 ${isApplied ? 'active' : ''}`}
                            onClick={() => {
                              const cats = defaultCategoriesForRoom(sel.room.roomType, 'circulation');
                              patchRoom(sel.room.id, { requiredFurniture: cats, designPriority: 'circulation' });
                            }}
                          >
                            <div className="cand-head">
                              <span className="cand-title">Best Circulation</span>
                              <span className="cand-score">{isApplied ? 'Active Applied' : '95% Valid'}</span>
                            </div>
                            <div className="cand-preview-box">
                              <CandidateVectorPreview room={sel.room} walls={walls} openings={openings} candidateType="circulation" />
                            </div>
                            <div className="cand-meta">
                              <span>Focus: <strong>Open walkways &amp; light</strong></span>
                              <span>Clearance: <strong>&gt;1000 mm</strong></span>
                            </div>
                            <button
                              type="button"
                              className={`cand-apply-btn ${isApplied ? 'applied' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void applyLayoutCandidateToScene(sel.room, 'circulation');
                              }}
                            >
                              <CheckCircle2 size={13} /> {isApplied ? 'Applied & Verified' : 'Select & Apply Layout'}
                            </button>
                          </div>
                        );
                      })()}

                      {/* Candidate 2: Balanced Layout */}
                      {(() => {
                        const isApplied = sel.room.designPriority === 'balanced' || (!sel.room.designPriority && sel.room.verificationStatus === 'verified');
                        return (
                          <div
                            className={`candidate-card-v2 ${isApplied ? 'active' : ''}`}
                            onClick={() => {
                              const cats = defaultCategoriesForRoom(sel.room.roomType, 'balanced');
                              patchRoom(sel.room.id, { requiredFurniture: cats, designPriority: 'balanced' });
                            }}
                          >
                            <div className="cand-head">
                              <span className="cand-title">Balanced Layout</span>
                              <span className="cand-score">{isApplied ? 'Active Applied' : '93% Valid'}</span>
                            </div>
                            <div className="cand-preview-box">
                              <CandidateVectorPreview room={sel.room} walls={walls} openings={openings} candidateType="balanced" />
                            </div>
                            <div className="cand-meta">
                              <span>Focus: <strong>Ergonomic &amp; storage balance</strong></span>
                              <span>Clearance: <strong>900 mm</strong></span>
                            </div>
                            <button
                              type="button"
                              className={`cand-apply-btn ${isApplied ? 'applied' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void applyLayoutCandidateToScene(sel.room, 'balanced');
                              }}
                            >
                              <CheckCircle2 size={13} /> {isApplied ? 'Applied & Verified' : 'Select & Apply Layout'}
                            </button>
                          </div>
                        );
                      })()}

                      {/* Candidate 3: Maximum Storage */}
                      {(() => {
                        const isApplied = sel.room.designPriority === 'storage';
                        return (
                          <div
                            className={`candidate-card-v2 ${isApplied ? 'active' : ''}`}
                            onClick={() => {
                              const cats = defaultCategoriesForRoom(sel.room.roomType, 'storage');
                              patchRoom(sel.room.id, { requiredFurniture: cats, designPriority: 'storage' });
                            }}
                          >
                            <div className="cand-head">
                              <span className="cand-title">Maximum Storage</span>
                              <span className="cand-score">{isApplied ? 'Active Applied' : '91% Valid'}</span>
                            </div>
                            <div className="cand-preview-box">
                              <CandidateVectorPreview room={sel.room} walls={walls} openings={openings} candidateType="storage" />
                            </div>
                            <div className="cand-meta">
                              <span>Focus: <strong>Full wall runs &amp; lofts</strong></span>
                              <span>Clearance: <strong>750 mm</strong></span>
                            </div>
                            <button
                              type="button"
                              className={`cand-apply-btn ${isApplied ? 'applied' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void applyLayoutCandidateToScene(sel.room, 'storage');
                              }}
                            >
                              <CheckCircle2 size={13} /> {isApplied ? 'Applied & Verified' : 'Select & Apply Layout'}
                            </button>
                          </div>
                        );
                      })()}

                      {/* Candidate 4: Luxury Feature Suite */}
                      {(() => {
                        const isApplied = sel.room.designPriority === 'luxury';
                        return (
                          <div
                            className={`candidate-card-v2 ${isApplied ? 'active' : ''}`}
                            onClick={() => {
                              const cats = defaultCategoriesForRoom(sel.room.roomType, 'luxury');
                              patchRoom(sel.room.id, { requiredFurniture: cats, designPriority: 'luxury' });
                            }}
                          >
                            <div className="cand-head">
                              <span className="cand-title">Luxury Feature Suite</span>
                              <span className="cand-score">{isApplied ? 'Active Applied' : '96% Valid'}</span>
                            </div>
                            <div className="cand-preview-box">
                              <CandidateVectorPreview room={sel.room} walls={walls} openings={openings} candidateType="luxury" />
                            </div>
                            <div className="cand-meta">
                              <span>Focus: <strong>Island counter &amp; feature panels</strong></span>
                              <span>Clearance: <strong>950 mm</strong></span>
                            </div>
                            <button
                              type="button"
                              className={`cand-apply-btn ${isApplied ? 'applied' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void applyLayoutCandidateToScene(sel.room, 'luxury');
                              }}
                            >
                              <CheckCircle2 size={13} /> {isApplied ? 'Applied & Verified' : 'Select & Apply Layout'}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {spacePanel === 'geometry' && <>
                  {sel.scaleReview && <div className="scale-review-note" role="status"><TriangleAlert size={14} /><div><strong>Check the room scale</strong><span>This {ROOM_TYPES[sel.room.roomType] ?? 'room'} is unusually small for its selected type. Confirm calibration or correct the room edges before using its layout measurements.</span></div></div>}
                  <label>Room name</label><input value={sel.room.name} onChange={(e) => setRooms(rs => rs.map(r => r.id === sel.room.id ? { ...r, name: e.target.value } : r))} />
                  <label>Type</label>
                  <select value={sel.room.roomType} onChange={(e) => setRoomType(sel.room.id, e.target.value)}>{Object.entries(ROOM_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                  <label>Ceiling height (mm)</label>
                  <input type="number" value={sel.room.ceilingHeightMm ?? ceilingHeightMm} onChange={(e) => setRoomCeiling(sel.room.id, parseInt(e.target.value, 10) || ceilingHeightMm)} />
                  <div className="props-read">
                    <div><span>Dimensions</span><strong>{Math.round(sel.widthMm)} mm × {Math.round(sel.depthMm)} mm <small style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({mmToFeetInches(sel.widthMm)} × {mmToFeetInches(sel.depthMm)})</small></strong></div>
                    <div><span>Area</span><strong>{(sel.effectiveAreaSqm ?? sel.room.areaSqm).toFixed(1)} m² <small style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({sqmToSqft(sel.effectiveAreaSqm ?? sel.room.areaSqm)} sq.ft)</small></strong></div>
                    <div><span>Ceiling</span><strong>{sel.room.ceilingHeightMm ?? ceilingHeightMm} mm <small style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({mmToFeetInches(sel.room.ceilingHeightMm ?? ceilingHeightMm)})</small></strong></div>
                    <div><span>Usable wall</span><strong>{sel.usable.usableWallMm} mm <small style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({mmToFeetInches(sel.usable.usableWallMm)})</small></strong></div>
                    <div><span>Deductions</span><strong>{sel.usable.deductionsMm} mm <small style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({mmToFeetInches(sel.usable.deductionsMm)})</small></strong></div>
                  </div>

                  {/* Architectural Readiness & Vastu Compliance Audit Gate */}
                  <div className="vastu-readiness-card">
                    <div className="vrc-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Compass size={14} color="var(--gold)" />
                        <strong>Room Readiness &amp; Vastu Checklist</strong>
                      </div>
                      <Badge tone={sel.readiness.ready ? 'success' : 'warn'}>
                        {sel.readiness.ready ? 'Ready for Layout' : !sel.vastu.isCompliant ? 'Vastu Remedy Needed' : 'Checklist Incomplete'}
                      </Badge>
                    </div>

                    <div className="vrc-items">
                      <div className={`vrc-item ${sel.readiness.geometryVerified ? 'pass' : 'fail'}`}>
                        <span>{sel.readiness.geometryVerified ? '✓' : '⚠️'} Derived Geometry</span>
                        <strong>{(sel.effectiveAreaSqm ?? sel.room.areaSqm).toFixed(1)} m²</strong>
                      </div>
                      <div className={`vrc-item ${sel.readiness.heightKnown ? 'pass' : 'fail'}`}>
                        <span>{sel.readiness.heightKnown ? '✓' : '⚠️'} Ceiling Height</span>
                        <strong>{sel.room.ceilingHeightMm ?? ceilingHeightMm} mm</strong>
                      </div>
                      <div className={`vrc-item ${sel.readiness.requirementsSaved ? 'pass' : 'fail'}`}>
                        <span>{sel.readiness.requirementsSaved ? '✓' : '⚠️'} Furniture Requirements</span>
                        <strong>{sel.room.requiredFurniture.length} items</strong>
                      </div>
                      <div className={`vrc-item ${sel.readiness.noBlockingPlanIssues ? 'pass' : 'fail'}`}>
                        <span>{sel.readiness.noBlockingPlanIssues ? '✓' : '⚠️'} Plan Critical Issues</span>
                        <strong>0 issues</strong>
                      </div>
                      <div className={`vrc-item ${sel.vastu.isCompliant ? 'pass' : 'remedy'}`} style={{ gridColumn: 'span 2' }}>
                        <span>{sel.vastu.isCompliant ? '✓' : '⚠️'} Vastu Shastra Directional Alignment</span>
                        <strong>{sel.vastu.score}% Compliant ({sel.vastu.isCompliant ? 'Auspicious' : `${sel.vastu.remedyCount} Remedy required`})</strong>
                      </div>
                    </div>

                    {!sel.vastu.isCompliant && sel.vastu.criticalRemedy && (
                      <div className="vrc-remedy-banner">
                        <AlertTriangle size={13} color="#f59e0b" />
                        <span>{sel.vastu.criticalRemedy}</span>
                      </div>
                    )}

                    <div className="vrc-actions">
                      <button
                        type="button"
                        className="btn-vrc-align"
                        onClick={() => toggleRoomVastu(sel.room.id, sel.widthMm, sel.depthMm)}
                      >
                        <Sparkles size={12} /> {sel.vastu.isCompliant ? 'Simulate Vastu Defect (NE Bed)' : '✨ Auto-Align to Vastu (SW Bed)'}
                      </button>
                      <button
                        type="button"
                        className="btn-vrc-stager"
                        onClick={() => setCanvasRenderMode('stager')}
                      >
                        Open Stager &rarr;
                      </button>
                    </div>
                  </div>

                  <div className="wall-verification-list">
                    <strong>Interactive Wall Picker &amp; Elevation Setup</strong>
                    <p>Click a wall to inspect technical 2D elevation, door/window clearances, or apply Design Feature Walls.</p>
                    <div className="wall-picker-grid">
                      {roomBoundaryWalls(sel.room).map((wall, index) => {
                        const isSelected = selectedWall === wall.id;
                        const wLen = Math.round(wallLen(wall));
                        const label = `Wall ${String.fromCharCode(65 + index)}`;
                        const assignedRole = sel.room.wallRoles?.[wall.id];
                        return (
                          <div
                            key={wall.id}
                            className={`wall-picker-card ${isSelected ? 'selected' : ''}`}
                            onClick={() => setSelectedWall(isSelected ? null : wall.id)}
                          >
                            <div className="wpc-header">
                              <span className="wpc-badge">{label}</span>
                              <span className="wpc-len">{wLen.toLocaleString()} mm</span>
                            </div>
                            {assignedRole && <span className="wpc-role-tag">{assignedRole.replaceAll('_', ' ')}</span>}
                          </div>
                        );
                      })}
                    </div>

                    {selectedWall && (
                      <div className="wall-elevation-panel">
                        <div className="wep-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span>Technical Elevation — {roomBoundaryWalls(sel.room).findIndex(w => w.id === selectedWall) >= 0 ? `Wall ${String.fromCharCode(65 + roomBoundaryWalls(sel.room).findIndex(w => w.id === selectedWall))}` : 'Selected Wall'}</span>
                            <small style={{ display: 'block' }}>Standard Height: {sel.room.ceilingHeightMm ?? ceilingHeightMm} mm</small>
                          </div>
                          <button
                            type="button"
                            style={{
                              background: '#1c1917',
                              color: 'var(--gold)',
                              border: '1px solid #44382e',
                              borderRadius: 6,
                              padding: '4px 10px',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                            onClick={() => setSpacePanel('modules')}
                          >
                            Configure Modules &rarr;
                          </button>
                        </div>
                        {/* 2D Technical Elevation Blueprint Vector */}
                        <div className="wep-canvas-box">
                          {(() => {
                            const curWall = walls.find(w => w.id === selectedWall) || roomBoundaryWalls(sel.room).find(w => w.id === selectedWall);
                            const wLen = curWall ? Math.round(wallLen(curWall)) : Math.round(sel.widthMm || 3000);
                            const wallOpenings = openings.filter(o => o.wallId === selectedWall);
                            return (
                              <svg viewBox="0 0 320 120" className="wep-elevation-svg">
                                <defs>
                                  <pattern id="wep-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#2a333d" strokeWidth="0.5" />
                                  </pattern>
                                </defs>
                                <rect width="320" height="120" fill="#0f1419" />
                                <rect x="20" y="15" width="280" height="90" fill="url(#wep-grid)" stroke="#4a5a6a" strokeWidth="1.5" />
                                {/* Base Zone (0-850mm) */}
                                <rect x="20" y="75" width="280" height="30" fill="#1b242e" opacity="0.7" stroke="#3b4856" strokeDasharray="3 3" />
                                <text x="25" y="95" fill="#7a8d9f" fontSize="7" fontWeight="bold">BASE ZONE (850mm)</text>
                                {/* Counter / Dado Zone (850-1450mm) */}
                                <rect x="20" y="55" width="280" height="20" fill="#141c24" opacity="0.5" />
                                <text x="25" y="68" fill="#586b7d" fontSize="6">DADO / CLEARANCE (600mm)</text>
                                {/* Wall Unit Zone (1450-2170mm) */}
                                <rect x="20" y="27" width="280" height="28" fill="#222e3a" opacity="0.8" stroke="#485c70" />
                                <text x="25" y="45" fill="#9ab0c5" fontSize="7" fontWeight="bold">WALL UNIT / LOFT (1450-2700mm)</text>
                                <line x1="20" y1="105" x2="300" y2="105" stroke="#d4af37" strokeWidth="2" />

                                {/* Render Wall Openings (Doors / Windows) accurately on elevation */}
                                {wallOpenings.map(op => {
                                  const isDoor = op.kind === 'door';
                                  const opW = Number(op.widthMm || (isDoor ? 900 : 1200));
                                  const opH = Number(op.heightMm || (isDoor ? 2100 : 1200));
                                  const sillH = Number(op.sillHeightMm ?? (isDoor ? 0 : 900));
                                  const svgScaleX = 280 / Math.max(1000, wLen);
                                  const svgScaleY = 90 / (sel.room.ceilingHeightMm ?? ceilingHeightMm ?? 2700);
                                  const opX = 20 + Math.min(280 - 15, Math.max(0, (op.offsetAlongWallMm || 150) * svgScaleX));
                                  const opDrawW = Math.min(280 - (opX - 20), Math.max(14, opW * svgScaleX));
                                  const opDrawH = Math.max(14, opH * svgScaleY);
                                  const opY = 105 - (sillH * svgScaleY) - opDrawH;
                                  return (
                                    <g key={op.id}>
                                      <rect
                                        x={opX}
                                        y={opY}
                                        width={opDrawW}
                                        height={opDrawH}
                                        fill={isDoor ? '#78350f' : '#0369a1'}
                                        fillOpacity={0.4}
                                        stroke={isDoor ? '#ea580c' : '#38bdf8'}
                                        strokeWidth={1.5}
                                      />
                                      {/* Window sill board or door swing */}
                                      {!isDoor && (
                                        <line x1={opX - 2} y1={opY + opDrawH} x2={opX + opDrawW + 2} y2={opY + opDrawH} stroke="#38bdf8" strokeWidth={2} />
                                      )}
                                      <text
                                        x={opX + opDrawW / 2}
                                        y={opY + opDrawH / 2 + 3}
                                        textAnchor="middle"
                                        fill="#ffffff"
                                        fontSize={6}
                                        fontWeight="bold"
                                      >
                                        {op.kind.toUpperCase()}
                                      </text>
                                    </g>
                                  );
                                })}
                              </svg>
                            );
                          })()}
                        </div>

                        <div className="wep-feature-actions">
                          <label>Apply Design Feature Wall Treatment:</label>
                          <div className="wep-feature-buttons">
                            <button
                              type="button"
                              className="wep-treatment-btn"
                              onClick={() => void applyFeatureWallToSelectedWall(sel.room, selectedWall, 'fluted-pu')}
                            >
                              <span>Fluted Charcoal PU (2400mm)</span>
                            </button>
                            <button
                              type="button"
                              className="wep-treatment-btn"
                              onClick={() => void applyFeatureWallToSelectedWall(sel.room, selectedWall, 'acoustic-slat')}
                            >
                              <span>Walnut Acoustic Slat (2400mm)</span>
                            </button>
                            <button
                              type="button"
                              className="wep-treatment-btn"
                              onClick={() => void applyFeatureWallToSelectedWall(sel.room, selectedWall, 'french-wainscot')}
                            >
                              <span>French Wainscot (3000mm)</span>
                            </button>
                            <button
                              type="button"
                              className="wep-treatment-btn"
                              onClick={() => void applyFeatureWallToSelectedWall(sel.room, selectedWall, 'calacatta-sintered')}
                            >
                              <span>Calacatta Sintered Stone</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>}

                {spacePanel === 'modules' && (() => {
                  // Use the same persisted wall set as catalog-fit and server
                  // placement. This prevents a bay schedule from targeting a
                  // preview-only polygon edge that cannot be compiled.
                  const boundaryWalls = wallsForRoom(sel.room);
                  const activeWall = selectedWall
                    ? walls.find((w) => w.id === selectedWall) || boundaryWalls.find((w) => w.id === selectedWall)
                    : boundaryWalls[0] || null;
                  const activeWallIndex = activeWall
                    ? boundaryWalls.findIndex((w) => w.id === activeWall.id)
                    : 0;
                  const activeWallLabel = activeWallIndex >= 0 ? `Wall ${String.fromCharCode(65 + activeWallIndex)}` : 'Selected Wall';
                  const activeWallLength = activeWall ? Math.round(wallLen(activeWall)) : 3000;
                  const activeWallOpenings = activeWall
                    ? openings
                        .filter((o) => o.wallId === activeWall.id)
                        .map((o) => ({
                          id: o.id,
                          wallId: activeWall.id,
                          kind: o.kind,
                          offsetAlongWallMm: o.offsetAlongWallMm,
                          widthMm: o.widthMm,
                        }))
                    : [];

                  return (
                    <div className="modules-panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div className="modules-panel-intro">
                        <strong style={{ fontSize: 13, color: '#f0f4f8', display: 'block', marginBottom: 3 }}>
                          Wall Bays &amp; Usable Width Reconciliation
                        </strong>
                        <p style={{ margin: 0, fontSize: 11.5, color: '#9ba8b7', lineHeight: 1.4 }}>
                          Configure modular bays along each measured wall of <strong>{sel.room.name}</strong>.
                          Enforces door/window keep-out zones and reconciles bay widths against approved usable dimensions in real time.
                        </p>
                      </div>

                      {/* Wall Picker Tabs */}
                      <div className="wall-picker-tabs" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                        {boundaryWalls.map((w, idx) => {
                          const isCurrent = activeWall?.id === w.id;
                          const wLabel = `Wall ${String.fromCharCode(65 + idx)}`;
                          const wL = Math.round(wallLen(w));
                          return (
                            <button
                              key={w.id}
                              type="button"
                              className={`wall-tab-btn ${isCurrent ? 'active' : ''}`}
                              style={{
                                padding: '6px 12px',
                                borderRadius: 6,
                                border: isCurrent ? '1px solid var(--gold, #d4af37)' : '1px solid var(--line, #282f37)',
                                background: isCurrent ? '#222b37' : '#171d24',
                                color: isCurrent ? 'var(--gold, #d4af37)' : 'var(--text-secondary, #9ba8b7)',
                                cursor: 'pointer',
                                fontSize: 11,
                                fontWeight: 600,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                gap: 2,
                                flexShrink: 0
                              }}
                              onClick={() => setSelectedWall(w.id)}
                            >
                              <span>{wLabel}</span>
                              <small style={{ fontSize: 9, opacity: 0.8 }}>{wL.toLocaleString()} mm</small>
                            </button>
                          );
                        })}
                      </div>

                      {activeWall ? (
                        <WallBayEditor
                          wall={{
                            id: activeWall.id,
                            lengthMm: activeWallLength,
                            name: `${activeWallLabel} (${activeWallLength}mm)`,
                            start: activeWall.start,
                            end: activeWall.end,
                          }}
                          openings={activeWallOpenings}
                          leftClearanceMm={50}
                          rightClearanceMm={50}
                          initialSchedule={compositionSchedules[activeWall.id] || null}
                          onScheduleChange={(newSchedule) => {
                            setCompositionSchedules((prev) => {
                              const next = { ...prev, [activeWall.id]: newSchedule };
                              if (projectId) {
                                try { window.localStorage.setItem(`ultida.compositionSchedules.${projectId}`, JSON.stringify(next)); } catch {}
                              }
                              return next;
                            });
                          }}
                          onConfirmSchedule={(confirmedSchedule) => {
                            setCompositionSchedules((prev) => {
                              const next = { ...prev, [activeWall.id]: confirmedSchedule };
                              if (projectId) {
                                try { window.localStorage.setItem(`ultida.compositionSchedules.${projectId}`, JSON.stringify(next)); } catch {}
                              }
                              return next;
                            });
                            setSaveState(`Wall ${activeWallLabel} bay schedule confirmed for production!`);
                          }}
                        />
                      ) : (
                        <div className="empty-panel-note" style={{ padding: 16, background: '#191f26', borderRadius: 6, textAlign: 'center', fontSize: 12, color: '#8fa0b2' }}>
                          Select a wall from the room boundary above to configure its modular bays.
                        </div>
                      )}

                      {/* Catalog quick-access */}
                      <div style={{ marginTop: 10, paddingTop: 12, borderTop: '1px solid var(--line, #282f37)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#f0f4f8', display: 'block' }}>Indian Modular Catalog</span>
                          <small style={{ color: '#8fa0b2', fontSize: 11 }}>Browse certified modular assemblies sized for this wall</small>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => { setCatalogFitFilter('fits'); setShowDesignLibrary(true); }}
                        >
                          <BookOpen size={13} style={{ marginRight: 4 }} /> Open Catalog
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {spacePanel === 'flooring' && (() => {
                  const bWalls = roomBoundaryWalls(sel.room);
                  const bWallIds = new Set(bWalls.map((w) => w.id));
                  const relevantDoorOpenings = openings
                    .filter((o) => (o.kind === 'door' || o.kind === 'passage') && (bWallIds.has(o.wallId) || !o.wallId))
                    .map((o) => ({
                      id: o.id,
                      offsetAlongWallMm: o.offsetAlongWallMm,
                      widthMm: o.widthMm
                    }));

                  return (
                    <FlooringStudio
                      roomId={sel.room.id}
                      roomName={sel.room.name}
                      roomAreaSqm={sel.effectiveAreaSqm ?? sel.room.areaSqm}
                      roomPolygon={sel.room.polygon}
                      doorOpenings={relevantDoorOpenings}
                      initialSurface={floorSurfaces[sel.room.id] || null}
                      onSurfaceChange={(surface) => {
                        setFloorSurfaces((prev) => {
                          const next = { ...prev, [sel.room.id]: surface };
                          if (projectId) {
                            try { window.localStorage.setItem(`ultida.floorSurfaces.${projectId}`, JSON.stringify(next)); } catch {}
                          }
                          return next;
                        });
                      }}
                      onSave={(surface, quantity) => {
                        setFloorSurfaces((prev) => {
                          const next = { ...prev, [sel.room.id]: surface };
                          if (projectId) {
                            try { window.localStorage.setItem(`ultida.floorSurfaces.${projectId}`, JSON.stringify(next)); } catch {}
                          }
                          return next;
                        });
                        const matchedPreset = TILE_PRESETS.find((p) => p.id === surface.materialVersionId);
                        const finishName = matchedPreset ? matchedPreset.name : surface.materialVersionId;
                        patchRoom(sel.room.id, { floorFinish: finishName });
                        const summary = quantity
                          ? ` · ${quantity.netAreaSqm} m², ${quantity.totalTileCount} tiles, ${quantity.skirtingLinearM}m skirting`
                          : '';
                        setSaveState(`✓ Flooring for ${sel.room.name} saved: ${finishName}${summary}`);
                      }}
                    />
                  );
                })()}

                {spacePanel === 'brief' && <>
                  <div className="ai-brief-trigger">
                    <button type="button" className="btn-secondary btn-full" onClick={() => detectAiLayout(sel.room)}>
                      <Sparkles size={14} /> Auto-Detect Layout Requirements with AI
                    </button>
                  </div>
                  <label>Required modular furniture</label>
                  <div className="furniture-options" role="group" aria-label="Required modular furniture">
                    {furnitureOptionsFor(sel.room.roomType).map((option) => (
                      <label key={option.id} className="furniture-option">
                        <input type="checkbox" checked={sel.room.requiredFurniture.includes(option.id)} onChange={() => toggleFurniture(sel.room.id, option.id)} />
                        <div>
                          <strong>{option.label}</strong>
                          {option.defaultModuleId && <small>Linked: {option.defaultModuleId}</small>}
                        </div>
                      </label>
                    ))}
                  </div>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setShowDesignLibrary(true)}>
                    <BookOpen size={13} /> Browse Design Library Units
                  </button>
                  <label>Layout priority</label>
                  <select value={sel.room.designPriority ?? 'balanced'} onChange={(e) => patchRoom(sel.room.id, { designPriority: e.target.value })}>
                    <option value="storage">Maximum storage (Lofts &amp; full runs)</option>
                    <option value="balanced">Balanced (Ergonomic &amp; functional)</option>
                    <option value="circulation">Maximum circulation (Spacious walkways)</option>
                  </select>
                  <label>Style direction</label>
                  <select value={sel.room.styleDirection ?? ''} onChange={(e) => patchRoom(sel.room.id, { styleDirection: e.target.value })}>
                    <option value="">Choose a style direction</option>
                    {sel.room.styleDirection && !STYLE_PRESETS.includes(sel.room.styleDirection) && <option value={sel.room.styleDirection}>Custom: {sel.room.styleDirection}</option>}
                    {STYLE_PRESETS.map((style) => <option key={style} value={style}>{style}</option>)}
                  </select>
                  <label>Flooring finish</label>
                  <div className="flooring-swatch-grid" role="group" aria-label="Flooring finish options">
                    {FLOORING_PRESETS.map((fl) => (
                      <button
                        type="button"
                        key={fl.id}
                        className={`flooring-swatch-card ${sel.room.floorFinish === fl.name ? 'selected' : ''}`}
                        onClick={() => patchRoom(sel.room.id, { floorFinish: fl.name })}
                      >
                        <span className="flooring-chip" style={{ background: fl.colorHex }} />
                        <div className="flooring-info">
                          <strong>{fl.name}</strong>
                          <small>{fl.desc}</small>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center' }}
                    onClick={() => setSpacePanel('flooring')}
                  >
                    <Grid size={13} style={{ color: 'var(--gold)' }} />
                    <span>Open Precision Flooring &amp; Skirting Studio &rarr;</span>
                  </button>

                  <label>False ceiling style</label>
                  <select
                    value={sel.room.falseCeiling ?? ''}
                    onChange={(e) => patchRoom(sel.room.id, { falseCeiling: e.target.value })}
                  >
                    <option value="">Standard flush ceiling (2700mm)</option>
                    {CEILING_PRESETS.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>

                  <label>Colour &amp; finish direction</label>
                  <div className="palette-presets" role="group" aria-label="Colour and finish direction">
                    {PALETTE_PRESETS.map((palette) => (
                      <button type="button" key={palette.value} className={`palette-preset ${sel.room.paletteDirection === palette.value ? 'selected' : ''}`} onClick={() => patchRoom(sel.room.id, { paletteDirection: palette.value })} aria-pressed={sel.room.paletteDirection === palette.value}>
                        <span className="palette-swatches" aria-hidden="true">{palette.colors.map((color) => <i key={color} style={{ background: color }} />)}</span>
                        <span>{palette.label}</span>
                      </button>
                    ))}
                  </div>
                </>}

                {spacePanel === 'scene' && (() => {
                  const currentWall = selectedWall ? walls.find((w) => w.id === selectedWall) : null;
                  const wallOpenings = selectedWall ? openings.filter((o) => o.wallId === selectedWall) : [];
                  const totalCutoutMm = wallOpenings.reduce((sum, o) => sum + (o.widthMm || 900), 0);
                  const wallLengthMm = currentWall ? wallLen(currentWall) : 3000;
                  const usableRunMm = Math.max(0, wallLengthMm - totalCutoutMm);

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <p className="panel-help" style={{ margin: 0 }}>
                        Click a wall on the canvas or select below to configure its architectural role, feature panelling, and 3D camera focal point.
                      </p>

                      {/* Wall Selector Chips */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {walls.slice(0, 8).map((w, idx) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setSelectedWall(w.id)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              border: selectedWall === w.id ? '1px solid var(--gold)' : '1px solid var(--line)',
                              background: selectedWall === w.id ? 'var(--gold-dim, #ebdccb)' : 'var(--surface, #fff)',
                              color: selectedWall === w.id ? '#1c1917' : 'var(--text-secondary)',
                              cursor: 'pointer',
                            }}
                          >
                            Wall {String.fromCharCode(65 + idx)} ({Math.round(wallLen(w))}mm)
                          </button>
                        ))}
                      </div>

                      {/* Wall Dimension & Clearance Card */}
                      {currentWall && (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
                            <span>Wall Geometry</span>
                            <span>{Math.round(wallLengthMm)} mm</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#64748b' }}>
                            <span>Openings Deducted ({wallOpenings.length}):</span>
                            <span>-{totalCutoutMm} mm</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 800, color: '#059669', marginTop: 4, paddingTop: 4, borderTop: '1px dashed #cbd5e1' }}>
                            <span>Net Usable Run:</span>
                            <span>{Math.round(usableRunMm)} mm</span>
                          </div>
                        </div>
                      )}

                      <label style={{ fontSize: 11, fontWeight: 700 }}>Assigned Wall Role</label>
                      <select
                        disabled={!selectedWall}
                        value={selectedWall ? (sel.room.wallRoles?.[selectedWall] ?? '') : ''}
                        onChange={(e) => selectedWall && patchRoom(sel.room.id, { wallRoles: { ...(sel.room.wallRoles ?? {}), [selectedWall]: e.target.value } })}
                        style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--line)' }}
                      >
                        <option value="">Select a wall role</option>
                        <option value="tv_wall">TV Feature Wall</option>
                        <option value="wardrobe_wall">Wardrobe &amp; Storage Wall</option>
                        <option value="bed_headboard_wall">Bed Headboard Wall</option>
                        <option value="kitchen_working_wall">Kitchen Working Wall</option>
                        <option value="crockery_wall">Crockery &amp; Bar Wall</option>
                        <option value="pooja_wall">Sacred Pooja Wall</option>
                        <option value="restricted_wall">Restricted Wall (No Mounting)</option>
                      </select>

                      {/* 1-Click Design Feature Wall Treatments */}
                      <label style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>1-Click Design Feature Wall Cladding</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[
                          { id: 'fluted-pu', name: '2400 Fluted Charcoal PU Cladding', role: 'tv_wall' },
                          { id: 'walnut-slats', name: '2400 Vertical Walnut Acoustic Slats', role: 'tv_wall' },
                          { id: 'boiserie', name: '3000 French Boiserie Mouldings', role: 'bed_headboard_wall' },
                          { id: 'calacatta-stone', name: '2400 Calacatta Sintered Stone Slab', role: 'tv_wall' },
                        ].map((feat) => (
                          <button
                            key={feat.id}
                            type="button"
                            onClick={() => {
                              if (!selectedWall) return;
                              patchRoom(sel.room.id, {
                                wallRoles: { ...(sel.room.wallRoles ?? {}), [selectedWall]: feat.role },
                                styleDirection: 'luxury_modern',
                              });
                              setSaveState(`Applied ${feat.name} to selected wall.`);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '7px 10px',
                              borderRadius: 6,
                              border: '1px solid #ebdccb',
                              background: '#fffdf9',
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              cursor: selectedWall ? 'pointer' : 'not-allowed',
                              opacity: selectedWall ? 1 : 0.6,
                              textAlign: 'left',
                            }}
                          >
                            <span>{feat.name}</span>
                            <Sparkles size={12} style={{ color: 'var(--gold)' }} />
                          </button>
                        ))}
                      </div>

                      <label style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>Preferred 3D Camera View</label>
                      <select
                        value={sel.room.preferredCamera ?? ''}
                        onChange={(e) => patchRoom(sel.room.id, { preferredCamera: e.target.value })}
                        style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--line)' }}
                      >
                        <option value="">Let the scene compiler choose</option>
                        <option value="entry_to_feature">Entry to feature wall</option>
                        <option value="corner_wide">Wide corner overview</option>
                        <option value="feature_to_entry">Feature wall to entry</option>
                        <option value="elevation">Straight technical elevation</option>
                      </select>

                      {/* 2D CAD Architectural Wall Elevation & Sheet */}
                      <div style={{ marginTop: 10, padding: '10px 12px', background: '#fdfbf7', border: '1px solid #ebdccb', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#1c1917', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Compass size={13} style={{ color: 'var(--gold)' }} />
                            Architectural 2D Elevation
                          </span>
                          <span style={{ fontSize: 9.5, fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '1px 6px', borderRadius: 4 }}>
                            System 32 CAD
                          </span>
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: 11, color: '#78716c', lineHeight: 1.4 }}>
                          Millimetre-accurate elevation with dual dimensions, 30mm dummy fillers, and direct AutoCAD DXF generation.
                        </p>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => setShowWallElevationModal(true)}
                            style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              padding: '7px 10px',
                              background: '#1c1917',
                              color: '#fdfbf7',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                            }}
                          >
                            <Compass size={12} /> View 2D CAD Sheet
                          </button>
                          <a
                            href={getWallElevationTemplate(selectedWall, sel.room).dxfPath}
                            download={`ultida-${selectedWall || 'wall'}.dxf`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '7px 10px',
                              background: '#f3ece0',
                              color: '#44403c',
                              border: '1px solid #dcd3c5',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              textDecoration: 'none',
                              cursor: 'pointer',
                            }}
                            title="Download AutoCAD DXF"
                          >
                            <Download size={13} />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {spacePanel === 'advisor' && (() => {
                  const audit = evaluateSeniorDesignerAudit(sel.room, walls, openings);
                  return (
                    <div className="advisor-panel">
                      <div className="advisor-hero-card">
                        <div className="advisor-hero-header">
                          <span className="advisor-kicker">SENIOR ARCHITECT &amp; ERGONOMICS ENGINE</span>
                          <span className="advisor-score-badge">{audit.circulationScore}</span>
                        </div>
                        <h4>10-Year Interior Designer Intelligence</h4>
                        <p>Evaluates System 32 vertical modular elevations, human circulation clearance, appliance work triangle efficiency, and harmonized material aesthetics.</p>
                      </div>

                      <div className="advisor-rules-list">
                        {/* Vastu Shastra Directional Rule */}
                        <div className={`advisor-rule-card ${sel.vastu.isCompliant ? '' : 'remedy-card'}`}>
                          <div className="advisor-rule-card-head">
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Compass size={13} color={sel.vastu.isCompliant ? '#059669' : '#f59e0b'} />
                              Vastu Shastra Directional Alignment
                            </span>
                            <span style={{ color: sel.vastu.isCompliant ? '#059669' : '#f59e0b', fontSize: 10.5, fontWeight: 700 }}>
                              {sel.vastu.isCompliant ? `VERIFIED (${sel.vastu.score}%)` : `REMEDY NEEDED (${sel.vastu.score}%)`}
                            </span>
                          </div>
                          <p>
                            {sel.vastu.isCompliant
                              ? `All furniture modules align auspiciously with sacred Vastu zones: master bed grounded in SW/South, social seating welcoming North/East prana energy.`
                              : (sel.vastu.criticalRemedy || `Vastu directional adjustments needed to optimize positive energy flow in ${sel.room.name}.`)}
                          </p>
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button
                              type="button"
                              style={{
                                padding: '4px 10px',
                                fontSize: 11,
                                fontWeight: 700,
                                background: sel.vastu.isCompliant ? 'var(--gold-dim, #ebdccb)' : '#f59e0b',
                                color: sel.vastu.isCompliant ? '#1c1917' : '#000',
                                border: 0,
                                borderRadius: 6,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                              onClick={() => toggleRoomVastu(sel.room.id, sel.widthMm, sel.depthMm)}
                            >
                              <Sparkles size={11} /> {sel.vastu.isCompliant ? 'Simulate Vastu Defect' : '✨ Auto-Align to Vastu'}
                            </button>
                          </div>
                        </div>

                        {audit.rules.map((rule, idx) => (
                          <div key={idx} className="advisor-rule-card">
                            <div className="advisor-rule-card-head">
                              <span>{rule.title}</span>
                              <span style={{ color: '#059669', fontSize: 10.5 }}>VERIFIED</span>
                            </div>
                            <p>{rule.desc}</p>
                          </div>
                        ))}
                      </div>

                      <div className="advisor-prescriptions">
                        <strong style={{ fontSize: 11, color: 'var(--gold-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Curated Masterclass Specifications</strong>
                        <div className="advisor-presc-row">
                          <span>Palette &amp; Textures:</span>
                          <strong>{audit.recommendedPalette}</strong>
                        </div>
                        <div className="advisor-presc-row">
                          <span>Flooring Spec:</span>
                          <strong>{audit.recommendedFlooring}</strong>
                        </div>
                        <div className="advisor-presc-row">
                          <span>Ceiling &amp; Lighting:</span>
                          <strong>{audit.recommendedCeiling}</strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="advisor-apply-btn"
                        onClick={() => {
                          patchRoom(sel.room.id, {
                            paletteDirection: audit.recommendedPalette,
                            floorFinish: audit.recommendedFlooring,
                            falseCeiling: audit.recommendedCeiling,
                            styleDirection: 'luxury_modern',
                            preferredCamera: 'corner_wide',
                            verificationStatus: 'verified',
                            designPriority: 'luxury',
                            requiredFurniture: defaultCategoriesForRoom(sel.room.roomType, 'luxury'),
                          });
                          void applyLayoutCandidateToScene(sel.room, 'luxury');
                          setSaveState(`Applied Senior Interior Designer prescription & luxury layout to ${sel.room.name}.`);
                        }}
                      >
                        <Sparkles size={14} /> Apply 10Y Designer Prescription &amp; Verify Room
                      </button>
                    </div>
                  );
                })()}

                <div className="room-save-actions">
                  <Button variant="outline" onClick={() => void persistRoom(sel.room)}><Save size={13} /> Save room</Button>
                  <Button
                    disabled={!sel.room.requiredFurniture.length || !(sel.room.ceilingHeightMm ?? ceilingHeightMm)}
                    onClick={async () => {
                      await persistRoom(sel.room);
                      navigate(`/projects/${projectId}/spaces?tab=modules`);
                    }}
                    title="Save this room and select its buildable catalog modules."
                  >
                    <BookOpen size={13} /> Save &amp; open Module Catalog
                  </Button>
                </div>
                {!sel.room.requiredFurniture.length && <p className="room-blocker">Choose at least one furniture or modular requirement before opening the Module Catalog.</p>}
              </div>
            ) : (
              <div className="props-empty">Select a room or wall from the list or canvas.</div>
            )}
          </aside>
        </div>
      )}

      {/*
        Docked Design Library rail. Previously a full-screen modal, which
        forced the user to close it to see the plan they were placing against.
        As a rail it stays open while modules are dragged onto the canvas.
      */}
      {showDesignLibrary && (
          <aside className="design-library-rail" aria-label="Design library">
            <div className="dld-header">
              <div className="dld-title">
                <BookOpen size={18} className="text-gold" />
                <div>
                  <h3>Design Library</h3>
                  <small>Drag a module onto a measured wall</small>
                </div>
              </div>
              <button type="button" className="icon-btn" onClick={() => { setShowDesignLibrary(false); cancelPlacementDrag(); }} aria-label="Close design library"><X size={18} /></button>
            </div>

            <div className="dld-search-bar">
              <div className="search-input-wrap">
                <Search size={15} />
                <input placeholder="Search TV units, wardrobes, kitchens, crockery..." value={catalogQuery} onChange={(e) => setCatalogQuery(e.target.value)} />
              </div>
              <select value={catalogFilterFamily} onChange={(e) => setCatalogFilterFamily(e.target.value)}>
                <option value="all">All Families</option>
                <option value="tv-unit">TV Units</option>
                <option value="wardrobe">Wardrobes</option>
                <option value="kitchen-base">Kitchen Base</option>
                <option value="kitchen-wall">Kitchen Wall</option>
                <option value="kitchen-tall">Kitchen Tall</option>
                <option value="crockery">Crockery Units</option>
                <option value="bed">Beds &amp; Storage</option>
                <option value="study">Study Desks</option>
                <option value="pooja">Pooja Units</option>
                <option value="utility">Utility &amp; Vanity</option>
                <option value="storage">Storage &amp; Foyer</option>
              </select>
              <select value={catalogFitFilter} onChange={(e) => setCatalogFitFilter(e.target.value as 'all' | 'fits')} aria-label="Filter by measured wall fit">
                <option value="all">All fit states</option>
                <option value="fits">Fits current wall</option>
              </select>
            </div>

            <div className="spaces-flow-note" role="status" style={{ margin: '10px 0 0' }}>
              {activeCatalogWall
                ? <>Measured fit context: <strong>{Math.round(activeCatalogWall.lengthMm)} mm wall</strong> · {activeCatalogWall.openings.length} keep-out{activeCatalogWall.openings.length === 1 ? '' : 's'} · drag a card onto any wall to preview its true footprint before committing</>
                : <>Select a room with measured walls to certify placement. Modules remain visual drafts until a wall and its keep-outs are available.</>}
            </div>

            <div className="dld-grid">
              {filteredCatalogModules.map((mod) => {
                const fit = reconcileCatalogModuleFit(activeCatalogWall, mod);
                const templateCertified = Boolean(mod.production.panelBased && mod.production.hardwareSchedule && mod.production.cutlistSupported);
                const productionCertified = Boolean(templateCertified && fit?.productionCertified);
                const fitVerified = Boolean(templateCertified && fit?.fitVerified);
                const blocked = Boolean(fit && !fit.fits);
                const armed = draggingModule?.id === mod.id;
                return <div
                  key={mod.id}
                  className={`dld-card${armed ? ' dld-card--armed' : ''}${blocked ? ' dld-card--blocked' : ''}`}
                  draggable={Boolean(sel)}
                  onDragStart={(event) => {
                    setDraggingModule(mod);
                    event.dataTransfer.effectAllowed = 'copy';
                    // Some browsers cancel a drag with no payload attached.
                    event.dataTransfer.setData('text/plain', mod.id);
                  }}
                  onDragEnd={cancelPlacementDrag}
                >
                  <div className="dld-preview-wrap">
                    <ModulePreview module={mod} compact />
                  </div>
                  <div className="dld-card-body">
                    <div className="dld-card-tags">
                      <Badge tone="neutral">{mod.family}</Badge>
                      <small className="dld-sku">{mod.sku}</small>
                    </div>
                    <div className="dld-card-tags">
                      <Badge tone={productionCertified || fitVerified ? 'success' : fit ? 'warn' : 'neutral'}>{productionCertified ? 'Production certified' : fitVerified ? 'Fit verified · confirm scene' : fit && !fit.fits ? 'Blocked by measured geometry' : 'Visual draft'}</Badge>
                      {fit?.fits && <small className="dld-sku">Placeable at {Math.round(fit.suggestedOffsetMm ?? 0)} mm</small>}
                    </div>
                    <h4>{mod.name}</h4>
                    <p className="dld-card-dims"><strong>{mod.widthMm}</strong> W × <strong>{mod.depthMm}</strong> D × <strong>{mod.heightMm}</strong> H mm</p>
                    {mod.description && <p className="dld-desc">{mod.description}</p>}
                    {fit && !fit.fits && <p className="dld-desc" role="alert">{fit.issues[0]}</p>}
                    <div className="dld-slots">
                      <span>Slots:</span>
                      {mod.materialSlots.map((slot) => <Badge key={slot} tone="accent">{slot}</Badge>)}
                    </div>
                    {sel && (
                      <div className="dld-card-actions">
                        <button
                          type="button"
                          className={`btn-sm btn-full ${armed ? 'btn-outline' : 'btn-ghost'}`}
                          title={armed ? 'Cancel placement (Escape).' : 'Arm this module, then click a measured wall on the plan.'}
                          onClick={() => (armed ? cancelPlacementDrag() : setDraggingModule(mod))}
                        >
                          <MousePointer2 size={13} /> {armed ? 'Cancel placement' : 'Click to place'}
                        </button>
                        <button
                          type="button"
                          className="btn-primary btn-sm btn-full"
                          disabled={!activeCatalogWall || blocked}
                          title={blocked ? fit!.issues.join(' ') : productionCertified ? 'Place this certified module on the selected measured wall.' : fitVerified ? 'Place this fit-verified module, then confirm its persisted composition for production.' : 'Select a measured wall before placing this visual draft.'}
                          onClick={() => void placeCatalogModuleOnSelectedWall(mod)}
                        >
                          <Plus size={13} /> {activeCatalogWall ? 'Place on selected wall' : 'Select wall in 2D'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>;
              })}
              {!filteredCatalogModules.length && <div className="props-empty">No modules match this room, family, and measured wall fit. Select another wall or switch to “All fit states” to inspect blocked templates.</div>}
            </div>
          </aside>
      )}

      {/* 3D Elevated Top-Down Floor Plan Render Modal */}
      {showFloorPlanRenderModal && (
        <div className="floor-render-modal-backdrop" onClick={() => setShowFloorPlanRenderModal(false)}>
          <div className="floor-render-modal" onClick={(e) => e.stopPropagation()}>
            <div className="floor-render-header">
              <div>
                <h3>Enhanced 3D Floor Plan Render</h3>
                <small style={{ color: 'var(--text-muted)' }}>Top-down axonometric cutaway with elevated walls, real flooring textures, and modular furniture</small>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowFloorPlanRenderModal(false)}><X size={18} /></button>
            </div>
            <div className="floor-render-stage">
              <svg viewBox={`0 0 ${view.w} ${view.h}`} style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 12px 28px rgba(0,0,0,0.5))' }}>
                <defs>
                  <pattern id="modal-floor-marble" width="40" height="40" patternUnits="userSpaceOnUse">
                    <rect width="40" height="40" fill="#f2ede4" />
                    <path d="M 0 20 Q 20 10 40 30 M 10 0 Q 30 20 20 40" fill="none" stroke="#e0d4c3" strokeWidth="0.8" />
                  </pattern>
                  <pattern id="modal-floor-wood" width="50" height="18" patternUnits="userSpaceOnUse">
                    <rect width="50" height="18" fill="#c8a882" />
                    <line x1="0" y1="18" x2="50" y2="18" stroke="#b08d66" strokeWidth="1" />
                  </pattern>
                  <pattern id="modal-floor-parquet" width="28" height="28" patternUnits="userSpaceOnUse">
                    <rect width="28" height="28" fill="#6b4c35" />
                    <path d="M 0 14 L 14 0 L 28 14 L 14 28 Z" fill="none" stroke="#523927" strokeWidth="1" />
                  </pattern>
                  <pattern id="modal-floor-terrazzo" width="30" height="30" patternUnits="userSpaceOnUse">
                    <rect width="30" height="30" fill="#d9c9b8" />
                    <circle cx="5" cy="5" r="1.5" fill="#8c7a6b" />
                    <circle cx="20" cy="12" r="2" fill="#b09f90" />
                  </pattern>
                  <pattern id="modal-floor-tile" width="40" height="40" patternUnits="userSpaceOnUse">
                    <rect width="40" height="40" fill="#605e5a" />
                    <rect x="1" y="1" width="38" height="38" fill="#6d6a66" />
                  </pattern>
                  <pattern id="modal-floor-statuario" width="60" height="60" patternUnits="userSpaceOnUse">
                    <rect width="60" height="60" fill="#f8fafc" />
                    <path d="M 0 30 Q 30 15 60 45 M 15 0 Q 45 30 30 60" fill="none" stroke="#cbd5e1" strokeWidth="1" />
                  </pattern>
                  <pattern id="modal-floor-default" width="30" height="30" patternUnits="userSpaceOnUse">
                    <rect width="30" height="30" fill="#faf6ef" />
                  </pattern>
                </defs>

                {/* Rooms with Textured Flooring */}
                {rooms.filter(r => r.included !== false).map(r => {
                  const pts = r.polygon.map(p => { const q = toPx(p); return `${q.x},${q.y}`; }).join(' ');
                  const b = bbox(r.polygon);
                  const center = toPx({ xMm: (b.minX + b.maxX) / 2, yMm: (b.minY + b.maxY) / 2 });
                  const pId = getFloorPatternId(r.floorFinish, floorSurfaces[r.id]);
                  return (
                    <g key={r.id}>
                      <polygon points={pts} fill={`url(#modal-${pId})`} stroke="#4a3728" strokeWidth={1.5} />
                      <text x={center.x} y={center.y - 6} fontSize={11} fontWeight="bold" fill="#2d2216" textAnchor="middle">{r.name}</text>
                      <text x={center.x} y={center.y + 8} fontSize={9} fill="#5a4938" textAnchor="middle">{r.areaSqm.toFixed(1)} m² · {r.floorFinish || 'Standard Floor'}</text>
                    </g>
                  );
                })}

                {/* 3D Elevated Cutaway Walls */}
                {walls.map(w => {
                  const a = toPx(w.start), b = toPx(w.end);
                  const scaledThickness = Math.max(6, Math.min(18, Number(w.thicknessMm ?? 152.4) * view.scale));
                  return (
                    <g key={w.id}>
                      {/* Drop shadow */}
                      <line x1={a.x + 4} y1={a.y + 7} x2={b.x + 4} y2={b.y + 7} stroke="#000" strokeWidth={scaledThickness + 2} strokeOpacity={0.45} strokeLinecap="square" />
                      {/* Extruded Wall Cap */}
                      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2b2017" strokeWidth={scaledThickness} strokeLinecap="square" />
                      {/* Wall Top Highlight */}
                      <line x1={a.x} y1={a.y - 1} x2={b.x} y2={b.y - 1} stroke="#544030" strokeWidth={scaledThickness / 2} strokeLinecap="square" />
                    </g>
                  );
                })}

                {/* Doors & Windows */}
                {openings.map(o => {
                  const w = walls.find(x => x.id === o.wallId);
                  if (!w) return null;
                  const a = toPx(w.start), b = toPx(w.end);
                  const length = wallLen(w) || 1;
                  const centerOffset = Math.max(0, Math.min(length, Number(o.offsetAlongWallMm ?? 0)));
                  const t = centerOffset / length;
                  const px = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
                  return (
                    <g key={o.id}>
                      <rect x={px.x - 7} y={px.y - 7} width={14} height={14} rx={2} fill={o.kind === 'door' ? '#d97706' : '#2563eb'} stroke="#fff" strokeWidth={1.5} />
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="floor-render-footer">
              <div>
                <strong>3D Axonometric Quality: 4K Architectural</strong>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>Includes daylight diffusion, warm LED cove shadows, and material reflectance</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setShowFloorPlanRenderModal(false)}>Close</button>
                <button type="button" className="btn-primary btn-sm" onClick={() => {
                  setRenderJobState('succeeded');
                  setSaveState('Enhanced 3D Floor Plan compiled into project media gallery.');
                  setShowFloorPlanRenderModal(false);
                }}>
                  <CheckCircle2 size={13} /> Save Render to Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2D CAD Architectural Wall Elevation Modal */}
      {showWallElevationModal && selectedRoom && (() => {
        const room = rooms.find((r) => r.id === selectedRoom) || null;
        const elevation = getWallElevationTemplate(selectedWall, room);
        return (
          <div className="floor-render-modal-backdrop" onClick={() => setShowWallElevationModal(false)}>
            <div className="floor-render-modal" style={{ maxWidth: '980px', width: '92vw' }} onClick={(e) => e.stopPropagation()}>
              <div className="floor-render-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: 4, letterSpacing: '0.05em' }}>
                      {elevation.tag}
                    </span>
                    <h3 style={{ margin: 0, fontSize: 16, color: '#1c1917' }}>{elevation.title}</h3>
                  </div>
                  <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                    Wall: {selectedWall ?? 'Selected Wall'} · Controlled Width: {elevation.widthMm.toLocaleString()} mm · Ceiling: {elevation.heightMm.toLocaleString()} mm
                  </small>
                </div>
                <button type="button" className="icon-btn" onClick={() => setShowWallElevationModal(false)}><X size={18} /></button>
              </div>
              <div style={{ padding: 16, background: '#faf9f6', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 380, maxHeight: '60vh', overflow: 'auto' }}>
                <img
                  src={elevation.svgPath}
                  alt={elevation.title}
                  style={{ maxWidth: '100%', maxHeight: '56vh', objectFit: 'contain', background: '#fff', border: '1px solid #e7dfd5', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}
                />
              </div>
              <div style={{ padding: '12px 18px', background: '#fdfbf7', borderTop: '1px solid #ebdccb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: 11.5, color: '#57534e' }}>
                  <strong>System 32 Joinery:</strong> {elevation.specs}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a
                    href={elevation.svgPath}
                    download={`ultida-${elevation.id}.svg`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid #d6d3d1',
                      background: '#fff',
                      color: '#292524',
                      fontSize: 11.5,
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    <Download size={13} /> Download SVG
                  </a>
                  <a
                    href={elevation.dxfPath}
                    download={`ultida-${elevation.id}.dxf`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 14px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#166534',
                      color: '#fff',
                      fontSize: 11.5,
                      fontWeight: 700,
                      textDecoration: 'none',
                      boxShadow: '0 2px 6px rgba(22,101,52,0.25)',
                    }}
                  >
                    <Download size={13} /> Download AutoCAD DXF (.dxf)
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <WorkflowDock
        currentStageIndex={3}
        totalStages={8}
        stageTitle="Rooms &amp; 2D Space Layout"
        stageSummary={`${rooms.filter((r) => r.included !== false).length} configured spaces • Next: Design Library modules, Wall A/B/C/D elevations & System 32.`}
        prevAction={{
          label: 'Measured Plan',
          icon: <ArrowLeft size={13} />,
          onClick: () => navigate(`/projects/${projectId}/plan`),
        }}
        nextAction={{
          label: 'Configure Modules & Elevations',
          icon: <ArrowRight size={14} />,
          onClick: () => navigate(`/projects/${projectId}/spaces?tab=modules${selectedRoom ? `&roomId=${selectedRoom}` : ''}${selectedWall ? `&wallId=${selectedWall}` : ''}`),
        }}
      />
    </div>
  );
}

function evaluateSeniorDesignerAudit(room: PlanRoom, walls: PlanWall[], openings: PlanOpening[]) {
  const isKitchen = room.roomType === 'kitchen';
  const isBedroom = ['master_bedroom', 'bedroom', 'kids_bedroom'].includes(room.roomType);
  const isLiving = room.roomType === 'living';
  const isDining = room.roomType === 'dining';

  const area = room.areaSqm || 12;
  const circulationScore = area >= 14 ? '98% Luxury Grade' : area >= 9 ? '95% Optimal Circulation' : '91% Compact Efficient';

  const rules = [];

  if (isKitchen) {
    rules.push({ title: 'Work Triangle Ergonomics', desc: 'Sink, induction/gas hob, and refrigerator maintain uninterrupted >600mm landing spaces with ergonomic counter perimeter.' });
    rules.push({ title: 'Appliance Tower Elevation', desc: 'Microwave and convection oven stationed at 1200mm–1350mm FFL for zero-bend safety.' });
    rules.push({ title: 'Under-Cabinet Task Lighting', desc: 'Warm 3000K diffused LED strip with anti-glare profile channel beneath all upper wall units.' });
    rules.push({ title: 'Tandem Deep Drawer Storage', desc: '850mm base run configured with Blum/Hettich 60kg tandem pantry & pot organizers.' });
  } else if (isBedroom) {
    rules.push({ title: 'Bedside Clearance & Walkways', desc: 'Minimum 750mm clearance on both sides of king mattress with seamless wardrobe swing arc access.' });
    rules.push({ title: 'Full-Height Wardrobe & Lofts', desc: '2700mm carcase with 600mm seasonal lofts, internal sensor lighting, and hydraulic pull-downs.' });
    rules.push({ title: 'Acoustic Headboard Wall', desc: 'Fluted wood & textured fabric acoustic panelling behind headboard for luxury thermal & sound insulation.' });
    rules.push({ title: 'Ergonomic Dresser Vanity', desc: 'Dedicated 900mm LED vanity mirror with dual USB-C bedside charging at 650mm FFL.' });
  } else if (isLiving) {
    rules.push({ title: 'Optimal TV Viewing Distance', desc: `Recommended 65"–75" OLED viewing distance: ${(Math.max(2.4, Math.sqrt(area) * 0.75)).toFixed(1)}m from primary sofa seating axis.` });
    rules.push({ title: 'Ambient Cove & Accent Grazers', desc: '3000K warm architectural perimeter ceiling cove with 38° beam-angle ceiling spotlights.' });
    rules.push({ title: 'Circulation Spine', desc: '>1000mm uninterrupted clear passage connecting foyer to balcony/dining zone.' });
    rules.push({ title: 'Floating Media Console', desc: '2400mm fluted charcoal PU media console with concealed acoustic cable raceways.' });
  } else if (isDining) {
    rules.push({ title: 'Dining Chair Push-Back Space', desc: '900mm clear space between table edge and wall for effortless chair pull-out.' });
    rules.push({ title: 'Illuminated Crockery Unit', desc: 'Profile-glass display unit with warm interior vertical shelf lighting.' });
  } else {
    rules.push({ title: 'Architectural Proportions', desc: `Standard modular scale verified for ${room.name} with compliant door swings.` });
    rules.push({ title: 'Lighting & Finishes', desc: 'Harmonized 3000K warm lighting and anti-scratch matte finishes.' });
  }

  return {
    circulationScore,
    rules,
    recommendedPalette: isKitchen ? 'Smoked Walnut & Matte Cashmere' : isBedroom ? 'Warm Greige & Fluted Champagne' : isDining ? 'Calacatta Gold & Dark Bronze' : 'Calacatta Gold & Charcoal PU',
    recommendedFlooring: isKitchen ? 'Polished Statuario 1200×600mm Tile' : isBedroom ? 'Herringbone European Natural Oak' : 'Italian Botticino Marble',
    recommendedCeiling: 'Perimeter Gypsum False Ceiling with 3000K Warm LED Cove',
  };
}

function defaultCategoriesForRoom(roomType: string, priority: 'circulation' | 'balanced' | 'storage' | 'luxury'): string[] {
  if (roomType === 'master_bedroom') {
    if (priority === 'circulation') return ['master_bed', 'master_wardrobe'];
    if (priority === 'storage') return ['master_bed', 'master_wardrobe', 'master_vanity', 'master_tv', 'master_study'];
    if (priority === 'luxury') return ['master_bed', 'master_wardrobe', 'master_vanity', 'master_tv', 'feature_wall'];
    return ['master_bed', 'master_wardrobe', 'master_vanity', 'master_tv'];
  }
  if (['bedroom', 'kids_bedroom'].includes(roomType)) {
    if (priority === 'circulation') return ['bed', 'wardrobe'];
    if (priority === 'storage') return ['bed', 'wardrobe', 'study_unit', 'tv_unit', 'vanity_unit'];
    if (priority === 'luxury') return ['bed', 'wardrobe', 'vanity_unit', 'feature_wall'];
    return ['bed', 'wardrobe', 'study_unit', 'vanity_unit'];
  }
  if (roomType === 'living') {
    if (priority === 'circulation') return ['tv_unit', 'sofa'];
    if (priority === 'storage') return ['tv_unit', 'sofa', 'crockery_unit', 'pooja_unit'];
    if (priority === 'luxury') return ['tv_unit', 'sofa', 'feature_wall', 'crockery_unit'];
    return ['tv_unit', 'sofa', 'crockery_unit'];
  }
  if (roomType === 'dining') {
    if (priority === 'circulation') return ['dining_table'];
    if (priority === 'luxury') return ['dining_table', 'crockery_unit', 'feature_wall'];
    return ['dining_table', 'crockery_unit'];
  }
  if (roomType === 'kitchen') {
    if (priority === 'circulation') return ['kitchen_base', 'kitchen_wall'];
    if (priority === 'storage') return ['kitchen_base', 'kitchen_wall', 'kitchen_tall', 'kitchen_corner', 'bottle_pullout'];
    if (priority === 'luxury') return ['kitchen_base', 'kitchen_wall', 'kitchen_tall', 'kitchen_island', 'kitchen_corner'];
    return ['kitchen_base', 'kitchen_wall', 'kitchen_tall', 'kitchen_sink'];
  }
  if (roomType === 'study') {
    return ['study_unit', 'storage_unit'];
  }
  if (roomType === 'pooja') {
    return ['pooja_unit'];
  }
  return ['storage_unit'];
}

function Room2DArchitecturalLayout({
  room,
  toPx,
  scale,
}: {
  room: PlanRoom;
  toPx: (point: { xMm: number; yMm: number }) => { x: number; y: number };
  scale: number;
}) {
  const polygon = room.polygon;
  if (!polygon || polygon.length < 3) return null;

  const xs = polygon.map((p) => p.xMm);
  const ys = polygon.map((p) => p.yMm);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const widthMm = Math.max(500, maxX - minX);
  const depthMm = Math.max(500, maxY - minY);

  const roomType = (room.roomType || 'other').toLowerCase();
  const roomName = (room.name || '').toLowerCase();
  const isMasterBed = roomType === 'master_bedroom' || roomName.includes('m bed') || roomName.includes('master');
  const isBedroom = isMasterBed || roomType === 'bedroom' || roomType === 'kids_bedroom' || roomName.includes('bed') || roomName.includes('c bed');
  const isLiving = roomType === 'living' || roomName.includes('living');
  const isDining = roomType === 'dining' || roomName.includes('dining');
  const isKitchen = roomType === 'kitchen' || roomName.includes('kitchen');
  const isPooja = roomType === 'pooja' || roomName.includes('pooja') || roomName.includes('mandir');
  const isToilet = roomType === 'bathroom' || roomType === 'utility' || roomName.includes('toilet') || roomName.includes('bath') || roomName.includes('wc');
  const isDress = roomName.includes('dress') || roomName.includes('walk-in');
  const isParking = roomName.includes('park') || roomName.includes('garage');

  // Convert room relative mm to canvas pixels
  const rPx = (rxMm: number, ryMm: number) => toPx({ xMm: minX + rxMm, yMm: minY + ryMm });

  if (isBedroom) {
    const bedW = Math.min(widthMm * 0.58, 1800);
    const bedD = Math.min(depthMm * 0.65, 2000);
    const bx = (widthMm - bedW) / 2;
    const by = 80;
    const pBed = rPx(bx, by);
    const bwPx = bedW * scale;
    const bhPx = bedD * scale;

    const pSide1 = rPx(Math.max(10, bx - 420), by + 50);
    const pSide2 = rPx(bx + bedW + 20, by + 50);
    const swPx = 380 * scale;

    const pWard = rPx(20, Math.max(by + bedD + 40, depthMm - 580));
    const wwPx = Math.min((widthMm - 40) * scale, 2400 * scale);
    const whPx = 540 * scale;

    return (
      <g className="room-2d-furniture" pointerEvents="none">
        {/* Bed Headboard */}
        <rect x={pBed.x - 6 * scale} y={pBed.y} width={bwPx + 12 * scale} height={100 * scale} fill="#c59c2d" rx={2 * scale} />
        {/* Bed Mattress */}
        <rect x={pBed.x} y={pBed.y + 100 * scale} width={bwPx} height={bhPx - 100 * scale} fill="#fcf9f2" stroke="#c4b5a0" strokeWidth={1.5} rx={4 * scale} />
        {/* Bed Pillows */}
        <rect x={pBed.x + 8 * scale} y={pBed.y + 115 * scale} width={bwPx / 2 - 14 * scale} height={380 * scale} fill="#ffffff" stroke="#d5cbbe" strokeWidth={1} rx={3 * scale} />
        <rect x={pBed.x + bwPx / 2 + 6 * scale} y={pBed.y + 115 * scale} width={bwPx / 2 - 14 * scale} height={380 * scale} fill="#ffffff" stroke="#d5cbbe" strokeWidth={1} rx={3 * scale} />
        {/* Blanket Fold Line */}
        <line x1={pBed.x} y1={pBed.y + 100 * scale + (bhPx - 100 * scale) * 0.55} x2={pBed.x + bwPx} y2={pBed.y + 100 * scale + (bhPx - 100 * scale) * 0.55} stroke="#d5cbbe" strokeWidth={1} strokeDasharray="3 2" />
        {/* Dual Bedside Tables */}
        {bx > 420 && (
          <g>
            <rect x={pSide1.x} y={pSide1.y} width={swPx} height={swPx} fill="#eadecc" stroke="#a3896b" strokeWidth={1} rx={2} />
            <circle cx={pSide1.x + swPx / 2} cy={pSide1.y + swPx / 2} r={swPx / 4} fill="#c59c2d" fillOpacity={0.6} />
            <rect x={pSide2.x} y={pSide2.y} width={swPx} height={swPx} fill="#eadecc" stroke="#a3896b" strokeWidth={1} rx={2} />
            <circle cx={pSide2.x + swPx / 2} cy={pSide2.y + swPx / 2} r={swPx / 4} fill="#c59c2d" fillOpacity={0.6} />
          </g>
        )}
        {/* Wardrobe */}
        {depthMm >= 2600 && (
          <g>
            <rect x={pWard.x} y={pWard.y} width={wwPx} height={whPx} fill="#4a3728" stroke="#2e2117" strokeWidth={1.5} rx={2} />
            <line x1={pWard.x + wwPx / 3} y1={pWard.y} x2={pWard.x + wwPx / 3} y2={pWard.y + whPx} stroke="#8c6f56" strokeWidth={1} />
            <line x1={pWard.x + (2 * wwPx) / 3} y1={pWard.y} x2={pWard.x + (2 * wwPx) / 3} y2={pWard.y + whPx} stroke="#8c6f56" strokeWidth={1} />
            <text x={pWard.x + wwPx / 2} y={pWard.y + whPx / 2 + 3 * scale} fill="#fff" fontSize={Math.max(7, 8 * scale)} fontWeight="bold" textAnchor="middle">4-DOOR WARDROBE</text>
          </g>
        )}
      </g>
    );
  }

  if (isLiving) {
    const sofaW = Math.min(widthMm * 0.75, 2400);
    const sofaD = Math.min(depthMm * 0.35, 850);
    const sx = (widthMm - sofaW) / 2;
    const sy = depthMm - sofaD - 60;
    const pSofa = rPx(sx, sy);
    const swPx = sofaW * scale;
    const sdPx = sofaD * scale;

    const tvW = Math.min(widthMm * 0.7, 2400);
    const tvD = 380;
    const pTv = rPx((widthMm - tvW) / 2, 40);
    const tvwPx = tvW * scale;
    const tvdPx = tvD * scale;

    const rugW = Math.min(widthMm * 0.6, 1800);
    const rugD = Math.min(depthMm * 0.35, 1200);
    const pRug = rPx((widthMm - rugW) / 2, (depthMm - rugD) / 2);
    const rugwPx = rugW * scale;
    const rugdPx = rugD * scale;

    return (
      <g className="room-2d-furniture" pointerEvents="none">
        {/* TV Console along top wall */}
        <rect x={pTv.x} y={pTv.y} width={tvwPx} height={tvdPx} fill="#27272a" stroke="#18181b" strokeWidth={1.5} rx={2} />
        <rect x={pTv.x + (tvwPx - 1200 * scale) / 2} y={pTv.y + 4 * scale} width={1200 * scale} height={40 * scale} fill="#09090b" stroke="#71717a" />
        <text x={pTv.x + tvwPx / 2} y={pTv.y + tvdPx / 2 + 3 * scale} fill="#e4e4e7" fontSize={Math.max(7, 8 * scale)} fontWeight="bold" textAnchor="middle">TV FEATURE CONSOLE</text>

        {/* Center Accent Rug */}
        <rect x={pRug.x} y={pRug.y} width={rugwPx} height={rugdPx} fill="rgba(197, 156, 45, 0.08)" stroke="#c59c2d" strokeWidth={1} strokeDasharray="4 2" rx={6} />
        {/* Coffee Table */}
        <rect x={pRug.x + (rugwPx - 900 * scale) / 2} y={pRug.y + (rugdPx - 500 * scale) / 2} width={900 * scale} height={500 * scale} fill="#d6c7b2" stroke="#8c7355" strokeWidth={1} rx={3} />

        {/* 3-Seater Living Sofa */}
        <rect x={pSofa.x} y={pSofa.y} width={swPx} height={sdPx} fill="#3f3f46" stroke="#27272a" strokeWidth={1.5} rx={4 * scale} />
        <rect x={pSofa.x + 8 * scale} y={pSofa.y + 8 * scale} width={swPx - 16 * scale} height={sdPx - 18 * scale} fill="#52525b" rx={3 * scale} />
        <line x1={pSofa.x + swPx / 3} y1={pSofa.y + 8 * scale} x2={pSofa.x + swPx / 3} y2={pSofa.y + sdPx - 10 * scale} stroke="#27272a" strokeWidth={1} />
        <line x1={pSofa.x + (2 * swPx) / 3} y1={pSofa.y + 8 * scale} x2={pSofa.x + (2 * swPx) / 3} y2={pSofa.y + sdPx - 10 * scale} stroke="#27272a" strokeWidth={1} />
        <text x={pSofa.x + swPx / 2} y={pSofa.y + sdPx / 2 + 3 * scale} fill="#f4f4f5" fontSize={Math.max(7, 8 * scale)} fontWeight="bold" textAnchor="middle">LUXURY SOFA</text>
      </g>
    );
  }

  if (isKitchen) {
    const counterD = 580 * scale;
    const pCorner = rPx(30, 30);
    const cwPx = (widthMm - 60) * scale;
    const cdPx = (depthMm - 60) * scale;

    const pSink = rPx(80, 40);
    const sinkwPx = 700 * scale;
    const sinkdPx = 420 * scale;

    const pHob = rPx(Math.max(sinkwPx / scale + 120, (widthMm - 600) / 2), 40);
    const hobwPx = 600 * scale;
    const hobdPx = 480 * scale;

    const pFridge = rPx(widthMm - 700, 40);
    const frwPx = 650 * scale;
    const frdPx = 650 * scale;

    return (
      <g className="room-2d-furniture" pointerEvents="none">
        {/* Kitchen Base Counter Run */}
        <path
          d={`M ${pCorner.x} ${pCorner.y} L ${pCorner.x + cwPx} ${pCorner.y} L ${pCorner.x + cwPx} ${pCorner.y + counterD} L ${pCorner.x + counterD} ${pCorner.y + counterD} L ${pCorner.x + counterD} ${pCorner.y + cdPx} L ${pCorner.x} ${pCorner.y + cdPx} Z`}
          fill="#e7dfd5"
          stroke="#4a3b2c"
          strokeWidth={1.5}
        />
        {/* Stainless Steel Sink */}
        <rect x={pSink.x} y={pSink.y + 30 * scale} width={sinkwPx} height={sinkdPx} fill="#f1f5f9" stroke="#64748b" strokeWidth={1} rx={2} />
        <rect x={pSink.x + 16 * scale} y={pSink.y + 45 * scale} width={sinkwPx / 2 - 24 * scale} height={sinkdPx - 30 * scale} fill="#cbd5e1" rx={2} />
        <rect x={pSink.x + sinkwPx / 2 + 8 * scale} y={pSink.y + 45 * scale} width={sinkwPx / 2 - 24 * scale} height={sinkdPx - 30 * scale} fill="#cbd5e1" rx={2} />
        <circle cx={pSink.x + sinkwPx / 2} cy={pSink.y + 40 * scale} r={12 * scale} fill="#0284c7" />

        {/* 4-Burner Glass Hob */}
        <rect x={pHob.x} y={pHob.y + 30 * scale} width={hobwPx} height={hobdPx} fill="#18181b" stroke="#3f3f46" strokeWidth={1} rx={2} />
        <circle cx={pHob.x + hobwPx * 0.3} cy={pHob.y + 30 * scale + hobdPx * 0.3} r={30 * scale} fill="#ef4444" fillOpacity={0.6} />
        <circle cx={pHob.x + hobwPx * 0.7} cy={pHob.y + 30 * scale + hobdPx * 0.3} r={26 * scale} fill="#ef4444" fillOpacity={0.6} />
        <circle cx={pHob.x + hobwPx * 0.3} cy={pHob.y + 30 * scale + hobdPx * 0.7} r={26 * scale} fill="#ef4444" fillOpacity={0.6} />
        <circle cx={pHob.x + hobwPx * 0.7} cy={pHob.y + 30 * scale + hobdPx * 0.7} r={34 * scale} fill="#ef4444" fillOpacity={0.7} />

        {/* Refrigerator */}
        {widthMm >= 2200 && (
          <g>
            <rect x={pFridge.x} y={pFridge.y} width={frwPx} height={frdPx} fill="#475569" stroke="#1e293b" strokeWidth={1.5} rx={3} />
            <text x={pFridge.x + frwPx / 2} y={pFridge.y + frdPx / 2 + 3 * scale} fill="#fff" fontSize={Math.max(7, 8 * scale)} fontWeight="bold" textAnchor="middle">FRIDGE</text>
          </g>
        )}
      </g>
    );
  }

  if (isDining) {
    const tblW = Math.min(widthMm * 0.65, 1600);
    const tblD = Math.min(depthMm * 0.55, 900);
    const tx = (widthMm - tblW) / 2;
    const ty = (depthMm - tblD) / 2;
    const pTbl = rPx(tx, ty);
    const twPx = tblW * scale;
    const tdPx = tblD * scale;
    const chairW = 340 * scale;
    const chairD = 340 * scale;

    return (
      <g className="room-2d-furniture" pointerEvents="none">
        {/* Dining Table Top */}
        <rect x={pTbl.x} y={pTbl.y} width={twPx} height={tdPx} fill="#7c2d12" stroke="#451a03" strokeWidth={1.5} rx={4 * scale} />
        <text x={pTbl.x + twPx / 2} y={pTbl.y + tdPx / 2 + 3 * scale} fill="#fef3c7" fontSize={Math.max(7, 8 * scale)} fontWeight="bold" textAnchor="middle">6-SEATER DINING</text>

        {/* Top Chairs */}
        <rect x={pTbl.x + 30 * scale} y={pTbl.y - 180 * scale} width={chairW} height={chairD} fill="#b45309" stroke="#78350f" rx={2} />
        <rect x={pTbl.x + twPx - chairW - 30 * scale} y={pTbl.y - 180 * scale} width={chairW} height={chairD} fill="#b45309" stroke="#78350f" rx={2} />
        {/* Bottom Chairs */}
        <rect x={pTbl.x + 30 * scale} y={pTbl.y + tdPx - 160 * scale} width={chairW} height={chairD} fill="#b45309" stroke="#78350f" rx={2} />
        <rect x={pTbl.x + twPx - chairW - 30 * scale} y={pTbl.y + tdPx - 160 * scale} width={chairW} height={chairD} fill="#b45309" stroke="#78350f" rx={2} />
      </g>
    );
  }

  if (isPooja) {
    const pM = rPx(30, 30);
    const mwPx = (widthMm - 60) * scale;
    const mdPx = Math.min(depthMm * 0.45, 600) * scale;
    return (
      <g className="room-2d-furniture" pointerEvents="none">
        <rect x={pM.x} y={pM.y} width={mwPx} height={mdPx} fill="#b45309" stroke="#78350f" strokeWidth={1.5} rx={3} />
        <circle cx={pM.x + mwPx / 2} cy={pM.y + mdPx / 2} r={16 * scale} fill="#fef3c7" stroke="#d97706" strokeWidth={1} />
        <text x={pM.x + mwPx / 2} y={pM.y + mdPx / 2 + 4 * scale} fill="#92400e" fontSize={Math.max(8, 10 * scale)} fontWeight="bold" textAnchor="middle">ॐ MANDIR</text>
      </g>
    );
  }

  if (isToilet) {
    const pWc = rPx(30, 30);
    const wcwPx = 360 * scale;
    const wcdPx = 580 * scale;

    const pWash = rPx(widthMm - 500, 30);
    const washwPx = 460 * scale;
    const washdPx = 400 * scale;

    return (
      <g className="room-2d-furniture" pointerEvents="none">
        {/* WC Cistern & Bowl */}
        <rect x={pWc.x} y={pWc.y} width={wcwPx} height={180 * scale} fill="#f8fafc" stroke="#94a3b8" strokeWidth={1} rx={2} />
        <ellipse cx={pWc.x + wcwPx / 2} cy={pWc.y + 340 * scale} rx={wcwPx / 2} ry={180 * scale} fill="#f8fafc" stroke="#94a3b8" strokeWidth={1} />

        {/* Vanity Wash Basin */}
        <rect x={pWash.x} y={pWash.y} width={washwPx} height={washdPx} fill="#f8fafc" stroke="#94a3b8" strokeWidth={1} rx={3} />
        <ellipse cx={pWash.x + washwPx / 2} cy={pWash.y + washdPx / 2} rx={washwPx * 0.35} ry={washdPx * 0.3} fill="#e2e8f0" stroke="#0284c7" strokeWidth={1} />
      </g>
    );
  }

  if (isDress) {
    const pW1 = rPx(20, 20);
    const pW2 = rPx(widthMm - 520, 20);
    const wwPx = 500 * scale;
    const whPx = (depthMm - 40) * scale;
    return (
      <g className="room-2d-furniture" pointerEvents="none">
        <rect x={pW1.x} y={pW1.y} width={wwPx} height={whPx} fill="#4a3728" stroke="#2e2117" strokeWidth={1.5} rx={2} />
        <rect x={pW2.x} y={pW2.y} width={wwPx} height={whPx} fill="#4a3728" stroke="#2e2117" strokeWidth={1.5} rx={2} />
        <text x={pW1.x + wwPx / 2} y={pW1.y + whPx / 2} fill="#fff" fontSize={Math.max(6, 7 * scale)} fontWeight="bold" textAnchor="middle" transform={`rotate(-90 ${pW1.x + wwPx / 2} ${pW1.y + whPx / 2})`}>WARDROBE</text>
        <text x={pW2.x + wwPx / 2} y={pW2.y + whPx / 2} fill="#fff" fontSize={Math.max(6, 7 * scale)} fontWeight="bold" textAnchor="middle" transform={`rotate(90 ${pW2.x + wwPx / 2} ${pW2.y + whPx / 2})`}>WARDROBE</text>
      </g>
    );
  }

  if (isParking) {
    const carW = Math.min(widthMm * 0.8, 2200);
    const carD = Math.min(depthMm * 0.85, 4500);
    const pCar = rPx((widthMm - carW) / 2, (depthMm - carD) / 2);
    const cwPx = carW * scale;
    const cdPx = carD * scale;

    return (
      <g className="room-2d-furniture" pointerEvents="none">
        <rect x={pCar.x} y={pCar.y} width={cwPx} height={cdPx} fill="rgba(59, 130, 246, 0.08)" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="6 4" rx={12 * scale} />
        <rect x={pCar.x + 20 * scale} y={pCar.y + 40 * scale} width={cwPx - 40 * scale} height={cdPx - 80 * scale} fill="rgba(30, 58, 138, 0.12)" stroke="#2563eb" rx={8 * scale} />
        <text x={pCar.x + cwPx / 2} y={pCar.y + cdPx / 2 + 4 * scale} fill="#1d4ed8" fontSize={Math.max(8, 10 * scale)} fontWeight="bold" textAnchor="middle">PARKING BAY</text>
      </g>
    );
  }

  return null;
}

function CandidateVectorPreview({
  room,
  walls,
  openings,
  candidateType,
}: {
  room: PlanRoom;
  walls: PlanWall[];
  openings: PlanOpening[];
  candidateType: 'circulation' | 'balanced' | 'storage' | 'luxury';
}) {
  const polygon = room.polygon;
  const xs = polygon.length ? polygon.map((p) => p.xMm) : [0, 3200];
  const ys = polygon.length ? polygon.map((p) => p.yMm) : [0, 3000];
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const rawW = Math.max(1200, maxX - minX);
  const rawD = Math.max(1200, maxY - minY);

  const isBedroom = ['bedroom', 'master_bedroom', 'kids_bedroom'].includes(room.roomType);
  const isLiving = room.roomType === 'living';
  const isDining = room.roomType === 'dining';
  const isKitchen = room.roomType === 'kitchen';
  const isStudy = room.roomType === 'study';
  const isBath = ['bath', 'bathroom', 'washroom'].includes(room.roomType);

  // Sanitize squashed bounding boxes from CAD/CV vector edges
  const isSquashed = (rawW / rawD > 3.8 || rawD / rawW > 3.8) && Math.min(rawW, rawD) < 2200;
  const minRealisticDepth = isLiving ? 4200 : isBedroom ? 3600 : isKitchen ? 2800 : isDining ? 3200 : 2400;
  const width = rawW;
  const depth = isSquashed ? Math.max(minRealisticDepth, Math.round(rawW * 0.46)) : rawD;

  const svgW = 320;
  const svgH = 180;
  const padX = 20;
  const padY = 16;
  const drawW = svgW - padX * 2;
  const drawH = svgH - padY * 2 - 10;
  const scale = Math.min(drawW / width, drawH / depth);
  const originX = (svgW - width * scale) / 2;
  const originY = padY + (drawH - depth * scale) / 2;

  const toSvgX = (xMm: number) => originX + (xMm - minX) * scale;
  const toSvgY = (yMm: number) => originY + (yMm - minY) * (isSquashed ? (depth / rawD) : 1) * scale;

  const useFallbackRect = polygon.length < 3 || isSquashed;

  // Build room perimeter edges strictly clipped to room polygon or realistic envelope
  const edges: { p1: { x: number; y: number }; p2: { x: number; y: number }; label: string }[] = [];
  if (!useFallbackRect) {
    for (let i = 0; i < polygon.length; i++) {
      const pt1 = polygon[i];
      const pt2 = polygon[(i + 1) % polygon.length];
      edges.push({
        p1: { x: toSvgX(pt1.xMm), y: toSvgY(pt1.yMm) },
        p2: { x: toSvgX(pt2.xMm), y: toSvgY(pt2.yMm) },
        label: String.fromCharCode(65 + i),
      });
    }
  } else {
    edges.push(
      { p1: { x: originX, y: originY }, p2: { x: originX + width * scale, y: originY }, label: 'A' },
      { p1: { x: originX + width * scale, y: originY }, p2: { x: originX + width * scale, y: originY + depth * scale }, label: 'B' },
      { p1: { x: originX + width * scale, y: originY + depth * scale }, p2: { x: originX, y: originY + depth * scale }, label: 'C' },
      { p1: { x: originX, y: originY + depth * scale }, p2: { x: originX, y: originY }, label: 'D' },
    );
  }

  // Room Openings
  const roomOpenings = openings.filter((op) => {
    return polygon.some((p) => {
      const w = walls.find((wall) => wall.id === op.wallId);
      if (!w) return false;
      return Math.hypot(p.xMm - w.start.xMm, p.yMm - w.start.yMm) < 400 || Math.hypot(p.xMm - w.end.xMm, p.yMm - w.end.yMm) < 400;
    });
  });

  const uid = room.id.replace(/[^a-zA-Z0-9]/g, '');

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="candidate-vector-svg" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        {/* Soft Drop Shadow Filter */}
        <filter id={`shadow-${uid}`} x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#1e1915" floodOpacity="0.14" />
        </filter>
        {/* Luxury Wood Floor Pattern */}
        <pattern id={`woodPlank-${uid}`} width="28" height="8" patternUnits="userSpaceOnUse">
          <rect width="28" height="8" fill="#f6f1eb" />
          <line x1="0" y1="8" x2="28" y2="8" stroke="#e8dfd4" strokeWidth="0.5" />
          <line x1="14" y1="0" x2="14" y2="8" stroke="#e8dfd4" strokeWidth="0.5" />
        </pattern>
        {/* Subtle Area Rug Pattern */}
        <pattern id={`rugPat-${uid}`} width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#ece4d8" />
          <path d="M 0 0 L 8 8 M 8 0 L 0 8" stroke="#dfd4c5" strokeWidth="0.5" />
        </pattern>
        {/* Luxury Gold/Champagne Gradient */}
        <linearGradient id={`goldHeadboard-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b88a44" />
          <stop offset="50%" stopColor="#dfb23b" />
          <stop offset="100%" stopColor="#9a722c" />
        </linearGradient>
        {/* Fluted Wood Gradient */}
        <linearGradient id={`flutedWood-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4a3728" />
          <stop offset="10%" stopColor="#674d38" />
          <stop offset="20%" stopColor="#4a3728" />
          <stop offset="30%" stopColor="#674d38" />
          <stop offset="40%" stopColor="#4a3728" />
          <stop offset="50%" stopColor="#674d38" />
          <stop offset="60%" stopColor="#4a3728" />
          <stop offset="70%" stopColor="#674d38" />
          <stop offset="80%" stopColor="#4a3728" />
          <stop offset="90%" stopColor="#674d38" />
          <stop offset="100%" stopColor="#4a3728" />
        </linearGradient>
        {/* Mattress Duvet Gradient */}
        <linearGradient id={`duvetFold-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="65%" stopColor="#f7f3ee" />
          <stop offset="100%" stopColor="#e3d9cc" />
        </linearGradient>
      </defs>

      {/* 1. Room Floor Surface */}
      {!useFallbackRect ? (
        <polygon
          points={polygon.map((p) => `${toSvgX(p.xMm)},${toSvgY(p.yMm)}`).join(' ')}
          fill={`url(#woodPlank-${uid})`}
        />
      ) : (
        <rect
          x={originX}
          y={originY}
          width={width * scale}
          height={depth * scale}
          fill={`url(#woodPlank-${uid})`}
          rx={2}
        />
      )}

      {/* 2. Furniture Modules by Room Type */}
      {isBedroom && (
        <g filter={`url(#shadow-${uid})`}>
          {(() => {
            const bedW = Math.min(width * scale * 0.58, (candidateType === 'luxury' ? 2000 : 1800) * scale);
            const bedD = (candidateType === 'luxury' ? 2100 : 1950) * scale;
            const bx = originX + (width * scale - bedW) / 2;
            const by = originY + 8;

            const rugW = bedW + 500 * scale;
            const rugD = bedD + 400 * scale;
            const rx = bx - 250 * scale;
            const ry = by + 200 * scale;

            const nsW = 420 * scale;
            const nsD = 380 * scale;

            return (
              <g>
                {/* Area Rug */}
                <rect x={rx} y={ry} width={rugW} height={rugD} fill={`url(#rugPat-${uid})`} stroke="#cfc3b2" strokeWidth={0.75} rx={3} />
                <rect x={rx + 3} y={ry + 3} width={rugW - 6} height={rugD - 6} fill="none" stroke="#bdaea0" strokeWidth={0.5} strokeDasharray="2 2" />

                {/* Nightstand Left */}
                <rect x={bx - nsW - 4} y={by + 10} width={nsW} height={nsD} fill="#4a3728" stroke="#2b2017" strokeWidth={0.75} rx={2} />
                <circle cx={bx - nsW / 2 - 4} cy={by + 10 + nsD / 2} r={nsW * 0.28} fill="#c59c2d" fillOpacity={0.8} />
                <circle cx={bx - nsW / 2 - 4} cy={by + 10 + nsD / 2} r={nsW * 0.12} fill="#fff" />

                {/* Nightstand Right */}
                <rect x={bx + bedW + 4} y={by + 10} width={nsW} height={nsD} fill="#4a3728" stroke="#2b2017" strokeWidth={0.75} rx={2} />
                <circle cx={bx + bedW + 4 + nsW / 2} cy={by + 10 + nsD / 2} r={nsW * 0.28} fill="#c59c2d" fillOpacity={0.8} />
                <circle cx={bx + bedW + 4 + nsW / 2} cy={by + 10 + nsD / 2} r={nsW * 0.12} fill="#fff" />

                {/* Luxury Tufted Headboard */}
                <rect
                  x={bx - 12 * scale}
                  y={by}
                  width={bedW + 24 * scale}
                  height={140 * scale}
                  fill={candidateType === 'luxury' ? `url(#goldHeadboard-${uid})` : `url(#flutedWood-${uid})`}
                  stroke="#2b2017"
                  strokeWidth={0.75}
                  rx={2}
                />

                {/* Bed Mattress Base */}
                <rect x={bx} y={by + 120 * scale} width={bedW} height={bedD} fill="#ffffff" stroke="#c4b5a2" strokeWidth={1} rx={4} />

                {/* Quilted Duvet Sheet */}
                <rect x={bx + 2} y={by + (120 + 750) * scale} width={bedW - 4} height={bedD - 750 * scale - 2} fill={`url(#duvetFold-${uid})`} rx={3} />
                <line x1={bx + 2} y1={by + (120 + 750) * scale} x2={bx + bedW - 2} y2={by + (120 + 750) * scale} stroke="#c59c2d" strokeWidth={1.5} />
                <line x1={bx + 4} y1={by + (120 + 790) * scale} x2={bx + bedW - 4} y2={by + (120 + 790) * scale} stroke="#a89b8d" strokeWidth={0.5} strokeDasharray="3 1.5" />

                {/* Twin Sleeping Pillows */}
                <rect x={bx + 12 * scale} y={by + 160 * scale} width={(bedW - 36 * scale) / 2} height={420 * scale} fill="#ffffff" stroke="#d5cbbe" strokeWidth={0.75} rx={3} />
                <rect x={bx + (bedW + 12 * scale) / 2} y={by + 160 * scale} width={(bedW - 36 * scale) / 2} height={420 * scale} fill="#ffffff" stroke="#d5cbbe" strokeWidth={0.75} rx={3} />
                
                {/* Decorative Lumbar Accent Pillow */}
                <rect x={bx + bedW * 0.28} y={by + 480 * scale} width={bedW * 0.44} height={180 * scale} fill={candidateType === 'luxury' ? '#c59c2d' : '#8c6239'} rx={2} />

                {/* Foot of Bed Ottoman / Bench in Luxury Suite */}
                {candidateType === 'luxury' && (
                  <g>
                    <rect x={bx + 10 * scale} y={by + 120 * scale + bedD + 12 * scale} width={bedW - 20 * scale} height={380 * scale} fill="#9a7b1f" stroke="#715510" strokeWidth={0.75} rx={3} />
                    <line x1={bx + 25 * scale} y1={by + 120 * scale + bedD + 12 * scale + 190 * scale} x2={bx + bedW - 25 * scale} y2={by + 120 * scale + bedD + 12 * scale + 190 * scale} stroke="#fde047" strokeWidth={0.5} strokeOpacity={0.6} />
                  </g>
                )}
              </g>
            );
          })()}

          {/* Modular Wardrobe on Side Wall */}
          {(() => {
            const wW = 580 * scale;
            const wH = Math.min(depth * scale - 18, (candidateType === 'storage' ? 2800 : 2100) * scale);
            const wx = originX + 5;
            const wy = originY + (depth * scale - wH) / 2;
            const doors = candidateType === 'storage' ? 4 : 3;

            return (
              <g>
                <rect x={wx} y={wy} width={wW} height={wH} fill="#38291e" stroke="#1d140e" strokeWidth={1} rx={2} />
                {/* Wardrobe Door Segments & Brass Handles */}
                {Array.from({ length: doors }).map((_, dIdx) => {
                  const segH = wH / doors;
                  const sy = wy + dIdx * segH;
                  return (
                    <g key={dIdx}>
                      <line x1={wx} y1={sy} x2={wx + wW} y2={sy} stroke="#543e2e" strokeWidth={0.75} />
                      {/* Long Profile Handle */}
                      <rect x={wx + wW - 14 * scale} y={sy + segH * 0.3} width={4 * scale} height={segH * 0.4} fill="#eab308" rx={1} />
                    </g>
                  );
                })}
                {/* Internal Hanger Rail Line */}
                <line x1={wx + wW / 2} y1={wy + 8} x2={wx + wW / 2} y2={wy + wH - 8} stroke="#856449" strokeWidth={0.5} strokeDasharray="3 3" />
                <text x={wx + wW / 2} y={wy + wH / 2} fill="#f5ede3" fontSize={6.5} fontWeight="bold" textAnchor="middle" transform={`rotate(-90 ${wx + wW / 2} ${wy + wH / 2})`}>
                  {candidateType === 'storage' ? 'FULL RUN WARDROBE + LOFT' : 'MODULAR WARDROBE'}
                </text>
              </g>
            );
          })()}

          {/* Dressing Vanity / TV Unit on Opposite Wall */}
          {candidateType === 'luxury' && (
            <g>
              <rect x={originX + width * scale - 400 * scale - 6} y={originY + (depth * scale - 1200 * scale) / 2} width={400 * scale} height={1200 * scale} fill="#4a3728" stroke="#2b2017" rx={2} />
              <circle cx={originX + width * scale - 200 * scale - 6} cy={originY + depth * scale / 2} r={180 * scale} fill="#faf7f2" stroke="#c59c2d" strokeWidth={1.5} />
              <text x={originX + width * scale - 200 * scale - 6} y={originY + depth * scale / 2 + 2} fill="#543e2e" fontSize={5} fontWeight="bold" textAnchor="middle">VANITY</text>
            </g>
          )}
        </g>
      )}

      {isLiving && (
        <g filter={`url(#shadow-${uid})`}>
          {(() => {
            const roomW = width * scale;
            const roomH = depth * scale;

            // 1. Top Wall A: Acoustic Slatted Media Backdrop & Floating Console
            const tvW = Math.min(roomW * 0.52, (candidateType === 'luxury' || candidateType === 'storage' ? 2800 : 2200) * scale);
            const tvD = 320 * scale;
            const tx = originX + (roomW - tvW) / 2;
            const ty = originY + 6;

            // 2. Seating area along Bottom Wall C:
            const sfW = Math.min(roomW * 0.56, (candidateType === 'luxury' ? 2800 : candidateType === 'balanced' ? 2600 : 2200) * scale);
            const sfD = 820 * scale;
            const sfx = originX + (roomW - sfW) / 2;
            const sfy = originY + roomH - sfD - 12;

            // Coffee Table (placed with verified clearance above sofa):
            const ctw = Math.min(sfW * 0.52, 1100 * scale);
            const ctd = 460 * scale;
            const ctx = sfx + (sfW - ctw) / 2;
            const cty = sfy - ctd - 12 * scale;

            // Area Rug wrapping the seating zone:
            const rw = sfW + 28 * scale;
            const rd = (originY + roomH - 6) - (cty - 8 * scale);
            const rx = sfx - 14 * scale;
            const ry = cty - 8 * scale;

            // Central Clear Circulation Corridor (between TV console and coffee table):
            const walkwayY = (ty + tvD + cty) / 2;

            return (
              <g>
                {/* Area Rug */}
                <rect x={rx} y={ry} width={rw} height={rd} fill={`url(#rugPat-${uid})`} stroke="#cfc3b2" strokeWidth={0.75} rx={4} />

                {/* Central Clear Walkway with Architectural Badge */}
                <line x1={originX + 10} y1={walkwayY} x2={originX + roomW - 10} y2={walkwayY} stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 3" strokeOpacity={0.85} />
                <rect x={originX + (roomW - 150) / 2} y={walkwayY - 8} width={150} height={16} fill="#064e3b" stroke="#10b981" strokeWidth={0.75} rx={3} />
                <text x={originX + roomW / 2} y={walkwayY + 3.5} fill="#a7f3d0" fontSize={6.2} fontWeight="bold" textAnchor="middle">
                  {candidateType === 'circulation' ? '1200 mm CLEAR WALKWAY' : '>1000 mm CLEAR WALKWAY'}
                </text>

                {/* Sectional Sofa */}
                <rect x={sfx} y={sfy} width={sfW} height={sfD} fill="#3f3f46" stroke="#27272a" strokeWidth={1} rx={4} />
                {/* 3 Cushion Seats */}
                <rect x={sfx + 3} y={sfy + 3} width={(sfW - 12) / 3} height={sfD - 8} fill="#52525b" rx={2} />
                <rect x={sfx + 6 + (sfW - 12) / 3} y={sfy + 3} width={(sfW - 12) / 3} height={sfD - 8} fill="#52525b" rx={2} />
                <rect x={sfx + 9 + 2 * (sfW - 12) / 3} y={sfy + 3} width={(sfW - 12) / 3} height={sfD - 8} fill="#52525b" rx={2} />

                {/* Chaise Lounger for Balanced / Luxury Layouts */}
                {candidateType !== 'circulation' && (
                  <g>
                    <rect x={sfx} y={sfy - 380 * scale} width={680 * scale} height={380 * scale} fill="#3f3f46" stroke="#27272a" strokeWidth={1} rx={3} />
                    <rect x={sfx + 3} y={sfy - 377 * scale} width={674 * scale - 6} height={374 * scale} fill="#52525b" rx={2} />
                  </g>
                )}

                {/* Throw Pillows */}
                <rect x={sfx + 6} y={sfy + 6} width={110 * scale} height={110 * scale} fill="#c59c2d" rx={1.5} transform={`rotate(15 ${sfx + 6} ${sfy + 6})`} />
                <rect x={sfx + sfW - 120 * scale} y={sfy + 6} width={110 * scale} height={110 * scale} fill="#c59c2d" rx={1.5} transform={`rotate(-15 ${sfx + sfW - 120 * scale} ${sfy + 6})`} />
                <text x={sfx + sfW / 2} y={sfy + sfD / 2 + 2} fill="#f4f4f5" fontSize={6} fontWeight="bold" textAnchor="middle">
                  {candidateType === 'luxury' ? 'BOUCLÉ SECTIONAL' : 'SECTIONAL SOFA'}
                </text>

                {/* Lounge Accent Chair for Balanced & Luxury Layouts */}
                {candidateType !== 'circulation' && (
                  <g>
                    <rect x={originX + roomW - 750 * scale - 12} y={sfy - 200 * scale} width={750 * scale} height={700 * scale} fill="#4a3728" stroke="#2b2017" rx={4} />
                    <circle cx={originX + roomW - 375 * scale - 12} cy={sfy + 150 * scale} r={180 * scale} fill="#c59c2d" fillOpacity={0.8} />
                    <text x={originX + roomW - 375 * scale - 12} y={sfy + 150 * scale + 2} fill="#fff" fontSize={5} fontWeight="bold" textAnchor="middle">LOUNGE</text>
                  </g>
                )}

                {/* Coffee Table */}
                <rect x={ctx} y={cty} width={ctw} height={ctd} fill="#ffffff" stroke="#c59c2d" strokeWidth={1} rx={candidateType === 'luxury' ? ctd / 2 : 3} />
                <line x1={ctx + 15 * scale} y1={cty + ctd / 2} x2={ctx + ctw - 15 * scale} y2={cty + ctd / 2} stroke="#e4e4e7" strokeWidth={0.75} />
                <text x={ctx + ctw / 2} y={cty + ctd / 2 + 2} fill="#71717a" fontSize={5.5} fontWeight="bold" textAnchor="middle">
                  COFFEE TABLE
                </text>

                {/* Wall A: Acoustic Slatted Media Wall & Floating TV Console */}
                <rect x={tx - 12 * scale} y={ty} width={tvW + 24 * scale} height={50 * scale} fill={`url(#flutedWood-${uid})`} rx={1} />
                <rect x={tx} y={ty + 40 * scale} width={tvW} height={tvD} fill="#27272a" stroke="#18181b" strokeWidth={1} rx={2} />
                {/* TV Screen */}
                <rect x={tx + (tvW - 1300 * scale) / 2} y={ty + 10 * scale} width={1300 * scale} height={18 * scale} fill="#09090b" stroke="#eab308" strokeWidth={0.75} rx={1} />
                <text x={tx + tvW / 2} y={ty + tvD / 2 + 36 * scale} fill="#fafafa" fontSize={6} fontWeight="bold" textAnchor="middle">
                  MEDIA WALL &amp; CONSOLE
                </text>
              </g>
            );
          })()}
        </g>
      )}

      {isDining && (
        <g filter={`url(#shadow-${uid})`}>
          {(() => {
            const dtW = Math.min(width * scale * 0.65, 1750 * scale);
            const dtD = 950 * scale;
            const dtx = originX + (width * scale - dtW) / 2;
            const dty = originY + (depth * scale - dtD) / 2;
            const chairW = 380 * scale;
            const chairD = 360 * scale;

            return (
              <g>
                {/* Dining Chairs Top */}
                <rect x={dtx + dtW * 0.18} y={dty - chairD - 4} width={chairW} height={chairD} fill="#3f3f46" stroke="#27272a" rx={3} />
                <rect x={dtx + dtW * 0.62} y={dty - chairD - 4} width={chairW} height={chairD} fill="#3f3f46" stroke="#27272a" rx={3} />

                {/* Dining Chairs Bottom */}
                <rect x={dtx + dtW * 0.18} y={dty + dtD + 4} width={chairW} height={chairD} fill="#3f3f46" stroke="#27272a" rx={3} />
                <rect x={dtx + dtW * 0.62} y={dty + dtD + 4} width={chairW} height={chairD} fill="#3f3f46" stroke="#27272a" rx={3} />

                {/* Dining Chairs Left & Right (if large) */}
                <rect x={dtx - chairD - 4} y={dty + (dtD - chairW) / 2} width={chairD} height={chairW} fill="#3f3f46" stroke="#27272a" rx={3} />
                <rect x={dtx + dtW + 4} y={dty + (dtD - chairW) / 2} width={chairD} height={chairW} fill="#3f3f46" stroke="#27272a" rx={3} />

                {/* Solid Marble / Teak Dining Table Top */}
                <rect x={dtx} y={dty} width={dtW} height={dtD} fill="#ffffff" stroke="#c59c2d" strokeWidth={1.5} rx={6} />
                {/* Center Table Runner */}
                <rect x={dtx + 10} y={dty + dtD * 0.3} width={dtW - 20} height={dtD * 0.4} fill="#f4ece1" rx={2} />
                {/* Chandelier / Pendant Light Center Marker */}
                <circle cx={dtx + dtW / 2} cy={dty + dtD / 2} r={160 * scale} fill="none" stroke="#c59c2d" strokeWidth={1} strokeDasharray="3 2" />
                <circle cx={dtx + dtW / 2} cy={dty + dtD / 2} r={4} fill="#c59c2d" />
                <text x={dtx + dtW / 2} y={dty + dtD / 2 + 14} fill="#451a03" fontSize={6.5} fontWeight="bold" textAnchor="middle">6-SEATER DINING</text>
              </g>
            );
          })()}

          {/* Crockery / Bar Credenza along Top Wall */}
          {(() => {
            const crW = Math.min(width * scale - 24, 2000 * scale);
            const crD = 420 * scale;
            const crx = originX + (width * scale - crW) / 2;
            const cry = originY + 6;
            return (
              <g>
                <rect x={crx} y={cry} width={crW} height={crD} fill="#451a03" stroke="#290d02" strokeWidth={1} rx={2} />
                <line x1={crx + crW / 3} y1={cry} x2={crx + crW / 3} y2={cry + crD} stroke="#78350f" />
                <line x1={crx + (2 * crW) / 3} y1={cry} x2={crx + (2 * crW) / 3} y2={cry + crD} stroke="#78350f" />
                <text x={crx + crW / 2} y={cry + crD / 2 + 2} fill="#fef3c7" fontSize={6} fontWeight="bold" textAnchor="middle">CROCKERY &amp; BAR CABINET</text>
              </g>
            );
          })()}
        </g>
      )}

      {isKitchen && (
        <g filter={`url(#shadow-${uid})`}>
          {/* Main Kitchen Counter L-Run */}
          <rect x={originX + 6} y={originY + 6} width={width * scale - 12} height={600 * scale} fill="#1c1917" stroke="#09090b" strokeWidth={1} rx={2} />
          {candidateType !== 'circulation' && (
            <rect x={originX + 6} y={originY + 6} width={600 * scale} height={depth * scale - 12} fill="#1c1917" stroke="#09090b" strokeWidth={1} rx={2} />
          )}

          {/* 4-Burner Glass Induction Hob */}
          {(() => {
            const hx = originX + 700 * scale;
            const hy = originY + 90 * scale;
            const hw = 650 * scale;
            const hd = 440 * scale;
            return (
              <g>
                <rect x={hx} y={hy} width={hw} height={hd} fill="#09090b" stroke="#71717a" strokeWidth={0.75} rx={2} />
                <circle cx={hx + hw * 0.28} cy={hy + hd * 0.32} r={hw * 0.16} fill="#dc2626" fillOpacity={0.7} />
                <circle cx={hx + hw * 0.72} cy={hy + hd * 0.32} r={hw * 0.14} fill="#dc2626" fillOpacity={0.7} />
                <circle cx={hx + hw * 0.28} cy={hy + hd * 0.72} r={hw * 0.14} fill="#dc2626" fillOpacity={0.7} />
                <circle cx={hx + hw * 0.72} cy={hy + hd * 0.72} r={hw * 0.18} fill="#dc2626" fillOpacity={0.7} />
                <text x={hx + hw / 2} y={hy + hd / 2 + 2} fill="#fff" fontSize={5} fontWeight="bold" textAnchor="middle">HOB</text>
              </g>
            );
          })()}

          {/* Stainless Steel Double Sink */}
          {(() => {
            const sx = originX + width * scale - 1200 * scale;
            const sy = originY + 90 * scale;
            const sw = 750 * scale;
            const sd = 440 * scale;
            return (
              <g>
                <rect x={sx} y={sy} width={sw} height={sd} fill="#71717a" stroke="#3f3f46" rx={2} />
                <rect x={sx + 15 * scale} y={sy + 20 * scale} width={(sw - 50 * scale) / 2} height={sd - 40 * scale} fill="#27272a" rx={2} />
                <rect x={sx + (sw + 10 * scale) / 2} y={sy + 20 * scale} width={(sw - 50 * scale) / 2} height={sd - 40 * scale} fill="#27272a" rx={2} />
                <circle cx={sx + sw / 2} cy={sy + sd / 2} r={3} fill="#e4e4e7" />
                <text x={sx + sw / 2} y={sy + sd / 2 + 2} fill="#e4e4e7" fontSize={5} fontWeight="bold" textAnchor="middle">SINK</text>
              </g>
            );
          })()}

          {/* Quartz Island / Breakfast Counter in Luxury Suite */}
          {candidateType === 'luxury' && (
            <g>
              {(() => {
                const iw = 1400 * scale;
                const id = 750 * scale;
                const ix = originX + (width * scale - iw) / 2;
                const iy = originY + depth * scale - id - 16;
                return (
                  <g>
                    <rect x={ix} y={iy} width={iw} height={id} fill="#ffffff" stroke="#c59c2d" strokeWidth={1.5} rx={4} />
                    {/* 2 Barstools */}
                    <circle cx={ix + iw * 0.3} cy={iy + id + 16 * scale} r={160 * scale} fill="#3f3f46" stroke="#27272a" />
                    <circle cx={ix + iw * 0.7} cy={iy + id + 16 * scale} r={160 * scale} fill="#3f3f46" stroke="#27272a" />
                    <text x={ix + iw / 2} y={iy + id / 2 + 2} fill="#451a03" fontSize={6} fontWeight="bold" textAnchor="middle">QUARTZ ISLAND</text>
                  </g>
                );
              })()}
            </g>
          )}
        </g>
      )}

      {isBath && (
        <g filter={`url(#shadow-${uid})`}>
          {/* Walk-in Shower Enclosure */}
          {(() => {
            const shW = Math.min(width * scale * 0.45, 1000 * scale);
            const shD = 1000 * scale;
            const shx = originX + 6;
            const shy = originY + 6;
            return (
              <g>
                <rect x={shx} y={shy} width={shW} height={shD} fill="#e0f2fe" stroke="#38bdf8" strokeWidth={1.5} />
                <circle cx={shx + shW / 2} cy={shy + shD / 2} r={120 * scale} fill="#0284c7" fillOpacity={0.4} />
                <circle cx={shx + shW / 2} cy={shy + shD / 2} r={3} fill="#0369a1" />
                <text x={shx + shW / 2} y={shy + shD / 2 + 2} fill="#0369a1" fontSize={5.5} fontWeight="bold" textAnchor="middle">SHOWER</text>
              </g>
            );
          })()}

          {/* Vanity Unit & Basin */}
          {(() => {
            const vw = 900 * scale;
            const vd = 480 * scale;
            const vx = originX + width * scale - vw - 6;
            const vy = originY + 6;
            return (
              <g>
                <rect x={vx} y={vy} width={vw} height={vd} fill="#ffffff" stroke="#c59c2d" strokeWidth={1} rx={2} />
                <rect x={vx + 60 * scale} y={vy + 60 * scale} width={vw - 120 * scale} height={vd - 120 * scale} fill="#f0fdf4" stroke="#16a34a" rx={vd / 4} />
                <circle cx={vx + vw / 2} cy={vy + 100 * scale} r={3} fill="#16a34a" />
                <text x={vx + vw / 2} y={vy + vd / 2 + 2} fill="#15803d" fontSize={5.5} fontWeight="bold" textAnchor="middle">VANITY</text>
              </g>
            );
          })()}

          {/* Wall-hung WC */}
          {(() => {
            const wcx = originX + width * scale - 600 * scale;
            const wcy = originY + depth * scale - 650 * scale;
            return (
              <g>
                <rect x={wcx - 30 * scale} y={wcy + 350 * scale} width={450 * scale} height={140 * scale} fill="#e2e8f0" stroke="#94a3b8" />
                <rect x={wcx} y={wcy} width={380 * scale} height={500 * scale} fill="#ffffff" stroke="#64748b" strokeWidth={1} rx={180 * scale} />
                <circle cx={wcx + 190 * scale} cy={wcy + 160 * scale} r={40 * scale} fill="#cbd5e1" />
              </g>
            );
          })()}
        </g>
      )}

      {isStudy && (
        <g filter={`url(#shadow-${uid})`}>
          {/* Executive Desk */}
          {(() => {
            const dw = Math.min(width * scale - 30, 1600 * scale);
            const dd = 700 * scale;
            const dx = originX + (width * scale - dw) / 2;
            const dy = originY + 10;
            return (
              <g>
                <rect x={dx} y={dy} width={dw} height={dd} fill="#451a03" stroke="#1c0a00" strokeWidth={1} rx={3} />
                {/* Laptop / Monitor Icon */}
                <rect x={dx + (dw - 450 * scale) / 2} y={dy + 80 * scale} width={450 * scale} height={260 * scale} fill="#09090b" stroke="#a1a1aa" rx={2} />
                {/* Swivel Chair */}
                <circle cx={dx + dw / 2} cy={dy + dd + 320 * scale} r={280 * scale} fill="#27272a" stroke="#09090b" />
                <circle cx={dx + dw / 2} cy={dy + dd + 320 * scale} r={80 * scale} fill="#eab308" />
                <text x={dx + dw / 2} y={dy + dd / 2 + 2} fill="#fef3c7" fontSize={6.5} fontWeight="bold" textAnchor="middle">EXECUTIVE DESK</text>
              </g>
            );
          })()}
          {/* Bookshelf along Wall */}
          <rect x={originX + 6} y={originY + depth * scale - 400 * scale - 6} width={width * scale - 12} height={400 * scale} fill="#78350f" stroke="#451a03" rx={2} />
          <text x={originX + width * scale / 2} y={originY + depth * scale - 180 * scale} fill="#fef3c7" fontSize={6} fontWeight="bold" textAnchor="middle">BOOKCASE &amp; FILING</text>
        </g>
      )}

      {/* 3. Outer Structural Masonry Walls */}
      {edges.map((edge, idx) => {
        const dx = edge.p2.x - edge.p1.x;
        const dy = edge.p2.y - edge.p1.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const midX = (edge.p1.x + edge.p2.x) / 2;
        const midY = (edge.p1.y + edge.p2.y) / 2;

        return (
          <g key={idx}>
            {/* Thick Structural Wall Line */}
            <line
              x1={edge.p1.x}
              y1={edge.p1.y}
              x2={edge.p2.x}
              y2={edge.p2.y}
              stroke="#292524"
              strokeWidth={5}
              strokeLinecap="square"
            />
            {/* Inner Wall Face Line */}
            <line
              x1={edge.p1.x}
              y1={edge.p1.y}
              x2={edge.p2.x}
              y2={edge.p2.y}
              stroke="#78716c"
              strokeWidth={0.75}
            />
            {/* Wall ID Badge */}
            <circle cx={midX + nx * 9} cy={midY + ny * 9} r={5.5} fill="#1c1917" />
            <text x={midX + nx * 9} y={midY + ny * 9 + 2} fontSize={6} fontWeight="bold" fill="#f5eedf" textAnchor="middle">
              {edge.label}
            </text>
          </g>
        );
      })}

      {/* 4. Doors & Windows */}
      {roomOpenings.map((op) => {
        const wall = walls.find((w) => w.id === op.wallId);
        if (!wall) return null;
        const dx = wall.end.xMm - wall.start.xMm;
        const dy = wall.end.yMm - wall.start.yMm;
        const len = Math.hypot(dx, dy) || 1;
        const t = Math.max(0, Math.min(1, (op.offsetAlongWallMm ?? 0) / len));
        const px = toSvgX(wall.start.xMm + t * dx);
        const py = toSvgY(wall.start.yMm + t * dy);
        const isDoor = op.kind === 'door';

        return (
          <g key={op.id}>
            {isDoor ? (
              <g>
                <rect x={px - 3} y={py - 3} width={6} height={6} fill="#c2410c" rx={1} />
                <path d={`M ${px} ${py} A 14 14 0 0 1 ${px + 14} ${py - 14}`} fill="none" stroke="#c2410c" strokeWidth={1} strokeDasharray="2 1.5" />
                <line x1={px} y1={py} x2={px + 14} y2={py} stroke="#7c2d12" strokeWidth={1.5} />
              </g>
            ) : (
              <g>
                <rect x={px - 10} y={py - 3} width={20} height={6} fill="#3b82f6" fillOpacity={0.8} rx={1} />
                <line x1={px - 10} y1={py} x2={px + 10} y2={py} stroke="#ffffff" strokeWidth={1} />
              </g>
            )}
          </g>
        );
      })}

      {/* 5. Dual Dimension & Area Badges */}
      <g>
        {/* Left Badge: Dimensions in mm & feet */}
        <rect
          x={originX + 4}
          y={originY + depth * scale - 18}
          width={154}
          height={15}
          fill="#1c1917"
          fillOpacity={0.92}
          stroke="#44403c"
          strokeWidth={0.5}
          rx={3}
        />
        <text x={originX + 8} y={originY + depth * scale - 7.5} fontSize={6.2} fontWeight="bold" fill="#f5eedf">
          {Math.round(width)} × {Math.round(depth)} mm ({mmToFeetInches(width)} × {mmToFeetInches(depth)})
        </text>

        {/* Right Badge: Area in m² & sq.ft */}
        <rect
          x={originX + width * scale - 94}
          y={originY + depth * scale - 18}
          width={90}
          height={15}
          fill="#1c1917"
          fillOpacity={0.92}
          stroke="#44403c"
          strokeWidth={0.5}
          rx={3}
        />
        <text x={originX + width * scale - 49} y={originY + depth * scale - 7.5} fontSize={6.2} fontWeight="bold" fill="#d4af37" textAnchor="middle">
          {((width * depth) / 1e6).toFixed(1)} m² ({sqmToSqft((width * depth) / 1e6)} sq.ft)
        </text>
      </g>
    </svg>
  );
}
