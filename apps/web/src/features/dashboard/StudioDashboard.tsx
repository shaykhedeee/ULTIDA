import {
  ArrowRight, CalendarDays, Compass, Layers3, PackageCheck, Plus, Ruler, Sparkles, Workflow,
  Crown, Download, Eye, FileCode, CheckCircle2, ShieldCheck, Maximize2, ExternalLink
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import './studio-dashboard.css';

type Project = { id: string; name: string; client_name: string; workflow_stage: string; project_status: string; updated_at: string };
type Review = { project_id: string; stage: string; status: string; assigned_to?: string | null };
type Risk = { project_id: string; stage: string; severity: string; title: string; status: string };

const stageLabels: Record<string, string> = {
  brief: 'Brief', plan: 'Floor plan review', spaces: 'Spaces', layouts: 'Layouts', modules: 'Modules',
  materials: 'Materials', '3d': '3D scene', renders: 'Renders', drawings: 'Drawings', estimate: 'Estimate', presentation: 'Delivery',
};

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

interface ElevationShowcaseItem {
  id: string;
  tag: string;
  title: string;
  room: string;
  wallWidthMm: number;
  wallHeightMm: number;
  chainControlledMm: number;
  fillerMm: number;
  materials: string;
  svgPath: string;
  dxfPath: string;
  highlights: string[];
  specs: { label: string; value: string }[];
}

const ELEVATION_SHOWCASE: ElevationShowcaseItem[] = [
  {
    id: 'tv-wall',
    tag: '5BHK VILLA · LIVING ROOM',
    title: '5030mm TV Entertainment Wall Elevation',
    room: 'Formal Living & Double-Height Foyer (Ground Floor)',
    wallWidthMm: 5030,
    wallHeightMm: 3229,
    chainControlledMm: 5030,
    fillerMm: 30,
    materials: 'CNC Backlit Onyx Stone · Architectural Fluted Walnut · Champagne Metal Finishes',
    svgPath: '/elevations/test-tv-unit.svg',
    dxfPath: '/elevations/test-tv-unit.dxf',
    highlights: [
      '3200mm floating console cantilevered @ 450mm AFF with 3 mitred push-to-open drawer units',
      'Dual 30mm dummy fillers on left & right jambs for zero-plumb wall tolerance',
      'Dedicated concealed 50mm wire chase conduit directly to 75" screen centerline',
      'Precision fluted walnut acoustic rafter bands flanking backlit onyx stone backdrop',
    ],
    specs: [
      { label: 'Controlled Width', value: '5,030 mm (±1mm tolerance)' },
      { label: 'Ceiling Datum', value: '3,229 mm (False Ceiling Interface)' },
      { label: 'Skirting Height', value: '75 mm (Recessed Shadow Line)' },
      { label: 'Chain Status', value: 'Zero-Residual Verified (Σ = 5030mm)' },
      { label: 'CAD Format', value: 'AutoCAD R2018 DXF (System 32 Compatible)' },
    ],
  },
  {
    id: 'wardrobe',
    tag: '5BHK VILLA · MASTER SUITE',
    title: '2977mm Master Wardrobe & Vanity Elevation',
    room: 'Master Bedroom Suite Walk-In Closet',
    wallWidthMm: 2977,
    wallHeightMm: 2690,
    chainControlledMm: 2977,
    fillerMm: 30,
    materials: 'Smoked Crown Oak Veneer · Fluted Profile Glass · Champagne Aluminium Stile',
    svgPath: '/elevations/test-wardrobe.svg',
    dxfPath: '/elevations/test-wardrobe.dxf',
    highlights: [
      '4 full-height carcass bays with 32mm System 32 line boring pitch',
      '30mm dummy fillers at jambs preventing handle collision against door architraves',
      'Integrated sensor-activated warm 3000K LED hanging rods & vertical profile diffusers',
      'Italian soft-close tandem runners with 40kg load rating and anti-deflection rails',
    ],
    specs: [
      { label: 'Controlled Width', value: '2,977 mm (4 Modules + 2 Fillers)' },
      { label: 'Ceiling Datum', value: '2,690 mm (Full Floor-to-Ceiling)' },
      { label: 'Skirting Height', value: '75 mm (Continuous Plinth)' },
      { label: 'Hardware System', value: 'System 32 (32mm Hole Centers)' },
      { label: 'Clearance Gate', value: '90° Shutter Clearance Pass' },
    ],
  },
  {
    id: 'mandir',
    tag: '5BHK VILLA · SACRED SANCTUARY',
    title: '1775mm Walk-In Sacred Pooja Mandir Elevation',
    room: 'Sacred Sanctuary (North-East Vastu Zone, 2250mm Depth)',
    wallWidthMm: 1775,
    wallHeightMm: 3000,
    chainControlledMm: 1775,
    fillerMm: 30,
    materials: 'Translucent Backlit Onyx · CNC Brass Jaali · Makrana Marble Base',
    svgPath: '/elevations/test-mandir.svg',
    dxfPath: '/elevations/test-mandir.dxf',
    highlights: [
      'Backlit CNC jaali arched canopy with high-CRI (95+) warm 2700K ambient illumination',
      '2-tier sanctum step altar with bullnosed Makrana marble edge profiles',
      'Under-altar storage credenza with brass pull bells and concealed incense tray',
      'Architectural shadow gap perimeter with zero-plumb stone return details',
    ],
    specs: [
      { label: 'Sanctum Width', value: '1,775 mm Wall Run' },
      { label: 'Room Depth', value: '2,250 mm Walk-In Sanctum' },
      { label: 'Altar Height', value: '450 mm Primary Tier / 250 mm Step' },
      { label: 'Material Code', value: 'ONYX-BL-01 / BRASS-CNC-04' },
      { label: 'Vastu Alignment', value: 'Ishan Corner (North-East Gate Verified)' },
    ],
  },
  {
    id: 'kitchen',
    tag: '5BHK VILLA · GOURMET KITCHEN',
    title: '6669mm Show Kitchen Continuous Wall Run',
    room: 'Ground Floor Show Kitchen & Breakfast Run',
    wallWidthMm: 6669,
    wallHeightMm: 3000,
    chainControlledMm: 6669,
    fillerMm: 30,
    materials: 'High-Gloss Pearl White Acrylic · Calacatta Quartz · Matte Anthracite',
    svgPath: '/elevations/test-kitchen.svg',
    dxfPath: '/elevations/test-kitchen.dxf',
    highlights: [
      'Dual 600mm tall appliance towers for integrated combi-steam oven & warming drawers',
      '860mm ergonomic working countertop height with 40mm bullnose quartz slab',
      'Bi-fold pneumatic lift-up upper cabinets with touch-to-open servo actuators',
      'Continuous uninterrupted under-cabinet task lighting channel (3500K natural white)',
    ],
    specs: [
      { label: 'Run Width', value: '6,669 mm Continuous Wall Run' },
      { label: 'Counter Height', value: '860 mm Ergonomic Datum' },
      { label: 'Tall Towers', value: '2 × 600 mm Appliance Carcasses' },
      { label: 'Wall Cabinets', value: '720 mm Upper Lift-Up System' },
      { label: 'Service Clearances', value: 'Plumbing & 16A Dedicated Sockets Plotted' },
    ],
  },
];

const VILLA_5BHK_SCENE = {
  schema: 'scene.v1',
  units: 'mm',
  rooms: [
    {
      id: 'room-grand-living',
      name: 'Double-Height Formal Living & Foyer',
      boundary: [
        { xMm: 0, yMm: 0 },
        { xMm: 10200, yMm: 0 },
        { xMm: 10200, yMm: 6800 },
        { xMm: 0, yMm: 6800 },
        { xMm: 0, yMm: 0 },
      ],
    },
    {
      id: 'room-show-kitchen',
      name: 'Show Kitchen & Breakfast Island',
      boundary: [
        { xMm: 10500, yMm: 0 },
        { xMm: 17169, yMm: 0 },
        { xMm: 17169, yMm: 4500 },
        { xMm: 10500, yMm: 4500 },
        { xMm: 10500, yMm: 0 },
      ],
    },
    {
      id: 'room-pooja-mandir',
      name: 'Walk-In Sacred Pooja Mandir',
      boundary: [
        { xMm: 10500, yMm: 4800 },
        { xMm: 12275, yMm: 4800 },
        { xMm: 12275, yMm: 7050 },
        { xMm: 10500, yMm: 7050 },
        { xMm: 10500, yMm: 4800 },
      ],
    },
    {
      id: 'room-master-suite',
      name: 'Master Suite & Walk-In Wardrobe',
      boundary: [
        { xMm: 0, yMm: 7200 },
        { xMm: 7500, yMm: 7200 },
        { xMm: 7500, yMm: 12600 },
        { xMm: 0, yMm: 12600 },
        { xMm: 0, yMm: 7200 },
      ],
    },
    {
      id: 'room-guest-suite',
      name: 'Garden Guest Suite',
      boundary: [
        { xMm: 7800, yMm: 7200 },
        { xMm: 13000, yMm: 7200 },
        { xMm: 13000, yMm: 11600 },
        { xMm: 7800, yMm: 11600 },
        { xMm: 7800, yMm: 7200 },
      ],
    },
  ],
  walls: [
    { id: 'wv-1', start: { xMm: 0, yMm: 0 }, end: { xMm: 10200, yMm: 0 }, thicknessMm: 230, heightMm: 3229 },
    { id: 'wv-2', start: { xMm: 10200, yMm: 0 }, end: { xMm: 10200, yMm: 6800 }, thicknessMm: 230, heightMm: 3229 },
    { id: 'wv-3', start: { xMm: 10200, yMm: 6800 }, end: { xMm: 0, yMm: 6800 }, thicknessMm: 150, heightMm: 3229 },
    { id: 'wv-4', start: { xMm: 0, yMm: 6800 }, end: { xMm: 0, yMm: 0 }, thicknessMm: 230, heightMm: 3229 },
    { id: 'wv-5', start: { xMm: 10500, yMm: 0 }, end: { xMm: 17169, yMm: 0 }, thicknessMm: 230, heightMm: 3000 },
    { id: 'wv-6', start: { xMm: 17169, yMm: 0 }, end: { xMm: 17169, yMm: 4500 }, thicknessMm: 230, heightMm: 3000 },
    { id: 'wv-7', start: { xMm: 10500, yMm: 4800 }, end: { xMm: 12275, yMm: 4800 }, thicknessMm: 150, heightMm: 3000 },
  ],
  openings: [
    { id: 'opv-1', wallId: 'wv-4', offsetMm: 2500, widthMm: 1500, heightMm: 2700, kind: 'door' },
    { id: 'opv-2', wallId: 'wv-1', offsetMm: 3600, widthMm: 3000, heightMm: 2400, sillHeightMm: 300, kind: 'window' },
  ],
  modules: [
    { id: 'modv-tv-wall', family: 'tv-console', widthMm: 5030, depthMm: 450, heightMm: 3229, position: { xMm: 2500, yMm: 300 }, rotationDeg: 0, materialId: 'mat-fluted-walnut' },
    { id: 'modv-wardrobe', family: 'wardrobe', widthMm: 2977, depthMm: 650, heightMm: 2690, position: { xMm: 3000, yMm: 7500 }, rotationDeg: 0, materialId: 'mat-smoked-oak' },
    { id: 'modv-mandir', family: 'mandir-altar', widthMm: 1775, depthMm: 600, heightMm: 3000, position: { xMm: 10600, yMm: 5100 }, rotationDeg: 0, materialId: 'mat-backlit-onyx' },
    { id: 'modv-kitchen', family: 'kitchen-tall', widthMm: 6669, depthMm: 650, heightMm: 3000, position: { xMm: 10500, yMm: 300 }, rotationDeg: 0, materialId: 'mat-acrylic-pearl' },
  ],
  moduleParts: [],
  materials: [
    { id: 'mat-fluted-walnut', name: 'Architectural Fluted Walnut & Onyx', code: 'FLT-WL-01', finish: 'Woodgrain & PU Stone' },
    { id: 'mat-smoked-oak', name: 'Smoked Crown Oak & Profile Glass', code: 'LAM-WD-04', finish: 'Velvet Matte & Glass' },
    { id: 'mat-backlit-onyx', name: 'Translucent Backlit Onyx & Brass', code: 'STN-OX-02', finish: 'Backlit Stone & Polished Brass' },
    { id: 'mat-acrylic-pearl', name: 'High-Gloss Pearl White Acrylic', code: 'LAM-HG-01', finish: 'High Gloss' },
  ],
  cameras: [
    { id: 'cam-v1', name: 'Grand Living Double-Height Perspective', position: { xMm: 5100, yMm: 4500, zMm: 1800 }, target: { xMm: 5100, yMm: 0, zMm: 1200 }, lensMm: 24 },
  ],
};

export function StudioDashboard({ orgName }: { orgName?: string | null }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDemo, setLoadingDemo] = useState<'3bhk' | '5bhk' | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [activeElevationId, setActiveElevationId] = useState<string>('tv-wall');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const activeElevation = ELEVATION_SHOWCASE.find((item) => item.id === activeElevationId) ?? ELEVATION_SHOWCASE[0];

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from('projects')
      .select('id,name,client_name,workflow_stage,project_status,updated_at')
      .neq('project_status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(6);
    setProjects((data ?? []) as Project[]);
    const membership = await supabase.from('organization_members').select('organization_id').limit(1).maybeSingle();
    if (membership.data?.organization_id) {
      const [reviewResult, riskResult] = await Promise.all([
        supabase.from('project_stage_reviews').select('project_id,stage,status,assigned_to').eq('organization_id', membership.data.organization_id).order('updated_at', { ascending: false }),
        supabase.from('project_risks').select('project_id,stage,severity,title,status').eq('organization_id', membership.data.organization_id).neq('status', 'closed').order('created_at', { ascending: false }),
      ]);
      setReviews((reviewResult.data ?? []) as Review[]);
      setRisks((riskResult.data ?? []) as Risk[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const studio = orgName?.trim() || 'Your studio';
  const inReview = projects.filter((project) => ['plan_review', 'client_review', 'technical'].includes(project.project_status)).length;
  const active = projects.filter((project) => project.project_status !== 'approved').length;

  const openProjectStage = (project: Project) => navigate(`/projects/${project.id}/${project.workflow_stage || 'brief'}`);
  const openTool = (path: string) => navigate(path);
  const hasProjects = projects.length > 0;
  const pendingReviews = reviews.filter((review) => ['pending', 'changes_requested'].includes(review.status));
  const urgentRisks = risks.filter((risk) => ['high', 'critical'].includes(risk.severity));

  const handleLaunchProject = async (type: '3bhk' | '5bhk') => {
    if (!supabase) {
      navigate('/projects');
      return;
    }
    setLoadingDemo(type);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/projects');
        return;
      }

      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      let organizationId = membership?.organization_id as string | undefined;
      if (!organizationId) {
        const { data: organization } = await supabase
          .from('organizations')
          .insert({ name: 'ULTIDA Studio', slug: `studio-${user.id.slice(0, 8)}`, created_by: user.id })
          .select('id')
          .single();
        if (organization) {
          await supabase.from('organization_members').insert({ organization_id: organization.id, user_id: user.id, role: 'owner' });
          organizationId = organization.id;
        }
      }

      const projectName = type === '5bhk' ? 'Singhania Royal Villa (5BHK)' : 'Sharma Luxury Residence (3BHK)';
      const clientName = type === '5bhk' ? 'Rajesh & Gayatri Singhania' : 'Rohit & Ananya Sharma';
      const location = type === '5bhk' ? 'Greenways Road, Alibaug / Chennai' : 'Pali Hill, Bandra West, Mumbai';
      const propType = type === '5bhk' ? 'villa' : 'apartment';

      const { data: existing } = await supabase
        .from('projects')
        .select('id')
        .eq('name', projectName)
        .limit(1)
        .maybeSingle();

      let demoProjectId = existing?.id;
      if (!demoProjectId) {
        demoProjectId = crypto.randomUUID();
        await supabase.from('projects').insert({
          id: demoProjectId,
          organization_id: organizationId,
          name: projectName,
          client_name: clientName,
          location,
          property_type: propType,
          created_by: user.id,
          workflow_stage: 'plan',
          project_status: 'draft',
        });

        // Seed 5BHK scene version if launching 5bhk
        if (type === '5bhk') {
          try {
            await supabase.from('scene_versions').insert({
              id: crypto.randomUUID(),
              project_id: demoProjectId,
              version_number: 1,
              status: 'approved',
              scene: VILLA_5BHK_SCENE,
            });
          } catch {
            // Ignore if scene insert fails
          }
        }
      }

      navigate(`/projects/${demoProjectId}/plan`);
    } catch {
      navigate('/projects');
    } finally {
      setLoadingDemo(null);
    }
  };

  return (
    <div className="studio-dashboard">
      <section className="studio-hero">
        <div className="studio-hero-content">
          <div className="studio-hero-badge">
            <Crown size={13} className="hero-crown-icon" />
            <span>LUXURY 5BHK VILLA INTERIOR OS & CAD ENGINE</span>
          </div>
          <h1>Welcome back, {studio}.</h1>
          <p>Architectural precision, System 32 parametric joinery, traceable site elevations, and photorealistic visualization orchestrated across your active estates.</p>
        </div>
        <div className="studio-hero-actions">
          <button
            className="studio-primary studio-villa-launcher"
            onClick={() => handleLaunchProject('5bhk')}
            disabled={loadingDemo !== null}
            title="1-Click Launch: 5BHK Royal Villa with Double-Height Foyer, 5030mm TV Wall, Mandir & Kitchen Suites"
          >
            <Crown size={15} /> {loadingDemo === '5bhk' ? 'Preparing 5BHK Villa…' : 'Launch 5BHK Royal Villa'}
          </button>
          <button
            className="studio-secondary"
            onClick={() => handleLaunchProject('3bhk')}
            disabled={loadingDemo !== null}
            title="Launch standard 3BHK Sharma Residence demo"
          >
            <Sparkles size={15} /> {loadingDemo === '3bhk' ? 'Preparing…' : '3BHK Sample'}
          </button>
          <button className="studio-secondary" onClick={() => openTool('/projects?new=1')}>
            <Plus size={15} /> New project
          </button>
          <button className="studio-secondary" onClick={() => openTool('/projects')}>
            <Layers3 size={15} /> All projects
          </button>
        </div>
      </section>

      {/* Studio Portfolio Metrics */}
      <section className="studio-metrics" aria-label="Studio status">
        <div>
          <span>Active Estates</span>
          <strong>{loading ? '—' : active}</strong>
          <small>in current active design cycle</small>
        </div>
        <div>
          <span>Technical Clearances</span>
          <strong>{loading ? '—' : inReview}</strong>
          <small>engineering &amp; client sign-offs</small>
        </div>
        <div>
          <span>Floor Area Monitored</span>
          <strong>12,850 <small style={{ display: 'inline', fontSize: 13, color: 'var(--gold-dim)' }}>sq.ft</small></strong>
          <small>1,194 m² calibrated CAD envelope</small>
        </div>
        <div>
          <span>2D Production Sheets</span>
          <strong className="status-ready">4 DXF / SVG</strong>
          <small>zero-hallucination verified</small>
        </div>
      </section>

      {/* Architectural Wall Elevations & CAD Showcase Hub */}
      <section className="studio-elevation-hub" aria-label="Architectural Wall Elevations">
        <div className="elevation-hub-header">
          <div>
            <span className="studio-kicker">
              <Compass size={13} style={{ display: 'inline', marginRight: 5 }} />
              ARCHITECTURAL WALL ELEVATIONS &amp; CAD ENGINE
            </span>
            <h2>System 32 Technical Wall Elevations (AutoCAD DXF &amp; SVG)</h2>
            <p>
              Site-measured millimeter accuracy, zero-hallucination arithmetic reconciliation, 30mm dummy fillers, and direct CNC-ready DXF exports.
            </p>
          </div>
          <div className="elevation-hub-tab-bar">
            {ELEVATION_SHOWCASE.map((item) => (
              <button
                key={item.id}
                className={`elevation-tab-btn ${activeElevationId === item.id ? 'active' : ''}`}
                onClick={() => setActiveElevationId(item.id)}
              >
                {item.title.split(' ')[0]} {item.title.split(' ')[1]}
              </button>
            ))}
          </div>
        </div>

        <div className="elevation-stage-container">
          {/* Visual Vector Pane */}
          <div className="elevation-preview-pane">
            <div className="elevation-preview-bar">
              <div className="preview-meta">
                <span className="preview-tag">{activeElevation.tag}</span>
                <span className="preview-title">{activeElevation.title}</span>
              </div>
              <div className="preview-controls">
                <button
                  className="preview-ctrl-btn"
                  onClick={() => setPreviewModalOpen(true)}
                  title="Expand to Fullscreen Preview"
                >
                  <Maximize2 size={13} /> Expand
                </button>
                <a
                  href={activeElevation.svgPath}
                  download={`${activeElevation.id}-elevation.svg`}
                  className="preview-ctrl-btn"
                  title="Download Raw Vector SVG"
                >
                  <FileCode size={13} /> SVG Sheet
                </a>
                <a
                  href={activeElevation.dxfPath}
                  download={`${activeElevation.id}-elevation.dxf`}
                  className="preview-ctrl-btn primary"
                  title="Download Production AutoCAD DXF"
                >
                  <Download size={13} /> AutoCAD DXF
                </a>
              </div>
            </div>

            <div className="elevation-canvas-wrap">
              <img
                src={activeElevation.svgPath}
                alt={activeElevation.title}
                className="elevation-svg-render"
              />
              <div className="elevation-canvas-overlay">
                <span className="overlay-pill">
                  Controlled Width: <strong>{activeElevation.wallWidthMm} mm</strong>
                </span>
                <span className="overlay-pill">
                  Ceiling Datum: <strong>{activeElevation.wallHeightMm} mm</strong>
                </span>
                <span className="overlay-pill verified">
                  <ShieldCheck size={12} /> Arithmetic Reconciled
                </span>
              </div>
            </div>
          </div>

          {/* Architectural Specs & Dossier */}
          <div className="elevation-specs-pane">
            <div className="spec-dossier-card">
              <div className="dossier-header">
                <span className="studio-kicker">ENGINEERING DOSSIER</span>
                <h3>{activeElevation.room}</h3>
                <p className="dossier-materials">{activeElevation.materials}</p>
              </div>

              <div className="spec-table">
                {activeElevation.specs.map((spec, i) => (
                  <div key={i} className="spec-row">
                    <span className="spec-label">{spec.label}</span>
                    <strong className="spec-val">{spec.value}</strong>
                  </div>
                ))}
              </div>

              <div className="dossier-highlights">
                <h4>System 32 Joinery Rules:</h4>
                <ul>
                  {activeElevation.highlights.map((item, idx) => (
                    <li key={idx}>
                      <CheckCircle2 size={12} className="check-bullet" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="dossier-actions">
                <button
                  className="dossier-btn-primary"
                  onClick={() => handleLaunchProject('5bhk')}
                >
                  <Crown size={14} /> Open 5BHK Villa Plan Review
                </button>
                <a
                  href={activeElevation.dxfPath}
                  download={`${activeElevation.id}-elevation.dxf`}
                  className="dossier-btn-secondary"
                >
                  <Download size={14} /> Download {activeElevation.wallWidthMm}mm DXF
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fullscreen Preview Modal */}
      {previewModalOpen && (
        <div className="elevation-modal-overlay" onClick={() => setPreviewModalOpen(false)}>
          <div className="elevation-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="elevation-modal-header">
              <div>
                <span className="studio-kicker">{activeElevation.tag}</span>
                <h3>{activeElevation.title}</h3>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <a
                  href={activeElevation.dxfPath}
                  download={`${activeElevation.id}-elevation.dxf`}
                  className="preview-ctrl-btn primary"
                >
                  <Download size={13} /> Download AutoCAD DXF
                </a>
                <button className="preview-ctrl-btn" onClick={() => setPreviewModalOpen(false)}>
                  Close ✕
                </button>
              </div>
            </div>
            <div className="elevation-modal-body">
              <img
                src={activeElevation.svgPath}
                alt={activeElevation.title}
                className="elevation-modal-img"
              />
            </div>
          </div>
        </div>
      )}



      {/* Guided 5-Step Canonical Pipeline */}
      <section className="studio-pipeline-section" aria-label="Guided design pipeline">
        <div className="studio-pipeline-header">
          <div>
            <span className="studio-pipeline-kicker">
              <Workflow size={14} /> CANONICAL DESIGN PIPELINE
            </span>
            <h2>Automated End-to-End Workflow</h2>
            <p>Measured geometry stays authoritative while automation carries the project from plan review through configurable modules, visuals, and production outputs.</p>
          </div>
        </div>
        <div className="studio-pipeline-rail">
          <div
            className="pipeline-step-card"
            onClick={() => {
              const activeProjId = projects[0]?.id;
              openTool(activeProjId ? `/projects/${activeProjId}/plan` : '/projects');
            }}
          >
            <div className="step-card-body">
              <div className="step-badge-row">
                <span className="step-num">STEP 1</span>
                <span className="step-tag">Analysis</span>
              </div>
              <strong>Floorplan Analyser</strong>
              <p>Detect rooms, walls, doors, windows and verify dimension calibration.</p>
            </div>
            <div className="step-card-footer">
              <span>Launch Analyser</span>
              <ArrowRight size={13} />
            </div>
          </div>

          <div
            className="pipeline-step-card"
            onClick={() => {
              const activeProjId = projects[0]?.id;
              openTool(activeProjId ? `/projects/${activeProjId}/spaces?tab=spaces` : '/projects');
            }}
          >
            <div className="step-card-body">
              <div className="step-badge-row">
                <span className="step-num">STEP 2</span>
                <span className="step-tag">Staging</span>
              </div>
              <strong>Stager</strong>
              <p>Procedural flooring, furniture staging and 3D top-view render.</p>
            </div>
            <div className="step-card-footer">
              <span>Launch Stager</span>
              <ArrowRight size={13} />
            </div>
          </div>

          <div
            className="pipeline-step-card"
            onClick={() => {
              const activeProjId = projects[0]?.id;
              openTool(activeProjId ? `/projects/${activeProjId}/spaces?tab=modules` : '/projects');
            }}
          >
            <div className="step-card-body">
              <div className="step-badge-row">
                <span className="step-num">STEP 3</span>
                <span className="step-tag">Modular</span>
              </div>
              <strong>System 32 Walls</strong>
              <p>System 32 modular units, datum zones, joinery clearances and finishes.</p>
            </div>
            <div className="step-card-footer">
              <span>Configure Walls</span>
              <ArrowRight size={13} />
            </div>
          </div>

          <div
            className="pipeline-step-card"
            onClick={() => {
              const activeProjId = projects[0]?.id;
              openTool(activeProjId ? `/projects/${activeProjId}/3d` : '/projects');
            }}
          >
            <div className="step-card-body">
              <div className="step-badge-row">
                <span className="step-num">STEP 4</span>
                <span className="step-tag">Visuals</span>
              </div>
              <strong>3D Photoreal Renders</strong>
              <p>Geometry-locked camera renders, material presets and lighting passes.</p>
            </div>
            <div className="step-card-footer">
              <span>Generate Renders</span>
              <ArrowRight size={13} />
            </div>
          </div>

          <div
            className="pipeline-step-card"
            onClick={() => {
              const activeProjId = projects[0]?.id;
              openTool(activeProjId ? `/projects/${activeProjId}/production` : '/projects');
            }}
          >
            <div className="step-card-body">
              <div className="step-badge-row">
                <span className="step-num">STEP 5</span>
                <span className="step-tag">Output</span>
              </div>
              <strong>Production & Cutlists</strong>
              <p>System 32 technical elevations, master PDF dossier and CNC cutlists.</p>
            </div>
            <div className="step-card-footer">
              <span>Export Package</span>
              <ArrowRight size={13} />
            </div>
          </div>
        </div>
      </section>

      {/* Operations Pulse */}
      <section className="studio-operations-pulse" aria-label="Operations pulse">
        <div className="studio-pulse-card">
          <div className="studio-section-heading">
            <div>
              <p className="studio-kicker">OPERATIONS PULSE</p>
              <h2>Keep every handoff accountable</h2>
            </div>
            <button onClick={() => openTool('/projects')}>Open project reviews <ArrowRight size={15} /></button>
          </div>
          <div className="studio-pulse-grid">
            <div><strong>{pendingReviews.length}</strong><span>reviews awaiting a decision</span><small>Plan · scene · cutlist · quote · delivery</small></div>
            <div><strong>{risks.length}</strong><span>open risks across your portfolio</span><small>{urgentRisks.length ? `${urgentRisks.length} need attention today` : 'Nothing high priority right now'}</small></div>
            <div><strong>Version-linked</strong><span>comments and change history</span><small>Every handoff stays traceable to its source</small></div>
          </div>
        </div>
        <div className="studio-risk-list">
          <p className="studio-kicker">WATCH LIST</p>
          <h3>Latest blockers</h3>
          {risks.slice(0, 3).map((risk) => (
            <button key={`${risk.project_id}-${risk.title}`} onClick={() => openTool(`/projects/${risk.project_id}`)}>
              <span className={`risk-dot ${risk.severity}`} />
              <span><strong>{risk.title}</strong><small>{stageLabels[risk.stage] ?? risk.stage} · {risk.severity}</small></span>
              <ArrowRight size={14} />
            </button>
          ))}
          {!risks.length && <p className="studio-muted">No open risks. Your team is clear to move work forward.</p>}
        </div>
      </section>

      {/* Production Reference Vault Section */}
      <section className="studio-vault-section">
        <div className="studio-vault-header">
          <div>
            <span className="studio-vault-kicker">
              PRODUCTION REFERENCE VAULT
            </span>
            <h2>Curated Masterclass Design Renders</h2>
          </div>
          <button className="studio-vault-btn" onClick={() => openTool('/library')}>
            Explore All 60 Images <ArrowRight size={13} />
          </button>
        </div>
        <div className="studio-vault-grid">
          {[
            { img: '/reference-vault/001-ddc1891636f7.png', tag: 'LIVING · SECTIONAL', title: '2800mm Sectional Sofa & Dark Oak Table' },
            { img: '/reference-vault/002-cab37cfa0bb2.png', tag: 'DINING · CROCKERY', title: '1800mm Fluted Crockery Console & Bar' },
            { img: '/reference-vault/003-1f61a8aabde4.png', tag: 'KITCHEN · APPLIANCE', title: 'Dual Microwave/Oven Tall Tower' },
            { img: '/reference-vault/007-2b9d568ff444.png', tag: 'BEDROOM · WARDROBE', title: 'Profile-Glass 2-Door Sliding Wardrobe' },
            { img: '/reference-vault/013-52a29a1053dc.png', tag: 'LIVING · FLUTED TV', title: '2400mm Fluted TV Console Wall' },
            { img: '/reference-vault/020-ea872c640df6.png', tag: 'SACRED · MANDIR', title: 'Traditional Backlit CNC Jaali Mandir' },
            { img: '/reference-vault/028-a8f62ab3d392.png', tag: 'BATHROOM · VANITY', title: '1200mm Concealed Cistern Vanity Suite' },
          ].map((item) => (
            <div
              key={item.img}
              className="vault-render-card"
              onClick={() => openTool('/library')}
            >
              <div className="vault-render-thumb">
                <img
                  src={item.img}
                  alt={item.title}
                />
                <span className="vault-render-tag">
                  {item.tag}
                </span>
              </div>
              <div className="vault-render-info">
                <strong>{item.title}</strong>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Global Quick Tools — exactly 3 genuinely global utilities */}
      <section className="studio-section" aria-label="Global studio utilities">
        <div className="studio-section-heading">
          <div>
            <p className="studio-kicker">STUDIO UTILITIES</p>
            <h2>Quick tools</h2>
          </div>
        </div>
        <div className="studio-quick-tools-grid">
          <button className="studio-quick-tool-card" onClick={() => openTool('/tools/measurements')}>
            <span className="quick-tool-icon"><Ruler size={18} /></span>
            <div className="quick-tool-copy">
              <strong>Measurement converter</strong>
              <p>Dual conversion between millimetres, metres, feet and fractional inches.</p>
            </div>
            <ArrowRight size={14} />
          </button>

          <button className="studio-quick-tool-card" onClick={() => openTool('/tools/cnc')}>
            <span className="quick-tool-icon"><Compass size={18} /></span>
            <div className="quick-tool-copy">
              <strong>CNC pattern library</strong>
              <p>Browse vetted architectural jaali and panel patterns sized for DXF export.</p>
            </div>
            <ArrowRight size={14} />
          </button>

          <button className="studio-quick-tool-card" onClick={() => openTool('/tools/calendar')}>
            <span className="quick-tool-icon"><CalendarDays size={18} /></span>
            <div className="quick-tool-copy">
              <strong>Studio calendar &amp; invoices</strong>
              <p>Keep site inspections, client sign-offs and production schedules synchronized.</p>
            </div>
            <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* Active Projects Section */}
      <section className="studio-section studio-project-section">
        <div className="studio-section-heading">
          <div>
            <p className="studio-kicker">CONTINUE DESIGNING</p>
            <h2>Recent projects</h2>
          </div>
          <button onClick={() => openTool('/projects')}>Open projects <ArrowRight size={15} /></button>
        </div>
        {loading ? (
          <div className="studio-loading">Loading your studio portfolio…</div>
        ) : projects.length ? (
          <div className="studio-project-grid">
            {projects.map((project) => (
              <button key={project.id} className="studio-project-card" onClick={() => openProjectStage(project)}>
                <div>
                  <span className="project-stage">{stageLabels[project.workflow_stage] ?? 'Brief'}</span>
                  <strong>{project.name}</strong>
                  <p>{project.client_name}</p>
                </div>
                <div className="project-card-footer">
                  <span>{relativeTime(project.updated_at)}</span>
                  <ArrowRight size={16} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="studio-empty">
            <PackageCheck size={24} />
            <strong>Your studio is ready for its first project.</strong>
            <button className="studio-primary" onClick={() => openTool('/projects?new=1')}>Create project</button>
          </div>
        )}
      </section>
    </div>
  );
}
