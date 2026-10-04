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

// ─── Multi-Vendor Procurement Purchase Order (PO) Engine ─────────────────────

export interface VendorPurchaseOrderItem {
  itemCode: string;
  description: string;
  specification: string;
  quantity: number;
  unit: 'sheets' | 'meters' | 'pcs' | 'sets' | 'rolls';
  estimatedRateInr: number;
  estimatedTotalInr: number;
  notes?: string;
}

export interface VendorPurchaseOrder {
  poNumber: string;
  vendorCategory: 'board_supplier' | 'laminate_distributor' | 'edgeband_vendor' | 'hardware_distributor';
  vendorName: string;
  categoryLabel: string;
  generatedDate: string;
  currency: string;
  items: VendorPurchaseOrderItem[];
  totalQuantity: number;
  estimatedGrandTotalInr: number;
}

export interface ProcurementOrderBundle {
  projectId: string;
  projectName?: string;
  generatedAt: string;
  purchaseOrders: VendorPurchaseOrder[];
  summary: {
    totalBoardSheets: number;
    totalLaminateSheets: number;
    totalEdgeBandMeters: number;
    totalHardwareUnits: number;
    estimatedTotalInr: number;
  };
}

export interface PartForProcurement {
  id: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  materialCode: string;
  quantity: number;
  externalLaminate?: string;
  internalLiner?: string;
  edgeSchedule?: {
    l1Mm?: number;
    l2Mm?: number;
    w1Mm?: number;
    w2Mm?: number;
    thicknessMm?: number;
  };
  edging?: string;
  partName?: string;
}

export interface HardwareItemForProcurement {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  estimatedRateInr?: number;
  notes?: string;
}

export function generateVendorPurchaseOrders(params: {
  projectId: string;
  projectName?: string;
  parts: PartForProcurement[];
  hardwareSchedule?: HardwareItemForProcurement[];
  sheetWidthMm?: number;
  sheetHeightMm?: number;
}): ProcurementOrderBundle {
  const sw = params.sheetWidthMm ?? 2440;
  const sh = params.sheetHeightMm ?? 1220;
  const usableSheetAreaMm2 = (sw - 20) * (sh - 20); // 10mm trim around perimeter
  const dateStr = new Date().toISOString().slice(0, 10);
  const projTag = (params.projectName ?? params.projectId).slice(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');

  // 1. Board Supplier PO
  // Group parts by materialCode + thicknessMm
  const boardGroups = new Map<string, { materialCode: string; thicknessMm: number; totalAreaMm2: number; count: number }>();
  for (const part of params.parts) {
    const key = `${part.materialCode}__${part.thicknessMm}`;
    const partArea = part.lengthMm * part.widthMm * (part.quantity || 1);
    const existing = boardGroups.get(key);
    if (existing) {
      existing.totalAreaMm2 += partArea;
      existing.count += (part.quantity || 1);
    } else {
      boardGroups.set(key, {
        materialCode: part.materialCode,
        thicknessMm: part.thicknessMm,
        totalAreaMm2: partArea,
        count: part.quantity || 1,
      });
    }
  }

  const boardItems: VendorPurchaseOrderItem[] = [];
  let totalBoardSheets = 0;
  let boardIdx = 1;

  for (const group of boardGroups.values()) {
    // Add 12% cutting & kerf allowance
    const grossArea = group.totalAreaMm2 * 1.12;
    const sheetsNeeded = Math.max(1, Math.ceil(grossArea / usableSheetAreaMm2));
    totalBoardSheets += sheetsNeeded;

    let rate = 2200; // default 18mm sheet rate INR
    if (group.thicknessMm <= 6) rate = 950;
    else if (group.thicknessMm <= 9) rate = 1350;
    else if (group.thicknessMm <= 12) rate = 1700;
    else if (group.thicknessMm >= 25) rate = 3200;
    if (group.materialCode.toLowerCase().includes('hdhmr')) rate = Math.round(rate * 1.25);
    if (group.materialCode.toLowerCase().includes('birch')) rate = Math.round(rate * 1.8);

    boardItems.push({
      itemCode: `BRD-${String(boardIdx++).padStart(3, '0')}`,
      description: `${group.thicknessMm}mm ${group.materialCode.toUpperCase()} Substrate Core`,
      specification: `Standard 8×4ft (${sw}×${sh}mm), Calibrated, Boiling Water Proof (IS:710 / HDHMR Grade)`,
      quantity: sheetsNeeded,
      unit: 'sheets',
      estimatedRateInr: rate,
      estimatedTotalInr: sheetsNeeded * rate,
      notes: `Covers ${group.count} workshop parts (~${(group.totalAreaMm2 / 1e6).toFixed(1)} sq.m finished)`,
    });
  }

  const boardPO: VendorPurchaseOrder = {
    poNumber: `PO-${projTag}-BRD-${dateStr.replace(/-/g, '')}`,
    vendorCategory: 'board_supplier',
    vendorName: 'Primary Board & Plywood Vendor',
    categoryLabel: 'Board & Substrate Core Suppliers',
    generatedDate: dateStr,
    currency: 'INR',
    items: boardItems,
    totalQuantity: totalBoardSheets,
    estimatedGrandTotalInr: boardItems.reduce((acc, it) => acc + it.estimatedTotalInr, 0),
  };

  // 2. Laminate Distributor PO
  // Group external laminates & internal liner requirements
  const laminateGroups = new Map<string, { code: string; type: 'external' | 'liner'; totalAreaMm2: number }>();
  for (const part of params.parts) {
    const area = part.lengthMm * part.widthMm * (part.quantity || 1);
    const extCode = part.externalLaminate || 'STANDARD_DECORATIVE_1MM';
    const linerCode = part.internalLiner || 'INTERNAL_BALANCING_LINER_0.8MM';

    const ext = laminateGroups.get(extCode);
    if (ext) ext.totalAreaMm2 += area;
    else laminateGroups.set(extCode, { code: extCode, type: 'external', totalAreaMm2: area });

    const liner = laminateGroups.get(linerCode);
    if (liner) liner.totalAreaMm2 += area;
    else laminateGroups.set(linerCode, { code: linerCode, type: 'liner', totalAreaMm2: area });
  }

  const laminateItems: VendorPurchaseOrderItem[] = [];
  let totalLaminateSheets = 0;
  let lamIdx = 1;

  for (const lam of laminateGroups.values()) {
    // 15% trimming allowance for laminate sheets
    const sheets = Math.max(1, Math.ceil((lam.totalAreaMm2 * 1.15) / usableSheetAreaMm2));
    totalLaminateSheets += sheets;
    const isLiner = lam.type === 'liner';
    const rate = isLiner ? 850 : 2100;

    laminateItems.push({
      itemCode: `LAM-${String(lamIdx++).padStart(3, '0')}`,
      description: isLiner ? `0.8mm Internal Off-White Balancing Liner Sheet` : `1.0mm Decorative Suede/Matt Laminate [${lam.code}]`,
      specification: `8×4ft (${sw}×${sh}mm), High Pressure Laminate (IS:2046 Grade HGS)`,
      quantity: sheets,
      unit: 'sheets',
      estimatedRateInr: rate,
      estimatedTotalInr: sheets * rate,
      notes: isLiner ? 'Carcass interior balancing surface' : 'External front shutters and exposed side gables',
    });
  }

  const laminatePO: VendorPurchaseOrder = {
    poNumber: `PO-${projTag}-LAM-${dateStr.replace(/-/g, '')}`,
    vendorCategory: 'laminate_distributor',
    vendorName: 'Decorative Surface & Laminate Distributor',
    categoryLabel: 'Decorative Laminates & Surface Liners',
    generatedDate: dateStr,
    currency: 'INR',
    items: laminateItems,
    totalQuantity: totalLaminateSheets,
    estimatedGrandTotalInr: laminateItems.reduce((acc, it) => acc + it.estimatedTotalInr, 0),
  };

  // 3. Edge Banding Vendor PO
  let thickEdgeMeters = 0; // 2mm for external shutters/drawers
  let thinEdgeMeters = 0;  // 0.8mm for internal carcass shelves/gables

  for (const part of params.parts) {
    const count = part.quantity || 1;
    let perimeterMm = 0;
    if (part.edgeSchedule) {
      perimeterMm = (part.edgeSchedule.l1Mm || 0) + (part.edgeSchedule.l2Mm || 0) + (part.edgeSchedule.w1Mm || 0) + (part.edgeSchedule.w2Mm || 0);
    } else if (part.edging === 'all_sides') {
      perimeterMm = (part.lengthMm + part.widthMm) * 2;
    } else if (part.edging === 'front_only') {
      perimeterMm = part.lengthMm;
    } else if (part.edging && part.edging !== 'none') {
      perimeterMm = (part.lengthMm + part.widthMm) * 2;
    }

    const runMeters = (perimeterMm * count) / 1000;
    const isShutterOrExternal = (part.partName ?? '').toLowerCase().includes('shutter') || (part.partName ?? '').toLowerCase().includes('door') || (part.partName ?? '').toLowerCase().includes('drawer');
    if (isShutterOrExternal) {
      thickEdgeMeters += runMeters;
    } else {
      thinEdgeMeters += runMeters;
    }
  }

  // 10% wastage buffer
  thickEdgeMeters = Math.ceil(thickEdgeMeters * 1.1);
  thinEdgeMeters = Math.ceil(thinEdgeMeters * 1.1);
  const totalEdgeMeters = thickEdgeMeters + thinEdgeMeters;

  const edgeItems: VendorPurchaseOrderItem[] = [
    {
      itemCode: 'EDG-001',
      description: '2.0mm Thick PVC Edge Banding Tape (Shutters & Drawer Fronts)',
      specification: '22mm width × 2.0mm thickness, Color-matched to decorative laminate, primer coated back',
      quantity: Math.max(50, Math.ceil(thickEdgeMeters / 50) * 50),
      unit: 'meters',
      estimatedRateInr: 28,
      estimatedTotalInr: Math.max(50, Math.ceil(thickEdgeMeters / 50) * 50) * 28,
      notes: `${Math.round(thickEdgeMeters)}m net required. Rounded to nearest 50m workshop roll.`,
    },
    {
      itemCode: 'EDG-002',
      description: '0.8mm Thick PVC Edge Banding Tape (Internal Carcass & Shelves)',
      specification: '22mm width × 0.8mm thickness, Neutral off-white / grey liner match, hot-melt compatible',
      quantity: Math.max(50, Math.ceil(thinEdgeMeters / 50) * 50),
      unit: 'meters',
      estimatedRateInr: 12,
      estimatedTotalInr: Math.max(50, Math.ceil(thinEdgeMeters / 50) * 50) * 12,
      notes: `${Math.round(thinEdgeMeters)}m net required. Rounded to nearest 50m workshop roll.`,
    },
  ];

  const edgePO: VendorPurchaseOrder = {
    poNumber: `PO-${projTag}-EDG-${dateStr.replace(/-/g, '')}`,
    vendorCategory: 'edgeband_vendor',
    vendorName: 'PVC Edge Banding Specialist',
    categoryLabel: 'PVC Edge Band Tape Vendors',
    generatedDate: dateStr,
    currency: 'INR',
    items: edgeItems,
    totalQuantity: edgeItems.reduce((acc, it) => acc + it.quantity, 0),
    estimatedGrandTotalInr: edgeItems.reduce((acc, it) => acc + it.estimatedTotalInr, 0),
  };

  // 4. Hardware Distributor PO
  const hardwareItems: VendorPurchaseOrderItem[] = [];
  let totalHardwareUnits = 0;

  if (params.hardwareSchedule && params.hardwareSchedule.length > 0) {
    let hwIdx = 1;
    for (const hw of params.hardwareSchedule) {
      const rate = hw.estimatedRateInr ?? (
        hw.category.toLowerCase().includes('hinge') ? 320 :
        hw.category.toLowerCase().includes('channel') || hw.category.toLowerCase().includes('drawer') ? 1450 :
        hw.category.toLowerCase().includes('sliding') ? 4800 :
        hw.category.toLowerCase().includes('handle') ? 280 : 35
      );
      totalHardwareUnits += hw.quantity;
      hardwareItems.push({
        itemCode: `HDW-${String(hwIdx++).padStart(3, '0')}`,
        description: hw.name,
        specification: `${hw.category} — Premium architectural grade with mounting accessories`,
        quantity: hw.quantity,
        unit: (hw.unit as any) || 'pcs',
        estimatedRateInr: rate,
        estimatedTotalInr: hw.quantity * rate,
        notes: hw.notes,
      });
    }
  } else {
    // Generate standard modular cabinetry baseline hardware from parts count
    const partsCount = params.parts.length;
    const estCabinets = Math.max(1, Math.round(partsCount / 6));

    const defaultHw = [
      { code: 'HDW-001', desc: 'Blum Clip Top Blumotion 110° Soft-Close Hinges', spec: 'Concealed hinge with integrated soft-close and 0mm cruciform mounting plate', qty: estCabinets * 4, unit: 'pcs' as const, rate: 340 },
      { code: 'HDW-002', desc: 'Hafele Matrix Box Slim A / Tandem Soft-Close Runners (500mm)', spec: 'Full-extension concealed undermount drawer slide with 35kg dynamic load rating', qty: Math.max(2, estCabinets * 2), unit: 'sets' as const, rate: 1650 },
      { code: 'HDW-003', desc: 'Hettich Rastex 15 Minifix Cams with Twister Dowels', spec: '15mm zinc cam + 34mm steel connecting dowel (System 32 joinery)', qty: estCabinets * 16, unit: 'sets' as const, rate: 24 },
      { code: 'HDW-004', desc: '5mm Nickel-Plated Steel Shelf Support Studs', spec: 'System 32 shelf support pin with silicone cushion ring', qty: estCabinets * 12, unit: 'pcs' as const, rate: 8 },
      { code: 'HDW-005', desc: 'Aluminum Gola / J-Pull Profile Handle with End Caps', spec: 'Anodized brushed bronze/black architectural profile (3.0m length)', qty: Math.max(1, Math.ceil(estCabinets / 2)), unit: 'pcs' as const, rate: 1200 },
    ];

    for (const d of defaultHw) {
      totalHardwareUnits += d.qty;
      hardwareItems.push({
        itemCode: d.code,
        description: d.desc,
        specification: d.spec,
        quantity: d.qty,
        unit: d.unit,
        estimatedRateInr: d.rate,
        estimatedTotalInr: d.qty * d.rate,
      });
    }
  }

  const hardwarePO: VendorPurchaseOrder = {
    poNumber: `PO-${projTag}-HDW-${dateStr.replace(/-/g, '')}`,
    vendorCategory: 'hardware_distributor',
    vendorName: 'Architectural Hardware Distributor',
    categoryLabel: 'Functional & Joinery Hardware',
    generatedDate: dateStr,
    currency: 'INR',
    items: hardwareItems,
    totalQuantity: totalHardwareUnits,
    estimatedGrandTotalInr: hardwareItems.reduce((acc, it) => acc + it.estimatedTotalInr, 0),
  };

  const allPOs = [boardPO, laminatePO, edgePO, hardwarePO];
  const grandEstimatedTotal = allPOs.reduce((sum, po) => sum + po.estimatedGrandTotalInr, 0);

  return {
    projectId: params.projectId,
    projectName: params.projectName,
    generatedAt: new Date().toISOString(),
    purchaseOrders: allPOs,
    summary: {
      totalBoardSheets,
      totalLaminateSheets,
      totalEdgeBandMeters: totalEdgeMeters,
      totalHardwareUnits,
      estimatedTotalInr: grandEstimatedTotal,
    },
  };
}
