/**
 * apps/web/src/components/design/EntityPicker.tsx
 *
 * Selection panel for the scene "Quick Changer" flow described in
 * ULTIDA-IMPLEMENTATION-PLAN.md. This component is deliberately UI-only and
 * viewport-agnostic: it takes a list of already-resolved scene entities and
 * a selection callback. Wire the actual click/raycast logic in your Three.js
 * or React Three Fiber viewport component, then pass hits into this panel --
 * do not put viewport/rendering code in here, keep this component pure.
 *
 * This is the component that must operate on real scene entity IDs (from
 * scene.v1 / packages/scene-core), NOT on pixel coordinates or image masks.
 * That distinction is the entire point -- see ULTIDA_VS_AGENTB_BUILD_PROMPT.md
 * Part 2.2 for why this matters competitively.
 */
import * as React from 'react';
import { ProvenanceBadge, type ProvenanceState } from '../../../packages/ui/src/ProvenanceBadge'; // adjust import path to your actual monorepo alias

export interface SceneEntity {
  id: string;
  type: 'wall' | 'opening' | 'module' | 'material_slot' | 'furniture';
  label: string;
  /** Real measured dimensions in mm -- only present if this entity has approved geometry. */
  dimensionsMm?: { width: number; height: number; depth?: number };
  materialSku?: string | null;
  materialLabel?: string | null;
  provenanceState: ProvenanceState;
  sceneVersionId: string;
}

export interface EntityPickerProps {
  entities: SceneEntity[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRequestSwap: (entity: SceneEntity) => void;
}

export function EntityPicker({ entities, selectedId, onSelect, onRequestSwap }: EntityPickerProps) {
  const selected = entities.find(e => e.id === selectedId) ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#A8A6A0' }}>
        Scene entities ({entities.length})
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
        {entities.map(entity => (
          <button
            key={entity.id}
            onClick={() => onSelect(entity.id === selectedId ? null : entity.id)}
            style={{
              textAlign: 'left', padding: '8px 10px', borderRadius: 8,
              border: entity.id === selectedId ? '1px solid #C9A84C' : '1px solid #2A2A30',
              background: entity.id === selectedId ? '#C9A84C14' : '#141417',
              cursor: 'pointer', color: '#F5F3EE', fontSize: 13,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{entity.label}</span>
              <span style={{ color: '#6B6963', fontSize: 11 }}>{entity.type}</span>
            </div>
          </button>
        ))}
        {entities.length === 0 && (
          <div style={{ color: '#6B6963', fontSize: 12, padding: 8 }}>
            No entities loaded. Confirm the viewport passed an approved scene
            version -- this panel should never show entities from a draft or
            unapproved scene.
          </div>
        )}
      </div>

      {selected && (
        <div style={{ borderTop: '1px solid #2A2A30', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{selected.label}</div>

          {selected.dimensionsMm ? (
            <div style={{ fontSize: 12, color: '#A8A6A0' }}>
              {selected.dimensionsMm.width} × {selected.dimensionsMm.height}
              {selected.dimensionsMm.depth ? ` × ${selected.dimensionsMm.depth}` : ''} mm
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#8A3B3B' }}>
              No approved dimensions for this entity -- do not present a
              default/estimated size as real here.
            </div>
          )}

          {selected.materialLabel && (
            <div style={{ fontSize: 12, color: '#A8A6A0' }}>
              Material: {selected.materialLabel} {selected.materialSku ? `(${selected.materialSku})` : ''}
            </div>
          )}

          <ProvenanceBadge
            sceneVersionId={selected.sceneVersionId}
            state={selected.provenanceState}
            variant="compact"
          />

          <button
            onClick={() => onRequestSwap(selected)}
            style={{
              marginTop: 4, padding: '8px 12px', borderRadius: 8,
              background: '#C9A84C', color: '#0B0B0D', fontWeight: 600,
              border: 'none', cursor: 'pointer', fontSize: 13,
            }}
          >
            Change material / swap
          </button>
        </div>
      )}
    </div>
  );
}
