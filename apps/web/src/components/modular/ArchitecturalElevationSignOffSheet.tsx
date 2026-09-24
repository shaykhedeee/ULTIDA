import React, { useState } from 'react';
import { Box, Layers, Sparkles, CheckCircle2, ShieldCheck, Ruler, Palette, FileText, Download } from 'lucide-react';
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

  // Render SVG dimensions
  const svgW = 760;
  const svgH = 380;
  const scale = Math.min((svgW - 140) / w, (svgH - 90) / h);
  const drawW = w * scale;
  const drawH = h * scale;
  const ox = 70 + (svgW - 140 - drawW) / 2;
  const oy = svgH - 45 - drawH;

  // Horizontal datums
  const plinthY = oy + drawH - 100 * scale;
  const lintelY = oy + drawH - 2100 * scale;

  // 30mm filler width in scaled SVG units
  const fillerW = Math.max(4, 30 * scale);
  const carcassW = drawW - 2 * fillerW;
  const carcassX = ox + fillerW;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Top Sheet Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '10px 18px', borderRadius: 8, flexWrap: 'wrap', gap: 10 }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('both')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              background: activeTab === 'both' ? '#38bdf8' : '#1e293b',
              color: activeTab === 'both' ? '#0f172a' : '#cbd5e1',
              border: 0,
              fontWeight: 700,
              fontSize: 11.5,
              cursor: 'pointer',
            }}
          >
            Dual View (Side-by-Side)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('external')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              background: activeTab === 'external' ? '#38bdf8' : '#1e293b',
              color: activeTab === 'external' ? '#0f172a' : '#cbd5e1',
              border: 0,
              fontWeight: 700,
              fontSize: 11.5,
              cursor: 'pointer',
            }}
          >
            External Elevation
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('internal')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              background: activeTab === 'internal' ? '#38bdf8' : '#1e293b',
              color: activeTab === 'internal' ? '#0f172a' : '#cbd5e1',
              border: 0,
              fontWeight: 700,
              fontSize: 11.5,
              cursor: 'pointer',
            }}
          >
            System 32 Carcass
          </button>
          <button
            type="button"
            onClick={() => setShowDimensions(!showDimensions)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              background: showDimensions ? '#10b981' : '#334155',
              color: '#fff',
              border: 0,
              fontWeight: 700,
              fontSize: 11.5,
              cursor: 'pointer',
            }}
          >
            {showDimensions ? '✓ Dual Dimension Chains' : 'Hide Dims'}
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
              <span style={{ fontSize: 10, fontWeight: 700, color: '#0284c7' }}>Acrylic Gloss / 3mm Reveals / Scribing Fillers</span>
            </div>

            <svg viewBox={"0 0 " + svgW + " " + svgH} style={{ width: '100%', height: 'auto', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              {/* Left Vertical Dimension Chain */}
              {showDimensions && (
                <g>
                  {/* Overall Height Line */}
                  <line x1={ox - 45} y1={oy} x2={ox - 45} y2={oy + drawH} stroke="#0284c7" strokeWidth="1.2" />
                  <line x1={ox - 52} y1={oy} x2={ox - 38} y2={oy} stroke="#0284c7" strokeWidth="1.2" />
                  <line x1={ox - 52} y1={oy + drawH} x2={ox - 38} y2={oy + drawH} stroke="#0284c7" strokeWidth="1.2" />
                  <text x={ox - 49} y={oy + drawH / 2} fill="#0284c7" fontSize="9.5" fontWeight="bold" textAnchor="middle" transform={"rotate(-90, " + (ox - 49) + ", " + (oy + drawH / 2) + ")"}>
                    {formatDualMm(h)} OVERALL
                  </text>

                  {/* Lintel Datum Indicator */}
                  {h > 2100 && (
                    <>
                      <line x1={ox - 25} y1={lintelY} x2={ox - 25} y2={oy + drawH} stroke="#64748b" strokeWidth="1" strokeDasharray="2 2" />
                      <line x1={ox - 30} y1={lintelY} x2={ox - 20} y2={lintelY} stroke="#64748b" strokeWidth="1" />
                      <text x={ox - 28} y={lintelY + 30} fill="#64748b" fontSize="8" textAnchor="middle" transform={"rotate(-90, " + (ox - 28) + ", " + (lintelY + 30) + ")"}>
                        2100 MM
                      </text>
                    </>
                  )}
                </g>
              )}

              {/* 30mm Scribing Fillers (Left & Right) */}
              <rect x={ox} y={oy} width={fillerW} height={drawH} fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
              <rect x={ox + drawW - fillerW} y={oy} width={fillerW} height={drawH} fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
              <text x={ox + fillerW / 2} y={oy + drawH / 2} fill="#94a3b8" fontSize="7" textAnchor="middle" transform={"rotate(-90, " + (ox + fillerW / 2) + ", " + (oy + drawH / 2) + ")"}>30mm FILLER</text>
              <text x={ox + drawW - fillerW / 2} y={oy + drawH / 2} fill="#94a3b8" fontSize="7" textAnchor="middle" transform={"rotate(-90, " + (ox + drawW - fillerW / 2) + ", " + (oy + drawH / 2) + ")"}>30mm FILLER</text>

              {/* Outer Carcass Boundary */}
              <rect x={carcassX} y={oy} width={carcassW} height={drawH} fill="#ffffff" stroke="#0f172a" strokeWidth="2" />

              {/* Plinth datum at 100mm */}
              <rect x={carcassX} y={plinthY} width={carcassW} height={drawH - (plinthY - oy)} fill="#e2e8f0" stroke="#0f172a" strokeWidth="1.5" />
              <text x={carcassX + carcassW / 2} y={plinthY + 14 * scale} fill="#475569" fontSize="8.5" fontWeight="bold" textAnchor="middle">
                RECESSED PLINTH SKIRTING (+100mm)
              </text>

              {/* Loft Datums at 2100mm */}
              {h > 2100 && (
                <>
                  <line x1={carcassX} y1={lintelY} x2={carcassX + carcassW} y2={lintelY} stroke="#0f172a" strokeWidth="2" strokeDasharray="4 2" />
                  <text x={carcassX + 8} y={lintelY - 6} fill="#64748b" fontSize="8.5" fontWeight="bold">LOFT DATUM (+2100mm)</text>
                </>
              )}

              {/* Shutter splits with 3mm reveals and handles */}
              {w >= 1800 ? (
                <>
                  {[0, 1, 2, 3].map((i) => {
                    const panelW = carcassW / 4;
                    const px = carcassX + i * panelW;
                    const py = h > 2100 ? lintelY : oy;
                    const pHeight = plinthY - py;
                    const handleX = i % 2 === 0 ? px + panelW - 12 : px + 12;

                    return (
                      <g key={i}>
                        {/* Shutter Reveal outline */}
                        <rect x={px + 1.5} y={py + 1.5} width={panelW - 3} height={pHeight - 3} fill="#ffffff" stroke="#334155" strokeWidth="1.2" />

                        {/* Grain Direction Indicator Arrow */}
                        <line x1={px + panelW / 2} y1={py + 30} x2={px + panelW / 2} y2={py + 60} stroke="#cbd5e1" strokeWidth="1" />
                        <text x={px + panelW / 2} y={py + 72} fill="#94a3b8" fontSize="7" textAnchor="middle">GRAIN ▲</text>

                        {/* Vertical Architectural Bar Handle (160mm) */}
                        <rect x={handleX - 1.5} y={py + pHeight * 0.5 - 18} width="3" height="36" fill="#1e293b" rx="1" />

                        {/* Loft Shutter above lintel */}
                        {h > 2100 && (
                          <rect x={px + 1.5} y={oy + 1.5} width={panelW - 3} height={lintelY - oy - 3} fill="#f8fafc" stroke="#334155" strokeWidth="1.2" />
                        )}
                      </g>
                    );
                  })}
                </>
              ) : (
                [0, 1].map((i) => {
                  const panelW = carcassW / 2;
                  const px = carcassX + i * panelW;
                  const py = h > 2100 ? lintelY : oy;
                  const pHeight = plinthY - py;
                  const handleX = i === 0 ? px + panelW - 12 : px + 12;

                  return (
                    <g key={i}>
                      <rect x={px + 1.5} y={py + 1.5} width={panelW - 3} height={pHeight - 3} fill="#ffffff" stroke="#334155" strokeWidth="1.2" />
                      <rect x={handleX - 1.5} y={py + pHeight * 0.5 - 18} width="3" height="36" fill="#1e293b" rx="1" />
                      {h > 2100 && (
                        <rect x={px + 1.5} y={oy + 1.5} width={panelW - 3} height={lintelY - oy - 3} fill="#f8fafc" stroke="#334155" strokeWidth="1.2" />
                      )}
                    </g>
                  );
                })
              )}

              {/* Bottom Dimension String */}
              {showDimensions && (
                <g>
                  <line x1={ox} y1={oy + drawH + 18} x2={ox + drawW} y2={oy + drawH + 18} stroke="#0284c7" strokeWidth="1.5" />
                  <line x1={ox} y1={oy + drawH + 12} x2={ox} y2={oy + drawH + 24} stroke="#0284c7" strokeWidth="1.5" />
                  <line x1={ox + drawW} y1={oy + drawH + 12} x2={ox + drawW} y2={oy + drawH + 24} stroke="#0284c7" strokeWidth="1.5" />
                  <text x={ox + drawW / 2} y={oy + drawH + 30} fill="#0284c7" fontSize="10.5" fontWeight="bold" textAnchor="middle">
                    {formatDualMm(w)} OVERALL SPAN
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
                <strong style={{ fontSize: 12, color: '#78350f' }}>ELEVATION B: INTERNAL CARCASS &amp; SYSTEM 32 BORING</strong>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#b45309' }}>18mm HDHMR / 32mm Pitch / 37mm Setback</span>
            </div>

            <svg viewBox={"0 0 " + svgW + " " + svgH} style={{ width: '100%', height: 'auto', background: '#fffbeb', borderRadius: 6, border: '1px solid #fde68a' }}>
              {/* Left Vertical Datum Dimensions */}
              {showDimensions && (
                <g>
                  <line x1={ox - 45} y1={oy} x2={ox - 45} y2={oy + drawH} stroke="#b45309" strokeWidth="1.2" />
                  <line x1={ox - 52} y1={oy} x2={ox - 38} y2={oy} stroke="#b45309" strokeWidth="1.2" />
                  <line x1={ox - 52} y1={oy + drawH} x2={ox - 38} y2={oy + drawH} stroke="#b45309" strokeWidth="1.2" />
                  <text x={ox - 49} y={oy + drawH / 2} fill="#b45309" fontSize="9.5" fontWeight="bold" textAnchor="middle" transform={"rotate(-90, " + (ox - 49) + ", " + (oy + drawH / 2) + ")"}>
                    {formatDualMm(h)} CARCASS HEIGHT
                  </text>
                </g>
              )}

              {/* 30mm Scribing Fillers */}
              <rect x={ox} y={oy} width={fillerW} height={drawH} fill="#fef3c7" stroke="#b45309" strokeWidth="1" strokeDasharray="3 2" />
              <rect x={ox + drawW - fillerW} y={oy} width={fillerW} height={drawH} fill="#fef3c7" stroke="#b45309" strokeWidth="1" strokeDasharray="3 2" />

              {/* Outer 18mm Carcass Outline */}
              <rect x={carcassX} y={oy} width={carcassW} height={drawH} fill="#ffffff" stroke="#78350f" strokeWidth="2.5" />

              {/* 8mm Back Panel Groove Indication Line (18mm setback from rear) */}
              <line x1={carcassX + 5} y1={oy + 5} x2={carcassX + carcassW - 5} y2={oy + 5} stroke="#d97706" strokeWidth="1" strokeDasharray="2 4" />

              {/* Plinth Base (+100mm) */}
              <rect x={carcassX} y={plinthY} width={carcassW} height={drawH - (plinthY - oy)} fill="#fde68a" stroke="#78350f" strokeWidth="1.5" />
              {/* Plinth Leveler Legs (Pairs per bay) */}
              <circle cx={carcassX + 25} cy={plinthY + 12 * scale} r="4" fill="#1c1917" />
              <circle cx={carcassX + carcassW - 25} cy={plinthY + 12 * scale} r="4" fill="#1c1917" />
              <text x={carcassX + carcassW / 2} y={plinthY + 15 * scale} fill="#92400e" fontSize="8.5" fontWeight="bold" textAnchor="middle">
                PLINTH LEGS (100mm HEAVY DUTY PVC)
              </text>

              {/* Loft Carcass Division */}
              {h > 2100 && (
                <>
                  <rect x={carcassX} y={lintelY - 4 * scale} width={carcassW} height={8 * scale} fill="#fde68a" stroke="#78350f" strokeWidth="1" />
                  <text x={carcassX + 8} y={lintelY - 8} fill="#78350f" fontSize="8" fontWeight="bold">FIXED SHELF (FS) +2100</text>
                </>
              )}

              {/* Internal 18mm Gables & System 32 Boring */}
              {w >= 1800 ? (
                <>
                  {/* Central Main Divider Gable */}
                  <rect x={carcassX + carcassW * 0.5 - 3} y={oy} width="6" height={plinthY - oy} fill="#fde68a" stroke="#92400e" strokeWidth="1" />

                  {/* Left Bay Carcass Details */}
                  {/* System 32 Line Boring Dots (32mm pitch, 37mm setback) */}
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((dot) => (
                    <circle key={"dot-l-" + dot} cx={carcassX + 8} cy={oy + 40 + dot * 16} r="1.5" fill="#94a3b8" />
                  ))}
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((dot) => (
                    <circle key={"dot-r-" + dot} cx={carcassX + carcassW * 0.5 - 14} cy={oy + 40 + dot * 16} r="1.5" fill="#94a3b8" />
                  ))}

                  {/* Hanging Rod with 1050mm clearance */}
                  <line x1={carcassX + 4} y1={oy + 80} x2={carcassX + carcassW * 0.5 - 4} y2={oy + 80} stroke="#92400e" strokeWidth="2.5" />
                  <circle cx={carcassX + 8} cy={oy + 80} r="3" fill="#78350f" />
                  <circle cx={carcassX + carcassW * 0.5 - 8} cy={oy + 80} r="3" fill="#78350f" />
                  <text x={carcassX + 16} y={oy + 74} fill="#92400e" fontSize="8" fontWeight="bold">
                    OVAL HANGER ROD (1050mm CLEARANCE)
                  </text>

                  {/* Double Tandembox Drawers at Bottom */}
                  <rect x={carcassX + 6} y={plinthY - 50 * scale} width={carcassW * 0.5 - 12} height={22 * scale} fill="#fef3c7" stroke="#b45309" strokeWidth="1" />
                  <text x={carcassX + 16} y={plinthY - 35 * scale} fill="#78350f" fontSize="7.5" fontWeight="bold">TANDEM DRAWER 200 (BLUM)</text>

                  <rect x={carcassX + 6} y={plinthY - 24 * scale} width={carcassW * 0.5 - 12} height={22 * scale} fill="#fef3c7" stroke="#b45309" strokeWidth="1" />
                  <text x={carcassX + 16} y={plinthY - 9 * scale} fill="#78350f" fontSize="7.5" fontWeight="bold">TANDEM DRAWER 200 (BLUM)</text>

                  {/* Right Bay: Adjustable Shelves (AS EQ) */}
                  {[1, 2, 3].map((s) => {
                    const sy = oy + 60 + s * 45 * scale;
                    return (
                      <g key={s}>
                        <rect x={carcassX + carcassW * 0.5 + 4} y={sy} width={carcassW * 0.5 - 8} height={4 * scale} fill="#fde68a" stroke="#92400e" strokeWidth="1" />
                        <text x={carcassX + carcassW * 0.5 + 10} y={sy - 4} fill="#78350f" fontSize="7.5">ADJUSTABLE SHELF (AS EQ)</text>
                      </g>
                    );
                  })}
                </>
              ) : (
                <>
                  <line x1={carcassX + 4} y1={oy + 90} x2={carcassX + carcassW - 4} y2={oy + 90} stroke="#92400e" strokeWidth="2.5" />
                  <text x={carcassX + 16} y={oy + 84} fill="#92400e" fontSize="8" fontWeight="bold">OVAL HANGER ROD (1050mm CLEARANCE)</text>
                  <rect x={carcassX + 8} y={plinthY - 45 * scale} width={carcassW - 16} height={38 * scale} fill="#fef3c7" stroke="#b45309" strokeWidth="1" />
                  <text x={carcassX + 20} y={plinthY - 20 * scale} fill="#78350f" fontSize="8" fontWeight="bold">INTERNAL TANDEMBOX SLIDE</text>
                </>
              )}

              {/* Bottom Dimension string */}
              {showDimensions && (
                <g>
                  <line x1={ox} y1={oy + drawH + 18} x2={ox + drawW} y2={oy + drawH + 18} stroke="#b45309" strokeWidth="1.5" />
                  <line x1={ox} y1={oy + drawH + 12} x2={ox} y2={oy + drawH + 24} stroke="#b45309" strokeWidth="1.5" />
                  <line x1={ox + drawW} y1={oy + drawH + 12} x2={ox + drawW} y2={oy + drawH + 24} stroke="#b45309" strokeWidth="1.5" />
                  <text x={ox + drawW / 2} y={oy + drawH + 30} fill="#b45309" fontSize="10.5" fontWeight="bold" textAnchor="middle">
                    {formatDualMm(w)} [SYSTEM 32 CARCASS + FILLERS]
                  </text>
                </g>
              )}
            </svg>
          </div>
        )}
      </div>

      {/* Specifications Register */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: '#0f172a' }}>
          ZONE 4: SPECIFICATION &amp; PRODUCTION TOLERANCE REGISTER
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, fontSize: 11 }}>
          <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>CARCASS CORE:</span>
            <p style={{ margin: '4px 0 0', fontWeight: 800, color: '#0f172a' }}>18mm Action TESA HDHMR</p>
          </div>
          <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>EXTERNAL SHUTTER:</span>
            <p style={{ margin: '4px 0 0', fontWeight: 800, color: '#0f172a' }}>2mm Acrylic Gloss / 1mm Laminate</p>
          </div>
          <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>SYSTEM 32 BORING:</span>
            <p style={{ margin: '4px 0 0', fontWeight: 800, color: '#0f172a' }}>32mm Pitch · 37mm Front Setback</p>
          </div>
          <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>EDGE BANDING:</span>
            <p style={{ margin: '4px 0 0', fontWeight: 800, color: '#0f172a' }}>2.0mm Shutter / 0.8mm Carcass</p>
          </div>
        </div>
      </div>

      {/* Architectural Title Block */}
      <div style={{ background: '#0f172a', padding: '12px 18px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#c59c2d', letterSpacing: 1 }}>ULTIDA ARCHITECTURAL OS</span>
          <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 700, color: '#fff' }}>
            {projectMetadata.projectName} — {projectMetadata.roomName}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#94a3b8', alignItems: 'center' }}>
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
