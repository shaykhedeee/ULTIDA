import {
  Download, ImagePlus, ShieldCheck, Sparkles, TriangleAlert,
  Layers, Compass, Wrench, Settings, CheckCircle2, ChevronRight, FileCode, Check
} from 'lucide-react';
import { useState, useMemo } from 'react';
import './cnc-pattern-studio.css';

// ─── Jaali Pattern Types & DXF Helpers ─────────────────────────────────────
type Pattern = 'diamond' | 'arch' | 'circle' | 'om' | 'floral';
const patternNames: Record<Pattern, string> = {
  diamond: 'Diamond jaali',
  arch: 'Arch lattice',
  circle: 'Circle lattice',
  om: 'Om medallion',
  floral: 'Floral rosette'
};

function dxfLine(x1: number, y1: number, x2: number, y2: number, layer = 'CUT') {
  return `0\nLINE\n8\n${layer}\n10\n${x1}\n20\n${y1}\n11\n${x2}\n21\n${y2}\n`;
}
function dxfCircle(x: number, y: number, radius: number, layer = 'CUT') {
  return `0\nCIRCLE\n8\n${layer}\n10\n${x}\n20\n${y}\n40\n${radius}\n`;
}
function dxfArc(x: number, y: number, radius: number, start: number, end: number, layer = 'CUT') {
  return `0\nARC\n8\n${layer}\n10\n${x}\n20\n${y}\n40\n${radius}\n50\n${start}\n51\n${end}\n`;
}

function dxfForJaali(pattern: Pattern, width: number, height: number, spacing: number, toolDia = 6) {
  let body = dxfLine(0, 0, width, 0, 'OUTLINE') +
             dxfLine(width, 0, width, height, 'OUTLINE') +
             dxfLine(width, height, 0, height, 'OUTLINE') +
             dxfLine(0, height, 0, 0, 'OUTLINE');
  if (pattern === 'diamond') {
    for (let x = -height; x < width + height; x += spacing) {
      body += dxfLine(x, 0, x + height, height);
      body += dxfLine(x, height, x + height, 0);
    }
  } else if (pattern === 'circle') {
    for (let y = spacing / 2; y < height; y += spacing) {
      for (let x = spacing / 2; x < width; x += spacing) {
        body += dxfCircle(x, y, Math.max(8, spacing * 0.28));
      }
    }
  } else if (pattern === 'arch') {
    const bays = Math.max(1, Math.floor(width / spacing));
    const bay = width / bays;
    const radius = bay / 2;
    for (let i = 0; i < bays; i++) {
      const center = bay * i + radius;
      body += dxfArc(center, 0, radius, 0, 180);
      body += dxfLine(center - radius, 0, center - radius, Math.min(height, radius));
      body += dxfLine(center + radius, 0, center + radius, Math.min(height, radius));
    }
  } else if (pattern === 'om') {
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) * 0.24;
    body += dxfCircle(cx, cy, r);
    body += dxfArc(cx, cy, r * 0.68, 210, 120);
    body += dxfArc(cx + r * 0.18, cy - r * 0.05, r * 0.42, 70, 290);
    body += dxfLine(cx - r * 0.55, cy + r * 0.2, cx + r * 0.55, cy + r * 0.2);
    body += dxfLine(cx, cy - r * 1.05, cx, cy - r * 0.7);
  } else {
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) * 0.15;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const px = cx + Math.cos(angle) * r * 1.5;
      const py = cy + Math.sin(angle) * r * 1.5;
      body += dxfCircle(px, py, r * 0.72);
    }
    body += dxfCircle(cx, cy, r * 0.72);
  }
  return `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${body}0\nENDSEC\n0\nEOF\n`;
}

// ─── System 32 CNC Machine Center Types & Generative Logic ──────────────────
export type System32PanelPreset = 'gable_left' | 'gable_right' | 'top_bottom_deck' | 'adj_shelf' | 'shutter_door';

export interface CncHole {
  id: string;
  x: number;
  y: number;
  diameter: number;
  depth: number;
  type: 'shelf_pin' | 'hinge_cup' | 'hinge_mount' | 'minifix_cam' | 'dowel';
  toolId: string;
}

export interface CncGroove {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  depth: number;
  type: 'back_groove';
  toolId: string;
}

export function CncPatternStudio() {
  const [studioMode, setStudioMode] = useState<'system32' | 'jaali'>('system32');

  // ── Jaali State ──
  const [pattern, setPattern] = useState<Pattern>('diamond');
  const [jWidth, setJWidth] = useState(600);
  const [jHeight, setJHeight] = useState(900);
  const [jSpacing, setJSpacing] = useState(100);
  const [jToolDiameter, setJToolDiameter] = useState(6);
  const [jMaterialThickness, setJMaterialThickness] = useState(18);
  const [jBridgeMm, setJBridgeMm] = useState(12);
  const [jReference, setJReference] = useState<string | null>(null);

  // ── System 32 Machine Center State ──
  const [panelPreset, setPanelPreset] = useState<System32PanelPreset>('gable_left');
  const [pLength, setPLength] = useState(2400); // Height/Length in mm
  const [pWidth, setPWidth] = useState(580);   // Width/Depth in mm
  const [pThickness, setPThickness] = useState(18); // Thickness in mm
  const [enableLineBoring, setEnableLineBoring] = useState(true);
  const [enableHingeBoring, setEnableHingeBoring] = useState(true);
  const [enableMinifix, setEnableMinifix] = useState(true);
  const [enableBackGroove, setEnableBackGroove] = useState(true);
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);
  const [machinePreset, setMachinePreset] = useState<'homag' | 'biesse' | 'scm' | 'generic'>('homag');

  // Load from active cutlist selection if sent from cutlist maker
  useState(() => {
    try {
      const active = window.localStorage.getItem('ultida_active_cnc_panel');
      if (active) {
        const parsed = JSON.parse(active);
        if (parsed.lengthMm) setPLength(parsed.lengthMm);
        if (parsed.widthMm) setPWidth(parsed.widthMm);
        if (parsed.thicknessMm) setPThickness(parsed.thicknessMm);
      }
    } catch {}
  });

  function applyPreset(preset: System32PanelPreset) {
    setPanelPreset(preset);
    if (preset === 'gable_left' || preset === 'gable_right') {
      setPLength(2400);
      setPWidth(580);
      setPThickness(18);
      setEnableLineBoring(true);
      setEnableHingeBoring(true);
      setEnableMinifix(true);
      setEnableBackGroove(true);
    } else if (preset === 'top_bottom_deck') {
      setPLength(564);
      setPWidth(580);
      setPThickness(18);
      setEnableLineBoring(false);
      setEnableHingeBoring(false);
      setEnableMinifix(true);
      setEnableBackGroove(true);
    } else if (preset === 'adj_shelf') {
      setPLength(562);
      setPWidth(560);
      setPThickness(18);
      setEnableLineBoring(false);
      setEnableHingeBoring(false);
      setEnableMinifix(false);
      setEnableBackGroove(false);
    } else if (preset === 'shutter_door') {
      setPLength(2394);
      setPWidth(594);
      setPThickness(18);
      setEnableLineBoring(false);
      setEnableHingeBoring(true);
      setEnableMinifix(false);
      setEnableBackGroove(false);
    }
  }

  // ── Calculate System 32 CNC Hole Patterns ──
  const cncOperations = useMemo(() => {
    const holes: CncHole[] = [];
    const grooves: CncGroove[] = [];

    // 1. Line Boring Ø5mm holes at 32mm pitch (Front 37mm setback & Rear 37mm setback)
    if (enableLineBoring && (panelPreset === 'gable_left' || panelPreset === 'gable_right')) {
      const startY = 150;
      const endY = pLength - 150;
      const frontX = panelPreset === 'gable_left' ? 37 : pWidth - 37;
      const rearX = panelPreset === 'gable_left' ? pWidth - 37 : 37;

      for (let y = startY; y <= endY; y += 32) {
        holes.push({
          id: `pin-f-${y}`,
          x: frontX,
          y,
          diameter: 5,
          depth: 13,
          type: 'shelf_pin',
          toolId: 'T1 (Ø5mm Drill)',
        });
        holes.push({
          id: `pin-r-${y}`,
          x: rearX,
          y,
          diameter: 5,
          depth: 13,
          type: 'shelf_pin',
          toolId: 'T1 (Ø5mm Drill)',
        });
      }
    }

    // 2. Concealed Hinge Boring
    if (enableHingeBoring) {
      if (panelPreset === 'shutter_door') {
        // Shutter door: 35mm cup hole at 21.5mm edge setback + 2x 8mm dowel mounting holes at 45mm pitch
        const hingeCount = pLength > 2100 ? 5 : pLength > 1600 ? 4 : pLength > 1000 ? 3 : 2;
        const positions = [];
        positions.push(100);
        positions.push(pLength - 100);
        if (hingeCount >= 3) positions.push(Math.round(pLength / 2));
        if (hingeCount >= 4) positions.push(250);
        if (hingeCount >= 5) positions.push(pLength - 250);

        positions.sort((a, b) => a - b).forEach((y, i) => {
          holes.push({
            id: `cup-${i}`,
            x: 21.5,
            y,
            diameter: 35,
            depth: 12,
            type: 'hinge_cup',
            toolId: 'T2 (Ø35mm Hinge Borer)',
          });
          holes.push({
            id: `cup-m1-${i}`,
            x: 21.5 + 9.5,
            y: y - 22.5,
            diameter: 8,
            depth: 11,
            type: 'hinge_mount',
            toolId: 'T3 (Ø8mm Dowel Drill)',
          });
          holes.push({
            id: `cup-m2-${i}`,
            x: 21.5 + 9.5,
            y: y + 22.5,
            diameter: 8,
            depth: 11,
            type: 'hinge_mount',
            toolId: 'T3 (Ø8mm Dowel Drill)',
          });
        });
      } else if (panelPreset === 'gable_left' || panelPreset === 'gable_right') {
        // Carcass gable: Hinge mounting plate holes at 37mm setback, 32mm vertical spacing
        const hingeCount = pLength > 2100 ? 5 : pLength > 1600 ? 4 : pLength > 1000 ? 3 : 2;
        const positions = [];
        positions.push(100);
        positions.push(pLength - 100);
        if (hingeCount >= 3) positions.push(Math.round(pLength / 2));
        if (hingeCount >= 4) positions.push(250);
        if (hingeCount >= 5) positions.push(pLength - 250);

        const hingeX = panelPreset === 'gable_left' ? 37 : pWidth - 37;
        positions.forEach((y, i) => {
          holes.push({
            id: `plate-h1-${i}`,
            x: hingeX,
            y: y - 16,
            diameter: 5,
            depth: 11.5,
            type: 'hinge_mount',
            toolId: 'T1 (Ø5mm Drill)',
          });
          holes.push({
            id: `plate-h2-${i}`,
            x: hingeX,
            y: y + 16,
            diameter: 5,
            depth: 11.5,
            type: 'hinge_mount',
            toolId: 'T1 (Ø5mm Drill)',
          });
        });
      }
    }

    // 3. Minifix Cam & Dowel Connectors
    if (enableMinifix) {
      if (panelPreset === 'gable_left' || panelPreset === 'gable_right') {
        // Top and bottom deck connection points
        const levels = [pThickness / 2, pLength - pThickness / 2];
        const xPos = [50, pWidth - 80];
        levels.forEach((y, li) => {
          xPos.forEach((x, xi) => {
            holes.push({
              id: `minifix-bolt-${li}-${xi}`,
              x,
              y,
              diameter: 5,
              depth: 11,
              type: 'minifix_cam',
              toolId: 'T1 (Ø5mm Drill)',
            });
            holes.push({
              id: `dowel-gable-${li}-${xi}`,
              x: x + 32,
              y,
              diameter: 8,
              depth: 12,
              type: 'dowel',
              toolId: 'T3 (Ø8mm Dowel Drill)',
            });
          });
        });
      } else if (panelPreset === 'top_bottom_deck') {
        // Cam face bore 15mm at 34mm from edge
        const camY = [34, pLength - 34];
        const camX = [50, pWidth - 80];
        camY.forEach((y, yi) => {
          camX.forEach((x, xi) => {
            holes.push({
              id: `cam-face-${yi}-${xi}`,
              x,
              y,
              diameter: 15,
              depth: 13.5,
              type: 'minifix_cam',
              toolId: 'T4 (Ø15mm Cam Borer)',
            });
          });
        });
      }
    }

    // 4. Back Panel Groove (6mm router bit, 8mm depth, 15mm from rear edge)
    if (enableBackGroove && (panelPreset === 'gable_left' || panelPreset === 'gable_right' || panelPreset === 'top_bottom_deck')) {
      const grooveX = panelPreset === 'gable_left' ? pWidth - 15 : 15;
      grooves.push({
        id: 'back-groove-01',
        x1: grooveX,
        y1: 0,
        x2: grooveX,
        y2: pLength,
        width: 6,
        depth: 8,
        type: 'back_groove',
        toolId: 'T5 (6mm Router Endmill)',
      });
    }

    return { holes, grooves };
  }, [panelPreset, pLength, pWidth, pThickness, enableLineBoring, enableHingeBoring, enableMinifix, enableBackGroove]);

  // ── Download System 32 Layered DXF ──
  function downloadSystem32Dxf() {
    let body = dxfLine(0, 0, pWidth, 0, 'OUTLINE_CUT') +
               dxfLine(pWidth, 0, pWidth, pLength, 'OUTLINE_CUT') +
               dxfLine(pWidth, pLength, 0, pLength, 'OUTLINE_CUT') +
               dxfLine(0, pLength, 0, 0, 'OUTLINE_CUT');

    // Add drill holes
    for (const h of cncOperations.holes) {
      const layer = h.diameter === 35 ? 'DRILL_35MM' : h.diameter === 15 ? 'DRILL_15MM' : h.diameter === 8 ? 'DRILL_8MM' : 'DRILL_5MM';
      body += dxfCircle(h.x, h.y, h.diameter / 2, layer);
    }

    // Add grooves
    for (const g of cncOperations.grooves) {
      body += dxfLine(g.x1, g.y1, g.x2, g.y2, 'GROOVE_6MM');
    }

    const dxf = `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${body}0\nENDSEC\n0\nEOF\n`;
    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ultida-cnc-${panelPreset}-${pWidth}x${pLength}mm-${machinePreset}.dxf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  // ── Download Standard ISO G-Code ──
  function downloadGCode() {
    const lines = [
      '(==================================================)',
      `( ULTIDA CNC MACHINE CENTER: ${panelPreset.toUpperCase()} )`,
      `( DIMENSIONS: ${pWidth} x ${pLength} x ${pThickness} mm )`,
      `( TARGET POST-PROCESSOR: ${machinePreset.toUpperCase()} )`,
      `( TOTAL HOLES: ${cncOperations.holes.length} | GROOVES: ${cncOperations.grooves.length} )`,
      '(==================================================)',
      'G21 (Metric Units mm)',
      'G90 (Absolute Positioning)',
      'G17 (XY Plane Selection)',
      'G00 Z50.00 (Safe Clearance Plane)',
      '',
    ];

    // Tool 1: 5mm Line Boring & Pin Holes
    const holes5 = cncOperations.holes.filter(h => h.diameter === 5);
    if (holes5.length > 0) {
      lines.push('( --- TOOL 01: 5MM DRILL BIT --- )');
      lines.push('T01 M06');
      lines.push('S4500 M03 (Spindle CW 4500 RPM)');
      lines.push('G00 Z10.00');
      for (const h of holes5) {
        lines.push(`G00 X${h.x.toFixed(2)} Y${h.y.toFixed(2)}`);
        lines.push(`G81 Z-${h.depth.toFixed(2)} R2.00 F650 (Canned Drill Cycle)`);
      }
      lines.push('G80 (Cancel Drill Cycle)');
      lines.push('G00 Z50.00');
      lines.push('');
    }

    // Tool 2: 35mm Hinge Borer
    const holes35 = cncOperations.holes.filter(h => h.diameter === 35);
    if (holes35.length > 0) {
      lines.push('( --- TOOL 02: 35MM HINGE CUP BORER --- )');
      lines.push('T02 M06');
      lines.push('S3000 M03 (Spindle CW 3000 RPM)');
      lines.push('G00 Z10.00');
      for (const h of holes35) {
        lines.push(`G00 X${h.x.toFixed(2)} Y${h.y.toFixed(2)}`);
        lines.push(`G81 Z-${h.depth.toFixed(2)} R2.00 F350`);
      }
      lines.push('G80');
      lines.push('G00 Z50.00');
      lines.push('');
    }

    // Tool 3: 8mm Dowel Drill
    const holes8 = cncOperations.holes.filter(h => h.diameter === 8);
    if (holes8.length > 0) {
      lines.push('( --- TOOL 03: 8MM DOWEL DRILL --- )');
      lines.push('T03 M06');
      lines.push('S4000 M03');
      for (const h of holes8) {
        lines.push(`G00 X${h.x.toFixed(2)} Y${h.y.toFixed(2)}`);
        lines.push(`G81 Z-${h.depth.toFixed(2)} R2.00 F500`);
      }
      lines.push('G80');
      lines.push('G00 Z50.00');
      lines.push('');
    }

    // Tool 4: 6mm Router for Grooving
    if (cncOperations.grooves.length > 0) {
      lines.push('( --- TOOL 05: 6MM GROOVE ENDMILL --- )');
      lines.push('T05 M06');
      lines.push('S18000 M03 (High Frequency Spindle 18000 RPM)');
      for (const g of cncOperations.grooves) {
        lines.push(`G00 X${g.x1.toFixed(2)} Y${g.y1.toFixed(2)}`);
        lines.push(`G01 Z-${g.depth.toFixed(2)} F1200`);
        lines.push(`G01 X${g.x2.toFixed(2)} Y${g.y2.toFixed(2)} F3200`);
        lines.push('G00 Z25.00');
      }
      lines.push('G00 Z50.00');
      lines.push('');
    }

    lines.push('M05 (Spindle Stop)');
    lines.push('G00 X0.00 Y0.00 (Return to Machine Origin)');
    lines.push('M30 (Program End & Rewind)');

    const gcodeText = lines.join('\n');
    const blob = new Blob([gcodeText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ultida-cnc-${panelPreset}-${pWidth}x${pLength}mm.nc`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  // ── Jaali Download ──
  const validJaali = jWidth >= 100 && jHeight >= 100 && jSpacing >= 30 && jSpacing <= Math.min(jWidth, jHeight);
  function downloadJaali() {
    if (!validJaali) return;
    const blob = new Blob([dxfForJaali(pattern, jWidth, jHeight, jSpacing, jToolDiameter)], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ultida-${pattern}-jaali-${jWidth}x${jHeight}mm.dxf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="cnc-pattern-studio" style={{ maxWidth: 1440, margin: '0 auto', padding: '24px 32px' }}>
      {/* ── Top Header ── */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a88220', marginBottom: 4 }}>
            <Compass size={14} /> System 32 CNC Machine Center &amp; Toolpath Generator
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1c1917', margin: 0, letterSpacing: '-0.02em' }}>
            CNC Boring &amp; Joinery Studio
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#78716c' }}>
            Generate production-accurate 32mm pitch line boring, 35mm hinge cups, minifix cam connectors, back panel grooving, and G-code for industrial CNC beam saws and machining centers.
          </p>
        </div>

        {/* Studio Mode Selector */}
        <div style={{ display: 'flex', gap: 6, background: '#f5f5f4', padding: 4, borderRadius: 8, border: '1px solid #d8cabb' }}>
          <button
            onClick={() => setStudioMode('system32')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 6,
              border: 0,
              fontSize: 12.5,
              fontWeight: studioMode === 'system32' ? 800 : 600,
              background: studioMode === 'system32' ? 'linear-gradient(135deg, #c59c2d, #a88220)' : 'transparent',
              color: studioMode === 'system32' ? '#1c1917' : '#57534e',
              cursor: 'pointer',
              boxShadow: studioMode === 'system32' ? '0 2px 6px rgba(197,156,45,0.25)' : 'none',
            }}
          >
            <Wrench size={14} /> System 32 Cabinet Boring
          </button>
          <button
            onClick={() => setStudioMode('jaali')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 6,
              border: 0,
              fontSize: 12.5,
              fontWeight: studioMode === 'jaali' ? 800 : 600,
              background: studioMode === 'jaali' ? 'linear-gradient(135deg, #c59c2d, #a88220)' : 'transparent',
              color: studioMode === 'jaali' ? '#1c1917' : '#57534e',
              cursor: 'pointer',
              boxShadow: studioMode === 'jaali' ? '0 2px 6px rgba(197,156,45,0.25)' : 'none',
            }}
          >
            <Sparkles size={14} /> Decorative Jaali Lattice
          </button>
        </div>
      </header>

      {/* ══════ MODE A: SYSTEM 32 CABINET BORING & MILLING MACHINE CENTER ══════ */}
      {studioMode === 'system32' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1.4fr) minmax(360px, 1fr)', gap: 24, alignItems: 'start' }}>
          {/* Left Column: Visual CNC Toolpath Canvas */}
          <section style={{ background: '#1c1917', borderRadius: 14, padding: 20, color: '#f5f5f4', border: '1px solid #44403c', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #332f2c', paddingBottom: 10 }}>
              <div>
                <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#c59c2d', fontWeight: 800 }}>
                  Live CNC Toolpath Visualizer
                </span>
                <strong style={{ display: 'block', fontSize: 16, color: '#fff' }}>
                  {pWidth} mm × {pLength} mm · {pThickness}mm Stock
                </strong>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={downloadSystem32Dxf}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 12px',
                    borderRadius: 6,
                    border: '1px solid #c59c2d',
                    background: 'rgba(197,156,45,0.15)',
                    color: '#fbbf24',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  <Download size={13} /> Layered DXF
                </button>
                <button
                  onClick={downloadGCode}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    borderRadius: 6,
                    border: 0,
                    background: 'linear-gradient(135deg, #c59c2d, #a88220)',
                    color: '#1c1917',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  <FileCode size={13} /> ISO G-Code (.nc)
                </button>
              </div>
            </div>

            {/* SVG Visualizer Canvas */}
            <div style={{ width: '100%', height: 440, background: '#141210', borderRadius: 10, border: '1px solid #292524', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              <svg
                viewBox={`-40 -40 ${pWidth + 80} ${pLength + 80}`}
                style={{ width: '92%', height: '92%', maxHeight: 420 }}
              >
                {/* Grid guidelines */}
                <defs>
                  <pattern id="cnc-grid" width="100" height="100" patternUnits="userSpaceOnUse">
                    <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect x="-40" y="-40" width={pWidth + 80} height={pLength + 80} fill="url(#cnc-grid)" />

                {/* Physical Panel Stock */}
                <rect
                  x="0"
                  y="0"
                  width={pWidth}
                  height={pLength}
                  fill="#24201c"
                  stroke="#c59c2d"
                  strokeWidth="3"
                  rx="2"
                />

                {/* Dimension Annotations */}
                <line x1="0" y1="-15" x2={pWidth} y2="-15" stroke="#a88220" strokeWidth="1.5" markerEnd="url(#arrow)" />
                <text x={pWidth / 2} y="-20" fill="#c59c2d" fontSize="20" textAnchor="middle" fontWeight="bold">
                  {pWidth} mm
                </text>

                <line x1="-15" y1="0" x2="-15" y2={pLength} stroke="#a88220" strokeWidth="1.5" />
                <text
                  x="-25"
                  y={pLength / 2}
                  fill="#c59c2d"
                  fontSize="20"
                  textAnchor="middle"
                  fontWeight="bold"
                  transform={`rotate(-90, -25, ${pLength / 2})`}
                >
                  {pLength} mm
                </text>

                {/* Back Panel Groove Pass */}
                {cncOperations.grooves.map((g) => (
                  <g key={g.id}>
                    <line
                      x1={g.x1}
                      y1={g.y1}
                      x2={g.x2}
                      y2={g.y2}
                      stroke="#f97316"
                      strokeWidth={g.width * 1.5}
                      strokeDasharray="8 4"
                      opacity="0.8"
                    />
                    <text x={g.x1 + 10} y={100} fill="#f97316" fontSize="16" fontWeight="bold">
                      Back Groove (6×8mm)
                    </text>
                  </g>
                ))}

                {/* Drill Holes */}
                {cncOperations.holes.map((h) => {
                  const is35 = h.diameter === 35;
                  const is15 = h.diameter === 15;
                  const is8 = h.diameter === 8;
                  const fill = is35 ? '#ef4444' : is15 ? '#10b981' : is8 ? '#38bdf8' : '#a855f7';
                  return (
                    <g key={h.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedOperation(`${h.toolId} at X:${h.x} Y:${h.y} Depth:${h.depth}mm`)}>
                      <circle
                        cx={h.x}
                        cy={h.y}
                        r={h.diameter / 2}
                        fill={fill}
                        fillOpacity="0.75"
                        stroke="#fff"
                        strokeWidth="1.2"
                      />
                      {is35 && (
                        <circle cx={h.x} cy={h.y} r={h.diameter / 2 + 3} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" />
                      )}
                      <line x1={h.x - 3} y1={h.y} x2={h.x + 3} y2={h.y} stroke="#fff" strokeWidth="0.8" />
                      <line x1={h.x} y1={h.y - 3} x2={h.x} y2={h.y + 3} stroke="#fff" strokeWidth="0.8" />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Tooling Legend & Active Inspection Bar */}
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#a855f7' }} /> T1: Ø5mm Shelf Pins ({cncOperations.holes.filter(h => h.diameter === 5).length})
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444' }} /> T2: Ø35mm Hinge Cup ({cncOperations.holes.filter(h => h.diameter === 35).length})
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#38bdf8' }} /> T3: Ø8mm Dowel ({cncOperations.holes.filter(h => h.diameter === 8).length})
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#10b981' }} /> T4: Ø15mm Minifix ({cncOperations.holes.filter(h => h.diameter === 15).length})
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 14, height: 3, background: '#f97316' }} /> T5: 6mm Groove
                </span>
              </div>
            </div>

            {selectedOperation && (
              <div style={{ marginTop: 10, padding: '6px 12px', background: 'rgba(197,156,45,0.15)', borderRadius: 6, fontSize: 11.5, color: '#fbbf24', border: '1px solid rgba(197,156,45,0.3)' }}>
                Target Operation: <strong>{selectedOperation}</strong>
              </div>
            )}
          </section>

          {/* Right Column: Parameters, Presets & Controls */}
          <section style={{ background: '#fff', borderRadius: 14, padding: 22, border: '1px solid #e7ded4', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1c1917', margin: '0 0 12px' }}>
              1. Modular Panel Preset
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 18 }}>
              {[
                { id: 'gable_left', label: 'Gable Left (Side)', desc: '2400×580mm' },
                { id: 'gable_right', label: 'Gable Right (Side)', desc: '2400×580mm' },
                { id: 'shutter_door', label: 'Shutter Door', desc: '2394×594mm' },
                { id: 'top_bottom_deck', label: 'Fixed Deck', desc: '564×580mm' },
                { id: 'adj_shelf', label: 'Adjustable Shelf', desc: '562×560mm' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id as any)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    textAlign: 'left',
                    border: panelPreset === p.id ? '2px solid #c59c2d' : '1px solid #d8cabb',
                    background: panelPreset === p.id ? '#fff9e6' : '#faf6f0',
                    cursor: 'pointer',
                  }}
                >
                  <strong style={{ display: 'block', fontSize: 12, color: panelPreset === p.id ? '#92400e' : '#1c1917' }}>
                    {p.label}
                  </strong>
                  <small style={{ color: '#78716c', fontSize: 10.5 }}>{p.desc}</small>
                </button>
              ))}
            </div>

            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1c1917', margin: '0 0 12px' }}>
              2. Dimensions &amp; Stock Spec
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#57534e', marginBottom: 4 }}>Length (mm)</label>
                <input
                  type="number"
                  value={pLength}
                  onChange={(e) => setPLength(Math.max(100, Number(e.target.value)))}
                  style={{ width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid #d8cabb', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#57534e', marginBottom: 4 }}>Width (mm)</label>
                <input
                  type="number"
                  value={pWidth}
                  onChange={(e) => setPWidth(Math.max(100, Number(e.target.value)))}
                  style={{ width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid #d8cabb', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#57534e', marginBottom: 4 }}>Core (mm)</label>
                <select
                  value={pThickness}
                  onChange={(e) => setPThickness(Number(e.target.value))}
                  style={{ width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid #d8cabb', fontSize: 13, background: '#fff' }}
                >
                  <option value={18}>18mm (Std Carcass)</option>
                  <option value={19}>19mm (Marine BWP)</option>
                  <option value={25}>25mm (Heavy Top)</option>
                  <option value={12}>12mm (Back Wall)</option>
                </select>
              </div>
            </div>

            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1c1917', margin: '0 0 12px' }}>
              3. System 32 Boring Operations
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#292524', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enableLineBoring}
                  onChange={(e) => setEnableLineBoring(e.target.checked)}
                />
                <span>32mm Pitch Line Boring (Ø5mm at 37mm front &amp; rear setback)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#292524', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enableHingeBoring}
                  onChange={(e) => setEnableHingeBoring(e.target.checked)}
                />
                <span>Concealed Hinge Boring (Ø35mm cup at 21.5mm edge setback)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#292524', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enableMinifix}
                  onChange={(e) => setEnableMinifix(e.target.checked)}
                />
                <span>Minifix Cam &amp; Dowel Connectors (Ø15mm cam + Ø8mm dowel)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#292524', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enableBackGroove}
                  onChange={(e) => setEnableBackGroove(e.target.checked)}
                />
                <span>Back Panel Grooving (6mm cutter pass, 8mm depth, 15mm setback)</span>
              </label>
            </div>

            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1c1917', margin: '0 0 10px' }}>
              4. Target Machine Postprocessor
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 6, marginBottom: 18 }}>
              {[
                { id: 'homag', label: 'Homag WoodWOP' },
                { id: 'biesse', label: 'Biesse bSolid' },
                { id: 'scm', label: 'SCM Maestro' },
                { id: 'generic', label: 'Generic ISO G-Code' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMachinePreset(m.id as any)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: machinePreset === m.id ? '2px solid #c59c2d' : '1px solid #d8cabb',
                    background: machinePreset === m.id ? '#fff9e6' : '#fff',
                    color: machinePreset === m.id ? '#92400e' : '#44403c',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={downloadSystem32Dxf}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid #c59c2d',
                  background: '#fff',
                  color: '#92400e',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <Download size={14} /> Export DXF Layers
              </button>

              <button
                onClick={downloadGCode}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: 0,
                  background: 'linear-gradient(135deg, #c59c2d, #a88220)',
                  color: '#1c1917',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(197,156,45,0.3)',
                }}
              >
                <FileCode size={14} /> Generate G-Code
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ══════ MODE B: DECORATIVE JAALI LATTICE STUDIO ══════ */}
      {studioMode === 'jaali' && (
        <div className="cnc-grid">
          <section className="cnc-panel">
            <h2>1. Add visual reference or inspect live CAD vector</h2>
            <label className="cnc-upload">
              {jReference ? (
                <img src={jReference} alt="CNC reference" />
              ) : (
                <>
                  <ImagePlus size={22}/>
                  <strong>Upload reference image</strong>
                  <span>PNG, JPG or WebP — reference only</span>
                </>
              )}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) setJReference(URL.createObjectURL(file)); }} />
            </label>

            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: '#1c1917', border: '1px solid #44403c', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 11, fontWeight: 700, color: '#c59c2d' }}>
                <span>Live CNC Vector Toolpath</span>
                <span>{jWidth} × {jHeight} mm · {jMaterialThickness}mm Stock</span>
              </div>
              <svg viewBox={`0 0 ${jWidth} ${jHeight}`} style={{ width: '100%', maxHeight: 220, background: '#292524', borderRadius: 6, border: '1px solid #57534e' }}>
                <rect x={0} y={0} width={jWidth} height={jHeight} fill="#292524" stroke="#c59c2d" strokeWidth={Math.max(2, jWidth * 0.005)} />
                {pattern === 'diamond' && (() => {
                  const lines = [];
                  for (let x = -jHeight; x < jWidth + jHeight; x += jSpacing) {
                    lines.push(<line key={`d1-${x}`} x1={x} y1={0} x2={x + jHeight} y2={jHeight} stroke="#e7e5e4" strokeWidth={jToolDiameter} strokeOpacity={0.75} />);
                    lines.push(<line key={`d2-${x}`} x1={x} y1={jHeight} x2={x + jHeight} y2={0} stroke="#e7e5e4" strokeWidth={jToolDiameter} strokeOpacity={0.75} />);
                  }
                  return <g>{lines}</g>;
                })()}
                {pattern === 'circle' && (() => {
                  const circles = [];
                  const r = Math.max(8, jSpacing * 0.28);
                  for (let y = jSpacing / 2; y < jHeight; y += jSpacing) {
                    for (let x = jSpacing / 2; x < jWidth; x += jSpacing) {
                      circles.push(<circle key={`c-${x}-${y}`} cx={x} cy={y} r={r} fill="#1c1917" stroke="#e7e5e4" strokeWidth={jToolDiameter} />);
                    }
                  }
                  return <g>{circles}</g>;
                })()}
                {pattern === 'arch' && (() => {
                  const bays = Math.max(1, Math.floor(jWidth / jSpacing));
                  const bay = jWidth / bays;
                  const radius = bay / 2;
                  const arches = [];
                  for (let i = 0; i < bays; i++) {
                    const center = bay * i + radius;
                    arches.push(<path key={`a-${i}`} d={`M ${center - radius} ${radius} A ${radius} ${radius} 0 0 1 ${center + radius} ${radius} L ${center + radius} ${jHeight} L ${center - radius} ${jHeight} Z`} fill="#1c1917" stroke="#e7e5e4" strokeWidth={jToolDiameter} />);
                  }
                  return <g>{arches}</g>;
                })()}
                {pattern === 'om' && (() => {
                  const cx = jWidth / 2;
                  const cy = jHeight / 2;
                  const r = Math.min(jWidth, jHeight) * 0.24;
                  return <g>
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e7e5e4" strokeWidth={jToolDiameter} />
                    <circle cx={cx} cy={cy} r={r * 0.5} fill="#1c1917" stroke="#c59c2d" strokeWidth={jToolDiameter} />
                    <circle cx={cx} cy={cy - r * 0.8} r={jToolDiameter * 2} fill="#c59c2d" />
                  </g>;
                })()}
                {pattern === 'floral' && (() => {
                  const cx = jWidth / 2;
                  const cy = jHeight / 2;
                  const r = Math.min(jWidth, jHeight) * 0.15;
                  const petals = [];
                  for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI * 2 * i) / 8;
                    const px = cx + Math.cos(angle) * r * 1.5;
                    const py = cy + Math.sin(angle) * r * 1.5;
                    petals.push(<circle key={`p-${i}`} cx={px} cy={py} r={r * 0.72} fill="#1c1917" stroke="#e7e5e4" strokeWidth={jToolDiameter} />);
                  }
                  return <g>{petals}<circle cx={cx} cy={cy} r={r * 0.72} fill="#1c1917" stroke="#c59c2d" strokeWidth={jToolDiameter} /></g>;
                })()}
              </svg>
            </div>

            <div className="cnc-safety">
              <ShieldCheck size={17}/>
              <span>DXF output is generated from the selected template and millimetre dimensions, never from unverified image pixels.</span>
            </div>
          </section>

          <section className="cnc-panel">
            <h2>2. Choose a template &amp; specify millimetres</h2>
            <div className="cnc-patterns">
              {(Object.keys(patternNames) as Pattern[]).map((value) => (
                <button key={value} className={pattern === value ? 'active' : ''} onClick={() => setPattern(value)}>
                  <Sparkles size={16}/>
                  <strong>{patternNames[value]}</strong>
                  <small>{value === 'diamond' ? 'Classic linear CNC panel' : value === 'arch' ? 'Soft European repeat' : value === 'om' ? 'Centred symbolic medallion' : value === 'floral' ? 'Centred rosette repeat' : 'Ventilated round lattice'}</small>
                </button>
              ))}
            </div>

            <div className="cnc-inputs">
              <label>Panel width (mm)<input type="number" min={100} value={jWidth} onChange={(event) => setJWidth(Number(event.target.value))}/></label>
              <label>Panel height (mm)<input type="number" min={100} value={jHeight} onChange={(event) => setJHeight(Number(event.target.value))}/></label>
              <label>Pattern pitch (mm)<input type="number" min={30} value={jSpacing} onChange={(event) => setJSpacing(Number(event.target.value))}/></label>
              <label>Tool diameter (mm)<input type="number" min={1} step="0.1" value={jToolDiameter} onChange={(event) => setJToolDiameter(Number(event.target.value))}/></label>
              <label>Material thickness (mm)<input type="number" min={1} step="0.1" value={jMaterialThickness} onChange={(event) => setJMaterialThickness(Number(event.target.value))}/></label>
              <label>Minimum bridge (mm)<input type="number" min={1} step="0.1" value={jBridgeMm} onChange={(event) => setJBridgeMm(Number(event.target.value))}/></label>
            </div>

            <div style={{ marginTop: 18 }}>
              <button
                className="cnc-download"
                disabled={!validJaali}
                onClick={downloadJaali}
                style={{ width: '100%', padding: '10px 18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Download size={16} /> Download Jaali DXF ({jWidth}×{jHeight}mm)
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
