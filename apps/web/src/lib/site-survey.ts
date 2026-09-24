/**
 * site-survey.ts — Pure measurement and Pythagorean squaring mathematical helpers.
 */

export type Unit = 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'ft-in';

export const UNITS: Array<{ id: Unit; label: string; short: string; mm: number }> = [
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

  // Pattern 2: Explicit metric and imperial units
  if (/^\d+(?:\.\d+)?\s*mm$/.test(str)) {
    return Math.round(Number(str.replace(/[^\d.]/g, '')));
  }
  if (/^\d+(?:\.\d+)?\s*cm$/.test(str)) {
    return Math.round(Number(str.replace(/[^\d.]/g, '')) * 10);
  }
  if (/^\d+(?:\.\d+)?\s*m$/.test(str)) {
    return Math.round(Number(str.replace(/[^\d.]/g, '')) * 1000);
  }
  if (/^\d+(?:\.\d+)?\s*(?:in|")$/.test(str)) {
    return Math.round(Number(str.replace(/[^\d.]/g, '')) * 25.4);
  }
  if (/^\d+(?:\.\d+)?\s*(?:ft|')$/.test(str)) {
    return Math.round(Number(str.replace(/[^\d.]/g, '')) * 304.8);
  }

  // Pattern 3: Pure unadorned number (default mm if > 20, meters if <= 20)
  const num = Number(str.replace(/[^0-9.]/g, ''));
  if (Number.isFinite(num) && num > 0) {
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
  const factor = UNITS.find((item) => item.id === unit)?.mm;
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
  const factor = UNITS.find((item) => item.id === unit)?.mm ?? 1;
  const value = Math.round((mm / factor) * 1000) / 1000;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${UNITS.find((item) => item.id === unit)?.short}`;
}

export function verifyPythagoreanSquaring(wallAMm: number, wallBMm: number, measuredDiagonalMm: number): {
  theoreticalDiagonalMm: number;
  squaringDiffMm: number;
  level: 'perfect' | 'minor' | 'severe';
  title: string;
  detail: string;
} {
  const theoreticalDiagonalMm = Math.round(Math.hypot(wallAMm, wallBMm));
  const squaringDiffMm = Math.abs(measuredDiagonalMm - theoreticalDiagonalMm);

  if (squaringDiffMm <= 5) {
    return {
      theoreticalDiagonalMm,
      squaringDiffMm,
      level: 'perfect',
      title: '✓ Perfect 90° Orthogonal Square (≤ 5mm)',
      detail: 'Masonry corners are strictly square within standard factory CNC tolerance. Standard modular casework can be installed with flush 30mm fillers.',
    };
  }
  if (squaringDiffMm <= 15) {
    return {
      theoreticalDiagonalMm,
      squaringDiffMm,
      level: 'minor',
      title: 'ℹ Minor Site Undulation (6 - 15mm difference)',
      detail: `Measured diagonal varies by ${squaringDiffMm}mm from true 90° geometry (${theoreticalDiagonalMm}mm theoretical vs ${measuredDiagonalMm}mm measured). Standard 30mm scribing fillers will absorb this variation without altering internal cabinet boxes.`,
    };
  }
  return {
    theoreticalDiagonalMm,
    squaringDiffMm,
    level: 'severe',
    title: '⚠️ Severe Out-of-Square Alert (> 15mm difference)',
    detail: `Out-of-square gap of ${squaringDiffMm}mm detected. Provide oversized 50mm dummy fillers and execute tapered field scribing during on-site installation to prevent shutter binding.`,
  };
}
