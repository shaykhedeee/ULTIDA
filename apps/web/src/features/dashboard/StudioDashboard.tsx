import { ArrowRight, Box, FileOutput, Image, LayoutTemplate, Layers3, PackageCheck, Plus, Ruler, Sparkles, Wand2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import './studio-dashboard.css';

type Project = { id: string; name: string; client_name: string; workflow_stage: string; project_status: string; updated_at: string };

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

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from('projects')
      .select('id,name,client_name,workflow_stage,project_status,updated_at')
      .neq('project_status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(6);
    setProjects((data ?? []) as Project[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const studio = orgName?.trim() || 'Your studio';
  const inReview = projects.filter((project) => ['plan_review', 'client_review', 'technical'].includes(project.project_status)).length;
  const active = projects.filter((project) => project.project_status !== 'approved').length;

  const openProjectStage = (project: Project) => navigate(`/projects/${project.id}/${project.workflow_stage || 'brief'}`);
  const openTool = (path: string) => navigate(path);

  return (
    <div className="studio-dashboard">
      <section className="studio-hero">
        <div>
          <p className="studio-kicker">STUDIO COMMAND CENTRE</p>
          <h1>Welcome back, {studio}.</h1>
          <p>Start the right task, see what needs attention, and continue every project from its real workflow state.</p>
        </div>
        <div className="studio-hero-actions">
          <button className="studio-secondary" onClick={() => openTool('/projects')}><Layers3 size={16} /> All projects</button>
          <button className="studio-primary" onClick={() => openTool('/projects')}><Plus size={16} /> New project</button>
        </div>
      </section>

      <section className="studio-metrics" aria-label="Studio status">
        <div><span>Active projects</span><strong>{loading ? '—' : active}</strong><small>in your current portfolio</small></div>
        <div><span>Needs review</span><strong>{loading ? '—' : inReview}</strong><small>designer attention required</small></div>
        <div><span>Production-ready</span><strong>{loading ? '—' : projects.filter((p) => p.project_status === 'approved').length}</strong><small>approved projects</small></div>
        <div><span>Core systems</span><strong className="status-ready">Ready</strong><small>plan AI and rendering online</small></div>
      </section>

      <section className="studio-section">
        <div className="studio-section-heading"><div><p className="studio-kicker">DESIGN TOOLS</p><h2>Open the right workspace</h2></div><button onClick={() => openTool('/projects')}>View project flow <ArrowRight size={15} /></button></div>
        <div className="studio-tool-grid">
          <button className="studio-tool-card featured" onClick={() => openTool('/projects')}><span className="tool-icon"><Ruler size={20} /></span><strong>Floor plan intelligence</strong><p>Upload, analyse, calibrate, review rooms and continue into Spaces.</p><span>Choose a project <ArrowRight size={14} /></span></button>
          <button className="studio-tool-card" onClick={() => openTool('/projects')}><span className="tool-icon"><Wand2 size={20} /></span><strong>Laminate preview</strong><p>Apply a saved material and produce a scene-locked render proposal.</p><span>Open Visual Studio <ArrowRight size={14} /></span></button>
          <button className="studio-tool-card" onClick={() => openTool('/tools/cnc')}><span className="tool-icon"><LayoutTemplate size={20} /></span><strong>CNC pattern studio</strong><p>Use an image as a design reference, select a vetted pattern, size it and download DXF.</p><span>Open CNC tool <ArrowRight size={14} /></span></button>
          <button className="studio-tool-card" onClick={() => openTool('/projects')}><span className="tool-icon"><FileOutput size={20} /></span><strong>Cutlist & production</strong><p>Generate panel, edging and hardware schedules from approved scene geometry.</p><span>Open production <ArrowRight size={14} /></span></button>
          <button className="studio-tool-card" onClick={() => openTool('/library')}><span className="tool-icon"><Box size={20} /></span><strong>Furniture selector</strong><p>Browse parametric kitchen, wardrobe, TV, crockery and pooja modules.</p><span>Open design library <ArrowRight size={14} /></span></button>
          <button className="studio-tool-card" onClick={() => openTool('/library')}><span className="tool-icon"><Image size={20} /></span><strong>Moodboard library</strong><p>Build a governed material palette from your studio’s saved product library.</p><span>Open materials <ArrowRight size={14} /></span></button>
        </div>
      </section>

      <section className="studio-section studio-project-section">
        <div className="studio-section-heading"><div><p className="studio-kicker">CONTINUE DESIGNING</p><h2>Recent projects</h2></div><button onClick={() => openTool('/projects')}>Open projects <ArrowRight size={15} /></button></div>
        {loading ? <div className="studio-loading">Loading your studio portfolio…</div> : projects.length ? (
          <div className="studio-project-grid">{projects.map((project) => <button key={project.id} className="studio-project-card" onClick={() => openProjectStage(project)}><div><span className="project-stage">{stageLabels[project.workflow_stage] ?? 'Brief'}</span><strong>{project.name}</strong><p>{project.client_name}</p></div><div className="project-card-footer"><span>{relativeTime(project.updated_at)}</span><ArrowRight size={16} /></div></button>)}</div>
        ) : <div className="studio-empty"><PackageCheck size={24} /><strong>Your studio is ready for its first project.</strong><button className="studio-primary" onClick={() => openTool('/projects')}>Create project</button></div>}
      </section>
    </div>
  );
}
