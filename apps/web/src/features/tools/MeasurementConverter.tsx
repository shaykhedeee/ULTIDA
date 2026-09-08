import { ArrowLeftRight, Copy, Ruler, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
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

function parseFeetInches(value: string): number | null {
  const match = value.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(?:'|ft)?\s*(?:[-\s]*(\d+(?:\.\d+)?))?\s*(?:\"|in)?$/);
  if (!match) return null;
  const feet = Number(match[1]);
  const inches = Number(match[2] ?? 0);
  if (!Number.isFinite(feet) || !Number.isFinite(inches) || inches >= 12) return null;
  return feet * 304.8 + inches * 25.4;
}

function toMm(value: string, unit: Unit): number | null {
  if (unit === 'ft-in') return parseFeetInches(value);
  const numeric = Number(value);
  const factor = units.find((item) => item.id === unit)?.mm;
  return Number.isFinite(numeric) && numeric >= 0 && factor ? numeric * factor : null;
}

function feetInches(mm: number) {
  const totalInches = mm / 25.4;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round((totalInches - feet * 12) * 100) / 100;
  return `${feet}' ${inches.toFixed(inches % 1 ? 2 : 0)}\"`;
}

function display(mm: number, unit: Unit) {
  if (unit === 'ft-in') return feetInches(mm);
  const factor = units.find((item) => item.id === unit)?.mm ?? 1;
  const value = Math.round((mm / factor) * 1000) / 1000;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${units.find((item) => item.id === unit)?.short}`;
}

/** Exact studio utility: all conversions flow through millimetres, ULTIDA's canonical unit. */
export function MeasurementConverter() {
  const [value, setValue] = useState('4200');
  const [from, setFrom] = useState<Unit>('mm');
  const [to, setTo] = useState<Unit>('ft-in');
  const [copied, setCopied] = useState(false);
  const millimetres = useMemo(() => toMm(value, from), [value, from]);
  const result = millimetres === null ? null : display(millimetres, to);

  function swap() {
    const nextFrom = to;
    const nextTo = from;
    if (millimetres !== null) {
      const factor = units.find((unit) => unit.id === nextFrom)?.mm ?? 1;
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

  return <main className="measurement-tool">
    <section className="measurement-hero">
      <div><span>MEASUREMENT CONVERTER</span><h1>Convert measurements exactly.</h1><p>ULTIDA stores geometry in millimetres. Use this tool to convert project notes, visible plan dimensions and module sizes without rounding a source measurement into a guess.</p></div>
      <div className="measurement-hero-mark"><Ruler size={34} /><strong>1 in = 25.4 mm</strong><small>Exact standard conversion</small></div>
    </section>

    <section className="measurement-workspace" aria-label="Measurement converter">
      <label>Value<input value={value} onChange={(event) => setValue(event.target.value)} placeholder={from === 'ft-in' ? `e.g. 12' 6\"` : 'Enter a number'} inputMode="decimal" /></label>
      <label>From<select value={from} onChange={(event) => setFrom(event.target.value as Unit)}>{units.map((unit) => <option value={unit.id} key={unit.id}>{unit.label}</option>)}</select></label>
      <button className="measurement-swap" type="button" onClick={swap} aria-label="Swap source and target units"><ArrowLeftRight size={18} /></button>
      <label>To<select value={to} onChange={(event) => setTo(event.target.value as Unit)}>{units.map((unit) => <option value={unit.id} key={unit.id}>{unit.label}</option>)}</select></label>
      <div className={`measurement-result ${result ? '' : 'invalid'}`}><span>Converted result</span><strong>{result ?? 'Enter a valid measurement'}</strong>{millimetres !== null && <small>Canonical project value: {Math.round(millimetres * 1000) / 1000} mm</small>}<button type="button" onClick={() => void copyResult()} disabled={!result}><Copy size={14} />{copied ? 'Copied' : 'Copy result'}</button></div>
    </section>

    <section className="measurement-guide"><div><strong>Feet + inches input</strong><p>Enter <code>12' 6\"</code>, <code>12 ft 6 in</code>, or a decimal foot value. Inch values must stay below 12.</p></div><div><strong>Plan-analysis alignment</strong><p>Legible imperial OCR evidence is normalized to millimetres and retains its original text for review.</p></div><button type="button" onClick={() => { setValue('4200'); setFrom('mm'); setTo('ft-in'); }}><RotateCcw size={15} /> Reset example</button></section>
  </main>;
}
