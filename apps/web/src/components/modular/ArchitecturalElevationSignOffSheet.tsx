import React, { useState } from 'react';
import { Box, Layers, Sparkles, CheckCircle2, ShieldCheck, Ruler, Palette, FileText } from 'lucide-react';
import { formatDualMm } from '@ultida/drawing-core/browser';

export interface ModularSignOffModule {
  id: string;
  family: string;
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  sku: string;
  tags?: string[];
}

export interface ModularSignOffProjectMetadata {
  projectName: string;
  clientName: string;
  flatNo?: string;
  roomName: string;
  drawingCode: string;
  sheetNo: string;
  scale?: string;
  revision?: string;
  date: string;
  drawnBy?: string;
  checkedBy?: string;
}

interface Props {
  module: ModularSignOffModule;
  projectMetadata: ModularSignOffProjectMetadata;
}

export default function ArchitecturalElevationSignOffSheet({ module, projectMetadata }: Props) {
  const [activeTab, setActiveTab] = useState<'both' | 'external' | 'internal'>('both');
  const [showDimensions, setShowDimensions] = useState(true);

  const w = module.widthMm || 2400;
  const h = module.heightMm || 2700;
  const d = module.depthMm || 600;

  // Render SVG parameters
  const svgW = 720;
  const svgH = 340;
  const scale = Math.min((svgW - 80) / w, (svgH - 80) / h);
  const drawW = w * scale;
  const drawH = h * scale;
  const ox = (svgW - drawW) / 2;
  const oy = svgH - 40 - drawH;

  // Horizontal datums
  const plinthY = oy + drawH - 100 * scale;
  const counterY = oy + drawH - 850 * scale;
  const lintelY = oy + drawH - 2100 * scale;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Top Sheet Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '10px 18px', borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ background: '#c59c2d', color: '#000', fontWeight: 900, fontSize: 11, padding: '3px 8px', borderRadius: 4, letterSpacing: '0.5px' }}>
            {projectMetadata.drawingCode}
          </span>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 13 }}>
            {module.name}
          </span>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>
            · {formatDualMm(w)} × {formatDualMm(d)} × {formatDualMm(h)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => setActiveTab('both')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              background: activeTab === 'both' ? '#38bdf8' : '#1e293b',
              color: activeTab === 'both' ? '#0f172a' : '#cbd5e1',
              border: 0,
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Dual View (External + Carcass)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('external')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              background: activeTab === 'external' ? '#38bdf8' : '#1e293b',
              color: activeTab === 'external' ? '#0f172a' : '#cbd5e1',
              border: 0,
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            External Shutters
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('internal')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              background: activeTab === 'internal' ? '#38bdf8' : '#1e293b',
              color: activeTab === 'internal' ? '#0f172a' : '#cbd5e1',
              border: 0,
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            System 32 Carcass
          </button>
          <button
            type="button"
            onClick={() => setShowDimensions(!showDimensions)}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              background: showDimensions ? '#10b981' : '#334155',
              color: '#fff',
              border: 0,
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {showDimensions ? '✓ Dual Units (MM / Ft-In)' : 'Hide Dims'}
          </button>
        </div>
      </div>

      {/* 2D Elevation Viewport */}
      <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'both' ? '1fr 1fr' : '1fr', gap: 16 }}>
        {/* Elevation A: External Shutter View */}
        {(activeTab === 'both' || activeTab === 'external') && (
          <div style={{ background: '#ffffff', border: '1.5px solid #0f172a', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Palette size={14} color="#0284c7" />
                <strong style={{ fontSize: 12, color: '#0f172a' }}>ELEVATION A: EXTERNAL SHUTTER &amp; FINISHES</strong>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#0284c7' }}>Royale Touche / Acrylic Fluted</span>
            </div>

            <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              {/* Outer wall outline */}
              <rect x={ox} y={oy} width={drawW} height={drawH} fill="#ffffff" stroke="#0f172a" strokeWidth="2" />

              {/* Shutter splits */}
              {w >= 1800 ? (
                <>
                  <line x1={ox + drawW * 0.25} y1={oy} x2={ox + drawW * 0.25} y2={oy + drawH - 100 * scale} stroke="#334155" strokeWidth="1.5" />
                  <line x1={ox + drawW * 0.5} y1={oy} x2={ox + drawW * 0.5} y2={oy + drawH - 100 * scale} stroke="#334155" strokeWidth="1.5" />
                  <line x1={ox + drawW * 0.75} y1={oy} x2={ox + drawW * 0.75} y2={oy + drawH - 100 * scale} stroke="#334155" strokeWidth="1.5" />
                </>
              ) : (
                <line x1={ox + drawW * 0.5} y1={oy} x2={ox + drawW * 0.5} y2={oy + drawH - 100 * scale} stroke="#334155" strokeWidth="1.5" />
              )}

              {/* Loft line at 2100mm */}
              {h > 2100 && (
                <>
                  <line x1={ox} y1={lintelY} x2={ox + drawW} y2={lintelY} stroke="#0f172a" strokeWidth="2" strokeDasharray="4 2" />
                  <text x={ox + 8} y={lintelY - 6} fill="#64748b" fontSize="9" fontWeight="bold">LOFT DATUM (+2100mm)</text>
                </>
              )}

              {/* Plinth datum at 100mm */}
              <line x1={ox} y1={plinthY} x2={ox + drawW} y2={plinthY} stroke="#64748b" strokeWidth="1" strokeDasharray="2 2" />
              <text x={ox + 8} y={plinthY - 4} fill="#64748b" fontSize="8">SKIRTING PLINTH (+100mm)</text>

              {/* Bottom Dimension string */}
              {showDimensions && (
                <g>
                  <line x1={ox} y1={oy + drawH + 16} x2={ox + drawW} y2={oy + drawH + 16} stroke="#0284c7" strokeWidth="1.5" />
                  <line x1={ox} y1={oy + drawH + 10} x2={ox} y2={oy + drawH + 22} stroke="#0284c7" strokeWidth="1.5" />
                  <line x1={ox + drawW} y1={oy + drawH + 10} x2={ox + drawW} y2={oy + drawH + 22} stroke="#0284c7" strokeWidth="1.5" />
                  <text x={ox + drawW / 2} y={oy + drawH + 28} fill="#0284c7" fontSize="10" fontWeight="bold" textAnchor="middle">
                    {formatDualMm(w)}
                  </text>
                </g>
              )}
            </svg>
          </div>
        )}

        {/* Elevation B: Internal Joinery Carcass Section */}
        {(activeTab === 'both' || activeTab === 'internal') && (
          <div style={{ background: '#ffffff', border: '1.5px solid #78350f', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #fed7aa', paddingBottom: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={14} color="#b45309" />
                <strong style={{ fontSize: 12, color: '#78350f' }}>ELEVATION B: INTERNAL JOINERY &amp; SYSTEM 32 CARCASS</strong>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#b45309' }}>18mm HDHMR / 32mm Line Boring</span>
            </div>

            <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', background: '#fffbeb', borderRadius: 6, border: '1px solid #fde68a' }}>
              {/* Outer Carcass Outline */}
              <rect x={ox} y={oy} width={drawW} height={drawH} fill="#ffffff" stroke="#78350f" strokeWidth="2" />

              {/* Internal gables */}
              {w >= 1800 ? (
                <>
                  <rect x={ox + drawW * 0.25 - 4} y={oy} width="8" height={drawH - 100 * scale} fill="#fef3c7" stroke="#92400e" strokeWidth="1" />
                  <rect x={ox + drawW * 0.5 - 4} y={oy} width="8" height={drawH - 100 * scale} fill="#fef3c7" stroke="#92400e" strokeWidth="1" />
                  <rect x={ox + drawW * 0.75 - 4} y={oy} width="8" height={drawH - 100 * scale} fill="#fef3c7" stroke="#92400e" strokeWidth="1" />
                </>
              ) : (
                <rect x={ox + drawW * 0.5 - 4} y={oy} width="8" height={drawH - 100 * scale} fill="#fef3c7" stroke="#92400e" strokeWidth="1" />
              )}

              {/* System 32 line boring pitch indicators */}
              <line x1={ox + 12} y1={oy + 20} x2={ox + 12} y2={oy + drawH - 120 * scale} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="1 5" />
              <line x1={ox + drawW - 12} y1={oy + 20} x2={ox + drawW - 12} y2={oy + drawH - 120 * scale} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="1 5" />

              {/* Hanging rod / Shelf indicators */}
              <line x1={ox} y1={oy + 120} x2={ox + drawW * 0.5} y2={oy + 120} stroke="#92400e" strokeWidth="1.5" />
              <text x={ox + 16} y={oy + 112} fill="#92400e" fontSize="8" fontWeight="bold">1050mm SHIRT HANGER CLEARANCE</text>

              {/* Bottom Drawers */}
              <rect x={ox + 4} y={oy + drawH - 260 * scale} width={drawW * 0.5 - 8} height={50 * scale} fill="#fde68a" stroke="#b45309" strokeWidth="1" />
              <text x={ox + 14} y={oy + drawH - 230 * scale} fill="#78350f" fontSize="8" fontWeight="bold">TANDEM BOX 200mm</text>

              {/* Bottom Dimension string */}
              {showDimensions && (
                <g>
                  <line x1={ox} y1={oy + drawH + 16} x2={ox + drawW} y2={oy + drawH + 16} stroke="#b45309" strokeWidth="1.5" />
                  <line x1={ox} y1={oy + drawH + 10} x2={ox} y2={oy + drawH + 22} stroke="#b45309" strokeWidth="1.5" />
                  <line x1={ox + drawW} y1={oy + drawH + 10} x2={ox + drawW} y2={oy + drawH + 22} stroke="#b45309" strokeWidth="1.5" />
                  <text x={ox + drawW / 2} y={oy + drawH + 28} fill="#b45309" fontSize="10" fontWeight="bold" textAnchor="middle">
                    {formatDualMm(w)} [SYSTEM 32 CARCASS]
                  </text>
                </g>
              )}
            </svg>
          </div>
        )}
      </div>

      {/* Material & Hardware Specifications Table */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: '#0f172a' }}>
          ZONE 4: SPECIFICATION &amp; PROCUREMENT REGISTER
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, fontSize: 11 }}>
          <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>CARCASS CORE:</span>
            <p style={{ margin: '4px 0 0', fontWeight: 800, color: '#0f172a' }}>18mm Action TESA HDHMR</p>
          </div>
          <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>EXTERNAL FINISH:</span>
            <p style={{ margin: '4px 0 0', fontWeight: 800, color: '#0f172a' }}>Royale Touche Velvet Matt</p>
          </div>
          <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>INTERNAL LINER:</span>
            <p style={{ margin: '4px 0 0', fontWeight: 800, color: '#0f172a' }}>0.8mm Frosty White / Suede</p>
          </div>
          <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>HARDWARE:</span>
            <p style={{ margin: '4px 0 0', fontWeight: 800, color: '#0f172a' }}>Blum Clip-top &amp; Hettich Atira</p>
          </div>
        </div>
      </div>

      {/* Architectural Title Block */}
      <div style={{ background: '#0f172a', padding: '12px 18px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#c59c2d', letterSpacing: 1 }}>ULTIDA ARCHITECTURAL OS</span>
          <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 700, color: '#fff' }}>
            {projectMetadata.projectName} — {projectMetadata.roomName}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#94a3b8' }}>
          <span>Scale: <strong style={{ color: '#fff' }}>{projectMetadata.scale || '1:25 @ A3'}</strong></span>
          <span>Rev: <strong style={{ color: '#38bdf8' }}>{projectMetadata.revision || 'REV-02'}</strong></span>
          <span>Drawn: <strong style={{ color: '#fff' }}>{projectMetadata.drawnBy || 'CUBE DECORS / ULTIDA'}</strong></span>
          <span style={{ background: '#059669', color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 800, fontSize: 10 }}>
            APPROVED FOR CNC RELEASE
          </span>
        </div>
      </div>
    </div>
  );
}
