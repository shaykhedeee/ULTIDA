import { ArrowRight, Box, Camera, CheckCircle2, Layers3, Ruler } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type Project = { id: string; name: string; workflow_stage: string | null };
type Scene = { id: string; status: string; created_at: string };

/**
 * A dashboard-level render entry point. It intentionally opens the project
 * Visual Studio instead of offering a detached text-to-image form: every
 * image must start from a selected persisted scene.v1.
 */
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
      setState(data?.length ? 'Select a project to check its approved scene.' : 'Create a project, approve a plan, and compile a scene before starting a render.');
    })();
  }, []);

  async function selectProject(id: string) {
    setProjectId(id); setScene(null);
    if (!id || !supabase) return;
    setState('Checking scene readiness…');
    const { data, error } = await supabase.from('scene_versions').select('id,status,created_at').eq('project_id', id).in('status', ['approved', 'locked']).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) { setState(error.message); return; }
    if (!data) { setState('This project has no approved scene yet. Place modules, assign materials, compile scene.v1, then approve it.'); return; }
    setScene(data as Scene);
    setState('Scene is ready. Open Visual Studio to choose a room, camera, quality, references, and render operation.');
  }

  return <main style={{ maxWidth: 1040, margin: '0 auto', padding: '30px 24px' }}>
    <section style={{ borderRadius: 18, padding: '32px', background: 'linear-gradient(135deg,#292014,#5e4320)', color: '#fff', display: 'grid', gap: 18 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#f0cf7e' }}>GEOMETRY-LOCKED RENDER STUDIO</p>
      <h1 style={{ margin: 0, fontSize: 'clamp(26px,4vw,42px)' }}>Start a real render from the dashboard.</h1>
      <p style={{ margin: 0, maxWidth: 720, color: 'rgba(255,255,255,.78)' }}>ULTIDA does not send a loose room description to an image model. It starts with your approved plan, placed modules, named materials and compiled scene so the result has a trustworthy design source.</p>
    </section>
    <section style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(260px,.7fr)', gap: 20 }}>
      <div style={{ padding: 22, border: '1px solid #e6ddd2', borderRadius: 14, background: '#fff' }}>
        <label style={{ display: 'grid', gap: 7, fontWeight: 800 }}>Project
          <select value={projectId} onChange={(event) => void selectProject(event.target.value)} style={{ padding: '11px 12px', borderRadius: 8, border: '1px solid #d8cabb', background: '#fff' }}>
            <option value="">Choose a project…</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        <p role="status" style={{ color: '#6d5a49', minHeight: 42, lineHeight: 1.5 }}>{state}</p>
        <button disabled={!projectId || !scene} onClick={() => navigate(`/projects/${projectId}/renders`)} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '11px 15px', border: 0, borderRadius: 9, background: scene ? '#a0782c' : '#cfc4b7', color: '#fff', fontWeight: 800, cursor: scene ? 'pointer' : 'not-allowed' }}>
          <Camera size={17} /> Open Visual Studio <ArrowRight size={16} />
        </button>
      </div>
      <aside style={{ padding: 22, border: '1px solid #e6ddd2', borderRadius: 14, background: '#fcfaf7' }}>
        <strong>What the renderer uses</strong>
        <ul style={{ display: 'grid', gap: 12, paddingLeft: 0, listStyle: 'none', color: '#5f4e40', lineHeight: 1.35 }}>
          <li><Ruler size={15} style={{ verticalAlign: 'middle', marginRight: 7 }} />Approved room geometry and openings</li>
          <li><Box size={15} style={{ verticalAlign: 'middle', marginRight: 7 }} />Placed modular parts, shutters, lofts and lighting anchors</li>
          <li><Layers3 size={15} style={{ verticalAlign: 'middle', marginRight: 7 }} />Saved material and edge-band assignments</li>
          <li><CheckCircle2 size={15} style={{ verticalAlign: 'middle', marginRight: 7 }} />Approved references as visual guidance only</li>
        </ul>
      </aside>
    </section>
  </main>;
}
