import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Layers,
  RotateCw,
  Trash2,
  Maximize2,
  CheckCircle2,
  Download,
  Plus,
  Compass,
  DollarSign,
  Grid,
  Palette,
} from 'lucide-react';

export type FlooringType =
  | 'herringbone_oak'
  | 'italian_travertine'
  | 'seamless_microcement'
  | 'calacatta_marble'
  | 'smoked_walnut_plank';

export interface FlooringOption {
  id: FlooringType;
  name: string;
  category: 'Wood' | 'Stone' | 'Seamless';
  ratePerSqFt: number;
  patternHex: string;
  subPatternHex: string;
  textureLabel: string;
}

export interface TopViewFurniture {
  id: string;
  name: string;
  category: 'seating' | 'modular_storage' | 'dining' | 'bed' | 'table' | 'anti_gravity';
  widthMm: number;
  depthMm: number;
  xMm: number;
  yMm: number;
  rotationDeg: number;
  unitPrice: number;
  isFloating: boolean;
  semanticColor: string; // ADE20K / ControlNet semantic mask RGB
}

export interface RoomZone {
  id: string;
  name: string;
  widthMm: number;
  lengthMm: number;
  flooring: FlooringType;
}

export const FLOORING_CATALOG: Record<FlooringType, FlooringOption> = {
  herringbone_oak: {
    id: 'herringbone_oak',
    name: 'French Light Oak Herringbone',
    category: 'Wood',
    ratePerSqFt: 9.5,
    patternHex: '#d8c4aa',
    subPatternHex: '#c7b297',
    textureLabel: '90° Interlocking Chevron',
  },
  italian_travertine: {
    id: 'italian_travertine',
    name: 'Honed Roman Travertine (600×1200)',
    category: 'Stone',
    ratePerSqFt: 14.0,
    patternHex: '#e3dcce',
    subPatternHex: '#c8beac',
    textureLabel: 'Cross-Cut Matte Finish',
  },
  seamless_microcement: {
    id: 'seamless_microcement',
    name: 'Zero-G Warm Greige Microcement',
    category: 'Seamless',
    ratePerSqFt: 7.8,
    patternHex: '#99948d',
    subPatternHex: '#8a857e',
    textureLabel: 'Continuous Monolithic Layer',
  },
  calacatta_marble: {
    id: 'calacatta_marble',
    name: 'Calacatta Gold Polished Slabs',
    category: 'Stone',
    ratePerSqFt: 22.0,
    patternHex: '#f0efe9',
    subPatternHex: '#cfcbbd',
    textureLabel: 'Bookmatched Gold Veining',
  },
  smoked_walnut_plank: {
    id: 'smoked_walnut_plank',
    name: 'Smoked American Walnut Planks',
    category: 'Wood',
    ratePerSqFt: 11.5,
    patternHex: '#5c4636',
    subPatternHex: '#453326',
    textureLabel: '200mm Wide Long Plank',
  },
};

export const FURNITURE_PRESETS: Omit<TopViewFurniture, 'id' | 'xMm' | 'yMm' | 'rotationDeg'>[] = [
  {
    name: 'Curved Bouclé Sectional Sofa',
    category: 'seating',
    widthMm: 2800,
    depthMm: 1600,
    unitPrice: 1850,
    isFloating: false,
    semanticColor: '#3366cc', // Blue for Seating
  },
  {
    name: 'Travertine Organic Coffee Table',
    category: 'table',
    widthMm: 1200,
    depthMm: 800,
    unitPrice: 650,
    isFloating: false,
    semanticColor: '#990099', // Purple for Tables
  },
  {
    name: 'Floating Modular TV Console (Anti-Gravity)',
    category: 'modular_storage',
    widthMm: 2400,
    depthMm: 450,
    unitPrice: 920,
    isFloating: true,
    semanticColor: '#ff9900', // Orange for Storage
  },
  {
    name: '6-Seater Fluted Dining Table',
    category: 'dining',
    widthMm: 2100,
    depthMm: 1000,
    unitPrice: 1200,
    isFloating: false,
    semanticColor: '#990099',
  },
  {
    name: 'King Bed + Floating Nightstands',
    category: 'bed',
    widthMm: 2600,
    depthMm: 2200,
    unitPrice: 2100,
    isFloating: false,
    semanticColor: '#cc0000', // Red for Beds
  },
  {
    name: 'Overhead Suspended Track Rail Planter',
    category: 'anti_gravity',
    widthMm: 1800,
    depthMm: 350,
    unitPrice: 480,
    isFloating: true,
    semanticColor: '#109618', // Green for Botanical/Overhead
  },
];

export interface TopViewFloorplanEnhancerProps {
  initialRoom?: RoomZone;
  initialItems?: TopViewFurniture[];
  onGenerateRender?: (payload: {
    semanticMapBase64: string;
    stylePrompt: string;
    bomTotal: number;
    flooringSqFt: number;
  }) => void;
}

export default function TopViewFloorplanEnhancer({
  initialRoom = {
    id: 'zone-1',
    name: 'Open Living & Dining Space',
    widthMm: 6500,
    lengthMm: 5000,
    flooring: 'herringbone_oak',
  },
  initialItems,
  onGenerateRender,
}: TopViewFloorplanEnhancerProps) {
  const [room, setRoom] = useState<RoomZone>(initialRoom);
  const [items, setItems] = useState<TopViewFurniture[]>(
    initialItems ?? [
      {
        id: 'item-1',
        name: 'Curved Bouclé Sectional Sofa',
        category: 'seating',
        widthMm: 2800,
        depthMm: 1600,
        xMm: 1400,
        yMm: 1200,
        rotationDeg: 0,
        unitPrice: 1850,
        isFloating: false,
        semanticColor: '#3366cc',
      },
      {
        id: 'item-2',
        name: 'Travertine Organic Coffee Table',
        category: 'table',
        widthMm: 1200,
        depthMm: 800,
        xMm: 2200,
        yMm: 2400,
        rotationDeg: 15,
        unitPrice: 650,
        isFloating: false,
        semanticColor: '#990099',
      },
      {
        id: 'item-3',
        name: 'Floating Modular TV Console (Anti-Gravity)',
        category: 'modular_storage',
        widthMm: 2400,
        depthMm: 450,
        xMm: 1600,
        yMm: 200,
        rotationDeg: 0,
        unitPrice: 920,
        isFloating: true,
        semanticColor: '#ff9900',
      },
    ]
  );

  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ------------------------------------------
  // CALCULATED METRICS & DYNAMIC BOM
  // ------------------------------------------
  const metrics = useMemo(() => {
    const areaSqM = (room.widthMm / 1000) * (room.lengthMm / 1000);
    const areaSqFt = areaSqM * 10.7639;
    const flooringData = FLOORING_CATALOG[room.flooring] ?? FLOORING_CATALOG.herringbone_oak;
    const flooringCost = areaSqFt * flooringData.ratePerSqFt;
    const furnitureCost = items.reduce((sum, item) => sum + item.unitPrice, 0);
    const installationLabor = areaSqFt * 1.8; // $1.80/sqft base contractor fitting
    const totalBOM = flooringCost + furnitureCost + installationLabor;

    return {
      areaSqFt: Math.round(areaSqFt),
      areaSqM: areaSqM.toFixed(1),
      flooringCost: Math.round(flooringCost),
      furnitureCost: Math.round(furnitureCost),
      installationLabor: Math.round(installationLabor),
      totalBOM: Math.round(totalBOM),
    };
  }, [room, items]);

  const selectedItem = items.find((it) => it.id === selectedId);

  // ------------------------------------------
  // TOP-DOWN 2D CANVAS DRAWING PIPELINE
  // ------------------------------------------
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const scaleX = width / room.widthMm;
    const scaleY = height / room.lengthMm;

    // 1. Draw Flooring Background & Texture Pattern
    const flooring = FLOORING_CATALOG[room.flooring] ?? FLOORING_CATALOG.herringbone_oak;
    ctx.fillStyle = flooring.patternHex;
    ctx.fillRect(0, 0, width, height);

    // Procedural Floor Grid / Herringbone Sub-Lines
    ctx.strokeStyle = flooring.subPatternHex;
    ctx.lineWidth = 1;

    if (room.flooring === 'herringbone_oak') {
      const step = 28;
      ctx.beginPath();
      for (let x = 0; x < width; x += step) {
        for (let y = 0; y < height; y += step) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + step / 2, y + step / 2);
          ctx.moveTo(x + step / 2, y + step / 2);
          ctx.lineTo(x, y + step);
        }
      }
      ctx.stroke();
    } else if (room.flooring === 'italian_travertine' || room.flooring === 'calacatta_marble') {
      const tileW = 600 * scaleX;
      const tileH = 1200 * scaleY;
      ctx.beginPath();
      for (let x = 0; x < width; x += tileW) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += tileH) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    }

    // 2. Draw Outer Boundary Walls
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, width - 12, height - 12);

    // 3. Draw Placed Furniture Items (Top-Down Footprints)
    items.forEach((item) => {
      const isSelected = item.id === selectedId;
      const cx = (item.xMm + item.widthMm / 2) * scaleX;
      const cy = (item.yMm + item.depthMm / 2) * scaleY;
      const w = item.widthMm * scaleX;
      const h = item.depthMm * scaleY;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((item.rotationDeg * Math.PI) / 180);

      // Drop Shadow
      if (item.isFloating) {
        ctx.shadowColor = 'rgba(16, 185, 129, 0.35)'; // Emerald glow for Anti-Gravity
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 6;
      } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
      }

      // Furniture Body Fill
      ctx.fillStyle = isSelected ? '#27272a' : '#1f1f23';
      ctx.beginPath();
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(-w / 2, -h / 2, w, h, 8);
      } else {
        ctx.rect(-w / 2, -h / 2, w, h);
      }
      ctx.fill();

      // Border & Active Selection Ring
      ctx.lineWidth = isSelected ? 2.5 : 1;
      ctx.strokeStyle = isSelected ? '#34d399' : item.isFloating ? '#10b981' : '#52525b';
      ctx.stroke();

      // Top-Down Detail Accents
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = isSelected ? '#34d399' : '#a1a1aa';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.name.split(' ')[0], 0, -4);

      ctx.font = '9px monospace';
      ctx.fillStyle = '#71717a';
      ctx.fillText(`${item.widthMm}×${item.depthMm}`, 0, 10);

      if (item.isFloating) {
        ctx.fillStyle = '#10b981';
        ctx.font = '8px sans-serif';
        ctx.fillText('▲ ANTI-GRAVITY', 0, -h / 2 + 10);
      }

      ctx.restore();
    });
  }, [room, items, selectedId]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // ------------------------------------------
  // INTERACTION HANDLERS (DRAG / DROP / ROTATE)
  // ------------------------------------------
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { xMm: 0, yMm: 0 };
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const xMm = (clickX / canvas.width) * room.widthMm;
    const yMm = (clickY / canvas.height) * room.lengthMm;
    return { xMm, yMm };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { xMm, yMm } = getCanvasCoordinates(e);
    const clickedItem = [...items].reverse().find((it) => {
      return (
        xMm >= it.xMm &&
        xMm <= it.xMm + it.widthMm &&
        yMm >= it.yMm &&
        yMm <= it.yMm + it.depthMm
      );
    });

    if (clickedItem) {
      setSelectedId(clickedItem.id);
      setIsDragging(true);
      setDragOffset({
        x: xMm - clickedItem.xMm,
        y: yMm - clickedItem.yMm,
      });
    } else {
      setSelectedId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedId) return;
    const { xMm, yMm } = getCanvasCoordinates(e);
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== selectedId) return it;
        const newX = Math.max(0, Math.min(room.widthMm - it.widthMm, xMm - dragOffset.x));
        const newY = Math.max(0, Math.min(room.lengthMm - it.depthMm, yMm - dragOffset.y));
        return { ...it, xMm: Math.round(newX), yMm: Math.round(newY) };
      })
    );
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleRotate = () => {
    if (!selectedId) return;
    setItems((prev) =>
      prev.map((it) => (it.id === selectedId ? { ...it, rotationDeg: (it.rotationDeg + 45) % 360 } : it))
    );
  };

  const handleDelete = () => {
    if (!selectedId) return;
    setItems((prev) => prev.filter((it) => it.id !== selectedId));
    setSelectedId(null);
  };

  const handleAddPreset = (preset: (typeof FURNITURE_PRESETS)[0]) => {
    const newItem: TopViewFurniture = {
      ...preset,
      id: `item-${Date.now()}`,
      xMm: Math.round(room.widthMm / 2 - preset.widthMm / 2),
      yMm: Math.round(room.lengthMm / 2 - preset.depthMm / 2),
      rotationDeg: 0,
    };
    setItems([...items, newItem]);
    setSelectedId(newItem.id);
  };

  // ------------------------------------------
  // EXPORT COLOR-CODED CONTROLNET MAP
  // ------------------------------------------
  const generateSemanticControlNetMap = (): string => {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 1024;
    offCanvas.height = Math.round((1024 * room.lengthMm) / room.widthMm);
    const ctx = offCanvas.getContext('2d')!;

    // Black floor base
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);

    const sX = offCanvas.width / room.widthMm;
    const sY = offCanvas.height / room.lengthMm;

    // Render solid color bounding footprints for diffusion segment models
    items.forEach((item) => {
      const cx = (item.xMm + item.widthMm / 2) * sX;
      const cy = (item.yMm + item.depthMm / 2) * sY;
      const w = item.widthMm * sX;
      const h = item.depthMm * sY;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((item.rotationDeg * Math.PI) / 180);
      ctx.fillStyle = item.semanticColor;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    });

    return offCanvas.toDataURL('image/png');
  };

  const triggerAIEnhance = () => {
    const semanticMapBase64 = generateSemanticControlNetMap();
    const flooring = FLOORING_CATALOG[room.flooring] ?? FLOORING_CATALOG.herringbone_oak;
    const prompt = `Photorealistic architectural 3D top-down floor plan render, ${flooring.name} surface with realistic specular reflections, soft ambient global illumination, bouclé textures, warm 3000K sunlight through south windows, highly detailed interior photography 8k, architectural digest`;

    onGenerateRender?.({
      semanticMapBase64,
      stylePrompt: prompt,
      bomTotal: metrics.totalBOM,
      flooringSqFt: metrics.areaSqFt,
    });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 24, padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* LEFT: 2D TOP-DOWN FLOORPLAN CANVAS WORKSPACE */}
      <div style={{ background: '#1c1917', border: '1px solid #332d29', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, color: '#f5f0e8' }}>
        {/* Top Action Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #332d29', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399' }}>
              <Compass size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Studio 1: Top-View Floorplan Stager</h2>
              <p style={{ fontSize: 11, color: '#a8a29e', margin: '2px 0 0' }}>
                Floor Area: <strong style={{ color: '#fff' }}>{metrics.areaSqFt} sq.ft</strong> ({metrics.areaSqM} m²) · {items.length} Active Modules
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {selectedItem && (
              <>
                <button
                  type="button"
                  onClick={handleRotate}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#292524', border: '1px solid #44403c', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                >
                  <RotateCw size={13} color="#34d399" /> Rotate 45°
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                >
                  <Trash2 size={13} /> Remove
                </button>
              </>
            )}
          </div>
        </div>

        {/* Interactive Top-Down Canvas */}
        <div style={{ position: 'relative', width: '100%', height: 420, background: '#12100e', borderRadius: 12, border: '1px solid #292524', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <canvas
            ref={canvasRef}
            width={1000}
            height={680}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'crosshair' }}
          />

          {/* Orientation Compass Overlay */}
          <div style={{ position: 'absolute', top: 16, right: 16, padding: '6px 10px', borderRadius: 8, background: 'rgba(41, 37, 36, 0.9)', border: '1px solid #44403c', fontSize: 10, fontFamily: 'monospace', color: '#a8a29e', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, pointerEvents: 'none' }}>
            <span style={{ color: '#34d399', fontWeight: 700 }}>N</span>
            <div style={{ width: 14, height: 14, borderTop: '2px solid #34d399', borderRadius: '50%' }} />
            <span>S</span>
          </div>
        </div>

        {/* Quick Add Staging Modules Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#d6d3d1', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} color="#34d399" /> Add Staging Module (Footprint Snap)
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
            {FURNITURE_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAddPreset(preset)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '8px 10px',
                  background: '#292524',
                  border: '1px solid #44403c',
                  borderRadius: 8,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: '#f5f0e8',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                  {preset.name}
                </span>
                <span style={{ fontSize: 9.5, color: '#a8a29e', fontFamily: 'monospace', marginTop: 2 }}>
                  {preset.widthMm}×{preset.depthMm}mm
                </span>
                <span style={{ fontSize: 10, color: '#34d399', fontWeight: 700, fontFamily: 'monospace', marginTop: 2 }}>
                  ${preset.unitPrice}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT: FLOORING SELECTOR & DYNAMIC BOM MATRIX */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Flooring Material Picker */}
        <div style={{ background: '#1c1917', border: '1px solid #332d29', borderRadius: 16, padding: 18, color: '#f5f0e8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #332d29', paddingBottom: 10 }}>
            <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#34d399', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
              <Palette size={14} /> Flooring Material Engine
            </h3>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#a8a29e', background: '#292524', padding: '2px 8px', borderRadius: 6, border: '1px solid #44403c' }}>
              {metrics.areaSqFt} Sq.Ft Total
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {Object.values(FLOORING_CATALOG).map((fl) => {
              const isSelected = room.flooring === fl.id;
              return (
                <div
                  key={fl.id}
                  onClick={() => setRoom({ ...room, flooring: fl.id })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 10,
                    borderRadius: 10,
                    border: isSelected ? '1.5px solid #10b981' : '1px solid #332d29',
                    background: isSelected ? '#292524' : 'rgba(41, 37, 36, 0.4)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: fl.patternHex, border: '1px solid rgba(255,255,255,0.1)' }} />
                    <div>
                      <h4 style={{ fontSize: 12, fontWeight: 700, margin: 0, color: '#fff' }}>{fl.name}</h4>
                      <p style={{ fontSize: 10, color: '#a8a29e', margin: '2px 0 0' }}>{fl.textureLabel}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#f5f0e8' }}>
                      ${fl.ratePerSqFt}
                    </span>
                    <span style={{ fontSize: 9.5, color: '#78716c', display: 'block' }}>/sq.ft</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Dynamic BOM (Flooring + Modular Assets) */}
        <div style={{ background: '#1c1917', border: '1px solid #332d29', borderRadius: 16, padding: 18, color: '#f5f0e8', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #332d29', paddingBottom: 10 }}>
            <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
              <DollarSign size={16} color="#34d399" /> Dynamic Flooring & Staging BOM
            </h3>
            <span style={{ fontSize: 10, background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: 999, fontFamily: 'monospace' }}>
              Instant Estimate
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a8a29e' }}>
              <span>Flooring Supply ({metrics.areaSqFt} sq.ft):</span>
              <span style={{ fontFamily: 'monospace', color: '#fff' }}>${metrics.flooringCost}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a8a29e' }}>
              <span>Flooring Base Prep & Fitting:</span>
              <span style={{ fontFamily: 'monospace', color: '#fff' }}>${metrics.installationLabor}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a8a29e' }}>
              <span>Furniture & Modular Units ({items.length} items):</span>
              <span style={{ fontFamily: 'monospace', color: '#fff' }}>${metrics.furnitureCost}</span>
            </div>
            <div style={{ borderTop: '1px solid #332d29', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
              <span>Total Estimated Turnkey:</span>
              <span style={{ fontFamily: 'monospace', color: '#34d399', fontSize: 18 }}>${metrics.totalBOM.toLocaleString()}</span>
            </div>
          </div>

          {/* AI Photorealistic Top-Down Render Trigger */}
          <button
            type="button"
            onClick={triggerAIEnhance}
            style={{
              marginTop: 6,
              padding: '12px 16px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#000',
              fontWeight: 800,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              border: 0,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
            }}
          >
            <Sparkles size={16} />
            Generate Photorealistic 3D Top-View Render
          </button>
        </div>
      </div>
    </div>
  );
}
