import { AlertCircle, ArrowRight, Box, Camera, CheckCircle2, Cpu, ExternalLink, Layers3, Palette, RefreshCw, Ruler, Route, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getApiBase } from '../../lib/api-base';
import './render-launcher.css';

type Project = { id: string; name: string; workflow_stage: string | null };
type Scene = { id: string; status: string; created_at: string };
type ProviderInfo = { id: string; name: string; configured: boolean; eligible: boolean; operations: string[]; details: string };
type ComfyProbeStatus = 'unchecked' | 'checking' | 'reachable' | 'missing_models' | 'unreachable';

/** Dashboard entry point for an exact persisted scene. It never sends loose text to an image model. */
export function RenderLauncher() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [scene, setScene] = useState<Scene | null>(null);
  const [state, setState] = useState('Loading projects with approved scenes…');
  const [comfyProvider, setComfyProvider] = useState<ProviderInfo | null>(null);
  const [allProviders, setAllProviders] = useState<ProviderInfo[]>([]);
  const [comfyConfigured, setComfyConfigured] = useState<boolean | null>(null);
  const [comfyProbe, setComfyProbe] = useState<ComfyProbeStatus>('unchecked');
  const [comfyProbeMessage, setComfyProbeMessage] = useState('');
  const [providerError, setProviderError] = useState('');
  const sceneRequest = useRef(0);

  const isLocalOrigin = typeof window !== 'undefined' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(window.location.origin);

  async function verifyLocalComfyReachability() {
    setComfyProbe('checking');
    setComfyProbeMessage('Checking local ComfyUI reachability and checkpoint availability…');
    try {
      const res = await fetch('http://127.0.0.1:8188/object_info/CheckpointLoaderSimple', { method: 'GET' });
      if (!res.ok) {
        setComfyProbe('unreachable');
        setComfyProbeMessage(`ComfyUI responded with HTTP ${res.status}. Verify the server and custom nodes.`);
        return;
      }
      const payload = await res.json().catch(() => null) as Record<string, any> | null;
      const checkpoints: string[] = payload?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] ?? [];
      if (Array.isArray(checkpoints) && checkpoints.length === 0) {
        setComfyProbe('missing_models');
        setComfyProbeMessage('ComfyUI server is reachable on 127.0.0.1:8188, but no SDXL/Flux checkpoint models are installed in models/checkpoints.');
      } else {
        setComfyProbe('reachable');
        setComfyProbeMessage(`ComfyUI server reachable (${checkpoints.length || 'verified'} checkpoint${checkpoints.length === 1 ? '' : 's'} available). Ready to queue geometry-locked jobs.`);
      }
    } catch {
      setComfyProbe('unreachable');
      setComfyProbeMessage('Local ComfyUI server on 127.0.0.1:8188 could not be reached from the browser. Ensure ComfyUI is running or use a configured cloud provider.');
    }
  }

  useEffect(() => {
    void (async () => {
      if (!supabase) { setState('Sign in to choose a project scene.'); return; }
      const { data, error } = await supabase.from('projects').select('id,name,workflow_stage').neq('project_status', 'archived').order('updated_at', { ascending: false });
      if (error) { setState(error.message); return; }
      setProjects((data ?? []) as Project[]);
      setState(data?.length ? 'Choose a project. ULTIDA will check for an approved scene before opening the renderer.' : 'Create a project, approve a plan, and compile a scene before starting a render.');
    })();

    const controller = new AbortController();
    fetch(`${getApiBase()}/providers`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Provider settings could not be loaded.');
        return res.json();
      })
      .then((data) => {
        const list = (data.providers as ProviderInfo[] | undefined) ?? [];
        setAllProviders(list);
        const comfy = list.find((p) => p.id === 'comfyui') ?? null;
        setComfyProvider(comfy);
        setComfyConfigured(Boolean(comfy?.configured));
      })
      .catch((error) => {
        if (!controller.signal.aborted) setProviderError(error instanceof Error ? error.message : 'Provider settings could not be loaded.');
      });
    return () => controller.abort();
  }, []);

  async function selectProject(id: string) {
    const request = ++sceneRequest.current;
    setProjectId(id); setScene(null);
    if (!id || !supabase) { setState('Choose a project to check its approved scene.'); return; }
    setState('Checking persisted scene readiness…');
    const { data, error } = await supabase.from('scene_versions').select('id,status,created_at').eq('project_id', id).in('status', ['approved', 'locked']).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (request !== sceneRequest.current) return;
    if (error) { setState(error.message); return; }
    if (!data) { setState('No approved scene yet. Continue through Spaces, Layouts, Modules, Materials, and Scene before requesting an image.'); return; }
    setScene(data as Scene);
    setState('Approved scene found. Visual Studio will let you choose the room, camera, quality, references, and scene-locked render operation.');
  }

  const goTo = (stage: 'spaces' | 'layouts' | 'modules' | 'materials' | '3d' | 'renders') => {
    if (!projectId) return;
    if (stage === 'renders') {
      navigate(`/projects/${projectId}/3d?tab=render`);
    } else {
      navigate(`/projects/${projectId}/${stage}`);
    }
  };

  const activeFallbacks = allProviders.filter((p) => p.id !== 'comfyui' && p.configured);
  const badgeLabel = providerError
    ? 'Status unavailable'
    : comfyConfigured === null
      ? 'Checking settings…'
      : comfyProbe === 'reachable'
        ? 'Reachable & models verified'
        : comfyProbe === 'missing_models'
          ? 'Missing checkpoint models'
          : comfyProbe === 'unreachable'
            ? 'Server unreachable'
            : comfyConfigured
              ? 'Env configured (verify live reachability)'
              : 'Not configured';

  const badgeSuccess = comfyProbe === 'reachable' || (comfyConfigured && comfyProbe === 'unchecked');

  return <main className="render-launcher">
    <section className="render-launcher-hero">
      <div>
        <p><Sparkles size={14} /> GEOMETRY-LOCKED RENDER STUDIO</p>
        <h1>Start a real render from a real scene.</h1>
        <span>ULTIDA starts with approved room geometry, placed furniture and assigned materials—never an ungrounded text prompt.</span>
      </div>
      <div className="render-launcher-badge">
        <CheckCircle2 size={18} />
        <div>
          <strong>Scene first</strong>
          <small>Every image is version-linked</small>
        </div>
      </div>
    </section>

    <section className="render-launcher-grid">
      <article className="render-start-card">
        <div className="render-card-heading">
          <div>
            <small>1. SELECT PROJECT</small>
            <h2>Check rendering readiness</h2>
          </div>
          <Camera size={20} />
        </div>
        <label>
          Project
          <select value={projectId} onChange={(event) => void selectProject(event.target.value)}>
            <option value="">Choose a project…</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        <p className={`render-state${scene ? ' ready' : ''}`} role="status">{state}</p>
        <button className="render-primary" disabled={!projectId || !scene} onClick={() => goTo('renders')}>
          <Camera size={17} /> Open Visual Studio <ArrowRight size={16} />
        </button>
      </article>

      <aside className="render-source-card">
        <small>WHAT IS LOCKED</small>
        <h2>The image follows the scene.</h2>
        <ul>
          <li><Ruler size={16} /> Approved room geometry and openings</li>
          <li><Box size={16} /> Placed modules, shutters, lofts and lighting anchors</li>
          <li><Layers3 size={16} /> Named laminate, edge-band and hardware assignments</li>
          <li><Palette size={16} /> CIEDE2000 ΔE &lt; 0.1 material preservation guard</li>
          <li><CheckCircle2 size={16} /> Approved references as visual guidance only</li>
        </ul>
      </aside>
    </section>

    {/* ComfyUI Local Engine & Provider Diagnostics Card */}
    <section className="render-comfy-card" style={{ marginTop: 16, border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)', padding: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: '1 1 420px' }}>
          <Cpu size={20} style={{ color: badgeSuccess ? '#22c55e' : '#f59e0b', marginTop: 2 }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 14 }}>ComfyUI & Render Provider Diagnostics</strong>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: badgeSuccess ? '#dcfce7' : '#fef3c7', color: badgeSuccess ? '#15803d' : '#b45309', fontWeight: 700 }}>
                {badgeLabel}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              {providerError
                || comfyProbeMessage
                || comfyProvider?.details
                || 'Rendering requires a running ComfyUI server (COMFYUI_BASE_URL / COMFYUI_URL), installed checkpoint/ControlNet models, and a compatible workflow.'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
              <span><strong>Lifecycle states:</strong> Configured → Live Reachability → Checkpoint/ControlNet Models → Queued → Running → Complete / Failed</span>
              {activeFallbacks.length > 0 && (
                <span>• <strong>Configured cloud providers:</strong> {activeFallbacks.map((p) => p.name).join(', ')}</span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {isLocalOrigin && (
            <button
              type="button"
              onClick={() => void verifyLocalComfyReachability()}
              disabled={comfyProbe === 'checking'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text)', background: 'var(--surface-2)', cursor: 'pointer', padding: '6px 12px', border: '1px solid var(--line)', borderRadius: 8 }}
            >
              <RefreshCw size={13} /> {comfyProbe === 'checking' ? 'Probing 127.0.0.1:8188…' : 'Probe Live ComfyUI & Models'}
            </button>
          )}
          {isLocalOrigin && (
            <a
              href="http://127.0.0.1:8188"
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--gold-dim)', textDecoration: 'none', padding: '6px 12px', border: '1px solid var(--line)', borderRadius: 8 }}
            >
              Open local ComfyUI <ExternalLink size={13} />
            </a>
          )}
          {!isLocalOrigin && !comfyConfigured && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#b45309' }}>
              <AlertCircle size={13} /> Set COMFYUI_BASE_URL on the API server for remote ComfyUI
            </span>
          )}
        </div>
      </div>
    </section>

    <section className="render-path" aria-label="Render workflow">
      <div>
        <Route size={18} />
        <div>
          <small>RENDER PATH</small>
          <strong>Spaces → Layout → Modules → Materials → Scene → Render</strong>
          <span>Each stage persists a reviewable version. A geometry change marks the downstream image and drawing outputs stale.</span>
        </div>
      </div>
      <div className="render-path-actions">
        {(['spaces','layouts','modules','materials','3d'] as const).map((stage) => (
          <button key={stage} onClick={() => goTo(stage)} disabled={!projectId}>
            {stage === '3d' ? 'Scene' : stage}
          </button>
        ))}
      </div>
    </section>
  </main>;
}
