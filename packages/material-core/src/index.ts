export type MaterialSpec = { id: string; name: string; category: 'board' | 'laminate' | 'edge' | 'hardware'; unit: 'sqm' | 'rm' | 'each'; rateInr: number; metadata?: Record<string, unknown> };
export type MaterialPanel = { lengthMm: number; widthMm: number; quantity: number; materialId: string };

export function panelAreaSqm(panel: MaterialPanel) { return (panel.lengthMm * panel.widthMm * panel.quantity) / 1_000_000; }
export function edgeLengthM(lengthMm: number, widthMm: number, quantity = 1) { return ((2 * (lengthMm + widthMm)) * quantity) / 1000; }
export function calculateMaterialCost(material: MaterialSpec, quantity: number) { if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Material quantity must be non-negative.'); return Math.round(material.rateInr * quantity * 100) / 100; }
