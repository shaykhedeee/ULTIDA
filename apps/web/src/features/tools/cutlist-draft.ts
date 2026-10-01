import type { NestingPart } from './cutlist-optimizer';
import type { MeasuredUnit } from './measured-unit-cutlist';
export type CutlistDraft = { version: 1; parts: NestingPart[]; units: MeasuredUnit[]; title: string; settings?: { kerfMm: number; trimMm: number; sheetSizePreset: '8x4' | '8x6' | '7x3' } };
export function readCutlistDraft(text: string): CutlistDraft {
  if (text.length > 4_000_000) throw new Error('Saved cutlist draft is too large to restore safely.');
  const value = JSON.parse(text);
  if (value?.version !== 1 || !Array.isArray(value.parts) || !Array.isArray(value.units) || typeof value.title !== 'string') throw new Error('Saved cutlist draft has an unsupported format.');
  if (value.parts.some((part: any) => !part || typeof part.id !== 'string' || typeof part.partInstanceId !== 'string' || ![part.lengthMm, part.widthMm, part.thicknessMm].every(size => Number.isFinite(size) && size > 0) || !Number.isInteger(part.quantity) || part.quantity <= 0 || typeof part.materialCode !== 'string' || !part.edgeBanding || !['l1', 'l2', 'w1', 'w2'].every(edge => typeof part.edgeBanding[edge] === 'string'))) throw new Error('Saved draft contains invalid panels. It was not restored.');
  if (value.units.some((unit: any) => typeof unit?.id !== 'string' || typeof unit?.name !== 'string' || ![unit.widthMm, unit.heightMm, unit.depthMm].every(size => Number.isFinite(size) && size > 0))) throw new Error('Saved draft contains invalid units.');
  if (value.settings && (![value.settings.kerfMm, value.settings.trimMm].every(size => Number.isFinite(size) && size >= 0) || !['8x4', '8x6', '7x3'].includes(value.settings.sheetSizePreset))) throw new Error('Saved draft has invalid nesting settings.');
  return value;
}
