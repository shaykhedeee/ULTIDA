/** Conservative draft quote calculator. Exact manufacturing part IDs only. Never approves or stores a quote. */
export type QuoteLineInput = { partInstanceId: string; unitRateInr: number };
export type KitchenQuoteRequest = {
  projectId: string; roomId: string; sceneVersionId: string;
  lines: QuoteLineInput[]; labourInr: number; marginRate: number; gstRate: number;
};
export type KitchenQuoteResult = {
  schema: 'ultida.kitchen-quote-preview.v1'; status: 'draft_unapproved';
  source: { projectId: string; roomId: string; sceneVersionId: string; partInstanceIds: string[] };
  totals: { materialInr: number; labourInr: number; marginInr: number; gstInr: number; grandTotalInr: number };
  exclusions: string[];
};
export class KitchenQuoteError extends Error { code: string; constructor(code: string, message: string) { super(message); this.code = code; this.name = 'KitchenQuoteError'; } }
const rupees = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100000000;
const rate = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
export function previewKitchenQuote(input: KitchenQuoteRequest, actualParts: Array<{partInstanceId?: string}>): KitchenQuoteResult {
  if (!input.projectId || !input.roomId || !input.sceneVersionId ||
      !rupees(input.labourInr) || !rate(input.marginRate) || !rate(input.gstRate) ||
      !Array.isArray(input.lines) || !input.lines.length || input.lines.length > 2000) {
    throw new KitchenQuoteError('INVALID_QUOTE_INPUT', 'Provide a scene, explicit labour, margin and GST, and valid priced parts.');
  }
  const ids=actualParts.map(p=>p.partInstanceId);
  if (!ids.length || ids.some(id=>!id)) throw new KitchenQuoteError('UNVERIFIED_CUTLIST', 'An exact cutlist with stable part IDs is required.');
  const actual=new Set(ids as string[]);
  if (actual.size!==ids.length) throw new KitchenQuoteError('DUPLICATE_PRODUCTION_PART', 'Manufacturing parts contain duplicate identities.');
  const priced=new Set<string>();
  for (const line of input.lines) {
    if (!line || typeof line.partInstanceId !== 'string' || !actual.has(line.partInstanceId) || !rupees(line.unitRateInr)) {
      throw new KitchenQuoteError('UNKNOWN_OR_INVALID_PRICE_LINE', 'A quote line lacks a valid exact scene part identity or nonnegative rate.');
    }
    if (priced.has(line.partInstanceId)) throw new KitchenQuoteError('DUPLICATE_QUOTE_LINE', 'Only one priced entry per exact part ID is allowed.');
    priced.add(line.partInstanceId);
  }
  if (priced.size!==actual.size) throw new KitchenQuoteError('UNPRICED_PARTS', `All ${actual.size} scene parts must have explicit current rates; ${actual.size-priced.size} missing.`);
  const material=round2(input.lines.reduce((sum, l)=>sum+l.unitRateInr,0));
  const taxableBase=round2(material + input.labourInr);
  const margin=round2(taxableBase * input.marginRate);
  const gst=round2((taxableBase+margin) * input.gstRate);
  return {
    schema:'ultida.kitchen-quote-preview.v1', status:'draft_unapproved',
    source:{projectId:input.projectId,roomId:input.roomId,sceneVersionId:input.sceneVersionId,partInstanceIds:[...actual].sort()},
    totals:{materialInr:material,labourInr:round2(input.labourInr),marginInr:margin,gstInr:gst,grandTotalInr:round2(taxableBase+margin+gst)},
    exclusions:['Hardware and fixtures require separate verified supplier quotations.',
      'Transport, installation, wastage, electrical and service work must be independently priced.',
      'This preview is not a persisted or approved customer quotation.']
  };
}
