/**
 * packages/ui/src/ProvenanceBadge.tsx
 *
 * This is the single most important UI component for ULTIDA's positioning.
 * ARCHITECTURE.md invariant #5 says "Provider failures are visible and never
 * replaced with unrelated stock media" and #4 says "AI outputs are synthetic
 * proposals and cannot update dimensions" -- but an invariant in a doc is
 * invisible to a customer. This badge is that invariant, made visible.
 *
 * Attach it to: every render card, every elevation/DXF preview, every
 * cutlist/BOM line derived from a scene, every client-facing document header.
 *
 * Usage:
 *   <ProvenanceBadge
 *     sceneVersionId={render.sceneVersionId}
 *     state={render.approvedAt ? 'approved' : 'synthetic'}
 *     provider={render.provider}
 *     model={render.model}
 *     generatedAt={render.createdAt}
 *   />
 *
 * If you don't have all these fields wired from the backend yet, that's a
 * real gap to fix, not a reason to omit the badge -- ship it in an
 * "unreviewed" state rather than not at all, so the absence of data is
 * itself visible instead of silently missing.
 */
import * as React from 'react';

export type ProvenanceState = 'synthetic' | 'approved' | 'stale' | 'unreviewed';

export interface ProvenanceBadgeProps {
  sceneVersionId?: string | null;
  state: ProvenanceState;
  provider?: string | null;
  model?: string | null;
  generatedAt?: string | null;
  /** Compact mode for dense list views (e.g. cutlist rows) vs. full mode for render cards. */
  variant?: 'full' | 'compact';
}

const STATE_LABEL: Record<ProvenanceState, string> = {
  synthetic: 'AI proposal — not approved',
  approved: 'Approved — in design package',
  stale: 'Stale — source changed since generation',
  unreviewed: 'Unreviewed default',
};

// Maps to the state.* colors in tokens.ts. Import from there once wired in;
// inlined here so this file works standalone before that's connected.
const STATE_COLOR: Record<ProvenanceState, string> = {
  synthetic: '#B8860B',
  approved: '#3E8E5A',
  stale: '#8A3B3B',
  unreviewed: '#6B6963',
};

export function ProvenanceBadge({
  sceneVersionId,
  state,
  provider,
  model,
  generatedAt,
  variant = 'full',
}: ProvenanceBadgeProps) {
  const color = STATE_COLOR[state];
  const label = STATE_LABEL[state];

  if (variant === 'compact') {
    return (
      <span
        title={`${label}${sceneVersionId ? ` · scene ${sceneVersionId.slice(0, 8)}` : ''}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11, padding: '2px 8px', borderRadius: 9999,
          border: `1px solid ${color}55`, color, background: `${color}14`,
        }}
      >
        <Dot color={color} />
        {state === 'approved' ? 'Approved' : state === 'synthetic' ? 'AI proposal' : state === 'stale' ? 'Stale' : 'Unreviewed'}
      </span>
    );
  }

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 2,
        fontSize: 12, padding: '8px 12px', borderRadius: 10,
        border: `1px solid ${color}55`, background: `${color}0F`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color, fontWeight: 600 }}>
        <Dot color={color} />
        {label}
      </div>
      <div style={{ color: '#A8A6A0', fontSize: 11, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {sceneVersionId && <span>scene {sceneVersionId.slice(0, 8)}</span>}
        {provider && <span>{provider}{model ? ` · ${model}` : ''}</span>}
        {generatedAt && <span>{new Date(generatedAt).toLocaleString()}</span>}
      </div>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{ width: 6, height: 6, borderRadius: 9999, background: color, display: 'inline-block' }}
    />
  );
}
