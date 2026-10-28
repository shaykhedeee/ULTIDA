export * from './indian-boq-engine.js';

export type QuoteLine = {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  unitRateInr: number;
  labourInr?: number;
  optional?: boolean;
};

export type QuoteTotals = {
  subtotalInr: number;
  discountInr: number;
  marginInr: number;
  taxableInr: number;
  gstInr: number;
  grandTotalInr: number;
};

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

export type TradeCategory =
  | 'modular_joinery'
  | 'civil_and_masonry'
  | 'false_ceiling'
  | 'electrical_and_lighting'
  | 'finishes_and_paint'
  | 'soft_furnishings'
  | 'appliances_and_fixtures'
  | 'hardware_and_fittings'
  | 'miscellaneous';

export type StudioBudgetLine = {
  id: string;
  roomId: string;
  roomName: string;
  tradeCategory: TradeCategory | string;
  description: string;
  quantity: number;
  unit: 'sqft' | 'rft' | 'nos' | 'set' | 'lumpsum' | string;
  vendorCostUnitInr: number;
  markupPercent: number; // e.g. 20 for 20% studio margin
  labourUnitInr?: number;
  optional?: boolean;
  notes?: string;
};

export type RoomBudgetSummary = {
  roomId: string;
  roomName: string;
  itemCount: number;
  vendorCostInr: number;
  marginInr: number;
  clientSubtotalInr: number;
};

export type TradeBudgetSummary = {
  tradeCategory: string;
  itemCount: number;
  vendorCostInr: number;
  marginInr: number;
  clientSubtotalInr: number;
};

export type StudioPaymentMilestone = {
  id: string;
  title: string;
  percentage: number;
  amountInr: number;
  description: string;
  status: 'pending' | 'due' | 'invoiced' | 'paid';
};

export type StudioChangeOrder = {
  id: string;
  orderNumber: string;
  title: string;
  reason: string;
  deltaCostInr: number;
  deltaClientPriceInr: number;
  status: 'draft' | 'submitted' | 'client_approved' | 'rejected';
  createdAt: string;
};

export type StudioBudgetOptions = {
  discountInr?: number;
  gstRate?: number; // default 0.18 (18% GST)
  milestoneTemplate?: Array<{ id: string; title: string; percentage: number; description: string }>;
};

export type StudioBudgetReport = {
  activeLineCount: number;
  vendorCostTotalInr: number;
  grossMarginInr: number;
  grossMarginPercentage: number;
  clientSubtotalInr: number;
  discountInr: number;
  taxableInr: number;
  gstRate: number;
  gstInr: number;
  clientGrandTotalInr: number;
  roomSummaries: RoomBudgetSummary[];
  tradeSummaries: TradeBudgetSummary[];
  milestones: StudioPaymentMilestone[];
};

export const DEFAULT_STUDIO_MILESTONES: Array<{ id: string; title: string; percentage: number; description: string }> = [
  { id: 'm1_booking', title: 'Design Freeze & Booking', percentage: 10, description: '10% upon final 2D drawing sign-off and 3D visual approval' },
  { id: 'm2_production', title: 'Procurement & Factory Production', percentage: 40, description: '40% upon panel cutting and modular carcass fabrication commencement' },
  { id: 'm3_installation', title: 'Site Delivery & Assembly', percentage: 40, description: '40% upon modular joinery delivery, carcass erection and shutter fitment' },
  { id: 'm4_handover', title: 'Snag Resolution & Final Handover', percentage: 10, description: '10% upon final snag rectification and keys handover' }
];

export function calculateStudioBudget(lines: StudioBudgetLine[], options: StudioBudgetOptions = {}): StudioBudgetReport {
  const activeLines = lines.filter((line) => !line.optional);
  const gstRate = Math.max(0, options.gstRate ?? 0.18);
  const discountInr = money(Math.max(0, options.discountInr ?? 0));

  let vendorCostTotalInr = 0;
  let clientSubtotalInr = 0;

  const roomMap = new Map<string, { roomName: string; vendorCost: number; clientSubtotal: number; count: number }>();
  const tradeMap = new Map<string, { vendorCost: number; clientSubtotal: number; count: number }>();

  for (const line of activeLines) {
    const qty = Math.max(0, line.quantity);
    const lineCost = (qty * Math.max(0, line.vendorCostUnitInr)) + (qty * Math.max(0, line.labourUnitInr ?? 0));
    const markupMultiplier = 1 + (Math.max(0, line.markupPercent) / 100);
    const lineClient = lineCost * markupMultiplier;

    vendorCostTotalInr += lineCost;
    clientSubtotalInr += lineClient;

    // Room accumulation
    const room = roomMap.get(line.roomId) ?? { roomName: line.roomName, vendorCost: 0, clientSubtotal: 0, count: 0 };
    room.vendorCost += lineCost;
    room.clientSubtotal += lineClient;
    room.count += 1;
    roomMap.set(line.roomId, room);

    // Trade accumulation
    const trade = tradeMap.get(line.tradeCategory) ?? { vendorCost: 0, clientSubtotal: 0, count: 0 };
    trade.vendorCost += lineCost;
    trade.clientSubtotal += lineClient;
    trade.count += 1;
    tradeMap.set(line.tradeCategory, trade);
  }

  vendorCostTotalInr = money(vendorCostTotalInr);
  clientSubtotalInr = money(clientSubtotalInr);
  const grossMarginInr = money(Math.max(0, clientSubtotalInr - vendorCostTotalInr));
  const grossMarginPercentage = clientSubtotalInr > 0 ? money((grossMarginInr / clientSubtotalInr) * 100) : 0;

  const taxableInr = money(Math.max(0, clientSubtotalInr - discountInr));
  const gstInr = money(taxableInr * gstRate);
  const clientGrandTotalInr = money(taxableInr + gstInr);

  const roomSummaries: RoomBudgetSummary[] = Array.from(roomMap.entries()).map(([roomId, data]) => ({
    roomId,
    roomName: data.roomName,
    itemCount: data.count,
    vendorCostInr: money(data.vendorCost),
    marginInr: money(Math.max(0, data.clientSubtotal - data.vendorCost)),
    clientSubtotalInr: money(data.clientSubtotal),
  }));

  const tradeSummaries: TradeBudgetSummary[] = Array.from(tradeMap.entries()).map(([tradeCategory, data]) => ({
    tradeCategory,
    itemCount: data.count,
    vendorCostInr: money(data.vendorCost),
    marginInr: money(Math.max(0, data.clientSubtotal - data.vendorCost)),
    clientSubtotalInr: money(data.clientSubtotal),
  }));

  const milestoneTemplates = options.milestoneTemplate ?? DEFAULT_STUDIO_MILESTONES;
  const milestones: StudioPaymentMilestone[] = milestoneTemplates.map((template) => ({
    id: template.id,
    title: template.title,
    percentage: template.percentage,
    amountInr: money(clientGrandTotalInr * (template.percentage / 100)),
    description: template.description,
    status: 'pending',
  }));

  return {
    activeLineCount: activeLines.length,
    vendorCostTotalInr,
    grossMarginInr,
    grossMarginPercentage,
    clientSubtotalInr,
    discountInr,
    taxableInr,
    gstRate,
    gstInr,
    clientGrandTotalInr,
    roomSummaries,
    tradeSummaries,
    milestones,
  };
}
