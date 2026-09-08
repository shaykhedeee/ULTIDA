import { ArrowRight, Box, Camera, CheckCircle2, Layers3, Ruler, Route, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import './render-launcher.css';

type Project = { id: string; name: string; workflow_stage: string | null };
type Scene = { id: string; status: string; created_at: string };

/** Dashboard entry point for an exact persisted scene. It never sends loose text to an image model. */
export function RenderLauncher() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [scene, setScene] = useState<Scene | null>(null);
  const [state, setState] = useState('Loading projects with approved scenes…');

  useEffect(() => {
    void (async () => {
      if (!supabase) { setState('Sign in to choose a project scene.'); return; }
      const { data, error } = await supabase.from('projects').select('id,name,workflow_stage').neq('project_status', 'archived').order('updated_at', { ascending: false });
      if (error) { setState(error.message); return; }
      setProjects((data ?? []) as Project[]);
      setState(data?.length ? 'Choose a project. ULTIDA will check for an approved scene before opening the renderer.' : 'Create a project, approve a plan, and compile a scene before starting a render.');
    })();
  }, []);

  async function selectProject(id: string) {
    setProjectId(id); setScene(null);
    if (!id || !supabase) return;
    setState('Checking persisted scene readiness…');
    const { data, error } = await supabase.from('scene_versions').select('id,status,created_at').eq('project_id', id).in('status', ['approved', 'locked']).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) { setState(error.message); return; }
    if (!data) { setState('No approved scene yet. Continue through Spaces, Layouts, Modules, Materials, and Scene before requesting an image.'); return; }
    setScene(data as Scene);
    setState('Approved scene found. Visual Studio will let you choose the room, camera, quality, references, and scene-locked render operation.');
  }

  const goTo = (stage: 'spaces' | 'layouts' | 'modules' | 'materials' | '3d' | 'renders') => projectId && navigate(`/projects/${projectId}/${stage}`);

  return <main className="render-launcher">
    <section className="render-launcher-hero">
      <div><p><Sparkles size={14} /> GEOMETRY-LOCKED RENDER STUDIO</p><h1>Start a real render from a real scene.</h1><span>ULTIDA starts with approved room geometry, placed furniture and assigned materials—never an ungrounded text prompt.</span></div>
      <div className="render-launcher-badge"><CheckCircle2 size={18} /><div><strong>Scene first</strong><small>Every image is version-linked</small></div></div>
    </section>

    <section className="render-launcher-grid">
      <article className="render-start-card"><div className="render-card-heading"><div><small>1. SELECT PROJECT</small><h2>Check rendering readiness</h2></div><Camera size={20} /></div><label>Project<select value={projectId} onChange={(event) => void selectProject(event.target.value)}><option value="">Choose a project…</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><p className={`render-state${scene ? ' ready' : ''}`} role="status">{state}</p><button className="render-primary" disabled={!projectId || !scene} onClick={() => goTo('renders')}><Camera size={17} /> Open Visual Studio <ArrowRight size={16} /></button></article>

      <aside className="render-source-card"><small>WHAT IS LOCKED</small><h2>The image follows the scene.</h2><ul><li><Ruler size={16} /> Approved room geometry and openings</li><li><Box size={16} /> Placed modules, shutters, lofts and lighting anchors</li><li><Layers3 size={16} /> Named laminate, edge-band and hardware assignments</li><li><CheckCircle2 size={16} /> Approved references as visual guidance only</li></ul></aside>
    </section>

    <section className="render-path" aria-label="Render workflow">
      <div><Route size={18} /><div><small>RENDER PATH</small><strong>Spaces → Layout → Modules → Materials → Scene → Render</strong><span>Each stage persists a reviewable version. A geometry change marks the downstream image and drawing outputs stale.</span></div></div>
      <div className="render-path-actions">{(['spaces','layouts','modules','materials','3d'] as const).map((stage) => <button key={stage} onClick={() => goTo(stage)} disabled={!projectId}>{stage === '3d' ? 'Scene' : stage}</button>)}</div>
    </section>
  </main>;
}
