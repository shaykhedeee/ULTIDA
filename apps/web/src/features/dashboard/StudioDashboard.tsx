import { ArrowRight, CalendarDays, Compass, Layers3, PackageCheck, Plus, Ruler, Sparkles, Workflow } from 'lucide-react';
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

export function StudioDashboard({ orgName }: { orgName?: string | null }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);

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

  const handleLaunchDemo = async () => {
    if (!supabase) {
      navigate('/projects');
      return;
    }
    setLoadingDemo(true);
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

      const { data: existing } = await supabase
        .from('projects')
        .select('id')
        .eq('name', 'Sharma Luxury Residence (3BHK)')
        .limit(1)
        .maybeSingle();

      let demoProjectId = existing?.id;
      if (!demoProjectId) {
        demoProjectId = crypto.randomUUID();
        await supabase.from('projects').insert({
          id: demoProjectId,
          organization_id: organizationId,
          name: 'Sharma Luxury Residence (3BHK)',
          client_name: 'Rohit & Ananya Sharma',
          location: 'Pali Hill, Bandra West, Mumbai',
          property_type: 'apartment',
          created_by: user.id,
          workflow_stage: 'plan',
          project_status: 'draft',
        });
      }

      navigate(`/projects/${demoProjectId}/plan`);
    } catch {
      navigate('/projects');
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="studio-dashboard">
      <section className="studio-hero">
        <div className="studio-hero-content">
          <p className="studio-kicker">STUDIO COMMAND CENTRE</p>
          <h1>Welcome back, {studio}.</h1>
          <p>Architectural precision, parametric modular joinery, and photorealistic visualization orchestrated across your active projects.</p>
        </div>
        <div className="studio-hero-actions">
          <button className="studio-primary" onClick={handleLaunchDemo} disabled={loadingDemo}>
            <Sparkles size={15} /> {loadingDemo ? 'Preparing Demo…' : 'Launch Demo'}
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
        <div><span>Active projects</span><strong>{loading ? '—' : active}</strong><small>in your current portfolio</small></div>
        <div><span>Needs review</span><strong>{loading ? '—' : inReview}</strong><small>designer attention required</small></div>
        <div><span>Production-ready</span><strong>{loading ? '—' : projects.filter((p) => p.project_status === 'approved').length}</strong><small>approved projects</small></div>
        <div><span>Next action</span><strong className="status-ready">{loading ? '…' : hasProjects ? 'Continue' : 'Create'}</strong><small>{hasProjects ? 'resume an active project' : 'start your first project'}</small></div>
      </section>

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
