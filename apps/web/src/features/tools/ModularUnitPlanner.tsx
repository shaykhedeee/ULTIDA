import { Box, CheckCircle2, Clipboard, Download, FilePlus2, Loader2, Search, SlidersHorizontal, TriangleAlert, Layers, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModulePreview } from '../../components/library/ModulePreview';
import ModularCabinetBuilder from '../../components/modular/ModularCabinetBuilder';
import './modular-unit-planner.css';

type CatalogModule = {
  id: string; family: string; name: string; roomTypes: string[]; widthMm: number; depthMm: number; heightMm: number;
  minClearanceMm: number; sku: string; tags: string[]; description?: string; manufacturingRules?: string[];
  materialSlots: string[]; production: { cutlistSupported: boolean; hardwareSchedule: boolean };
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

export function ModularUnitPlanner() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'configurator' | 'elevation'>('configurator');
  const [modules, setModules] = useState<CatalogModule[]>([]);
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState('all');
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
  const visible = useMemo(() => modules.filter((item) => (family === 'all' || item.family === family) && (!query.trim() || `${item.name} ${item.tags.join(' ')} ${item.roomTypes.join(' ')}`.toLowerCase().includes(query.toLowerCase()))), [modules, family, query]);
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
    </div>

    {viewMode === 'elevation' ? (
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
          setStatus(`Generated ControlNet depth & wireframe maps for ${payload.modules.length} modules. Total estimated BOM: $${payload.totalCost.toFixed(2)}.`);
        }}
      />
    ) : (
      <div className="module-planner-layout">
        <aside className="module-family-rail"><strong><Box size={16} /> Module families</strong><button className={family === 'all' ? 'active' : ''} onClick={() => setFamily('all')}>All templates <span>{modules.length}</span></button>{families.map((item) => <button key={item} className={family === item ? 'active' : ''} onClick={() => setFamily(item)}>{label(item)} <span>{modules.filter((module) => module.family === item).length}</span></button>)}</aside>
        <section className="module-catalog"><label className="module-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search TV walls, crockery, wardrobes…" /></label><div className="module-card-grid">{visible.map((item) => <button key={item.id} className={`module-catalog-card ${selectedId === item.id ? 'selected' : ''}`} onClick={() => setSelectedId(item.id)}><ModulePreview module={item} compact /><span className="module-card-family">{label(item.family)}</span><strong>{item.name}</strong><small>{item.widthMm}W × {item.depthMm}D × {item.heightMm}H mm</small><em>{item.roomTypes.join(' · ')}</em></button>)}</div>{!visible.length && <div className="module-empty">No modules match this search. Clear a filter or try a different room or unit name.</div>}</section>
        <aside className="module-config">{selected ? <><div className="module-config-heading"><span><SlidersHorizontal size={17} /> CONFIGURE</span><h2>{selected.name}</h2><p>{selected.description ?? 'A production-aware modular template.'}</p></div><ModulePreview module={{ ...selected, widthMm: width || selected.widthMm, depthMm: depth || selected.depthMm, heightMm: height || selected.heightMm }} /><div className="module-input-grid"><label>Width (mm)<input type="number" min="300" value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label><label>Depth (mm)<input type="number" min="250" value={depth} onChange={(event) => setDepth(Number(event.target.value))} /></label><label>Height (mm)<input type="number" min="300" value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label><label>Available wall (mm)<input type="number" min="300" value={wallWidth} onChange={(event) => setWallWidth(Number(event.target.value))} /></label><label>Clear circulation (mm)<input type="number" min="0" value={clearance} onChange={(event) => setClearance(Number(event.target.value))} /></label></div><div className={`module-fit ${ready ? 'ready' : 'blocked'}`}><strong>{ready ? <><CheckCircle2 size={15} /> Fits the entered planning envelope</> : <><TriangleAlert size={15} /> Needs adjustment</>}</strong><ul>{ready ? <li>Initial Design specification can be prepared. Site verification remains required for production.</li> : issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div><div className="module-production"><strong>Production notes</strong><ul>{(selected.manufacturingRules ?? ['Confirm wall, opening and service geometry in the project before production.']).map((rule) => <li key={rule}>{rule}</li>)}</ul></div><div className="module-actions"><button disabled={!ready} onClick={copySpecification}><Clipboard size={15} /> Copy specification</button><button disabled={!ready} onClick={downloadSpecification}><Download size={15} /> Download initial brief</button><button className="project" disabled={!ready} onClick={prepareProjectPlacement}><FilePlus2 size={15} /> Place in a project</button></div></> : <div className="module-empty">Choose a template to configure it.</div>}</aside>
      </div>
    )}
  </main>;
}
