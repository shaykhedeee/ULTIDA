import { ImagePlus, Search, Upload, BookOpen, Library as LibraryIcon, Palette } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader } from '../ui/primitives';
import { supabase } from '../../lib/supabase';

type LibraryItem = { id: string; title: string; kind: string; tags: string[]; notes: string; source: string; asset_id: string | null; metadata: { previewUrl?: string }; asset?: { storage_path: string; mime_type: string } | null };

export function UnifiedDesignLibraryWorkspace({ organizationId, projectId }: { organizationId?: string | null; projectId?: string | null }) {
  const [activeTab, setActiveTab] = useState<'templates' | 'modules' | 'materials'>('templates');
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Design library assets stay linked to studio projects.');

  async function load() {
    if (!supabase || !organizationId) return;
    const result = await supabase.from('reference_library_items').select('id,title,kind,tags,notes,source,asset_id,metadata,asset:project_assets(storage_path,mime_type)').eq('organization_id', organizationId).order('created_at', { ascending: false });
    if (result.error) return setStatus(result.error.message);
    const client = supabase;
    const withUrls = await Promise.all(((result.data ?? []) as unknown as Array<LibraryItem & { asset?: Array<{ storage_path: string; mime_type: string }> }>).map(async (raw) => {
      const item = { ...raw, asset: raw.asset?.[0] ?? null } as LibraryItem;
      if (!item.asset?.storage_path || !item.asset.mime_type.startsWith('image/')) return item;
      const signed = await client.storage.from('project-assets').createSignedUrl(item.asset.storage_path, 3600);
      return { ...item, metadata: { ...item.metadata, previewUrl: signed.data?.signedUrl } };
    }));
    setItems(withUrls);
  }
  useEffect(() => { void load(); }, [organizationId]);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1c1917', margin: '0 0 6px' }}>Design Library</h1>
        <p style={{ color: '#78716c', fontSize: 14, margin: 0 }}>Unified catalog for studio templates, modular furniture, and material finishes.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e7e5e4', marginBottom: 28 }}>
        <button
          onClick={() => setActiveTab('templates')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', fontSize: 14, fontWeight: 700,
            color: activeTab === 'templates' ? '#3d2a1a' : '#78716c',
            borderBottom: activeTab === 'templates' ? '2px solid #3d2a1a' : '2px solid transparent',
            background: 'none', borderTop: 0, borderLeft: 0, borderRight: 0, cursor: 'pointer'
          }}
        >
          <BookOpen size={16} /> Templates
        </button>
        <button
          onClick={() => setActiveTab('modules')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', fontSize: 14, fontWeight: 700,
            color: activeTab === 'modules' ? '#3d2a1a' : '#78716c',
            borderBottom: activeTab === 'modules' ? '2px solid #3d2a1a' : '2px solid transparent',
            background: 'none', borderTop: 0, borderLeft: 0, borderRight: 0, cursor: 'pointer'
          }}
        >
          <LibraryIcon size={16} /> Module Library
        </button>
        <button
          onClick={() => setActiveTab('materials')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', fontSize: 14, fontWeight: 700,
            color: activeTab === 'materials' ? '#3d2a1a' : '#78716c',
            borderBottom: activeTab === 'materials' ? '2px solid #3d2a1a' : '2px solid transparent',
            background: 'none', borderTop: 0, borderLeft: 0, borderRight: 0, cursor: 'pointer'
          }}
        >
          <Palette size={16} /> Material Library
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'templates' && (
        <Card className="workflow">
          <CardHeader className="section-title">
            <div>
              <small>TEMPLATES</small>
              <h2>Standard Room Layout Templates</h2>
            </div>
            <Badge tone="success">12 Ready Templates</Badge>
          </CardHeader>
          <CardContent>
            <p>Reusable design templates for standard room configurations — living rooms, bedrooms, kitchens, and pooja rooms.</p>
            <div className="library-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginTop: 16 }}>
              {[
                { title: 'L-Shaped Premium Kitchen', type: 'Kitchen', tag: '3000mm x 2400mm' },
                { title: 'Parallel Chef Kitchen', type: 'Kitchen', tag: '3600mm Parallel' },
                { title: 'Modern Living TV Console & Fluted Panel', type: 'Living', tag: '2400mm Wall' },
                { title: 'Master Bedroom Wardrobe + Dressing', type: 'Bedroom', tag: 'Full Height Sliding' },
                { title: 'Compact Pooja Unit with CNC Jaali', type: 'Pooja', tag: '1200mm Wall Unit' }
              ].map((tpl, i) => (
                <article key={i} className="library-item" style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 10, padding: 16 }}>
                  <div className="library-thumb" style={{ background: '#f5f5f4', borderRadius: 8, height: 120, display: 'grid', placeItems: 'center', marginBottom: 12 }}>
                    <BookOpen size={28} style={{ color: '#a8a29e' }} />
                  </div>
                  <strong style={{ display: 'block', fontSize: 14, color: '#1c1917' }}>{tpl.title}</strong>
                  <span style={{ fontSize: 12, color: '#78716c' }}>{tpl.type}</span>
                  <small style={{ display: 'block', marginTop: 6, fontSize: 11, color: '#a8a29e' }}>{tpl.tag}</small>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'modules' && (
        <Card className="workflow">
          <CardHeader className="section-title">
            <div>
              <small>MODULE LIBRARY</small>
              <h2>Parametric Modular Furniture Catalog</h2>
            </div>
            <Badge tone="success">34 Active Modules</Badge>
          </CardHeader>
          <CardContent>
            <p>Parametric modular units: TV units, wardrobes, kitchens, crockery units, pooja units, study units, and beds.</p>
            <div className="library-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginTop: 16 }}>
              {[
                { title: 'Base 2-Drawer Cabinet', cat: 'Kitchen', dim: 'W:600 D:560 H:870' },
                { title: 'Overhead Fluted Glass Unit', cat: 'Kitchen', dim: 'W:900 D:350 H:720' },
                { title: 'Floated TV Unit with Backing Flute', cat: 'TV Unit', dim: 'W:1800 D:400 H:450' },
                { title: '3-Door Sliding Wardrobe with Loft', cat: 'Wardrobe', dim: 'W:2400 D:600 H:2700' },
                { title: 'Crockery Unit with Profile LED Lighting', cat: 'Dining', dim: 'W:1200 D:450 H:2100' }
              ].map((mod, i) => (
                <article key={i} className="library-item" style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 10, padding: 16 }}>
                  <div className="library-thumb" style={{ background: '#f5f5f4', borderRadius: 8, height: 120, display: 'grid', placeItems: 'center', marginBottom: 12 }}>
                    <LibraryIcon size={28} style={{ color: '#a8a29e' }} />
                  </div>
                  <strong style={{ display: 'block', fontSize: 14, color: '#1c1917' }}>{mod.title}</strong>
                  <span style={{ fontSize: 12, color: '#78716c' }}>{mod.cat}</span>
                  <small style={{ display: 'block', marginTop: 6, fontSize: 11, color: '#a8a29e' }}>{mod.dim}</small>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'materials' && (
        <Card className="workflow">
          <CardHeader className="section-title">
            <div>
              <small>MATERIAL LIBRARY</small>
              <h2>Finishes, Laminates & Hardware Library</h2>
            </div>
            <Badge tone="success">48 Swatches</Badge>
          </CardHeader>
          <CardContent>
            <p>Studio material library with textures, laminates, acrylics, veneer finishes, hardware brands, cost, and availability.</p>
            <div className="library-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginTop: 16 }}>
              {[
                { title: 'Warm Walnut Natural Wood Veneer', type: 'Veneer', code: 'VEN-WAL-01' },
                { title: 'Matte Charcoal Grey Anti-Fingerprint', type: 'Acrylic', code: 'ACR-CG-04' },
                { title: 'Calacatta Gold Marble Quartz', type: 'Countertop', code: 'QTZ-CAL-02' },
                { title: 'Champagne Gold Fluted Aluminium Profile', type: 'Hardware', code: 'PRF-GLD-09' },
                { title: 'Oak Wood Grain Suede Finish Laminate', type: 'Laminate', code: 'LAM-OAK-12' }
              ].map((mat, i) => (
                <article key={i} className="library-item" style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 10, padding: 16 }}>
                  <div className="library-thumb" style={{ background: '#f5f5f4', borderRadius: 8, height: 120, display: 'grid', placeItems: 'center', marginBottom: 12 }}>
                    <Palette size={28} style={{ color: '#a8a29e' }} />
                  </div>
                  <strong style={{ display: 'block', fontSize: 14, color: '#1c1917' }}>{mat.title}</strong>
                  <span style={{ fontSize: 12, color: '#78716c' }}>{mat.type}</span>
                  <small style={{ display: 'block', marginTop: 6, fontSize: 11, color: '#a8a29e' }}>Code: {mat.code}</small>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export { UnifiedDesignLibraryWorkspace as ReferenceLibraryWorkspace };
