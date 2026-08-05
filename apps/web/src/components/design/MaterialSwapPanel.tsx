import React, { useEffect, useState } from 'react';
import { RefreshCcw, Wand2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Material = { id: string; name: string; code: string; category: string; finish?: string | null; availability?: string };

type Props = {
  entityId: string;
  projectId?: string | null;
  moduleInstanceId?: string | null;
  semanticSlot?: 'carcass' | 'shutter' | 'back_panel' | 'countertop' | 'profile' | 'glass' | 'hardware' | 'flooring' | 'wall' | 'ceiling' | 'lighting';
  currentLaminate?: string;
  onConfirmCatalogSwap?: (payload: { entityId: string; laminate: string }) => void;
  onPreviewCatalogSwap?: (payload: { entityId: string; materialId: string; laminate: string }) => Promise<void> | void;
  onConfirmAiProposal?: (payload: { entityId: string; prompt: string; negativePrompt?: string }) => void;
};

const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';

export function MaterialSwapPanel({ entityId, projectId, moduleInstanceId, semanticSlot = 'shutter', currentLaminate = 'Unknown', onConfirmCatalogSwap, onPreviewCatalogSwap, onConfirmAiProposal }: Props) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialId, setMaterialId] = useState('');
  const [prompt, setPrompt] = useState(`Warm contemporary Indian interior for ${entityId}. Natural materials, soft shadows.`);
  const [negative, setNegative] = useState('blurry, distorted, watermark');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(projectId ? 'Loading organization material library...' : 'Select a project to use the material library.');

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
        if (!response.ok) {
          setMaterials([]);
          setMessage(payload.message ?? 'Material library is unavailable.');
          return;
        }
        const next = Array.isArray(payload.materials) ? payload.materials : [];
        setMaterials(next);
        setMaterialId((current) => current || next[0]?.id || '');
        setMessage(next.length ? '' : 'No approved materials exist in this organization library yet.');
      } catch {
        if (active) setMessage('Material library request failed. No material was changed.');
      }
    })();
    return () => { active = false; };
  }, [projectId]);

  if (!entityId) return <div className="material-swap-panel"><p>Select a module, wall or opening to swap materials.</p></div>;

  const selected = materials.find((item) => item.id === materialId);
  const applyCatalogSwap = async (preview = false) => {
    if (!projectId || !selected) return;
    setPending(true);
    setMessage('Saving a versioned material assignment...');
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data.session?.access_token;
      const response = await fetch(`${apiBase}/projects/${projectId}/material-assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ materialId: selected.id, moduleInstanceId: moduleInstanceId ?? null, targetKind: moduleInstanceId ? 'module' : 'semantic_slot', targetId: moduleInstanceId ?? entityId, semanticSlot, status: 'draft' })
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.message ?? 'Material assignment was not saved.');
        return;
      }
      onConfirmCatalogSwap?.({ entityId, laminate: selected.name });
      if (preview) {
        setMessage(`${selected.name} saved. Starting a scene-locked material preview...`);
        await onPreviewCatalogSwap?.({ entityId, materialId: selected.id, laminate: selected.name });
      } else {
        setMessage(`${selected.name} saved. The assignment is ready for a scene-locked preview.`);
      }
    } catch {
      setMessage('Material assignment request failed. No material was changed.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="material-swap-panel">
      <div className="material-section">
        <h4>Material library</h4>
        <label>
          Laminate / material
          <select value={materialId} onChange={(event) => setMaterialId(event.target.value)} disabled={pending || !materials.length}>
            {!materials.length && <option value="">No library materials</option>}
            {materials.map((material) => <option key={material.id} value={material.id}>{material.name} ({material.code})</option>)}
          </select>
        </label>
        {selected && <small>{selected.category}{selected.finish ? ` · ${selected.finish}` : ''}{selected.availability ? ` · ${selected.availability}` : ''}</small>}
        <button type="button" disabled={pending || !projectId || !selected} onClick={() => void applyCatalogSwap()}>
          <RefreshCcw size={14} /> {pending ? 'Saving assignment...' : 'Apply saved material'}
        </button>
        <button type="button" disabled={pending || !projectId || !selected} onClick={() => void applyCatalogSwap(true)}>
          <Wand2 size={14} /> {pending ? 'Preparing preview...' : 'Apply and preview in render'}
        </button>
        <p role="status">{message || `Current visual label: ${currentLaminate}`}</p>
      </div>
      <div className="material-section">
        <h4>AI proposal</h4>
        <label>Prompt<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label>
        <label>Negative prompt<textarea value={negative} onChange={(event) => setNegative(event.target.value)} /></label>
        <button type="button" disabled={pending || !prompt.trim()} onClick={() => onConfirmAiProposal?.({ entityId, prompt: prompt.trim(), negativePrompt: negative.trim() || undefined })}>
          <Wand2 size={14} /> Request AI proposal
        </button>
      </div>
    </div>
  );
}

export default MaterialSwapPanel;
