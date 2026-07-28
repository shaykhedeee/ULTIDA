import { z } from 'zod';

export const RoomTypeSchema = z.enum(['kitchen', 'living', 'bedroom', 'bathroom', 'dining', 'study', 'pooja', 'utility', 'other']);
export const ModuleFamilySchema = z.enum(['kitchen-base', 'kitchen-wall', 'kitchen-tall', 'kitchen-corner', 'wardrobe', 'tv-unit', 'crockery', 'pooja', 'sofa', 'bed', 'study', 'utility', 'dining', 'false-ceiling', 'storage']);
export const MaterialSlotSchema = z.enum(['carcass', 'shutter', 'countertop', 'back-panel', 'hardware', 'fabric', 'metal', 'glass', 'lighting']);

export const CatalogModuleSchema = z.object({
  id: z.string(), family: ModuleFamilySchema, name: z.string(), roomTypes: z.array(RoomTypeSchema).min(1),
  widthMm: z.number().positive(), depthMm: z.number().positive(), heightMm: z.number().positive(),
  minClearanceMm: z.number().nonnegative(), sku: z.string(), materialSlots: z.array(MaterialSlotSchema),
  tags: z.array(z.string()), production: z.object({ panelBased: z.boolean(), hardwareSchedule: z.boolean(), cutlistSupported: z.boolean() })
});
export type CatalogModule = z.infer<typeof CatalogModuleSchema>;

export const IndianModularDesignPresetSchema = z.object({
  id: z.string(), name: z.string(), family: ModuleFamilySchema, roomTypes: z.array(RoomTypeSchema).min(1),
  referenceStyle: z.array(z.string()), elevationViews: z.array(z.enum(['external', 'internal', 'top', 'section'])).min(1),
  renderRules: z.array(z.string()), productionRules: z.array(z.string())
});
export type IndianModularDesignPreset = z.infer<typeof IndianModularDesignPresetSchema>;

export const IndianModularDesignPresets: IndianModularDesignPreset[] = [
  { id: 'preset-tv-profile-glass', name: 'Floating TV wall with profile-glass display', family: 'tv-unit', roomTypes: ['living'], referenceStyle: ['warm wood', 'off-white shutters', 'profile glass', 'vertical LED'], elevationViews: ['external', 'internal'], renderRules: ['Preserve TV wall proportions', 'Use warm 3000K profile lighting only in the display cabinet', 'Keep a visible ceiling gap unless loft is specified'], productionRules: ['Include glass aluminium profile shutter', 'Include cable-management back panel', 'Generate floating-base clearance'] },
  { id: 'preset-kitchen-l-shape', name: 'L-shaped modular kitchen with lofts', family: 'kitchen-base', roomTypes: ['kitchen'], referenceStyle: ['matte laminate', '20mm granite', 'dado tiles', 'under-cabinet light'], elevationViews: ['external', 'internal', 'top'], renderRules: ['Preserve appliance and service locations', 'Use 20mm countertop', 'Do not invent lighting outside specified zones'], productionRules: ['Separate base, wall, tall and blind-corner units', 'Schedule granite and edge bands', 'Record sink, hob and appliance cutouts'] },
  { id: 'preset-wardrobe-equal-shutters', name: 'Equal-shutter wardrobe with loft and profile bay', family: 'wardrobe', roomTypes: ['bedroom'], referenceStyle: ['equal shutters', 'loft', 'long handles', 'profile-glass bay'], elevationViews: ['external', 'internal'], renderRules: ['Use 560mm carcass plus 20mm back as 580mm total depth', 'Keep shutter widths equal unless explicitly overridden'], productionRules: ['Use 18mm panels', 'Include 30mm dummy or filler where specified', 'Separate hanger, shelf and drawer parts'] },
  { id: 'preset-study-whiteboard', name: 'Study desk with marker-safe back panel', family: 'study', roomTypes: ['study', 'bedroom'], referenceStyle: ['floating desk', 'open shelf', 'marker-safe whiteboard laminate'], elevationViews: ['external', 'internal'], renderRules: ['Remove drawers when requested', 'Keep task lighting directional and restrained'], productionRules: ['Mark whiteboard laminate as a dedicated back-panel material', 'Generate desk, shelf and support parts'] },
  { id: 'preset-pooja-tray-jaali', name: 'Pooja unit with tray, fluted glass and jaali', family: 'pooja', roomTypes: ['pooja', 'living'], referenceStyle: ['fluted glass', 'jaali', 'bells', 'warm concealed lighting'], elevationViews: ['external', 'internal', 'section'], renderRules: ['Keep two drawers below the pooja tray', 'Use a single main tray', 'Keep bells and jaali as explicit accessories'], productionRules: ['Separate tray, drawers, shutters and CNC jaali panel', 'Validate cutout vector before release'] }
];

export function listDesignPresets(roomType?: z.infer<typeof RoomTypeSchema>, family?: z.infer<typeof ModuleFamilySchema>) {
  return IndianModularDesignPresets.filter((preset) => (!roomType || preset.roomTypes.includes(roomType)) && (!family || preset.family === family));
}

export const IndianModularCatalog: CatalogModule[] = [
  { id: 'kit-base-600', family: 'kitchen-base', name: '600 base cabinet', roomTypes: ['kitchen'], widthMm: 600, depthMm: 600, heightMm: 750, minClearanceMm: 900, sku: 'ULT-KB-600', materialSlots: ['carcass', 'shutter', 'hardware', 'countertop'], tags: ['modular-kitchen', 'drawer', 'shutter'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true } },
  { id: 'kit-sink-900', family: 'kitchen-base', name: '900 sink base', roomTypes: ['kitchen', 'utility'], widthMm: 900, depthMm: 600, heightMm: 750, minClearanceMm: 900, sku: 'ULT-KS-900', materialSlots: ['carcass', 'shutter', 'hardware', 'countertop'], tags: ['sink', 'plumbing', 'modular-kitchen'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true } },
  { id: 'kit-tall-600', family: 'kitchen-tall', name: '600 appliance tall unit', roomTypes: ['kitchen'], widthMm: 600, depthMm: 600, heightMm: 2100, minClearanceMm: 900, sku: 'ULT-KT-600', materialSlots: ['carcass', 'shutter', 'hardware'], tags: ['oven', 'microwave', 'tall-unit'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true } },
  { id: 'wardrobe-900', family: 'wardrobe', name: '900 sliding wardrobe bay', roomTypes: ['bedroom'], widthMm: 900, depthMm: 600, heightMm: 2400, minClearanceMm: 900, sku: 'ULT-WD-900', materialSlots: ['carcass', 'shutter', 'hardware', 'glass'], tags: ['sliding', 'loft', 'modular-storage'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true } },
  { id: 'tv-1800', family: 'tv-unit', name: '1800 TV console', roomTypes: ['living', 'bedroom'], widthMm: 1800, depthMm: 400, heightMm: 600, minClearanceMm: 900, sku: 'ULT-TV-1800', materialSlots: ['carcass', 'shutter', 'back-panel', 'hardware'], tags: ['tv-wall', 'console', 'cable-management'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true } },
  { id: 'tv-profile-2400', family: 'tv-unit', name: '2400 TV wall with profile glass', roomTypes: ['living'], widthMm: 2400, depthMm: 400, heightMm: 2400, minClearanceMm: 900, sku: 'ULT-TV-PROFILE-2400', materialSlots: ['carcass', 'shutter', 'back-panel', 'glass', 'hardware', 'lighting'], tags: ['tv-wall', 'profile-glass', 'floating-base', 'lighting'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true } },
  { id: 'crockery-1200', family: 'crockery', name: '1200 crockery display unit', roomTypes: ['living', 'dining'], widthMm: 1200, depthMm: 400, heightMm: 2100, minClearanceMm: 900, sku: 'ULT-CR-1200', materialSlots: ['carcass', 'shutter', 'glass', 'hardware', 'lighting'], tags: ['crockery', 'display', 'profile-glass'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true } },
  { id: 'study-1500', family: 'study', name: '1500 study desk with overhead storage', roomTypes: ['study', 'bedroom'], widthMm: 1500, depthMm: 600, heightMm: 2400, minClearanceMm: 900, sku: 'ULT-ST-1500', materialSlots: ['carcass', 'shutter', 'back-panel', 'hardware', 'lighting'], tags: ['study', 'desk', 'overhead-storage'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true } },
  { id: 'pooja-900', family: 'pooja', name: '900 pooja unit with tray', roomTypes: ['pooja', 'living'], widthMm: 900, depthMm: 400, heightMm: 1800, minClearanceMm: 750, sku: 'ULT-PJ-900', materialSlots: ['carcass', 'shutter', 'back-panel', 'hardware', 'lighting'], tags: ['pooja', 'pull-out-tray', 'jaali'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true } },
  { id: 'utility-900', family: 'utility', name: '900 utility storage tower', roomTypes: ['utility', 'kitchen'], widthMm: 900, depthMm: 600, heightMm: 2100, minClearanceMm: 900, sku: 'ULT-UT-900', materialSlots: ['carcass', 'shutter', 'hardware'], tags: ['utility', 'laundry', 'storage'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true } },
  { id: 'bed-1800', family: 'bed', name: '1800 hydraulic storage bed', roomTypes: ['bedroom'], widthMm: 1800, depthMm: 2100, heightMm: 450, minClearanceMm: 750, sku: 'ULT-BD-1800', materialSlots: ['carcass', 'shutter', 'hardware', 'fabric'], tags: ['bedroom', 'storage-bed', 'hydraulic'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true } },
  { id: 'dining-1600', family: 'dining', name: '1600 six-seat dining set', roomTypes: ['dining', 'living'], widthMm: 1600, depthMm: 900, heightMm: 750, minClearanceMm: 900, sku: 'ULT-DN-1600', materialSlots: ['metal', 'fabric'], tags: ['dining', 'six-seat', 'furniture'], production: { panelBased: false, hardwareSchedule: false, cutlistSupported: false } },
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
