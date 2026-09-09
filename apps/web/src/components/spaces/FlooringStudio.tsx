import React, { useState, useMemo, useEffect } from 'react';
import {
  Grid,
  Layers,
  Ruler,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Sliders,
  RotateCw,
  Palette,
  Check,
  Package,
  Scissors,
  Maximize2,
  Download,
  Copy,
  FileText
} from 'lucide-react';
import {
  type FloorSurfaceV1,
  type FloorPointV1,
  type FlooringQuantityV1,
  buildFlooringQuantities
} from '@ultida/contracts';
import './flooring-studio.css';

export interface FlooringStudioProps {
  roomId: string;
  roomName: string;
  roomAreaSqm?: number;
  roomPolygon: Array<{ xMm: number; yMm: number }>;
  doorOpenings?: Array<{
    id: string;
    offsetAlongWallMm: number;
    widthMm?: number;
  }>;
  initialSurface?: FloorSurfaceV1 | null;
  onSurfaceChange?: (surface: FloorSurfaceV1, quantities: FlooringQuantityV1) => void;
  onSave?: (surface: FloorSurfaceV1, quantities?: FlooringQuantityV1) => void;
}

export interface TilePreset {
  id: string;
  name: string;
  category: 'marble' | 'tile' | 'wood' | 'terrazzo';
  widthMm: number;
  lengthMm: number;
  defaultPattern: 'grid' | 'brick';
  defaultGroutMm: number;
  packCoverageSqm: number;
  thicknessMm: number;
  previewColor: string;
}

export const TILE_PRESETS: TilePreset[] = [
  {
    id: 'mat-statuario-1200x600',
    name: 'Statuario Marble Vitrified Slab',
    category: 'marble',
    widthMm: 1200,
    lengthMm: 600,
    defaultPattern: 'grid',
    defaultGroutMm: 2,
    packCoverageSqm: 1.44,
    thicknessMm: 9,
    previewColor: '#f1f5f9'
  },
  {
    id: 'mat-ash-grey-600x600',
    name: 'Ash Grey Matt Vitrified Tile',
    category: 'tile',
    widthMm: 600,
    lengthMm: 600,
    defaultPattern: 'grid',
    defaultGroutMm: 2,
    packCoverageSqm: 1.44,
    thicknessMm: 9,
    previewColor: '#94a3b8'
  },
  {
    id: 'mat-smoked-oak-150x900',
    name: 'Smoked French Oak Wood Plank',
    category: 'wood',
    widthMm: 150,
    lengthMm: 900,
    defaultPattern: 'brick',
    defaultGroutMm: 1,
    packCoverageSqm: 1.62,
    thicknessMm: 14,
    previewColor: '#785338'
  },
  {
    id: 'mat-royal-walnut-200x1200',
    name: 'Royal Walnut Engineered Plank',
    category: 'wood',
    widthMm: 200,
    lengthMm: 1200,
    defaultPattern: 'brick',
    defaultGroutMm: 1,
    packCoverageSqm: 1.92,
    thicknessMm: 15,
    previewColor: '#4a3525'
  },
  {
    id: 'mat-venetian-terrazzo-800x800',
    name: 'Venetian Emerald Aggregate Terrazzo',
    category: 'terrazzo',
    widthMm: 800,
    lengthMm: 800,
    defaultPattern: 'grid',
    defaultGroutMm: 2,
    packCoverageSqm: 1.28,
    thicknessMm: 15,
    previewColor: '#2d4a43'
  },
  {
    id: 'mat-anthracite-slate-600x600',
    name: 'Anthracite Flamed Slate Tile',
    category: 'tile',
    widthMm: 600,
    lengthMm: 600,
    defaultPattern: 'grid',
    defaultGroutMm: 3,
    packCoverageSqm: 1.44,
    thicknessMm: 10,
    previewColor: '#334155'
  }
];

const GROUT_COLORS = [
  { label: 'Titanium Grey', hex: '#94a3b8' },
  { label: 'Champagne Gold', hex: '#d4af37' },
  { label: 'Charcoal Noir', hex: '#1e293b' },
  { label: 'Alabaster White', hex: '#ffffff' },
  { label: 'Warm Sand', hex: '#a89f91' }
];

export const FlooringStudio: React.FC<FlooringStudioProps> = ({
  roomId,
  roomName,
  roomAreaSqm,
  roomPolygon,
  doorOpenings = [],
  initialSurface,
  onSurfaceChange,
  onSave
}) => {
  // Normalize polygon
  const canonicalPolygon: FloorPointV1[] = useMemo(() => {
    if (roomPolygon && roomPolygon.length >= 3) {
      return roomPolygon.map((p) => ({ xMm: p.xMm, yMm: p.yMm }));
    }
    // Fallback 4000x3500mm room if no polygon provided
    return [
      { xMm: 0, yMm: 0 },
      { xMm: 4000, yMm: 0 },
      { xMm: 4000, yMm: 3500 },
      { xMm: 0, yMm: 3500 }
    ];
  }, [roomPolygon]);

  // Initial State Setup
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    initialSurface?.materialVersionId || TILE_PRESETS[0].id
  );
  const [substrate, setSubstrate] = useState<string>(
    initialSurface?.substrate || 'PCC / Concrete Screed (40mm - Standard Slab)'
  );
  const [elevationMm, setElevationMm] = useState<number>(initialSurface?.elevationMm ?? 0);
  const [buildUpThicknessMm, setBuildUpThicknessMm] = useState<number>(
    initialSurface?.buildUpThicknessMm ?? 15
  );

  // Tile configuration
  const [tileWidthMm, setTileWidthMm] = useState<number>(
    initialSurface?.tile?.widthMm ?? TILE_PRESETS[0].widthMm
  );
  const [tileLengthMm, setTileLengthMm] = useState<number>(
    initialSurface?.tile?.lengthMm ?? TILE_PRESETS[0].lengthMm
  );
  const [pattern, setPattern] = useState<'grid' | 'brick'>(
    initialSurface?.tile?.pattern ?? TILE_PRESETS[0].defaultPattern
  );
  const [angleDeg, setAngleDeg] = useState<number>(initialSurface?.tile?.angleDeg ?? 0);
  const [groutWidthMm, setGroutWidthMm] = useState<number>(
    initialSurface?.tile?.groutWidthMm ?? TILE_PRESETS[0].defaultGroutMm
  );
  const [groutColor, setGroutColor] = useState<string>(
    initialSurface?.tile?.groutColor ?? GROUT_COLORS[0].hex
  );
  const [originX, setOriginX] = useState<number>(initialSurface?.tile?.originX ?? 0);
  const [originY, setOriginY] = useState<number>(initialSurface?.tile?.originY ?? 0);

  // Skirting configuration
  const [hasSkirting, setHasSkirting] = useState<boolean>(Boolean(initialSurface?.skirting));
  const [skirtingHeightMm, setSkirtingHeightMm] = useState<number>(
    initialSurface?.skirting?.heightMm ?? 100
  );
  const [skirtingProfile, setSkirtingProfile] = useState<string>(
    initialSurface?.skirting?.profile ?? 'recessed-shadowline-15mm'
  );

  // Doorway exclusions
  const doorwayExclusions = useMemo(() => {
    return doorOpenings.map((d) => ({
      startMm: d.offsetAlongWallMm,
      endMm: d.offsetAlongWallMm + (d.widthMm || 900)
    }));
  }, [doorOpenings]);

  // Assemble Canonical FloorSurfaceV1
  const currentSurface: FloorSurfaceV1 = useMemo(() => {
    return {
      id: initialSurface?.id || `floor-${roomId}`,
      roomId,
      materialVersionId: selectedPresetId,
      regionPolygon: canonicalPolygon,
      elevationMm,
      buildUpThicknessMm,
      substrate,
      tile: {
        widthMm: Math.max(50, tileWidthMm),
        lengthMm: Math.max(50, tileLengthMm),
        groutWidthMm: Math.max(0, groutWidthMm),
        groutColor,
        originX,
        originY,
        angleDeg,
        pattern
      },
      skirting: hasSkirting
        ? {
            heightMm: Math.max(20, skirtingHeightMm),
            profile: skirtingProfile,
            doorwayExclusions
          }
        : undefined
    };
  }, [
    initialSurface?.id,
    roomId,
    selectedPresetId,
    canonicalPolygon,
    elevationMm,
    buildUpThicknessMm,
    substrate,
    tileWidthMm,
    tileLengthMm,
    groutWidthMm,
    groutColor,
    originX,
    originY,
    angleDeg,
    pattern,
    hasSkirting,
    skirtingHeightMm,
    skirtingProfile,
    doorwayExclusions
  ]);

  // Compute Canonical Quantities using @ultida/contracts
  const quantity: FlooringQuantityV1 = useMemo(() => {
    const results = buildFlooringQuantities([currentSurface]);
    return (
      results[0] || {
        surfaceId: currentSurface.id,
        roomId: currentSurface.roomId,
        materialVersionId: currentSurface.materialVersionId,
        netAreaSqm: roomAreaSqm || 0,
        fullTileCount: 0,
        cutTileCount: 0,
        totalTileCount: 0,
        wastagePct: 0,
        skirtingLinearM: 0,
        tilePlacements: []
      }
    );
  }, [currentSurface, roomAreaSqm]);

  // Notify parent on change
  useEffect(() => {
    onSurfaceChange?.(currentSurface, quantity);
  }, [currentSurface, quantity, onSurfaceChange]);

  // Preset Selection Handler
  const handleSelectPreset = (preset: TilePreset) => {
    setSelectedPresetId(preset.id);
    setTileWidthMm(preset.widthMm);
    setTileLengthMm(preset.lengthMm);
    setPattern(preset.defaultPattern);
    setGroutWidthMm(preset.defaultGroutMm);
    setBuildUpThicknessMm(preset.thicknessMm + 6); // tile + adhesive bed
  };

  // SVG Dimension Calculations
  const { minX, maxX, minY, maxY, widthSpan, heightSpan } = useMemo(() => {
    const xs = canonicalPolygon.map((p) => p.xMm);
    const ys = canonicalPolygon.map((p) => p.yMm);
    const mnX = Math.min(...xs);
    const mxX = Math.max(...xs);
    const mnY = Math.min(...ys);
    const mxY = Math.max(...ys);
    return {
      minX: mnX,
      maxX: mxX,
      minY: mnY,
      maxY: mxY,
      widthSpan: Math.max(100, mxX - mnX),
      heightSpan: Math.max(100, mxY - mnY)
    };
  }, [canonicalPolygon]);

  const svgPadding = 40;
  const viewBoxWidth = widthSpan + svgPadding * 2;
  const viewBoxHeight = heightSpan + svgPadding * 2;

  // Active Tile Preset
  const activePreset = TILE_PRESETS.find((p) => p.id === selectedPresetId);
  const activeCoverage = activePreset?.packCoverageSqm || (tileWidthMm * tileLengthMm * 4) / 1_000_000;
  const packsRecommended = Math.ceil(
    (quantity.totalTileCount * (tileWidthMm * tileLengthMm)) / 1_000_000 / Math.max(0.1, activeCoverage)
  );

  return (
    <div className="flooring-studio-container">
      {/* Header */}
      <div className="fs-header">
        <div>
          <div className="fs-header-title">
            <Grid size={16} />
            <span>Flooring &amp; Skirting Studio &mdash; {roomName}</span>
          </div>
          <p className="fs-header-sub">
            Planar surface generation, cut-tile boundary optimization, and doorway-deducted skirting specification.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => {
              const text = `FLOORING SPECIFICATION — ${roomName.toUpperCase()}\n` +
                `Material: ${activePreset?.name ?? selectedPresetId}\n` +
                `Tile Size: ${tileWidthMm} × ${tileLengthMm} mm (${pattern} bond, ${angleDeg}°)\n` +
                `Net Area: ${quantity.netAreaSqm} m² (${(quantity.netAreaSqm * 10.7639).toFixed(1)} sq.ft)\n` +
                `Tile Count: ${quantity.totalTileCount} (${quantity.fullTileCount} full, ${quantity.cutTileCount} cut)\n` +
                `Wastage: ${quantity.wastagePct}%\n` +
                `Order Recommendation: ${packsRecommended} boxes\n` +
                `Skirting: ${quantity.skirtingLinearM} running meters (${skirtingHeightMm}mm ${skirtingProfile})\n` +
                `Substrate: ${substrate} (Build-up: ${buildUpThicknessMm}mm, FFL: ${elevationMm > 0 ? `+${elevationMm}` : elevationMm}mm)`;
              void navigator.clipboard?.writeText(text);
              setCopiedNotice(true);
              setTimeout(() => setCopiedNotice(false), 2500);
            }}
            title="Copy architectural bill of quantities to clipboard"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <Download size={13} /> {copiedNotice ? '✓ Copied BOM' : 'Copy BOM'}
          </button>
          {onSave && (
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => onSave(currentSurface, quantity)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <Check size={13} /> Commit Flooring
            </button>
          )}
        </div>
      </div>

      {/* Real-time Analytics & Bill of Quantities Grid */}
      <div className="fs-metrics-grid">
        <div className="fs-metric-card">
          <span className="fs-metric-label">Net Floor Area</span>
          <div className="fs-metric-val">
            {quantity.netAreaSqm} <small>m²</small>
          </div>
          <span className="fs-metric-badge fs-badge-gold">
            {(quantity.netAreaSqm * 10.7639).toFixed(1)} sq.ft
          </span>
        </div>

        <div className="fs-metric-card">
          <span className="fs-metric-label">Tiles: Full / Cut</span>
          <div className="fs-metric-val">
            {quantity.fullTileCount} <small>full</small> / {quantity.cutTileCount} <small>cut</small>
          </div>
          <span className="fs-metric-badge fs-badge-emerald">
            <Package size={11} /> {quantity.totalTileCount} Total Tiles
          </span>
        </div>

        <div className="fs-metric-card">
          <span className="fs-metric-label">Wastage Allowance</span>
          <div className="fs-metric-val">
            {quantity.wastagePct}% <small>margin</small>
          </div>
          <span className={`fs-metric-badge ${quantity.wastagePct > 15 ? 'fs-badge-amber' : 'fs-badge-emerald'}`}>
            <Scissors size={11} /> {packsRecommended} Boxes to Order
          </span>
        </div>

        <div className="fs-metric-card">
          <span className="fs-metric-label">Skirting Run</span>
          <div className="fs-metric-val">
            {quantity.skirtingLinearM} <small>running m</small>
          </div>
          <span className="fs-metric-badge fs-badge-gold">
            {doorOpenings.length} Doorway Exclusions
          </span>
        </div>
      </div>

      {/* Interactive Visual Canvas */}
      <div className="fs-canvas-container">
        <div className="fs-canvas-toolbar">
          <div className="fs-canvas-legend">
            <div className="fs-legend-item">
              <span className="fs-legend-dot fs-dot-full" />
              <span>Full Tile ({quantity.fullTileCount})</span>
            </div>
            <div className="fs-legend-item">
              <span className="fs-legend-dot fs-dot-cut" />
              <span>Cut Boundary Tile ({quantity.cutTileCount})</span>
            </div>
            <div className="fs-legend-item">
              <span className="fs-legend-dot fs-dot-skirting" />
              <span>Skirting Perimeter</span>
            </div>
          </div>
          <div style={{ color: 'var(--gold)', fontSize: 11, fontWeight: 600 }}>
            {tileWidthMm} &times; {tileLengthMm} mm &bull; {pattern.toUpperCase()} &bull; {angleDeg}&deg;
          </div>
        </div>

        <svg
          className="fs-canvas-svg"
          viewBox={`${minX - svgPadding} ${minY - svgPadding} ${viewBoxWidth} ${viewBoxHeight}`}
          preserveAspectRatio="xMidYMid meet"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            const worldX = minX - svgPadding + (clickX / rect.width) * viewBoxWidth;
            const worldY = minY - svgPadding + (clickY / rect.height) * viewBoxHeight;
            setOriginX(Math.round(worldX));
            setOriginY(Math.round(worldY));
          }}
        >
          <defs>
            <filter id="tile-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.5" />
            </filter>
            <clipPath id="room-polygon-clip">
              <polygon points={canonicalPolygon.map((p) => `${p.xMm},${p.yMm}`).join(' ')} />
            </clipPath>
          </defs>

          {/* Subfloor / Substrate Background */}
          <polygon
            points={canonicalPolygon.map((p) => `${p.xMm},${p.yMm}`).join(' ')}
            fill="#131922"
            stroke="#283545"
            strokeWidth={2}
          />

          {/* Rendered Tile Placements from buildFlooringQuantities */}
          <g clipPath="url(#room-polygon-clip)">
            {quantity.tilePlacements.map((tile, idx) => {
              const isCut = tile.kind === 'cut';
              return (
                <rect
                  key={`${tile.row}-${tile.column}-${idx}`}
                  x={tile.originMm.xMm}
                  y={tile.originMm.yMm}
                  width={tileWidthMm}
                  height={tileLengthMm}
                  transform={`rotate(${angleDeg}, ${tile.originMm.xMm}, ${tile.originMm.yMm})`}
                  fill={isCut ? 'rgba(245, 158, 11, 0.2)' : activePreset ? `${activePreset.previewColor}35` : 'rgba(56, 189, 248, 0.08)'}
                  stroke={isCut ? '#f59e0b' : activePreset?.category === 'wood' ? '#a06e42' : '#38bdf8'}
                  strokeWidth={groutWidthMm > 0 ? 1 : 0.5}
                  strokeOpacity={isCut ? 0.85 : 0.45}
                />
              );
            })}
          </g>

          {/* Canonical Room Boundary with Skirting */}
          <polygon
            points={canonicalPolygon.map((p) => `${p.xMm},${p.yMm}`).join(' ')}
            fill="none"
            stroke={hasSkirting ? 'var(--gold, #d4af37)' : '#64748b'}
            strokeWidth={3}
          />

          {/* Tile Origin Marker */}
          <g transform={`translate(${originX}, ${originY})`}>
            <circle r={7} fill="var(--gold, #d4af37)" opacity={0.9} />
            <circle r={12} fill="none" stroke="var(--gold, #d4af37)" strokeWidth={1.5} strokeDasharray="3 2" />
            <line x1={-15} y1={0} x2={15} y2={0} stroke="#ffffff" strokeWidth={1.5} />
            <line x1={0} y1={-15} x2={0} y2={15} stroke="#ffffff" strokeWidth={1.5} />
          </g>
        </svg>

        <div className="fs-canvas-hint">
          <span>Click anywhere in room to reposition tile origin point &bull; Current: ({originX}, {originY}) mm</span>
          <button
            type="button"
            className="btn-link"
            style={{ color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}
            onClick={() => {
              setOriginX(0);
              setOriginY(0);
            }}
          >
            Reset Origin to (0,0)
          </button>
        </div>
      </div>

      {/* Preset Tile & Plank Selector */}
      <div className="fs-section-card">
        <div className="fs-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} color="var(--gold)" />
            <span>Curated Architectural Tile &amp; Plank Presets</span>
          </div>
          <span style={{ fontSize: 11, color: '#9ba8b7' }}>System 32 &amp; IS Compliant</span>
        </div>

        <div className="fs-preset-grid">
          {TILE_PRESETS.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <div
                key={preset.id}
                className={`fs-preset-card ${isSelected ? 'active' : ''}`}
                onClick={() => handleSelectPreset(preset)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      background: preset.previewColor,
                      border: '1px solid #4a5c70',
                      flexShrink: 0
                    }}
                  />
                  <span className="fs-preset-name">{preset.name}</span>
                </div>
                <div className="fs-preset-dims">
                  <span>{preset.widthMm} &times; {preset.lengthMm} mm</span>
                  <span style={{ textTransform: 'capitalize', color: 'var(--gold)' }}>{preset.category}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tile & Pattern Configuration */}
      <div className="fs-section-card">
        <div className="fs-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sliders size={14} color="var(--gold)" />
            <span>Tile Dimensions, Laying Pattern &amp; Orientation</span>
          </div>
        </div>

        <div className="fs-form-row">
          <div className="fs-form-col">
            <label>Width (mm)</label>
            <input
              type="number"
              className="fs-input"
              value={tileWidthMm}
              onChange={(e) => setTileWidthMm(parseInt(e.target.value, 10) || 600)}
            />
          </div>
          <div className="fs-form-col">
            <label>Length (mm)</label>
            <input
              type="number"
              className="fs-input"
              value={tileLengthMm}
              onChange={(e) => setTileLengthMm(parseInt(e.target.value, 10) || 600)}
            />
          </div>
        </div>

        <div className="fs-form-row">
          <div className="fs-form-col">
            <label>Bond / Laying Pattern</label>
            <div className="fs-segmented">
              <button
                type="button"
                className={`fs-seg-btn ${pattern === 'grid' ? 'active' : ''}`}
                onClick={() => setPattern('grid')}
              >
                <Grid size={12} /> Stack Bond (Grid)
              </button>
              <button
                type="button"
                className={`fs-seg-btn ${pattern === 'brick' ? 'active' : ''}`}
                onClick={() => setPattern('brick')}
              >
                <Maximize2 size={12} /> Running Bond (Brick 50%)
              </button>
            </div>
          </div>

          <div className="fs-form-col">
            <label>Laying Angle: {angleDeg}&deg;</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="range"
                min="0"
                max="90"
                step="5"
                value={angleDeg}
                onChange={(e) => setAngleDeg(parseInt(e.target.value, 10) || 0)}
                style={{ flex: 1, accentColor: 'var(--gold, #d4af37)' }}
              />
              <button
                type="button"
                className="btn-secondary btn-sm"
                style={{ padding: '4px 8px', fontSize: 10.5 }}
                onClick={() => setAngleDeg(angleDeg === 45 ? 0 : 45)}
              >
                <RotateCw size={11} /> {angleDeg === 45 ? '0° Ortho' : '45° Diagonal'}
              </button>
            </div>
          </div>
        </div>

        <div className="fs-form-row">
          <div className="fs-form-col">
            <label>Grout Joint Width</label>
            <select
              className="fs-select"
              value={groutWidthMm}
              onChange={(e) => setGroutWidthMm(parseFloat(e.target.value) || 2)}
            >
              <option value="1">1.0 mm (Rectified Razor Joint)</option>
              <option value="2">2.0 mm (Standard Vitrified Spacer)</option>
              <option value="3">3.0 mm (Porcelain / Heavy Footfall)</option>
              <option value="5">5.0 mm (Rustic / Natural Stone)</option>
            </select>
          </div>

          <div className="fs-form-col">
            <label>Epoxy Grout Color</label>
            <div className="fs-color-swatches">
              {GROUT_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.label}
                  className={`fs-swatch-btn ${groutColor === c.hex ? 'active' : ''}`}
                  style={{ background: c.hex }}
                  onClick={() => setGroutColor(c.hex)}
                />
              ))}
              <input
                type="color"
                value={groutColor}
                onChange={(e) => setGroutColor(e.target.value)}
                style={{ width: 26, height: 26, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Substrate & Level Control */}
      <div className="fs-section-card">
        <div className="fs-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={14} color="var(--gold)" />
            <span>Subfloor Substrate &amp; Finished Floor Level (FFL)</span>
          </div>
        </div>

        <div className="fs-form-row">
          <div className="fs-form-col">
            <label>Substrate Preparation</label>
            <select
              className="fs-select"
              value={substrate}
              onChange={(e) => setSubstrate(e.target.value)}
            >
              <option value="PCC / Concrete Screed (40mm - Standard Slab)">
                PCC / Concrete Screed (40mm - Standard Slab)
              </option>
              <option value="Self-Levelling Polymer Screed (15mm)">
                Self-Levelling Polymer Screed (15mm)
              </option>
              <option value="Pre-Existing Tile Overlay with Araldite/Adhesive">
                Pre-Existing Tile Overlay with Araldite/Adhesive
              </option>
              <option value="Calibrated Marine Ply Subfloor (18mm IS-710)">
                Calibrated Marine Ply Subfloor (18mm IS-710)
              </option>
              <option value="Cement Particle Board / Dry Screed">
                Cement Particle Board / Dry Screed
              </option>
            </select>
          </div>

          <div className="fs-form-col">
            <label>Build-up Thickness (Tile + Bed)</label>
            <select
              className="fs-select"
              value={buildUpThicknessMm}
              onChange={(e) => setBuildUpThicknessMm(parseInt(e.target.value, 10) || 15)}
            >
              <option value="12">12 mm (Slim Porcelain + Thin-Bed Adhesive)</option>
              <option value="15">15 mm (Standard Vitrified + Polymer Adhesive)</option>
              <option value="20">20 mm (Natural Marble + 10mm Mortar Bed)</option>
              <option value="25">25 mm (Heavy Granite / Sandstone Slabs)</option>
            </select>
          </div>
        </div>

        <div className="fs-form-row">
          <div className="fs-form-col">
            <label>Finished Floor Level Elevation Relative to Datum</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[-15, 0, 15, 25].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  className={`btn-secondary btn-sm ${elevationMm === lvl ? 'active' : ''}`}
                  style={{
                    flex: 1,
                    borderColor: elevationMm === lvl ? 'var(--gold)' : undefined,
                    color: elevationMm === lvl ? 'var(--gold)' : undefined
                  }}
                  onClick={() => setElevationMm(lvl)}
                >
                  {lvl > 0 ? `+${lvl}` : lvl} mm
                </button>
              ))}
            </div>
          </div>
          <div className="fs-form-col">
            <label>Elevation Offset Note</label>
            <span style={{ fontSize: 11, color: '#8fa0b2', marginTop: 6 }}>
              {elevationMm < 0
                ? 'Sunken drop level for wet bathroom / balcony runoff isolation.'
                : elevationMm > 0
                ? 'Elevated threshold step or acoustic sub-base platform.'
                : 'Standard co-planar architectural floor datum across residence.'}
            </span>
          </div>
        </div>
      </div>

      {/* Skirting Specification */}
      <div className="fs-section-card">
        <div className="fs-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Ruler size={14} color="var(--gold)" />
            <span>Perimeter Skirting Profile &amp; Door Deductions</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={hasSkirting}
              onChange={(e) => setHasSkirting(e.target.checked)}
            />
            <span>Include Skirting</span>
          </label>
        </div>

        {hasSkirting && (
          <>
            <div className="fs-form-row">
              <div className="fs-form-col">
                <label>Skirting Height</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[75, 100, 120, 150].map((h) => (
                    <button
                      key={h}
                      type="button"
                      className={`btn-secondary btn-sm ${skirtingHeightMm === h ? 'active' : ''}`}
                      style={{
                        flex: 1,
                        borderColor: skirtingHeightMm === h ? 'var(--gold)' : undefined,
                        color: skirtingHeightMm === h ? 'var(--gold)' : undefined
                      }}
                      onClick={() => setSkirtingHeightMm(h)}
                    >
                      {h} mm
                    </button>
                  ))}
                </div>
              </div>

              <div className="fs-form-col">
                <label>Architectural Skirting Profile</label>
                <select
                  className="fs-select"
                  value={skirtingProfile}
                  onChange={(e) => setSkirtingProfile(e.target.value)}
                >
                  <option value="recessed-shadowline-15mm">
                    Recessed Shadowline (15mm Aluminium Profile)
                  </option>
                  <option value="flush-groove-skirting">
                    Flush Plaster Skirting with 5mm V-Groove
                  </option>
                  <option value="pencil-round-timber">
                    Pencil Round Hardwood Timber Skirting
                  </option>
                  <option value="bullnose-vitrified">
                    Bullnose Factory Edge Vitrified Skirting
                  </option>
                  <option value="chamfered-mdf-painted">
                    Minimalist 45° Chamfered Painted MDF
                  </option>
                </select>
              </div>
            </div>

            <div className="fs-alert-box">
              <CheckCircle2 size={15} />
              <span>
                <strong>Automatic Door Jamb Deductions Active:</strong> {doorOpenings.length} door openings deducted from perimeter. Total net skirting linear length is <strong>{quantity.skirtingLinearM} m</strong>.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FlooringStudio;
