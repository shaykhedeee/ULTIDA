import { Download, ImagePlus, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import './cnc-pattern-studio.css';

type Pattern = 'diamond' | 'arch' | 'circle' | 'om' | 'floral';
const patternNames: Record<Pattern, string> = { diamond: 'Diamond jaali', arch: 'Arch lattice', circle: 'Circle lattice', om: 'Om medallion', floral: 'Floral rosette' };

function dxfLine(x1: number, y1: number, x2: number, y2: number, layer = 'CUT') { return `0\nLINE\n8\n${layer}\n10\n${x1}\n20\n${y1}\n11\n${x2}\n21\n${y2}\n`; }
function dxfCircle(x: number, y: number, radius: number) { return `0\nCIRCLE\n8\nCUT\n10\n${x}\n20\n${y}\n40\n${radius}\n`; }
function dxfArc(x: number, y: number, radius: number, start: number, end: number) { return `0\nARC\n8\nCUT\n10\n${x}\n20\n${y}\n40\n${radius}\n50\n${start}\n51\n${end}\n`; }
function dxfFor(pattern: Pattern, width: number, height: number, spacing: number) {
  let body = dxfLine(0, 0, width, 0, 'OUTLINE') + dxfLine(width, 0, width, height, 'OUTLINE') + dxfLine(width, height, 0, height, 'OUTLINE') + dxfLine(0, height, 0, 0, 'OUTLINE');
  if (pattern === 'diamond') {
    for (let x = -height; x < width + height; x += spacing) { body += dxfLine(x, 0, x + height, height); body += dxfLine(x, height, x + height, 0); }
  } else if (pattern === 'circle') {
    for (let y = spacing / 2; y < height; y += spacing) for (let x = spacing / 2; x < width; x += spacing) body += dxfCircle(x, y, Math.max(8, spacing * .28));
  } else if (pattern === 'arch') {
    const bays = Math.max(1, Math.floor(width / spacing)); const bay = width / bays; const radius = bay / 2;
    for (let i = 0; i < bays; i++) { const center = bay * i + radius; body += dxfArc(center, 0, radius, 0, 180); body += dxfLine(center - radius, 0, center - radius, Math.min(height, radius)); body += dxfLine(center + radius, 0, center + radius, Math.min(height, radius)); }
  } else if (pattern === 'om') {
    const cx = width / 2; const cy = height / 2; const r = Math.min(width, height) * .24;
    body += dxfCircle(cx, cy, r);
    body += dxfArc(cx, cy, r * .68, 210, 120);
    body += dxfArc(cx + r * .18, cy - r * .05, r * .42, 70, 290);
    body += dxfLine(cx - r * .55, cy + r * .2, cx + r * .55, cy + r * .2);
    body += dxfLine(cx, cy - r * 1.05, cx, cy - r * .7);
  } else {
    const cx = width / 2; const cy = height / 2; const r = Math.min(width, height) * .15;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8; const px = cx + Math.cos(angle) * r * 1.5; const py = cy + Math.sin(angle) * r * 1.5;
      body += dxfCircle(px, py, r * .72);
    }
    body += dxfCircle(cx, cy, r * .72);
  }
  return `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${body}0\nENDSEC\n0\nEOF\n`;
}

export function CncPatternStudio() {
  const [pattern, setPattern] = useState<Pattern>('diamond');
  const [width, setWidth] = useState(600);
  const [height, setHeight] = useState(900);
  const [spacing, setSpacing] = useState(100);
  const [toolDiameter, setToolDiameter] = useState(6);
  const [materialThickness, setMaterialThickness] = useState(18);
  const [bridgeMm, setBridgeMm] = useState(12);
  const [reference, setReference] = useState<string | null>(null);

  const valid = width >= 100 && height >= 100 && spacing >= 30 && spacing <= Math.min(width, height) && toolDiameter > 0 && materialThickness > 0 && bridgeMm >= toolDiameter && (pattern !== 'circle' || spacing - Math.max(8, spacing * .56) >= bridgeMm) && (pattern !== 'floral' || spacing >= toolDiameter * 8);

  function download() {
    if (!valid) return;
    const blob = new Blob([dxfFor(pattern, width, height, spacing)], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ultida-${pattern}-jaali-${width}x${height}mm.dxf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const safetyIssue = !valid ? (bridgeMm < toolDiameter ? 'Bridge width must be at least the selected tool diameter.' : pattern === 'circle' && spacing - Math.max(8, spacing * .56) < bridgeMm ? 'Increase pitch or reduce the bridge requirement so circle openings retain material between cuts.' : pattern === 'floral' && spacing < toolDiameter * 8 ? 'Floral templates need a pitch at least eight tool diameters wide.' : 'Use a panel of at least 100 mm and a pitch between 30 mm and the smallest panel dimension.') : '';

  // SVG dimensions
  const svgAspect = width / (height || 1);
  const svgW = 280;
  const svgH = Math.round(svgW / (svgAspect || 1));

  return <div className="cnc-pattern-studio">
    <header>
      <div>
        <p>CNC PATTERN STUDIO</p>
        <h1>Reference-led, vector-safe DXF templates</h1>
        <span>Use an image for visual direction. ULTIDA does not guess manufacturing vectors from pixels: you select a reviewed template and confirm the dimensions.</span>
      </div>
      <button className="cnc-download" disabled={!valid} onClick={download}>
        <Download size={16} /> Download DXF ({width}×{height}mm)
      </button>
    </header>

    <div className="cnc-grid">
      <section className="cnc-panel">
        <h2>1. Add visual reference or inspect live CAD vector</h2>
        <label className="cnc-upload">
          {reference ? (
            <img src={reference} alt="CNC reference" />
          ) : (
            <>
              <ImagePlus size={22}/>
              <strong>Upload reference image</strong>
              <span>PNG, JPG or WebP — reference only</span>
            </>
          )}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) setReference(URL.createObjectURL(file)); }} />
        </label>

        {/* Live 2D Technical SVG Jaali Vector Preview */}
        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: '#1c1917', border: '1px solid #44403c', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 11, fontWeight: 700, color: '#c59c2d' }}>
            <span>Live CNC Vector Toolpath</span>
            <span>{width} × {height} mm · {materialThickness}mm Pl</span>
          </div>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', maxHeight: 220, background: '#292524', borderRadius: 6, border: '1px solid #57534e' }}>
            <rect x={0} y={0} width={width} height={height} fill="#292524" stroke="#c59c2d" strokeWidth={Math.max(2, width * 0.005)} />
            {pattern === 'diamond' && (() => {
              const lines = [];
              for (let x = -height; x < width + height; x += spacing) {
                lines.push(<line key={`d1-${x}`} x1={x} y1={0} x2={x + height} y2={height} stroke="#e7e5e4" strokeWidth={toolDiameter} strokeOpacity={0.75} />);
                lines.push(<line key={`d2-${x}`} x1={x} y1={height} x2={x + height} y2={0} stroke="#e7e5e4" strokeWidth={toolDiameter} strokeOpacity={0.75} />);
              }
              return <g>{lines}</g>;
            })()}
            {pattern === 'circle' && (() => {
              const circles = [];
              const r = Math.max(8, spacing * 0.28);
              for (let y = spacing / 2; y < height; y += spacing) {
                for (let x = spacing / 2; x < width; x += spacing) {
                  circles.push(<circle key={`c-${x}-${y}`} cx={x} cy={y} r={r} fill="#1c1917" stroke="#e7e5e4" strokeWidth={toolDiameter} />);
                }
              }
              return <g>{circles}</g>;
            })()}
            {pattern === 'arch' && (() => {
              const bays = Math.max(1, Math.floor(width / spacing));
              const bay = width / bays;
              const radius = bay / 2;
              const arches = [];
              for (let i = 0; i < bays; i++) {
                const cx = bay * i + radius;
                arches.push(<path key={`a-${i}`} d={`M ${cx - radius} ${radius} A ${radius} ${radius} 0 0 1 ${cx + radius} ${radius} L ${cx + radius} ${height} L ${cx - radius} ${height} Z`} fill="#1c1917" stroke="#e7e5e4" strokeWidth={toolDiameter} />);
              }
              return <g>{arches}</g>;
            })()}
            {pattern === 'om' && (() => {
              const cx = width / 2;
              const cy = height / 2;
              const r = Math.min(width, height) * 0.24;
              return <g>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e7e5e4" strokeWidth={toolDiameter} />
                <circle cx={cx} cy={cy} r={r * 0.5} fill="#1c1917" stroke="#c59c2d" strokeWidth={toolDiameter} />
                <circle cx={cx} cy={cy - r * 0.8} r={toolDiameter * 2} fill="#c59c2d" />
              </g>;
            })()}
            {pattern === 'floral' && (() => {
              const cx = width / 2;
              const cy = height / 2;
              const r = Math.min(width, height) * 0.15;
              const petals = [];
              for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 * i) / 8;
                const px = cx + Math.cos(angle) * r * 1.5;
                const py = cy + Math.sin(angle) * r * 1.5;
                petals.push(<circle key={`p-${i}`} cx={px} cy={py} r={r * 0.72} fill="#1c1917" stroke="#e7e5e4" strokeWidth={toolDiameter} />);
              }
              return <g>{petals}<circle cx={cx} cy={cy} r={r * 0.72} fill="#1c1917" stroke="#c59c2d" strokeWidth={toolDiameter} /></g>;
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
          <label>Panel width (mm)<input type="number" min={100} value={width} onChange={(event) => setWidth(Number(event.target.value))}/></label>
          <label>Panel height (mm)<input type="number" min={100} value={height} onChange={(event) => setHeight(Number(event.target.value))}/></label>
          <label>Pattern pitch (mm)<input type="number" min={30} value={spacing} onChange={(event) => setSpacing(Number(event.target.value))}/></label>
          <label>Tool diameter (mm)<input type="number" min={1} step="0.1" value={toolDiameter} onChange={(event) => setToolDiameter(Number(event.target.value))}/></label>
          <label>Material thickness (mm)<input type="number" min={1} step="0.1" value={materialThickness} onChange={(event) => setMaterialThickness(Number(event.target.value))}/></label>
          <label>Minimum bridge (mm)<input type="number" min={1} step="0.1" value={bridgeMm} onChange={(event) => setBridgeMm(Number(event.target.value))}/></label>
        </div>

        {!valid && <p className="cnc-error"><TriangleAlert size={15}/>{safetyIssue}</p>}
        <p className="cnc-note">Validated output is DXF geometry only. Confirm machine envelope, origin, tool library, hold-down, feed, and postprocessor with your CNC operator before cutting; ULTIDA intentionally does not emit generic G-code.</p>
      </section>
    </div>
  </div>;
}
