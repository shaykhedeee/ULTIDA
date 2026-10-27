import { useState, useMemo } from 'react';
import {
  CuratedLaminateCatalog,
  VENDOR_APPROVED_LAMINATES,
  VERIFIED_HARDWARE_REGISTRY,
  BARE_BONES_FINISH_FAMILIES,
} from '@ultida/catalog-core';

export interface MoodboardModuleItem {
  id: string;
  roomId: string;
  family: string;
  label: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  materialId?: string;
  finishes?: Record<string, string>;
}

interface RoomSurfaceDraft {
  wallPaint: string;
  wallHex: string;
  flooringFinish: string;
  flooringHex: string;
  ceilingFinish: string;
  ceilingHex: string;
  lightingKelvin: string;
  hardwareSuiteId: string;
}

const DEFAULT_SURFACES_BY_ROOM: Record<string, RoomSurfaceDraft> = {
  kitchen: {
    wallPaint: 'Asian Paints Royale Aspira — Warm Alabaster (L152)',
    wallHex: '#f3efe6',
    flooringFinish: 'Kajaria Eternity 600×1200mm Honed Travertine Matt',
    flooringHex: '#d8cfc0',
    ceilingFinish: 'Saint-Gobain Gyproc Moisture-Resistant Matte White + Cove',
    ceilingHex: '#faf9f5',
    lightingKelvin: '3000K Warm White COB Task (CRI > 90) + 4000K Prep',
    hardwareSuiteId: 'ebco-esoft-linear-hinge-3d-105',
  },
  living: {
    wallPaint: 'Asian Paints Nilaya — Cashmere Linen & Fluted Charcoal Accent',
    wallHex: '#ede8de',
    flooringFinish: 'Italian Botticino Classico Marble / 800×1600mm Sintered Slab',
    flooringHex: '#e4dac9',
    ceilingFinish: 'Floating Gypsum Perimeter Drop Ceiling w/ 2700K Magnetic Track',
    ceilingHex: '#f8f6f0',
    lightingKelvin: '2700K Ambient Lounge & Architectural Grazing',
    hardwareSuiteId: 'hettich-sensys-8645i-110',
  },
  bedroom: {
    wallPaint: 'Dulux Velvet Touch — Muted Sage & Warm Oatmeal',
    wallHex: '#e6e2d8',
    flooringFinish: 'Pergo 8mm Warm Alameda Oak AC4 Herringbone Plank',
    flooringHex: '#b89672',
    ceilingFinish: 'Seamless Matte Acoustic Plaster + Curtain Pelmet Cove',
    ceilingHex: '#faf8f5',
    lightingKelvin: '2700K Warm Relaxing Wardrobe & Bed Underglow',
    hardwareSuiteId: 'ebco-esoft-linear-hinge-3d-105',
  },
};

export function RoomMoodboardMakerCard({
  roomId,
  roomName,
  roomType,
  roomModules,
}: {
  roomId: string;
  roomName: string;
  roomType: string;
  roomModules: MoodboardModuleItem[];
}) {
  const [viewMode, setViewMode] = useState<'grid' | 'editorial'>('grid');
  const [surfaceByRoom, setSurfaceByRoom] = useState<Record<string, RoomSurfaceDraft>>({});
  const [notesByRoom, setNotesByRoom] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem('ultida.moodboard.notes.v4');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [exportStatus, setExportStatus] = useState<string>('');

  const activeSurface: RoomSurfaceDraft =
    surfaceByRoom[roomId] ??
    DEFAULT_SURFACES_BY_ROOM[roomType] ??
    DEFAULT_SURFACES_BY_ROOM.bedroom;

  const updateSurface = (patch: Partial<RoomSurfaceDraft>) => {
    setSurfaceByRoom((prev) => ({
      ...prev,
      [roomId]: { ...activeSurface, ...patch },
    }));
  };

  const roomNote =
    notesByRoom[roomId] ??
    `Balanced 60-30-10 material palette for ${roomName}. All exterior woodgrain shutters use 1.0mm synchronized HPL with 0.8mm Frosty White balancing liner and 2.0mm Rehau PVC edge banding.`;

  const updateNote = (nextNote: string) => {
    const updated = { ...notesByRoom, [roomId]: nextNote };
    setNotesByRoom(updated);
    try {
      localStorage.setItem('ultida.moodboard.notes.v4', JSON.stringify(updated));
    } catch {
      // ignore storage quota errors
    }
  };

  // Extract live material assignments from saved/draft modules in this room
  const assignedSwatches = useMemo(() => {
    const map = new Map<
      string,
      {
        slot: string;
        skuId: string;
        brand: string;
        name: string;
        skuCode: string;
        hex: string;
        thicknessMm: number;
        edgeBandSpec: string;
        backLinerSpec: string;
        usedByModules: string[];
      }
    >();

    const resolveLaminate = (idOrName: string, slot: string) => {
      const norm = idOrName.toLowerCase();
      const vendorMatch = VENDOR_APPROVED_LAMINATES.find(
        (v) =>
          v.id.toLowerCase() === norm ||
          v.skuCode.toLowerCase() === norm ||
          v.name.toLowerCase().includes(norm),
      );
      if (vendorMatch) {
        return {
          skuId: vendorMatch.id,
          brand: vendorMatch.brand,
          name: vendorMatch.name,
          skuCode: vendorMatch.skuCode,
          hex: vendorMatch.swatchHex,
          thicknessMm: vendorMatch.thicknessMm,
          edgeBandSpec: vendorMatch.matchingEdgeBandSku,
          backLinerSpec: `${vendorMatch.recommendedBackingSku} (0.8mm Balancing Liner)`,
        };
      }
      const curatedMatch = CuratedLaminateCatalog.find(
        (c) => c.id.toLowerCase() === norm || c.name.toLowerCase().includes(norm),
      );
      if (curatedMatch) {
        return {
          skuId: curatedMatch.id,
          brand: curatedMatch.brand,
          name: curatedMatch.name,
          skuCode: curatedMatch.id.toUpperCase(),
          hex: curatedMatch.colourHex || '#b89672',
          thicknessMm: curatedMatch.thicknessMm,
          edgeBandSpec: `${curatedMatch.edgeBand.thicknessMm}mm ${curatedMatch.edgeBand.material}`,
          backLinerSpec: '21091-MR Frosty White Balancing Liner 0.8mm',
        };
      }
      return {
        skuId: idOrName,
        brand: 'Merino / Ultida Spec',
        name: idOrName,
        skuCode: slot === 'carcass' ? '21091-MR' : '14149-RS',
        hex: slot === 'carcass' ? '#f5f4f0' : slot === 'countertop' ? '#e8e2d5' : '#b89672',
        thicknessMm: slot === 'carcass' ? 0.8 : 1.0,
        edgeBandSpec: slot === 'carcass' ? '0.8mm Rehau PVC' : '2.0mm Rehau PVC',
        backLinerSpec: '0.8mm Balancing Liner HPL',
      };
    };

    if (roomModules.length === 0) {
      // Seed with canonical Merino Senses + Greenlam AFX room palette so board is immediately rich
      const defaults = [
        { slot: 'shutter', id: 'merino-14149-rs-alameda-oak-dune', modLabel: 'Primary Shutter Face' },
        { slot: 'shutter_accent', id: 'greenlam-afx-9851-white-x', modLabel: 'Overhead / Loft Shutters' },
        { slot: 'carcass', id: 'merino-21091-frosty-white-liner-08', modLabel: 'Internal Carcass & Liner' },
        { slot: 'core_substrate', id: 'action-tesa-18mm-hdhmr-pro', modLabel: '18mm Structural Core' },
      ];
      defaults.forEach((d) => {
        const resolved = resolveLaminate(d.id, d.slot);
        map.set(`${d.slot}:${resolved.skuId}`, {
          slot: d.slot,
          ...resolved,
          usedByModules: [d.modLabel],
        });
      });
    } else {
      roomModules.forEach((mod) => {
        const finishes = mod.finishes && Object.keys(mod.finishes).length > 0
          ? mod.finishes
          : {
              shutter: mod.materialId || 'merino-14149-rs-alameda-oak-dune',
              carcass: 'merino-21091-frosty-white-liner-08',
            };
        Object.entries(finishes).forEach(([slot, matId]) => {
          if (!matId) return;
          const resolved = resolveLaminate(matId, slot);
          const key = `${slot}:${resolved.skuId}`;
          const existing = map.get(key);
          if (existing) {
            if (!existing.usedByModules.includes(mod.label)) {
              existing.usedByModules.push(mod.label);
            }
          } else {
            map.set(key, {
              slot,
              ...resolved,
              usedByModules: [mod.label],
            });
          }
        });
      });
    }

    return Array.from(map.values());
  }, [roomModules]);

  const activeHardware =
    VERIFIED_HARDWARE_REGISTRY.find((h) => h.id === activeSurface.hardwareSuiteId) ??
    VERIFIED_HARDWARE_REGISTRY[0];

  const handleExportMoodboardSpec = () => {
    const payload = {
      schema: 'ultida.room.moodboard.v4',
      exportedAt: new Date().toISOString(),
      room: { id: roomId, name: roomName, type: roomType },
      moduleCount: roomModules.length,
      moduleMaterialSwatches: assignedSwatches,
      roomArchitecturalSurfaces: activeSurface,
      verifiedHardwareSuite: {
        id: activeHardware.id,
        supplier: activeHardware.supplier,
        modelName: activeHardware.modelName,
        skuCode: activeHardware.skuCode,
        openingAngleDeg: activeHardware.openingAngleDeg,
        shutterThicknessRangeMm: `${activeHardware.shutterThicknessMinMm ?? 14}–${activeHardware.shutterThicknessMaxMm ?? 22}mm`,
      },
      designerNotes: roomNote,
    };
    const jsonText = JSON.stringify(payload, null, 2);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(jsonText);
    }
    setExportStatus(`Exported ${assignedSwatches.length} material swatches & hardware spec for ${roomName} (copied to clipboard).`);
  };

  return (
    <div
      style={{
        background: '#fffdf9',
        border: '1.5px solid #dcd0be',
        borderRadius: 12,
        padding: 14,
        boxShadow: '0 4px 14px rgba(28, 25, 23, 0.06)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: '#9a6b26', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            LIVE ROOM MOODBOARD MAKER · MODULE-LINKED FINISHES &amp; LAMINATES
          </div>
          <h4 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, color: '#1c1917' }}>
            {roomName} — Material Swatches, 5-Layer Laminate Recipe &amp; Hardware Board
          </h4>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ display: 'inline-flex', background: '#f5f0e6', padding: 2, borderRadius: 6, border: '1px solid #dfd5c4' }}>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 4,
                border: 'none',
                background: viewMode === 'grid' ? '#1c1917' : 'transparent',
                color: viewMode === 'grid' ? '#e8c96a' : '#57534e',
                cursor: 'pointer',
              }}
            >
              Grid Board
            </button>
            <button
              type="button"
              onClick={() => setViewMode('editorial')}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 4,
                border: 'none',
                background: viewMode === 'editorial' ? '#1c1917' : 'transparent',
                color: viewMode === 'editorial' ? '#e8c96a' : '#57534e',
                cursor: 'pointer',
              }}
            >
              Editorial Flat-Lay
            </button>
          </div>
          <button
            type="button"
            onClick={handleExportMoodboardSpec}
            style={{
              padding: '5px 11px',
              fontSize: 11,
              fontWeight: 800,
              borderRadius: 6,
              border: '1px solid var(--gold, #c59c2d)',
              background: 'linear-gradient(135deg, #1c1917, #3d2a1a)',
              color: '#e8c96a',
              cursor: 'pointer',
            }}
          >
            Export Room Spec
          </button>
        </div>
      </div>

      {exportStatus && (
        <div
          role="status"
          style={{
            marginBottom: 10,
            padding: '6px 10px',
            borderRadius: 6,
            background: '#ecfdf5',
            border: '1px solid #6ee7b7',
            color: '#065f46',
            fontSize: 11.5,
            fontWeight: 700,
          }}
        >
          {exportStatus}
        </div>
      )}

      {/* Swatch Cards from Saved Module Material Assignments */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fit, minmax(195px, 1fr))' : '1fr',
          gap: 10,
          marginBottom: 12,
        }}
      >
        {assignedSwatches.map((sw) => (
          <div
            key={`${sw.slot}-${sw.skuId}`}
            style={{
              display: viewMode === 'editorial' ? 'grid' : 'flex',
              gridTemplateColumns: viewMode === 'editorial' ? '88px 1fr' : undefined,
              flexDirection: viewMode === 'grid' ? 'column' : undefined,
              gap: 8,
              padding: 10,
              borderRadius: 9,
              background: '#ffffff',
              border: '1px solid #e7ded0',
            }}
          >
            <div
              style={{
                height: viewMode === 'editorial' ? 76 : 54,
                borderRadius: 7,
                background: sw.hex,
                border: '1px solid rgba(0,0,0,0.12)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                padding: '4px 7px',
              }}
            >
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 800,
                  background: 'rgba(28,25,23,0.78)',
                  color: '#f8fafc',
                  padding: '1px 5px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                }}
              >
                {sw.slot.replace('_', ' ')}
              </span>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  background: 'rgba(255,255,255,0.88)',
                  color: '#1c1917',
                  padding: '1px 5px',
                  borderRadius: 4,
                }}
              >
                {sw.skuCode}
              </span>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#9a6b26' }}>{sw.brand}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#1c1917', lineHeight: 1.25 }}>
                {sw.name}
              </div>
              <div style={{ fontSize: 10.5, color: '#57534e', marginTop: 3 }}>
                Face: <b>{sw.thicknessMm}mm</b> · Edge: <b>{sw.edgeBandSpec}</b>
              </div>
              <div style={{ fontSize: 10, color: '#78716c', marginTop: 1 }}>
                Back: {sw.backLinerSpec}
              </div>
              <div style={{ fontSize: 10, color: '#047857', fontWeight: 700, marginTop: 4 }}>
                Used in: {sw.usedByModules.join(', ')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Room Surfaces & Hardware Draft Assignments */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 8,
          padding: 10,
          borderRadius: 8,
          background: '#f7f3eb',
          border: '1px solid #e5dbc9',
          marginBottom: 10,
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: '#57534e' }}>
            ROOM WALL FINISH
          </label>
          <input
            type="text"
            value={activeSurface.wallPaint}
            onChange={(e) => updateSurface({ wallPaint: e.target.value })}
            style={{ width: '100%', padding: '4px 7px', fontSize: 11, borderRadius: 5, border: '1px solid #d6cbb9', marginTop: 2 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: '#57534e' }}>
            FLOORING SLAB / PLANK
          </label>
          <input
            type="text"
            value={activeSurface.flooringFinish}
            onChange={(e) => updateSurface({ flooringFinish: e.target.value })}
            style={{ width: '100%', padding: '4px 7px', fontSize: 11, borderRadius: 5, border: '1px solid #d6cbb9', marginTop: 2 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: '#57534e' }}>
            CEILING &amp; LIGHTING KELVIN
          </label>
          <input
            type="text"
            value={activeSurface.lightingKelvin}
            onChange={(e) => updateSurface({ lightingKelvin: e.target.value })}
            style={{ width: '100%', padding: '4px 7px', fontSize: 11, borderRadius: 5, border: '1px solid #d6cbb9', marginTop: 2 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: '#57534e' }}>
            VERIFIED EBCO / HETTICH / BLUM FITTING
          </label>
          <select
            aria-label="Room primary verified hardware fitting"
            value={activeSurface.hardwareSuiteId}
            onChange={(e) => updateSurface({ hardwareSuiteId: e.target.value })}
            style={{ width: '100%', padding: '4px 7px', fontSize: 11, borderRadius: 5, border: '1px solid #d6cbb9', marginTop: 2, background: '#fff' }}
          >
            {VERIFIED_HARDWARE_REGISTRY.map((hw) => (
              <option key={hw.id} value={hw.id}>
                {hw.supplier} — {hw.modelName} ({hw.skuCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 8 Bare-Bones Finish Families Quick Reference Pill Bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#78716c', marginBottom: 4 }}>
          ACTIVE 5-LAYER FINISH SANDWICH STANDARDS ({BARE_BONES_FINISH_FAMILIES.length} BARE-BONES FAMILIES):
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {BARE_BONES_FINISH_FAMILIES.map((fam) => (
            <span
              key={fam.id}
              title={`${fam.coreSubstrateSpec} + ${fam.exteriorFaceSpec} + ${fam.backBalancingLinerSpec}`}
              style={{
                fontSize: 10,
                padding: '2px 7px',
                borderRadius: 99,
                background: '#fff',
                border: '1px solid #dfd5c4',
                color: '#44403c',
                fontWeight: 600,
              }}
            >
              {fam.name.split('(')[0].trim()}
            </span>
          ))}
        </div>
      </div>

      {/* Room Design Notes */}
      <div>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: '#57534e', marginBottom: 3 }}>
          ARCHITECTURAL MOODBOARD NOTES &amp; REVISION PROVENANCE ({roomName.toUpperCase()})
        </label>
        <textarea
          rows={2}
          value={roomNote}
          onChange={(e) => updateNote(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: 11.5,
            borderRadius: 6,
            border: '1px solid #d6cbb9',
            background: '#fff',
            color: '#292524',
          }}
        />
      </div>
    </div>
  );
}
