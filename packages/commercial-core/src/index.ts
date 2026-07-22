export type QuoteLine = { id: string; description: string; category: string; quantity: number; unit: string; unitRateInr: number; labourInr?: number; optional?: boolean };
export type QuoteTotals = { subtotalInr: number; discountInr: number; marginInr: number; taxableInr: number; gstInr: number; grandTotalInr: number };

const money = (value: number) => Math.round(value * 100) / 100;
export function calculateQuote(lines: QuoteLine[], options: { discountInr?: number; marginRate?: number; gstRate?: number }): QuoteTotals {
  const subtotalInr = money(lines.filter((line) => !line.optional).reduce((sum, line) => sum + line.quantity * line.unitRateInr + (line.labourInr ?? 0), 0));
  const discountInr = money(Math.max(0, options.discountInr ?? 0));
  const discounted = Math.max(0, subtotalInr - discountInr);
  const marginInr = money(discounted * Math.max(0, options.marginRate ?? 0));
  const taxableInr = money(discounted + marginInr);
  const gstInr = money(taxableInr * Math.max(0, options.gstRate ?? 0));
  return { subtotalInr, discountInr, marginInr, taxableInr, gstInr, grandTotalInr: money(taxableInr + gstInr) };
}
