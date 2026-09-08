import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Layers,
  Sparkles,
  ShieldCheck,
  MoveVertical,
  Maximize2,
  CheckCircle2,
  Download,
} from 'lucide-react';
import { generateControlNetMaps, type ModularUnit, type WallConfig } from '../../lib/controlnet-generator';

export type CarcassCore = 'HDHMR' | 'BWR_Plywood' | 'MDF' | 'Particle_Board';
export type ShutterFinish = 'fluted_pu' | 'acrylic_gloss' | 'matte_laminate' | 'tinted_glass';
export type UnitCategory = 'base_drawer' | 'single_shutter' | 'double_shutter' | 'open_niche' | 'overhead_loft';

export const CARCASS_RATES: Record<CarcassCore, { name: string; ratePerSqFt: number }> = {
  HDHMR: { name: 'Action TESA HDHMR (Water-Resistant)', ratePerSqFt: 3.8 },
  BWR_Plywood: { name: '710 Grade Boiling Water Resistant Ply', ratePerSqFt: 4.5 },
  MDF: { name: 'High Density Engineered MDF', ratePerSqFt: 2.9 },
  Particle_Board: { name: 'Pre-Laminated Particle Board', ratePerSqFt: 2.2 },
};

export const FINISH_RATES: Record<ShutterFinish, { name: string; ratePerSqFt: number; hex: string }> = {
  fluted_pu: { name: 'Fluted Charcoal PU Paint', ratePerSqFt: 6.5, hex: '#2b2d31' },
  acrylic_gloss: { name: '2mm High-Gloss Anti-Scratch Acrylic', ratePerSqFt: 5.2, hex: '#eaeaea' },
  matte_laminate: { name: '1mm Zero-G Matte Suede Laminate', ratePerSqFt: 3.0, hex: '#8c7a6b' },
  tinted_glass: { name: 'Black Aluminum Profile + Tinted Fluted Glass', ratePerSqFt: 8.0, hex: '#18181b' },
};

export const HARDWARE_PRICING = {
  softCloseHinge: 6.5,
  tandemDrawerChannel: 28.0,
  antiGravityHangingBracket: 14.0, // Heavy duty Camar wall mount kit
};

export interface ModularCabinetBuilderProps {
  initialWall?: WallConfig;
  initialModules?: ModularUnit[];
  onGenerateRender?: (payload: {
    wall: WallConfig;
    modules: ModularUnit[];
    totalCost: number;
    depthMapUrl?: string;
    wireframeUrl?: string;
  }) => void;
}

export default function ModularCabinetBuilder({
  initialWall = { lengthMm: 3600, heightMm: 2800 },
  initialModules,
  onGenerateRender,
}: ModularCabinetBuilderProps) {
  const [wall, setWall] = useState<WallConfig>(initialWall);
  const [modules, setModules] = useState<ModularUnit[]>(
    initialModules ?? [
      {
        id: 'mod-1',
        name: 'Floating 2-Drawer Media Console',
        category: 'base_drawer',
        widthMm: 900,
        heightMm: 360,
        depthMm: 450,
        elevationMm: 350,
        posX: 900,
        carcassCore: 'HDHMR',
        shutterFinish: 'fluted_pu',
        hardware: { hinges: 0, drawerChannels: 2, hangingBrackets: 2 },
      },
      {
        id: 'mod-2',
        name: 'Adjacent Media Base',
        category: 'base_drawer',
        widthMm: 900,
        heightMm: 360,
        depthMm: 450,
        elevationMm: 350,
        posX: 1800,
        carcassCore: 'HDHMR',
        shutterFinish: 'fluted_pu',
        hardware: { hinges: 0, drawerChannels: 2, hangingBrackets: 2 },
      },
      {
        id: 'mod-3',
        name: 'Overhead Tinted Glass Display',
        category: 'overhead_loft',
        widthMm: 600,
        heightMm: 720,
        depthMm: 350,
        elevationMm: 1600,
        posX: 1500,
        carcassCore: 'BWR_Plywood',
        shutterFinish: 'tinted_glass',
        hardware: { hinges: 2, drawerChannels: 0, hangingBrackets: 2 },
      },
    ]
  );

  const [selectedId, setSelectedId] = useState<string | null>(modules[0]?.id ?? null);
  const selectedModule = modules.find((m) => m.id === selectedId);
  const [generatingMaps, setGeneratingMaps] = useState(false);

  // ------------------------------------------
  // DYNAMIC PRICING ENGINE
  // ------------------------------------------
  const pricingBreakdown = useMemo(() => {
    let totalCarcass = 0;
    let totalShutters = 0;
    let totalHardware = 0;

    modules.forEach((mod) => {
      const frontAreaSqFt = (mod.widthMm / 304.8) * (mod.heightMm / 304.8);
      const carcassSurfaceSqFt = frontAreaSqFt * 3.5;

      totalCarcass += carcassSurfaceSqFt * (CARCASS_RATES[mod.carcassCore]?.ratePerSqFt ?? 3.5);
      totalShutters += frontAreaSqFt * (FINISH_RATES[mod.shutterFinish]?.ratePerSqFt ?? 4.0);

      const hw =
        mod.hardware.hinges * HARDWARE_PRICING.softCloseHinge +
        mod.hardware.drawerChannels * HARDWARE_PRICING.tandemDrawerChannel +
        (mod.elevationMm > 0 ? mod.hardware.hangingBrackets * HARDWARE_PRICING.antiGravityHangingBracket : 0);
      totalHardware += hw;
    });

    const subtotal = totalCarcass + totalShutters + totalHardware;
    const estimatedTax = subtotal * 0.1;
    const grandTotal = subtotal + estimatedTax;

    return {
      totalCarcass: Math.round(totalCarcass),
      totalShutters: Math.round(totalShutters),
      totalHardware: Math.round(totalHardware),
      grandTotal: Math.round(grandTotal),
    };
  }, [modules]);

  const handleAddModule = (width: 300 | 450 | 600 | 900, category: UnitCategory) => {
    const currentMaxX = modules.reduce((max, m) => Math.max(max, m.posX + m.widthMm), 0);
    const newPosX = currentMaxX + width <= wall.lengthMm ? currentMaxX : 200;

    const newUnit: ModularUnit = {
      id: `mod-${Date.now()}`,
      name: `${width}mm ${category.replace('_', ' ').toUpperCase()}`,
      category,
      widthMm: width,
      heightMm: category === 'base_drawer' ? 360 : category === 'overhead_loft' ? 720 : 600,
      depthMm: category === 'overhead_loft' ? 350 : 450,
      elevationMm: category === 'base_drawer' ? 350 : category === 'overhead_loft' ? 1600 : 0,
      posX: Math.min(newPosX, wall.lengthMm - width),
      carcassCore: 'HDHMR',
      shutterFinish: 'fluted_pu',
      hardware: {
        hinges: category === 'single_shutter' ? 2 : category === 'double_shutter' ? 4 : 0,
        drawerChannels: category === 'base_drawer' ? (width >= 900 ? 2 : 1) : 0,
        hangingBrackets: 2,
      },
    };

    setModules([...modules, newUnit]);
    setSelectedId(newUnit.id);
  };

  const updateSelectedModule = (patch: Partial<ModularUnit>) => {
    if (!selectedId) return;
    setModules((prev) => prev.map((m) => (m.id === selectedId ? { ...m, ...patch } : m)));
  };

  const handleDeleteModule = (id: string) => {
    setModules((prev) => prev.filter((m) => m.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleGenerate = async () => {
    setGeneratingMaps(true);
    try {
      const maps = await generateControlNetMaps(wall, modules, 1024);
      onGenerateRender?.({
        wall,
        modules,
        totalCost: pricingBreakdown.grandTotal,
        depthMapUrl: maps.depthMapDataUrl,
        wireframeUrl: maps.wireframeDataUrl,
      });
    } finally {
      setGeneratingMaps(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* LEFT: 2D ELEVATION WALL CANVAS (ANTI-GRAVITY WORKSPACE) */}
      <div style={{ background: '#1c1917', border: '1px solid #332d29', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, color: '#f5f0e8' }}>
        {/* Wall Meta Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #332d29', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399' }}>
              <Layers size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Studio 1: Modular Elevation Canvas</h2>
              <p style={{ fontSize: 11, color: '#a8a29e', margin: '2px 0 0' }}>System 32 Carcass Snapping · Anti-Gravity Z-Axis Active</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 11, fontFamily: 'monospace' }}>
            <div style={{ background: '#292524', padding: '6px 12px', borderRadius: 6, border: '1px solid #44403c' }}>
              Wall: <strong style={{ color: '#fff' }}>{wall.lengthMm} × {wall.heightMm} mm</strong>
            </div>
            <div style={{ background: '#292524', padding: '6px 12px', borderRadius: 6, border: '1px solid #44403c' }}>
              Units: <strong style={{ color: '#34d399' }}>{modules.length}</strong>
            </div>
          </div>
        </div>

        {/* Visual Wall Elevation Canvas */}
        <div style={{ position: 'relative', width: '100%', height: 380, background: '#12100e', borderRadius: 12, border: '1px solid #292524', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 20 }}>
          {/* Grid Texture Overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.1,
              pointerEvents: 'none',
              backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {/* Ceiling Level Indicator */}
          <div style={{ position: 'absolute', top: 12, left: 16, fontSize: 10, fontFamily: 'monospace', color: '#78716c', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#78716c' }} />
            Ceiling Channel Level: {wall.heightMm} mm
          </div>

          {/* Ground Floor Plinth Level */}
          <div style={{ position: 'absolute', bottom: 12, left: 16, fontSize: 10, fontFamily: 'monospace', color: '#34d399', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
            Ground Plinth Level (0 mm)
          </div>

          {/* Render Placed Modular Units on Wall */}
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {modules.map((mod) => {
              const leftPercent = (mod.posX / wall.lengthMm) * 100;
              const bottomPercent = (mod.elevationMm / wall.heightMm) * 100;
              const widthPercent = (mod.widthMm / wall.lengthMm) * 100;
              const heightPercent = (mod.heightMm / wall.heightMm) * 100;
              const isSelected = selectedId === mod.id;
              const finish = FINISH_RATES[mod.shutterFinish];

              return (
                <div
                  key={mod.id}
                  onClick={() => setSelectedId(mod.id)}
                  style={{
                    position: 'absolute',
                    left: `${leftPercent}%`,
                    bottom: `${bottomPercent}%`,
                    width: `${widthPercent}%`,
                    height: `${heightPercent}%`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: 8,
                    boxShadow: isSelected ? '0 12px 28px rgba(16, 185, 129, 0.35)' : '0 8px 20px rgba(0,0,0,0.5)',
                    border: isSelected ? '2px solid #34d399' : '1px solid #44403c',
                    background: finish?.hex ?? '#27272a',
                    transform: isSelected ? 'scale(1.02)' : 'none',
                    zIndex: isSelected ? 30 : 10,
                  }}
                >
                  {/* Anti-Gravity Float Tag */}
                  {mod.elevationMm > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: -22,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#064e3b',
                        color: '#34d399',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        fontSize: 9,
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 4,
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <MoveVertical size={9} />
                      +{mod.elevationMm}mm Float
                    </div>
                  )}

                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                    <span>{mod.widthMm}mm</span>
                    <span style={{ background: 'rgba(0,0,0,0.6)', padding: '1px 4px', borderRadius: 3, fontSize: 8, textTransform: 'uppercase' }}>
                      {mod.category.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#d6d3d1', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                    <span>{mod.carcassCore}</span>
                    <span>D:{mod.depthMm}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Add Modular Units Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#d6d3d1', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} color="#34d399" />
            Quick Add Standard Carcass Box (System 32 Standard)
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              [300, 'single_shutter', '300mm Unit', 'Single Shutter / Spice'],
              [450, 'single_shutter', '450mm Unit', 'Slim Base / Wall Unit'],
              [600, 'base_drawer', '600mm Unit', 'Tandem Box Drawers'],
              [900, 'base_drawer', '900mm Console', 'Wide Floating Media'],
            ].map(([w, cat, title, subtitle]) => (
              <button
                key={String(w) + cat}
                type="button"
                onClick={() => handleAddModule(w as any, cat as any)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: '#292524',
                  border: '1px solid #44403c',
                  borderRadius: 10,
                  color: '#f5f0e8',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <div>
                  <strong style={{ display: 'block', fontSize: 12 }}>{title}</strong>
                  <small style={{ fontSize: 10, color: '#a8a29e' }}>{subtitle}</small>
                </div>
                <Plus size={14} color="#78716c" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT: PARAMETRIC INSPECTOR & LIVE PRICING MATRIX */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Selected Module Property Editor */}
        <div style={{ background: '#1c1917', border: '1px solid #332d29', borderRadius: 16, padding: 18, color: '#f5f0e8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #332d29', paddingBottom: 10 }}>
            <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#34d399', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
              <Sparkles size={14} /> Module Inspector
            </h3>
            {selectedModule && (
              <button
                type="button"
                onClick={() => handleDeleteModule(selectedModule.id)}
                style={{ border: 0, background: 'transparent', color: '#f87171', cursor: 'pointer', padding: 4 }}
                title="Remove Unit"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>

          {selectedModule ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
              {/* Anti-Gravity Elevation Slider */}
              <div style={{ background: '#292524', padding: 12, borderRadius: 10, border: '1px solid #44403c' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MoveVertical size={13} color="#34d399" /> Anti-Gravity Height:
                  </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#34d399', fontSize: 13 }}>
                    {selectedModule.elevationMm} mm
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2000}
                  step={50}
                  value={selectedModule.elevationMm}
                  onChange={(e) => updateSelectedModule({ elevationMm: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#34d399', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#a8a29e', fontFamily: 'monospace', marginTop: 4 }}>
                  <span>0mm (Floor)</span>
                  <span>1000mm</span>
                  <span>2000mm (Ceiling)</span>
                </div>
              </div>

              {/* Horizontal Position on Wall */}
              <div style={{ background: '#292524', padding: 12, borderRadius: 10, border: '1px solid #44403c' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#d6d3d1' }}>Wall Offset (X-Axis):</span>
                  <span style={{ fontFamily: 'monospace', color: '#fff', fontSize: 12 }}>{selectedModule.posX} mm</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, wall.lengthMm - selectedModule.widthMm)}
                  step={50}
                  value={selectedModule.posX}
                  onChange={(e) => updateSelectedModule({ posX: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#a8a29e', cursor: 'pointer' }}
                />
              </div>

              {/* Carcass Core Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#a8a29e' }}>Carcass Core Material</label>
                <select
                  value={selectedModule.carcassCore}
                  onChange={(e) => updateSelectedModule({ carcassCore: e.target.value as CarcassCore })}
                  style={{ background: '#292524', border: '1px solid #44403c', color: '#fff', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}
                >
                  {Object.entries(CARCASS_RATES).map(([key, data]) => (
                    <option key={key} value={key}>
                      {data.name} (+${data.ratePerSqFt}/sqft)
                    </option>
                  ))}
                </select>
              </div>

              {/* Shutter Finish Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#a8a29e' }}>Facade & Shutter Finish</label>
                <select
                  value={selectedModule.shutterFinish}
                  onChange={(e) => updateSelectedModule({ shutterFinish: e.target.value as ShutterFinish })}
                  style={{ background: '#292524', border: '1px solid #44403c', color: '#fff', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}
                >
                  {Object.entries(FINISH_RATES).map(([key, data]) => (
                    <option key={key} value={key}>
                      {data.name} (+${data.ratePerSqFt}/sqft)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div style={{ padding: '36px 0', textAlign: 'center', color: '#78716c', fontSize: 12 }}>
              Click any cabinet on the canvas to inspect and configure.
            </div>
          )}
        </div>

        {/* Dynamic BOM & Live Price Matrix */}
        <div style={{ background: '#1c1917', border: '1px solid #332d29', borderRadius: 16, padding: 18, color: '#f5f0e8', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #332d29', paddingBottom: 10 }}>
            <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
              <ShieldCheck size={16} color="#34d399" /> Dynamic BOM Quotation
            </h3>
            <span style={{ fontSize: 10, background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: 999, fontFamily: 'monospace' }}>
              Auto-Calculated
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a8a29e' }}>
              <span>Carcass Plywood Panels:</span>
              <span style={{ fontFamily: 'monospace', color: '#fff' }}>${pricingBreakdown.totalCarcass}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a8a29e' }}>
              <span>Shutter Finishes & Polish:</span>
              <span style={{ fontFamily: 'monospace', color: '#fff' }}>${pricingBreakdown.totalShutters}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a8a29e' }}>
              <span>Fittings & Hanging Cleats:</span>
              <span style={{ fontFamily: 'monospace', color: '#fff' }}>${pricingBreakdown.totalHardware}</span>
            </div>
            <div style={{ borderTop: '1px solid #332d29', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
              <span>Estimated Total (BOM):</span>
              <span style={{ fontFamily: 'monospace', color: '#34d399', fontSize: 18 }}>${pricingBreakdown.grandTotal}</span>
            </div>
          </div>

          {/* Trigger Render Generation */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generatingMaps}
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
              cursor: generatingMaps ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
            }}
          >
            <Sparkles size={16} />
            {generatingMaps ? 'Exporting ControlNet Wireframe...' : 'Send to Studio 1 (Photorealistic Render)'}
          </button>
        </div>
      </div>
    </div>
  );
}
