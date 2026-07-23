import React, { useState } from 'react';
import { RefreshCcw, Wand2 } from 'lucide-react';

type Props = {
  entityId: string;
  currentLaminate?: string;
  onConfirmCatalogSwap?: (payload: { entityId: string; laminate: string }) => void;
  onConfirmAiProposal?: (payload: { entityId: string; prompt: string; negativePrompt?: string }) => void;
};

export function MaterialSwapPanel({ entityId, currentLaminate = 'Unknown', onConfirmCatalogSwap, onConfirmAiProposal }: Props) {
  const [laminate, setLaminate] = useState(currentLaminate);
  const [prompt, setPrompt] = useState(`Warm contemporary Indian interior for ${entityId}. Natural materials, soft shadows.`);
  const [negative, setNegative] = useState('blurry, distorted, watermark');
  const [pending, setPending] = useState(false);

  if (!entityId) return <div className="material-swap-panel"><p>Select a module, wall or opening to swap materials.</p></div>;

  return (
    <div className="material-swap-panel">
      <div className="material-section">
        <h4>Catalog swap</h4>
        <label>
          Laminate / material
          <input value={laminate} onChange={(event) => setLaminate(event.target.value)} />
        </label>
        <button
          type="button"
          disabled={pending || !laminate.trim()}
          onClick={() => {
            setPending(true);
            onConfirmCatalogSwap?.({ entityId, laminate: laminate.trim() });
            setPending(false);
          }}
        >
          <RefreshCcw size={14} /> Apply catalog swap
        </button>
      </div>
      <div className="material-section">
        <h4>AI proposal</h4>
        <label>
          Prompt
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        </label>
        <label>
          Negative prompt
          <textarea value={negative} onChange={(event) => setNegative(event.target.value)} />
        </label>
        <button
          type="button"
          disabled={pending || !prompt.trim()}
          onClick={() => {
            setPending(true);
            onConfirmAiProposal?.({ entityId, prompt: prompt.trim(), negativePrompt: negative.trim() || undefined });
            setPending(false);
          }}
        >
          <Wand2 size={14} /> Request AI proposal
        </button>
      </div>
    </div>
  );
}

export default MaterialSwapPanel;
