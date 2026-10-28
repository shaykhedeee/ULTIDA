/**
 * Indian Interior BOQ, HSN Tax Engine & Vastu Validation
 * Maps standard Indian GST classification codes (HSN/SAC) for interior architecture,
 * computes CGST + SGST (or IGST for interstate), and generates TallyPrime XML import documents.
 */

export interface HsnDefinition {
  hsnCode: string;
  category: string;
  description: string;
  gstRate: number; // e.g. 0.18 for 18%
  cgstRate: number; // 0.09
  sgstRate: number; // 0.09
  cessRate?: number;
}

export const INDIAN_INTERIOR_HSN_REGISTRY: Record<string, HsnDefinition> = {
  '94034000': {
    hsnCode: '9403.40.00',
    category: 'modular_kitchen',
    description: 'Wooden furniture of a kind used in the kitchen (Modular Kitchen Cabinets & Shutters)',
    gstRate: 0.18,
    cgstRate: 0.09,
    sgstRate: 0.09,
  },
  '94035000': {
    hsnCode: '9403.50.00',
    category: 'modular_wardrobe_bedroom',
    description: 'Wooden furniture of a kind used in the bedroom (Modular Wardrobes, Dressers, Bed Backs)',
    gstRate: 0.18,
    cgstRate: 0.09,
    sgstRate: 0.09,
  },
  '94036000': {
    hsnCode: '9403.60.00',
    category: 'modular_living_storage',
    description: 'Other wooden furniture (TV units, Shoe racks, Vanity consoles, Crockery units)',
    gstRate: 0.18,
    cgstRate: 0.09,
    sgstRate: 0.09,
  },
  '44101190': {
    hsnCode: '4410.11.90',
    category: 'hdhmr_particle_board',
    description: 'Particle board and similar board of wood / HDHMR substrate',
    gstRate: 0.18,
    cgstRate: 0.09,
    sgstRate: 0.09,
  },
  '44123300': {
    hsnCode: '4412.33.00',
    category: 'plywood_bwp_bwr',
    description: 'Plywood, veneered panels and similar laminated wood (BWP Marine / BWR Ply)',
    gstRate: 0.18,
    cgstRate: 0.09,
    sgstRate: 0.09,
  },
  '39209999': {
    hsnCode: '3920.99.99',
    category: 'laminate_surfaces',
    description: 'High-pressure decorative laminates (HPL / Merino / CenturyLaminates 1mm/0.8mm)',
    gstRate: 0.18,
    cgstRate: 0.09,
    sgstRate: 0.09,
  },
  '83024200': {
    hsnCode: '8302.42.00',
    category: 'hardware_fittings',
    description: 'Base metal mountings, fittings and similar articles suitable for furniture (Hettich, Ebco, Blum)',
    gstRate: 0.18,
    cgstRate: 0.09,
    sgstRate: 0.09,
  },
  '94054090': {
    hsnCode: '9405.40.90',
    category: 'architectural_led_lighting',
    description: 'Electric lamps and lighting fittings, LED profile strips and drivers (3000K Warm White)',
    gstRate: 0.18,
    cgstRate: 0.09,
    sgstRate: 0.09,
  },
  '995476': {
    hsnCode: '995476',
    category: 'interior_turnkey_contract',
    description: 'Interior fit-out, installation and decoration services (Turnkey Works Contract)',
    gstRate: 0.18,
    cgstRate: 0.09,
    sgstRate: 0.09,
  },
};

export interface IndianGstItemCalculation {
  lineId: string;
  description: string;
  hsnCode: string;
  taxableAmountInr: number;
  isInterState: boolean;
  cgstRate: number;
  cgstAmountInr: number;
  sgstRate: number;
  sgstAmountInr: number;
  igstRate: number;
  igstAmountInr: number;
  totalTaxInr: number;
  totalWithTaxInr: number;
}

export interface IndianBoqTaxSummary {
  taxableTotalInr: number;
  cgstTotalInr: number;
  sgstTotalInr: number;
  igstTotalInr: number;
  totalGstInr: number;
  grandTotalWithGstInr: number;
  items: IndianGstItemCalculation[];
}

export function calculateIndianGstBoq(
  items: Array<{
    id: string;
    description: string;
    taxableAmountInr: number;
    hsnKey?: string;
  }>,
  options?: {
    isInterState?: boolean;
    clientGstNumber?: string;
    studioGstNumber?: string;
  }
): IndianBoqTaxSummary {
  const isInterState = Boolean(options?.isInterState);
  const calculations: IndianGstItemCalculation[] = [];

  let taxableTotalInr = 0;
  let cgstTotalInr = 0;
  let sgstTotalInr = 0;
  let igstTotalInr = 0;

  for (const item of items) {
    const matchedHsn = (item.hsnKey && INDIAN_INTERIOR_HSN_REGISTRY[item.hsnKey]) || INDIAN_INTERIOR_HSN_REGISTRY['94034000'];
    const taxable = Math.round(item.taxableAmountInr * 100) / 100;
    taxableTotalInr += taxable;

    if (isInterState) {
      const igstAmount = Math.round(taxable * matchedHsn.gstRate * 100) / 100;
      igstTotalInr += igstAmount;
      calculations.push({
        lineId: item.id,
        description: item.description,
        hsnCode: matchedHsn.hsnCode,
        taxableAmountInr: taxable,
        isInterState: true,
        cgstRate: 0,
        cgstAmountInr: 0,
        sgstRate: 0,
        sgstAmountInr: 0,
        igstRate: matchedHsn.gstRate,
        igstAmountInr: igstAmount,
        totalTaxInr: igstAmount,
        totalWithTaxInr: Math.round((taxable + igstAmount) * 100) / 100,
      });
    } else {
      const cgstAmount = Math.round(taxable * matchedHsn.cgstRate * 100) / 100;
      const sgstAmount = Math.round(taxable * matchedHsn.sgstRate * 100) / 100;
      cgstTotalInr += cgstAmount;
      sgstTotalInr += sgstAmount;
      const totalTax = Math.round((cgstAmount + sgstAmount) * 100) / 100;
      calculations.push({
        lineId: item.id,
        description: item.description,
        hsnCode: matchedHsn.hsnCode,
        taxableAmountInr: taxable,
        isInterState: false,
        cgstRate: matchedHsn.cgstRate,
        cgstAmountInr: cgstAmount,
        sgstRate: matchedHsn.sgstRate,
        sgstAmountInr: sgstAmount,
        igstRate: 0,
        igstAmountInr: 0,
        totalTaxInr: totalTax,
        totalWithTaxInr: Math.round((taxable + totalTax) * 100) / 100,
      });
    }
  }

  taxableTotalInr = Math.round(taxableTotalInr * 100) / 100;
  cgstTotalInr = Math.round(cgstTotalInr * 100) / 100;
  sgstTotalInr = Math.round(sgstTotalInr * 100) / 100;
  igstTotalInr = Math.round(igstTotalInr * 100) / 100;
  const totalGstInr = Math.round((cgstTotalInr + sgstTotalInr + igstTotalInr) * 100) / 100;
  const grandTotalWithGstInr = Math.round((taxableTotalInr + totalGstInr) * 100) / 100;

  return {
    taxableTotalInr,
    cgstTotalInr,
    sgstTotalInr,
    igstTotalInr,
    totalGstInr,
    grandTotalWithGstInr,
    items: calculations,
  };
}

/**
 * Generates TallyPrime XML import document format for Indian accounting integration.
 */
export function exportTallyPrimeSalesVoucherXml(
  summary: IndianBoqTaxSummary,
  options: {
    voucherNo: string;
    dateIso: string; // YYYYMMDD
    partyName: string;
    studioName?: string;
  }
): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push('<ENVELOPE>');
  lines.push('  <HEADER>');
  lines.push('    <TALLYREQUEST>Import Data</TALLYREQUEST>');
  lines.push('  </HEADER>');
  lines.push('  <BODY>');
  lines.push('    <IMPORTDATA>');
  lines.push('      <REQUESTDESC>');
  lines.push('        <REPORTNAME>Vouchers</REPORTNAME>');
  lines.push('      </REQUESTDESC>');
  lines.push('      <REQUESTDATA>');
  lines.push('        <TALLYMESSAGE xmlns:UDF="TallyUDF">');
  lines.push('          <VOUCHER VCHTYPE="Sales" ACTION="Create">');
  lines.push(`            <DATE>${options.dateIso.replace(/-/g, '')}</DATE>`);
  lines.push(`            <VOUCHERNUMBER>${escapeXml(options.voucherNo)}</VOUCHERNUMBER>`);
  lines.push(`            <PARTYLEDGERNAME>${escapeXml(options.partyName)}</PARTYLEDGERNAME>`);
  lines.push('            <PERSISTEDVIEW>Invoice View</PERSISTEDVIEW>');

  // Debit party ledger for grand total
  lines.push('            <ALLLEDGERENTRIES.LIST>');
  lines.push(`              <LEDGERNAME>${escapeXml(options.partyName)}</LEDGERNAME>`);
  lines.push('              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>');
  lines.push(`              <AMOUNT>-${summary.grandTotalWithGstInr.toFixed(2)}</AMOUNT>`);
  lines.push('            </ALLLEDGERENTRIES.LIST>');

  // Credit sales ledger for taxable total
  lines.push('            <ALLLEDGERENTRIES.LIST>');
  lines.push('              <LEDGERNAME>Interior Modular Sales</LEDGERNAME>');
  lines.push('              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>');
  lines.push(`              <AMOUNT>${summary.taxableTotalInr.toFixed(2)}</AMOUNT>`);
  lines.push('            </ALLLEDGERENTRIES.LIST>');

  // CGST / SGST or IGST ledgers
  if (summary.cgstTotalInr > 0) {
    lines.push('            <ALLLEDGERENTRIES.LIST>');
    lines.push('              <LEDGERNAME>Output CGST 9%</LEDGERNAME>');
    lines.push('              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>');
    lines.push(`              <AMOUNT>${summary.cgstTotalInr.toFixed(2)}</AMOUNT>`);
    lines.push('            </ALLLEDGERENTRIES.LIST>');
  }
  if (summary.sgstTotalInr > 0) {
    lines.push('            <ALLLEDGERENTRIES.LIST>');
    lines.push('              <LEDGERNAME>Output SGST 9%</LEDGERNAME>');
    lines.push('              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>');
    lines.push(`              <AMOUNT>${summary.sgstTotalInr.toFixed(2)}</AMOUNT>`);
    lines.push('            </ALLLEDGERENTRIES.LIST>');
  }
  if (summary.igstTotalInr > 0) {
    lines.push('            <ALLLEDGERENTRIES.LIST>');
    lines.push('              <LEDGERNAME>Output IGST 18%</LEDGERNAME>');
    lines.push('              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>');
    lines.push(`              <AMOUNT>${summary.igstTotalInr.toFixed(2)}</AMOUNT>`);
    lines.push('            </ALLLEDGERENTRIES.LIST>');
  }

  lines.push('          </VOUCHER>');
  lines.push('        </TALLYMESSAGE>');
  lines.push('      </REQUESTDATA>');
  lines.push('    </IMPORTDATA>');
  lines.push('  </BODY>');
  lines.push('</ENVELOPE>');

  return lines.join('\n');
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
