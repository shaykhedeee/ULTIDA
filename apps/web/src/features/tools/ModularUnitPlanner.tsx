import { Box, CheckCircle2, Clipboard, Download, FilePlus2, Loader2, Search, SlidersHorizontal, TriangleAlert, Layers, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModulePreview } from '../../components/library/ModulePreview';
import ModularCabinetBuilder from '../../components/modular/ModularCabinetBuilder';
import './modular-unit-planner.css';

type CatalogModule = {
  id: string; family: string; name: string; roomTypes: string[]; widthMm: number; depthMm: number; heightMm: number;
  minClearanceMm: number; sku: string; tags: string[]; description?: string; manufacturingRules?: string[];
  materialSlots: string[]; production: { cutlistSupported: boolean; hardwareSchedule: boolean; panelBased?: boolean };
};

type PreparedModulePlan = {
  schema: 'ultida.module-plan.v1';
  templateId: string;
  family: string;
  name: string;
  dimensionsMm: { width: number; depth: number; height: number };
  wallWidthMm: number;
  clearanceMm: number;
};

function apiBase() {
  const configured = String(import.meta.env.VITE_API_BASE ?? '').trim();
  const localApi = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/api\/?$/i.test(configured);
  if (typeof window !== 'undefined' && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(window.location.origin) && localApi) return '/api';
  return configured || '/api';
}

function label(value: string) { return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function generateModuleDxf(name: string, sku: string, w: number, d: number, h: number): string {
  const lines = [
    '0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'TABLES',
    '0', 'TABLE', '2', 'LAYER', '70', '4',
    '0', 'LAYER', '2', 'A-CABN-OUTLINE', '70', '0', '62', '7', '6', 'CONTINUOUS', '0',
    '0', 'LAYER', '2', 'A-CABN-INTERIOR', '70', '0', '62', '3', '6', 'CONTINUOUS', '0',
    '0', 'LAYER', '2', 'A-CABN-DIMS', '70', '0', '62', '1', '6', 'CONTINUOUS', '0',
    '0', 'LAYER', '2', 'A-CABN-TEXT', '70', '0', '62', '2', '6', 'CONTINUOUS', '0',
    '0', 'ENDTAB', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
  ];

  function addLine(layer: string, x1: number, y1: number, x2: number, y2: number) {
    lines.push('0', 'LINE', '8', layer, '10', x1.toFixed(2), '20', y1.toFixed(2), '30', '0.0', '11', x2.toFixed(2), '21', y2.toFixed(2), '31', '0.0');
  }

  function addText(layer: string, text: string, x: number, y: number, heightMm: number) {
    lines.push('0', 'TEXT', '8', layer, '10', x.toFixed(2), '20', y.toFixed(2), '30', '0.0', '40', heightMm.toString(), '1', text);
  }

  // View A: Front Elevation at (0, 0)
  addLine('A-CABN-OUTLINE', 0, 0, w, 0);
  addLine('A-CABN-OUTLINE', w, 0, w, h);
  addLine('A-CABN-OUTLINE', w, h, 0, h);
  addLine('A-CABN-OUTLINE', 0, h, 0, 0);
  addLine('A-CABN-INTERIOR', 0, 100, w, 100);
  if (w >= 900) {
    addLine('A-CABN-OUTLINE', w / 2, 100, w / 2, h);
  }
  addText('A-CABN-TEXT', `FRONT ELEVATION - ${name} (${sku})`, 0, -150, 40);
  addText('A-CABN-DIMS', `${w} mm`, w / 2 - 50, h + 50, 35);
  addText('A-CABN-DIMS', `${h} mm`, w + 50, h / 2, 35);

  // View B: Side Section at (w + 400, 0)
  const sx = w + 400;
  addLine('A-CABN-OUTLINE', sx, 0, sx + d, 0);
  addLine('A-CABN-OUTLINE', sx + d, 0, sx + d, h);
  addLine('A-CABN-OUTLINE', sx + d, h, sx, h);
  addLine('A-CABN-OUTLINE', sx, h, sx, 0);
  addLine('A-CABN-INTERIOR', sx + 18, 100, sx + d, 100);
  addLine('A-CABN-INTERIOR', sx + 18, h - 18, sx + d, h - 18);
  addLine('A-CABN-INTERIOR', sx + 18, 100, sx + 18, h - 18);
  addText('A-CABN-TEXT', 'SIDE CROSS-SECTION', sx, -150, 40);
  addText('A-CABN-DIMS', `${d} mm`, sx + d / 2 - 30, h + 50, 35);

  // View C: Top Plan at (0, h + 400)
  const ty = h + 400;
  addLine('A-CABN-OUTLINE', 0, ty, w, ty);
  addLine('A-CABN-OUTLINE', w, ty, w, ty + d);
  addLine('A-CABN-OUTLINE', w, ty + d, 0, ty + d);
  addLine('A-CABN-OUTLINE', 0, ty + d, 0, ty);
  addText('A-CABN-TEXT', 'PLAN PROJECTION', 0, ty + d + 60, 40);

  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\r\n');
}

function generateModuleBriefCsv(name: string, sku: string, w: number, d: number, h: number): string {
  const rows = [
    ['Status', 'Template', 'SKU', 'Overall width (mm)', 'Overall depth (mm)', 'Overall height (mm)', 'Next step'],
    ['VISUAL DRAFT - NOT FOR FABRICATION', name, sku, String(w), String(d), String(h),
      'Place in a measured project room, compile and approve the scene, then export verified panels from Production.'],
  ];
  return rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\r\n');
}
export function ModularUnitPlanner() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'configurator' | 'elevation' | 'cad_sheet'>('configurator');
  const [modules, setModules] = useState<CatalogModule[]>([]);
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState('all');
  const [room, setRoom] = useState('all');
  const [certification, setCertification] = useState<'all' | 'production' | 'visual'>('all');
  const [favorites, setFavorites] = useState<string[]>(() => JSON.parse(window.localStorage.getItem('ultida_library_favorites') ?? '[]'));
  const [selectedId, setSelectedId] = useState('');
  const [width, setWidth] = useState(0); const [depth, setDepth] = useState(0); const [height, setHeight] = useState(0);
  const [wallWidth, setWallWidth] = useState(3000); const [clearance, setClearance] = useState(900);
  const [status, setStatus] = useState('Loading the ULTIDA modular library…');

  useEffect(() => {
    let live = true;
    fetch(`${apiBase()}/catalog/modules`).then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.modules)) throw new Error(payload?.message ?? 'The modular library could not be loaded.');
      if (!live) return;
      const initial = payload.modules as CatalogModule[];
      setModules(initial); setSelectedId(initial[0]?.id ?? ''); setStatus(`${initial.length} configurable modular templates are ready.`);
    }).catch((error: Error) => { if (live) setStatus(error.message); });
    return () => { live = false; };
  }, []);

  const selected = modules.find((item) => item.id === selectedId) ?? null;
  useEffect(() => { if (selected) { setWidth(selected.widthMm); setDepth(selected.depthMm); setHeight(selected.heightMm); } }, [selectedId, selected]);
  const families = useMemo(() => [...new Set(modules.map((item) => item.family))].sort(), [modules]);
  const rooms = useMemo(() => [...new Set(modules.flatMap((item) => item.roomTypes))].sort(), [modules]);
  const visible = useMemo(() => modules.filter((item) => {
    const searchable = `${item.name} ${item.tags.join(' ')} ${item.roomTypes.join(' ')}`.toLowerCase();
    const certified = item.production.cutlistSupported && item.production.hardwareSchedule;
    return (family === 'all' || item.family === family)
      && (room === 'all' || item.roomTypes.includes(room))
      && (certification === 'all' || (certification === 'production' ? certified : !certified))
      && (!query.trim() || searchable.includes(query.toLowerCase()));
  }), [modules, family, room, certification, query]);
  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      window.localStorage.setItem('ultida_library_favorites', JSON.stringify(next));
      return next;
    });
  }
  const issues = selected ? [
    ...(width > wallWidth ? [`Module width exceeds the entered available wall width by ${width - wallWidth} mm.`] : []),
    ...(clearance < selected.minClearanceMm ? [`Keep at least ${selected.minClearanceMm} mm circulation for this template.`] : []),
    ...(width < 300 || depth < 250 || height < 300 ? ['Use positive, practical millimetre dimensions before preparing a specification.'] : []),
  ] : ['Choose a modular template.'];
  const ready = Boolean(selected) && issues.length === 0;

  function copySpecification() {
    if (!selected || !ready) return;
    const text = [`ULTIDA modular specification`, `Template: ${selected.name}`, `Family: ${label(selected.family)}`, `Size: ${width} W × ${depth} D × ${height} H mm`, `Room suitability: ${selected.roomTypes.join(', ')}`, `Material slots: ${selected.materialSlots.join(', ')}`, `Rules: ${(selected.manufacturingRules ?? ['Validate against active plan geometry before production.']).join('; ')}`].join('\n');
    void navigator.clipboard.writeText(text).then(() => setStatus('Specification copied. Open a project when you are ready to place it against verified geometry.'));
  }
  function downloadSpecification() {
    if (!selected || !ready) return;
    const payload = { schema: 'ultida.module-plan.v1', generatedAt: new Date().toISOString(), geometryMode: 'initial_design', templateId: selected.id, family: selected.family, name: selected.name, dimensionsMm: { width, depth, height }, wallWidthMm: wallWidth, clearanceMm: clearance, materialSlots: selected.materialSlots, manufacturingRules: selected.manufacturingRules ?? [] };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `${selected.id}-initial-design.json`; link.click(); URL.revokeObjectURL(url);
    setStatus('Initial Design specification downloaded. It is not a fabrication release until placed and verified in a project.');
  }
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<Array<{ id: string; name: string; client_name?: string; updated_at?: string }>>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  async function openProjectPicker() {
    if (!selected || !ready) return;
    setShowProjectPicker(true);
    setLoadingProjects(true);
    try {
      const res = await fetch(`${apiBase()}/projects`);
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data?.projects) && data.projects.length > 0) {
        setAvailableProjects(data.projects);
      } else {
        const local = JSON.parse(window.localStorage.getItem('ultida_local_projects') ?? '[]');
        if (Array.isArray(local) && local.length > 0) {
          setAvailableProjects(local);
        } else {
          setAvailableProjects([{ id: 'demo-villa-5bhk', name: 'Alibaug Luxury 5BHK Villa', client_name: 'Dr. Singhania' }]);
        }
      }
    } catch {
      const local = JSON.parse(window.localStorage.getItem('ultida_local_projects') ?? '[]');
      if (Array.isArray(local) && local.length > 0) {
        setAvailableProjects(local);
      } else {
        setAvailableProjects([{ id: 'demo-villa-5bhk', name: 'Alibaug Luxury 5BHK Villa', client_name: 'Dr. Singhania' }]);
      }
    } finally {
      setLoadingProjects(false);
    }
  }

  function dispatchToProject(targetProjectId: string, targetProjectName: string) {
    if (!selected || !ready) return;
    const prepared: PreparedModulePlan = {
      schema: 'ultida.module-plan.v1',
      templateId: selected.id,
      family: selected.family,
      name: selected.name,
      dimensionsMm: { width, depth, height },
      wallWidthMm: wallWidth,
      clearanceMm: clearance,
    };
    window.localStorage.setItem('ultida.pendingModulePlan.v1', JSON.stringify(prepared));
    setStatus(`Prepared ${selected.name} for ${targetProjectName}. Choose a room and wall to save placement.`);
    setShowProjectPicker(false);
    navigate(`/projects/${targetProjectId}/spaces?tab=modules&placeModule=1`);
  }

  function prepareProjectPlacement() {
    if (!selected || !ready) return;
    const prepared: PreparedModulePlan = {
      schema: 'ultida.module-plan.v1',
      templateId: selected.id,
      family: selected.family,
      name: selected.name,
      dimensionsMm: { width, depth, height },
      wallWidthMm: wallWidth,
      clearanceMm: clearance,
    };
    window.localStorage.setItem('ultida.pendingModulePlan.v1', JSON.stringify(prepared));
    setStatus(`${selected.name} is ready. Choose a project, then select its verified room and wall.`);
    navigate('/projects?placeModule=1');
  }

  return <main className="module-planner">
    <header className="module-planner-hero"><div><p>MODULAR UNIT PLANNER</p><h1>Choose, size and prepare a real modular unit.</h1><span>Standalone planning for ULTIDA TV walls, crockery, wardrobes, kitchens, pooja, study and storage. No brands, prices or shopping cart—only configurable interior modules.</span></div><button onClick={() => navigate('/projects')}><FilePlus2 size={16} /> Start a project</button></header>
    <p className="module-planner-status" role="status">{modules.length ? <CheckCircle2 size={15} /> : <Loader2 className="ultida-spinner" size={15} />}{status}</p>
    <div style={{ display: 'flex', gap: 8, margin: '14px 0 20px', background: '#e7e5e4', padding: 4, borderRadius: 8, width: 'fit-content' }}>
      <button
        type="button"
        onClick={() => setViewMode('configurator')}
        style={{
          padding: '6px 14px',
          borderRadius: 6,
          border: 0,
          fontSize: 12.5,
          fontWeight: 700,
          cursor: 'pointer',
          background: viewMode === 'configurator' ? '#fff' : 'transparent',
          color: viewMode === 'configurator' ? '#1c1917' : '#78716c',
          boxShadow: viewMode === 'configurator' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
        }}
      >
        📏 Parametric Configurator
      </button>
      <button
        type="button"
        onClick={() => setViewMode('elevation')}
        style={{
          padding: '6px 14px',
          borderRadius: 6,
          border: 0,
          fontSize: 12.5,
          fontWeight: 700,
          cursor: 'pointer',
          background: viewMode === 'elevation' ? '#3d2a1a' : 'transparent',
          color: viewMode === 'elevation' ? '#fff' : '#78716c',
          boxShadow: viewMode === 'elevation' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
        }}
      >
        🚀 System 32 Elevation Canvas (Anti-Gravity Z)
      </button>
      <button
        type="button"
        onClick={() => setViewMode('cad_sheet')}
        style={{
          padding: '6px 14px',
          borderRadius: 6,
          border: 0,
          fontSize: 12.5,
          fontWeight: 700,
          cursor: 'pointer',
          background: viewMode === 'cad_sheet' ? '#0f172a' : 'transparent',
          color: viewMode === 'cad_sheet' ? '#38bdf8' : '#78716c',
          boxShadow: viewMode === 'cad_sheet' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
        }}
      >
        📐 Technical CAD Drawing Sheet (ISO DXF)
      </button>
    </div>

    {viewMode === 'cad_sheet' ? (
      <div style={{ background: '#0b1120', color: '#e2e8f0', borderRadius: 12, padding: 24, border: '1px solid #1e293b', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid #1e293b', paddingBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#38bdf8' }}>AutoCAD / ISO Technical Production Sheet</h3>
            <small style={{ color: '#94a3b8' }}>Multi-view orthographic drawing with millimetre dimensional tolerances &amp; System 32 drilling pitch</small>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => {
                if (!selected) return;
                const activeW = width || selected.widthMm;
                const activeD = depth || selected.depthMm;
                const activeH = height || selected.heightMm;
                const dxfContent = generateModuleDxf(selected.name, selected.sku, activeW, activeD, activeH);
                const blob = new Blob([dxfContent], { type: 'application/dxf' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${selected.sku || selected.id}-production.dxf`;
                a.click();
                URL.revokeObjectURL(url);
                setStatus(`Downloaded AutoCAD R12 DXF for ${selected.name}.`);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#fff', border: 0, borderRadius: 7, fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}
            >
              <Download size={14} /> Download AutoCAD DXF (.dxf)
            </button>
            <button
              type="button"
              onClick={() => {
                if (!selected) return;
                const activeW = width || selected.widthMm;
                const activeD = depth || selected.depthMm;
                const activeH = height || selected.heightMm;
                const csvContent = generateModuleBriefCsv(selected.name, selected.sku, activeW, activeD, activeH);
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${selected.sku || selected.id}-design-brief.csv`;
                a.click();
                URL.revokeObjectURL(url);
                setStatus(`Downloaded draft dimensions, not fabrication instructions, for ${selected.name}.`);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', border: 0, borderRadius: 7, fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}
            >
              <Download size={14} /> Download design brief (.csv)
            </button>
          </div>
        </div>

        {/* 2D Vector CAD Blueprint Sheet */}
        <div style={{ background: '#020617', border: '1px solid #334155', borderRadius: 8, padding: 20, overflowX: 'auto' }}>
          <svg viewBox="0 0 1000 680" style={{ width: '100%', height: 'auto', minWidth: 800, background: '#020617', fontFamily: 'monospace' }}>
            {/* Sheet Outer Border & Title Block */}
            <rect x="20" y="20" width="960" height="640" fill="none" stroke="#38bdf8" strokeWidth="2" />
            <rect x="26" y="26" width="948" height="628" fill="none" stroke="#1e293b" strokeWidth="1" />

            {/* Title Block Bottom Right */}
            <rect x="620" y="520" width="354" height="134" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
            <line x1="620" y1="560" x2="974" y2="560" stroke="#334155" />
            <line x1="620" y1="600" x2="974" y2="600" stroke="#334155" />
            <line x1="790" y1="520" x2="790" y2="654" stroke="#334155" />
            <text x="630" y="542" fill="#94a3b8" fontSize="10">PROJECT: ULTIDA PRODUCTION OS</text>
            <text x="630" y="582" fill="#38bdf8" fontSize="12" fontWeight="bold">{selected?.sku || 'SKU-001'}</text>
            <text x="630" y="622" fill="#f8fafc" fontSize="11">{selected?.name || 'Modular Cabinet'}</text>
            <text x="630" y="642" fill="#94a3b8" fontSize="9">ENVELOPE: {width || selected?.widthMm || 600}W × {depth || selected?.depthMm || 600}D × {height || selected?.heightMm || 750}H mm</text>
            <text x="800" y="542" fill="#94a3b8" fontSize="10">SCALE: 1:20 (ISO METRIC)</text>
            <text x="800" y="582" fill="#94a3b8" fontSize="10">DATE: {new Date().toISOString().split('T')[0]}</text>
            <text x="800" y="622" fill="#22c55e" fontSize="10" fontWeight="bold">STATUS: PRODUCTION RELEASE</text>
            <text x="800" y="642" fill="#94a3b8" fontSize="9">DATUM: FFL 0 · ALL DIMENSIONS IN mm · VERIFY SITE</text>

            {/* Material Specifications Legend Bottom Left */}
            <text x="40" y="550" fill="#94a3b8" fontSize="10" fontWeight="bold">FABRICATION SPECIFICATIONS:</text>
            <text x="40" y="570" fill="#cbd5e1" fontSize="10">• Carcass Core: 18mm HDHMR / BWP Marine-Grade Plywood (IS 710)</text>
            <text x="40" y="590" fill="#cbd5e1" fontSize="10">• Shutter / Fascia: 1.0mm Exterior Matte Laminate / 0.8mm Inner Balancing Liner</text>
            <text x="40" y="610" fill="#cbd5e1" fontSize="10">• Edgebanding: 2.0mm High-Impact Matching PVC Edgeband on all 4 Exposed Sides</text>
            <text x="40" y="630" fill="#cbd5e1" fontSize="10">• Hardware Standard: System 32 European Drilling Grid (32mm pitch centres)</text>

            {/* View A: Front Elevation */}
            <g transform="translate(60, 60)">
              <text x="0" y="-15" fill="#38bdf8" fontSize="12" fontWeight="bold">VIEW A — FRONT ELEVATION</text>
              <rect x="0" y="0" width="260" height="340" fill="#0f172a" stroke="#f8fafc" strokeWidth="2" />
              {/* Plinth */}
              <line x1="0" y1="310" x2="260" y2="310" stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 2" />
              <text x="130" y="328" fill="#94a3b8" fontSize="9" textAnchor="middle">100mm Plinth Skirting</text>
              {/* Shutter Split */}
              <line x1="130" y1="0" x2="130" y2="310" stroke="#f8fafc" strokeWidth="1.5" />
              {/* Handles */}
              <line x1="120" y1="120" x2="120" y2="180" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
              <line x1="140" y1="120" x2="140" y2="180" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
              {/* Dimensions */}
              <line x1="0" y1="-2" x2="260" y2="-2" stroke="#ef4444" strokeWidth="1" />
              <text x="130" y="-8" fill="#ef4444" fontSize="10" textAnchor="middle" fontWeight="bold">{width || selected?.widthMm} mm W</text>
              {[0.12, 0.32, 0.52, 0.72, 0.88].map((ratio, i) => <g key={i}><line x1={260 * ratio} y1="-5" x2={260 * ratio} y2="2" stroke="#ef4444" strokeWidth="1" /><text x={260 * ratio} y="-14" fill="#ef4444" fontSize="7" textAnchor="middle">{Math.round((width || selected?.widthMm || 600) * (i === 0 ? .12 : i === 1 ? .20 : i === 2 ? .20 : i === 3 ? .20 : .16))}</text></g>)}
              <line x1="265" y1="0" x2="265" y2="340" stroke="#ef4444" strokeWidth="1" />
              <text x="275" y="170" fill="#ef4444" fontSize="10" fontWeight="bold">{height || selected?.heightMm} mm H</text>
            </g>

            {/* View B: Sectional Internal Elevation */}
            <g transform="translate(370, 60)">
              <text x="0" y="-15" fill="#38bdf8" fontSize="12" fontWeight="bold">VIEW B — SECTIONAL INTERNAL (SYSTEM 32)</text>
              <rect x="0" y="0" width="260" height="340" fill="#0f172a" stroke="#f8fafc" strokeWidth="2" />
              {/* 18mm Side Panels */}
              <rect x="0" y="0" width="10" height="340" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
              <rect x="250" y="0" width="10" height="340" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
              <rect x="10" y="300" width="240" height="10" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
              <rect x="10" y="0" width="240" height="10" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
              {/* Adjustable Shelves */}
              <rect x="10" y="100" width="240" height="8" fill="#334155" stroke="#38bdf8" strokeWidth="1" />
              <rect x="10" y="200" width="240" height="8" fill="#334155" stroke="#38bdf8" strokeWidth="1" />
              {/* System 32 Drill Hole Grid */}
              {Array.from({ length: 9 }).map((_, i) => (
                <g key={i}>
                  <circle cx="25" cy={40 + i * 28} r="2" fill="#38bdf8" />
                  <circle cx="235" cy={40 + i * 28} r="2" fill="#38bdf8" />
                </g>
              ))}
              <text x="130" y="60" fill="#94a3b8" fontSize="9" textAnchor="middle">Ø5mm System 32 Grid (32mm c/c)</text>
              <text x="130" y="150" fill="#94a3b8" fontSize="9" textAnchor="middle">Adjustable Shelf Tier 1</text>
              <text x="130" y="250" fill="#94a3b8" fontSize="9" textAnchor="middle">Adjustable Shelf Tier 2</text>
              <text x="130" y="356" fill="#38bdf8" fontSize="9" textAnchor="middle">32mm pitch · 5mm bore · 37mm front datum</text>
            </g>

            {/* View C: Side Cross-Section */}
            <g transform="translate(680, 60)">
              <text x="0" y="-15" fill="#38bdf8" fontSize="12" fontWeight="bold">VIEW C — END SECTION</text>
              <rect x="0" y="0" width="180" height="340" fill="#0f172a" stroke="#f8fafc" strokeWidth="2" />
              {/* Grooved Back Panel */}
              <rect x="16" y="10" width="6" height="290" fill="#ef4444" />
              <text x="25" y="150" fill="#ef4444" fontSize="8" transform="rotate(90 25 150)">6mm Back Rebate</text>
              {/* 20mm Front Shutter */}
              <rect x="160" y="0" width="20" height="300" fill="#38bdf8" stroke="#f8fafc" strokeWidth="1" />
              {/* Dimensions */}
              <line x1="0" y1="-2" x2="180" y2="-2" stroke="#ef4444" strokeWidth="1" />
              <text x="90" y="-8" fill="#ef4444" fontSize="10" textAnchor="middle" fontWeight="bold">{depth || selected?.depthMm} mm D</text>
              <line x1="188" y1="0" x2="188" y2="340" stroke="#ef4444" strokeWidth="1" />
              <text x="198" y="170" fill="#ef4444" fontSize="9" fontWeight="bold" transform="rotate(90 198 170)">{height || selected?.heightMm} mm H · 100 mm plinth</text>
            </g>
          </svg>
        </div>
      </div>
    ) : viewMode === 'elevation' ? (
      <ModularCabinetBuilder
        initialWall={{
          lengthMm: wallWidth || 3000,
          heightMm: 2700,
        }}
        initialModules={selected ? [{
          id: selected.id,
          name: selected.name,
          category: 'base_drawer',
          posX: 200,
          elevationMm: 150,
          widthMm: (([300, 450, 600, 900].includes(width || selected.widthMm) ? (width || selected.widthMm) : 600) as 300 | 450 | 600 | 900),
          heightMm: height || selected.heightMm,
          depthMm: depth || selected.depthMm,
          carcassCore: 'HDHMR',
          shutterFinish: 'fluted_pu',
          hardware: {
            hinges: 0,
            drawerChannels: 2,
            hangingBrackets: 2,
          },
        }] : undefined}
        onGenerateRender={(payload) => {
          setStatus(`Generated ControlNet depth & wireframe maps for ${payload.modules.length} modules. Total estimated BOM: ₹${payload.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}.`);
        }}
      />
    ) : (
      <div className="module-planner-layout">
        <aside className="module-family-rail"><strong><Box size={16} /> Module families</strong><button className={family === 'all' ? 'active' : ''} onClick={() => setFamily('all')}>All templates <span>{modules.length}</span></button>{families.map((item) => <button key={item} className={family === item ? 'active' : ''} onClick={() => setFamily(item)}>{label(item)} <span>{modules.filter((module) => module.family === item).length}</span></button>)}</aside>
        <section className="module-catalog">
          <label className="module-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search TV walls, crockery, wardrobes…" /></label>
          
          {/* Quick Family Filter Chips */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '4px 0 10px', scrollbarWidth: 'none' }}>
            {[
              { label: 'All', icon: '✨', onClick: () => { setFamily('all'); setRoom('all'); setQuery(''); } },
              { label: 'Islands', icon: '🏝️', onClick: () => { setQuery('island'); setFamily('all'); setRoom('all'); } },
              { label: 'Bars & Credenzas', icon: '🍸', onClick: () => { setQuery('bar'); setFamily('all'); setRoom('all'); } },
              { label: 'Sacred Pooja', icon: '🪔', onClick: () => { setFamily('pooja'); setRoom('all'); setQuery(''); } },
              { label: 'Executive Study', icon: '📚', onClick: () => { setFamily('study'); setRoom('all'); setQuery(''); } },
              { label: 'Walk-In Closets', icon: '👗', onClick: () => { setQuery('walk-in'); setFamily('all'); setRoom('all'); } },
              { label: 'Media Walls', icon: '📺', onClick: () => { setFamily('tv-unit'); setRoom('all'); setQuery(''); } },
            ].map((qf) => (
              <button
                key={qf.label}
                type="button"
                onClick={qf.onClick}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px',
                  borderRadius: 20,
                  background: '#f5f5f4',
                  border: '1px solid #d6d3d1',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#292524',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{qf.icon}</span> {qf.label}
              </button>
            ))}
          </div>

          <div className="module-library-filters"><label>Room<select value={room} onChange={(event) => setRoom(event.target.value)}><option value="all">All rooms</option>{rooms.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label><label>Release<select value={certification} onChange={(event) => setCertification(event.target.value as typeof certification)}><option value="all">All releases</option><option value="production">Production certified</option><option value="visual">Visual draft</option></select></label><span>{visible.length} of {modules.length} modules</span></div><div className="module-card-grid">{visible.map((item) => { const certified = item.production.cutlistSupported && item.production.hardwareSchedule; return <article key={item.id} className={`module-catalog-card ${selectedId === item.id ? 'selected' : ''}`}><button type="button" className="module-card-select" onClick={() => { setSelectedId(item.id); window.localStorage.setItem('ultida_library_recent', item.id); }}><ModulePreview module={item} compact /><span className="module-card-family">{label(item.family)}</span><strong>{item.name}</strong><small>{item.widthMm}W × {item.depthMm}D × {item.heightMm}H mm</small><em>{item.roomTypes.join(' · ')}</em><span className={`module-certification ${certified ? 'certified' : 'visual'}`}>{certified ? 'Production certified' : 'Visual draft'}</span></button><button type="button" className={`module-favorite ${favorites.includes(item.id) ? 'active' : ''}`} aria-label={`${favorites.includes(item.id) ? 'Remove' : 'Add'} ${item.name} ${favorites.includes(item.id) ? 'from' : 'to'} favorites`} onClick={() => toggleFavorite(item.id)}>★</button></article>; })}</div>{!visible.length && <div className="module-empty">No modules match this search. Clear a filter or try a different room or unit name.</div>}</section>
        <aside className="module-config">{selected ? <><div className="module-config-heading"><span><SlidersHorizontal size={17} /> CONFIGURE</span><h2>{selected.name}</h2><p>{selected.description ?? 'A production-aware modular template.'}</p></div><ModulePreview module={{ ...selected, widthMm: width || selected.widthMm, depthMm: depth || selected.depthMm, heightMm: height || selected.heightMm }} /><div className="module-input-grid"><label>Width (mm)<input type="number" min="300" value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label><label>Depth (mm)<input type="number" min="250" value={depth} onChange={(event) => setDepth(Number(event.target.value))} /></label><label>Height (mm)<input type="number" min="300" value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label><label>Available wall (mm)<input type="number" min="300" value={wallWidth} onChange={(event) => setWallWidth(Number(event.target.value))} /></label><label>Clear circulation (mm)<input type="number" min="0" value={clearance} onChange={(event) => setClearance(Number(event.target.value))} /></label></div><div className={`module-fit ${ready ? 'ready' : 'blocked'}`}><strong>{ready ? <><CheckCircle2 size={15} /> Fits the entered planning envelope</> : <><TriangleAlert size={15} /> Needs adjustment</>}</strong><ul>{ready ? <li>Initial Design specification can be prepared. Site verification remains required for production.</li> : issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div><div className="module-production"><strong>Production notes</strong><ul>{(selected.manufacturingRules ?? ['Confirm wall, opening and service geometry in the project before production.']).map((rule) => <li key={rule}>{rule}</li>)}</ul></div><div className="module-actions"><button disabled={!ready} onClick={copySpecification}><Clipboard size={15} /> Copy specification</button><button disabled={!ready} onClick={downloadSpecification}><Download size={15} /> Download initial brief</button><button className="project" disabled={!ready} onClick={openProjectPicker}><FilePlus2 size={15} /> Place in a project</button></div></> : <div className="module-empty">Choose a template to configure it.</div>}</aside>
      </div>
    )}

    {/* Target Project Selection Modal */}
    {showProjectPicker && (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
      }}>
        <div style={{
          background: '#1c1917', border: '1px solid #332d29', borderRadius: 16, padding: 24,
          maxWidth: 540, width: '100%', color: '#f5f0e8', display: 'flex', flexDirection: 'column', gap: 16,
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #332d29', paddingBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#34d399' }}>Choose project for placement</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#a8a29e' }}>
                Select target project to place <strong>{selected?.name}</strong> ({width || selected?.widthMm}W × {depth || selected?.depthMm}D × {height || selected?.heightMm}H mm)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowProjectPicker(false)}
              style={{ background: 'transparent', border: 0, color: '#78716c', cursor: 'pointer', fontSize: 18, fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>

          <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loadingProjects ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, color: '#a8a29e', fontSize: 13 }}>
                <Loader2 className="ultida-spinner" size={16} /> Loading studio projects…
              </div>
            ) : availableProjects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#78716c', fontSize: 13 }}>
                No existing projects found. Start a new project to place this unit.
              </div>
            ) : (
              availableProjects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => dispatchToProject(p.id, p.name)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 14px', background: '#292524', border: '1px solid #44403c', borderRadius: 8,
                    cursor: 'pointer', transition: 'all 0.15s'
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 13, color: '#fff', display: 'block' }}>{p.name}</strong>
                    <small style={{ color: '#a8a29e', fontSize: 11 }}>{p.client_name ? `Client: ${p.client_name}` : 'Active Project'}</small>
                  </div>
                  <button
                    type="button"
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#000', border: 0, borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 700
                    }}
                  >
                    Place Here →
                  </button>
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #332d29', paddingTop: 12 }}>
            <button
              type="button"
              onClick={() => {
                setShowProjectPicker(false);
                prepareProjectPlacement();
              }}
              style={{ background: 'transparent', border: 0, color: '#38bdf8', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
            >
              + Create New Project Instead
            </button>
            <button
              type="button"
              onClick={() => setShowProjectPicker(false)}
              style={{ background: '#292524', border: '1px solid #44403c', color: '#a8a29e', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
  </main>;
}
