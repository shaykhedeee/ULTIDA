import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, AlertTriangle, CheckCircle2, Download, ChevronRight, ChevronDown,
  ClipboardList, FileText, ArrowLeft, ArrowRight, Printer, RefreshCw,
  Sliders, Compass, Eye, X, Check, Layers, Sparkles, Filter,
} from 'lucide-react';

import {
  analyze2DDrawingsToCutlist,
  extractDrawingCutlistFromScene,
  type DrawingCutlistAnalysisResult,
  type DrawingCutlistInput,
} from '@ultida/drawing-core/browser';
import { Badge, Button, Card, CardContent, CardHeader, WorkflowDock } from '../../components/ui/primitives';
import { supabase } from '../../lib/supabase';
import { getApiBase } from '../../lib/api-base';
import WorkingDrawingsDossier from '../../components/drawings/WorkingDrawingsDossier';
import './production-workspace.css';


// ─── Types ────────────────────────────────────────────────────────────────────
type TabId = 'cutlist' | 'hardware' | 'drawings' | 'release';
type Part = {
  id: string; partInstanceId: string; moduleId: string; family: string; roomId: string;
  semanticType: string; partName: string; lengthMm: number; widthMm: number; thicknessMm: number;
  quantity: number; grainDirection: 'horizontal' | 'vertical' | 'none'; edging: string;
  edgeSchedule?: { l1Mm: number; l2Mm: number; w1Mm: number; w2Mm: number; tapeType: string };
  materialCode: string; status: 'approved' | 'review_required';
};
type HardwareItem = { name: string; category: 'hinge' | 'slide' | 'fastener' | 'handle' | 'accessory'; quantity: number; unit: string };
type NestingSheet = { sheetId: string; materialCode: string; thicknessMm: number; sheetWidthMm: number; sheetHeightMm: number; placedPanels: { partId: string; xMm: number; yMm: number; widthMm: number; lengthMm: number; rotated: boolean }[]; usedAreaSqm: number; utilizationPercentage: number };
type ProductionCutlist = {
  parts: Part[]; hardware: HardwareItem[]; warnings: string[]; nesting: NestingSheet[];
  edgeBanding: Array<{ tapeType: string; thicknessMm: number; totalMeters: number }>;
  status: 'review_required' | 'approved';
  fabricationRules: { version: string; sheetWidthMm: number; sheetHeightMm: number; kerfMm: number; trimMm: number };
};
type CncAsset = { id: string; name: string; sourceSceneId: string; modulePartId: string; svgUrl: string; dxfUrl: string; dimensionsMm: { width: number; height: number }; material: string; layer: 'CUT' | 'ENGRAVE' | 'POCKET' | 'DRILL' | 'REFERENCE'; validationStatus: 'pending' | 'passed' | 'failed'; preflightIssues: string[] };

interface ProductionWorkspaceProps {
  initialTab?: TabId | 'elevations' | 'parts' | 'release';
  projectId: string;
  sceneVersionId: string | null;
  sceneApproved: boolean;
  modules: Array<{ id: string; roomId: string; family: string; label: string; widthMm: number; depthMm: number; heightMm: number }>;
  materials: Array<{ id: string; code: string; name: string; category: string }>;
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
  const [activeRoomScope, setActiveRoomScope] = useState<string>('all');
  const [showDrawingAnalyzer, setShowDrawingAnalyzer] = useState(false);
  const [drawingAnalysisResult, setDrawingAnalysisResult] = useState<DrawingCutlistAnalysisResult | null>(null);
  const [drawingViewTab, setDrawingViewTab] = useState<'panels' | 'hardware' | 'audit'>('panels');
  const [rawScene, setRawScene] = useState<any>(null);

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
    const headers = ['Part Instance ID', 'Part Name', 'Room', 'Module Family', 'Length (mm)', 'Width (mm)', 'Thickness (mm)', 'Quantity', 'Material Code', 'Grain', 'Edging'];
    const targetParts = scopedParts.length > 0 ? scopedParts : parts;
    const rows = targetParts.map((p) => [
      p.partInstanceId || p.id, `"${p.partName}"`, p.roomId, p.family,
      p.lengthMm, p.widthMm, p.thicknessMm, p.quantity, p.materialCode, p.grainDirection, `"${p.edging}"`,
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

  const sheetEstimates = useMemo(() =>
    estimateSheets(scopedParts, cutlist?.fabricationRules),
    [scopedParts, cutlist]);

  // ─── 2D Drawing Analysis Actions ──────────────────────────────────────────
  function run2DDrawingAnalysis(targetRoom?: string) {
    const targetRoomId = targetRoom || (activeRoomScope !== 'all' ? activeRoomScope : uniqueRooms[0] || 'room-main');
    let input: DrawingCutlistInput;
    if (rawScene) {
      input = extractDrawingCutlistFromScene(rawScene);
    } else {
      const roomMods = modules.filter((m) => !targetRoomId || m.roomId === targetRoomId);
      const primaryMod = roomMods[0] || modules[0];
      const w = primaryMod?.widthMm || 2400;
      const h = primaryMod?.heightMm || 2400;
      const d = primaryMod?.depthMm || 580;
      const bayCount = Math.max(1, Math.round(w / 600));
      const bayW = Math.round(w / bayCount);
      input = {
        unitId: primaryMod?.id || 'unit-001',
        unitTitle: primaryMod?.family ? primaryMod.family.replace(/-/g, ' ').toUpperCase() : 'CASEWORK ELEVATION',
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
          widthMm: i === bayCount - 1 ? w - bayW * (bayCount - 1) : bayW,
          type: i === 0 ? 'drawers' : 'wardrobe-shelves',
          shelvesCount: 1,
          adjustableShelvesCount: 3,
          drawerCount: i === 0 ? 3 : 0,
          hasHangingRod: i !== 0,
          shutterType: bayW > 550 ? 'double-door' : 'single-door',
        })),
        dummyFillerLeftMm: 30,
        dummyFillerRightMm: 30,
      };
    }
    const result = analyze2DDrawingsToCutlist(input);
    setDrawingAnalysisResult(result);
    setShowDrawingAnalyzer(true);
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
      status: 'approved' as const,
    }));
    setParts((prev) => [...prev, ...newParts]);
    setShowDrawingAnalyzer(false);
    setExportState(`Merged ${newParts.length} analyzed panels into the cutlist.`);
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
                </div>
              </div>

              {/* Summary cards */}
              <div className="cutlist-summary-cards">
                <div className="cutlist-stat-card">
                  <span className="stat-label">Total Panels</span>
                  <strong className="stat-value">{scopedParts.reduce((s, p) => s + p.quantity, 0)}</strong>
                  <span className="stat-sub">{scopedParts.length} unique parts {activeRoomScope !== 'all' ? `(${activeRoomScope})` : ''}</span>
                </div>
                <div className="cutlist-stat-card">
                  <span className="stat-label">Sheets Required</span>
                  <strong className="stat-value">{sheetEstimates.reduce((s, e) => s + e.sheets, 0)}</strong>
                  <span className="stat-sub">across {materialCount} board types</span>
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
              </div>

              {/* Toolbar */}
              <div className="parts-toolbar">
                <h4>Panel Cutlist {activeRoomScope !== 'all' ? `— ${activeRoomScope.replace(/-/g, ' ').toUpperCase()}` : ''}</h4>
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
                </div>
              </div>

              {/* Status message if no parts yet */}
              {!parts.length && (
                <p className="inspector-empty">{exportState}</p>
              )}


              {/* Room-grouped table */}
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
                            <span className="sub">all surfaces</span>
                          </div>
                          <div className="analyzer-metric-card">
                            <span className="label">Est. Sheets</span>
                            <span className="value">{drawingAnalysisResult.summary.estimatedSheetsTotal}</span>
                            <span className="sub">2440×1220 mm</span>
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
                    </div>

                    <div className="drawing-analyzer-footer">
                      <Button variant="ghost" size="sm" onClick={() => setShowDrawingAnalyzer(false)}>
                        Close
                      </Button>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button
                          variant="secondary" size="sm"
                          icon={<Download size={13} />}
                          onClick={() => {
                            if (!drawingAnalysisResult) return;
                            const headers = ['Part Instance ID', 'Part Name', 'Semantic Type', 'Length (mm)', 'Width (mm)', 'Thickness (mm)', 'Quantity', 'Material', 'Grain', 'Edging', 'Notes'];
                            const rows = drawingAnalysisResult.panels.map((p) => [
                              p.partInstanceId, `"${p.partName}"`, p.semanticType, p.lengthMm, p.widthMm, p.thicknessMm, p.quantity, p.materialCode, p.grainDirection, `"${p.edging}"`, `"${p.notes ?? ''}"`
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
                          Export 2D Cutlist CSV
                        </Button>
                        <Button
                          variant="primary" size="sm"
                          icon={<Check size={13} />}
                          onClick={applyDrawingAnalysisToCutlist}
                        >
                          Apply to Master Cutlist
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

      {/* ── Workflow dock ── */}
      <WorkflowDock
        currentStageIndex={4}
        totalStages={5}
        stageTitle={activeTab === 'release' ? 'Release & Export' : 'Cutlist & Drawings'}
        stageSummary={activeTab === 'release'
          ? 'Approve reviewed panels · Download production PDF, Excel and exports'
          : 'Panel cutlist by room · Shop drawings · Board optimizer · Hardware schedule'}
        beaconTone={activeTab === 'release' ? 'success' : 'gold'}
        prevAction={{
          label: 'Back to 3D Scene',
          icon: <ArrowLeft size={14} />,
          onClick: () => { if (projectId) navigate(`/projects/${projectId}/3d`); },
        }}
        nextAction={{
          label: 'Proceed to Step 5: Estimate & Delivery',
          icon: <ArrowRight size={14} />,
          onClick: () => { if (projectId) navigate(`/projects/${projectId}/estimate`); },
        }}
      />
    </div>
  );
}
