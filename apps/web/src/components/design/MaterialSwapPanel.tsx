import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Layers3, RefreshCcw, Wand2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getApiBase } from '../../lib/api-base';

type MaterialSlot = 'carcass' | 'shutter' | 'back_panel' | 'countertop' | 'profile' | 'glass' | 'hardware' | 'flooring' | 'wall' | 'ceiling' | 'lighting';
type Material = {
  id: string; name: string; code: string; category: string; finish?: string | null; availability?: string;
  supplier?: string | null; brand?: string | null; thickness_mm?: number | null; grain_direction?: string | null;
  metadata?: { colourHex?: string; colorHex?: string; edgeBand?: { thicknessMm?: number; material?: string; status?: string } };
};

type Props = {
  entityId: string; projectId?: string | null; moduleInstanceId?: string | null; semanticSlot?: MaterialSlot; currentLaminate?: string;
  onConfirmCatalogSwap?: (payload: { entityId: string; laminate: string; materialId: string; semanticSlot: MaterialSlot }) => void;
  onPreviewCatalogSwap?: (payload: { entityId: string; materialId: string; laminate: string; semanticSlot: MaterialSlot }) => Promise<void> | void;
};

const apiBase = getApiBase();
const slots: Array<{ id: MaterialSlot; label: string }> = [
  { id: 'shutter', label: 'Shutters' }, { id: 'carcass', label: 'Carcass' }, { id: 'back_panel', label: 'Back panel' },
  { id: 'countertop', label: 'Countertop' }, { id: 'profile', label: 'Profile' }, { id: 'glass', label: 'Glass' },
];
const defaultSwatch = '#b6a28d';
const materialColor = (material: Material) => material.metadata?.colourHex ?? material.metadata?.colorHex ?? defaultSwatch;

const DEFAULT_MINIMAL_LAMINATES: Material[] = [
  { id: 'mat-gloss-1', name: 'Mirror High-Gloss Pure White Acrylic', code: 'ROY-HG-WHT', category: 'laminate', finish: 'High-Gloss Acrylic', thickness_mm: 1.2, supplier: 'Royale Touche', metadata: { colorHex: '#FFFFFF' } },
  { id: 'mat-gloss-2', name: 'Ultra High-Gloss Cashmere Acrylic', code: 'ROY-HG-CSH', category: 'laminate', finish: 'Ultra-Gloss Acrylic', thickness_mm: 1.0, supplier: 'Royale Touche', metadata: { colorHex: '#E3DAC9' } },
  { id: 'mat-matte-1', name: 'Zero-G Anti-Fingerprint Sandstone Matte', code: 'MER-ZG-SND', category: 'laminate', finish: 'Soft-Touch Matte', thickness_mm: 1.0, supplier: 'Merino', metadata: { colorHex: '#C9B59B' } },
  { id: 'mat-matte-2', name: 'Deep Nero Ingo Super-Matte', code: 'FNX-SM-NERO', category: 'laminate', finish: 'Super-Matte', thickness_mm: 1.0, supplier: 'Fenix NTM', metadata: { colorHex: '#18181B' } },
  { id: 'mat-wood-1', name: 'Smoked Crown Walnut Veneer', code: 'CBX-WG-WLN', category: 'laminate', finish: 'Natural Grain', thickness_mm: 1.0, supplier: 'Cubex', metadata: { colorHex: '#654230' } },
  { id: 'mat-wood-2', name: 'Natural Dune Oak Textured', code: 'VRG-WG-OAK', category: 'laminate', finish: 'Textured Woodgrain', thickness_mm: 0.8, supplier: 'Virgo', metadata: { colorHex: '#A77B5B' } },
];

export function MaterialSwapPanel({ entityId, projectId, moduleInstanceId, semanticSlot = 'shutter', currentLaminate = 'Unknown', onConfirmCatalogSwap, onPreviewCatalogSwap }: Props) {
  const [materials, setMaterials] = useState<Material[]>(DEFAULT_MINIMAL_LAMINATES);
  const [materialId, setMaterialId] = useState(DEFAULT_MINIMAL_LAMINATES[0].id);
  const [targetSlot, setTargetSlot] = useState<MaterialSlot>(semanticSlot);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => setTargetSlot(semanticSlot), [semanticSlot]);
  useEffect(() => {
    if (!projectId) return;
    let active = true;
    void (async () => {
      try {
        const session = await supabase?.auth.getSession();
        const token = session?.data.session?.access_token;
        const response = await fetch(`${apiBase}/projects/${projectId}/material-library`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const payload = await response.json();
        if (!active) return;
        if (!response.ok) return;
        const next = Array.isArray(payload.materials) && payload.materials.length ? payload.materials as Material[] : DEFAULT_MINIMAL_LAMINATES;
        setMaterials(next);
        const firstLaminate = next.find((item) => item.category === 'laminate') ?? next[0];
        setMaterialId((current) => current || firstLaminate?.id || '');
      } catch { /* use default minimal */ }
    })();
    return () => { active = false; };
  }, [projectId]);

  const laminates = useMemo(() => {
    const list = materials.filter((item) => item.category === 'laminate');
    return list.length ? list : DEFAULT_MINIMAL_LAMINATES;
  }, [materials]);
  const selected = materials.find((item) => item.id === materialId) ?? DEFAULT_MINIMAL_LAMINATES.find((item) => item.id === materialId) ?? DEFAULT_MINIMAL_LAMINATES[0];
  if (!entityId) return <div className="material-swap-panel"><p>Select an exact placed module before changing a laminate.</p></div>;

  const applyCatalogSwap = async (preview = false) => {
    if (!projectId || !selected || !moduleInstanceId) { setMessage('Select a placed module and saved laminate before continuing.'); return; }
    setPending(true); setMessage('Saving the versioned component material assignment…');
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data.session?.access_token;
      const response = await fetch(`${apiBase}/projects/${projectId}/material-assignments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ materialId: selected.id, moduleInstanceId, targetKind: 'module', targetId: moduleInstanceId, semanticSlot: targetSlot, status: 'draft' })
      });
      const payload = await response.json();
      if (!response.ok) { setMessage(payload.message ?? 'Material assignment was not saved.'); return; }
      onConfirmCatalogSwap?.({ entityId, laminate: selected.name, materialId: selected.id, semanticSlot: targetSlot });
      if (preview) {
        setMessage(`${selected.name} saved. Compiling a scene-locked preview for the selected ${targetSlot.replace('_', ' ')}…`);
        await onPreviewCatalogSwap?.({ entityId, materialId: selected.id, laminate: selected.name, semanticSlot: targetSlot });
      } else setMessage(`${selected.name} saved on ${targetSlot.replace('_', ' ')}. Preview is ready when the scene is compiled.`);
    } catch { setMessage('Material assignment request failed. No material was changed.'); }
    finally { setPending(false); }
  };

  return <div className="material-swap-panel">
    <div className="material-section">
      <div className="material-swap-heading"><Layers3 size={15} /><div><h4>Targeted laminate swap</h4><small>Only the chosen module mask is sent for editing. Room geometry remains locked.</small></div></div>
      <span className="material-slot-label">Apply to this component group</span>
      <div className="material-slot-grid">{slots.map((slot) => <button key={slot.id} type="button" className={targetSlot === slot.id ? 'active' : ''} disabled={pending} onClick={() => setTargetSlot(slot.id)}>{slot.label}</button>)}</div>
      <span className="material-slot-label">Laminate palette</span>
      <div className="laminate-swatch-grid">
        {(laminates.length ? laminates : materials).map((material) => <button key={material.id} type="button" aria-pressed={materialId === material.id} className={materialId === material.id ? 'selected' : ''} disabled={pending} onClick={() => setMaterialId(material.id)}>
          <span className="laminate-swatch" style={{ background: materialColor(material) }} />
          <span>{material.name}</span><small>{material.brand ?? material.supplier ?? 'Studio'} · {material.thickness_mm ?? '—'} mm</small>
        </button>)}
      </div>
      {selected && <div className="laminate-spec"><CheckCircle2 size={14} /><span><strong>{selected.name}</strong> · {selected.finish ?? 'finish to confirm'} · {selected.thickness_mm ?? '—'} mm laminate · {selected.metadata?.edgeBand?.thicknessMm ?? '—'} mm {selected.metadata?.edgeBand?.material ?? 'edge band'} · grain {selected.grain_direction ?? 'none'}</span></div>}
      <div className="material-swap-actions">
        <button type="button" disabled={pending || !projectId || !selected || !moduleInstanceId} onClick={() => void applyCatalogSwap()}><RefreshCcw size={14} /> {pending ? 'Saving…' : 'Save component material'}</button>
        <button type="button" className="primary" disabled={pending || !projectId || !selected || !moduleInstanceId} onClick={() => void applyCatalogSwap(true)}><Wand2 size={14} /> {pending ? 'Preparing…' : 'Generate locked preview'}</button>
      </div>
      <p role="status">{message || `Current visual label: ${currentLaminate}`}</p>
    </div>
  </div>;
}

export default MaterialSwapPanel;
