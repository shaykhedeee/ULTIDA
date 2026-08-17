import { ArrowRight, Box, CalendarDays, FileOutput, FileText, Image, LayoutTemplate, Layers3, PackageCheck, Plus, Ruler, Sparkles, Wand2, Workflow, Home } from 'lucide-react';
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

  return (
    <div className="studio-dashboard">
      <section className="studio-hero">
        <div>
          <p className="studio-kicker">STUDIO COMMAND CENTRE</p>
          <h1>Welcome back, {studio}.</h1>
          <p>Start a standalone task, see what needs attention, and continue every project from its real workflow state.</p>
        </div>
        <div className="studio-hero-actions">
          <button className="studio-secondary" onClick={() => openTool('/projects')}><Layers3 size={16} /> All projects</button>
          <button className="studio-primary" onClick={() => openTool('/projects?new=1')}><Plus size={16} /> New project</button>
        </div>
      </section>

      {/* 100% AI-Powered Canonical Pipeline Flow */}
      <section style={{ margin: '20px 0', padding: '24px', borderRadius: 16, background: 'linear-gradient(135deg, #1c1917, #2c1e14)', color: '#fff', border: '1px solid #44382e', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#c59c2d', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} /> 100% AI-POWERED DESIGN PIPELINE
            </span>
            <h2 style={{ margin: '4px 0 0', fontSize: 20, color: '#fff' }}>Automated End-to-End Workflow</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#d6d3d1' }}>Zero manual CAD or 3D modeling required. The AI extracts the plan, enhances the layout, configures the walls, and renders photorealistic 3D.</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div
            onClick={() => openTool('/plan')}
            style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '16px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#c59c2d' }}>STEP 1</span>
                <Sparkles size={15} style={{ color: '#c59c2d' }} />
              </div>
              <strong style={{ fontSize: 15, color: '#fff', display: 'block', marginBottom: 4 }}>AI Floorplan Analyser</strong>
              <p style={{ fontSize: 12, color: '#a8a29e', margin: 0 }}>Auto-detects rooms, walls, doors, windows &amp; scale instantly.</p>
            </div>
            <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
              Launch Analyser <ArrowRight size={13} />
            </div>
          </div>

          <div
            onClick={() => openTool('/spaces')}
            style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '16px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#c59c2d' }}>STEP 2</span>
                <Sparkles size={15} style={{ color: '#c59c2d' }} />
              </div>
              <strong style={{ fontSize: 15, color: '#fff', display: 'block', marginBottom: 4 }}>AI Plan Enhancer</strong>
              <p style={{ fontSize: 12, color: '#a8a29e', margin: 0 }}>Procedural flooring, furniture staging &amp; 3D top-view render.</p>
            </div>
            <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
              Launch Stager <ArrowRight size={13} />
            </div>
          </div>

          <div
            onClick={() => openTool('/spaces?tab=modules')}
            style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '16px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#c59c2d' }}>STEP 3</span>
                <Sparkles size={15} style={{ color: '#c59c2d' }} />
              </div>
              <strong style={{ fontSize: 15, color: '#fff', display: 'block', marginBottom: 4 }}>AI Wall Picker &amp; Setup</strong>
              <p style={{ fontSize: 12, color: '#a8a29e', margin: 0 }}>System 32 modular units, anti-gravity float &amp; finishes.</p>
            </div>
            <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
              Configure Walls <ArrowRight size={13} />
            </div>
          </div>

          <div
            onClick={() => openTool('/3d')}
            style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '16px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#c59c2d' }}>STEP 4</span>
                <Sparkles size={15} style={{ color: '#c59c2d' }} />
              </div>
              <strong style={{ fontSize: 15, color: '#fff', display: 'block', marginBottom: 4 }}>AI 3D Renderer</strong>
              <p style={{ fontSize: 12, color: '#a8a29e', margin: 0 }}>Photorealistic renders, interactive hotspots &amp; dynamic BOM.</p>
            </div>
            <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
              Generate Renders <ArrowRight size={13} />
            </div>
          </div>

          <div
            onClick={() => openTool('/tools/render')}
            style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '16px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#c59c2d' }}>STEP 5</span>
                <Sparkles size={15} style={{ color: '#c59c2d' }} />
              </div>
              <strong style={{ fontSize: 15, color: '#fff', display: 'block', marginBottom: 4 }}>CAD Drawings &amp; Brief</strong>
              <p style={{ fontSize: 12, color: '#a8a29e', margin: 0 }}>System 32 technical elevations, executive PDF brief &amp; cutlist.</p>
            </div>
            <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
              Export Package <ArrowRight size={13} />
            </div>
          </div>
        </div>
      </section>

      <section className="studio-launchpad" aria-label="Start a task">
        <div className="studio-launchpad-copy">
          <p className="studio-kicker">PARAMETRIC ARCHITECTURE ENGINES</p>
          <h2>Design tools, ready when you are.</h2>
          <span>Instant access to System 32 vertical modular elevations, top-view procedural floorplan stagers, and interactive quotation viewers.</span>
        </div>
        <div className="studio-launchpad-actions">
          <button onClick={() => openTool('/tools/modules')}>
            <Box size={17} />
            <span>
              <strong>🚀 System 32 Elevation Canvas</strong>
              <small>Anti-Gravity Z-float &amp; live BOM</small>
            </span>
            <ArrowRight size={15} />
          </button>
          <button onClick={() => openTool('/library')}>
            <Image size={17} />
            <span>
              <strong>📚 Design Vault &amp; Moodboard</strong>
              <small>60 production renders &amp; lightbox</small>
            </span>
            <ArrowRight size={15} />
          </button>
          <button onClick={() => openTool('/tools/room-builder')}>
            <Home size={17} />
            <span>
              <strong>📐 Measured Room Builder</strong>
              <small>Offline shell, doors &amp; windows</small>
            </span>
            <ArrowRight size={15} />
          </button>
          <button onClick={() => openTool('/tools/render')}>
            <Wand2 size={17} />
            <span>
              <strong>✨ Interactive Hotspot BOM</strong>
              <small>Detect modules &amp; sync quotation</small>
            </span>
            <ArrowRight size={15} />
          </button>
          <button onClick={() => openTool('/tools/cnc')}>
            <LayoutTemplate size={17} />
            <span>
              <strong>⚙️ CNC Pattern Studio</strong>
              <small>Size vetted DXF templates</small>
            </span>
            <ArrowRight size={15} />
          </button>
          <button onClick={() => openTool('/tools/measurements')}>
            <Ruler size={17} />
            <span>
              <strong>📏 Unit Converter</strong>
              <small>mm, metres, feet &amp; inches</small>
            </span>
            <ArrowRight size={15} />
          </button>
          <button onClick={() => openTool('/tools/aura')}>
            <Sparkles size={17} />
            <span>
              <strong>🤖 AURA Design Agent</strong>
              <small>Supervised AI assistant &amp; audits</small>
            </span>
            <ArrowRight size={15} />
          </button>
          <button onClick={() => openTool('/tools/operations')}>
            <CalendarDays size={17} />
            <span>
              <strong>📊 Studio Operations</strong>
              <small>Calendar milestones &amp; invoices</small>
            </span>
            <ArrowRight size={15} />
          </button>
        </div>
      </section>

      {/* Featured Masterclass Design Showcase Strip */}
      <section style={{ margin: '24px 0', padding: '20px', borderRadius: 16, background: '#1c1917', color: '#fff', border: '1px solid #292524' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#c59c2d', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              ✦ PRODUCTION REFERENCE VAULT
            </span>
            <h2 style={{ margin: '4px 0 0', fontSize: 18, color: '#fff' }}>Curated Masterclass Design Renders</h2>
          </div>
          <button
            type="button"
            onClick={() => openTool('/library')}
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Explore All 60 Images <ArrowRight size={13} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {[
            { img: '/reference-vault/001-ddc1891636f7.png', tag: 'KITCHEN · ACRYLIC', title: 'Modular Kitchen Run' },
            { img: '/reference-vault/002-cab37cfa0bb2.png', tag: 'KITCHEN · OVERHEAD', title: 'Fluted Overhead Cabinets' },
            { img: '/reference-vault/003-1f61a8aabde4.png', tag: 'KITCHEN · APPLIANCE', title: 'Tall Appliance Tower' },
            { img: '/reference-vault/007-2b9d568ff444.png', tag: 'WARDROBE · GLASS', title: 'Profile-Glass Walk-In' },
            { img: '/reference-vault/013-52a29a1053dc.png', tag: 'LIVING · FLUTED PU', title: '2400mm Fluted TV Wall' },
            { img: '/reference-vault/028-a8f62ab3d392.png', tag: 'DINING · CALACATTA', title: 'Calacatta Marble Dining' },
          ].map((item) => (
            <div
              key={item.img}
              onClick={() => openTool('/library')}
              style={{
                background: '#292524',
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid #44403c',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, border-color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.borderColor = '#c59c2d';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = '#44403c';
              }}
            >
              <div style={{ position: 'relative', height: 115, overflow: 'hidden' }}>
                <img
                  src={item.img}
                  alt={item.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: 6,
                    fontSize: 8.5,
                    fontWeight: 800,
                    padding: '2px 5px',
                    borderRadius: 4,
                    background: 'rgba(0,0,0,0.7)',
                    color: '#c59c2d',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  {item.tag}
                </span>
              </div>
              <div style={{ padding: '8px 10px' }}>
                <strong style={{ display: 'block', fontSize: 11.5, color: '#f5f5f4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.title}
                </strong>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="studio-metrics" aria-label="Studio status">
        <div><span>Active projects</span><strong>{loading ? '—' : active}</strong><small>in your current portfolio</small></div>
        <div><span>Needs review</span><strong>{loading ? '—' : inReview}</strong><small>designer attention required</small></div>
        <div><span>Production-ready</span><strong>{loading ? '—' : projects.filter((p) => p.project_status === 'approved').length}</strong><small>approved projects</small></div>
        <div><span>Next action</span><strong className="status-ready">{loading ? '…' : hasProjects ? 'Continue' : 'Create'}</strong><small>{hasProjects ? 'resume an active project' : 'start your first project'}</small></div>
      </section>

      <section className="studio-operations-pulse" aria-label="Operations pulse">
        <div className="studio-pulse-card"><div className="studio-section-heading"><div><p className="studio-kicker">OPERATIONS PULSE</p><h2>Keep every handoff accountable</h2></div><button onClick={() => openTool('/projects')}>Open project reviews <ArrowRight size={15} /></button></div><div className="studio-pulse-grid"><div><strong>{pendingReviews.length}</strong><span>reviews awaiting a decision</span><small>Plan · scene · cutlist · quote · delivery</small></div><div><strong>{risks.length}</strong><span>open risks across your portfolio</span><small>{urgentRisks.length ? `${urgentRisks.length} need attention today` : 'Nothing high priority right now'}</small></div><div><strong>Version-linked</strong><span>comments and change history</span><small>Every handoff stays traceable to its source</small></div></div></div>
        <div className="studio-risk-list"><p className="studio-kicker">WATCH LIST</p><h3>Latest blockers</h3>{risks.slice(0, 3).map((risk) => <button key={`${risk.project_id}-${risk.title}`} onClick={() => openTool(`/projects/${risk.project_id}`)}><span className={`risk-dot ${risk.severity}`} /><span><strong>{risk.title}</strong><small>{stageLabels[risk.stage] ?? risk.stage} · {risk.severity}</small></span><ArrowRight size={14} /></button>)}{!risks.length && <p className="studio-muted">No open risks. Your team is clear to move work forward.</p>}</div>
      </section>

      <section className="studio-section">
        <div className="studio-section-heading"><div><p className="studio-kicker">DESIGN TOOLS</p><h2>Open the right workspace</h2></div><button onClick={() => openTool('/projects')}>View project flow <ArrowRight size={15} /></button></div>
        <div className="studio-tool-grid">
          <button className="studio-tool-card featured" onClick={() => openTool('/projects')}><span className="tool-icon"><Ruler size={20} /></span><strong>Floor plan intelligence</strong><p>Upload, analyse, calibrate, review rooms and continue into Spaces.</p><span>Start a plan project <ArrowRight size={14} /></span></button>
          <button className="studio-tool-card featured" onClick={() => openTool('/tools/room-builder')}><span className="tool-icon"><Home size={20} /></span><strong>Room builder</strong><p>Create a measured room, openings, finishes and a deterministic shell preview before attaching it to a project.</p><span>Build a room <ArrowRight size={14} /></span></button>
          <button className="studio-tool-card featured" onClick={() => openTool('/tools/modules')}><span className="tool-icon"><Box size={20} /></span><strong>Modular unit planner</strong><p>Pick a real TV, crockery, wardrobe or kitchen template, size it and export an initial brief.</p><span>Plan a unit <ArrowRight size={14} /></span></button>
          <button className="studio-tool-card" onClick={() => openTool('/library')}><span className="tool-icon"><Workflow size={20} /></span><strong>Furniture catalogue</strong><p>Filter visual, dimensioned templates by module family, room and design intent.</p><span>Browse modules <ArrowRight size={14} /></span></button>
          <button className="studio-tool-card featured" onClick={() => openTool('/tools/render')}><span className="tool-icon"><Wand2 size={20} /></span><strong>Render studio</strong><p>Choose an approved scene, then create a real geometry-locked interior render or laminate revision.</p><span>Start a render <ArrowRight size={14} /></span></button>
          <button className="studio-tool-card" onClick={() => openTool('/tools/cnc')}><span className="tool-icon"><LayoutTemplate size={20} /></span><strong>CNC pattern studio</strong><p>Use an image as a design reference, select a vetted pattern, size it and download DXF.</p><span>Open CNC tool <ArrowRight size={14} /></span></button>
          <button className="studio-tool-card" onClick={() => openTool('/tools/measurements')}><span className="tool-icon"><Ruler size={20} /></span><strong>Measurement converter</strong><p>Convert millimetres, metres, feet and inches through ULTIDA’s canonical millimetre value.</p><span>Convert a dimension <ArrowRight size={14} /></span></button>
          <button className="studio-tool-card" onClick={() => openTool('/tools/calendar')}><span className="tool-icon"><CalendarDays size={20} /></span><strong>Studio calendar</strong><p>Keep site visits, client reviews, deliveries, payment dates and milestones in one place.</p><span>Open calendar <ArrowRight size={14} /></span></button>
          <button className="studio-tool-card" onClick={() => openTool('/tools/invoices')}><span className="tool-icon"><FileText size={20} /></span><strong>Invoice workspace</strong><p>Prepare project-linked invoices from approved commercial work with transparent totals.</p><span>Open invoices <ArrowRight size={14} /></span></button>
          <button className="studio-tool-card featured" onClick={() => openTool('/tools/aura')}><span className="tool-icon"><Wand2 size={20} /></span><strong>AURA design agent</strong><p>Chat with project context and prepare approval-gated proposals using the tools already in ULTIDA.</p><span>Open AURA <ArrowRight size={14} /></span></button>
          <button className="studio-tool-card" onClick={() => openTool('/projects')}><span className="tool-icon"><FileOutput size={20} /></span><strong>Cutlist & production</strong><p>Generate panel, edging and hardware schedules from approved scene geometry.</p><span>Open production <ArrowRight size={14} /></span></button>
          <button className="studio-tool-card" onClick={() => openTool('/library')}><span className="tool-icon"><Image size={20} /></span><strong>Moodboard library</strong><p>Build a governed material palette from your studio’s saved product library.</p><span>Open materials <ArrowRight size={14} /></span></button>
        </div>
      </section>

      <section className="studio-section studio-project-section">
        <div className="studio-section-heading"><div><p className="studio-kicker">CONTINUE DESIGNING</p><h2>Recent projects</h2></div><button onClick={() => openTool('/projects')}>Open projects <ArrowRight size={15} /></button></div>
        {loading ? <div className="studio-loading">Loading your studio portfolio…</div> : projects.length ? (
          <div className="studio-project-grid">{projects.map((project) => <button key={project.id} className="studio-project-card" onClick={() => openProjectStage(project)}><div><span className="project-stage">{stageLabels[project.workflow_stage] ?? 'Brief'}</span><strong>{project.name}</strong><p>{project.client_name}</p></div><div className="project-card-footer"><span>{relativeTime(project.updated_at)}</span><ArrowRight size={16} /></div></button>)}</div>
      ) : <div className="studio-empty"><PackageCheck size={24} /><strong>Your studio is ready for its first project.</strong><button className="studio-primary" onClick={() => openTool('/projects?new=1')}>Create project</button></div>}
      </section>
    </div>
  );
}
