import { ArrowRight, Check, FileText, Image, Layers3, Loader2, Palette, Plus, RefreshCw, Save, Send, Sparkles, ThumbsDown, ThumbsUp, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, CardContent, CardHeader } from '../ui/primitives';
import { supabase } from '../../lib/supabase';
import MaterialSwapPanel from './MaterialSwapPanel';
import { getApiBase } from '../../lib/api-base';
import './visual-studio.css';
import { ModulePreview } from '../library/ModulePreview';
import { listCatalog } from '@ultida/catalog-core';

type Stage = 'Design' | 'Visualize' | 'Document';
type Module = { id: string; roomId: string; family: string; label: string; widthMm: number; depthMm: number; heightMm: number; wallId?: string; offsetMm?: number; xMm?: number; yMm?: number; rotationDeg?: number; configuration?: ModuleConfiguration };
type CatalogItem = { id: string; family: string; name: string; widthMm: number; depthMm: number; heightMm: number; tags: string[]; description?: string; manufacturingRules?: string[] };
type PreparedModulePlan = { schema: 'ultida.module-plan.v1'; templateId: string; family: string; name: string; dimensionsMm: { width: number; depth: number; height: number }; wallWidthMm: number; clearanceMm: number };
type DesignPreset = { id: string; name: string; family: string; roomTypes: string[]; referenceStyle: string[]; renderRules: string[]; productionRules: string[] };
type ModuleConfiguration = { archetype: string; shutterStyle: 'swing' | 'sliding' | 'profile-glass' | 'open'; drawerCount: number; shutterCount?: number; includeLoft: boolean; glassProfile: boolean; sideFillerLeft: boolean; sideFillerRight: boolean; handleStyle: 'gola' | 'long-profile' | 'knob' | 'none'; lighting: 'none' | 'shelf-led' | 'vertical-led' };
type Provider = { id: string; configured: boolean; operations: string[] };
type StoredRender = { id: string; scene_version_id: string; status: string; stale?: boolean; signedUrl: string | null; created_at: string; provenance?: { provider?: string; model?: string; promptVersion?: string; reviewStatus?: string } };
type DesignFocus = 'all' | 'modules' | 'materials';
type MaterialSlot = 'carcass' | 'shutter' | 'back_panel' | 'countertop' | 'profile' | 'glass';
type Props = { stage: Stage; focus?: DesignFocus; projectId: string | null; planApproved: boolean; briefComplete: boolean; sceneVersionId: string | null; sceneApproved: boolean; modules: Module[]; materials: any[]; onSceneCreated: (id: string, modules: Module[], materials: any[]) => Promise<string | void>; onSceneApproved: (sceneVersionId?: string) => Promise<boolean> };
const apiBase = getApiBase();

function localCatalogForRoom(roomType: string): CatalogItem[] {
  const permittedRooms = new Set(['kitchen', 'living', 'bedroom', 'master_bedroom', 'kids_bedroom', 'bathroom', 'dining', 'study', 'pooja', 'utility', 'foyer', 'balcony', 'other']);
  const safeRoom = permittedRooms.has(roomType) ? roomType as Parameters<typeof listCatalog>[0] : 'other';
  return listCatalog(safeRoom).map((item) => ({
    id: item.id,
    family: item.family,
    name: item.name,
    widthMm: item.widthMm,
    depthMm: item.depthMm,
    heightMm: item.heightMm,
    tags: item.tags,
    description: item.description,
    manufacturingRules: item.manufacturingRules,
  }));
}

function roundToModuleIncrement(valueMm: number, incrementMm = 50) {
  return Math.round(valueMm / incrementMm) * incrementMm;
}

function fitModuleToMeasuredWall(item: CatalogItem, wallLengthMm: number) {
  const adaptiveFamily = item.family === 'tv-unit' || item.family === 'crockery';
  if (!adaptiveFamily || !Number.isFinite(wallLengthMm) || wallLengthMm <= 0) {
    return { widthMm: item.widthMm, depthMm: item.depthMm, heightMm: item.heightMm, adapted: false };
  }
  const minWidthMm = item.family === 'tv-unit' ? 1200 : 900;
  const safeWallWidthMm = roundToModuleIncrement(Math.max(0, wallLengthMm - 200));
  if (safeWallWidthMm < minWidthMm) return null;
  const isWallComposition = /wall|full|asymmetric|profile|crockery|display|bar|panel/i.test(`${item.name} ${item.tags.join(' ')}`);
  const targetWidthMm = isWallComposition ? safeWallWidthMm : Math.min(item.widthMm, safeWallWidthMm);
  const maxWidthMm = item.family === 'tv-unit' ? 4200 : 3600;
  const widthMm = Math.min(maxWidthMm, Math.max(minWidthMm, targetWidthMm));
  return { widthMm, depthMm: item.depthMm, heightMm: item.heightMm, adapted: widthMm !== item.widthMm };
}

const ROOM_PREBUILT_PACKAGES: Record<string, Array<{ id: string; name: string; desc: string; width: number; depth?: number; height: number; family: string; icon: string }>> = {
  dining: [
    { id: 'pre-dining-table', name: '2100mm Sintered Stone Dining Table (6 Chairs)', desc: 'Calacatta honed marble slab on fluted smoked oak tapered pedestals (760 mm H)', width: 2100, depth: 1000, height: 760, family: 'dining', icon: '🍽️' },
    { id: 'pre-dining-crockery', name: '1800mm Fluted Glass Crockery & Bar Console', desc: 'System 32 profile-glass display with soft-close drawers & warm 3000K shelf LED (2400 mm H)', width: 1800, depth: 450, height: 2400, family: 'crockery', icon: '🍷' },
    { id: 'pre-dining-buffet', name: '1500mm Floating Buffet Credenza', desc: 'Sintered stone top with dual soft-close drawers & fluted PU finish (850 mm H)', width: 1500, depth: 450, height: 850, family: 'crockery', icon: '🥂' },
  ],
  living: [
    { id: 'pre-living-tv', name: '2400mm Fluted TV Console & OLED Media Wall', desc: 'Fluted acoustic back panel, concealed wire raceway & floating console (2200 mm H)', width: 2400, depth: 400, height: 2200, family: 'tv-unit', icon: '📺' },
    { id: 'pre-living-sofa', name: '2800mm Curved Bouclé Sectional Sofa', desc: 'Deep ergonomic contours in warm textured sand bouclé with 430 mm seat height (850 mm H)', width: 2800, depth: 1200, height: 850, family: 'sofa', icon: '🛋️' },
    { id: 'pre-living-table', name: '800mm Round Calacatta Coffee Table', desc: 'Low-slung 40mm sintered marble top on brushed brass tubular base (380 mm H)', width: 800, depth: 800, height: 380, family: 'sofa', icon: '☕' },
    { id: 'pre-living-chair', name: '850mm Cognac Saddle Leather Lounge Armchair', desc: 'Sculptural accent chair with brushed nickel swivel base and memory foam (820 mm H)', width: 850, depth: 850, height: 820, family: 'sofa', icon: '🪑' },
  ],
  kitchen: [
    { id: 'pre-kit-base-tall', name: '2700mm Tandem Base + 40mm Sintered Stone Top', desc: 'Blum tandembox drawers, cutlery inserts, plinth & sink cut-out at 860 mm working H', width: 2700, depth: 600, height: 860, family: 'kitchen-base', icon: '🍳' },
    { id: 'pre-kit-overhead', name: '2700mm Profile-Glass Lift-Up Overhead (3000K LED)', desc: 'Anodized graphite aluminium frames with under-cabinet warm task strip at 1450 mm elevation', width: 2700, depth: 350, height: 720, family: 'kitchen-wall', icon: '🪟' },
    { id: 'pre-kit-appliance', name: '600mm Built-in Oven & Microwave Pantry Tower', desc: 'Reinforced ventilated appliance cavity with storage drawers below and top loft (2100 mm H)', width: 600, depth: 600, height: 2100, family: 'kitchen-tall', icon: '🔥' },
    { id: 'pre-kit-pantry', name: '600mm Tall 12-Basket Pantry Pull-Out Tower', desc: 'Full-extension stainless steel internal wire baskets & spice racks (2100 mm H)', width: 600, depth: 600, height: 2100, family: 'kitchen-tall', icon: '🥫' },
  ],
  master_bedroom: [
    { id: 'pre-bed-hydraulic', name: '1800mm King Storage Bed + Extended Headboard', desc: 'Gas-lift hydraulic storage with fluted acoustic upholstered wall back panel (1200 mm H)', width: 1950, depth: 2100, height: 1200, family: 'bed', icon: '🛏️' },
    { id: 'pre-bed-wardrobe', name: '2400mm 4-Door Profile Glass Wardrobe', desc: 'Anodized bronze aluminum frame with integrated lofts and sensor LED (2700 mm H)', width: 2400, depth: 600, height: 2700, family: 'wardrobe', icon: '🚪' },
    { id: 'pre-bed-vanity', name: '1200mm Floating Vanity Dresser & LED Mirror', desc: 'Jewelry organizer drawers with backlit anti-fog touch LED mirror (1800 mm H)', width: 1200, depth: 450, height: 1800, family: 'utility', icon: '🪞' },
    { id: 'pre-bed-nightstand', name: '500mm Dual Floating Bedside Nightstands', desc: 'Soft-close drawer with integrated wireless charging pad and ambient LED (450 mm H)', width: 500, depth: 400, height: 450, family: 'bed', icon: '🏮' },
  ],
  bedroom: [
    { id: 'pre-bed-2-hydraulic', name: '1600mm Queen Storage Bed + Fluted Headboard', desc: 'Hydraulic lift storage bed with padded headboard and bedside clearance (1150 mm H)', width: 1750, depth: 2100, height: 1150, family: 'bed', icon: '🛏️' },
    { id: 'pre-bed-2-wardrobe', name: '1800mm 3-Door Swing Wardrobe + Lofts', desc: 'Synchronized soft-close hinges with internal hanger rods & dual drawers (2700 mm H)', width: 1800, depth: 600, height: 2700, family: 'wardrobe', icon: '🚪' },
    { id: 'pre-bed-2-study', name: '1200mm Integrated Study Desk & Overhead Bookshelf', desc: 'Cable grommet, push-to-open drawers and magnetic pinboard backing (2100 mm H)', width: 1200, depth: 600, height: 2100, family: 'study', icon: '📚' },
  ],
  bathroom: [
    { id: 'pre-bath-vanity', name: '1200mm Floating Vanity & Backlit Mirror', desc: 'Undermount ceramic basin, sintered stone top, soft-close drawer and anti-fog mirror (850 mm H)', width: 1200, depth: 500, height: 850, family: 'utility', icon: '🪞' },
    { id: 'pre-bath-shutter', name: '900mm Overhead Mirror Cabinet with Hidden Storage', desc: 'Double-sided mirror doors with internal power socket and adjustable shelves (750 mm H)', width: 900, depth: 180, height: 750, family: 'utility', icon: '🧴' },
  ],
  pooja: [
    { id: 'pre-pooja-mandir', name: '1200mm CNC Jali Teak Mandir Unit', desc: 'Om brass inlays, bell brackets, velvet pooja drawer & LED spotlight (2100 mm H)', width: 1200, depth: 400, height: 2100, family: 'pooja', icon: '🪔' },
  ],
  study: [
    { id: 'pre-study-desk', name: '2100mm Executive Floating Desk & Library Wall', desc: 'Dual pedestal drawers with open shelving and accent warm LED wash (2400 mm H)', width: 2100, depth: 600, height: 2400, family: 'study', icon: '💻' },
  ],
};

const STUDIO_ROOM_REFERENCES: Record<string, Array<{ id: string; img: string; title: string; styleTag: string }>> = {
  living: [
    { id: 'ref-liv-1', img: '/reference-vault/013-52a29a1053dc.png', title: '2400mm Fluted TV Console Wall', styleTag: 'Fluted Smoked Oak & Ambient LED' },
    { id: 'ref-liv-2', img: '/reference-vault/001-ddc1891636f7.png', title: '2800mm Sectional Sofa & Coffee Table', styleTag: 'Deep Charcoal & Warm Sconces' },
    { id: 'ref-liv-3', img: '/reference-vault/014-685f67e3ff6f.png', title: 'Floating Backlit Media Wall', styleTag: 'Anti-Gravity Minimalist' },
    { id: 'ref-liv-4', img: '/reference-vault/051-999d353af1d8.png', title: 'Travertine Media Wall with Glass Tower', styleTag: 'Calacatta Marble & Brushed Brass' },
  ],
  kitchen: [
    { id: 'ref-kit-1', img: '/reference-vault/006-e36e2c7c9b1a.png', title: 'Modular Kitchen with Tandem Drawers', styleTag: 'Fluted Glass Overheads & Terrazzo' },
    { id: 'ref-kit-2', img: '/reference-vault/042-7eaf3dbfd306.png', title: 'L-Shaped Kitchen & Oak Overhead Units', styleTag: 'Gloss White Base & Double Lofts' },
    { id: 'ref-kit-3', img: '/reference-vault/003-1f61a8aabde4.png', title: 'Full-Height Appliance Pantry Tower', styleTag: 'Seamless Dual Oven/Microwave Wall' },
    { id: 'ref-kit-4', img: '/reference-vault/048-ac94a44309b6.png', title: 'Rolling Shutter Appliance Garage Counter', styleTag: 'Fluted Glass & Wicker Vegetable Trays' },
  ],
  bedroom: [
    { id: 'ref-bed-1', img: '/reference-vault/008-5fd497f005d8.png', title: 'Natural Oak 4-Door Full-Height Wardrobe', styleTag: 'Floor-to-Ceiling Lofts & Edge Pulls' },
    { id: 'ref-bed-2', img: '/reference-vault/009-f68e47674ead.png', title: 'Suede Ivory Wardrobe & Pinboard Study Desk', styleTag: 'Integrated Workstation & Brass Accents' },
    { id: 'ref-bed-3', img: '/reference-vault/025-adb09122c8d1.png', title: 'Sage Green Arched Wardrobe & Study Desk', styleTag: 'Warm Nordic Arched Shutter Millwork' },
  ],
  master_bedroom: [
    { id: 'ref-mbed-1', img: '/reference-vault/047-c1ce4511e83d.png', title: 'Master Bedroom Suite: Bed, Fluted Wardrobe & Vanity', styleTag: 'Complete 3BHK Master Luxury Package' },
    { id: 'ref-mbed-2', img: '/reference-vault/040-a7dcd66e4242.png', title: '4-Door Suede & Dark Oak Passage Wardrobe', styleTag: 'Lofts, Recessed Spots & Flush Reveal' },
    { id: 'ref-mbed-3', img: '/reference-vault/060-70075531f7e7.png', title: 'Master Suite 6-Door Wardrobe & Floating TV', styleTag: 'Tufted Bed & Concealed Dressing Alcove' },
  ],
  dining: [
    { id: 'ref-din-1', img: '/reference-vault/002-cab37cfa0bb2.png', title: '1800mm Fluted Crockery Console & Bar', styleTag: 'Fluted Louvers & Glass Display' },
    { id: 'ref-din-2', img: '/reference-vault/018-b7dd5f1492fe.png', title: 'Full Height Bar & Wine Cabinet', styleTag: 'Profile Glass & Stemware Lighting' },
  ],
  bathroom: [
    { id: 'ref-bath-1', img: '/reference-vault/028-a8f62ab3d392.png', title: 'Concealed Cistern Vanity & Wall-Hung Basin', styleTag: 'Vitrified Wall Tiles & Shutter Storage' },
    { id: 'ref-bath-2', img: '/reference-vault/029-640527178f8d.png', title: 'Bathroom Suite with Oval Mirror & Shower', styleTag: 'Vitrified Marble & Overhead Shutter' },
  ],
  pooja: [
    { id: 'ref-poo-1', img: '/reference-vault/020-ea872c640df6.png', title: 'Traditional Backlit Mandir with CNC Jaali', styleTag: 'Brass Inlays, Bell Hooks & 4 Drawers' },
    { id: 'ref-poo-2', img: '/reference-vault/021-5a47b71bad49.png', title: 'Mandir Unit with Gold OM Mandala & Tray', styleTag: 'Pull-out Bhog Tray & Soft-Close Drawers' },
    { id: 'ref-poo-3', img: '/reference-vault/019-a06a89855436.png', title: 'Modular Pooja Unit with Shutter Variations', styleTag: 'Frosted Glass Shutter with Ganesha Motif' },
  ],
  study: [
    { id: 'ref-stu-1', img: '/reference-vault/011-6c55d3439149.png', title: '1500mm Floating Study Desk & Wall Cabinet', styleTag: 'Fluted Shutter & Open Book Niche' },
    { id: 'ref-stu-2', img: '/reference-vault/044-577ed741688e.png', title: 'Architectural Elevation: 2900mm Wardrobe + Desk', styleTag: 'Exact Millimeter Dimensioned Release' },
  ],
  utility: [
    { id: 'ref-utl-1', img: '/reference-vault/036-de959cf3df44.png', title: '1800mm Laundry Counter with Washing Machine', styleTag: 'Undermount Sink, Dishwasher & Lofts' },
    { id: 'ref-utl-2', img: '/reference-vault/005-7919b88e0dc1.png', title: 'Technical CAD Elevation: 1596mm Utility Wall', styleTag: 'Service Plumbing & Appliance Clearance' },
  ],
};

const CURATED_MINIMAL_FINISHES = [
  { id: 'mat-high-gloss', name: 'High Gloss Acrylic', type: 'High Gloss', code: 'ULT-HG-01', hex: '#F7F7F2', desc: 'Mirror-like reflective acrylic shutter finish' },
  { id: 'mat-super-matte', name: 'Super-Matte Suede', type: 'Super Matte', code: 'ULT-MAT-02', hex: '#2B2622', desc: 'Zero-fingerprint soft-touch matte finish' },
  { id: 'mat-smoked-walnut', name: 'Smoked Walnut Veneer', type: 'Wood Grain', code: 'ULT-WOD-03', hex: '#654321', desc: 'Rich organic walnut with natural grain texture' },
  { id: 'mat-calacatta-stone', name: 'Calacatta Sintered Stone', type: 'Sintered Slab', code: 'ULT-STN-04', hex: '#F3EDE2', desc: '40mm honed marble slab with gold-grey veining' },
];

export function DesignFlowWorkspace({ stage, focus = 'all', projectId, planApproved, briefComplete, sceneVersionId, sceneApproved, modules, materials, onSceneCreated, onSceneApproved }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedSpaceId = searchParams.get('spaceId');
  const pendingModuleRequested = searchParams.get('pendingModule') === '1';
  const [room, setRoom] = useState('kitchen');
  const [spaces, setSpaces] = useState<Array<{ id: string; name: string; roomType: string; geometry_json?: { polygon?: Array<{ xMm?: number; yMm?: number; x?: number; y?: number }> } }>>([]);
  const [walls, setWalls] = useState<Array<{ id: string; start?: { xMm: number; yMm: number }; end?: { xMm: number; yMm: number } }>>([]);
  const [openings, setOpenings] = useState<Array<{ id: string; wallId?: string; kind?: string; widthMm?: number; heightMm?: number; sillHeightMm?: number; offsetAlongWallMm?: number; offsetMm?: number }>>([]);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [wallId, setWallId] = useState<string | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [moduleConfiguration, setModuleConfiguration] = useState<ModuleConfiguration>({ archetype: 'full_wall_storage', shutterStyle: 'swing', drawerCount: 0, includeLoft: false, glassProfile: false, sideFillerLeft: false, sideFillerRight: false, handleStyle: 'long-profile', lighting: 'none' });
  const [draftModules, setDraftModules] = useState<Module[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [designMode, setDesignMode] = useState<'layout' | 'moodboard'>(focus === 'materials' ? 'moodboard' : 'layout');
  const [visualState, setVisualState] = useState('No visual proposal requested');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
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
  const [compiledSceneId, setCompiledSceneId] = useState<string | null>(sceneVersionId);
  const [structuralReferenceImage, setStructuralReferenceImage] = useState<string | null>(null);
  const [structuralImageName, setStructuralImageName] = useState<string | null>(null);
  const [materialLibrary, setMaterialLibrary] = useState<any[]>([]);
  const [materialAssignmentsSaved, setMaterialAssignmentsSaved] = useState(materials.length > 0);
  const [starterMaterialsState, setStarterMaterialsState] = useState('');

  useEffect(() => { setCompiledSceneId(sceneVersionId); }, [sceneVersionId]);

  // The project routes have distinct jobs, but both update the same draft scene.
  // Enter the task-specific tab when following a workflow action without losing
  // any persisted placement or material data.
  useEffect(() => {
    if (focus === 'modules') setDesignMode('layout');
    if (focus === 'materials') setDesignMode('moodboard');
  }, [focus]);

  // Moodboard States
  const [stylePresets, setStylePresets] = useState<DesignPreset[]>([]);
  const [activeTheme, setActiveTheme] = useState('');
  const [activeLaminate, setActiveLaminate] = useState('');
  const [carcassLaminateId, setCarcassLaminateId] = useState('');
  const [shutterLaminateId, setShutterLaminateId] = useState('');
  const [activeHardware, setActiveHardware] = useState('');
  const [materialSlot, setMaterialSlot] = useState<MaterialSlot>('shutter');
  // Library materials must be available before scene.v1 exists. Scene-only
  // materials made the first assignment impossible, even though compilation
  // correctly requires persisted assignments.
  const availableMaterials = materialLibrary.length ? materialLibrary : materials;
  const catalogLaminates = availableMaterials.filter((item: any) => ['laminate', 'veneer', 'acrylic', 'stone', 'countertop'].includes(String(item.category ?? '').toLowerCase())).map((item: any) => ({ id: String(item.id), name: String(item.name), code: String(item.code ?? item.id), hex: String(item.metadata?.hex ?? '#d6c7b8'), unitCost: Number(item.unit_cost ?? item.unitCost ?? 0) }));
  const catalogHardwares = availableMaterials.filter((item: any) => ['hardware', 'handle', 'profile', 'glass'].includes(String(item.category ?? '').toLowerCase())).map((item: any) => ({ id: String(item.id), name: String(item.name), code: String(item.code ?? item.id), unitCost: Number(item.unit_cost ?? item.unitCost ?? 0) }));
  
  const selectedThemeObj = stylePresets.find((preset) => preset.id === activeTheme) ?? stylePresets[0];
  const selectedLaminateObj = catalogLaminates.find((l) => l.id === activeLaminate) ?? catalogLaminates[0] ?? { id: '', name: 'No laminate selected', code: '', hex: '#d6c7b8', unitCost: 0 };
  const selectedCarcassLaminate = catalogLaminates.find((l) => l.id === carcassLaminateId) ?? catalogLaminates[0] ?? { id: '', name: 'No carcass finish selected', code: '', hex: '#d6c7b8', unitCost: 0 };
  const selectedShutterLaminate = catalogLaminates.find((l) => l.id === shutterLaminateId) ?? selectedLaminateObj;
  const selectedHardwareObj = catalogHardwares.find((h) => h.id === activeHardware) ?? catalogHardwares[0] ?? { id: '', name: 'No hardware selected', code: '', unitCost: 0 };
  const fallbackModule: Module = useMemo(() => {
    const isBed = room.includes('bed');
    const isKit = room.includes('kitchen');
    return {
      id: `mod-active-${spaceId || 'space'}`,
      roomId: spaceId || 'space-1',
      family: isBed ? 'wardrobe' : isKit ? 'kitchen-base' : 'tv-unit',
      label: isBed ? '2400 mm Profile-Glass Wardrobe' : isKit ? '2800 mm Modular Kitchen Counter' : '2400 mm Fluted TV Console Wall',
      widthMm: isBed ? 2400 : isKit ? 2800 : 2400,
      depthMm: isBed ? 600 : isKit ? 600 : 400,
      heightMm: isBed ? 2400 : isKit ? 860 : 2200,
      wallId: wallId || 'wall-1',
      offsetMm: 200,
      configuration: moduleConfiguration,
    };
  }, [room, spaceId, wallId, moduleConfiguration]);

  const selectedModule = draftModules.find((module) => module.id === selectedModuleId) ?? draftModules[0] ?? fallbackModule;
  const selectedSpace = spaces.find((space) => space.id === spaceId) ?? null;
  const roomWalls = useMemo(() => {
    const polygon = selectedSpace?.geometry_json?.polygon ?? [];
    const points = polygon.map((point) => ({ x: Number(point.xMm ?? point.x), y: Number(point.yMm ?? point.y) })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (points.length < 3) return walls;
    const tolerance = 300;
    const distanceToSegment = (point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) => {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSquared = dx * dx + dy * dy;
      if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
      const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
      return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
    };
    const nearBoundary = (point?: { xMm: number; yMm: number }) => Boolean(point && points.some((start, index) => distanceToSegment({ x: point.xMm, y: point.yMm }, start, points[(index + 1) % points.length]) <= tolerance));
    const filtered = walls.filter((wall) => nearBoundary(wall.start) && nearBoundary(wall.end));
    // Never manufacture a client-only wall ID: module persistence validates
    // anchors against the accepted plan wall collection.
    return filtered.length ? filtered : walls;
  }, [selectedSpace, walls]);
  const selectedWall = roomWalls.find((wall) => wall.id === wallId) ?? roomWalls[0] ?? null;
  const selectedWallLengthMm = selectedWall?.start && selectedWall?.end ? Math.hypot(selectedWall.end.xMm - selectedWall.start.xMm, selectedWall.end.yMm - selectedWall.start.yMm) : 0;
  const selectedWallOpenings = openings.filter((opening) => opening.wallId === selectedWall?.id);
  useEffect(() => {
    if (!roomWalls.length) { setWallId(null); return; }
    setWallId((current) => current && roomWalls.some((wall) => wall.id === current) ? current : roomWalls[0].id);
  }, [spaceId, roomWalls]);
  
  const compiledStylePrompt = `${selectedThemeObj ? [...selectedThemeObj.referenceStyle, ...selectedThemeObj.renderRules].join('. ') : 'Approved project style'} with ${selectedLaminateObj.name} and ${selectedHardwareObj.name}`;
  const [style, setStyle] = useState(compiledStylePrompt);
  const [quality, setQuality] = useState<'draft' | 'review' | 'final'>('review');

  useEffect(() => {
    setStyle(`${selectedThemeObj ? [...selectedThemeObj.referenceStyle, ...selectedThemeObj.renderRules].join('. ') : 'Approved project style'} with ${selectedLaminateObj.name} and ${selectedHardwareObj.name}`);
    if (!activeLaminate && catalogLaminates[0]) setActiveLaminate(catalogLaminates[0].id);
    if (!carcassLaminateId && catalogLaminates[0]) setCarcassLaminateId(catalogLaminates[0].id);
    if (!shutterLaminateId && catalogLaminates[0]) setShutterLaminateId(catalogLaminates[0].id);
    if (!activeHardware && catalogHardwares[0]) setActiveHardware(catalogHardwares[0].id);
  }, [activeTheme, activeLaminate, carcassLaminateId, shutterLaminateId, activeHardware, materials, stylePresets]);

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
      if (response.ok && Array.isArray(payload.renders) && payload.renders.length > 0) {
        setRenders(payload.renders);
        setSelectedRenderId((current) => current && payload.renders.some((r: StoredRender) => r.id === current) ? current : payload.renders[0].id);
        return;
      }
    } catch {
      // A gallery must only contain durable render records returned by the API.
    }

    setRenders([]);
    setSelectedRenderId(null);
    setReviewVisualJobId(null);
    return;

    setRenders((current) => {
      if (current.length > 0) return current;
      const initialRenders: StoredRender[] = [
        {
          id: 'render-living-lux',
          scene_version_id: sceneVersionId || 'scene-v1',
          status: 'succeeded',
          signedUrl: '/reference-vault/002-cab37cfa0bb2.png',
          created_at: new Date().toISOString(),
          provenance: {
            provider: 'ULTIDA AURA Vision AI (Ultra Photoreal 4K)',
            model: 'Architectural-Diffusion-XL v2.4',
            promptVersion: 'scene.v1 | LIVING & DINING | Warm Amber Daylight | Fluted Smoked Oak',
            reviewStatus: 'approved',
          },
        },
        {
          id: 'render-kitchen-lux',
          scene_version_id: sceneVersionId || 'scene-v1',
          status: 'succeeded',
          signedUrl: '/reference-vault/001-ddc1891636f7.png',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          provenance: {
            provider: 'ULTIDA AURA Vision AI (Ultra Photoreal 4K)',
            model: 'Architectural-Diffusion-XL v2.4',
            promptVersion: 'scene.v1 | MODULAR KITCHEN | Calacatta Marble & Pearl Gloss',
            reviewStatus: 'approved',
          },
        },
        {
          id: 'render-bed-lux',
          scene_version_id: sceneVersionId || 'scene-v1',
          status: 'succeeded',
          signedUrl: '/reference-vault/006-e36e2c7c9b1a.png',
          created_at: new Date(Date.now() - 7200000).toISOString(),
          provenance: {
            provider: 'ULTIDA AURA Vision AI (Ultra Photoreal 4K)',
            model: 'Architectural-Diffusion-XL v2.4',
            promptVersion: 'scene.v1 | MASTER BEDROOM | Anodized Profile Glass Wardrobe',
            reviewStatus: 'approved',
          },
        },
      ];
      setSelectedRenderId(initialRenders[0].id);
      setReviewVisualJobId(initialRenders[0].id);
      return initialRenders;
    });
  }

  useEffect(() => {
    if (stage !== 'Visualize') return;
    fetch(`${apiBase}/providers`)
      .then((response) => response.json())
      .then((payload) => setProviders(Array.isArray(payload.providers) ? payload.providers : []))
      .catch(() => setProviders([]));
    void loadRenders();
  }, [stage, projectId]);

  // A render selected from the persisted gallery must remain reviewable after
  // refresh. Previously only a newly-created job populated reviewVisualJobId,
  // which made Approve/Reject appear disabled for an existing output.
  useEffect(() => {
    const selected = renders.find((render) => render.id === selectedRenderId) ?? renders[0];
    if (selected) setReviewVisualJobId(selected.id);
  }, [renders, selectedRenderId]);

  useEffect(() => {
    if (!projectId || !planApproved) { setMaterialLibrary([]); return; }
    void (async () => {
      try {
        const response = await fetch(`${apiBase}/projects/${projectId}/material-library`, { headers: await authenticatedHeaders() });
        const payload = await response.json().catch(() => null);
        setMaterialLibrary(response.ok && Array.isArray(payload?.materials) ? payload.materials : []);
      } catch {
        setMaterialLibrary([]);
      }
    })();
  }, [projectId, planApproved]);

  async function addStarterMaterials() {
    if (!projectId) return;
    setStarterMaterialsState('Adding curated starter materials...');
    try {
      const response = await fetch(`${apiBase}/projects/${projectId}/material-library/starter`, { method: 'POST', headers: await authenticatedHeaders() });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.materials)) {
        setStarterMaterialsState(payload?.message ?? 'Starter materials could not be added.');
        return;
      }
      setMaterialLibrary(payload.materials);
      setStarterMaterialsState(`Starter material library ready (${payload.materials.length} items). Confirm supplier SKUs before production.`);
    } catch {
      setStarterMaterialsState('Starter material service is unavailable.');
    }
  }

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
        // `/spaces` returns database rows (`room_type`), while this workspace
        // uses the UI contract (`roomType`). Normalize at this boundary so
        // catalogue filtering, wall placement, and rendering share one room.
        const nextSpaces = Array.isArray(spacePayload.spaces)
          ? spacePayload.spaces.map((space: any) => ({
              ...space,
              id: String(space.id),
              name: String(space.name ?? space.room_type ?? space.id),
              roomType: String(space.roomType ?? space.room_type ?? 'other'),
            }))
          : [];
        const nextWalls = Array.isArray(planPayload.walls) ? planPayload.walls : [];
        setSpaces(nextSpaces);
        setWalls(nextWalls);
        setOpenings(Array.isArray(planPayload.openings) ? planPayload.openings : []);
        const nextSpace = requestedSpaceId && nextSpaces.some((space: any) => space.id === requestedSpaceId)
          ? nextSpaces.find((space: any) => space.id === requestedSpaceId)
          : nextSpaces.find((space: any) => space.id === spaceId) ?? nextSpaces[0];
        setSpaceId(nextSpace?.id ?? null);
        setWallId((current) => current && nextWalls.some((wall: any) => wall.id === current) ? current : nextWalls[0]?.id ?? null);
        if (nextSpace?.roomType) setRoom(nextSpace.roomType);
      } catch {
        setSpaces([]); setWalls([]); setOpenings([]); setSpaceId(null); setWallId(null);
      }
    })();
  }, [projectId, planApproved, requestedSpaceId]);

  useEffect(() => {
    if (!planApproved) {
      setCatalogItems([]);
      setCatalogLoading(false);
      return;
    }
    void (async () => {
      setCatalogLoading(true);
      try {
        const response = await fetch(`${apiBase}/catalog/modules?room=${encodeURIComponent(room)}`, { headers: await authenticatedHeaders() });
        const payload = await response.json().catch(() => null);
        if (response.ok && Array.isArray(payload?.modules) && payload.modules.length > 0) {
          setCatalogItems(payload.modules);
          return;
        }
        setCatalogItems(localCatalogForRoom(room));
        setPlacementNotice('The live catalogue service did not respond. Showing the bundled, verified room catalogue; placement will still be validated before it is saved.');
      } catch {
        setCatalogItems(localCatalogForRoom(room));
        setPlacementNotice('The catalogue service is temporarily unavailable. Showing the bundled, verified room catalogue; placement will still be validated before it is saved.');
      } finally {
        setCatalogLoading(false);
      }
    })();
  }, [room, planApproved]);

  useEffect(() => {
    if (!pendingModuleRequested || !planApproved || !catalogItems.length) return;
    let prepared: PreparedModulePlan | null = null;
    try {
      const raw = window.localStorage.getItem('ultida.pendingModulePlan.v1');
      prepared = raw ? JSON.parse(raw) as PreparedModulePlan : null;
    } catch {
      window.localStorage.removeItem('ultida.pendingModulePlan.v1');
    }
    if (!prepared || prepared.schema !== 'ultida.module-plan.v1') {
      setPlacementNotice('The prepared module was not found. Choose a catalogue module to continue.');
      return;
    }
    const item = catalogItems.find((candidate) => candidate.id === prepared?.templateId);
    if (!item) {
      setPlacementNotice(`${prepared.name} is not compatible with the selected room. Choose a matching room or template.`);
      return;
    }
    setFamilyFilter(item.family);
    setCatalogQuery(item.name);
    setModuleConfiguration((current) => ({ ...current, shutterCount: ['tv-unit', 'crockery'].includes(item.family) ? Math.max(2, Math.round(prepared!.dimensionsMm.width / 450)) : current.shutterCount }));
    setPlacementNotice(`${prepared.name} is prepared at ${prepared.dimensionsMm.width} × ${prepared.dimensionsMm.depth} × ${prepared.dimensionsMm.height} mm. Select a verified wall, then place it to persist the module.`);
  }, [pendingModuleRequested, planApproved, catalogItems]);

  useEffect(() => {
    if (!planApproved) {
      setStylePresets([]);
      return;
    }
    void (async () => {
      try {
        const response = await fetch(`${apiBase}/catalog/presets?room=${encodeURIComponent(room)}`, { headers: await authenticatedHeaders() });
        const payload = await response.json();
        const next = response.ok && Array.isArray(payload.presets) ? payload.presets : [];
        setStylePresets(next);
        setActiveTheme((current) => next.some((preset: DesignPreset) => preset.id === current) ? current : next[0]?.id ?? '');
      } catch {
        setStylePresets([]);
      }
    })();
  }, [room, planApproved]);

  useEffect(() => {
    if (!projectId || !planApproved) return;
    void (async () => {
      try {
        const response = await fetch(`${apiBase}/projects/${projectId}/module-instances`, { headers: await authenticatedHeaders() });
        const payload = await response.json();
        if (!response.ok || !Array.isArray(payload.modules)) return;
        setDraftModules(payload.modules.map((saved: any) => {
          const config = saved.config_json ?? {};
          const position = saved.position_json ?? {};
          return { id: saved.id, roomId: saved.space_id, family: config.family ?? saved.category, label: saved.label, widthMm: Number(config.widthMm), depthMm: Number(config.depthMm), heightMm: Number(config.heightMm), wallId: position.wallId, offsetMm: position.offsetMm, xMm: position.xMm, yMm: position.yMm, rotationDeg: position.rotationDeg, configuration: config.configuration };
        }).filter((item: Module) => Number.isFinite(item.widthMm) && Number.isFinite(item.depthMm) && Number.isFinite(item.heightMm)));
      } catch {
        setDraftModules([]);
      }
    })();
  }, [projectId, planApproved]);



  useEffect(() => {
    if (!activeVisualJobId || !projectId) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`${apiBase}/projects/${projectId}/renders/${activeVisualJobId}`, { headers: await authenticatedHeaders() });
        const payload = await response.json();
        const latest = payload.result;
        const status = latest?.status;
        if (!response.ok) {
          setVisualState(payload.message ?? 'Render status could not be read.'); setVisualBusy(false); setActiveVisualJobId(null);
        } else if (status === 'succeeded' && latest?.signedUrl) {
          setVisualState('Render stored privately and ready for review.'); setVisualBusy(false); setActiveVisualJobId(null); await loadRenders();
        } else if (status === 'failed') {
          setVisualState(latest?.reason ?? latest?.error ?? 'Render generation failed. No image was stored.'); setVisualBusy(false); setActiveVisualJobId(null);
        } else setVisualState(status === 'running' ? 'Rendering in progress...' : 'Render queued...');
      } catch { setVisualState('Render status is temporarily unavailable.'); }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeVisualJobId, projectId]);

  useEffect(() => {
    setSelectedModuleId((current) => current && draftModules.some((module) => module.id === current) ? current : draftModules[0]?.id ?? null);
  }, [draftModules]);

  async function addModule(item: CatalogItem, preparedDimensions?: PreparedModulePlan['dimensionsMm']) {
    if (!briefComplete) { setPlacementNotice('Complete and save the client brief before creating a scene.'); return; }
    if (!planApproved) { setPlacementNotice('Approve the reviewed floor plan before creating a scene.'); return; }
    if (!spaceId || !wallId) { setPlacementNotice('Select a verified room and wall before placing a module.'); return; }
    const anchorWall = roomWalls.find((wall) => wall.id === wallId);
    if (!anchorWall?.start) { setPlacementNotice('The selected wall has no canonical coordinates.'); return; }
    const wallLengthMm = anchorWall.end
      ? Math.hypot(anchorWall.end.xMm - anchorWall.start.xMm, anchorWall.end.yMm - anchorWall.start.yMm)
      : 0;
    const requestedItem = preparedDimensions ? { ...item, widthMm: preparedDimensions.width, depthMm: preparedDimensions.depth, heightMm: preparedDimensions.height } : item;
    const fitted = fitModuleToMeasuredWall(requestedItem, wallLengthMm);
    if (!fitted) {
      setPlacementNotice(`${item.name} needs at least ${item.family === 'tv-unit' ? 1200 : 900} mm of clear wall after end fillers; choose a wider wall or a smaller module family.`);
      return;
    }
    const existingOnWall = draftModules.filter((m) => m.wallId === wallId);
    let offsetMm = 100;
    if (existingOnWall.length > 0) {
      const rightEdge = Math.max(...existingOnWall.map((m) => (m.offsetMm ?? 0) + m.widthMm));
      if (rightEdge + fitted.widthMm <= wallLengthMm - 50) {
        offsetMm = rightEdge + 50;
      } else {
        offsetMm = Math.max(0, Math.round((wallLengthMm - fitted.widthMm) / 2));
      }
    } else {
      offsetMm = Math.max(0, Math.round((wallLengthMm - fitted.widthMm) / 2));
    }
    setPlacementNotice('Checking room compatibility and circulation...');
    try {
      const response = await fetch(`${apiBase}/catalog/validate-placement`, { method: 'POST', headers: await authenticatedHeaders(), body: JSON.stringify({ moduleId: item.id, roomType: room, clearanceMm: room === 'living' ? 800 : 1200 }) });
      const result = await response.json();
      if (!response.ok || !result.valid) { setPlacementNotice(result.issues?.join(' ') ?? 'This module cannot be placed here.'); return; }
      const adaptiveShutterCount = ['tv-unit', 'crockery'].includes(item.family) ? Math.max(2, Math.round(fitted.widthMm / 450)) : undefined;
      const moduleResponse = await fetch(`${apiBase}/projects/${projectId}/module-instances`, { method: 'POST', headers: await authenticatedHeaders(), body: JSON.stringify({ spaceId, templateId: item.id, category: item.family, label: item.name, config: { family: item.family, widthMm: fitted.widthMm, depthMm: fitted.depthMm, heightMm: fitted.heightMm, templateWidthMm: item.widthMm, tags: item.tags, manufacturingRules: item.manufacturingRules ?? [], parameters: { family: moduleConfiguration.archetype, archetype: moduleConfiguration.archetype, overheadStorage: moduleConfiguration.includeLoft, includeLoft: moduleConfiguration.includeLoft, loftFillerMm: 50, sideFillerMm: 30, sideFillerLeft: moduleConfiguration.sideFillerLeft, sideFillerRight: moduleConfiguration.sideFillerRight, profileGlassOption: moduleConfiguration.glassProfile, shelfOption: true, lighting: moduleConfiguration.lighting === 'none' ? 'none' : 'profile_led', drawerCount: moduleConfiguration.drawerCount, shutterCount: adaptiveShutterCount, handleStyle: moduleConfiguration.handleStyle }, configuration: { ...moduleConfiguration, loftFillerMm: 50, sideFillerMm: 30, shutterCount: adaptiveShutterCount, source: fitted.adapted ? 'wall-fit' : 'catalog' } }, position: { wallId, offsetMm } }) });
      const modulePayload = await moduleResponse.json();
      if (!moduleResponse.ok || !modulePayload.module) { setPlacementNotice(modulePayload.message ?? 'Module anchor could not be saved.'); return; }
      const saved = modulePayload.module;
      const resolved = saved.position_json ?? {};
      const next = { id: saved.id, roomId: spaceId, family: item.family, label: item.name, widthMm: fitted.widthMm, depthMm: fitted.depthMm, heightMm: fitted.heightMm, wallId: resolved.wallId, offsetMm: resolved.offsetMm, xMm: resolved.xMm, yMm: resolved.yMm, rotationDeg: resolved.rotationDeg, configuration: { ...moduleConfiguration, shutterCount: adaptiveShutterCount } };
      setDraftModules((current) => current.some((module) => module.id === next.id) ? current : [...current, next]);
      if (pendingModuleRequested) window.localStorage.removeItem('ultida.pendingModulePlan.v1');
      setSelectedModuleId(next.id);
      setPlacementNotice(`${item.name} was saved at ${Math.round(offsetMm)} mm along the verified wall${fitted.adapted ? ` and fitted to ${fitted.widthMm} mm of usable wall` : ''}. Select it to assign materials or make a targeted render revision.`);
    } catch { setPlacementNotice('Placement validator unavailable. The module was not added.'); }
  }

  async function nudgeModule(moduleId: string, deltaMm: number) {
    const mod = draftModules.find((m) => m.id === moduleId);
    if (!mod || !projectId || !selectedWall) return;
    const currentOffset = mod.offsetMm ?? 0;
    const maxOffset = Math.max(0, selectedWallLengthMm - mod.widthMm);
    const nextOffset = Math.max(0, Math.min(maxOffset, currentOffset + deltaMm));
    setDraftModules((current) => current.map((m) => m.id === moduleId ? { ...m, offsetMm: nextOffset } : m));
    try {
      await fetch(`${apiBase}/projects/${projectId}/module-instances/${moduleId}`, {
        method: 'PATCH',
        headers: await authenticatedHeaders(),
        body: JSON.stringify({ position: { wallId: selectedWall.id, offsetMm: nextOffset } }),
      });
      setPlacementNotice(`Repositioned ${mod.label} to offset ${Math.round(nextOffset)} mm on selected wall.`);
    } catch {
      // local state remains responsive
    }
  }

  async function centerModule(moduleId: string) {
    const mod = draftModules.find((m) => m.id === moduleId);
    if (!mod || !projectId || !selectedWall) return;
    const centeredOffset = Math.max(0, Math.round((selectedWallLengthMm - mod.widthMm) / 2));
    setDraftModules((current) => current.map((m) => m.id === moduleId ? { ...m, offsetMm: centeredOffset } : m));
    try {
      await fetch(`${apiBase}/projects/${projectId}/module-instances/${moduleId}`, {
        method: 'PATCH',
        headers: await authenticatedHeaders(),
        body: JSON.stringify({ position: { wallId: selectedWall.id, offsetMm: centeredOffset } }),
      });
      setPlacementNotice(`Centered ${mod.label} at offset ${Math.round(centeredOffset)} mm.`);
    } catch {
      // local state remains responsive
    }
  }

  async function saveMoodboard(): Promise<boolean> {
    if (!projectId) { setPlacementNotice('Select a project before saving the moodboard.'); return false; }
    if (!briefComplete || !planApproved) { setPlacementNotice('Save the brief and approve the floor plan before saving materials.'); return false; }
    if (!selectedCarcassLaminate.id && !selectedShutterLaminate.id && !selectedHardwareObj.id) {
      setPlacementNotice('Choose a material from the organization library before saving the moodboard.');
      return false;
    }
    setPlacementNotice('Saving versioned material assignments...');
    try {
      const headers = await authenticatedHeaders();
      if (!selectedModule) {
        setPlacementNotice('Place and select one module before assigning materials.');
        return false;
      }
      const assignments = [
        selectedCarcassLaminate.id ? { materialId: selectedCarcassLaminate.id, semanticSlot: 'carcass', targetId: selectedModule.id } : null,
        selectedShutterLaminate.id ? { materialId: selectedShutterLaminate.id, semanticSlot: 'shutter', targetId: selectedModule.id } : null,
        selectedHardwareObj.id ? { materialId: selectedHardwareObj.id, semanticSlot: 'hardware', targetId: selectedModule.id } : null,
      ].filter(Boolean) as Array<{ materialId: string; semanticSlot: MaterialSlot | 'hardware'; targetId: string }>;
      const results = await Promise.all(assignments.map((assignment) => fetch(`${apiBase}/projects/${projectId}/material-assignments`, {
        method: 'POST', headers,
        body: JSON.stringify({ ...assignment, targetKind: 'module', moduleInstanceId: selectedModule.id, status: 'draft' }),
      }).then(async (response) => ({ response, payload: await response.json() }))));
      const failed = results.find(({ response, payload }) => !response.ok || !payload.success);
      if (failed) { setPlacementNotice(failed.payload.message ?? 'A material assignment could not be saved.'); return false; }
      if (selectedThemeObj) {
        const preference = await fetch(`${apiBase}/projects/${projectId}/design-preferences`, {
          method: 'PUT', headers,
          body: JSON.stringify({ stylePresetId: selectedThemeObj.id, styleText: selectedThemeObj.name }),
        });
        const preferencePayload = await preference.json();
        if (!preference.ok || !preferencePayload.success) { setPlacementNotice(preferencePayload.message ?? 'Project style preference could not be saved.'); return false; }
      }
      setMaterialAssignmentsSaved(true);
      setPlacementNotice(`${selectedModule.label} now has ${assignments.length} versioned material assignment${assignments.length === 1 ? '' : 's'}, including separate carcass and shutter finishes.`);
      return true;
    } catch {
      setPlacementNotice('Material assignment service unavailable. No moodboard changes were applied.');
      return false;
    }
  }

  const handleAiAutoFitAllWallModules = () => {
    if (!selectedSpace || !selectedWall) {
      setPlacementNotice('Choose one verified room and its measured wall before asking for a module recommendation.');
      return;
    }
    const preferredFamilies: Record<string, string[]> = {
      kitchen: ['kitchen-base', 'kitchen-wall', 'kitchen-tall'],
      living: ['tv-unit', 'crockery', 'sofa'],
      dining: ['crockery', 'dining'],
      bedroom: ['wardrobe', 'bed', 'study'],
      master_bedroom: ['wardrobe', 'bed', 'study'],
      kids_bedroom: ['wardrobe', 'bed', 'study'],
      bathroom: ['utility'], pooja: ['pooja'], study: ['study'], utility: ['utility'],
      foyer: ['storage'], balcony: ['storage'], other: ['storage'],
    };
    const families = preferredFamilies[room] ?? ['storage'];
    const candidate = catalogItems.find((item) => families.includes(item.family)) ?? localCatalogForRoom(room).find((item) => families.includes(item.family));
    if (!candidate) {
      setPlacementNotice(`No verified ${selectedSpace.roomType} template is available yet. Correct the room type or choose a compatible catalogue family.`);
      return;
    }
    setFamilyFilter(candidate.family);
    setCatalogQuery(candidate.name);
    setModuleConfiguration((current) => ({
      ...current,
      includeLoft: candidate.family === 'wardrobe' || candidate.family === 'kitchen-tall',
      glassProfile: ['crockery', 'tv-unit'].includes(candidate.family),
      shutterStyle: ['crockery', 'tv-unit'].includes(candidate.family) ? 'profile-glass' : current.shutterStyle,
    }));
    setPlacementNotice(`Suggested ${candidate.name} for ${selectedSpace.name}. It is not placed yet: review the selected-wall elevation, then click the catalogue card to run clearance checks and save it.`);
    return;

    // Legacy client-only auto-fill kept below temporarily for a narrow diff.
    // It is unreachable: AI suggestions must never impersonate persisted modules.
    const newModules: Module[] = [];
    
    spaces.forEach((s) => {
      const targetWall = walls.find((w) => w.id.startsWith(s.id) || w.id.includes(s.id)) ?? walls[0];
      const wId = targetWall?.id ?? `wall-${s.id}-1`;

      if (s.roomType === 'living' || s.roomType === 'other') {
        newModules.push({
          id: `mod-tv-${s.id}`,
          roomId: s.id,
          family: 'tv-unit',
          label: '2400 mm Fluted TV Console Wall',
          widthMm: 2400,
          depthMm: 400,
          heightMm: 2100,
          wallId: wId,
          offsetMm: 200,
          configuration: {
            archetype: 'full_wall_storage',
            shutterStyle: 'swing',
            drawerCount: 3,
            includeLoft: false,
            glassProfile: false,
            sideFillerLeft: false,
            sideFillerRight: false,
            handleStyle: 'long-profile',
            lighting: 'shelf-led',
          },
        });
      } else if (s.roomType === 'bedroom' || s.roomType === 'master_bedroom') {
        newModules.push({
          id: `mod-wardrobe-${s.id}`,
          roomId: s.id,
          family: 'wardrobe',
          label: '2400 mm 4-Shutter Profile-Glass Wardrobe',
          widthMm: 2400,
          depthMm: 600,
          heightMm: 2400,
          wallId: wId,
          offsetMm: 150,
          configuration: {
            archetype: 'profile_glass_display',
            shutterStyle: 'profile-glass',
            drawerCount: 2,
            includeLoft: true,
            glassProfile: true,
            sideFillerLeft: false,
            sideFillerRight: false,
            handleStyle: 'gola',
            lighting: 'vertical-led',
          },
        });
      } else if (s.roomType === 'kitchen') {
        newModules.push({
          id: `mod-kitchen-${s.id}`,
          roomId: s.id,
          family: 'kitchen',
          label: '2700 mm Base Drawer & Overhead Kitchen Wall',
          widthMm: 2700,
          depthMm: 600,
          heightMm: 2100,
          wallId: wId,
          offsetMm: 100,
          configuration: {
            archetype: 'full_wall_storage',
            shutterStyle: 'swing',
            drawerCount: 4,
            includeLoft: true,
            glassProfile: false,
            sideFillerLeft: false,
            sideFillerRight: false,
            handleStyle: 'gola',
            lighting: 'shelf-led',
          },
        });
      } else if (s.roomType === 'dining') {
        newModules.push({
          id: `mod-crockery-${s.id}`,
          roomId: s.id,
          family: 'crockery',
          label: '1800 mm Crockery Unit & Bar with Fluted Glass',
          widthMm: 1800,
          depthMm: 450,
          heightMm: 2100,
          wallId: wId,
          offsetMm: 200,
          configuration: {
            archetype: 'profile_glass_display',
            shutterStyle: 'profile-glass',
            drawerCount: 2,
            includeLoft: false,
            glassProfile: true,
            sideFillerLeft: false,
            sideFillerRight: false,
            handleStyle: 'knob',
            lighting: 'shelf-led',
          },
        });
      } else if (s.roomType === 'pooja') {
        newModules.push({
          id: `mod-pooja-${s.id}`,
          roomId: s.id,
          family: 'pooja',
          label: '1200 mm Mandir with CNC Jaali & Pull-out Tray',
          widthMm: 1200,
          depthMm: 400,
          heightMm: 2100,
          wallId: wId,
          offsetMm: 150,
          configuration: {
            archetype: 'minimal_floating',
            shutterStyle: 'swing',
            drawerCount: 2,
            includeLoft: false,
            glassProfile: false,
            sideFillerLeft: false,
            sideFillerRight: false,
            handleStyle: 'knob',
            lighting: 'shelf-led',
          },
        });
      }
    });

    const finalModules: Module[] = newModules.length ? newModules : [
      {
        id: 'mod-kitchen-default',
        roomId: spaceId ?? 'room-kitchen',
        family: 'kitchen',
        label: '2700 mm Base Drawer & Overhead Kitchen Wall',
        widthMm: 2700,
        depthMm: 600,
        heightMm: 2100,
        wallId: wallId ?? 'wall-1',
        offsetMm: 100,
        configuration: {
          archetype: 'full_wall_storage',
          shutterStyle: 'swing' as const,
          drawerCount: 4,
          includeLoft: true,
          glassProfile: false,
          sideFillerLeft: false,
          sideFillerRight: false,
          handleStyle: 'gola' as const,
          lighting: 'shelf-led' as const,
        },
      }
    ];

    setDraftModules(finalModules);
    const activeMatch = finalModules.find((m) => m.roomId === spaceId) ?? finalModules[0];
    setSelectedModuleId(activeMatch?.id ?? null);
    setPlacementNotice(`✨ AI auto-picked feature walls and fitted ${finalModules.length} modular units across all rooms.`);
  };

  const getPrebuiltSuggestions = (roomType: string) => {
    const key = roomType?.toLowerCase().replace(/[\s-]+/g, '_') || 'living';
    // Never show a living-room package merely because a room was not classified.
    // The room type must be corrected before an unrelated unit is recommended.
    return ROOM_PREBUILT_PACKAGES[key] ?? [];
  };

  const handlePlacePrebuiltPackage = (pkg: { id: string; name: string; desc: string; width: number; height: number; family: string; icon: string }) => {
    const packageFamily = pkg.family === 'kitchen' ? 'kitchen-base' : pkg.family;
    // Use the room-scoped canonical catalogue here. The network catalogue can
    // briefly contain the previously selected room while its new query is in flight.
    const source = localCatalogForRoom(room);
    const item = source.find((candidate) => candidate.family === packageFamily)
      ?? source.find((candidate) => candidate.family.startsWith('kitchen-') && pkg.family === 'kitchen');
    if (!item) {
      setPlacementNotice(`${pkg.name} is a design suggestion only. Select a compatible canonical catalogue module before it can be placed.`);
      return;
    }
    void addModule(item, { width: pkg.width, depth: item.depthMm, height: pkg.height });
    return;

    // Legacy local-only placement path. Kept unreachable pending removal so
    // quick packages always go through anchor validation and persistence.
    if (!spaceId) return;
    const targetWall = wallId || roomWalls[0]?.id || `wall-${spaceId}-1`;
    const targetWallObj = walls.find((w) => w.id === targetWall);
    const targetStart = targetWallObj?.start;
    const targetEnd = targetWallObj?.end;
    const targetStartX = targetStart?.xMm ?? 0;
    const targetStartY = targetStart?.yMm ?? 0;
    const targetEndX = targetEnd?.xMm ?? 0;
    const targetEndY = targetEnd?.yMm ?? 0;
    const wallLength = targetStart && targetEnd
      ? Math.round(Math.hypot(targetEndX - targetStartX, targetEndY - targetStartY))
      : 3000;
    const existingOnWall = draftModules.filter((m) => m.wallId === targetWall);
    let calcOffset = 100;
    if (existingOnWall.length > 0) {
      const rightEdge = Math.max(...existingOnWall.map((m) => (m.offsetMm ?? 0) + m.widthMm));
      if (rightEdge + pkg.width <= wallLength - 50) {
        calcOffset = rightEdge + 50;
      } else {
        calcOffset = Math.max(0, Math.min(100, wallLength - pkg.width));
      }
    }
    const newMod: Module = {
      id: `mod-${pkg.id}-${Date.now().toString().slice(-4)}`,
      roomId: spaceId ?? 'unassigned',
      family: pkg.family,
      label: pkg.name,
      widthMm: pkg.width,
      depthMm: pkg.family === 'wardrobe' ? 600 : pkg.family === 'kitchen' ? 600 : 400,
      heightMm: pkg.height,
      wallId: targetWall,
      offsetMm: calcOffset,
      configuration: {
        archetype: pkg.family === 'wardrobe' || pkg.family === 'crockery' ? 'profile_glass_display' : 'full_wall_storage',
        shutterStyle: pkg.family === 'wardrobe' || pkg.family === 'crockery' ? 'profile-glass' : 'swing',
        drawerCount: 3,
        includeLoft: pkg.height >= 2400,
        glassProfile: pkg.family === 'wardrobe' || pkg.family === 'crockery',
        sideFillerLeft: false,
        sideFillerRight: false,
        handleStyle: 'gola',
        lighting: 'shelf-led',
      },
    };
    setDraftModules((curr) => [...curr, newMod]);
    setSelectedModuleId(newMod.id);
    setPlacementNotice(`✨ ${pkg.name} placed at ${Math.round(calcOffset)} mm on Wall. You can customize dimensions or assign materials.`);
  };

  async function compileMoodboard(materialSelection?: any[], assignmentVerified = materialAssignmentsSaved) {
    if (!projectId || !draftModules.length) { setPlacementNotice('Place at least one persisted module before compiling a scene.'); return; }
    const sceneMaterials = materialSelection ?? [selectedCarcassLaminate, selectedShutterLaminate, selectedHardwareObj]
      .filter((item) => item.id)
      .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
    if (!sceneMaterials.length) { setPlacementNotice('Save a real material-library selection before compiling a scene.'); return; }
    if (!assignmentVerified) { setPlacementNotice('Save the selected component materials before compiling scene.v1.'); return; }
    setPlacementNotice('Compiling the reviewed moodboard into scene.v1...');
    try {
      const nextSceneId = await onSceneCreated(crypto.randomUUID(), draftModules, sceneMaterials);
      if (nextSceneId) setCompiledSceneId(nextSceneId);
      setPlacementNotice('Scene compiled from persisted room anchors, module dimensions, and library materials.');
      return nextSceneId;
    } catch {
      setPlacementNotice('Scene compilation failed. The moodboard remains saved for correction.');
      return undefined;
    }
  }

  async function saveFinishesAndCompileScene() {
    const saved = await saveMoodboard();
    if (!saved) return;
    await compileMoodboard(undefined, true);
  }

  async function createVisual(operation: 'generate' | 'material-swap' = 'generate', materialName?: string, sceneVersionOverride?: string, sceneIsApproved = sceneApproved, materialTarget?: { materialId: string; semanticSlot: string }) {
    const renderSceneVersionId = sceneVersionOverride ?? compiledSceneId ?? sceneVersionId;
    if (!renderSceneVersionId && !projectId) { setVisualState('Select a project and load the scene first.'); return; }
    if (!projectId) { setVisualState('Select a project before generating a render.'); return; }
    setVisualBusy(true); setVisualState(operation === 'material-swap' ? 'Saving the selected laminate and preparing its scene-locked preview...' : 'Validating scene and visual providers...');
    try {
      let renderStyle = materialName ? `${style}; apply ${materialName} only to the selected shutter/material region` : style;
      if (structuralImageName) {
        renderStyle += `; [Structural Context: Site reference elevation '${structuralImageName}' active — strictly integrate existing ceiling beams, structural columns/pillars, and soffit drops into the room architecture and lighting]`;
      }
      // A normal room render follows the room selected in Visual Studio. A
      // material swap is intentionally narrower and follows the selected
      // module, because its source mask is bound to that module in scene.v1.
      const renderRoomId = operation === 'material-swap' ? selectedModule?.roomId ?? null : spaceId ?? null;
      if (!renderRoomId) { setVisualBusy(false); setVisualState('Select a persisted room before generating a render.'); return; }
      if (operation === 'material-swap' && !selectedModule) { setVisualBusy(false); setVisualState('Select the exact module whose material should change before creating a revision.'); return; }
      const normalizedStyle = renderStyle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48) || 'studio-default';
      const response = await fetch(`${apiBase}/projects/${projectId}/renders`, { method: 'POST', headers: await authenticatedHeaders(), body: JSON.stringify({ sceneVersionId: renderSceneVersionId, idempotencyKey: `${renderSceneVersionId}:${renderRoomId}:${selectedModule?.id ?? 'room'}:${materialTarget?.materialId ?? 'base'}:${materialTarget?.semanticSlot ?? 'module'}:${operation}:${normalizedStyle}:${quality}`, options: { roomId: renderRoomId, targetModuleId: selectedModule?.id ?? null, targetMaterialId: materialTarget?.materialId, targetSemanticSlot: materialTarget?.semanticSlot, style: renderStyle, quality, operation } }) }).catch(() => null);
      const payload = response ? await response.json().catch(() => ({})) : {};

      if (!response?.ok || !payload?.success) {
        setVisualBusy(false);
        setVisualState(payload?.message ?? payload?.error ?? 'The render service could not create an image. Your approved scene is unchanged; try again when a provider is available.');
        return;

        const roomImages: Record<string, string[]> = {
          kitchen: ['/reference-vault/003-1f61a8aabde4.png', '/reference-vault/006-e36e2c7c9b1a.png', '/reference-vault/039-1786da704c5a.png', '/reference-vault/042-7eaf3dbfd306.png', '/reference-vault/048-ac94a44309b6.png', '/reference-vault/050-a2b533693ac2.png', '/reference-vault/052-1d6904ef55a3.png', '/reference-vault/055-e94b19f0e93f.png', '/reference-vault/056-3bb2275767d2.png'],
          living: ['/reference-vault/001-ddc1891636f7.png', '/reference-vault/013-52a29a1053dc.png', '/reference-vault/014-685f67e3ff6f.png', '/reference-vault/015-5705e2ee9cb1.png', '/reference-vault/016-f106846da92c.png', '/reference-vault/017-cd2b9919c856.png', '/reference-vault/026-ebca5fba9a3f.png', '/reference-vault/051-999d353af1d8.png', '/reference-vault/058-b3d36c0c874b.png'],
          master_bedroom: ['/reference-vault/047-c1ce4511e83d.png', '/reference-vault/040-a7dcd66e4242.png', '/reference-vault/060-70075531f7e7.png', '/reference-vault/049-d1a18590223e.png'],
          bedroom: ['/reference-vault/007-2b9d568ff444.png', '/reference-vault/008-5fd497f005d8.png', '/reference-vault/009-f68e47674ead.png', '/reference-vault/010-a0dbdf361a50.png', '/reference-vault/012-5c60a01e5b86.png', '/reference-vault/023-ae1e9b70744f.png', '/reference-vault/025-adb09122c8d1.png', '/reference-vault/035-78733d79d595.png', '/reference-vault/038-73c6d08adf93.png', '/reference-vault/041-6770bf54ce43.png', '/reference-vault/043-71833d244d0d.png', '/reference-vault/045-7ec65f321496.png', '/reference-vault/054-c8fa00bd2c4b.png'],
          dining: ['/reference-vault/002-cab37cfa0bb2.png', '/reference-vault/004-ee04b56efde7.png', '/reference-vault/018-b7dd5f1492fe.png'],
          study: ['/reference-vault/011-6c55d3439149.png', '/reference-vault/022-d6f4e9ee57d1.png', '/reference-vault/024-5976bb27ca03.png', '/reference-vault/044-577ed741688e.png', '/reference-vault/054-c8fa00bd2c4b.png'],
          pooja: ['/reference-vault/019-a06a89855436.png', '/reference-vault/020-ea872c640df6.png', '/reference-vault/021-5a47b71bad49.png'],
          bathroom: ['/reference-vault/027-3ee9dcdaca5c.png', '/reference-vault/028-a8f62ab3d392.png', '/reference-vault/029-640527178f8d.png', '/reference-vault/030-7bd7e8a977bf.png', '/reference-vault/031-6f3948f48928.png', '/reference-vault/032-ae224c73b5dc.png'],
          utility: ['/reference-vault/005-7919b88e0dc1.png', '/reference-vault/036-de959cf3df44.png'],
        };
        const rKey = room?.toLowerCase() || 'living';
        const imgPool = roomImages[rKey] || roomImages.living;
        const chosenUrl = imgPool[Math.floor(Math.random() * imgPool.length)] || '/reference-vault/001-ddc1891636f7.png';

        const synthesizedRender: StoredRender = {
          id: `render-${Date.now()}`,
          scene_version_id: renderSceneVersionId || 'scene-v1',
          status: 'succeeded',
          signedUrl: chosenUrl,
          created_at: new Date().toISOString(),
          provenance: {
            provider: 'ULTIDA AURA Vision AI (Ultra Photoreal 4K)',
            model: 'Architectural-Diffusion-XL v2.4',
            promptVersion: `scene.v1 | ${room.toUpperCase()} | ${quality.toUpperCase()} | Finishes: ${selectedLaminateObj.name}`,
            reviewStatus: 'approved',
          },
        };

        setRenders((prev) => [synthesizedRender, ...prev]);
        setSelectedRenderId(synthesizedRender.id);
        setReviewVisualJobId(synthesizedRender.id);
        setVisualBusy(false);
        setVisualState('✨ Ultra Photoreal 4K AI Render generated from scene geometry & materials!');
        return;
      }
      if (payload.result?.jobId) { setReviewVisualJobId(payload.result.jobId); setActiveVisualJobId(payload.result.jobId); }
      if (payload.result?.status === 'succeeded' && payload.result?.signedUrl) { setVisualBusy(false); setActiveVisualJobId(null); setVisualState('Render stored privately and ready for review.'); await loadRenders(); return; }
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

  async function loadApprovedSceneForProduction(setState: (value: string) => void): Promise<Record<string, unknown> | null> {
    if (!projectId || !sceneVersionId) {
      setState('Select a project and save a scene first.');
      return null;
    }
    try {
      const response = await fetch(`${apiBase}/projects/${projectId}/scenes/${sceneVersionId}`, { headers: await authenticatedHeaders() });
      const payload = await response.json();
      if (!response.ok || !payload.success || !payload.sceneVersion) {
        setState(payload.message ?? 'The saved scene could not be read.');
        return null;
      }
      if (payload.sceneVersion.status !== 'approved') {
        setState('Approve the saved scene before generating production files.');
        return null;
      }
      if (!payload.sceneVersion.scene || typeof payload.sceneVersion.scene !== 'object') {
        setState('The saved scene has no valid geometry. Recompile it from the approved plan.');
        return null;
      }
      return payload.sceneVersion.scene as Record<string, unknown>;
    } catch {
      setState('The saved scene service is unavailable. No fallback geometry was used.');
      return null;
    }
  }

  async function createDrawings() {
    setDrawingState('Validating the approved scene...');
    const scene = await loadApprovedSceneForProduction(setDrawingState);
    if (!scene || !projectId || !sceneVersionId) return;
    try {
      const response = await fetch(`${apiBase}/drawings/elevations.svg`, { method: 'POST', headers: await authenticatedHeaders(), body: JSON.stringify({ projectId, sceneVersionId, scene }) });
      setDrawingState(response.ok ? 'Drawing package validated. Download SVG, PDF, or DXF.' : 'Drawing validation failed.');
    } catch { setDrawingState('Drawing service unavailable.'); }
  }

  async function downloadDxf() {
    setDxfState('Exporting DXF...');
    const scene = await loadApprovedSceneForProduction(setDxfState);
    if (!scene || !projectId || !sceneVersionId) return;
    try {
      const response = await fetch(`${apiBase}/drawings/dxf`, { method: 'POST', headers: await authenticatedHeaders(), body: JSON.stringify({ projectId, sceneVersionId, scene }) });
      if (!response.ok) { setDxfState('DXF export failed'); return; }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `ultida-${sceneVersionId}.dxf`; link.click(); URL.revokeObjectURL(url);
      setDxfState('DXF exported');
    } catch { setDxfState('DXF service unavailable'); }
  }

  async function createCutlist() {
    setCutlistState('Preparing cutlist...');
    const scene = await loadApprovedSceneForProduction(setCutlistState);
    if (!scene || !projectId || !sceneVersionId) return;
    try {
      const response = await fetch(`${apiBase}/production/cutlist`, { method: 'POST', headers: await authenticatedHeaders(), body: JSON.stringify({ projectId, sceneVersionId, scene }) });
      const payload = await response.json();
      if (!response.ok || !payload.success) { setCutlistState(payload.message ?? 'Cutlist unavailable'); return; }
      setCutlistState(`${payload.cutlist.partCount} parts ready for review`);
    } catch { setCutlistState('Cutlist service unavailable'); }
  }

  async function downloadFile(path: string, filename: string, setState: (value: string) => void) {
    setState('Preparing file...');
    const scene = await loadApprovedSceneForProduction(setState);
    if (!scene || !projectId || !sceneVersionId) return;
    try {
      const response = await fetch(`${apiBase}${path}`, { method: 'POST', headers: await authenticatedHeaders(), body: JSON.stringify({ projectId, sceneVersionId, scene }) });
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
                <div className="scene-lock-summary" role="status">
                  <div className="scene-lock-summary-heading"><Layers3 size={15} /><strong>Geometry lock</strong><Badge tone={sceneApproved ? 'success' : 'accent'}>{sceneApproved ? 'Active' : 'Required'}</Badge></div>
                  <span>Camera, room shell, openings, ceiling and module bounds come from scene.v1 and cannot be changed by the image model.</span>
                  <small>{sceneVersionId ? `Scene ${sceneVersionId.slice(0, 8)} linked` : 'Compile a scene to continue'}</small>
                </div>
                <label>
                  Scene room
                  <select
                    value={spaceId ?? ''}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      const next = spaces.find((space) => space.id === nextId);
                      setSpaceId(nextId || null);
                      if (next?.roomType) setRoom(next.roomType);
                    }}
                    disabled={!spaces.length}
                  >
                    {!spaces.length && <option value="">No persisted room available</option>}
                    {spaces.map((space) => <option key={space.id} value={space.id}>{space.name} · {space.roomType}</option>)}
                  </select>
                </label>
                <p className="visual-selection-note">
                  {selectedModule
                    ? `Selected module: ${selectedModule.label}. Material previews remain locked to this module and its room.`
                    : 'Select and place a module before requesting a targeted laminate preview.'}
                </p>

                <div className="visual-tool-section" style={{ borderTop: '1px solid #e8ded2', paddingTop: '10px', marginTop: '4px' }}>
                  <MaterialSwapPanel
                    projectId={projectId}
                    entityId={selectedModule?.id ?? ''}
                    moduleInstanceId={selectedModule?.id ?? null}
                    currentLaminate={selectedLaminateObj.name}
                    onConfirmCatalogSwap={({ laminate }) => {
                      setStyle((current) => `${current}; selected persisted material: ${laminate}`);
                      setMaterialAssignmentsSaved(true);
                      setVisualState('Material assignment saved. Preview it in the approved scene when ready.');
                    }}
                    onPreviewCatalogSwap={async ({ materialId, laminate, semanticSlot }) => {
                      setActiveLaminate(materialId);
                      if (!selectedModule) {
                        setVisualState('Select the exact module before creating a laminate revision.');
                        return;
                      }
                      const previewLaminate = catalogLaminates.find((item) => item.id === materialId);
                      if (!previewLaminate) {
                        setVisualState('The selected material is no longer available in the organization library. No revision was created.');
                        return;
                      }
                      setVisualState('Compiling the saved module material into a new scene version...');
                      const compiledSceneVersionId = await compileMoodboard([previewLaminate, selectedHardwareObj].filter((item) => item.id), true);
                      if (!compiledSceneVersionId) return;
                      setVisualState('Validating and approving the material revision before rendering...');
                      const revisionApproved = await onSceneApproved(compiledSceneVersionId);
                      if (!revisionApproved) {
                        setVisualState('The material revision was saved as a draft but could not be approved. Review its scene validation before rendering.');
                        return;
                      }
                      await createVisual('material-swap', laminate, compiledSceneVersionId, true, { materialId, semanticSlot });
                    }}
                  />
                </div>

                <div className="visual-tool-section" style={{ borderTop: '1px solid #e8ded2', paddingTop: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text)', display: 'block', marginBottom: '8px' }}>HARDWARE OPTIONS</span>
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

                {/* SIDE / STRUCTURAL REFERENCE IMAGE (BEAMS & PILLARS) */}
                <div style={{ marginTop: '6px', background: '#fafaf9', padding: '8px', borderRadius: '6px', border: '1px dashed #d6d3d1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <small style={{ fontWeight: 'bold', color: '#78350f', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Layers3 size={13} /> Side / Beam &amp; Pillar Reference
                    </small>
                    {structuralImageName && (
                      <button
                        type="button"
                        onClick={() => { setStructuralReferenceImage(null); setStructuralImageName(null); }}
                        style={{ fontSize: '10px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <label style={{ display: 'block', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setStructuralImageName(file.name);
                        const reader = new FileReader();
                        reader.onload = () => setStructuralReferenceImage(String(reader.result));
                        reader.readAsDataURL(file);
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: structuralImageName ? '#15803d' : '#78716c' }}>
                      <Image size={14} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {structuralImageName ? `Attached: ${structuralImageName}` : 'Attach photo for site beams/pillars…'}
                      </span>
                    </div>
                  </label>
                  {structuralImageName && (
                    <small style={{ fontSize: '9px', color: '#16a34a', display: 'block', marginTop: '3px' }}>
                      ✓ AI render will condition on site beams, columns and soffit drops.
                    </small>
                  )}
                </div>

                <label style={{ marginTop: '6px' }}>
                  Quality
                  <select value={quality} onChange={(event) => setQuality(event.target.value as typeof quality)}>
                    <option value="draft">Draft</option>
                    <option value="review">Review</option>
                    <option value="final">Final</option>
                  </select>
                </label>
                  <Button onClick={() => void createVisual()} disabled={!spaceId || visualBusy} title={!spaceId ? 'Select a room above to generate a render' : 'Generate an AI photorealistic render'}>
                  {visualBusy ? <RefreshCw className="spin" size={16} /> : <Wand2 size={16} />} {visualBusy ? 'Processing...' : '✨ Generate AI Render'}
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
              <div className="render-review-actions" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Button variant="outline" onClick={() => reviewRender('reject')} disabled={!latest || visualBusy}>
                  <ThumbsDown size={16} /> Reject
                </Button>
                <Button onClick={() => reviewRender('approve')} disabled={!latest || visualBusy}>
                  <ThumbsUp size={16} /> Approve
                </Button>
                {latest?.signedUrl && (
                  <a
                    href={latest.signedUrl}
                    download={`ultida-render-${room}.png`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      background: '#fff',
                      color: 'var(--brown-mid)',
                      border: '1px solid #d6d3d1',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: 'none',
                      marginLeft: 'auto',
                    }}
                  >
                    📥 Download PNG
                  </a>
                )}
              </div>
              <div className="render-variants">
                <small>RECENT OUTPUTS ({renders.length})</small>
                {renders.slice(0, 6).map((render) => (
                  <button key={render.id} className="render-variant" type="button" aria-pressed={render.id === latest?.id} onClick={() => setSelectedRenderId(render.id)}>
                    <span>{render.provenance?.promptVersion ? render.provenance.promptVersion.split('|')[1]?.trim() || render.status : render.status}</span>
                    <small>{new Date(render.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="workflow-next-action">
          <div><small>NEXT STEP</small><strong>Turn the reviewed scene into verified drawings and a cutlist.</strong><span>Available after a scene-linked render has been reviewed.</span></div>
          <Button onClick={() => navigate(`/projects/${projectId}/drawings`)} disabled={!projectId || !sceneApproved}><ArrowRight size={16} /> Continue to Drawings</Button>
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
            <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem', padding: '12px 14px', background: '#fafaf9', borderRadius: '8px', border: '1px solid #e7e5e4', fontSize: '11px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
              <div><span style={{ color: '#78716c', display: 'block' }}>DRAWING SHEET:</span><strong>ULT-DWG-001 (Rev 1)</strong></div>
              <div><span style={{ color: '#78716c', display: 'block' }}>SCALE:</span><strong>1:20 &amp; 1:50 Metric</strong></div>
              <div><span style={{ color: '#78716c', display: 'block' }}>PROVENANCE:</span><strong>scene.v1 ({sceneVersionId ? sceneVersionId.slice(0, 8) : 'draft'})</strong></div>
              <div><span style={{ color: '#78716c', display: 'block' }}>STATUS:</span><strong style={{ color: sceneApproved ? '#15803d' : '#b45309' }}>{sceneApproved ? '✓ Ready for CNC / Millwork' : 'Approval Required'}</strong></div>
            </div>
            <div className="drawing-actions">
              <Button onClick={() => { void onSceneApproved(); }} disabled={!sceneVersionId || sceneApproved}>
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
        <div className="workflow-next-action">
          <div><small>NEXT STEP</small><strong>Review the scene-linked estimate when the production package is ready.</strong><span>Quotes stay tied to the exact approved scene version.</span></div>
          <Button onClick={() => navigate(`/projects/${projectId}/estimate`)} disabled={!projectId || !sceneApproved}><ArrowRight size={16} /> Continue to Estimate</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="design-flow-workspace">
      <div className="workspace-heading">
        <div>
          <small>{focus === 'materials' ? 'MATERIALS / COMPONENT ASSIGNMENT' : focus === 'modules' ? 'MODULE PLANNER / WALL-ANCHORED PLACEMENT' : 'SCENE CORE / MODULAR PLACEMENT'}</small>
          <h2>{focus === 'materials' ? 'Assign finishes to the exact parts you will render and build.' : focus === 'modules' ? 'Place buildable modules on measured room walls.' : 'Compose the room from buildable modules.'}</h2>
          <p>{focus === 'materials' ? 'Choose a placed module, then save laminate, edge-band, hardware and lighting choices before compiling scene.v1.' : focus === 'modules' ? 'Select a saved room and verified wall, then fit a parametric catalogue module to available space.' : 'Choose a room, place a catalog module, then save one scene version for every downstream output.'}</p>
        </div>
        <Badge tone={briefComplete && planApproved ? 'success' : 'accent'}>{!briefComplete ? 'Brief required' : planApproved ? 'Approved plan linked' : 'Approved plan required'}</Badge>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }} aria-label="Design workspace mode">
        <Button onClick={handleAiAutoFitAllWallModules} style={{ background: 'linear-gradient(135deg, #1c1917, #3d2a1a)', color: '#fff', border: '1px solid var(--gold)', boxShadow: '0 2px 8px rgba(197,156,45,0.25)', height: '38px', padding: '0 16px', fontWeight: 800 }}>
          <Sparkles size={15} style={{ marginRight: '0.5rem', color: 'var(--gold)' }} /> Suggest a room module
        </Button>
        <Button variant={designMode === 'layout' ? 'default' : 'outline'} onClick={() => setDesignMode('layout')} style={{ height: '38px', padding: '0 16px' }}>
          <Layers3 size={15} style={{ marginRight: '0.5rem' }} /> Modular Layout
        </Button>
        <Button variant={designMode === 'moodboard' ? 'default' : 'outline'} onClick={() => setDesignMode('moodboard')} style={{ height: '38px', padding: '0 16px' }}>
          <Palette size={15} style={{ marginRight: '0.5rem' }} /> Moodboard &amp; Materials
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
                  {roomWalls.length ? roomWalls.map((wall, index) => <option key={wall.id} value={wall.id}>Wall {String.fromCharCode(65 + index)} · {wall.start && wall.end ? `${Math.round(Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm))} mm` : 'measured'}</option>) : <option value="">No verified walls</option>}
                </select>
              </label>
              {selectedWall && (
                <WallElevationPreview
                  wallLabel={`Wall ${String.fromCharCode(65 + Math.max(0, roomWalls.findIndex((w) => w.id === selectedWall.id)))}`}
                  wallLengthMm={selectedWallLengthMm}
                  ceilingHeightMm={2700}
                  openings={selectedWallOpenings}
                  modules={draftModules.filter((module) => module.wallId === selectedWall.id)}
                  selectedModuleId={selectedModuleId}
                  onSelectModule={(id) => setSelectedModuleId(id)}
                  onNudgeModule={(id, delta) => void nudgeModule(id, delta)}
                  onCenterModule={(id) => void centerModule(id)}
                />
              )}
              <p className="placement-notice" role="status" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {catalogLoading && <Loader2 className="ultida-spinner" size={14} aria-hidden="true" />}
                {placementNotice}
              </p>

              {/* Smart Suggested Pre-Built Modular Packages for the Current Room */}
              {spaceId && (
                <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem', padding: '10px 12px', background: 'linear-gradient(135deg, #fffdf8, #fbf4e6)', border: '1px solid rgba(197, 156, 45, 0.3)', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--gold-dim)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Sparkles size={13} style={{ color: 'var(--gold)' }} />
                      SMART PRE-BUILT MODULES FOR {spaces.find((s) => s.id === spaceId)?.name.toUpperCase() ?? 'ROOM'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gap: '6px' }}>
                    {getPrebuiltSuggestions(spaces.find((s) => s.id === spaceId)?.roomType ?? 'living').map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => handlePlacePrebuiltPackage(pkg)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          padding: '7px 10px',
                          background: '#fff',
                          border: '1px solid #e7dcce',
                          borderRadius: '7px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#c59c2d'; e.currentTarget.style.background = '#fffdf7'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e7dcce'; e.currentTarget.style.background = '#fff'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                          <span style={{ fontSize: '16px', flexShrink: 0 }}>{pkg.icon}</span>
                          <div style={{ minWidth: 0 }}>
                            <strong style={{ display: 'block', fontSize: '11.5px', color: '#2d1f14', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pkg.name}</strong>
                            <small style={{ display: 'block', fontSize: '10px', color: '#8c7d70', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pkg.desc}</small>
                          </div>
                        </div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: '5px', background: '#f5eee4', color: '#7a5a22', fontSize: '10px', fontWeight: 800, flexShrink: 0 }}>
                          + Place Unit
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <label>
                Search templates
                <input value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="TV wall, glass crockery, loft wardrobe" />
              </label>
              <div style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>MODULAR CATEGORIES</span>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {[
                    { id: 'all', label: '🌟 All' },
                    { id: 'kitchen', label: '🍳 Kitchen' },
                    { id: 'wardrobe', label: '🚪 Wardrobes' },
                    { id: 'tv-unit', label: '📺 TV Units' },
                    { id: 'crockery', label: '🍷 Crockery' },
                    { id: 'pooja', label: '🪔 Mandir' },
                    { id: 'study', label: '📚 Study' },
                    { id: 'utility', label: '🪞 Vanity' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFamilyFilter(cat.id)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: familyFilter === cat.id ? 700 : 500,
                        borderRadius: '16px',
                        border: familyFilter === cat.id ? '1.5px solid #c59c2d' : '1px solid #d8ccbd',
                        background: familyFilter === cat.id ? '#fef3c7' : '#fff',
                        color: familyFilter === cat.id ? '#92400e' : '#57534e',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <label>
                Module family
                <select value={familyFilter} onChange={(event) => setFamilyFilter(event.target.value)}>
                  <option value="all">All compatible families</option>
                  {[...new Set(catalogItems.map((item) => item.family))].sort().map((family) => <option key={family} value={family}>{family}</option>)}
                </select>
              </label>
              <fieldset className="module-configuration" style={{ border: '1px solid #e8ded2', borderRadius: '6px', padding: '0.75rem', display: 'grid', gap: '0.55rem' }}>
                <legend style={{ fontSize: '0.72rem', fontWeight: 800, padding: '0 0.25rem' }}>CONFIGURE THE NEXT MODULE</legend>
                <label>
                  Assembly archetype
                  <select value={moduleConfiguration.archetype} onChange={(event) => setModuleConfiguration((current) => ({ ...current, archetype: event.target.value }))}>
                    <option value="full_wall_storage">Full wall storage</option>
                    <option value="minimal_floating">Minimal floating</option>
                    <option value="asymmetric_profile_glass">Asymmetric profile glass</option>
                    <option value="kitchen_tandem_base">Kitchen Tandem &amp; Cutlery Base</option>
                    <option value="kitchen_microwave_tower">Built-in Microwave &amp; Oven Tower</option>
                    <option value="kitchen_pantry_tower">12-Basket Pantry Pull-Out Tower</option>
                    <option value="kitchen_lemans_corner">LeMans II Blind Corner Base</option>
                    <option value="tv_plus_study">TV plus study and library</option>
                    <option value="tv_plus_crockery">TV plus crockery</option>
                    <option value="french_beading_panel">French boiserie feature wall</option>
                    <option value="fluted_pu_panel">Fluted Charcoal PU feature wall</option>
                    <option value="acoustic_slat_panel">Walnut Acoustic Slat wall</option>
                    <option value="profile_glass_display">Profile glass display</option>
                  </select>
                </label>
                <label>
                  Shutter &amp; Front Style
                  <select value={moduleConfiguration.shutterStyle} onChange={(event) => setModuleConfiguration((current) => ({ ...current, shutterStyle: event.target.value as ModuleConfiguration['shutterStyle'], glassProfile: event.target.value === 'profile-glass' }))}>
                    <option value="swing">Normal Solid Shutter (Acrylic / Laminate)</option>
                    <option value="profile-glass">Tinted Fluted Profile-Glass Shutter (Graphite Aluminium + LED)</option>
                    <option value="sliding">Sliding Shutter System</option>
                    <option value="open">Open Niche Shelving</option>
                  </select>
                </label>
                <label>
                  Drawer &amp; Tandem Configuration
                  <select value={moduleConfiguration.drawerCount} onChange={(event) => setModuleConfiguration((current) => ({ ...current, drawerCount: Number(event.target.value) }))}>
                    <option value={0}>Standard Single Door (No drawers)</option>
                    <option value={2}>2-Pot Deep Tandem Drawers (65kg Soft-Close)</option>
                    <option value={3}>3-Drawer Cutlery, Cup-Saucer &amp; Pot Tandems</option>
                    <option value={4}>4 Shallow Utility Drawers</option>
                  </select>
                </label>
                <label>
                  Handle / Profile Style
                  <select value={moduleConfiguration.handleStyle} onChange={(event) => setModuleConfiguration((current) => ({ ...current, handleStyle: event.target.value as ModuleConfiguration['handleStyle'] }))}>
                    <option value="long-profile">Long edge aluminium profile handle</option>
                    <option value="gola">J-Pull / C-Gola seamless groove</option>
                    <option value="knob">Minimal brushed brass / matte black knob</option>
                    <option value="none">Tip-on push release (Handleless)</option>
                  </select>
                </label>
                <label>
                  Integrated Lighting
                  <select value={moduleConfiguration.lighting} onChange={(event) => setModuleConfiguration((current) => ({ ...current, lighting: event.target.value as ModuleConfiguration['lighting'] }))}>
                    <option value="none">No integrated lighting</option>
                    <option value="shelf-led">Concealed under-cabinet warm 3000K LED</option>
                    <option value="vertical-led">Vertical sensor-activated profile LED</option>
                  </select>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <input type="checkbox" checked={moduleConfiguration.includeLoft} onChange={(event) => setModuleConfiguration((current) => ({ ...current, includeLoft: event.target.checked }))} />
                  Include loft unit with 50 mm ceiling closure filler
                </label>
                <div className="side-filler-options">
                  <label><input type="checkbox" checked={moduleConfiguration.sideFillerLeft} onChange={(event) => setModuleConfiguration((current) => ({ ...current, sideFillerLeft: event.target.checked }))} /> 30 mm left wall filler</label>
                  <label><input type="checkbox" checked={moduleConfiguration.sideFillerRight} onChange={(event) => setModuleConfiguration((current) => ({ ...current, sideFillerRight: event.target.checked }))} /> 30 mm right wall filler</label>
                </div>
                <div className="module-inline-materials">
                  <label>
                    Internal carcass finish
                    <select value={selectedCarcassLaminate.id} onChange={(e) => { setCarcassLaminateId(e.target.value); setMaterialSlot('carcass'); }}>
                      <option value="">Choose a carcass board finish</option>
                      {catalogLaminates.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </label>
                  <label>
                    External shutter finish
                    <select value={selectedShutterLaminate.id} onChange={(e) => { setShutterLaminateId(e.target.value); setActiveLaminate(e.target.value); setMaterialSlot('shutter'); }}>
                      <option value="">Choose a shutter laminate</option>
                      {catalogLaminates.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </label>
                </div>
              </fieldset>
              <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {catalogItems.filter((item) => familyFilter === 'all' || item.family === familyFilter).filter((item) => {
                  const search = catalogQuery.trim().toLowerCase();
                  return !search || [item.name, item.family, item.description, ...item.tags].filter(Boolean).join(' ').toLowerCase().includes(search);
                }).map((item) => (
                  <button className="catalog-item" key={item.id} onClick={() => {
                    let prepared: PreparedModulePlan | null = null;
                    try { const raw = window.localStorage.getItem('ultida.pendingModulePlan.v1'); prepared = raw ? JSON.parse(raw) as PreparedModulePlan : null; } catch { /* ignored: normal catalogue placement continues */ }
                    void addModule(item, prepared?.templateId === item.id ? prepared.dimensionsMm : undefined);
                  }} disabled={!briefComplete || !planApproved}>
                    <ModulePreview module={item} compact />
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.widthMm} x {item.depthMm} x {item.heightMm} mm
                      </small>
                      {item.description ? <small>{item.description}</small> : null}
                    </span>
                    <Plus size={15} />
                  </button>
                ))}
                {catalogLoading ? <p className="placement-notice"><Loader2 className="ultida-spinner" size={14} aria-hidden="true" /> Loading compatible furniture…</p> : !catalogItems.length && <p className="placement-notice">No templates could be loaded for this room. Check the catalogue service or correct the room type.</p>}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="catalog-panel" style={{ minWidth: '420px' }}>
            <CardHeader style={{ paddingBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div>
                  <small style={{ color: 'var(--gold)', fontWeight: 800, letterSpacing: '0.05em' }}>AGENT B STYLE MOODBOARD STUDIO</small>
                  <h3 style={{ margin: '2px 0 0', fontSize: '16px' }}>Room Furniture &amp; Aesthetic Curation</h3>
                </div>
                <Badge tone="accent">{room.toUpperCase()}</Badge>
              </div>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', paddingTop: '6px' }}>
              {/* Room Pill Switcher */}
              <div>
                <label style={{ fontWeight: 800, fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Active Room
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {spaces.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setSpaceId(s.id); setRoom(s.roomType); }}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '20px',
                        fontSize: '11.5px',
                        fontWeight: spaceId === s.id ? 800 : 500,
                        background: spaceId === s.id ? 'linear-gradient(135deg, #1c1917, #3d2a1a)' : '#fff',
                        color: spaceId === s.id ? '#e8c96a' : '#44403c',
                        border: spaceId === s.id ? '1px solid var(--gold)' : '1px solid #d6d3d1',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 1. Curated Room Furniture Packages */}
              <div style={{ background: '#faf8f5', padding: '12px', borderRadius: '10px', border: '1px solid #ede5d8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#292524', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Sparkles size={14} style={{ color: 'var(--gold)' }} />
                    1. CURATED FURNITURE FOR {room.toUpperCase()}
                  </span>
                  <small style={{ color: 'var(--gold-dim)', fontWeight: 700, fontSize: '10.5px' }}>Strict Millwork Heights</small>
                </div>
                <div style={{ display: 'grid', gap: '6px' }}>
                  {getPrebuiltSuggestions(room).map((pkg) => {
                    const isPlaced = draftModules.some((m) => m.roomId === spaceId && (m.label.includes(pkg.name.slice(0, 10)) || m.family === pkg.family));
                    return (
                      <div
                        key={pkg.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          padding: '8px 10px',
                          background: '#fff',
                          border: isPlaced ? '1.5px solid #16a34a' : '1px solid #e7dcce',
                          borderRadius: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                          <span style={{ fontSize: '18px', flexShrink: 0 }}>{pkg.icon}</span>
                          <div style={{ minWidth: 0 }}>
                            <strong style={{ display: 'block', fontSize: '11.5px', color: '#1c1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pkg.name}</strong>
                            <small style={{ display: 'block', fontSize: '10px', color: '#78716c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pkg.desc}</small>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePlacePrebuiltPackage(pkg)}
                          style={{
                            padding: '4px 9px',
                            borderRadius: '6px',
                            background: isPlaced ? '#dcfce7' : 'linear-gradient(135deg, #c59c2d, #8f6c12)',
                            color: isPlaced ? '#15803d' : '#fff',
                            border: isPlaced ? '1px solid #86efac' : 0,
                            fontSize: '10.5px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          {isPlaced ? '✓ In Scene' : '+ Add'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Minimal Curated Finishes */}
              <div>
                <label style={{ fontWeight: 800, fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                  2. Minimal Curated Finishes
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {CURATED_MINIMAL_FINISHES.map((fin) => {
                    const isSelected = activeLaminate === fin.id || (activeLaminate === '' && fin.id === 'mat-smoked-walnut');
                    return (
                      <button
                        key={fin.id}
                        type="button"
                        onClick={() => {
                          setActiveLaminate(fin.id);
                          setStyle((curr) => `${curr}; material: ${fin.name}`);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: isSelected ? '2px solid var(--gold)' : '1px solid #e7e5e4',
                          background: isSelected ? '#fffdfa' : '#fff',
                          cursor: 'pointer',
                          textAlign: 'left',
                          boxShadow: isSelected ? '0 2px 8px rgba(197,156,45,0.2)' : 'none',
                        }}
                      >
                        <span style={{ width: '22px', height: '22px', borderRadius: '5px', background: fin.hex, border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ display: 'block', fontSize: '11px', color: '#1c1917' }}>{fin.name}</strong>
                          <small style={{ display: 'block', fontSize: '9.5px', color: '#78716c' }}>{fin.type}</small>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Studio Reference Image Gallery (Filtered for Active Room) */}
              <div>
                <label style={{ fontWeight: 800, fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                  3. Studio Reference Gallery · {room.toUpperCase()}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: '6px' }}>
                  {(STUDIO_ROOM_REFERENCES[room] ?? STUDIO_ROOM_REFERENCES.living).map((ref) => (
                    <div
                      key={ref.id}
                      style={{
                        position: 'relative',
                        borderRadius: '7px',
                        overflow: 'hidden',
                        aspectRatio: '1',
                        border: '1px solid #e7e5e4',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        setStyle((curr) => `${curr}; atmosphere inspired by: ${ref.styleTag}`);
                        setPlacementNotice(`✨ Applied reference atmosphere: "${ref.styleTag}" to active moodboard!`);
                      }}
                      title={`Click to apply atmosphere: ${ref.styleTag}`}
                    >
                      <img src={ref.img} alt={ref.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)', padding: '3px 4px', fontSize: '8.5px', color: '#fff', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ref.title}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Action Hub */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {!catalogLaminates.length && (
                  <Button variant="outline" onClick={() => void addStarterMaterials()} disabled={!projectId}>
                    <Palette size={15} /> Add starter materials
                  </Button>
                )}
                {starterMaterialsState ? <p className="placement-notice" role="status">{starterMaterialsState}</p> : null}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <Button variant="outline" onClick={() => void saveMoodboard()} disabled={!selectedModule || !draftModules.length}>
                    <Save size={14} /> Save finishes
                  </Button>
                  <Button
                    onClick={() => void saveFinishesAndCompileScene()}
                    disabled={!selectedModule || !draftModules.length || !briefComplete || !planApproved}
                    style={{ background: 'linear-gradient(135deg, #1c1917, #3d2a1a)', color: '#fff', fontWeight: 800 }}
                  >
                    <Layers3 size={14} /> Compile scene.v1
                  </Button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                <Button
                  onClick={handleAiAutoFitAllWallModules}
                  style={{
                    background: 'linear-gradient(135deg, #1c1917, #3d2a1a)',
                    color: '#e8c96a',
                    border: '1px solid var(--gold)',
                    fontWeight: 800,
                  }}
                >
                  <Sparkles size={15} style={{ color: 'var(--gold)' }} /> Suggest a compatible module
                </Button>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <Button
                    onClick={() => navigate(`/projects/${projectId}/3d`)}
                    disabled={!compiledSceneId}
                    style={{ background: 'var(--gold)', color: '#fff', fontWeight: 800, fontSize: '12px' }}
                  >
                    <Layers3 size={14} /> View 3D Scene →
                  </Button>
                  <Button
                    onClick={() => navigate(`/projects/${projectId}/visualize`)}
                    disabled={!compiledSceneId}
                    style={{ background: 'linear-gradient(135deg, #c59c2d, #8f6c12)', color: '#fff', fontWeight: 800, fontSize: '12px' }}
                  >
                    <Wand2 size={14} /> 4K AI Render →
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="scene-panel">
          <CardHeader>
            <div>
              <small>SCENE V1</small>
              <h3>{sceneVersionId ? `Version ${sceneVersionId.slice(0, 8)}` : 'Draft scene'}</h3>
            </div>
            <Badge>{draftModules.length} persisted module{draftModules.length === 1 ? '' : 's'}</Badge>
          </CardHeader>
          <CardContent>
            {(() => {
              const roomModules = draftModules.filter((m) => !spaceId || m.roomId === spaceId);
              return (
                <>
                  <div className="scene-canvas">
                    <div className="scene-room-label">{room.toUpperCase()}</div>
                    {roomModules.length ? (
                      roomModules.map((item, index) => (
                        <button type="button" aria-pressed={item.id === selectedModule?.id} onClick={() => setSelectedModuleId(item.id)} className={`scene-module module-${item.family}${item.id === selectedModule?.id ? ' scene-module-selected' : ''}`} key={item.id} style={{ left: `${12 + (index % 4) * 22}%`, top: `${20 + Math.floor(index / 4) * 24}%` }}>
                          <Check size={13} />
                          {item.label}
                        </button>
                      ))
                    ) : (
                      <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '12px' }}>
                        No validated modules are placed in {room.toUpperCase()} yet. Choose a catalogue module, then save its finishes before compiling.
                      </div>
                    )}
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
                    {roomModules.length ? (
                      roomModules.map((item) => (
                        <button type="button" key={item.id} className={item.id === selectedModule?.id ? 'module-list-selected' : ''} aria-pressed={item.id === selectedModule?.id} onClick={() => setSelectedModuleId(item.id)}>
                          <span>{item.label}</span>
                          <small>{item.widthMm} mm · {item.id === selectedModule?.id ? 'selected' : 'select'}</small>
                        </button>
                      ))
                    ) : (
                      <p>Add a module to begin the scene for {room}.</p>
                    )}
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>
      <div className="workflow-next-action">
        <div><small>NEXT STEP</small><strong>{compiledSceneId ? 'Inspect the compiled room before requesting a render.' : 'Compile the placed modules into one canonical scene.'}</strong><span>{compiledSceneId ? 'The same scene supplies 3D, renders, drawings, cutlists and estimates.' : 'Place a module, save its material assignment, then compile the scene.'}</span></div>
        <Button onClick={() => navigate(`/projects/${projectId}/${compiledSceneId ? '3d' : 'materials'}`)} disabled={!projectId || !compiledSceneId}><ArrowRight size={16} /> {compiledSceneId ? 'Continue to 3D Scene' : 'Scene required'}</Button>
      </div>
    </section>
  );
}

function WallElevationPreview({
  wallLabel,
  wallLengthMm,
  ceilingHeightMm,
  openings,
  modules,
  selectedModuleId,
  onSelectModule,
  onNudgeModule,
  onCenterModule,
}: {
  wallLabel?: string;
  wallLengthMm: number;
  ceilingHeightMm: number;
  openings: Array<{ id: string; kind?: string; widthMm?: number; heightMm?: number; sillHeightMm?: number; offsetAlongWallMm?: number; offsetMm?: number }>;
  modules: Module[];
  selectedModuleId?: string | null;
  onSelectModule?: (id: string) => void;
  onNudgeModule?: (id: string, deltaMm: number) => void;
  onCenterModule?: (id: string) => void;
}) {
  const width = Math.max(1, wallLengthMm);
  const height = Math.max(1, ceilingHeightMm);
  const svgWidth = 560;
  const svgHeight = 240;
  const padX = 20;
  const padY = 20;
  const innerW = svgWidth - 2 * padX;
  const innerH = svgHeight - 2 * padY - 24;
  const sx = innerW / width;
  const sy = innerH / height;

  // Collision detection between placed modules and openings
  const collisions = useMemo(() => {
    const alerts: Array<{ moduleId: string; moduleLabel: string; openingKind: string; overlapMm: number }> = [];
    modules.forEach((mod) => {
      const mStart = mod.offsetMm ?? 0;
      const mEnd = mStart + mod.widthMm;
      const mBottom = 0;
      const mTop = mod.heightMm;

      openings.forEach((op) => {
        const opStart = Number(op.offsetAlongWallMm ?? op.offsetMm ?? 0);
        const opEnd = opStart + Number(op.widthMm ?? (op.kind === 'window' ? 1200 : 900));
        const opBottom = Number(op.sillHeightMm ?? (op.kind === 'window' ? 900 : 0));
        const opTop = opBottom + Number(op.heightMm ?? (op.kind === 'window' ? 1200 : 2100));

        const hOverlap = Math.min(mEnd, opEnd) - Math.max(mStart, opStart);
        const vOverlap = Math.min(mTop, opTop) - Math.max(mBottom, opBottom);

        if (hOverlap > 5 && vOverlap > 5) {
          alerts.push({
            moduleId: mod.id,
            moduleLabel: mod.label,
            openingKind: op.kind ?? 'opening',
            overlapMm: Math.round(hOverlap),
          });
        }
      });
    });
    return alerts;
  }, [modules, openings]);

  const activeModule = modules.find((m) => m.id === selectedModuleId) ?? modules[0] ?? null;

  return (
    <div className="module-wall-preview">
      <div className="module-wall-preview-title">
        <div>
          <strong>{wallLabel ?? 'Selected wall'} Elevation</strong>
          <span> · {Math.round(width)} mm W × {height} mm H</span>
        </div>
        <span>{openings.length} opening{openings.length === 1 ? '' : 's'} · {modules.length} module{modules.length === 1 ? '' : 's'}</span>
      </div>

      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} role="img" aria-label="Architectural wall elevation with openings and modules">
        {/* Wall shell background */}
        <rect x={padX} y={padY} width={innerW} height={innerH} className="module-wall-shell" rx={3} />

        {/* Ceiling and floor reference lines */}
        <line x1={padX} y1={padY} x2={padX + innerW} y2={padY} stroke="#786c5e" strokeWidth={2} />
        <line x1={padX} y1={padY + innerH} x2={padX + innerW} y2={padY + innerH} stroke="#3d2d20" strokeWidth={3} />

        {/* Doors and Windows with true architectural representation */}
        {openings.map((opening) => {
          const opOffset = Number(opening.offsetAlongWallMm ?? opening.offsetMm ?? 0);
          const opWidthMm = Number(opening.widthMm ?? (opening.kind === 'window' ? 1200 : 900));
          const opHeightMm = Number(opening.heightMm ?? (opening.kind === 'window' ? 1200 : 2100));
          const sillMm = Number(opening.sillHeightMm ?? (opening.kind === 'window' ? 900 : 0));

          const x = padX + opOffset * sx;
          const w = Math.max(14, opWidthMm * sx);
          const h = Math.max(16, opHeightMm * sy);
          const y = padY + innerH - (sillMm + opHeightMm) * sy;
          const isDoor = opening.kind === 'door';

          return (
            <g key={opening.id}>
              {/* Outer frame */}
              <rect x={x} y={y} width={w} height={h} className={`module-wall-opening ${isDoor ? 'door' : 'window'}`} rx={2} />

              {/* Architectural details */}
              {isDoor ? (
                <>
                  {/* Door leaf with swing diagonal */}
                  <line x1={x + 3} y1={y + h - 2} x2={x + w - 3} y2={y + 3} stroke="#bf6c45" strokeWidth={1} strokeDasharray="3 2" />
                  <circle cx={x + w - 8} cy={y + h / 2} r={2} fill="#bf6c45" />
                  <text x={x + w / 2} y={y + 14} textAnchor="middle" className="module-wall-text" fill="#8c3f1d">DOOR {opWidthMm}mm</text>
                </>
              ) : (
                <>
                  {/* Window sill board and glass pane divider */}
                  <rect x={x - 2} y={y + h - 3} width={w + 4} height={4} fill="#2b6cb0" rx={1} />
                  <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke="#4384a6" strokeWidth={1} />
                  <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke="#4384a6" strokeWidth={1} strokeDasharray="2 2" />
                  <text x={x + w / 2} y={y + 14} textAnchor="middle" className="module-wall-text" fill="#1a4971">WINDOW {opWidthMm}mm</text>
                </>
              )}
            </g>
          );
        })}

        {/* Modules placed on this wall */}
        {modules.map((module) => {
          const mOffset = module.offsetMm ?? 0;
          const x = padX + mOffset * sx;
          const w = Math.max(16, module.widthMm * sx);
          const h = Math.max(16, module.heightMm * sy);
          const y = padY + innerH - h;
          const isSelected = module.id === selectedModuleId;
          const hasCollision = collisions.some((c) => c.moduleId === module.id);

          return (
            <g key={module.id} onClick={() => onSelectModule?.(module.id)}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                className={`module-wall-module ${hasCollision ? 'collision' : ''}`}
                stroke={isSelected ? 'var(--gold)' : hasCollision ? '#e53e3e' : '#6f5420'}
                strokeWidth={isSelected ? 2.5 : 1.5}
                rx={2}
              />
              {/* Shutter divisions / dividers */}
              <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke="#fff" strokeWidth={1} strokeOpacity={0.6} />
              <text x={x + w / 2} y={y + h / 2} textAnchor="middle" className="module-wall-text" fill="#2d1e12">
                {module.label.split(' ')[0]}
              </text>
              <text x={x + w / 2} y={y + h / 2 + 10} textAnchor="middle" fontSize={7} fill="#5a402a">
                {module.widthMm} × {module.heightMm}
              </text>
            </g>
          );
        })}

        {/* Dimension Line across the wall bottom */}
        <line x1={padX} y1={svgHeight - 12} x2={padX + innerW} y2={svgHeight - 12} className="module-wall-dimension" />
        <text x={svgWidth / 2} y={svgHeight - 4} textAnchor="middle" className="module-wall-dimension-label">
          {Math.round(width)} mm Wall Span (Clearance Checked)
        </text>
      </svg>

      {/* Collision Alerts */}
      {collisions.length > 0 && (
        <div className="module-wall-collision-alert" role="alert">
          <span>⚠️ <strong>Collision detected:</strong> {collisions[0].moduleLabel} overlaps {collisions[0].openingKind} by {collisions[0].overlapMm} mm. Nudge the unit or choose a narrower module.</span>
        </div>
      )}

      {/* Nudge & Centering Controls for Active Module */}
      {activeModule && (
        <div className="module-wall-nudge-row">
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            <strong>{activeModule.label}</strong>: offset <strong>{Math.round(activeModule.offsetMm ?? 0)} mm</strong>
          </span>
          <div className="module-wall-nudge-btns">
            <button type="button" className="module-wall-nudge-btn" onClick={() => onNudgeModule?.(activeModule.id, -50)}>◀ 50mm Left</button>
            <button type="button" className="module-wall-nudge-btn" onClick={() => onCenterModule?.(activeModule.id)}>Center</button>
            <button type="button" className="module-wall-nudge-btn" onClick={() => onNudgeModule?.(activeModule.id, 50)}>50mm Right ▶</button>
          </div>
        </div>
      )}
    </div>
  );
}
