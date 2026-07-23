/**
 * apps/web/src/components/design/MaterialSwapPanel.tsx
 *
 * Two distinct swap paths, per DESIGN_PHASE_AND_AURA_OPERATING_MODEL.md's
 * "Laminate and 'anything changer' design":
 *
 *   1. Catalog swap -- deterministic, instant, no AI involved. Directly
 *      updates scene.v1 once confirmed. This is ULTIDA's structural
 *      advantage: no re-render/re-diffusion needed, just a material
 *      reference change on real geometry.
 *
 *   2. AI proposal swap -- text-prompt-driven. MUST return a proposal
 *      requiring explicit confirmation before it touches scene.v1. Never
 *      auto-commit. Label clearly as "visual-only" per the design doc until
 *      it's mapped back to a real catalog SKU.
 *
 * This component does not call your API directly -- it takes callback props
 * so you can wire it to packages/aura-tools / provider-gateway however your
 * actual API client is structured. Replace the `TODO` calls with real ones.
 */
import * as React from 'react';
import { useState } from 'react';
import type { SceneEntity } from './EntityPicker';

export interface CatalogMaterial {
  sku: string;
  label: string;
  thumbnailUrl?: string;
}

export interface MaterialSwapPanelProps {
  entity: SceneEntity;
  catalog: CatalogMaterial[];
  onConfirmCatalogSwap: (entityId: string, sku: string) => Promise<void>;
  onRequestAiProposal: (entityId: string, prompt: string) => Promise<{ proposalId: string; previewUrl: string }>;
  onConfirmAiProposal: (proposalId: string) => Promise<void>;
  onCancel: () => void;
}

export function MaterialSwapPanel({
  entity,
  catalog,
  onConfirmCatalogSwap,
  onRequestAiProposal,
  onConfirmAiProposal,
  onCancel,
}: MaterialSwapPanelProps) {
  const [mode, setMode] = useState<'catalog' | 'ai'>('catalog');
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [proposal, setProposal] = useState<{ proposalId: string; previewUrl: string } | null>(null);

  async function handleCatalogPick(sku: string) {
    setBusy(true);
    try {
      await onConfirmCatalogSwap(entity.id, sku);
      // Catalog swaps are deterministic -- no proposal/preview step needed,
      // scene.v1 updates directly per the design doc.
    } finally {
      setBusy(false);
    }
  }

  async function handleAiRequest() {
    if (!prompt.trim()) return;
    setBusy(true);
    try {
      const result = await onRequestAiProposal(entity.id, prompt.trim());
      setProposal(result);
    } finally {
      setBusy(false);
    }
  }

  async function handleAiConfirm() {
    if (!proposal) return;
    setBusy(true);
    try {
      await onConfirmAiProposal(proposal.proposalId);
      setProposal(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ width: 340, padding: 16, borderRadius: 12, background: '#141417', border: '1px solid #2A2A30', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>Change material — {entity.label}</div>

      <div style={{ display: 'flex', gap: 6 }}>
        <TabButton active={mode === 'catalog'} onClick={() => setMode('catalog')}>Catalog (instant)</TabButton>
        <TabButton active={mode === 'ai'} onClick={() => setMode('ai')}>AI proposal</TabButton>
      </div>

      {mode === 'catalog' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
          {catalog.map(m => (
            <button
              key={m.sku}
              disabled={busy}
              onClick={() => handleCatalogPick(m.sku)}
              style={{
                padding: 8, borderRadius: 8, border: '1px solid #2A2A30',
                background: '#0B0B0D', color: '#F5F3EE', fontSize: 12,
                cursor: busy ? 'default' : 'pointer', textAlign: 'left',
              }}
            >
              {m.label}
              <div style={{ color: '#6B6963', fontSize: 10 }}>{m.sku}</div>
            </button>
          ))}
          {catalog.length === 0 && (
            <div style={{ gridColumn: '1 / -1', color: '#6B6963', fontSize: 12 }}>
              No catalog materials loaded for this material slot type.
            </div>
          )}
        </div>
      )}

      {mode === 'ai' && !proposal && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="e.g. walnut matte laminate with brushed brass handles"
            rows={3}
            style={{ background: '#0B0B0D', border: '1px solid #2A2A30', borderRadius: 8, color: '#F5F3EE', padding: 8, fontSize: 12, resize: 'vertical' }}
          />
          <button
            onClick={handleAiRequest}
            disabled={busy || !prompt.trim()}
            style={{ padding: '8px 12px', borderRadius: 8, background: '#B8860B', color: '#0B0B0D', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: 13 }}
          >
            {busy ? 'Generating proposal…' : 'Generate proposal'}
          </button>
          <div style={{ fontSize: 11, color: '#6B6963' }}>
            This will not change your design until you explicitly confirm the result below.
          </div>
        </div>
      )}

      {mode === 'ai' && proposal && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <img src={proposal.previewUrl} alt="AI material proposal preview" style={{ width: '100%', borderRadius: 8 }} />
          <div style={{ fontSize: 11, color: '#B8860B', fontWeight: 600 }}>
            Visual-only proposal — not yet mapped to a catalog SKU or committed to your design.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleAiConfirm}
              disabled={busy}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: '#3E8E5A', color: '#0B0B0D', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: 13 }}
            >
              Confirm & apply
            </button>
            <button
              onClick={() => setProposal(null)}
              disabled={busy}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: 'transparent', color: '#A8A6A0', border: '1px solid #2A2A30', cursor: 'pointer', fontSize: 13 }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#6B6963', fontSize: 12, cursor: 'pointer', alignSelf: 'flex-start' }}>
        Cancel
      </button>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
        border: active ? '1px solid #C9A84C' : '1px solid #2A2A30',
        background: active ? '#C9A84C14' : 'transparent',
        color: active ? '#C9A84C' : '#A8A6A0',
      }}
    >
      {children}
    </button>
  );
}
