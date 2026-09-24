import {
  ArrowLeftRight, Copy, Ruler, RotateCcw, Compass, CheckCircle2,
  AlertTriangle, ShieldCheck, Download, ArrowRight, Home, Save, Layers
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './measurement-converter.css';

type Unit = 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'ft-in';

const units: Array<{ id: Unit; label: string; short: string; mm: number }> = [
  { id: 'mm', label: 'Millimetres', short: 'mm', mm: 1 },
  { id: 'cm', label: 'Centimetres', short: 'cm', mm: 10 },
  { id: 'm', label: 'Metres', short: 'm', mm: 1000 },
  { id: 'in', label: 'Inches', short: 'in', mm: 25.4 },
  { id: 'ft', label: 'Feet', short: 'ft', mm: 304.8 },
  { id: 'ft-in', label: 'Feet + inches', short: 'ft/in', mm: 1 },
];

export function parseFlexibleDimensionToMm(input: string): number | null {
  const str = String(input).trim().toLowerCase();
  if (!str) return null;

  // Pattern 1: Feet & inches like 12'6", 12' 6", 12ft 6in, 12' 6.5", 12-6
  const ftInMatch = str.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft)?(?:\s*[-/]?\s*(\d+(?:\.\d+)?)\s*(?:"|in)?)?$/);
  if (ftInMatch && (str.includes("'") || str.includes('ft') || str.includes('"') || str.includes('in') || str.includes('-'))) {
    const feet = Number(ftInMatch[1]);
    const inches = Number(ftInMatch[2] ?? 0);
    if (Number.isFinite(feet) && Number.isFinite(inches) && inches < 12) {
      return Math.round(feet * 304.8 + inches * 25.4);
    }
  }

  // Pattern 2: Pure number (default mm if > 50, meters if < 10)
  const num = Number(str.replace(/[^0-9.]/g, ''));
  if (Number.isFinite(num) && num > 0) {
    if (str.endsWith('m') && !str.endsWith('mm')) return Math.round(num * 1000);
    if (str.endsWith('cm')) return Math.round(num * 10);
    if (str.endsWith('in') || str.endsWith('"')) return Math.round(num * 25.4);
    if (str.endsWith('ft') || str.endsWith("'")) return Math.round(num * 304.8);
    // Unadorned number: if < 20, assume meters (e.g. 4.2m), otherwise mm (e.g. 4200)
    return num <= 20 ? Math.round(num * 1000) : Math.round(num);
  }

  return null;
}

export function parseFeetInches(value: string): number | null {
  const match = value.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(?:'|ft)?\s*(?:[-\s]*(\d+(?:\.\d+)?))?\s*(?:"|in)?$/);
  if (!match) return null;
  const feet = Number(match[1]);
  const inches = Number(match[2] ?? 0);
  if (!Number.isFinite(feet) || !Number.isFinite(inches) || inches >= 12) return null;
  return feet * 304.8 + inches * 25.4;
}

export function toMm(value: string, unit: Unit): number | null {
  if (unit === 'ft-in') return parseFeetInches(value);
  const numeric = Number(value);
  const factor = units.find((item) => item.id === unit)?.mm;
  return Number.isFinite(numeric) && numeric >= 0 && factor ? numeric * factor : null;
}

export function feetInches(mm: number): string {
  const totalInches = mm / 25.4;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round((totalInches - feet * 12) * 100) / 100;
  return `${feet}' ${inches.toFixed(inches % 1 ? 2 : 0)}\"`;
}

export function display(mm: number, unit: Unit): string {
  if (unit === 'ft-in') return feetInches(mm);
  const factor = units.find((item) => item.id === unit)?.mm ?? 1;
  const value = Math.round((mm / factor) * 1000) / 1000;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${units.find((item) => item.id === unit)?.short}`;
}

export function MeasurementConverter() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'survey' | 'converter'>('survey');

  // Single converter state
  const [value, setValue] = useState('4200');
  const [from, setFrom] = useState<Unit>('mm');
  const [to, setTo] = useState<Unit>('ft-in');
  const [copied, setCopied] = useState(false);
  const millimetres = useMemo(() => toMm(value, from), [value, from]);
  const result = millimetres === null ? null : display(millimetres, to);

  // Site Survey Sheet State
  const [roomName, setRoomName] = useState('Master Bedroom Suite');
  const [wallAInput, setWallAInput] = useState('4200'); // North
  const [wallBInput, setWallBInput] = useState('3600'); // East
  const [wallCInput, setWallCInput] = useState('4200'); // South
  const [wallDInput, setWallDInput] = useState('3600'); // West
  const [diagonalInput, setDiagonalInput] = useState('5532'); // Corner A to C (hypot of 4200 & 3600 is 5531.7)
  const [ceilingNW, setCeilingNW] = useState('2700');
  const [ceilingNE, setCeilingNE] = useState('2695');
  const [ceilingSE, setCeilingSE] = useState('2700');
  const [ceilingSW, setCeilingSW] = useState('2690');
  const [surveyMessage, setSurveyMessage] = useState('');

  // Parsed survey values in canonical mm
  const wallAMm = useMemo(() => parseFlexibleDimensionToMm(wallAInput) ?? 4200, [wallAInput]);
  const wallBMm = useMemo(() => parseFlexibleDimensionToMm(wallBInput) ?? 3600, [wallBInput]);
  const wallCMm = useMemo(() => parseFlexibleDimensionToMm(wallCInput) ?? 4200, [wallCInput]);
  const wallDMm = useMemo(() => parseFlexibleDimensionToMm(wallDInput) ?? 3600, [wallDInput]);
  const measuredDiagMm = useMemo(() => parseFlexibleDimensionToMm(diagonalInput) ?? 5532, [diagonalInput]);

  // Automated Pythagorean 90° Squaring Verification
  const theoreticalDiagMm = useMemo(() => Math.round(Math.hypot(wallAMm, wallBMm)), [wallAMm, wallBMm]);
  const squaringDiffMm = useMemo(() => Math.abs(measuredDiagMm - theoreticalDiagMm), [measuredDiagMm, theoreticalDiagMm]);

  // Squaring Status & Recommendations
  const squaringAudit = useMemo(() => {
    if (squaringDiffMm <= 5) {
      return {
        level: 'perfect',
        title: '✓ Perfect 90° Orthogonal Square (≤ 5mm)',
        detail: 'Masonry corners are strictly square within standard factory CNC tolerance. Standard modular casework can be installed with flush 30mm fillers.',
        tone: '#059669',
        bg: '#ecfdf5',
        border: '#a7f3d0',
      };
    }
    if (squaringDiffMm <= 15) {
      return {
        level: 'minor',
        title: 'ℹ Minor Site Undulation (6 - 15mm difference)',
        detail: `Measured diagonal varies by ${squaringDiffMm}mm from true 90° geometry (${theoreticalDiagMm}mm theoretical vs ${measuredDiagMm}mm measured). Standard 30mm scribing fillers will absorb this variation without altering internal cabinet boxes.`,
        tone: '#d97706',
        bg: '#fffbeb',
        border: '#fde68a',
      };
    }
    return {
      level: 'severe',
      title: '⚠️ Severe Out-of-Square Alert (> 15mm difference)',
      detail: `Out-of-square gap of ${squaringDiffMm}mm detected. Provide oversized 50mm dummy fillers on the ${wallAMm > wallBMm ? 'East/West' : 'North/South'} corners and execute tapered field scribing during on-site installation to prevent shutter binding.`,
      tone: '#dc2626',
      bg: '#fef2f2',
      border: '#fecaca',
    };
  }, [squaringDiffMm, theoreticalDiagMm, measuredDiagMm, wallAMm, wallBMm]);

  // Ceiling slope & false ceiling drop
  const cHeights = [
    Number(ceilingNW) || 2700,
    Number(ceilingNE) || 2700,
    Number(ceilingSE) || 2700,
    Number(ceilingSW) || 2700,
  ];
  const minCeiling = Math.min(...cHeights);
  const maxCeiling = Math.max(...cHeights);
  const ceilingDropDiff = maxCeiling - minCeiling;

  function swap() {
    const nextFrom = to;
    const nextTo = from;
    if (millimetres !== null) {
      const factor = units.find((u) => u.id === nextFrom)?.mm ?? 1;
      setValue(nextFrom === 'ft-in' ? feetInches(millimetres) : String(Math.round((millimetres / factor) * 1000) / 1000));
    }
    setFrom(nextFrom);
    setTo(nextTo);
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard?.writeText(result);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  // Send surveyed room measurements into Room Builder / Spaces Studio
  function handleSendToSpaces() {
    const roomDraft = {
      schema: 'ultida.room-builder.v1',
      updatedAt: new Date().toISOString(),
      name: roomName.trim() || 'Surveyed Room',
      roomType: roomName.toLowerCase().includes('kitchen') ? 'Kitchen' : roomName.toLowerCase().includes('living') ? 'Living room' : 'Master bedroom',
      widthMm: wallAMm,
      depthMm: wallBMm,
      ceilingHeightMm: minCeiling,
      floorFinish: 'Vitrified Italian Tile',
      ceilingIntent: ceilingDropDiff > 10 ? 'False ceiling with drop compensation' : 'Direct slab paint',
      camera: 'Wide corner from entry',
      openings: [],
      surveySquaringNotes: `Squaring check: ${squaringDiffMm}mm variation (${squaringAudit.level}). Min ceiling: ${minCeiling}mm, Max: ${maxCeiling}mm.`,
    };

    window.localStorage.setItem('ultida.room-builder.v1', JSON.stringify(roomDraft));
    window.localStorage.setItem('ultida.pendingRoomDraft.v1', JSON.stringify(roomDraft));
    setSurveyMessage('✨ Room survey saved! Redirecting to Room Builder with verified dimensions…');
    setTimeout(() => {
      navigate('/tools/room-builder');
    }, 800);
  }

  function downloadSurveyCsv() {
    const rows = [
      ['ULTIDA STUDIO SITE SURVEY & SQUARING REPORT'],
      ['Room Name', roomName],
      ['Date', new Date().toISOString().slice(0, 10)],
      [''],
      ['WALL MEASUREMENTS', 'Input', 'Canonical MM', 'Feet + Inches'],
      ['Wall A (North)', wallAInput, wallAMm, feetInches(wallAMm)],
      ['Wall B (East)', wallBInput, wallBMm, feetInches(wallBMm)],
      ['Wall C (South)', wallCInput, wallCMm, feetInches(wallCMm)],
      ['Wall D (West)', wallDInput, wallDMm, feetInches(wallDMm)],
      [''],
      ['PYTHAGOREAN 90° SQUARING CHECK'],
      ['Theoretical Diagonal (hypot)', `${theoreticalDiagMm} mm`, feetInches(theoreticalDiagMm)],
      ['Measured Site Diagonal', `${measuredDiagMm} mm`, feetInches(measuredDiagMm)],
      ['Out-of-Square Discrepancy', `${squaringDiffMm} mm`],
      ['Squaring Verdict', squaringAudit.title],
      ['Recommendation', squaringAudit.detail],
      [''],
      ['CEILING & SLAB HEIGHTS (MM)'],
      ['Corner NW', ceilingNW],
      ['Corner NE', ceilingNE],
      ['Corner SE', ceilingSE],
      ['Corner SW', ceilingSW],
      ['Slab Level Difference', `${ceilingDropDiff} mm`],
      ['Usable Millwork Max Height', `${minCeiling - 100} mm (allowing 100mm false ceiling / scribe)`],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.map((cell) => `"${cell}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Site_Survey_${roomName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const field: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d8cabb',
    borderRadius: 8,
    fontSize: 13,
    background: '#fff',
    boxSizing: 'border-box',
  };

  return (
    <main className="measurement-tool">
      {/* Hero */}
      <section className="measurement-hero">
        <div>
          <span>STUDIO FIELD SURVEY &amp; CONVERTER</span>
          <h1>Precision Site Measurements &amp; Squaring Engine</h1>
          <p>
            ULTIDA processes all interior millwork in exact millimetres. Input site survey dimensions in Metric or Imperial (<code>12'6"</code>), run automated Pythagorean 90° squaring cross-checks, and push directly to Spaces Studio.
          </p>
        </div>
        <div className="measurement-hero-mark">
          <Ruler size={34} />
          <strong>1 in = 25.4 mm</strong>
          <small>IS 710 &amp; System 32 Precision</small>
        </div>
      </section>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, margin: '22px 0 0', borderBottom: '1.5px solid var(--line)' }}>
        <button
          type="button"
          onClick={() => setActiveTab('survey')}
          style={{
            padding: '11px 20px',
            border: 0,
            borderBottom: activeTab === 'survey' ? '3px solid #c59c2d' : '3px solid transparent',
            background: 'transparent',
            fontWeight: activeTab === 'survey' ? 800 : 600,
            color: activeTab === 'survey' ? '#1c1917' : '#78716c',
            fontSize: 14,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Compass size={16} /> Room Site Survey &amp; Squaring Sheet
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('converter')}
          style={{
            padding: '11px 20px',
            border: 0,
            borderBottom: activeTab === 'converter' ? '3px solid #c59c2d' : '3px solid transparent',
            background: 'transparent',
            fontWeight: activeTab === 'converter' ? 800 : 600,
            color: activeTab === 'converter' ? '#1c1917' : '#78716c',
            fontSize: 14,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <ArrowLeftRight size={16} /> Instant Unit Converter
        </button>
      </div>

      {/* ══════ TAB 1: SITE SURVEY & SQUARING ══════ */}
      {activeTab === 'survey' && (
        <div style={{ marginTop: 22, display: 'grid', gap: 20 }}>
          {surveyMessage && (
            <div
              role="status"
              style={{
                padding: '12px 18px',
                borderRadius: 8,
                background: '#ecfdf5',
                border: '1px solid #6ee7b7',
                color: '#065f46',
                fontWeight: 700,
                fontSize: 13.5,
              }}
            >
              {surveyMessage}
            </div>
          )}

          {/* Top Room & Squaring Diagnostic Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {/* Left: 4 Walls & Diagonal Inputs */}
            <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 14, padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 16, margin: 0, color: '#1c1917' }}>📐 4-Wall Survey Dimensions</h3>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#a88220', background: '#faf5ea', padding: '3px 8px', borderRadius: 4 }}>
                  Accepts mm or ft-in (e.g. 13' 9")
                </span>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#44403c' }}>
                  Room Name / Tag
                  <input
                    style={{ ...field, marginTop: 4 }}
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="e.g. Master Bedroom Suite"
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#44403c' }}>
                    Wall A (North / Width)
                    <input
                      style={{ ...field, marginTop: 4 }}
                      value={wallAInput}
                      onChange={(e) => setWallAInput(e.target.value)}
                    />
                    <small style={{ marginTop: 2, color: '#78716c' }}>= {wallAMm} mm ({feetInches(wallAMm)})</small>
                  </label>

                  <label style={{ fontSize: 12, fontWeight: 700, color: '#44403c' }}>
                    Wall B (East / Depth)
                    <input
                      style={{ ...field, marginTop: 4 }}
                      value={wallBInput}
                      onChange={(e) => setWallBInput(e.target.value)}
                    />
                    <small style={{ marginTop: 2, color: '#78716c' }}>= {wallBMm} mm ({feetInches(wallBMm)})</small>
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#44403c' }}>
                    Wall C (South)
                    <input
                      style={{ ...field, marginTop: 4 }}
                      value={wallCInput}
                      onChange={(e) => setWallCInput(e.target.value)}
                    />
                    <small style={{ marginTop: 2, color: '#78716c' }}>= {wallCMm} mm ({feetInches(wallCMm)})</small>
                  </label>

                  <label style={{ fontSize: 12, fontWeight: 700, color: '#44403c' }}>
                    Wall D (West)
                    <input
                      style={{ ...field, marginTop: 4 }}
                      value={wallDInput}
                      onChange={(e) => setWallDInput(e.target.value)}
                    />
                    <small style={{ marginTop: 2, color: '#78716c' }}>= {wallDMm} mm ({feetInches(wallDMm)})</small>
                  </label>
                </div>

                <label style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginTop: 4 }}>
                  Measured Corner Diagonal (Corner A to C)
                  <input
                    style={{ ...field, marginTop: 4, borderColor: '#0284c7', background: '#f0f9ff' }}
                    value={diagonalInput}
                    onChange={(e) => setDiagonalInput(e.target.value)}
                  />
                  <small style={{ marginTop: 2, color: '#0369a1' }}>
                    Measured on site: {measuredDiagMm} mm ({feetInches(measuredDiagMm)})
                  </small>
                </label>
              </div>
            </div>

            {/* Right: Automated Squaring Check & Ceiling Undulation */}
            <div style={{ display: 'grid', gap: 16 }}>
              {/* Squaring Badge Card */}
              <div
                style={{
                  background: squaringAudit.bg,
                  border: `1.5px solid ${squaringAudit.border}`,
                  borderRadius: 14,
                  padding: 20,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <strong style={{ fontSize: 15, color: squaringAudit.tone }}>{squaringAudit.title}</strong>
                </div>

                <p style={{ margin: '0 0 14px', fontSize: 13, color: '#44403c', lineHeight: 1.5 }}>
                  {squaringAudit.detail}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, background: '#fff', padding: 12, borderRadius: 8, border: '1px solid var(--line)' }}>
                  <div>
                    <span style={{ fontSize: 10.5, color: '#78716c', textTransform: 'uppercase', fontWeight: 700 }}>Theoretical</span>
                    <strong style={{ display: 'block', fontSize: 14, color: '#1c1917', marginTop: 2 }}>{theoreticalDiagMm} mm</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 10.5, color: '#78716c', textTransform: 'uppercase', fontWeight: 700 }}>Measured</span>
                    <strong style={{ display: 'block', fontSize: 14, color: '#1c1917', marginTop: 2 }}>{measuredDiagMm} mm</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 10.5, color: '#78716c', textTransform: 'uppercase', fontWeight: 700 }}>Variance</span>
                    <strong style={{ display: 'block', fontSize: 14, color: squaringAudit.tone, marginTop: 2 }}>±{squaringDiffMm} mm</strong>
                  </div>
                </div>
              </div>

              {/* Ceiling 4-Corner Undulation Check */}
              <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
                <h4 style={{ fontSize: 14, margin: '0 0 10px', color: '#1c1917' }}>
                  🏛️ Ceiling / Slab Level Check (4 Corners)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#57534e' }}>
                    NW (mm)
                    <input style={{ ...field, padding: '6px 8px', fontSize: 12 }} value={ceilingNW} onChange={(e) => setCeilingNW(e.target.value)} />
                  </label>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#57534e' }}>
                    NE (mm)
                    <input style={{ ...field, padding: '6px 8px', fontSize: 12 }} value={ceilingNE} onChange={(e) => setCeilingNE(e.target.value)} />
                  </label>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#57534e' }}>
                    SE (mm)
                    <input style={{ ...field, padding: '6px 8px', fontSize: 12 }} value={ceilingSE} onChange={(e) => setCeilingSE(e.target.value)} />
                  </label>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#57534e' }}>
                    SW (mm)
                    <input style={{ ...field, padding: '6px 8px', fontSize: 12 }} value={ceilingSW} onChange={(e) => setCeilingSW(e.target.value)} />
                  </label>
                </div>
                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#78716c' }}>
                  <span>Min Clear Height: <strong>{minCeiling} mm</strong></span>
                  <span>Max Undulation: <strong style={{ color: ceilingDropDiff > 15 ? '#dc2626' : '#059669' }}>{ceilingDropDiff} mm</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Dock */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#faf8f5', padding: '16px 20px', borderRadius: 12, border: '1px solid #ebdccb', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <strong style={{ fontSize: 14, color: '#1c1917', display: 'block' }}>
                Handoff Survey to Project Spaces
              </strong>
              <span style={{ fontSize: 12, color: '#78716c' }}>
                Carries measured shell dimensions, squaring notes, and ceiling heights into the room design workflow.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={downloadSurveyCsv}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 15px',
                  borderRadius: 8,
                  border: '1px solid #d8cabb',
                  background: '#fff',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Download size={14} /> Download Survey CSV
              </button>
              <button
                type="button"
                onClick={handleSendToSpaces}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 18px',
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
                Send to Room Builder &amp; Spaces <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ TAB 2: INSTANT UNIT CONVERTER ══════ */}
      {activeTab === 'converter' && (
        <div style={{ marginTop: 22 }}>
          <section className="measurement-workspace" aria-label="Measurement converter">
            <label>
              Value
              <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={from === 'ft-in' ? `e.g. 12' 6\"` : 'Enter a number'}
                inputMode="decimal"
              />
            </label>
            <label>
              From
              <select value={from} onChange={(event) => setFrom(event.target.value as Unit)}>
                {units.map((unit) => (
                  <option value={unit.id} key={unit.id}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="measurement-swap" type="button" onClick={swap} aria-label="Swap source and target units">
              <ArrowLeftRight size={18} />
            </button>
            <label>
              To
              <select value={to} onChange={(event) => setTo(event.target.value as Unit)}>
                {units.map((unit) => (
                  <option value={unit.id} key={unit.id}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </label>
            <div className={`measurement-result ${result ? '' : 'invalid'}`}>
              <span>Converted result</span>
              <strong>{result ?? 'Enter a valid measurement'}</strong>
              {millimetres !== null && (
                <small>Canonical project value: {Math.round(millimetres * 1000) / 1000} mm</small>
              )}
              <button type="button" onClick={() => void copyResult()} disabled={!result}>
                <Copy size={14} />
                {copied ? 'Copied' : 'Copy result'}
              </button>
            </div>
          </section>

          {/* Architectural Standards Benchmark Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 18 }}>
            {[
              { label: 'Standard Module Carcass Width', metric: '600 mm', imperial: `1' 11.6\"` },
              { label: 'Standard Plywood / HDHMR Sheet', metric: '2440 × 1220 mm', imperial: `8' 0\" × 4' 0\"` },
              { label: 'Standard Kitchen Countertop Height', metric: '850 mm', imperial: `2' 9.5\"` },
              { label: 'Standard Lintel & Door Height', metric: '2100 mm', imperial: `6' 10.7\"` },
              { label: 'Standard Residential Ceiling Height', metric: '2700 mm', imperial: `8' 10.3\"` },
            ].map((card, i) => (
              <div
                key={i}
                onClick={() => {
                  setValue(card.metric.replace(/[^0-9]/g, ''));
                  setFrom('mm');
                  setTo('ft-in');
                }}
                style={{
                  background: '#fff',
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  padding: 14,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: 11, color: '#78716c', fontWeight: 700 }}>{card.label}</span>
                <strong style={{ display: 'block', fontSize: 16, color: '#1c1917', margin: '4px 0 2px' }}>{card.metric}</strong>
                <small style={{ color: '#a88220', fontSize: 11, fontWeight: 700 }}>= {card.imperial}</small>
              </div>
            ))}
          </div>

          <section className="measurement-guide">
            <div>
              <strong>Feet + inches input</strong>
              <p>
                Enter <code>12' 6"</code>, <code>12 ft 6 in</code>, or a decimal foot value. Inch values must stay below 12.
              </p>
            </div>
            <div>
              <strong>Plan-analysis alignment</strong>
              <p>Legible imperial OCR evidence is normalized to millimetres and retains its original text for review.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setValue('4200');
                setFrom('mm');
                setTo('ft-in');
              }}
            >
              <RotateCcw size={15} /> Reset example
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
