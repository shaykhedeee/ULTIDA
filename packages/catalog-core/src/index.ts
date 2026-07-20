import { z } from 'zod';

export const RoomTypeSchema = z.enum(['kitchen', 'living', 'bedroom', 'bathroom', 'dining', 'utility', 'other']);
export const ModuleFamilySchema = z.enum(['kitchen-base', 'kitchen-wall', 'kitchen-tall', 'kitchen-corner', 'wardrobe', 'tv-unit', 'sofa', 'bed', 'study', 'false-ceiling', 'storage']);
export const MaterialSlotSchema = z.enum(['carcass', 'shutter', 'countertop', 'back-panel', 'hardware', 'fabric', 'metal', 'glass']);

export const CatalogModuleSchema = z.object({
  id: z.string(), family: ModuleFamilySchema, name: z.string(), roomTypes: z.array(RoomTypeSchema).min(1),
  widthMm: z.number().positive(), depthMm: z.number().positive(), heightMm: z.number().positive(),
  minClearanceMm: z.number().nonnegative(), sku: z.string(), materialSlots: z.array(MaterialSlotSchema),
  tags: z.array(z.string()), production: z.object({ panelBased: z.boolean(), hardwareSchedule: z.boolean(), cutlistSupported: z.boolean() })
});
export type CatalogModule = z.infer<typeof CatalogModuleSchema>;

export const IndianModularCatalog: CatalogModule[] = [
  { id: 'kit-base-600', family: 'kitchen-base', name: '600 base cabinet', roomTypes: ['kitchen'], widthMm: 600, depthMm: 600, heightMm: 750, minClearanceMm: 900, sku: 'ULT-KB-600', materialSlots: ['carcass', 'shutter', 'hardware', 'countertop'], tags: ['modular-kitchen', 'drawer', 'shutter'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true } },
  { id: 'kit-sink-900', family: 'kitchen-base', name: '900 sink base', roomTypes: ['kitchen', 'utility'], widthMm: 900, depthMm: 600, heightMm: 750, minClearanceMm: 900, sku: 'ULT-KS-900', materialSlots: ['carcass', 'shutter', 'hardware', 'countertop'], tags: ['sink', 'plumbing', 'modular-kitchen'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true } },
  { id: 'kit-tall-600', family: 'kitchen-tall', name: '600 appliance tall unit', roomTypes: ['kitchen'], widthMm: 600, depthMm: 600, heightMm: 2100, minClearanceMm: 900, sku: 'ULT-KT-600', materialSlots: ['carcass', 'shutter', 'hardware'], tags: ['oven', 'microwave', 'tall-unit'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true } },
  { id: 'wardrobe-900', family: 'wardrobe', name: '900 sliding wardrobe bay', roomTypes: ['bedroom'], widthMm: 900, depthMm: 600, heightMm: 2400, minClearanceMm: 900, sku: 'ULT-WD-900', materialSlots: ['carcass', 'shutter', 'hardware', 'glass'], tags: ['sliding', 'loft', 'modular-storage'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true } },
  { id: 'tv-1800', family: 'tv-unit', name: '1800 TV console', roomTypes: ['living', 'bedroom'], widthMm: 1800, depthMm: 400, heightMm: 600, minClearanceMm: 900, sku: 'ULT-TV-1800', materialSlots: ['carcass', 'shutter', 'back-panel', 'hardware'], tags: ['tv-wall', 'console', 'cable-management'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true } },
  { id: 'sofa-2200', family: 'sofa', name: '2200 three-seat sofa', roomTypes: ['living'], widthMm: 2200, depthMm: 900, heightMm: 850, minClearanceMm: 750, sku: 'ULT-SF-2200', materialSlots: ['fabric', 'metal'], tags: ['living', 'three-seat', 'standard-size'], production: { panelBased: false, hardwareSchedule: false, cutlistSupported: false } }
];

export function listCatalog(roomType?: z.infer<typeof RoomTypeSchema>, query?: string) {
  const normalized = query?.trim().toLowerCase();
  return IndianModularCatalog.filter((item) => (!roomType || item.roomTypes.includes(roomType)) && (!normalized || `${item.name} ${item.tags.join(' ')}`.toLowerCase().includes(normalized)));
}

export function validatePlacement(module: CatalogModule, roomType: z.infer<typeof RoomTypeSchema>, clearanceMm: number) {
  const issues: string[] = [];
  if (!module.roomTypes.includes(roomType)) issues.push(`${module.name} is not catalogued for ${roomType}.`);
  if (clearanceMm < module.minClearanceMm) issues.push(`${module.name} needs at least ${module.minClearanceMm} mm clear circulation.`);
  return { valid: issues.length === 0, issues };
}
