import React, { useEffect, useState } from 'react';
import { getApiBase } from '../../lib/api-base';

export interface CompiledComponentSummary {
  id: string;
  label: string;
  partType?: string;
  dimensionsMm: { width: number; depth: number; height: number };
  materialSlot?: string;
}

export interface ModuleConstructionPreviewProps {
  moduleId: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
}

export const ModuleConstructionPreview: React.FC<ModuleConstructionPreviewProps> = ({
  moduleId,
  widthMm,
  depthMm,
  heightMm,
}) => {
  const [components, setComponents] = useState<CompiledComponentSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`${getApiBase()}/catalog/modules/${encodeURIComponent(moduleId)}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widthMm, depthMm, heightMm }),
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok || !payload.success) {
          setError(payload.message ?? 'Construction preview unavailable for these dimensions.');
          setComponents([]);
          return;
        }
        setComponents(Array.isArray(payload.components) ? payload.components : []);
      })
      .catch(() => {
        if (!active) return;
        setError('Unable to reach construction preview endpoint.');
        setComponents([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [moduleId, widthMm, depthMm, heightMm]);

  return (
    <div
      style={{
        marginTop: 10,
        padding: 10,
        borderRadius: 8,
        border: '1px solid #e7e5e4',
        background: '#fafaf9',
        fontSize: 11.5,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#1c1917' }}>
        <span>Compiler-Backed Construction Preview</span>
        <span>
          {widthMm}×{depthMm}×{heightMm} mm
        </span>
      </div>
      {loading && <div style={{ color: '#57534e', marginTop: 4 }}>Compiling physical components…</div>}
      {error && <div style={{ color: '#b91c1c', marginTop: 4, fontWeight: 600 }}>{error}</div>}
      {!loading && !error && components.length > 0 && (
        <div style={{ marginTop: 6, color: '#44403c' }}>
          <strong>{components.length} physical cutlist components</strong> verified within module envelope.
        </div>
      )}
    </div>
  );
};
