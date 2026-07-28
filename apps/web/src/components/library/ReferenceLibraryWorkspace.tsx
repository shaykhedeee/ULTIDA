import { BookOpen, Library as LibraryIcon, Palette, Search } from 'lucide-react';
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
  return import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
}

function materialSubtitle(material: Material) {
  return [material.category, material.finish, material.supplier, material.availability]
    .filter(Boolean)
    .join(' · ');
}

export function UnifiedDesignLibraryWorkspace({ organizationId, projectId }: { organizationId?: string | null; projectId?: string | null }) {
  const [activeTab, setActiveTab] = useState<'templates' | 'modules' | 'materials'>('templates');
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [modules, setModules] = useState<CatalogModule[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Loading studio library…');

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
          if (live) setModules(Array.isArray(payload?.modules) ? payload.modules : []);
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
      setStatus(failures.length
        ? `${failures.length} library source${failures.length === 1 ? '' : 's'} could not be loaded. ${failures[0]?.reason instanceof Error ? failures[0].reason.message : ''}`
        : 'Library data is connected to the current studio and project.');
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
