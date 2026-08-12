import { useEffect, useState } from 'react';
import { FolderKanban, Package, AlertTriangle, CheckCircle2, Download, ChevronLeft, ChevronRight, Maximize2, PanelRightClose, ClipboardList, Settings, SlidersHorizontal } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader } from '../../components/ui/primitives';
import { supabase } from '../../lib/supabase';
import './production-workspace.css';

type TabId = 'parts' | 'edges' | 'hardware' | 'operations' | 'nesting' | 'cnc' | 'exports' | 'release';
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
  const [cutlist, setCutlist] = useState<ProductionCutlist | null>(null);
  const [cncAssets, setCncAssets] = useState<CncAsset[]>([]);
  const [preflightResult, setPreflightResult] = useState<{ status: 'idle' | 'running' | 'passed' | 'failed'; issues: string[] } | null>(null);
  const [exportState, setExportState] = useState('Choose an approved scene export.');

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
    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
    const response = await fetch(`${apiBase}/projects/${projectId}/scenes/${sceneVersionId}`, { headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success || payload?.sceneVersion?.status !== 'approved' || !payload?.sceneVersion?.scene) {
      setExportState(payload?.message ?? 'This exact scene is not approved or could not be read.');
      return null;
    }
    return { apiBase, token, scene: payload.sceneVersion.scene };
  }

  async function downloadProductionFile(path: string, filename: string) {
    setExportState('Preparing exact scene output...');
    try {
      const source = await readApprovedScene();
      if (!source || !sceneVersionId) return;
      const response = await fetch(`${source.apiBase}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${source.token}` },
        body: JSON.stringify({ projectId, sceneVersionId, scene: source.scene })
      });
      if (!response.ok) {
        setExportState('The export service rejected this scene. No substitute file was created.');
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
      const apiBase = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const response = await fetch(`${apiBase}/api/projects/${projectId}/scenes/${sceneVersionId}/production/${asset}`, { headers: { Authorization: `Bearer ${token}` } });
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
    if (!projectId || !sceneVersionId || !sceneApproved) { setParts([]); return; }
    void (async () => {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) return;
      const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
      const response = await fetch(`${apiBase}/projects/${projectId}/scenes/${sceneVersionId}/production-snapshot`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => null);
      const authoritative = response.ok && payload?.success ? payload.cutlist as ProductionCutlist : null;
      setCutlist(authoritative);
      setParts(authoritative?.parts ?? []);
      setExportState(authoritative ? 'Production snapshot loaded from the approved scene.' : (payload?.message ?? 'The approved scene could not produce a manufacturing snapshot.'));
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
        {activeTab === 'exports' && (
          <div className="production-exports">
            <h4>Export Production Outputs</h4>
            <p className="inspector-empty" role="status">{exportState}</p>
            <div className="exports-grid">
              <Card><CardHeader>SVG Drawing Package</CardHeader><CardContent><Button variant="primary" size="sm" disabled={!sceneApproved} title="SVG export endpoint not yet available" onClick={() => void downloadProductionFile('/drawings/elevations.svg', `ultida-${sceneVersionId}-elevations.svg`)}>Export SVG</Button></CardContent></Card>
              <Card><CardHeader>DXF Millimetres</CardHeader><CardContent><Button variant="primary" size="sm" disabled={!sceneApproved} title="DXF export endpoint not yet available" onClick={() => void downloadProductionFile('/drawings/dxf', `ultida-${sceneVersionId}.dxf`)}>Export DXF</Button></CardContent></Card>
              <Card><CardHeader>SketchUp Model (.rb Script)</CardHeader><CardContent><Button variant="primary" size="sm" disabled={!sceneApproved} onClick={() => void downloadProductionFile(`/export/sketchup`, `ultida-${projectId}-sketchup.rb`)}>Export SketchUp .rb</Button></CardContent></Card>
              <Card><CardHeader>Part Drawings (PDF)</CardHeader><CardContent><Button variant="primary" size="sm" disabled={!sceneApproved} title="PDF export endpoint not yet available" onClick={() => void downloadProductionFile('/drawings/elevations.pdf', `ultida-${sceneVersionId}-elevations.pdf`)}>Export PDF</Button></CardContent></Card>
              <Card><CardHeader>Cutlist CSV</CardHeader><CardContent><Button variant="primary" size="sm" disabled={!sceneApproved} onClick={() => void downloadProductionFile('/production/cutlist.csv', `ultida-${sceneVersionId}-cutlist.csv`)}>Export CSV</Button></CardContent></Card>
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
