import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getApiBase } from '../../lib/api-base';

type SavedScene = { id: string; status: string; version_number: number; scene: { modules?: Array<{ id: string; family?: string; widthMm?: number; depthMm?: number; heightMm?: number }> } };
type SavedRender = { id: string; scene_version_id: string; status: string; stale?: boolean; signedUrl?: string | null; provenance?: { reviewStatus?: string } };

export function ClientPresentationPortal() {
  const { projectId } = useParams<{ projectId: string }>();
  const [projectName, setProjectName] = useState('');
  const [scene, setScene] = useState<SavedScene | null>(null);
  const [renders, setRenders] = useState<SavedRender[]>([]);
  const [status, setStatus] = useState('Loading saved project…');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [preparingPdf, setPreparingPdf] = useState(false);
  const pdfRequest = useRef<AbortController | null>(null);
  useEffect(() => { setPdfUrl(null); setPreparingPdf(false); return () => { pdfRequest.current?.abort(); }; }, [projectId, scene?.id]);
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  async function previewPresentation() {
    if (!projectId || !scene || !supabase || preparingPdf) return;
    setPreparingPdf(true);
    const controller = new AbortController(); pdfRequest.current = controller;
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Sign in to view this private document.');
      const response = await fetch(`${getApiBase()}/projects/${encodeURIComponent(projectId)}/scenes/${encodeURIComponent(scene.id)}/presentation.pdf`, { signal: controller.signal, headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) { const payload = await response.json().catch(() => null); throw new Error(payload?.message ?? 'Presentation could not be prepared.'); }
      const blob = await response.blob();
      if (!blob.size || !blob.type.includes('application/pdf')) throw new Error('The service did not return a PDF.');
      if (!controller.signal.aborted) { setPdfUrl(URL.createObjectURL(blob)); setStatus('Your saved-revision presentation is ready to view and download.'); }
    } catch (error) { if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : 'Presentation failed. Retry.'); }
    finally { if (!controller.signal.aborted) setPreparingPdf(false); }
  }

  useEffect(() => {
    let active = true;
    setLoading(true); setScene(null); setRenders([]); setProjectName('');
    async function load() {
      try {
        if (!projectId || !supabase) throw new Error('Open a saved project and sign in to view its presentation.');
        const session = (await supabase.auth.getSession()).data.session;
        if (!session) throw new Error('Sign in to view this private project.');
        const [project, scenes, renderResponse] = await Promise.all([
          supabase.from('projects').select('id,name').eq('id', projectId).single(),
          supabase.from('scene_versions').select('id,status,version_number,scene').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1),
          fetch(`${getApiBase()}/projects/${encodeURIComponent(projectId)}/renders`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
        ]);
        if (project.error || !project.data) throw new Error('This project is unavailable or you do not have access.');
        if (scenes.error) throw new Error('Saved design could not be loaded. Retry before presenting it.');
        const payload = await renderResponse.json().catch(() => null);
        if (!renderResponse.ok) throw new Error(payload?.message ?? 'Project renders could not be loaded.');
        if (!active) return;
        setProjectName(project.data.name ?? 'Saved project');
        setScene(scenes.data?.[0] ?? null);
        setRenders(Array.isArray(payload?.renders) ? payload.renders : []);
        setStatus('Saved project loaded.');
      } catch (error) { if (active) setStatus(error instanceof Error ? error.message : 'Presentation could not be loaded.'); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [projectId, retry]);

  async function downloadPackage() {
    if (!projectId || !scene || scene.status !== 'approved' || !supabase || downloading) return;
    setDownloading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Sign in before downloading the private production package.');
      const response = await fetch(`${getApiBase()}/projects/${encodeURIComponent(projectId)}/scenes/${encodeURIComponent(scene.id)}/production/package.pdf`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? 'The saved revision is not ready for production export.');
      }
      const blob = await response.blob();
      if (!blob.size || !response.headers.get('content-type')?.includes('application/pdf')) throw new Error('The service did not return a valid PDF package.');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `ULTIDA-${projectId}-revision-${scene.version_number}.pdf`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setStatus('Production package downloaded from the saved revision.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Download failed. Please retry.'); }
    finally { setDownloading(false); }
  }

  const currentRenders = scene ? renders.filter(render => render.scene_version_id === scene.id && !render.stale && render.status === 'ready' && render.signedUrl) : [];
  return (
    <section style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1>{projectName || 'Project presentation'}</h1>
      <p>Saved design, presentation images and production package from one project revision.</p>
      <p role="status" aria-live="polite">{status}</p>
      {!loading && <button onClick={() => setRetry(value => value + 1)}>Refresh saved project</button>}
      {projectId && <nav aria-label="Project presentation actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '16px 0' }}>
        <Link to={`/projects/${projectId}/spaces`}>Edit rooms</Link>
        <Link to={`/projects/${projectId}/3d`}>Review and approve 3D</Link>
        <Link to={`/projects/${projectId}/3d?tab=render`}>Generate AI image</Link>
        <Link to={`/projects/${projectId}/drawings`}>Production drawings and workbook</Link>
      </nav>}
      {scene ? <>
        <h2>Design revision {scene.version_number}</h2>
        <h2>Final design presentation</h2>
        <p>One landscape document: saved renders, room floor plan, finish moodboard, external and internal elevations, component sizes and review sign-off. Manufacturing outputs remain a separate release.</p>
        <button disabled={!['approved', 'locked'].includes(scene.status) || preparingPdf} onClick={() => void previewPresentation()}>{preparingPdf ? 'Preparing document…' : 'View final PDF'}</button>
        {pdfUrl && <section aria-label="Final PDF preview">
          <a href={pdfUrl} download={`ULTIDA-design-revision-${scene.version_number}.pdf`}>Download final PDF</a>{' · '}
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">Open PDF in new tab</a>
          <iframe title="Final design presentation PDF" src={pdfUrl} style={{ display: 'block', width: '100%', height: 'min(75vh, 900px)', border: '1px solid #a5b18c', marginTop: 16 }} />
        </section>}
        <p>{scene.status === 'approved' ? 'Saved design approved' : `Design status: ${scene.status}. Review the saved design before releasing production.`}</p>
        <button disabled={scene.status !== 'approved' || downloading} onClick={() => void downloadPackage()}>{downloading ? 'Downloading…' : 'Download production PDF'}</button>
        <h2>Configured furniture</h2>
        <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Unit</th><th>Family</th><th>Width × depth × height (mm)</th></tr></thead><tbody>
          {(scene.scene.modules ?? []).map(module => <tr key={module.id}><td>{module.id}</td><td>{module.family ?? 'Unspecified'}</td><td>{[module.widthMm, module.depthMm, module.heightMm].map(value => value ?? 'Unconfirmed').join(' × ')}</td></tr>)}
        </tbody></table></div>
        <h2>Images for this revision</h2>
        {!currentRenders.length && <p>No completed presentation image is saved for this revision. Generate an AI image after reviewing and approving the room.</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 16 }}>
          {currentRenders.map(render => <figure key={render.id}><img src={render.signedUrl!} alt={`Presentation render ${render.id}`} style={{ width: '100%', height: 'auto' }} /><figcaption>Presentation image · {render.provenance?.reviewStatus ?? 'Review pending'}. Construction measurements come from saved geometry.</figcaption></figure>)}
        </div>
      </> : !loading && projectName && <p>No saved 3D design yet. Configure the required rooms, then review the saved 3D design.</p>}
    </section>
  );
}
