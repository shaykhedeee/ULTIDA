/**
 * pricing-rates.ts — Unified pricing rate card store for ULTIDA Studio OS.
 *
 * Persists studio rates to localStorage (with backend fallback) and provides
 * single-source-of-truth calculations for:
 *  - Core Carcass Board materials (₹/sq.ft)
 *  - Shutter & Facia Finishes (₹/sq.ft)
 *  - Architectural & Motion Hardware (₹/unit)
 *  - Millwork Labor & Erection (₹/sq.ft or job)
 *  - Taxes (CGST 9% + SGST 9% = 18% GST) & Studio Markup
 */

export interface PricingRateCard {
  version: string;
  updatedAt: string;
  currency: 'INR';

  // Core Carcass Materials (₹ per sq.ft)
  carcassMaterials: {
    hdhmr: number;        // Action TESA HDHMR (Moisture Resistant)
    marineBwp: number;    // IS 710 Boiling Water Proof Plywood
    commercialMr: number; // Commercial Moisture Resistant Plywood
    particleBoard: number;// Prelam Particle Board
    mdf: number;          // Interior Grade MDF
  };

  // Shutter & Facia Finishes (₹ per sq.ft)
  shutterFinishes: {
    matteLaminate: number; // 1mm Matte Laminate (Merino/Royale Touche)
    glossAcrylic: number;  // 2mm Anti-scratch High Gloss Acrylic
    puDucoPaint: number;   // Multi-coat Matte/Gloss PU Paint
    naturalVeneer: number; // 4mm Natural Wood Veneer (Polished)
    profileGlass: number;  // Tinted Fluted Toughened Glass with Slim Aluminium Profile
  };

  // Hardware & Motion Fitting Units (₹ per piece / set)
  hardware: {
    softCloseHingePair: number;      // Blum / Hafele 110° Soft-Close Hinges (pair)
    tandemboxSlideSet: number;       // Soft-Close Double Wall Drawer Runner Set
    telescopicChannelSet: number;    // Heavy-Duty Ball Bearing Slide (set)
    minifixCamPinSet: number;        // Knock-Down Furniture Fastener (set)
    architecturalHandle: number;     // 160-224mm Matt Black / Brass Handle
    plinthLevelerLeg: number;        // Heavy Duty PVC Adjustable Leg (100mm)
    pushToOpenLatch: number;         // Mechanical Push Latch
  };

  // Fabrication, Labor & Installation Rates (₹ per sq.ft / point)
  labor: {
    millworkFabricationPerSqft: number; // Precision factory sizing, edge-banding & grooving
    onsiteAssemblyPerSqft: number;      // On-site carpenter carcass alignment & erection
    electricalPointRate: number;        // LED strip channel routing & driver wiring per point
  };

  // Margins & Government Taxes
  commercial: {
    studioMarkupPercent: number; // Default 15% studio operational markup
    gstRatePercent: number;      // Standard 18% GST (9% CGST + 9% SGST)
  };
}

export const DEFAULT_PRICING_RATES: PricingRateCard = {
  version: 'ultida.pricing.v1',
  updatedAt: '2026-09-24T00:00:00.000Z',
  currency: 'INR',

  carcassMaterials: {
    hdhmr: 95,          // ₹95 / sq.ft (Action TESA HDHMR)
    marineBwp: 125,      // ₹125 / sq.ft (IS 710 Marine Ply)
    commercialMr: 75,   // ₹75 / sq.ft (Commercial Ply)
    particleBoard: 45,  // ₹45 / sq.ft (Prelam Particle Board)
    mdf: 60,            // ₹60 / sq.ft (MDF)
  },

  shutterFinishes: {
    matteLaminate: 85,   // ₹85 / sq.ft
    glossAcrylic: 180,   // ₹180 / sq.ft
    puDucoPaint: 260,    // ₹260 / sq.ft
    naturalVeneer: 320,  // ₹320 / sq.ft
    profileGlass: 380,   // ₹380 / sq.ft
  },

  hardware: {
    softCloseHingePair: 650,    // ₹650 / pair
    tandemboxSlideSet: 2800,    // ₹2,800 / set
    telescopicChannelSet: 850,  // ₹850 / set
    minifixCamPinSet: 35,       // ₹35 / set
    architecturalHandle: 450,   // ₹450 / pc
    plinthLevelerLeg: 85,       // ₹85 / pc
    pushToOpenLatch: 240,       // ₹240 / pc
  },

  labor: {
    millworkFabricationPerSqft: 140, // ₹140 / sq.ft
    onsiteAssemblyPerSqft: 80,       // ₹80 / sq.ft
    electricalPointRate: 450,        // ₹450 / point
  },

  commercial: {
    studioMarkupPercent: 15, // 15%
    gstRatePercent: 18,      // 18% (9% CGST + 9% SGST)
  },
};

const STORAGE_KEY = 'ultida_pricing_rates';

/**
 * Retrieves active pricing rates from localStorage, falling back to authoritative defaults.
 */
export function getPricingRates(): PricingRateCard {
  if (typeof window === 'undefined') return DEFAULT_PRICING_RATES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PRICING_RATES;
    const parsed = JSON.parse(raw) as Partial<PricingRateCard>;
    if (!parsed || parsed.version !== DEFAULT_PRICING_RATES.version) {
      return DEFAULT_PRICING_RATES;
    }
    return {
      ...DEFAULT_PRICING_RATES,
      ...parsed,
      carcassMaterials: { ...DEFAULT_PRICING_RATES.carcassMaterials, ...parsed.carcassMaterials },
      shutterFinishes: { ...DEFAULT_PRICING_RATES.shutterFinishes, ...parsed.shutterFinishes },
      hardware: { ...DEFAULT_PRICING_RATES.hardware, ...parsed.hardware },
      labor: { ...DEFAULT_PRICING_RATES.labor, ...parsed.labor },
      commercial: { ...DEFAULT_PRICING_RATES.commercial, ...parsed.commercial },
    };
  } catch {
    return DEFAULT_PRICING_RATES;
  }
}

/**
 * Persists updated pricing rates to browser storage and dispatches a notification event.
 */
export function savePricingRates(rates: PricingRateCard): void {
  if (typeof window === 'undefined') return;
  const payload: PricingRateCard = {
    ...rates,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent('ultida:pricing-updated', { detail: payload }));
}

/**
 * Resets rates to factory baseline defaults.
 */
export function resetPricingRates(): PricingRateCard {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('ultida:pricing-updated', { detail: DEFAULT_PRICING_RATES }));
  }
  return DEFAULT_PRICING_RATES;
}

/**
 * Helper to compute square footage from dimensions in millimetres.
 */
export function mmToSqft(widthMm: number, heightMm: number): number {
  const sqMeters = (widthMm * heightMm) / 1_000_000;
  return sqMeters * 10.7639; // 1 m² = 10.7639 sq.ft
}

/**
 * Computes estimated wardrobe casework cost using active studio rates.
 */
export function estimateWardrobeUnitCost(
  widthMm = 2400,
  heightMm = 2400,
  depthMm = 600,
  shutterFinish: keyof PricingRateCard['shutterFinishes'] = 'matteLaminate',
  carcassMaterial: keyof PricingRateCard['carcassMaterials'] = 'hdhmr',
  rates = getPricingRates()
): {
  carcassSqft: number;
  shutterSqft: number;
  carcassCost: number;
  shutterCost: number;
  hardwareCost: number;
  laborCost: number;
  subtotal: number;
  markup: number;
  cgst: number;
  sgst: number;
  grandTotal: number;
} {
  const gableAreaSqft = mmToSqft(depthMm, heightMm) * 3;
  const topBottomAreaSqft = mmToSqft(widthMm, depthMm) * 2;
  const backPanelSqft = mmToSqft(widthMm, heightMm);
  const shelvesAreaSqft = mmToSqft(widthMm / 2, depthMm) * 4;
  const carcassSqft = Math.round((gableAreaSqft + topBottomAreaSqft + backPanelSqft + shelvesAreaSqft) * 10) / 10;

  const shutterSqft = Math.round(mmToSqft(widthMm, heightMm) * 10) / 10;

  const carcassRate = rates.carcassMaterials[carcassMaterial] ?? 95;
  const shutterRate = rates.shutterFinishes[shutterFinish] ?? 85;

  const carcassCost = Math.round(carcassSqft * carcassRate);
  const shutterCost = Math.round(shutterSqft * shutterRate);

  const hardwareCost =
    4 * rates.hardware.softCloseHingePair +
    2 * rates.hardware.tandemboxSlideSet +
    4 * rates.hardware.architecturalHandle +
    6 * rates.hardware.plinthLevelerLeg +
    24 * rates.hardware.minifixCamPinSet;

  const totalMillworkSqft = carcassSqft + shutterSqft;
  const laborCost = Math.round(
    totalMillworkSqft * (rates.labor.millworkFabricationPerSqft + rates.labor.onsiteAssemblyPerSqft)
  );

  const subtotal = carcassCost + shutterCost + hardwareCost + laborCost;
  const markup = Math.round((subtotal * rates.commercial.studioMarkupPercent) / 100);
  const taxableValue = subtotal + markup;
  const totalGst = Math.round((taxableValue * rates.commercial.gstRatePercent) / 100);
  const cgst = Math.round(totalGst / 2);
  const sgst = totalGst - cgst;
  const grandTotal = taxableValue + totalGst;

  return {
    carcassSqft,
    shutterSqft,
    carcassCost,
    shutterCost,
    hardwareCost,
    laborCost,
    subtotal,
    markup,
    cgst,
    sgst,
    grandTotal,
  };
}
