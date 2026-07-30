import { BookOpen, Library as LibraryIcon, Palette, Search, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, CardContent, CardHeader } from '../ui/primitives';
import { supabase } from '../../lib/supabase';

type LibraryItem = {
  id: string;
  title: string;
  kind: string;
  tags: string[];
  notes: string;
  source: string;
  metadata: { previewUrl?: string };
  asset?: { storage_path: string; mime_type: string } | null;
};

type CatalogModule = {
  id: string;
  family: string;
  name: string;
  roomTypes: string[];
  widthMm: number;
  depthMm: number;
  heightMm: number;
  sku: string;
  tags: string[];
  description?: string;
  manufacturingRules?: string[];
  production: { cutlistSupported: boolean };
};

type Material = {
  id: string;
  name: string;
  code: string;
  category: string;
  supplier?: string | null;
  finish?: string | null;
  availability?: string | null;
};

function apiBase() {
  const configured = String(import.meta.env.VITE_API_BASE ?? '').trim();
  const isLocalTarget = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/api\/?$/i.test(configured);
  if (typeof window !== 'undefined' && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(window.location.origin) && isLocalTarget) return '/api';
  return configured || '/api';
}

function materialSubtitle(material: Material) {
  return [material.category, material.finish, material.supplier, material.availability]
    .filter(Boolean)
    .join(' · ');
}

export function UnifiedDesignLibraryWorkspace({ organizationId, projectId }: { organizationId?: string | null; projectId?: string | null }) {
  const [activeTab, setActiveTab] = useState<'templates' | 'modules' | 'materials'>('modules');
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [modules, setModules] = useState<CatalogModule[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [query, setQuery] = useState('');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceTags, setReferenceTags] = useState('');
  const [uploadingReference, setUploadingReference] = useState(false);
  const [status, setStatus] = useState('Loading modular catalog…');

  useEffect(() => {
    let live = true;
    async function load() {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const authorization = session?.access_token ? { authorization: `Bearer ${session.access_token}` } : undefined;
      const tasks: Promise<void>[] = [];

      tasks.push(fetch(`${apiBase()}/catalog/modules`)
        .then(async (response) => {
          const payload = await response.json().catch(() => null);
          if (!response.ok) throw new Error(payload?.message ?? 'The modular catalog could not be loaded.');
          if (!Array.isArray(payload?.modules)) throw new Error('The modular catalog returned an invalid response.');
          if (live) setModules(payload.modules);
        }));

      if (supabase && organizationId) {
        const client = supabase;
        tasks.push((async () => {
            const result = await client
              .from('reference_library_items')
              .select('id,title,kind,tags,notes,source,metadata,asset:project_assets(storage_path,mime_type)')
              .eq('organization_id', organizationId)
              .order('created_at', { ascending: false });
            if (result.error) throw result.error;
            const prepared = await Promise.all(((result.data ?? []) as unknown as Array<LibraryItem & { asset?: Array<{ storage_path: string; mime_type: string }> }>).map(async (raw) => {
              const item = { ...raw, asset: raw.asset?.[0] ?? null } as LibraryItem;
              if (!item.asset?.storage_path || !item.asset.mime_type.startsWith('image/')) return item;
              const signed = await client.storage.from('project-assets').createSignedUrl(item.asset.storage_path, 3600);
              return { ...item, metadata: { ...item.metadata, previewUrl: signed.data?.signedUrl } };
            }));
            if (live) setItems(prepared);
          })());
      }

      if (projectId && authorization) {
        tasks.push(fetch(`${apiBase()}/projects/${projectId}/material-library`, { headers: authorization })
          .then(async (response) => {
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.message ?? 'The project material library could not be loaded.');
            if (live) setMaterials(Array.isArray(payload?.materials) ? payload.materials : []);
          }));
      }

      const outcomes = await Promise.allSettled(tasks);
      if (!live) return;
      const failures = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
      const catalogFailed = outcomes[0]?.status === 'rejected';
      setStatus(catalogFailed
        ? 'The modular catalog could not be loaded. Check the API health and catalog route before placing modules.'
        : failures.length
          ? `Modular catalog loaded. ${failures.length} optional project library source${failures.length === 1 ? '' : 's'} could not be loaded.`
          : 'Modular catalog and available project library data are connected.');
    }
    void load();
    return () => { live = false; };
  }, [organizationId, projectId]);

  const search = query.trim().toLowerCase();
  const visibleTemplates = useMemo(() => items.filter((item) => {
    const matches = !search || `${item.title} ${item.kind} ${item.tags.join(' ')} ${item.notes}`.toLowerCase().includes(search);
    return matches && item.kind !== 'material' && item.kind !== 'module';
  }), [items, search]);
  const visibleModules = useMemo(() => modules.filter((item) => !search || `${item.name} ${item.family} ${item.tags.join(' ')} ${item.sku}`.toLowerCase().includes(search)), [modules, search]);
  const visibleMaterials = useMemo(() => materials.filter((item) => !search || `${item.name} ${item.code} ${item.category} ${item.supplier ?? ''}`.toLowerCase().includes(search)), [materials, search]);

  async function uploadReference() {
    if (!projectId || !referenceFile || !supabase) {
      setStatus(!projectId ? 'Open a project before adding studio references.' : 'Choose a PNG, JPEG, or WebP image to add it to this project library.');
      return;
    }
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) { setStatus('Sign in before adding a project reference.'); return; }
    setUploadingReference(true);
    setStatus('Preparing a secure reference upload...');
    try {
      const headers = { authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json' };
      const initiated = await fetch(`${apiBase()}/projects/${projectId}/references/initiate`, { method: 'POST', headers, body: JSON.stringify({ fileName: referenceFile.name, mimeType: referenceFile.type, fileSize: referenceFile.size }) });
      const initiation = await initiated.json().catch(() => null);
      if (!initiated.ok || !initiation?.token || !initiation?.storagePath) throw new Error(initiation?.message ?? 'The secure upload could not be prepared.');
      const stored = await supabase.storage.from(initiation.bucket ?? 'project-assets').uploadToSignedUrl(initiation.storagePath, initiation.token, referenceFile, { contentType: referenceFile.type });
      if (stored.error) throw stored.error;
      setStatus('Verifying and indexing your reference...');
      const completed = await fetch(`${apiBase()}/projects/${projectId}/references/complete`, {
        method: 'POST', headers,
        body: JSON.stringify({ assetId: initiation.assetId, storagePath: initiation.storagePath, fileName: referenceFile.name, mimeType: referenceFile.type, fileSize: referenceFile.size, title: referenceFile.name.replace(/\.[^.]+$/, ''), tags: referenceTags.split(',').map((tag) => tag.trim()).filter(Boolean) }),
      });
      const result = await completed.json().catch(() => null);
      if (!completed.ok || !result?.success) throw new Error(result?.message ?? 'The reference could not be saved.');
      if (!result.duplicate && result.item) setItems((current) => [{ ...result.item, asset: null }, ...current]);
      setActiveTab('templates'); setReferenceFile(null); setReferenceTags('');
      setStatus(result.duplicate ? 'Duplicate found: the existing reference was kept, and the extra upload was removed.' : 'Reference saved to this project library. It can now guide moodboards and renders.');
    } catch (error: any) {
      setStatus(error?.message ?? 'The reference upload could not be completed.');
    } finally { setUploadingReference(false); }
  }

  function emptyState(message: string) {
    return <div style={{ padding: '28px 0', color: '#78716c', fontSize: 14 }}>{message}</div>;
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'end', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1c1917', margin: '0 0 6px' }}>Design Library</h1>
          <p style={{ color: '#78716c', fontSize: 14, margin: 0 }}>Studio references, validated modular templates, and project finishes.</p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 300, border: '1px solid #d6d3d1', borderRadius: 6, background: '#fff', padding: '8px 10px' }}>
          <Search size={16} color="#78716c" />
          <input aria-label="Search design library" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search library" style={{ border: 0, outline: 0, width: '100%', fontSize: 14 }} />
        </label>
      </div>
      <p role="status" style={{ margin: '0 0 16px', color: status.includes('could not') ? '#b45309' : '#78716c', fontSize: 12 }}>{status}</p>

      <Card className="workflow" style={{ marginBottom: 20 }}>
        <CardContent style={{ display: 'flex', alignItems: 'end', gap: 12, flexWrap: 'wrap', padding: 16 }}>
          <div style={{ flex: '1 1 260px' }}>
            <strong style={{ display: 'block', fontSize: 14, color: '#1c1917', marginBottom: 4 }}>Add a project reference</strong>
            <small style={{ color: '#78716c' }}>Images are advisory inspiration; approved plan and scene data stay authoritative.</small>
          </div>
          <label style={{ display: 'grid', gap: 5, fontSize: 12, color: '#57534e' }}>
            Image
            <input aria-label="Reference image" type="file" accept="image/png,image/jpeg,image/webp" disabled={!projectId || uploadingReference} onChange={(event) => setReferenceFile(event.target.files?.[0] ?? null)} />
          </label>
          <label style={{ display: 'grid', gap: 5, fontSize: 12, color: '#57534e' }}>
            Tags
            <input aria-label="Reference tags" value={referenceTags} onChange={(event) => setReferenceTags(event.target.value)} placeholder="tv unit, fluted, warm wood" disabled={!projectId || uploadingReference} style={{ border: '1px solid #d6d3d1', borderRadius: 6, padding: '8px 10px', fontSize: 13 }} />
          </label>
          <button type="button" onClick={() => void uploadReference()} disabled={!projectId || !referenceFile || uploadingReference} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 0, borderRadius: 6, padding: '9px 12px', background: !projectId || !referenceFile || uploadingReference ? '#d6d3d1' : '#3d2a1a', color: '#fff', fontWeight: 700, cursor: !projectId || !referenceFile || uploadingReference ? 'not-allowed' : 'pointer' }}>
            <Upload size={15} /> {uploadingReference ? 'Adding...' : 'Add to library'}
          </button>
        </CardContent>
      </Card>

      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e7e5e4', marginBottom: 24 }}>
        {([
          ['templates', 'Studio References', BookOpen, visibleTemplates.length],
          ['modules', 'Modular Templates', LibraryIcon, visibleModules.length],
          ['materials', 'Project Materials', Palette, visibleMaterials.length],
        ] as const).map(([id, label, Icon, count]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', fontSize: 14, fontWeight: 700, color: activeTab === id ? '#3d2a1a' : '#78716c', borderBottom: activeTab === id ? '2px solid #3d2a1a' : '2px solid transparent', background: 'none', borderTop: 0, borderLeft: 0, borderRight: 0, cursor: 'pointer' }}>
            <Icon size={16} /> {label} <span style={{ color: '#a8a29e', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
          </button>
        ))}
      </div>

      {activeTab === 'templates' && <Card className="workflow">
        <CardHeader className="section-title"><div><small>STUDIO REFERENCES</small><h2>Approved references and reusable compositions</h2></div><Badge tone="neutral">{visibleTemplates.length} saved</Badge></CardHeader>
        <CardContent>{visibleTemplates.length ? <div className="library-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>{visibleTemplates.map((item) => <article key={item.id} className="library-item" style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 8, overflow: 'hidden' }}>{item.metadata.previewUrl ? <img src={item.metadata.previewUrl} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} /> : <div style={{ background: '#f5f5f4', height: 140, display: 'grid', placeItems: 'center' }}><BookOpen size={28} color="#a8a29e" /></div>}<div style={{ padding: 14 }}><strong style={{ display: 'block', fontSize: 14, color: '#1c1917' }}>{item.title}</strong><span style={{ fontSize: 12, color: '#78716c' }}>{item.kind}</span><small style={{ display: 'block', marginTop: 6, fontSize: 11, color: '#78716c' }}>{item.tags.join(' · ') || item.notes || 'No tags added'}</small></div></article>)}</div> : emptyState('No studio references are saved yet. Add approved project images or compositions to create a reusable reference library.')}</CardContent>
      </Card>}

      {activeTab === 'modules' && <Card className="workflow">
        <CardHeader className="section-title"><div><small>PARAMETRIC MODULES</small><h2>Manufacturing-aware modular furniture templates</h2></div><Badge tone="success">{visibleModules.filter((module) => module.production.cutlistSupported).length} cutlist-ready</Badge></CardHeader>
        <CardContent>{visibleModules.length ? <div className="library-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>{visibleModules.map((module) => <article key={module.id} className="library-item" style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 8, padding: 16 }}><div style={{ background: '#f5f5f4', borderRadius: 6, height: 96, display: 'grid', placeItems: 'center', marginBottom: 12 }}><LibraryIcon size={28} color="#a8a29e" /></div><strong style={{ display: 'block', fontSize: 14, color: '#1c1917' }}>{module.name}</strong><span style={{ fontSize: 12, color: '#78716c' }}>{module.family.replaceAll('-', ' ')}</span><small style={{ display: 'block', marginTop: 6, fontSize: 11, color: '#78716c' }}>{module.widthMm}W × {module.depthMm}D × {module.heightMm}H mm</small><small style={{ display: 'block', marginTop: 4, fontSize: 11, color: '#a8a29e' }}>{module.sku} · {module.roomTypes.join(', ')}</small></article>)}</div> : emptyState('The modular catalog is unavailable. Check the API health and catalog route before placing modules.')}</CardContent>
      </Card>}

      {activeTab === 'materials' && <Card className="workflow">
        <CardHeader className="section-title"><div><small>PROJECT MATERIALS</small><h2>Persisted finishes and hardware for this project</h2></div><Badge tone="neutral">{visibleMaterials.length} saved</Badge></CardHeader>
        <CardContent>{!projectId ? emptyState('Open this library from a project to see its persisted material library.') : visibleMaterials.length ? <div className="library-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>{visibleMaterials.map((material) => <article key={material.id} className="library-item" style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 8, padding: 16 }}><div style={{ background: '#f5f5f4', borderRadius: 6, height: 96, display: 'grid', placeItems: 'center', marginBottom: 12 }}><Palette size={28} color="#a8a29e" /></div><strong style={{ display: 'block', fontSize: 14, color: '#1c1917' }}>{material.name}</strong><span style={{ fontSize: 12, color: '#78716c' }}>{materialSubtitle(material) || 'Finish details pending'}</span><small style={{ display: 'block', marginTop: 6, fontSize: 11, color: '#a8a29e' }}>Code: {material.code}</small></article>)}</div> : emptyState('No materials are saved for this project. Add a finish through Design Studio to create a versioned material assignment.')}</CardContent>
      </Card>}
    </div>
  );
}

export { UnifiedDesignLibraryWorkspace as ReferenceLibraryWorkspace };
