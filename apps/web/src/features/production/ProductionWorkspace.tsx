import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, AlertTriangle, CheckCircle2, Download, ChevronRight, ChevronDown,
  ClipboardList, FileText, ArrowLeft, ArrowRight, Printer, RefreshCw,
  Sliders, Compass, Eye, X, Check, Layers, Sparkles, Filter, LayoutGrid, Maximize2, Scissors, Receipt, Tag,
} from 'lucide-react';

import {
  analyze2DDrawingsToCutlist,
  cabinetDimensionToMm,
  extractDrawingCutlistFromScene,
  generateDrawingCutlistSvg,
  DRAWING_CUTLIST_PRESETS,
  type DrawingCutlistAnalysisResult,
  type DrawingCutlistInput,
  type CabinetDimensionUnit,
} from '@ultida/drawing-core/browser';
import { Badge, Button, Card, CardContent, CardHeader } from '../../components/ui/primitives';
import { optimizeGuillotineNesting, type NestingPart } from '../tools/cutlist-optimizer';
import { supabase } from '../../lib/supabase';
import { getApiBase } from '../../lib/api-base';
import WorkingDrawingsDossier from '../../components/drawings/WorkingDrawingsDossier';
import { calculateCutlistCostRollup, getPricingRates } from '../../lib/pricing-rates';
import './production-workspace.css';

// ─── Standard Sheet Size Options ─────────────────────────────────────────────
export const SHEET_SIZE_OPTIONS = [
  { key: '8x4', label: '8×4 ft (2440×1220 mm)', widthMm: 2440, heightMm: 1220, desc: 'Standard 8x4 sheet (32 sq.ft)' },
  { key: '9x4', label: '9×4 ft (2745×1220 mm)', widthMm: 2745, heightMm: 1220, desc: 'Tall 9x4 sheet for full-height panels & lofts (36 sq.ft)' },
  { key: '7x4', label: '7×4 ft (2135×1220 mm)', widthMm: 2135, heightMm: 1220, desc: 'Compact 7x4 sheet for standard doors (28 sq.ft)' },
] as const;

// ─── Fabrication Certified Families ──────────────────────────────────────────
export const FABRICATION_CERTIFIED_FAMILIES = new Set([
  'wardrobe',
  'wardrobe-hinged',
  'wardrobe-sliding',
  'kitchen-base',
  'kitchen-wall',
  'kitchen-tall',
  'kitchen-corner',
  'tv-unit',
  'tv_unit',
  'study',
  'pooja',
  'puja',
  'utility',
  'crockery',
  'crockery-unit',
  'storage',
  'vanity',
]);

// ─── Types ────────────────────────────────────────────────────────────────────
type TabId = 'cutlist' | 'hardware' | 'drawings' | 'release';
type Part = {
  id: string; partInstanceId: string; moduleId: string; family: string; roomId: string;
  semanticType: string; partName: string; lengthMm: number; widthMm: number; thicknessMm: number;
  quantity: number; grainDirection: 'horizontal' | 'vertical' | 'none'; edging: string;
  edgeSchedule?: { l1Mm: number; l2Mm: number; w1Mm: number; w2Mm: number; tapeType: string };
  faceFinishes?: DrawingCutlistAnalysisResult['panels'][number]['faceFinishes'];
  materialCode: string; status: 'approved' | 'review_required';
};
type HardwareItem = { name: string; category: 'hinge' | 'slide' | 'fastener' | 'handle' | 'accessory'; quantity: number; unit: string };
type NestingSheet = { sheetId: string; materialCode: string; thicknessMm: number; sheetWidthMm: number; sheetHeightMm: number; placedPanels: { partId: string; xMm: number; yMm: number; widthMm: number; lengthMm: number; rotated: boolean }[]; usedAreaSqm: number; utilizationPercentage: number };
type ProductionCutlist = {
  parts: Part[];
  hardware: HardwareItem[];
  warnings: string[];
  excludedModules?: Array<{ moduleId: string; family: string; moduleName?: string; reason: string }>;
  nesting: NestingSheet[];
  edgeBanding: Array<{ tapeType: string; thicknessMm: number; totalMeters: number }>;
  status: 'review_required' | 'approved';
  fabricationRules: { version: string; sheetWidthMm: number; sheetHeightMm: number; kerfMm: number; trimMm: number };
  nestingStats?: { totalSheets: number; totalAreaSqm: number; usedAreaSqm: number; overallUtilizationPercentage: number };
  multiSheetOptimization?: {
    bestSize: { name: string; widthMm: number; heightMm: number; areaSqM: number; areaSqFt: number };
    candidates: Array<{
      sheetSize: { name: string; widthMm: number; heightMm: number; areaSqM: number; areaSqFt: number };
      totalSheets: number;
      usedAreaSqm: number;
      totalSheetAreaSqm: number;
      wasteAreaSqm: number;
      wastePercentage: number;
      utilizationPercentage: number;
      feasible: boolean;
      error?: string;
    }>;
  };
};
type CncAsset = { id: string; name: string; sourceSceneId: string; modulePartId: string; svgUrl: string; dxfUrl: string; dimensionsMm: { width: number; height: number }; material: string; layer: 'CUT' | 'ENGRAVE' | 'POCKET' | 'DRILL' | 'REFERENCE'; validationStatus: 'pending' | 'passed' | 'failed'; preflightIssues: string[] };

interface ProductionWorkspaceProps {
  initialTab?: TabId | 'elevations' | 'parts' | 'release';
  projectId: string;
  sceneVersionId: string | null;
  sceneApproved: boolean;
  modules: Array<{ id: string; roomId: string; family: string; label: string; widthMm: number; depthMm: number; heightMm: number }>;
  materials: Array<{
    id: string; code: string; name: string; category: string;
    unitCost?: number | null; pricingUnit?: string | null; assignedSemanticSlots?: string[];
  }>;
  onSceneCreated: (id: string, modules: any[], materials: any[]) => void;
  onSceneApproved: () => Promise<void>;
}

function resolveTab(raw: string | undefined): TabId {
  if (!raw) return 'cutlist';
  if (raw === 'elevations' || raw === 'drawings') return 'drawings';
  if (raw === 'parts' || raw === 'cutlist') return 'cutlist';
  if (raw === 'release' || raw === 'exports') return 'release';
  if (raw === 'hardware') return 'hardware';
  return 'cutlist';
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'cutlist',  label: 'Cutlist',           icon: <ClipboardList size={14} /> },
  { id: 'hardware', label: 'Hardware',           icon: <Package size={14} /> },
  { id: 'drawings', label: 'Drawings',           icon: <FileText size={14} /> },
  { id: 'release',  label: 'Release & Export',   icon: <Download size={14} /> },
];

// ─── Board Optimizer ─────────────────────────────────────────────────────────
function estimateSheets(parts: Part[], fabricationRules: ProductionCutlist['fabricationRules'] | undefined) {
  const sw = fabricationRules?.sheetWidthMm ?? 2440;
  const sh = fabricationRules?.sheetHeightMm ?? 1220;
  const kerf = fabricationRules?.kerfMm ?? 4;
  const trim = fabricationRules?.trimMm ?? 10;
  const usable = (sw - trim * 2) * (sh - trim * 2);
  const byMaterial: Record<string, number> = {};
  for (const p of parts) {
    const area = (p.lengthMm + kerf) * (p.widthMm + kerf) * p.quantity;
    byMaterial[p.materialCode] = (byMaterial[p.materialCode] ?? 0) + area;
  }
  return Object.entries(byMaterial).map(([code, area]) => ({
    code,
    sheets: Math.ceil(area / usable),
    sheetSize: `${sw}×${sh}`,
  }));
}

// ─── Component ───────────────────────────────────────────────────────────────
export function ProductionWorkspace({
  projectId, sceneVersionId, sceneApproved, modules, materials,
  onSceneCreated: _onSceneCreated, onSceneApproved: _onSceneApproved, initialTab,
}: ProductionWorkspaceProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>(resolveTab(initialTab));
  const [parts, setParts] = useState<Part[]>([]);
  const [cutlist, setCutlist] = useState<ProductionCutlist | null>(null);
  const [cncAssets] = useState<CncAsset[]>([]);
  const [exportState, setExportState] = useState('Choose an approved scene export.');
  const [partQuery, setPartQuery] = useState('');
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());
  const [showMoreExports, setShowMoreExports] = useState(false);

  // Active Scope & 2D Drawing Cutlist Analyzer states
  // Cutlist Sub-View & Nesting states
  const [cutlistViewMode, setCutlistViewMode] = useState<'table' | 'nesting' | 'edgebanding'>('table');
  const [kerfMm, setKerfMm] = useState<number>(4);
  const [trimMm, setTrimMm] = useState<number>(10);
  const [selectedSheetIdx, setSelectedSheetIdx] = useState<number>(0);
  const [activeRoomScope, setActiveRoomScope] = useState<string>('all');
  const [showDrawingAnalyzer, setShowDrawingAnalyzer] = useState(false);
  const [drawingInput, setDrawingInput] = useState<DrawingCutlistInput | null>(null);
  const [drawingAnalysisResult, setDrawingAnalysisResult] = useState<DrawingCutlistAnalysisResult | null>(null);
  const [drawingViewTab, setDrawingViewTab] = useState<'visual2d' | 'panels' | 'hardware' | 'audit'>('visual2d');
  const [drawingSvgMode, setDrawingSvgMode] = useState<'both' | 'external' | 'internal'>('both');
  const [drawingPresetKey, setDrawingPresetKey] = useState<string>('wardrobe_4door');
  const [customCabinet, setCustomCabinet] = useState({ width: '3', height: '7', depth: '', unit: 'ft' as CabinetDimensionUnit, bayCount: '1', plinth: '100', fillers: '0', coreCode: '', externalCode: '', internalCode: '', backCode: 'PLY-BACK-06', backThickness: '6' as '6' | '18', drawerBottomCode: 'MDF-09-WHITE', drawerBottomThickness: '9', layout: 'standard' as 'standard' | 'hanging' | 'shelves' | 'drawers', hangingClearHeight: '1050', drawerFrontHeight: '200', drawerCount: '3', upperShelfCount: '1' });
  const [customCabinetError, setCustomCabinetError] = useState('');
  const [rawScene, setRawScene] = useState<any>(null);
  const [selectedSheetKey, setSelectedSheetKey] = useState<'8x4' | '9x4' | '7x4'>('8x4');
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);

  const activeSheetSize = useMemo(() => {
    return SHEET_SIZE_OPTIONS.find((s) => s.key === selectedSheetKey) ?? SHEET_SIZE_OPTIONS[0];
  }, [selectedSheetKey]);

  // ─── API helpers ────────────────────────────────────────────────────────────
  async function readApprovedScene() {
    if (!projectId || !sceneVersionId) { setExportState('Save and approve a scene before exporting.'); return null; }
    const token = (await supabase?.auth.getSession())?.data.session?.access_token;
    if (!token) { setExportState('Sign in before exporting production data.'); return null; }
    const apiBase = getApiBase();
    const response = await fetch(`${apiBase}/projects/${projectId}/scenes/${sceneVersionId}`, { headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success || payload?.sceneVersion?.status !== 'approved' || !payload?.sceneVersion?.scene) {
      setExportState(payload?.message ?? 'This exact scene is not approved or could not be read.');
      return null;
    }
    setRawScene(payload.sceneVersion.scene);
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
        ...(method === 'POST' ? { body: JSON.stringify({ projectId, sceneVersionId, scene: source.scene, ...bodyExtra }) } : {}),
      });
      if (!response.ok) { const error = await response.json().catch(() => null); setExportState(error?.message ?? 'The export service rejected this scene.'); return; }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
      URL.revokeObjectURL(url);
      setExportState('File exported from the saved approved scene.');
    } catch { setExportState('Production export service is unavailable.'); }
  }

  async function downloadApprovedProductionAsset(asset: 'labels.svg' | 'nesting.svg', filename: string) {
    setExportState('Preparing authoritative production asset...');
    try {
      if (!sceneVersionId) throw new Error('Approve a scene first.');
      if (!supabase) throw new Error('Supabase is not configured for this build.');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Sign in again to export production assets.');
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/projects/${projectId}/scenes/${sceneVersionId}/production/${asset}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
      URL.revokeObjectURL(url);
      setExportState('File exported from the saved approved scene.');
    } catch (error) { setExportState(error instanceof Error ? error.message : 'Production asset export failed.'); }
  }

  // ─── Load production snapshot ────────────────────────────────────────────
  useEffect(() => {
    if (!projectId || !sceneVersionId || !sceneApproved) {
      setCutlist(null); setParts([]); setExportState('Approve a scene to load authoritative production data.'); return;
    }
    void (async () => {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) { setCutlist(null); setParts([]); setExportState('Sign in to load production data for this scene.'); return; }
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/projects/${projectId}/scenes/${sceneVersionId}/production-snapshot`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => null);
      const authoritative = response.ok && payload?.success ? payload.cutlist as ProductionCutlist : null;
      setCutlist(authoritative);
      setParts(authoritative?.parts ?? []);
      setExportState(authoritative ? 'Production snapshot loaded from the approved scene.' : (payload?.message ?? 'The approved scene could not produce a manufacturing snapshot.'));
      // Expand all rooms by default
      const rooms = new Set<string>((authoritative?.parts ?? []).map((p: Part) => p.roomId));
      setExpandedRooms(rooms);
    })();
  }, [projectId, sceneVersionId, sceneApproved]);

  // ─── CSV download ─────────────────────────────────────────────────────────
  function downloadClientCsv() {
    if (!sceneApproved || !parts.length) { setExportState('No approved production snapshot is available to export.'); return; }
    const headers = ['Part Instance ID', 'Part Name', 'Room', 'Module Family', 'Length (mm)', 'Width (mm)', 'Thickness (mm)', 'Quantity', 'Substrate Material Code', 'Face Finishes', 'Grain', 'Edging'];
    const targetParts = scopedParts.length > 0 ? scopedParts : parts;
    const rows = targetParts.map((p) => [
      p.partInstanceId || p.id, `"${p.partName}"`, p.roomId, p.family,
    p.lengthMm, p.widthMm, p.thicknessMm, p.quantity, p.materialCode, `"${(p.faceFinishes ?? []).map((finish) => `${finish.face}:${finish.finishCode} ${finish.areaSqm}m2`).join('; ')}"`, p.grainDirection, `"${p.edging}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const suffix = activeRoomScope !== 'all' ? `-${activeRoomScope}` : '';
    const link = document.createElement('a'); link.href = url; link.download = `ultida-${sceneVersionId ?? 'unapproved'}${suffix}-cutlist.csv`; link.click();
    URL.revokeObjectURL(url);
  }

  // ─── Release approve ─────────────────────────────────────────────────────
  async function approveProductionReview() {
    if (!reviewConfirmed || !sceneVersionId || !parts.length) return;
    setReviewSaving(true); setExportState('Saving audited panel review...');
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) throw new Error('Sign in again before approving production data.');
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/projects/${projectId}/scenes/${sceneVersionId}/production-review`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ approvedPartIds: parts.map((p) => p.partInstanceId), notes: reviewNotes }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error(payload?.message ?? 'Production review could not be saved.');
      setCutlist(payload.cutlist); setParts(payload.cutlist.parts);
      setExportState('Production pack approved against this exact scene version.');
    } catch (error) { setExportState(error instanceof Error ? error.message : 'Production review could not be saved.'); }
    finally { setReviewSaving(false); }
  }

  // ─── Derived state ────────────────────────────────────────────────────────
  const releaseReady = parts.length > 0 && parts.every((p) => p.status === 'approved') && sceneApproved;

  const uniqueRooms = useMemo(() => {
    const set = new Set<string>();
    for (const p of parts) if (p.roomId) set.add(p.roomId);
    for (const m of modules) if (m.roomId) set.add(m.roomId);
    return Array.from(set);
  }, [parts, modules]);

  const scopedParts = useMemo(() => {
    if (activeRoomScope === 'all') return parts;
    return parts.filter((p) => p.roomId === activeRoomScope);
  }, [parts, activeRoomScope]);

  const visibleParts = useMemo(() => {
    const q = partQuery.trim().toLowerCase();
    return q
      ? scopedParts.filter((p) => `${p.partInstanceId} ${p.partName} ${p.family} ${p.materialCode} ${p.roomId}`.toLowerCase().includes(q))
      : scopedParts;
  }, [scopedParts, partQuery]);

  // Group parts by room
  const partsByRoom = useMemo(() => {
    const map: Record<string, Part[]> = {};
    for (const p of visibleParts) {
      if (!map[p.roomId]) map[p.roomId] = [];
      map[p.roomId].push(p);
    }
    return map;
  }, [visibleParts]);

  const totalEdgeBandM = useMemo(() => {
    let totalMm = 0;
    for (const p of scopedParts) {
      if (p.edgeSchedule) {
        totalMm += (p.edgeSchedule.l1Mm + p.edgeSchedule.l2Mm + p.edgeSchedule.w1Mm + p.edgeSchedule.w2Mm) * p.quantity;
      }
    }
    return totalMm > 0
      ? totalMm / 1000
      : (cutlist?.edgeBanding ?? []).reduce((acc, e) => acc + e.totalMeters, 0);
  }, [scopedParts, cutlist]);

  const materialCount = useMemo(() =>
    new Set(scopedParts.map((p) => p.materialCode)).size,
    [scopedParts]);


  function sendPartToCnc(part: Part) {
    const cncData = {
      partId: part.partInstanceId || part.id,
      partName: part.partName,
      lengthMm: part.lengthMm,
      widthMm: part.widthMm,
      thicknessMm: part.thicknessMm,
      materialCode: part.materialCode,
      grain: part.grainDirection,
    };
    window.localStorage.setItem('ultida_active_cnc_panel', JSON.stringify(cncData));
    navigate('/tools/cnc');
  }

  function updatePartGrain(partId: string, grain: 'vertical' | 'horizontal' | 'none') {
    setParts((prev) => prev.map((p) => (p.id === partId || p.partInstanceId === partId ? { ...p, grainDirection: grain } : p)));
  }

  // ─── 2D Sheet Nesting Optimizer ──────────────────────────────────────────
  const nestedSheets = useMemo(() => {
    const rawParts = scopedParts.length > 0 ? scopedParts : parts;
    const effectiveParts = rawParts.filter((p) =>
      FABRICATION_CERTIFIED_FAMILIES.has(p.family.toLowerCase()) ||
      !['sofa', 'dining', 'bed', 'loose', 'accent-chair', 'coffee-table', 'decor'].includes(p.family.toLowerCase())
    );
    const nestingParts: NestingPart[] = effectiveParts.map((p) => {
      const isExt = p.semanticType === 'shutter' || p.semanticType === 'drawer_fascia' || p.semanticType === 'dummy_filler' || p.semanticType === 'skirting_fascia';
      return {
        id: p.id,
        partInstanceId: p.partInstanceId || p.id,
        name: p.partName,
        classification: isExt ? 'external_shutter' : (p.semanticType === 'back_panel' ? 'back_panel' : 'internal_carcass_gable'),
        isExternal: isExt,
        lengthMm: p.lengthMm,
        widthMm: p.widthMm,
        thicknessMm: p.thicknessMm,
        quantity: p.quantity,
        materialCode: p.materialCode,
        materialName: p.materialCode,
        grainDirection: p.grainDirection,
        edgeBanding: {
          l1: p.edging || (isExt ? '2.0mm PVC' : '0.8mm PVC'),
          l2: 'none',
          w1: p.edging || (isExt ? '2.0mm PVC' : '0.8mm PVC'),
          w2: 'none',
          totalLinearMeters: Math.round(((p.lengthMm + p.widthMm) * 2 * p.quantity / 1000) * 10) / 10,
        },
      };
    });

    const sheetW = activeSheetSize.widthMm;
    const sheetH = activeSheetSize.heightMm;
    const result = optimizeGuillotineNesting(nestingParts, {
      sheetWidthMm: sheetW,
      sheetHeightMm: sheetH,
      trimMm,
      kerfMm,
      allowGrainRotationForSolid: true,
    });

    return result.sheets.map((s) => ({
      sheetNumber: s.sheetIndex,
      materialCode: s.materialCode,
      widthMm: s.sheetWidthMm,
      heightMm: s.sheetHeightMm,
      placedPanels: s.placedPanels.map((p) => ({
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
        grain: p.grain,
        color: p.color,
        partRef: p.partRef as any,
      })),
      usedAreaSqm: s.usedAreaSqm,
      totalAreaSqm: s.totalAreaSqm,
      yieldPct: s.yieldPct,
      scrapPct: s.wastePct,
    }));
  }, [scopedParts, parts, trimMm, kerfMm, activeSheetSize]);

  // ─── Live Cost Rollup ───────────────────────────────────────────────────────
  const liveCostRollup = useMemo(() => {
    const rawHw: Array<{ name: string; category: string; quantity: number }> =
      cutlist?.hardware?.length
        ? cutlist.hardware
        : (drawingAnalysisResult?.hardware?.length
          ? drawingAnalysisResult.hardware.map((h) => ({ name: h.name, category: h.category, quantity: h.quantity }))
          : []);

    const materialCostFor = (slots: string[]) => {
      const assigned = materials.find((material) => material.assignedSemanticSlots?.some((slot) => slots.includes(slot)));
      return assigned ? {
        name: assigned.name,
        unitCost: assigned.unitCost,
        pricingUnit: assigned.pricingUnit,
      } : undefined;
    };

    return calculateCutlistCostRollup({
      sheetCount: Math.max(1, nestedSheets.length),
      sheetWidthMm: activeSheetSize.widthMm,
      sheetHeightMm: activeSheetSize.heightMm,
      edgeBandingLinearMeters: totalEdgeBandM,
      carcassMaterialCost: materialCostFor(['carcass', 'back_panel']),
      shutterFinishCost: materialCostFor(['shutter', 'glass', 'profile']),
      hardwareItems: rawHw.map((h) => ({
        name: h.name,
        category: h.category,
        quantity: h.quantity,
      })),
    });
  }, [nestedSheets.length, activeSheetSize, totalEdgeBandM, cutlist?.hardware, drawingAnalysisResult?.hardware, materials]);

  // ─── Comprehensive Edge Banding Schedule ─────────────────────────────────
  const edgeBandingSchedule = useMemo(() => {
    const effectiveParts = scopedParts.length > 0 ? scopedParts : parts;
    let m08 = 0;
    let m20 = 0;
    let mAcrylic = 0;

    for (const p of effectiveParts) {
      const perimMm = (p.lengthMm * 2 + p.widthMm * 2) * (p.quantity || 1);
      const tape = (p.edgeSchedule?.tapeType || p.edging || '').toLowerCase();
      if (tape.includes('2') || tape.includes('shutter') || tape.includes('impact')) {
        m20 += perimMm / 1000;
      } else if (tape.includes('acrylic') || tape.includes('1.0')) {
        mAcrylic += perimMm / 1000;
      } else {
        m08 += perimMm / 1000;
      }
    }

    return [
      {
        type: '0.8mm Carcass PVC (Internal Shelves & Partitions)',
        thickness: '0.8 mm',
        metersNet: Math.round(m08 * 10) / 10,
        metersWithWaste: Math.round(m08 * 1.1 * 10) / 10,
        rolls50m: Math.max(1, Math.ceil((m08 * 1.1) / 50)),
        usage: 'Concealed carcass edges, adjustable shelf perimeters',
      },
      {
        type: '2.0mm High-Impact PVC (External Shutters & Drawers)',
        thickness: '2.0 mm',
        metersNet: Math.round(m20 * 10) / 10,
        metersWithWaste: Math.round(m20 * 1.1 * 10) / 10,
        rolls50m: Math.max(1, Math.ceil((m20 * 1.1) / 50)),
        usage: 'External shutter perimeters, tandem drawer fronts, exposed gables',
      },
      {
        type: '1.0mm Acrylic Dual-Tone (Feature & Showcase Units)',
        thickness: '1.0 mm',
        metersNet: Math.round(mAcrylic * 10) / 10,
        metersWithWaste: Math.round(mAcrylic * 1.1 * 10) / 10,
        rolls50m: Math.max(1, Math.ceil((mAcrylic * 1.1) / 50)),
        usage: 'High-gloss acrylic shutters, profile glass edge wraps',
      },
    ];
  }, [scopedParts, parts]);

  const sheetEstimates = useMemo(() =>
    estimateSheets(scopedParts, cutlist?.fabricationRules),
    [scopedParts, cutlist]);

  // ─── 2D Drawing Analysis Actions ──────────────────────────────────────────
  function run2DDrawingAnalysis(targetRoom?: string, presetKey = 'wardrobe_4door') {
    const targetRoomId = targetRoom || (activeRoomScope !== 'all' ? activeRoomScope : uniqueRooms[0] || 'room-main');
    if (presetKey === 'custom') {
      setDrawingPresetKey('custom');
      setDrawingInput(null);
      setDrawingAnalysisResult(null);
      setCustomCabinetError('');
      setShowDrawingAnalyzer(true);
      return;
    }
    let input: DrawingCutlistInput;

    if (presetKey === 'from_scene' && rawScene) {
      input = extractDrawingCutlistFromScene(rawScene);
      setDrawingPresetKey('from_scene');
    } else if (presetKey in DRAWING_CUTLIST_PRESETS) {
      input = {
        ...DRAWING_CUTLIST_PRESETS[presetKey],
        roomId: targetRoomId,
      };
      setDrawingPresetKey(presetKey);
    } else {
      const roomMods = modules.filter((m) => !targetRoomId || m.roomId === targetRoomId);
      const primaryMod = roomMods[0] || modules[0];
      if (!primaryMod) {
        setDrawingPresetKey('custom');
        setDrawingInput(null);
        setDrawingAnalysisResult(null);
        setCustomCabinetError('No placed cabinet is available. Enter measured dimensions to start a custom cabinet cutlist.');
        setShowDrawingAnalyzer(true);
        return;
      }
      const w = primaryMod.widthMm;
      const h = primaryMod.heightMm;
      const d = primaryMod.depthMm;
      const bayCount = Math.max(1, Math.round(w / 600));
      const fillers = 0;
      const carcassThickness = 18;
      const clearBayTotal = w - fillers * 2 - carcassThickness * 2 - (bayCount - 1) * carcassThickness;
      const bayW = Math.floor(clearBayTotal / bayCount);
      input = {
        unitId: primaryMod.id,
        unitTitle: primaryMod.family.replace(/-/g, ' ').toUpperCase(),
        roomId: targetRoomId,
        wallId: 'wall-01',
        overallWidthMm: w,
        overallHeightMm: h,
        depthMm: d,
        plinthHeightMm: 100,
        loftHeightMm: h > 2400 ? 500 : 0,
        bays: Array.from({ length: bayCount }).map((_, i) => ({
          id: `bay-${i + 1}`,
          label: `Bay ${i + 1}`,
          widthMm: i === bayCount - 1 ? clearBayTotal - bayW * (bayCount - 1) : bayW,
          type: i === 0 ? 'drawers' : 'wardrobe-shelves',
          shelvesCount: 1,
          adjustableShelvesCount: 3,
          drawerCount: i === 0 ? 3 : 0,
          hasHangingRod: i !== 0,
          shutterType: bayW > 550 ? 'double-door' : 'single-door',
        })),
        dummyFillerLeftMm: fillers,
        dummyFillerRightMm: fillers,
        backPanelThicknessMm: 6,
        backPanelMaterial: 'PLY-BACK-06',
        assumptions: ['Bay count, internal arrangement, and standard hardware are a draft inferred from the selected module family; confirm them before production.'],
      };
      setDrawingPresetKey('custom');
    }

    setDrawingInput(input);
    const result = analyze2DDrawingsToCutlist(input);
    setDrawingAnalysisResult(result);
    setShowDrawingAnalyzer(true);
  }

  function generateCustomCabinetCutlist() {
    try {
      const widthMm = Math.round(cabinetDimensionToMm(Number(customCabinet.width), customCabinet.unit));
      const heightMm = Math.round(cabinetDimensionToMm(Number(customCabinet.height), customCabinet.unit));
      const depthMm = Math.round(cabinetDimensionToMm(Number(customCabinet.depth), customCabinet.unit));
      const bayCount = Number(customCabinet.bayCount);
      const plinthHeightMm = Number(customCabinet.plinth);
      const fillerMm = Number(customCabinet.fillers);
      const carcassThicknessMm = 18;
      if (!Number.isInteger(bayCount) || bayCount < 1 || bayCount > 6) throw new RangeError('Choose between 1 and 6 cabinet bays.');
      if (![plinthHeightMm, fillerMm].every((value) => Number.isFinite(value) && value >= 0)) throw new RangeError('Plinth and filler dimensions must be zero or positive.');
      if (!customCabinet.coreCode.trim() || !customCabinet.externalCode.trim() || !customCabinet.internalCode.trim() || !customCabinet.backCode.trim()) {
        throw new RangeError('Enter the carcass board, external laminate, internal laminate, and back-board material codes.');
      }
      const usableBayWidth = widthMm - fillerMm * 2 - carcassThicknessMm * 2 - (bayCount - 1) * carcassThicknessMm;
      if (usableBayWidth < bayCount * 120) throw new RangeError('The measured width is too small for the selected fillers, board thickness, and number of bays.');
      const eachBay = Math.floor(usableBayWidth / bayCount);
      const backThicknessMm = Number(customCabinet.backThickness);
      const bays = Array.from({ length: bayCount }, (_, index) => {
        const isStandardMixedBay = customCabinet.layout === 'standard' && index === 0;
        const hasHanging = customCabinet.layout === 'standard' ? index < Math.min(2, bayCount) : customCabinet.layout === 'hanging' || (customCabinet.layout === 'drawers' && index > 0);
        const hasDrawers = isStandardMixedBay || (customCabinet.layout === 'drawers' && index === 0);
        const useVerticalSchedule = customCabinet.layout === 'standard' ? index < Math.min(2, bayCount) : customCabinet.layout === 'hanging' || (customCabinet.layout === 'drawers' && hasDrawers);
        const drawerCountForBay = hasDrawers ? Number(customCabinet.drawerCount) : 0;
        return {
          id: `bay-${index + 1}`,
          label: `Bay ${index + 1}`,
          widthMm: index === bayCount - 1 ? usableBayWidth - eachBay * (bayCount - 1) : eachBay,
          type: hasDrawers ? 'drawers' as const : hasHanging ? 'wardrobe-hanging' as const : 'wardrobe-shelves' as const,
          shelvesCount: hasDrawers || hasHanging ? 1 : 1,
          adjustableShelvesCount: useVerticalSchedule ? 0 : customCabinet.layout === 'shelves' ? 3 : 1,
          drawerCount: drawerCountForBay,
          hasHangingRod: hasHanging,
          hangingClearHeightMm: useVerticalSchedule && hasHanging ? Number(customCabinet.hangingClearHeight) : undefined,
          drawerFrontHeightMm: hasDrawers ? Number(customCabinet.drawerFrontHeight) : useVerticalSchedule && hasHanging ? Number(customCabinet.drawerFrontHeight) : undefined,
          shelvesInRemainderZone: useVerticalSchedule ? Number(customCabinet.upperShelfCount) : undefined,
          shutterType: eachBay > 550 ? 'double-door' as const : 'single-door' as const,
        };
      });
      const input: DrawingCutlistInput = {
        unitId: `custom-wardrobe-${Date.now()}`,
        unitTitle: `Custom wardrobe ${widthMm} × ${heightMm} × ${depthMm} mm`,
        roomId: activeRoomScope === 'all' ? uniqueRooms[0] || 'room-main' : activeRoomScope,
        wallId: 'unassigned',
        overallWidthMm: widthMm,
        overallHeightMm: heightMm,
        depthMm,
        plinthHeightMm,
        loftHeightMm: 0,
        carcassThicknessMm,
        shutterThicknessMm: 18,
        dummyFillerLeftMm: fillerMm,
        dummyFillerRightMm: fillerMm,
        carcassCoreMaterial: customCabinet.coreCode.trim(),
        shutterCoreMaterial: customCabinet.coreCode.trim(),
        externalFinishCodeA: customCabinet.externalCode.trim(),
        internalFinishCode: customCabinet.internalCode.trim(),
        backPanelThicknessMm: backThicknessMm,
        backPanelMount: backThicknessMm === 6 ? 'captured-groove' : 'overlay-structural',
        backPanelMaterial: customCabinet.backCode.trim(),
        drawerBottomMaterial: customCabinet.drawerBottomCode.trim(),
        drawerBottomThicknessMm: Number(customCabinet.drawerBottomThickness),
        bays,
        assumptions: [
          'Dimensions are user-entered and rounded to whole millimetres; verify opening, floor level, wall plumb, and installation clearances on site.',
          customCabinet.layout === 'standard'
            ? `Wardrobe interior proposal uses ${customCabinet.hangingClearHeight}mm clear hanging space, ${customCabinet.drawerCount} drawer fronts at ${customCabinet.drawerFrontHeight}mm nominal pitch in Bay 1, and ${customCabinet.upperShelfCount} additional shelf panel(s) in the upper remainder zone. Confirm exact hardware, joinery, and hanger/rod position.`
            : 'Selected internal layout, hardware, and joinery remain editable design assumptions; confirm before fabrication.',
          '18mm carcass and shutter boards, 100mm plinth, and selected back construction are design inputs; verify supplier stock, groove/overlay details, hardware, and edge treatment.',
        ],
      };
      const result = analyze2DDrawingsToCutlist(input);
      setDrawingInput(input);
      setDrawingAnalysisResult(result);
      setDrawingPresetKey('custom');
      setDrawingViewTab('visual2d');
      setCustomCabinetError('');
    } catch (error) {
      setCustomCabinetError(error instanceof Error ? error.message : 'Could not generate this cabinet cutlist. Check the dimensions and material codes.');
    }
  }

  function handleUpdateDrawingInput(patch: Partial<DrawingCutlistInput>) {
    if (!drawingInput) return;
    const updated: DrawingCutlistInput = {
      ...drawingInput,
      ...patch,
    };
    try {
      const result = analyze2DDrawingsToCutlist(updated);
      setDrawingInput(updated);
      setDrawingAnalysisResult(result);
      setCustomCabinetError('');
    } catch (error) {
      setCustomCabinetError(error instanceof Error ? error.message : 'The current dimensions do not form a valid cabinet schedule.');
    }
  }

  const liveDrawingSvg = useMemo(() => {
    if (!drawingInput) return '';
    return generateDrawingCutlistSvg(drawingInput, drawingSvgMode);
  }, [drawingInput, drawingSvgMode]);

  function downloadDrawingSvg() {
    if (!liveDrawingSvg || !drawingInput) return;
    const blob = new Blob([liveDrawingSvg], { type: 'image/svg+xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ultida-2d-${drawingInput.unitId || 'casework'}-${drawingSvgMode}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadDrawingHardwareCsv() {
    if (!drawingAnalysisResult) return;
    const headers = ['Hardware Name', 'Category', 'Quantity', 'Unit', 'Specification', 'Assigned Bay', 'Notes'];
    const rows = drawingAnalysisResult.hardware.map((hw) => [
      `"${hw.name}"`, hw.category, hw.quantity, hw.unit, `"${hw.specification ?? ''}"`, `"${hw.assignedBay ?? ''}"`, `"${hw.notes ?? ''}"`
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ultida-hardware-schedule-${drawingAnalysisResult.roomId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadCabinetDraftWorkbook() {
    if (!projectId || !drawingInput) {
      setExportState('Enter cabinet dimensions and generate a valid cutlist draft first.');
      return;
    }
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) throw new Error('Sign in before downloading the cabinet workbook.');
      setExportState('Building the review-required cabinet workbook...');
      const response = await fetch(`${getApiBase()}/projects/${projectId}/production/cabinet-cutlist.xlsx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId, input: drawingInput }),
      });
      if (!response.ok) {
        const problem = await response.json().catch(() => null);
        throw new Error(problem?.message ?? 'The cabinet workbook could not be generated.');
      }
      const file = await response.blob();
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ultida-${drawingInput.unitId ?? 'cabinet'}-cutlist-draft.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      setExportState('Draft Excel downloaded. It is marked review-required and is not a fabrication release.');
    } catch (error) {
      setExportState(error instanceof Error ? error.message : 'The cabinet workbook could not be downloaded.');
    }
  }

  function applyDrawingAnalysisToCutlist() {
    if (!drawingAnalysisResult) return;
    const newParts: Part[] = drawingAnalysisResult.panels.map((p) => ({
      id: p.id,
      partInstanceId: p.partInstanceId,
      moduleId: p.moduleId,
      family: 'analyzed-casework',
      roomId: p.roomId,
      semanticType: p.semanticType,
      partName: p.partName,
      lengthMm: p.lengthMm,
      widthMm: p.widthMm,
      thicknessMm: p.thicknessMm,
      quantity: p.quantity,
      grainDirection: p.grainDirection,
      edging: p.edging,
      edgeSchedule: {
        l1Mm: p.edgeSchedule.l1Mm,
        l2Mm: p.edgeSchedule.l2Mm,
        w1Mm: p.edgeSchedule.w1Mm,
        w2Mm: p.edgeSchedule.w2Mm,
        tapeType: p.edgeSchedule.tapeType,
      },
      materialCode: p.materialCode,
      faceFinishes: p.faceFinishes,
      status: 'review_required' as const,
    }));
    setParts((prev) => [...prev, ...newParts]);
    setShowDrawingAnalyzer(false);
    setExportState(`Added ${newParts.length} cabinet panels as review-required drafts. Confirm their sizes, materials, and construction before release.`);
  }


  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="production-workspace">
      <div className="production-main">

        {/* ── Tab bar ── */}
        <nav className="production-tabs" aria-label="Cutlist Studio tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`production-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.icon}<span>{tab.label}</span>
            </button>
          ))}
          <button
            type="button"
            className="production-tab"
            style={{ marginLeft: 'auto', color: 'var(--gold)', borderColor: 'rgba(197, 156, 45, 0.35)', fontWeight: 600 }}
            onClick={() => navigate(`/projects/${projectId}/estimate`)}
            title="Switch to Stage 5: Commercial Estimate, BOQ & Client Delivery"
          >
            <Receipt size={14} /><span>Estimate &amp; Delivery →</span>
          </button>
        </nav>

        <div className="production-tab-content">

          {/* ══════ CUTLIST TAB ══════ */}
          {activeTab === 'cutlist' && (
            <div className="cutlist-view">

              {/* ── Active Scope Selector (Pick Only Needed Rooms / Walls) ── */}
              <div className="cutlist-scope-bar">
                <div className="scope-bar-left">
                  <span className="scope-label"><Filter size={13} /> Active Scope:</span>
                  <div className="scope-pills">
                    <button
                      type="button"
                      className={`scope-pill${activeRoomScope === 'all' ? ' active' : ''}`}
                      onClick={() => setActiveRoomScope('all')}
                    >
                      All Rooms ({parts.length})
                    </button>
                    {uniqueRooms.map((rId) => {
                      const count = parts.filter((p) => p.roomId === rId).length;
                      return (
                        <button
                          key={rId}
                          type="button"
                          className={`scope-pill${activeRoomScope === rId ? ' active' : ''}`}
                          onClick={() => setActiveRoomScope(rId)}
                        >
                          {rId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="scope-bar-right">
                  <Button
                    variant="primary" size="sm"
                    icon={<Compass size={13} />}
                    onClick={() => run2DDrawingAnalysis()}
                  >
                    2D Drawing Cutlist Analyzer
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => run2DDrawingAnalysis(undefined, 'custom')}>
                    Enter cabinet sizes
                  </Button>
                </div>
              </div>

              {/* Fabrication Certification Banner */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, margin: '8px 0 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#065f46', fontWeight: 600 }}>
                    <CheckCircle2 size={13} style={{ color: '#10b981' }} />
                    Fabrication-Certified Modules Active (Wardrobes, Kitchens, TV Units, Study, Pooja)
                  </span>
                  <span style={{ color: '#cbd5e1' }}>•</span>
                  <span style={{ color: '#475569' }}>
                    {scopedParts.filter((p) => FABRICATION_CERTIFIED_FAMILIES.has(p.family.toLowerCase()) || !['sofa', 'dining', 'bed', 'loose', 'accent-chair', 'coffee-table'].includes(p.family.toLowerCase())).length} Certified CNC Panels
                  </span>
                </div>
                <span style={{ color: '#94a3b8', fontSize: 11 }}>
                  W06 / System 32 Precision Standard
                </span>
              </div>

              {/* Excluded Modules Certification Alert */}
              {((cutlist?.excludedModules && cutlist.excludedModules.length > 0) || modules.some((m) => !FABRICATION_CERTIFIED_FAMILIES.has(m.family.toLowerCase()) && ['sofa', 'dining', 'bed', 'loose', 'accent-chair', 'coffee-table', 'lighting', 'decor'].includes(m.family.toLowerCase()))) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 14px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a', fontSize: 12, margin: '8px 0 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#92400e', fontWeight: 600 }}>
                      <AlertTriangle size={15} style={{ color: '#f59e0b' }} />
                      <span>Loose &amp; Uncertified Modules Withheld from Fabrication Cutlist</span>
                      <span style={{ background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                        {cutlist?.excludedModules?.length ?? modules.filter((m) => !FABRICATION_CERTIFIED_FAMILIES.has(m.family.toLowerCase())).length} Excluded
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: '#b45309' }}>Only certified System 32 panel millwork enters manufacturing release</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                    {(cutlist?.excludedModules ?? modules.filter((m) => !FABRICATION_CERTIFIED_FAMILIES.has(m.family.toLowerCase())).map((m) => ({ moduleId: m.id, family: m.family, moduleName: m.label, reason: `Module family '${m.family}' is uncertified for panel cutlist generation.` }))).map((m) => (
                      <span key={m.moduleId} style={{ padding: '2px 8px', background: '#fef3c7', borderRadius: 4, color: '#78350f', fontSize: 11, border: '1px solid #fcd34d' }}>
                        <strong>{m.moduleName ?? m.moduleId}</strong> ({m.family})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sheet Size Optimization Selector */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', margin: '8px 0 12px', fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>Sheet Size Optimization:</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {SHEET_SIZE_OPTIONS.map((opt) => {
                      const isSelected = selectedSheetKey === opt.key;
                      const isBest = cutlist?.multiSheetOptimization?.bestSize?.widthMm === opt.widthMm;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setSelectedSheetKey(opt.key)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: isSelected ? 700 : 500,
                            background: isSelected ? '#1e293b' : '#ffffff',
                            color: isSelected ? '#ffffff' : '#475569',
                            border: isSelected ? '1px solid #1e293b' : '1px solid #cbd5e1',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                          }}
                        >
                          {opt.label}
                          {isBest && (
                            <span style={{ background: '#10b981', color: '#ffffff', fontSize: 9, padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>
                              BEST YIELD
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <span style={{ color: '#64748b', fontSize: 11 }}>
                  {activeSheetSize.desc}
                </span>
              </div>

              {/* Summary cards */}
              <div className="cutlist-summary-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <div className="cutlist-stat-card">
                  <span className="stat-label">Total Panels</span>
                  <strong className="stat-value">{scopedParts.reduce((s, p) => s + p.quantity, 0)}</strong>
                  <span className="stat-sub">{scopedParts.length} unique parts {activeRoomScope !== 'all' ? `(${activeRoomScope})` : ''}</span>
                </div>
                <div className="cutlist-stat-card">
                  <span className="stat-label">Sheets Required</span>
                  <strong className="stat-value">{nestedSheets.length}</strong>
                  <span className="stat-sub">{activeSheetSize.key.toUpperCase()} sheets ({materialCount} materials)</span>
                </div>
                <div className="cutlist-stat-card">
                  <span className="stat-label">Materials</span>
                  <strong className="stat-value">{materialCount}</strong>
                  <span className="stat-sub">{new Set(scopedParts.map((p) => p.thicknessMm)).size} thickness(es)</span>
                </div>
                <div className="cutlist-stat-card">
                  <span className="stat-label">Edge Band</span>
                  <strong className="stat-value">{totalEdgeBandM.toFixed(1)} m</strong>
                  <span className="stat-sub">{cutlist?.edgeBanding.length ?? 0} tape type(s)</span>
                </div>
                <div
                  className="cutlist-stat-card"
                  onClick={() => setShowCostBreakdown((v) => !v)}
                  style={{ cursor: 'pointer', border: showCostBreakdown ? '1px solid #059669' : undefined, background: showCostBreakdown ? '#ecfdf5' : undefined }}
                  title="Click to view full real-time cost breakdown"
                >
                  <span className="stat-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Estimated Cost</span>
                    <span style={{ fontSize: 10, color: '#059669', fontWeight: 600 }}>{showCostBreakdown ? '▲ Hide' : '▼ Details'}</span>
                  </span>
                  <strong className="stat-value" style={{ color: '#047857' }}>₹{liveCostRollup.estimatedGrandTotal.toLocaleString('en-IN')}</strong>
                  <span className="stat-sub">₹{liveCostRollup.costPerSqft}/sq.ft (incl. GST &amp; labor)</span>
                </div>
              </div>

              {/* Live Cost Breakdown Drawer */}
              {showCostBreakdown && (
                <div style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '16px 20px', margin: '0 0 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                        Live Production Cost Rollup (Real-Time Studio Rates)
                      </h4>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>
                        Calculated directly from nested sheet count ({liveCostRollup.sheetCount} sheets / {liveCostRollup.totalSqft} sq.ft), edge-banding ({totalEdgeBandM.toFixed(1)}m), and hardware BOM
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => navigate(`/projects/${projectId}/commercial`)}>
                      Commercial Studio →
                    </Button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, fontSize: 12 }}>
                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <div style={{ color: '#64748b', fontSize: 11 }}>Carcass Boards ({liveCostRollup.carcassSheetCount} sheets)</div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginTop: 2 }}>₹{liveCostRollup.carcassBoardCost.toLocaleString('en-IN')}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>HDHMR Green Core @ ₹95/sq.ft</div>
                    </div>
                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <div style={{ color: '#64748b', fontSize: 11 }}>Shutter Finishes ({liveCostRollup.shutterSheetCount} sheets)</div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginTop: 2 }}>₹{liveCostRollup.shutterFinishCost.toLocaleString('en-IN')}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>1mm Decorative Laminate @ ₹85/sq.ft</div>
                    </div>
                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <div style={{ color: '#64748b', fontSize: 11 }}>Edge Banding Tape</div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginTop: 2 }}>₹{liveCostRollup.edgeBandingCost.toLocaleString('en-IN')}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{totalEdgeBandM.toFixed(1)} meters @ ₹35/m</div>
                    </div>
                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <div style={{ color: '#64748b', fontSize: 11 }}>Hardware &amp; Fasteners BOM</div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginTop: 2 }}>₹{liveCostRollup.hardwareBOMCost.toLocaleString('en-IN')}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>Hinges, slides, handles &amp; minifix</div>
                    </div>
                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <div style={{ color: '#64748b', fontSize: 11 }}>Factory &amp; Assembly Labor</div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginTop: 2 }}>₹{liveCostRollup.laborSubtotal.toLocaleString('en-IN')}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>Sizing, boring &amp; site alignment</div>
                    </div>
                    <div style={{ padding: '10px 12px', background: '#ecfdf5', borderRadius: 6, border: '1px solid #a7f3d0' }}>
                      <div style={{ color: '#065f46', fontSize: 11, fontWeight: 600 }}>Grand Total (incl. 18% GST)</div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: '#047857', marginTop: 2 }}>₹{liveCostRollup.estimatedGrandTotal.toLocaleString('en-IN')}</div>
                      <div style={{ fontSize: 10, color: '#059669' }}>Markup ₹{liveCostRollup.studioMarkup.toLocaleString('en-IN')} + GST ₹{liveCostRollup.totalGst.toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Fabrication Safety & Certification Gating Banner ─── */}
              {Boolean(cutlist?.excludedModules?.length) && (
                <div style={{ margin: '14px 0', padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#92400e', fontWeight: 700, fontSize: 13 }}>
                    <AlertTriangle size={16} color="#d97706" />
                    <span>{cutlist!.excludedModules!.length} Module(s) Withheld from Panel Cutlist (Fabrication Gated)</span>
                    <Badge variant="warning" style={{ marginLeft: 'auto' }}>Certification Gate Active</Badge>
                  </div>
                  <p style={{ margin: '6px 0 10px', fontSize: 12, color: '#78350f', lineHeight: 1.5 }}>
                    Per ULTIDA manufacturing safety rules, uncertified decorative, accent, or loose furniture items (e.g. sofas, dining tables, freestanding lighting) are strictly excluded from automated sheet nesting and panel cutlists.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {cutlist!.excludedModules!.map((excl, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: '#fef3c7', borderRadius: 6, fontSize: 11.5 }}>
                        <strong style={{ color: '#78350f' }}>{excl.moduleName || excl.moduleId}</strong>
                        <span style={{ color: '#b45309' }}>({excl.family})</span>
                        <span style={{ color: '#92400e', marginLeft: 'auto', fontStyle: 'italic' }}>{excl.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Pricing Safety Alert Banner ─── */}
              {Boolean(liveCostRollup.pricingWarnings?.length) && (
                <div style={{ margin: '14px 0', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#991b1b', fontWeight: 700, fontSize: 12.5 }}>
                    <AlertTriangle size={15} color="#dc2626" />
                    <span>Pricing Safety Alert: Unverified Material Pricing Units</span>
                  </div>
                  <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 11.5, color: '#b91c1c' }}>
                    {liveCostRollup.pricingWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Toolbar */}
              <div className="parts-toolbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <h4 style={{ margin: 0 }}>Panel Cutlist {activeRoomScope !== 'all' ? `— ${activeRoomScope.replace(/-/g, ' ').toUpperCase()}` : ''}</h4>
                  
                  {/* Cutlist Sub-View Switcher */}
                  <div style={{ display: 'flex', gap: 4, background: '#f5eee3', padding: 3, borderRadius: 7 }}>
                    <button
                      type="button"
                      onClick={() => setCutlistViewMode('table')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 5,
                        border: 0,
                        fontSize: 11.5,
                        fontWeight: cutlistViewMode === 'table' ? 800 : 600,
                        background: cutlistViewMode === 'table' ? '#fff' : 'transparent',
                        color: cutlistViewMode === 'table' ? '#1c1917' : '#78716c',
                        cursor: 'pointer',
                        boxShadow: cutlistViewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      }}
                    >
                      <LayoutGrid size={12} style={{ display: 'inline', marginRight: 4 }} /> Parts Table
                    </button>
                    <button
                      type="button"
                      onClick={() => setCutlistViewMode('nesting')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 5,
                        border: 0,
                        fontSize: 11.5,
                        fontWeight: cutlistViewMode === 'nesting' ? 800 : 600,
                        background: cutlistViewMode === 'nesting' ? '#fff' : 'transparent',
                        color: cutlistViewMode === 'nesting' ? '#1c1917' : '#78716c',
                        cursor: 'pointer',
                        boxShadow: cutlistViewMode === 'nesting' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      }}
                    >
                      <Maximize2 size={12} style={{ display: 'inline', marginRight: 4 }} /> 2D Sheet Nesting ({nestedSheets.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCutlistViewMode('edgebanding')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 5,
                        border: 0,
                        fontSize: 11.5,
                        fontWeight: cutlistViewMode === 'edgebanding' ? 800 : 600,
                        background: cutlistViewMode === 'edgebanding' ? '#fff' : 'transparent',
                        color: cutlistViewMode === 'edgebanding' ? '#1c1917' : '#78716c',
                        cursor: 'pointer',
                        boxShadow: cutlistViewMode === 'edgebanding' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      }}
                    >
                      <Scissors size={12} style={{ display: 'inline', marginRight: 4 }} /> Edge Banding Schedule
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    aria-label="Search cutlist"
                    value={partQuery}
                    onChange={(e) => setPartQuery(e.target.value)}
                    placeholder="Search room, module, material…"
                    className="cutlist-search"
                  />
                  <Badge variant="info">{visibleParts.length}/{scopedParts.length} parts</Badge>
                  <Button
                    variant="secondary" size="sm"
                    icon={<Download size={13} />}
                    disabled={!scopedParts.length || !sceneApproved}
                    onClick={downloadClientCsv}
                  >CSV</Button>
                  <Button
                    variant="ghost" size="sm"
                    icon={<Printer size={13} />}
                    onClick={() => window.print()}
                  >Print</Button>
                  <Button
                    variant="secondary" size="sm"
                    icon={<Tag size={13} />}
                    onClick={() => navigate('/tools/cutlist')}
                    title="Open Cutlist Studio for Part Stickers, Barcodes & Sliding Door Deductions"
                    style={{ borderColor: '#a7f3d0', background: '#ecfdf5', color: '#065f46', fontWeight: 600 }}
                  >Stickers &amp; Sliders →</Button>
                </div>
              </div>

              {/* Status message if no parts yet */}
              {!parts.length && (
                <p className="inspector-empty">{exportState}</p>
              )}


              {/* ══════ VIEW A: 2D SHEET NESTING OPTIMIZER ══════ */}
              {cutlistViewMode === 'nesting' && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Nesting Parameters Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '10px 14px', background: '#faf6f0', borderRadius: 8, border: '1px solid #e7ded4' }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#44403c' }}>
                        Sheet Stock: <strong>2440 × 1220 mm</strong>
                      </span>
                      <span style={{ fontSize: 12, color: '#78716c' }}>
                        Saw Kerf: <strong>{kerfMm}mm</strong> · Edge Trim: <strong>{trimMm}mm</strong>
                      </span>
                      <Badge variant="success">Total Sheets: {nestedSheets.length}</Badge>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      {nestedSheets.map((s, idx) => (
                        <button
                          key={s.sheetNumber}
                          onClick={() => setSelectedSheetIdx(idx)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: 6,
                            border: selectedSheetIdx === idx ? '1px solid #c59c2d' : '1px solid #d8cabb',
                            background: selectedSheetIdx === idx ? '#fff9e6' : '#fff',
                            color: selectedSheetIdx === idx ? '#92400e' : '#44403c',
                            fontSize: 11.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Sheet {s.sheetNumber} ({s.yieldPct}%)
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Nested Sheet Visual Canvas */}
                  {nestedSheets[selectedSheetIdx] && (() => {
                    const sheet = nestedSheets[selectedSheetIdx];
                    return (
                      <div style={{ background: '#1c1917', borderRadius: 12, padding: 18, color: '#f5f5f4', border: '1px solid #44403c' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <div>
                            <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#c59c2d', fontWeight: 800 }}>
                              Sheet {sheet.sheetNumber} of {nestedSheets.length} · {sheet.materialCode}
                            </span>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
                              Placed Area: {sheet.usedAreaSqm} m² · Total: {sheet.totalAreaSqm} m² (Yield: {sheet.yieldPct}% · Scrap: {sheet.scrapPct}%)
                            </div>
                          </div>
                          <button
                            onClick={() => window.print()}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              border: '1px solid #d8cabb',
                              background: '#fff',
                              color: '#1c1917',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Print Workshop Sheet
                          </button>
                        </div>

                        {/* Interactive SVG Sheet */}
                        <div style={{ width: '100%', maxHeight: 380, overflow: 'hidden', background: '#141210', borderRadius: 8, padding: 10, display: 'flex', justifyContent: 'center' }}>
                          <svg viewBox="0 0 2440 1220" style={{ width: '100%', height: 'auto', maxHeight: 360 }}>
                            {/* Sheet Perimeter */}
                            <rect x="0" y="0" width="2440" height="1220" fill="#24201c" stroke="#57534e" strokeWidth="4" />
                            {/* Trim Line */}
                            <rect x="10" y="10" width="2420" height="1200" fill="none" stroke="#78716c" strokeWidth="1" strokeDasharray="10 5" />

                            {/* Placed Panels */}
                            {sheet.placedPanels.map((p) => (
                              <g key={p.id} style={{ cursor: 'pointer' }} onClick={() => sendPartToCnc(p.partRef)}>
                                <rect
                                  x={p.x}
                                  y={p.y}
                                  width={p.w}
                                  height={p.h}
                                  fill={p.color}
                                  fillOpacity="0.82"
                                  stroke="#fff"
                                  strokeWidth="2"
                                  rx="2"
                                />
                                <text
                                  x={p.x + p.w / 2}
                                  y={p.y + p.h / 2 - 10}
                                  fill="#fff"
                                  fontSize={Math.max(16, Math.min(32, p.w * 0.08))}
                                  fontWeight="bold"
                                  textAnchor="middle"
                                >
                                  {p.name}
                                </text>
                                <text
                                  x={p.x + p.w / 2}
                                  y={p.y + p.h / 2 + 20}
                                  fill="#fff"
                                  fontSize={Math.max(14, Math.min(26, p.w * 0.07))}
                                  textAnchor="middle"
                                  opacity="0.9"
                                >
                                  {p.w} × {p.h} mm {p.grain === 'vertical' ? '↕' : p.grain === 'horizontal' ? '↔' : ''}
                                </text>
                              </g>
                            ))}
                          </svg>
                        </div>

                        <div style={{ marginTop: 10, fontSize: 11, color: '#a8a29e', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Tip: Click any nested panel to open its System 32 CNC boring toolpath simulator</span>
                          <span>Kerf 4mm · 10mm perimeter trim included</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ══════ VIEW B: COMPREHENSIVE EDGE BANDING SCHEDULE ══════ */}
              {cutlistViewMode === 'edgebanding' && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ marginBottom: 12 }}>
                    <h5 style={{ margin: '0 0 4px', fontSize: 14, color: '#1c1917' }}>Production Edge Banding Tape Schedule</h5>
                    <p style={{ margin: 0, fontSize: 12, color: '#78716c' }}>
                      Detailed tape breakdown with +10% trimming waste allowance and factory 50-meter roll procurement count.
                    </p>
                  </div>

                  <table className="production-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Tape Type &amp; Profile</th>
                        <th>Thickness</th>
                        <th>Net Meters</th>
                        <th>Gross (+10% Waste)</th>
                        <th>50m Rolls</th>
                        <th>Application Usage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {edgeBandingSchedule.map((eb, idx) => (
                        <tr key={idx}>
                          <td><strong>{eb.type}</strong></td>
                          <td><Badge variant="info">{eb.thickness}</Badge></td>
                          <td className="dim-cell">{eb.metersNet} m</td>
                          <td className="dim-cell"><strong>{eb.metersWithWaste} m</strong></td>
                          <td className="dim-cell"><Badge variant="success">{eb.rolls50m} rolls</Badge></td>
                          <td style={{ fontSize: 11.5, color: '#78716c' }}>{eb.usage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ══════ VIEW C: ROOM-GROUPED PARTS TABLE ══════ */}
              {cutlistViewMode === 'table' && (
                <div>
              {Object.entries(partsByRoom).map(([roomId, roomParts]) => {
                const isOpen = expandedRooms.has(roomId);
                const allApproved = roomParts.every((p) => p.status === 'approved');
                return (
                  <div key={roomId} className="cutlist-room-group">
                    <button
                      className="cutlist-room-header"
                      onClick={() => setExpandedRooms((prev) => {
                        const next = new Set(prev);
                        isOpen ? next.delete(roomId) : next.add(roomId);
                        return next;
                      })}
                      aria-expanded={isOpen}
                    >
                      <span className="room-chevron">{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                      <span className="room-name">{roomId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                      <Badge variant={allApproved ? 'success' : 'warning'}>{roomParts.length} parts</Badge>
                    </button>

                    {isOpen && (
                      <table className="production-table cutlist-table">
                        <thead>
                          <tr>
                            <th>Part ID</th>
                            <th>Part Name</th>
                            <th>Module</th>
                            <th>L (mm)</th>
                            <th>W (mm)</th>
                            <th>T (mm)</th>
                            <th>Qty</th>
                            <th>Material</th>
                            <th>Face finishes</th>
                            <th>Grain</th>
                            <th>Edge</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roomParts.map((part) => (
                            <tr key={part.id}>
                              <td className="part-id-cell">{part.partInstanceId}</td>
                              <td>{part.partName}</td>
                              <td>{part.family}</td>
                              <td className="dim-cell">{part.lengthMm}</td>
                              <td className="dim-cell">{part.widthMm}</td>
                              <td className="dim-cell">{part.thicknessMm}</td>
                              <td className="dim-cell">{part.quantity}</td>
                              <td>{part.materialCode}</td>
                              <td>{part.faceFinishes?.map((finish) => `${finish.face}: ${finish.finishCode}`).join(' · ') || '—'}</td>
                              <td className="grain-cell">
                                {part.grainDirection === 'horizontal' ? '↔' : part.grainDirection === 'vertical' ? '↕' : '—'}
                              </td>
                              <td>{part.edgeSchedule?.tapeType ?? 'none'}</td>
                              <td>
                                <Badge variant={part.status === 'approved' ? 'success' : 'warning'}>
                                  {part.status === 'approved' ? '✓' : 'Review'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}

              </div>
              )}

              {/* Board optimizer */}
              {sheetEstimates.length > 0 && (
                <div className="board-optimizer">
                  <h5>Board Optimizer</h5>
                  <p className="optimizer-note">Estimated sheet count based on part areas + {cutlist?.fabricationRules?.kerfMm ?? 4}mm kerf. Verify with your nesting software before ordering.</p>
                  <table className="production-table">
                    <thead><tr><th>Material</th><th>Sheet Size</th><th>Est. Sheets</th></tr></thead>
                    <tbody>
                      {sheetEstimates.map((e) => (
                        <tr key={e.code}>
                          <td>{e.code}</td>
                          <td>{e.sheetSize} mm</td>
                          <td><strong>{e.sheets}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── 2D Drawing Cutlist Analyzer Modal ── */}
              {showDrawingAnalyzer && (
                <div className="drawing-analyzer-backdrop" onClick={() => setShowDrawingAnalyzer(false)}>
                  <div className="drawing-analyzer-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="drawing-analyzer-header">
                      <h3><Compass size={18} /> 2D Drawing Cutlist &amp; Job List Engine</h3>
                      <button className="analyzer-close-btn" onClick={() => setShowDrawingAnalyzer(false)}>
                        <X size={18} />
                      </button>
                    </div>

                    <div className="drawing-analyzer-body">
                      {!drawingInput ? (
                        <form className="custom-cabinet-form" onSubmit={(event) => { event.preventDefault(); generateCustomCabinetCutlist(); }}>
                          <div>
                            <h4>Start a measured cabinet cutlist</h4>
                            <p>Enter the finished outside size. Dimensions convert to whole millimetres for panel cutting; confirm the site opening and construction details before release.</p>
                          </div>
                          <div className="analyzer-input-row">
                            <label className="analyzer-form-group">Width<input required type="number" min="0.1" step="any" value={customCabinet.width} onChange={(e) => setCustomCabinet((current) => ({ ...current, width: e.target.value }))} /></label>
                            <label className="analyzer-form-group">Height<input required type="number" min="0.1" step="any" value={customCabinet.height} onChange={(e) => setCustomCabinet((current) => ({ ...current, height: e.target.value }))} /></label>
                            <label className="analyzer-form-group">Depth <span aria-label="required">*</span><input required type="number" min="0.1" step="any" value={customCabinet.depth} placeholder="Required" onChange={(e) => setCustomCabinet((current) => ({ ...current, depth: e.target.value }))} /></label>
                            <label className="analyzer-form-group">Unit<select value={customCabinet.unit} onChange={(e) => setCustomCabinet((current) => ({ ...current, unit: e.target.value as CabinetDimensionUnit }))}>{(['mm', 'cm', 'm', 'ft', 'in'] as CabinetDimensionUnit[]).map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label>
                          </div>
                          <div className="analyzer-input-row">
                            <label className="analyzer-form-group">Number of bays<select value={customCabinet.bayCount} onChange={(e) => setCustomCabinet((current) => ({ ...current, bayCount: e.target.value }))}>{[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
                            <label className="analyzer-form-group">Interior arrangement<select value={customCabinet.layout} onChange={(e) => setCustomCabinet((current) => ({ ...current, layout: e.target.value as typeof current.layout }))}><option value="standard">Balanced wardrobe · 1050 hang + 200 drawers + shelves</option><option value="hanging">Hanging bays + upper shelves</option><option value="shelves">Adjustable shelves</option><option value="drawers">Drawer bay + hanging bays</option></select></label>
                            <label className="analyzer-form-group">Plinth height (mm)<input required type="number" min="0" step="1" value={customCabinet.plinth} onChange={(e) => setCustomCabinet((current) => ({ ...current, plinth: e.target.value }))} /></label>
                            <label className="analyzer-form-group">Wall fillers (each side, mm)<input required type="number" min="0" step="1" value={customCabinet.fillers} onChange={(e) => setCustomCabinet((current) => ({ ...current, fillers: e.target.value }))} /></label>
                          </div>
                          {(customCabinet.layout === 'standard' || customCabinet.layout === 'hanging' || customCabinet.layout === 'drawers') && (
                            <div className="analyzer-input-row">
                              <label className="analyzer-form-group">Hanging clear height (mm)<input type="number" min="500" max="1800" step="10" value={customCabinet.hangingClearHeight} onChange={(e) => setCustomCabinet((current) => ({ ...current, hangingClearHeight: e.target.value }))} /></label>
                              <label className="analyzer-form-group">Drawer front pitch (mm)<input type="number" min="100" max="350" step="10" value={customCabinet.drawerFrontHeight} onChange={(e) => setCustomCabinet((current) => ({ ...current, drawerFrontHeight: e.target.value }))} /></label>
                              <label className="analyzer-form-group">Drawers in Bay 1<input type="number" min="1" max="8" step="1" value={customCabinet.drawerCount} onChange={(e) => setCustomCabinet((current) => ({ ...current, drawerCount: e.target.value }))} /></label>
                              <label className="analyzer-form-group">Extra shelves above hang<input type="number" min="0" max="6" step="1" value={customCabinet.upperShelfCount} onChange={(e) => setCustomCabinet((current) => ({ ...current, upperShelfCount: e.target.value }))} /></label>
                            </div>
                          )}
                          <p className="custom-cabinet-note">The balanced preset applies a drawer stack and hanging zone to Bay 1; Bay 2 is hanging when present; remaining bays use adjustable shelves. Every clear height is checked against the entered cabinet height and plinth.</p>
                          <div className="analyzer-input-row">
                            <label className="analyzer-form-group">Carcass board code<input required list="cabinet-material-codes" value={customCabinet.coreCode} placeholder="e.g. HDHMR-18 supplier code" onChange={(e) => setCustomCabinet((current) => ({ ...current, coreCode: e.target.value }))} /></label>
                            <label className="analyzer-form-group">External laminate code<input required list="cabinet-material-codes" value={customCabinet.externalCode} placeholder="Supplier decor code" onChange={(e) => setCustomCabinet((current) => ({ ...current, externalCode: e.target.value }))} /></label>
                            <label className="analyzer-form-group">Internal laminate code<input required list="cabinet-material-codes" value={customCabinet.internalCode} placeholder="Supplier liner code" onChange={(e) => setCustomCabinet((current) => ({ ...current, internalCode: e.target.value }))} /></label>
                            <datalist id="cabinet-material-codes">{materials.map((material) => <option key={material.id} value={material.code}>{material.name}</option>)}</datalist>
                          </div>
                          <div className="analyzer-input-row">
                            <label className="analyzer-form-group">Back-board thickness<select value={customCabinet.backThickness} onChange={(e) => setCustomCabinet((current) => ({ ...current, backThickness: e.target.value as '6' | '18', backCode: e.target.value === '6' ? 'PLY-BACK-06' : 'HDHMR-BACK-18' }))}><option value="6">6mm · captured in groove</option><option value="18">18mm · structural overlay</option></select></label>
                            <label className="analyzer-form-group">Back-board material code<input required value={customCabinet.backCode} onChange={(e) => setCustomCabinet((current) => ({ ...current, backCode: e.target.value }))} /></label>
                            <label className="analyzer-form-group">Drawer-bottom board code<input required value={customCabinet.drawerBottomCode} onChange={(e) => setCustomCabinet((current) => ({ ...current, drawerBottomCode: e.target.value }))} /></label>
                            <label className="analyzer-form-group">Drawer-bottom thickness (mm)<input required type="number" min="3" max="18" step="1" value={customCabinet.drawerBottomThickness} onChange={(e) => setCustomCabinet((current) => ({ ...current, drawerBottomThickness: e.target.value }))} /></label>
                          </div>
                          <div className="custom-cabinet-note"><strong>Construction distinction:</strong> A 6mm back is sized for a captured groove and leaves carcass depth unchanged. An 18mm overlay back shortens carcass members by 18mm to preserve the entered outside depth. Board codes and hardware availability must be verified with your supplier.</div>
                          {customCabinetError && <p className="custom-cabinet-error" role="alert">{customCabinetError}</p>}
                          <div className="analyzer-input-row"><Button type="button" variant="secondary" onClick={() => setShowDrawingAnalyzer(false)}>Cancel</Button><Button type="submit" variant="primary">Generate cutlist draft</Button></div>
                        </form>
                      ) : (
                      <>
                      {/* Top Bar with Room Selector and View Mode */}
                      <div className="analyzer-subnav">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#57534e' }}>Target Room:</span>
                          <select
                            value={drawingAnalysisResult?.roomId || activeRoomScope}
                            onChange={(e) => run2DDrawingAnalysis(e.target.value)}
                            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #dcd1c2', fontSize: 12, background: '#fff' }}
                          >
                            {uniqueRooms.map((rId) => (
                              <option key={rId} value={rId}>
                                {rId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                              </option>
                            ))}
                          </select>
                          <span style={{ fontSize: 11.5, color: '#78716c' }}>
                            {drawingAnalysisResult?.overallWidthMm} × {drawingAnalysisResult?.depthMm} × {drawingAnalysisResult?.overallHeightMm} mm
                          </span>
                        </div>

                        <div className="analyzer-view-tabs">
                          <button
                            type="button"
                            className={`analyzer-tab-btn${drawingViewTab === 'visual2d' ? ' active' : ''}`}
                            onClick={() => setDrawingViewTab('visual2d')}
                          >
                            📐 2D Drawing View
                          </button>
                          <button
                            type="button"
                            className={`analyzer-tab-btn${drawingViewTab === 'panels' ? ' active' : ''}`}
                            onClick={() => setDrawingViewTab('panels')}
                          >
                            📋 Panels ({drawingAnalysisResult?.panels.length ?? 0})
                          </button>
                          <button
                            type="button"
                            className={`analyzer-tab-btn${drawingViewTab === 'hardware' ? ' active' : ''}`}
                            onClick={() => setDrawingViewTab('hardware')}
                          >
                            🔩 Hardware &amp; Job List ({drawingAnalysisResult?.hardware.length ?? 0})
                          </button>
                          <button
                            type="button"
                            className={`analyzer-tab-btn${drawingViewTab === 'audit' ? ' active' : ''}`}
                            onClick={() => setDrawingViewTab('audit')}
                          >
                            📏 Audit &amp; Sheets ({drawingAnalysisResult?.sheetEstimates.length ?? 0})
                          </button>
                        </div>
                      </div>

                      {/* Summary metrics strip */}
                      {drawingAnalysisResult && (
                        <div className="analyzer-summary-grid">
                          <div className="analyzer-metric-card">
                            <span className="label">Panels</span>
                            <span className="value">{drawingAnalysisResult.summary.totalPanels}</span>
                            <span className="sub">{drawingAnalysisResult.summary.uniqueParts} parts</span>
                          </div>
                          <div className="analyzer-metric-card">
                            <span className="label">Total Area</span>
                            <span className="value">{drawingAnalysisResult.summary.totalAreaSqm} m²</span>
                            <span className="sub">substrate panels only</span>
                          </div>
                          <div className="analyzer-metric-card">
                            <span className="label">Board Estimate</span>
                            <span className="value">{drawingAnalysisResult.summary.estimatedSheetsTotal}</span>
                            <span className="sub">area-based, not nested</span>
                          </div>
                          <div className="analyzer-metric-card">
                            <span className="label">Edge Banding</span>
                            <span className="value">{drawingAnalysisResult.summary.totalEdgeBandMeters} m</span>
                            <span className="sub">PVC 0.8 &amp; 2mm</span>
                          </div>
                          <div className="analyzer-metric-card">
                            <span className="label">Hardware</span>
                            <span className="value">{drawingAnalysisResult.hardware.reduce((s, h) => s + h.quantity, 0)}</span>
                            <span className="sub">{drawingAnalysisResult.hardware.length} items</span>
                          </div>
                        </div>
                      )}

                      {/* Tab 0: 2D Drawing View (External & Internal Section) */}
                      {drawingViewTab === 'visual2d' && drawingInput && (
                        <div style={{ display: 'grid', gap: 14 }}>
                          {/* Top Controls Bar */}
                          <div className="analyzer-svg-topbar">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#78716c' }}>
                                Drawing Preset:
                              </span>
                              <select
                                value={drawingPresetKey}
                                onChange={(e) => run2DDrawingAnalysis(drawingInput.roomId, e.target.value)}
                                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #dcd1c2', fontSize: 11.5, background: '#fff' }}
                              >
                                <option value="wardrobe_4door">4-Door Master Wardrobe (2400×2400)</option>
                                <option value="kitchen_base">Kitchen Base Run (Tandem Drawers &amp; Units)</option>
                              <option value="tv_console">Living Room TV Console (2100×450)</option>
                              <option value="crockery_unit">Dining Crockery Cabinet (1800×2100)</option>
                              <option value="custom">Enter a cabinet size…</option>
                              {rawScene && <option value="from_scene">Current 3D Room Casework</option>}
                              </select>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#78716c' }}>
                                View Mode:
                              </span>
                              <div className="analyzer-mode-pills">
                                <button
                                  type="button"
                                  className={`analyzer-mode-pill${drawingSvgMode === 'both' ? ' active' : ''}`}
                                  onClick={() => setDrawingSvgMode('both')}
                                >
                                  Elevation + Carcass
                                </button>
                                <button
                                  type="button"
                                  className={`analyzer-mode-pill${drawingSvgMode === 'external' ? ' active' : ''}`}
                                  onClick={() => setDrawingSvgMode('external')}
                                >
                                  External Elevation
                                </button>
                                <button
                                  type="button"
                                  className={`analyzer-mode-pill${drawingSvgMode === 'internal' ? ' active' : ''}`}
                                  onClick={() => setDrawingSvgMode('internal')}
                                >
                                  Internal Carcass Section
                                </button>
                              </div>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={<Download size={12} />}
                                onClick={downloadDrawingSvg}
                              >
                                SVG
                              </Button>
                            </div>
                          </div>

                          {/* Split View: Left SVG Stage, Right Parameter Configurator */}
                          <div className="analyzer-split-grid">
                            <div className="analyzer-svg-stage">
                              <div
                                style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
                                dangerouslySetInnerHTML={{ __html: liveDrawingSvg }}
                              />
                            </div>

                            <div className="analyzer-config-panel">
                              <h4 className="analyzer-config-title">
                                <Sliders size={14} /> Joinery &amp; Sizing Specs
                              </h4>

                              <div className="analyzer-input-row">
                                <div className="analyzer-form-group">
                                  <label>Width (mm)</label>
                                  <input
                                    type="number"
                                    className="analyzer-input-field"
                                    value={drawingInput.overallWidthMm}
                                    step={50}
                                    min={300}
                                    max={6000}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      if (val > 0) {
                                        const bayCount = drawingInput.bays.length || 1;
                                        const fillerWidth = (drawingInput.dummyFillerLeftMm ?? 0) + (drawingInput.dummyFillerRightMm ?? 0);
                                        const carcassT = drawingInput.carcassThicknessMm ?? 18;
                                        const clearBayWidth = val - fillerWidth - carcassT * 2 - (bayCount - 1) * carcassT;
                                        const bayW = Math.floor(clearBayWidth / bayCount);
                                        const newBays = drawingInput.bays.map((b, i) => ({
                                          ...b,
                                          widthMm: i === bayCount - 1 ? clearBayWidth - bayW * (bayCount - 1) : bayW,
                                        }));
                                        handleUpdateDrawingInput({ overallWidthMm: val, bays: newBays });
                                      }
                                    }}
                                  />
                                </div>
                                <div className="analyzer-form-group">
                                  <label>Height (mm)</label>
                                  <input
                                    type="number"
                                    className="analyzer-input-field"
                                    value={drawingInput.overallHeightMm}
                                    step={50}
                                    min={300}
                                    max={3500}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      if (val > 0) handleUpdateDrawingInput({ overallHeightMm: val });
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="analyzer-input-row">
                                <div className="analyzer-form-group">
                                  <label>Depth (mm)</label>
                                  <input
                                    type="number"
                                    className="analyzer-input-field"
                                    value={drawingInput.depthMm}
                                    step={10}
                                    min={200}
                                    max={1200}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      if (val > 0) handleUpdateDrawingInput({ depthMm: val });
                                    }}
                                  />
                                </div>
                                <div className="analyzer-form-group">
                                  <label>Plinth (mm)</label>
                                  <input
                                    type="number"
                                    className="analyzer-input-field"
                                    value={drawingInput.plinthHeightMm ?? 100}
                                    step={10}
                                    min={50}
                                    max={200}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      if (val >= 0) handleUpdateDrawingInput({ plinthHeightMm: val });
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="analyzer-input-row">
                                <div className="analyzer-form-group">
                                  <label>Left Filler (mm)</label>
                                  <input
                                    type="number"
                                    className="analyzer-input-field"
                                    value={drawingInput.dummyFillerLeftMm ?? 30}
                                    step={5}
                                    min={0}
                                    max={150}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      if (val >= 0) handleUpdateDrawingInput({ dummyFillerLeftMm: val });
                                    }}
                                  />
                                </div>
                                <div className="analyzer-form-group">
                                  <label>Right Filler (mm)</label>
                                  <input
                                    type="number"
                                    className="analyzer-input-field"
                                    value={drawingInput.dummyFillerRightMm ?? 30}
                                    step={5}
                                    min={0}
                                    max={150}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      if (val >= 0) handleUpdateDrawingInput({ dummyFillerRightMm: val });
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="analyzer-form-group">
                                <label>Loft Height (mm)</label>
                                <input
                                  type="number"
                                  className="analyzer-input-field"
                                  value={drawingInput.loftHeightMm ?? 0}
                                  step={50}
                                  min={0}
                                  max={1000}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (val >= 0) handleUpdateDrawingInput({ loftHeightMm: val });
                                  }}
                                />
                              </div>

                              <div className="analyzer-input-row">
                                <label className="analyzer-form-group">Carcass board code<input list="drawing-material-codes" value={drawingInput.carcassCoreMaterial ?? ''} onChange={(e) => handleUpdateDrawingInput({ carcassCoreMaterial: e.target.value, shutterCoreMaterial: e.target.value })} /></label>
                                <label className="analyzer-form-group">External laminate code<input list="drawing-material-codes" value={drawingInput.externalFinishCodeA ?? ''} onChange={(e) => handleUpdateDrawingInput({ externalFinishCodeA: e.target.value })} /></label>
                                <label className="analyzer-form-group">Internal laminate code<input list="drawing-material-codes" value={drawingInput.internalFinishCode ?? ''} onChange={(e) => handleUpdateDrawingInput({ internalFinishCode: e.target.value })} /></label>
                                <label className="analyzer-form-group">Back board material<input list="drawing-material-codes" value={drawingInput.backPanelMaterial ?? ''} onChange={(e) => handleUpdateDrawingInput({ backPanelMaterial: e.target.value })} /></label>
                                <datalist id="drawing-material-codes">{materials.map((material) => <option key={material.id} value={material.code}>{material.name}</option>)}</datalist>
                              </div>
                              <div className="analyzer-input-row">
                                <label className="analyzer-form-group">Back board thickness<select value={drawingInput.backPanelThicknessMm ?? 6} onChange={(e) => { const thickness = Number(e.target.value) as 6 | 18; handleUpdateDrawingInput({ backPanelThicknessMm: thickness, backPanelMount: thickness === 6 ? 'captured-groove' : 'overlay-structural' }); }}><option value={6}>6mm · captured groove</option><option value={18}>18mm · structural overlay</option></select></label>
                                <label className="analyzer-form-group">Alternate external finish (optional)<input list="drawing-material-codes" value={drawingInput.externalFinishCodeB ?? ''} onChange={(e) => handleUpdateDrawingInput({ externalFinishCodeB: e.target.value })} /></label>
                              </div>

                              {/* Bay Summary Breakdown */}
                              <div style={{ marginTop: 4, display: 'grid', gap: 6 }}>
                                <label style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: '#78716c' }}>
                                  Carcass Bays ({drawingInput.bays.length})
                                </label>
                                {drawingInput.bays.map((bay, idx) => (
                                  <div key={bay.id} className="analyzer-bay-item">
                                    <div className="analyzer-bay-header">
                                      <span>{bay.label || `Bay ${idx + 1}`}</span>
                                      <Badge variant="info">{bay.widthMm} mm</Badge>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, fontSize: 11, color: '#666', flexWrap: 'wrap' }}>
                                      <span>Type: <strong>{bay.type}</strong></span>
                                      {bay.drawerCount ? <span>· {bay.drawerCount} drawers</span> : null}
                                      {bay.adjustableShelvesCount ? <span>· {bay.adjustableShelvesCount} adj. shelves</span> : null}
                                      {bay.hasHangingRod ? <span>· Hanging rod</span> : null}
                                      {drawingAnalysisResult?.wardrobeBaySchedules.find((schedule) => schedule.bayId === bay.id)?.hangingClearHeightMm
                                        ? <span>· {drawingAnalysisResult?.wardrobeBaySchedules.find((schedule) => schedule.bayId === bay.id)?.hangingClearHeightMm} mm clear hanging</span>
                                        : null}
                                      {bay.drawerFrontHeightMm ? <span>· {bay.drawerFrontHeightMm} mm drawer pitch</span> : null}
                                      {drawingAnalysisResult?.wardrobeBaySchedules.find((schedule) => schedule.bayId === bay.id)
                                        ? <span>· Shelf heights: {drawingAnalysisResult?.wardrobeBaySchedules.find((schedule) => schedule.bayId === bay.id)?.shelfBottomElevationsMm.join(', ')} mm FFL</span>
                                        : null}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Standard specs note */}
                              <div style={{ background: '#f5f5f4', padding: '8px 10px', borderRadius: 6, fontSize: 10.5, color: '#78716c', lineHeight: 1.4 }}>
                                <strong>Draft joinery basis:</strong> 18mm carcass board, 6mm captured-groove back or 18mm structural overlay. Confirm reveals, fixing method, and drilling details for the selected hardware before manufacture.
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tab 1: Panels Cutlist */}
                      {drawingViewTab === 'panels' && drawingAnalysisResult && (
                        <div style={{ overflowX: 'auto' }}>
                          <table className="production-table cutlist-table">
                            <thead>
                              <tr>
                                <th>Part ID</th>
                                <th>Name &amp; Anatomy</th>
                                <th>L (mm)</th>
                                <th>W (mm)</th>
                                <th>T (mm)</th>
                                <th>Qty</th>
                                <th>Material</th>
                                <th>Grain</th>
                                <th>Edging Schedule</th>
                                <th>Surface finishes</th>
                                <th>Install elevation FFL (mm)</th>
                                <th>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {drawingAnalysisResult.panels.map((p) => (
                                <tr key={p.id}>
                                  <td className="part-id-cell">{p.partInstanceId}</td>
                                  <td><strong>{p.partName}</strong></td>
                                  <td className="dim-cell">{p.lengthMm}</td>
                                  <td className="dim-cell">{p.widthMm}</td>
                                  <td className="dim-cell">{p.thicknessMm}</td>
                                  <td className="dim-cell">{p.quantity}</td>
                                  <td>{p.materialCode}</td>
                                  <td className="grain-cell">{p.grainDirection === 'horizontal' ? '↔' : p.grainDirection === 'vertical' ? '↕' : '—'}</td>
                                  <td>{p.edging}</td>
                                  <td>{p.faceFinishes?.length ? p.faceFinishes.map((finish) => `${finish.face}: ${finish.finishCode} (${finish.areaSqm} m²)`).join(' · ') : 'No face laminate assigned'}</td>
                                  <td>{p.installElevationsFromFloorMm?.join(' · ') ?? '—'}</td>
                                  <td style={{ color: '#78716c', fontSize: 11 }}>{p.notes ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Tab 2: Hardware & Consumables Job Schedule */}
                      {drawingViewTab === 'hardware' && drawingAnalysisResult && (
                        <div style={{ overflowX: 'auto' }}>
                          <table className="production-table">
                            <thead>
                              <tr>
                                <th>Hardware Name &amp; Spec</th>
                                <th>Category</th>
                                <th>Qty</th>
                                <th>Unit</th>
                                <th>Location / Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {drawingAnalysisResult.hardware.map((hw) => (
                                <tr key={hw.id}>
                                  <td>
                                    <strong>{hw.name}</strong>
                                    <div style={{ fontSize: 11, color: '#78716c' }}>{hw.specification}</div>
                                  </td>
                                  <td><Badge variant="info">{hw.category}</Badge></td>
                                  <td className="dim-cell">{hw.quantity}</td>
                                  <td>{hw.unit}</td>
                                  <td style={{ color: '#57534e', fontSize: 11 }}>{hw.assignedBay ? `${hw.assignedBay} · ` : ''}{hw.notes ?? 'System 32 verified'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Tab 3: Sheet Optimization & Audit */}
                      {drawingViewTab === 'audit' && drawingAnalysisResult && (
                        <div style={{ display: 'grid', gap: 14 }}>
                          <h5>Board Optimization &amp; Cutting Yields</h5>
                          <p className="optimizer-note">Area-based sheet estimates include a small allowance; use the production nesting view and supplier stock sizes before ordering. Laminate area is listed separately below.</p>
                          <table className="production-table">
                            <thead>
                              <tr>
                                <th>Material Code</th>
                                <th>Thickness</th>
                                <th>Net Area</th>
                                <th>Sheet Size</th>
                                <th>Est. Boards</th>
                                <th>Yield Efficiency</th>
                              </tr>
                            </thead>
                            <tbody>
                              {drawingAnalysisResult.sheetEstimates.map((s) => (
                                <tr key={s.materialCode}>
                                  <td><strong>{s.materialCode}</strong></td>
                                  <td>{s.thicknessMm} mm</td>
                                  <td>{s.totalAreaSqm} m²</td>
                                  <td>{s.sheetWidthMm} × {s.sheetHeightMm} mm</td>
                                  <td className="dim-cell"><strong>{s.estimatedSheets}</strong></td>
                                  <td><Badge variant="success">{s.yieldEfficiencyPercent}%</Badge></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          <section className="laminate-takeoff">
                            <h5>Separate laminate face takeoff</h5>
                            <p>Net face area only; the substrate panel schedule above remains separate. Add supplier-specific waste after confirming decor direction and sheet size.</p>
                            <table className="production-table">
                              <thead><tr><th>Finish code</th><th>Face count</th><th>Net area</th></tr></thead>
                              <tbody>{drawingAnalysisResult.laminateTakeoff.map((finish) => <tr key={finish.finishCode}><td><strong>{finish.finishCode}</strong></td><td>{finish.faceCount}</td><td>{finish.netAreaSqm} m²</td></tr>)}</tbody>
                            </table>
                          </section>

                          {drawingAnalysisResult.auditIssues.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <h5>Joinery &amp; Clearance Audit</h5>
                              <div style={{ display: 'grid', gap: 6 }}>
                                {drawingAnalysisResult.auditIssues.map((issue, idx) => (
                                  <div key={idx} className={`release-item ${issue.severity === 'error' ? 'fail' : 'warning'}`}>
                                    <AlertTriangle size={14} />
                                    <span><strong>{issue.code}:</strong> {issue.message}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      </>
                      )}
                    </div>

                    <div className="drawing-analyzer-footer">
                      <Button variant="ghost" size="sm" onClick={() => setShowDrawingAnalyzer(false)}>
                        Close
                      </Button>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Button
                          variant="secondary" size="sm"
                          icon={<Download size={13} />}
                          disabled={!drawingInput || !drawingAnalysisResult}
                          onClick={() => void downloadCabinetDraftWorkbook()}
                        >
                          Download cabinet Excel
                        </Button>
                        <Button
                          variant="secondary" size="sm"
                          icon={<Download size={13} />}
                          onClick={downloadDrawingSvg}
                        >
                          Download 2D SVG
                        </Button>
                        <Button
                          variant="secondary" size="sm"
                          icon={<Download size={13} />}
                          onClick={downloadDrawingHardwareCsv}
                        >
                          Hardware Schedule CSV
                        </Button>
                        <Button
                          variant="secondary" size="sm"
                          icon={<Download size={13} />}
                          onClick={() => {
                            if (!drawingAnalysisResult) return;
                            const headers = ['Part Instance ID', 'Part Name', 'Semantic Type', 'Length (mm)', 'Width (mm)', 'Thickness (mm)', 'Quantity', 'Substrate Material', 'Face Finishes', 'Grain', 'Edging', 'Notes'];
                            const rows = drawingAnalysisResult.panels.map((p) => [
                              p.partInstanceId, `"${p.partName}"`, p.semanticType, p.lengthMm, p.widthMm, p.thicknessMm, p.quantity, p.materialCode, `"${(p.faceFinishes ?? []).map((finish) => `${finish.face}:${finish.finishCode} ${finish.areaSqm}m2`).join('; ')}"`, p.grainDirection, `"${p.edging}"`, `"${p.notes ?? ''}"`
                            ]);
                            const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
                            const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `ultida-2d-drawing-cutlist-${drawingAnalysisResult.roomId}.csv`;
                            link.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          Panel + laminate-face CSV
                        </Button>
                        <Button
                          variant="primary" size="sm"
                          icon={<Check size={13} />}
                          onClick={applyDrawingAnalysisToCutlist}
                        >
                          Add as review-required draft
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* ══════ HARDWARE TAB ══════ */}
          {activeTab === 'hardware' && (
            <div className="production-hardware">
              <h4>Hardware Schedule</h4>
              <table className="production-table">
                <thead>
                  <tr><th>Name</th><th>Category</th><th>Qty</th><th>Unit</th></tr>
                </thead>
                <tbody>
                  {(cutlist?.hardware ?? []).map((hw, i) => (
                    <tr key={`${hw.name}-${i}`}>
                      <td>{hw.name}</td><td>{hw.category}</td><td>{hw.quantity}</td><td>{hw.unit}</td>
                    </tr>
                  ))}
                  {!cutlist?.hardware.length && (
                    <tr><td colSpan={4} className="inspector-empty">No verified hardware schedule. Approve a scene to load hardware data.</td></tr>
                  )}
                </tbody>
              </table>

              {cncAssets.length > 0 && (
                <>
                  <h4 style={{ marginTop: 20 }}>CNC Assets</h4>
                  <table className="production-table">
                    <thead>
                      <tr><th>Asset ID</th><th>Name</th><th>Layer</th><th>Material</th><th>Dimensions (mm)</th><th>Validation</th></tr>
                    </thead>
                    <tbody>
                      {cncAssets.map((asset) => (
                        <tr key={asset.id}>
                          <td>{asset.id}</td><td>{asset.name}</td><td>{asset.layer}</td><td>{asset.material}</td>
                          <td>{asset.dimensionsMm.width}×{asset.dimensionsMm.height}</td>
                          <td><Badge variant={asset.validationStatus === 'passed' ? 'success' : asset.validationStatus === 'failed' ? 'error' : 'warning'}>{asset.validationStatus}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {cncAssets.length === 0 && (
                <p className="inspector-empty" style={{ marginTop: 16 }}>CNC cutout assets are generated from approved CNC pattern files. None linked to this scene yet.</p>
              )}
            </div>
          )}

          {/* ══════ DRAWINGS TAB ══════ */}
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

          {/* ══════ RELEASE & EXPORT TAB ══════ */}
          {activeTab === 'release' && (
            <div className="production-release-export">

              {/* Status message */}
              <p className="export-status-bar" role="status">{exportState}</p>

              {/* Release checklist */}
              <div className="release-section">
                <h4>Production Release</h4>
                <div className="release-checklist">
                  <div className={`release-item ${sceneApproved ? 'pass' : 'fail'}`}><CheckCircle2 size={15} /> Scene approved</div>
                  <div className={`release-item ${parts.length > 0 ? 'pass' : 'fail'}`}><CheckCircle2 size={15} /> Panel cutlist loaded ({parts.length} parts)</div>
                  <div className={`release-item ${parts.every((p) => p.status === 'approved') && parts.length > 0 ? 'pass' : 'fail'}`}>
                    <CheckCircle2 size={15} /> All parts reviewed ({parts.filter((p) => p.status === 'approved').length}/{parts.length})
                  </div>
                </div>

                {!releaseReady && (
                  <>
                    <label className="production-review-confirmation">
                      <input type="checkbox" checked={reviewConfirmed} onChange={(e) => setReviewConfirmed(e.target.checked)} />
                      <span><strong>I have reviewed every panel.</strong> Finished sizes, board thickness, material, grain and edge schedule match this approved scene.</span>
                    </label>
                    <label className="production-review-notes">
                      Review note
                      <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Optional fabrication or approval note" rows={3} />
                    </label>
                    <div className="release-actions">
                      <Button
                        variant="primary"
                        disabled={!sceneApproved || !parts.length || !reviewConfirmed || reviewSaving}
                        onClick={() => void approveProductionReview()}
                      >
                        {reviewSaving ? 'Saving review…' : 'Approve Reviewed Panels'}
                      </Button>
                    </div>
                  </>
                )}
                {releaseReady && <Badge variant="success" style={{ marginTop: 12, display: 'inline-flex' }}>✓ Production pack approved</Badge>}
              </div>

              {/* Primary exports */}
              <div className="release-section">
                <h4>Export Production Outputs</h4>
                <div className="exports-primary-grid">
                  <Card className="featured-export">
                    <CardHeader>Complete Production Pack (PDF)</CardHeader>
                    <CardContent>
                      <p>Index, wall elevations, carcass sections, fabrication rules, material summary, hardware and panel cutlist — all from this exact scene revision.</p>
                      <Button variant="primary" size="sm"
                        disabled={!sceneApproved || !sceneVersionId || !parts.length}
                        onClick={() => void downloadProductionFile(`/projects/${projectId}/scenes/${sceneVersionId}/production/package.pdf`, `ultida-${sceneVersionId}-production-pack.pdf`, 'GET')}
                      >Download PDF Pack</Button>
                    </CardContent>
                  </Card>

                  <Card className="featured-export">
                    <CardHeader>Cutlist Workbook (Excel)</CardHeader>
                    <CardContent>
                      <p>Panel cutlist, print labels, material summary, edge schedule, hardware, nesting and audit trail — fully formatted for your workshop.</p>
                      <Button variant="primary" size="sm"
                        disabled={!sceneApproved || !sceneVersionId || !parts.length}
                        onClick={() => void downloadProductionFile(`/projects/${projectId}/scenes/${sceneVersionId}/production/cutlist.xlsx`, `ultida-${sceneVersionId}-cutlist.xlsx`, 'GET')}
                      >Download Excel</Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>Cutlist CSV</CardHeader>
                    <CardContent>
                      <p>Millimetre panel dimensions, room, grain and edge schedule. Ready for any CNC or spreadsheet tool.</p>
                      <Button variant="primary" size="sm" onClick={downloadClientCsv} disabled={!sceneApproved || !parts.length}>Download CSV</Button>
                    </CardContent>
                  </Card>

                  <Card className="featured-export">
                    <CardHeader>Turnkey Shop Sheet (SVG)</CardHeader>
                    <CardContent>
                      <p>Full architectural shop sheet: top casework plan, dual elevations, dimension chains, and carcass/laminate schedules.</p>
                      <Button variant="primary" size="sm"
                        disabled={!sceneApproved}
                        onClick={() => void downloadProductionFile('/drawings/elevations.svg', `ultida-${sceneVersionId}-shop-sheet.svg`, 'POST', { options: { viewMode: 'shop-sheet' } })}
                      >Export Shop Sheet SVG</Button>
                    </CardContent>
                  </Card>
                </div>

                {/* More exports toggle */}
                <button className="more-exports-toggle" onClick={() => setShowMoreExports((v) => !v)}>
                  {showMoreExports ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  {showMoreExports ? 'Hide additional exports' : 'Show more exports (DXF, Labels, Nesting, SketchUp…)'}
                </button>

                {showMoreExports && (
                  <div className="exports-secondary-grid">
                    <Card>
                      <CardHeader>DXF Millimetres</CardHeader>
                      <CardContent>
                        <Button variant="primary" size="sm" disabled={!sceneApproved}
                          onClick={() => void downloadProductionFile('/drawings/dxf', `ultida-${sceneVersionId}.dxf`)}
                        >Export DXF</Button>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>System 32 Carcass Section (SVG)</CardHeader>
                      <CardContent>
                        <Button variant="primary" size="sm" disabled={!sceneApproved}
                          onClick={() => void downloadProductionFile('/drawings/elevations.svg', `ultida-${sceneVersionId}-carcass-section.svg`, 'POST', { options: { viewMode: 'internal' } })}
                        >Export Carcass SVG</Button>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>External Elevation (SVG)</CardHeader>
                      <CardContent>
                        <Button variant="primary" size="sm" disabled={!sceneApproved}
                          onClick={() => void downloadProductionFile('/drawings/elevations.svg', `ultida-${sceneVersionId}-external-elevation.svg`, 'POST', { options: { viewMode: 'external' } })}
                        >Export External SVG</Button>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>SketchUp Model (.rb)</CardHeader>
                      <CardContent>
                        <Button variant="primary" size="sm" disabled={!sceneApproved}
                          onClick={() => void downloadProductionFile(`/projects/${projectId}/export/sketchup?sceneVersionId=${encodeURIComponent(sceneVersionId ?? '')}`, `ultida-${projectId}-sketchup.rb`, 'GET')}
                        >Export SketchUp .rb</Button>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>Panel Labels (SVG)</CardHeader>
                      <CardContent>
                        <Button variant="primary" size="sm" disabled={!sceneApproved || !cutlist?.parts.length}
                          onClick={() => void downloadApprovedProductionAsset('labels.svg', `ultida-${sceneVersionId}-panel-labels.svg`)}
                        >Export Labels</Button>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>Nesting Sheet (SVG)</CardHeader>
                      <CardContent>
                        <Button variant="primary" size="sm" disabled={!sceneApproved || !cutlist?.nesting.length}
                          onClick={() => void downloadApprovedProductionAsset('nesting.svg', `ultida-${sceneVersionId}-nesting.svg`)}
                        >Export Nesting</Button>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
