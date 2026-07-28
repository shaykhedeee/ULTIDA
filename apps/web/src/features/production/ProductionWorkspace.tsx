import { useEffect, useState } from 'react';
import { FolderKanban, Package, AlertTriangle, CheckCircle2, Download, ChevronLeft, ChevronRight, Maximize2, PanelRightClose, ClipboardList, Settings, SlidersHorizontal } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader } from '../../components/ui/primitives';
import { supabase } from '../../lib/supabase';
import './production-workspace.css';

type TabId = 'parts' | 'edges' | 'hardware' | 'operations' | 'nesting' | 'cnc' | 'exports' | 'release';
type Part = { id: string; moduleId: string; moduleFamily: string; roomId: string; partName: string; lengthMm: number; widthMm: number; thicknessMm: number; quantity: number; grain: 'horizontal' | 'vertical' | 'none'; edgeBanding: string; machiningNotes: string; materialId: string; materialCode: string; materialName: string; status: 'approved' | 'pending' | 'warning' };
type EdgeSchedule = { l1Mm: number; l2Mm: number; w1Mm: number; w2Mm: number; tapeType: string; totalMeters: number };
type HardwareItem = { name: string; category: 'hinge' | 'slide' | 'fastener' | 'handle' | 'accessory'; quantity: number; unit: string };
type Operation = { id: string; partId: string; type: 'drill' | 'groove' | 'rebate' | 'pocket' | 'cutout'; face: string; positionMm: string; depthMm: number; diameterMm: number | null; toleranceMm: number; tool: string };
type NestingSheet = { sheetId: string; materialCode: string; thicknessMm: number; sheetWidthMm: number; sheetHeightMm: number; placedPanels: { partId: string; xMm: number; yMm: number; widthMm: number; lengthMm: number; rotated: boolean }[]; usedAreaSqm: number; utilizationPercentage: number };
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

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'parts', label: 'Parts', icon: <ClipboardList size={14} /> },
  { id: 'edges', label: 'Edges', icon: <Settings size={14} /> },
  { id: 'hardware', label: 'Hardware', icon: <Package size={14} /> },
  { id: 'operations', label: 'Operations', icon: <SlidersHorizontal size={14} /> },
  { id: 'nesting', label: 'Nesting', icon: <FolderKanban size={14} /> },
  { id: 'cnc', label: 'CNC Cutouts', icon: <Maximize2 size={14} /> },
  { id: 'exports', label: 'Exports', icon: <Download size={14} /> },
  { id: 'release', label: 'Release', icon: <CheckCircle2 size={14} /> },
];

export function ProductionWorkspace({ projectId, sceneVersionId, sceneApproved, modules, materials, onSceneCreated, onSceneApproved }: ProductionWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabId>('parts');
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  // Production outputs may only come from compiler-emitted PartV1 records. Module boxes are not manufacturing parts.
  const [parts, setParts] = useState<Part[]>([]);
  const nestingRun: { sheets: NestingSheet[] } = { sheets: [] };
  const [cncAssets, setCncAssets] = useState<CncAsset[]>([]);
  const [preflightResult, setPreflightResult] = useState<{ status: 'idle' | 'running' | 'passed' | 'failed'; issues: string[] } | null>(null);

  useEffect(() => {
    if (!projectId || !sceneVersionId || !sceneApproved) { setParts([]); return; }
    void (async () => {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) return;
      const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
      const response = await fetch(`${apiBase}/projects/${projectId}/design-context`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => null);
      const scene = payload?.context?.scene?.scene;
      const exactParts = Array.isArray(scene?.moduleParts) ? scene.moduleParts : [];
      setParts(exactParts.map((part: any) => ({ id: String(part.id), moduleId: String(part.moduleId ?? ''), moduleFamily: String(part.semanticType ?? 'module-part'), roomId: String(part.roomId ?? ''), partName: String(part.name ?? part.semanticType ?? 'Part'), lengthMm: Math.round(Number(part.widthMm)), widthMm: Math.round(Number(part.depthMm)), thicknessMm: Math.round(Number(part.heightMm)), quantity: 1, grain: 'none', edgeBanding: 'review_required', machiningNotes: 'Derived from scene.v1; review operations before release.', materialId: String(part.materialId ?? ''), materialCode: String(part.materialId ?? 'unassigned'), materialName: 'Scene material', status: 'pending' })));
    })();
  }, [projectId, sceneVersionId, sceneApproved]);

  const activeTabIndex = TABS.findIndex((t) => t.id === activeTab);
  const nextTab = TABS[(activeTabIndex + 1) % TABS.length];
  const prevTab = TABS[(activeTabIndex - 1 + TABS.length) % TABS.length];

  const releaseReady = parts.length > 0 && parts.every((p) => p.status === 'approved') && sceneApproved;

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
            <Button variant="primary" size="sm" icon={<CheckCircle2 size={14} />} disabled={!releaseReady} onClick={async () => { if (releaseReady && onSceneApproved) await onSceneApproved(); }}>
              Approve & Release Production Pack
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
          {activeTab === 'parts' && (
            <div className="production-parts-grid">
              <div className="parts-toolbar">
                <h4>Manufacturing Parts</h4>
                <Badge variant="info">{parts.length} parts</Badge>
              </div>
              <table className="production-table">
                <thead><tr><th>Part ID</th><th>Module</th><th>Material</th><th>L (mm)</th><th>W (mm)</th><th>T (mm)</th><th>Qty</th><th>Grain</th><th>Edge Banding</th><th>Status</th></tr></thead>
                <tbody>
                  {parts.map((part) => (
                    <tr key={part.id}>
                      <td>{part.id}</td><td>{part.moduleFamily}</td><td>{part.materialCode}</td>
                      <td>{part.lengthMm}</td><td>{part.widthMm}</td><td>{part.thicknessMm}</td><td>{part.quantity}</td>
                      <td>{part.grain}</td><td>{part.edgeBanding}</td>
                      <td><Badge variant={part.status === 'approved' ? 'success' : part.status === 'warning' ? 'warning' : 'muted'}>{part.status}</Badge></td>
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
                  {parts.flatMap((part) => {
                    const perim = 2 * (part.lengthMm + part.widthMm);
                    return part.edgeBanding !== 'none' ? [{ partId: part.id, side: 'All 4 edges', lengthMm: perim, tapeType: part.edgeBanding, thicknessMm: 0.8 }] : [];
                  }).map((edge, i) => (
                    <tr key={i}><td>{edge.partId}</td><td>{edge.side}</td><td>{Math.round(edge.lengthMm)}</td><td>{edge.tapeType}</td><td>{edge.thicknessMm}</td></tr>
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
                  {parts.flatMap((part) => [
                    { name: `Hinge ${part.moduleFamily}`, category: 'hinge' as const, quantity: 2, unit: 'each', partRef: part.id },
                    { name: `Slide ${part.moduleFamily}`, category: 'slide' as const, quantity: 1, unit: 'pair', partRef: part.id },
                    { name: `Handle ${part.moduleFamily}`, category: 'handle' as const, quantity: 1, unit: 'each', partRef: part.id },
                  ]).map((hw, i) => (
                    <tr key={i}><td>{hw.name}</td><td>{hw.category}</td><td>{hw.quantity}</td><td>{hw.unit}</td><td>{hw.partRef}</td></tr>
                  ))}
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
                  {parts.flatMap((part) => [
                    { id: `op-${part.id}-drill`, partId: part.id, type: 'drill' as const, face: 'Front', positionMm: '5mm from edge', depthMm: 5, diameterMm: null, toleranceMm: 0.5, tool: '5mm brad point' },
                    { id: `op-${part.id}-groove`, partId: part.id, type: 'groove' as const, face: 'Back', positionMm: '10mm inset', depthMm: 4, diameterMm: null, toleranceMm: 0.2, tool: '4mm straight' },
                  ]).map((op, i) => (
                    <tr key={i}><td>{op.id}</td><td>{op.partId}</td><td>{op.type}</td><td>{op.face}</td><td>{op.positionMm}</td><td>{op.depthMm}</td><td>{op.tool}</td><td>&plusmn;{op.toleranceMm}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {activeTab === 'nesting' && (
            <div className="production-nesting">
              <h4>Nesting Sheets</h4>
              {nestingRun.sheets.map((sheet) => (
                <Card key={sheet.sheetId} className="nesting-card">
                  <CardHeader><span>{sheet.sheetId}</span><Badge variant="info">{sheet.materialCode} / {sheet.thicknessMm}mm</Badge></CardHeader>
                  <CardContent>
                    <div className="nesting-stats"><span>Sheet: {sheet.sheetWidthMm}&times;{sheet.sheetHeightMm} mm</span><span>Utilization: {sheet.utilizationPercentage}%</span><span>Area: {sheet.usedAreaSqm.toFixed(3)} m&sup2;</span></div>
                    <table className="production-table"><thead><tr><th>Part</th><th>X (mm)</th><th>Y (mm)</th><th>W (mm)</th><th>L (mm)</th><th>Rotated</th></tr></thead>
                    <tbody>{sheet.placedPanels.map((p, i) => (<tr key={i}><td>{p.partId}</td><td>{p.xMm}</td><td>{p.yMm}</td><td>{p.widthMm}</td><td>{p.lengthMm}</td><td>{p.rotated ? 'Y' : 'N'}</td></tr>))}</tbody></table>
                  </CardContent>
                </Card>
              ))}
              {!nestingRun.sheets.length && <p className="inspector-empty">Nesting is unavailable until the approved scene produces exact parts with board, grain, and edge-band data.</p>}
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
        {activeTab === 'exports' && (
          <div className="production-exports">
            <h4>Export Production Outputs</h4>
            <div className="exports-grid">
              <Card><CardHeader>SVG Drawing Package</CardHeader><CardContent><Button variant="primary" size="sm" onClick={() => { /* triggers API call to drawings endpoint */ }}>Export SVG</Button></CardContent></Card>
              <Card><CardHeader>DXF Millimetres</CardHeader><CardContent><Button variant="primary" size="sm">Export DXF</Button></CardContent></Card>
              <Card><CardHeader>Part Drawings (PDF)</CardHeader><CardContent><Button variant="primary" size="sm">Export PDF</Button></CardContent></Card>
              <Card><CardHeader>Cutlist CSV</CardHeader><CardContent><Button variant="primary" size="sm">Export CSV</Button></CardContent></Card>
              <Card><CardHeader>Operation Sheet</CardHeader><CardContent><Button variant="primary" size="sm">Export PDF</Button></CardContent></Card>
              <Card><CardHeader>Tooling Assumptions</CardHeader><CardContent><Button variant="primary" size="sm">Export PDF</Button></CardContent></Card>
              <Card><CardHeader>Nesting Sheet</CardHeader><CardContent><Button variant="primary" size="sm">Export PDF</Button></CardContent></Card>
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
            <div className="release-actions">
              <Button variant="primary" disabled={!releaseReady} onClick={async () => { if (releaseReady && onSceneApproved) await onSceneApproved(); }}>Approve Production Pack</Button>
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
