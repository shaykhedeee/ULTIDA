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

export function MaterialSwapPanel({ entityId, projectId, moduleInstanceId, semanticSlot = 'shutter', currentLaminate = 'Unknown', onConfirmCatalogSwap, onPreviewCatalogSwap }: Props) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialId, setMaterialId] = useState('');
  const [targetSlot, setTargetSlot] = useState<MaterialSlot>(semanticSlot);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => setTargetSlot(semanticSlot), [semanticSlot]);
  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const session = await supabase?.auth.getSession();
        const token = session?.data.session?.access_token;
        const response = await fetch(`${apiBase}/projects/${projectId}/material-library`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const payload = await response.json();
        if (!active) return;
        if (!response.ok) return;
        let next = Array.isArray(payload.materials) ? payload.materials as Material[] : [];
        if (!next.length) {
          const starter = await fetch(`${apiBase}/projects/${projectId}/material-library/starter`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });
          const starterPayload = await starter.json().catch(() => null);
          if (!starter.ok || !Array.isArray(starterPayload?.materials)) throw new Error('The organization material library could not be initialized.');
          next = starterPayload.materials as Material[];
        }
        setMaterials(next);
        const firstLaminate = next.find((item) => item.category === 'laminate') ?? next[0];
        setMaterialId((current) => next.some((item) => item.id === current) ? current : firstLaminate?.id || '');
      } catch { if (active) setMessage('Material library is unavailable. No finish change can be saved until it loads.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [projectId]);

  const laminates = useMemo(() => {
    return materials.filter((item) => item.category === 'laminate');
  }, [materials]);
  const selected = materials.find((item) => item.id === materialId);
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
      <div className="material-swap-heading"><Layers3 size={15} /><div><h4>Targeted laminate swap</h4><small>The approved room, catalog swatch, measured edges, and selected-module region guide the visual revision. The saved scene assignment remains the construction authority.</small></div></div>
      <span className="material-slot-label">Apply to this component group</span>
      <div className="material-slot-grid">{slots.map((slot) => <button key={slot.id} type="button" className={targetSlot === slot.id ? 'active' : ''} disabled={pending} onClick={() => setTargetSlot(slot.id)}>{slot.label}</button>)}</div>
      <span className="material-slot-label">Laminate palette</span>
      <div className="laminate-swatch-grid">
        {laminates.map((material) => <button key={material.id} type="button" aria-pressed={materialId === material.id} className={materialId === material.id ? 'selected' : ''} disabled={pending || loading} onClick={() => setMaterialId(material.id)}>
          <span className="laminate-swatch" style={{ background: materialColor(material) }} />
          <span>{material.name}</span><small>{material.brand ?? material.supplier ?? 'Studio'} · {material.thickness_mm ?? '—'} mm</small>
        </button>)}
      </div>
      {!loading && !laminates.length && <p role="status">No saved laminate is available yet. The organization starter library must finish loading before a finish can be changed.</p>}
      {selected && <div className="laminate-spec"><CheckCircle2 size={14} /><span><strong>{selected.name}</strong> · {selected.finish ?? 'finish to confirm'} · {selected.thickness_mm ?? '—'} mm laminate · {selected.metadata?.edgeBand?.thicknessMm ?? '—'} mm {selected.metadata?.edgeBand?.material ?? 'edge band'} · grain {selected.grain_direction ?? 'none'}</span></div>}
      <div className="material-swap-actions">
        <button type="button" disabled={pending || loading || !projectId || !selected || !moduleInstanceId} onClick={() => void applyCatalogSwap()}><RefreshCcw size={14} /> {pending ? 'Saving…' : 'Save component material'}</button>
        <button type="button" className="primary" disabled={pending || loading || !projectId || !selected || !moduleInstanceId} onClick={() => void applyCatalogSwap(true)}><Wand2 size={14} /> {pending ? 'Preparing…' : 'Generate QA-reviewed preview'}</button>
      </div>
      <p role="status">{message || `Current visual label: ${currentLaminate}`}</p>
    </div>
  </div>;
}

export default MaterialSwapPanel;
