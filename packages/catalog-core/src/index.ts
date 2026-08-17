import { z } from 'zod';

export const RoomTypeSchema = z.enum(['kitchen', 'living', 'bedroom', 'master_bedroom', 'kids_bedroom', 'bathroom', 'dining', 'study', 'pooja', 'utility', 'foyer', 'balcony', 'other']);
export const ModuleFamilySchema = z.enum(['kitchen-base', 'kitchen-wall', 'kitchen-tall', 'kitchen-corner', 'wardrobe', 'tv-unit', 'crockery', 'pooja', 'sofa', 'bed', 'study', 'utility', 'dining', 'false-ceiling', 'storage', 'feature-wall']);
export const MaterialSlotSchema = z.enum(['carcass', 'shutter', 'countertop', 'back-panel', 'hardware', 'fabric', 'metal', 'glass', 'lighting']);
export const ModuleElementKindSchema = z.enum(['carcass', 'shutter', 'drawer', 'shelf', 'loft', 'dummy_filler', 'profile_glass', 'back_panel', 'countertop', 'plinth_skirting', 'lighting_anchor', 'service_void', 'hardware', 'cnc_panel', 'appliance_void']);
export const ModuleProductionRoleSchema = z.enum(['visual', 'assembly', 'cutlist', 'service', 'accessory']);
export const ModuleElementSchema = z.object({
  kind: ModuleElementKindSchema,
  label: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  widthMm: z.number().positive().optional(),
  depthMm: z.number().positive().optional(),
  heightMm: z.number().positive().optional(),
  materialSlot: MaterialSlotSchema.optional(),
  productionRole: ModuleProductionRoleSchema.default('assembly'),
  notes: z.array(z.string()).default([]),
});
export type ModuleElement = z.infer<typeof ModuleElementSchema>;

export const ModuleConstraintSchema = z.object({
  kind: z.enum(['wall_anchored', 'opening_clearance', 'service_clearance', 'circulation', 'adjacency', 'stacking']),
  label: z.string().min(1),
  valueMm: z.number().nonnegative().optional(),
  required: z.boolean().default(true),
});
export type ModuleConstraint = z.infer<typeof ModuleConstraintSchema>;

export const CatalogModuleSchema = z.object({
  id: z.string(), family: ModuleFamilySchema, name: z.string(), roomTypes: z.array(RoomTypeSchema).min(1),
  widthMm: z.number().positive(), depthMm: z.number().positive(), heightMm: z.number().positive(),
  minClearanceMm: z.number().nonnegative(), sku: z.string(), materialSlots: z.array(MaterialSlotSchema),
  tags: z.array(z.string()), production: z.object({ panelBased: z.boolean(), hardwareSchedule: z.boolean(), cutlistSupported: z.boolean() })
  ,description: z.string().optional(), manufacturingRules: z.array(z.string()).optional(),
  elements: z.array(ModuleElementSchema).optional(), constraints: z.array(ModuleConstraintSchema).optional()
});
export type CatalogModule = z.infer<typeof CatalogModuleSchema>;

// Curated starting palette: intentionally small, brand-labelled, and never
// treated as a substitute for a supplier's current technical datasheet.
export const CuratedLaminateCatalog = [
  { id: 'cubex-neutral-sand', brand: 'Cubex', name: 'Neutral Sand', family: 'solid', finish: 'matte', colourHex: '#C9B59B', thicknessMm: 0.8, edgeBand: { thicknessMm: 1, material: 'PVC', status: 'required' }, suitableFor: ['wardrobe', 'tv-unit', 'crockery', 'bed'] },
  { id: 'cubex-walnut-grain', brand: 'Cubex', name: 'Walnut Grain', family: 'woodgrain', finish: 'textured', colourHex: '#654230', thicknessMm: 1, edgeBand: { thicknessMm: 2, material: 'ABS', status: 'required' }, suitableFor: ['tv-unit', 'crockery', 'bed'] },
  { id: 'cubex-charcoal-oak', brand: 'Cubex', name: 'Charcoal Oak', family: 'woodgrain', finish: 'textured', colourHex: '#34302B', thicknessMm: 1, edgeBand: { thicknessMm: 2, material: 'ABS', status: 'required' }, suitableFor: ['tv-unit', 'kitchen', 'study'] },
  { id: 'cubex-blush-ivory', brand: 'Cubex', name: 'Blush Ivory', family: 'solid', finish: 'suede', colourHex: '#E8D9CC', thicknessMm: 0.8, edgeBand: { thicknessMm: 1, material: 'PVC', status: 'required' }, suitableFor: ['bed', 'wardrobe', 'pooja'] },
  { id: 'advance-ivory-matte', brand: 'Advance', name: 'Ivory Matte', family: 'solid', finish: 'matte', colourHex: '#E7E0D2', thicknessMm: 0.8, edgeBand: { thicknessMm: 1, material: 'PVC', status: 'required' }, suitableFor: ['kitchen', 'wardrobe', 'pooja'] },
  { id: 'advance-stone-grey', brand: 'Advance', name: 'Stone Grey', family: 'stone', finish: 'textured', colourHex: '#77736D', thicknessMm: 1, edgeBand: { thicknessMm: 2, material: 'PVC', status: 'required' }, suitableFor: ['kitchen', 'tv-unit', 'crockery'] },
  { id: 'advance-terrazzo-beige', brand: 'Advance', name: 'Terrazzo Beige', family: 'stone', finish: 'textured', colourHex: '#BBA99B', thicknessMm: 1, edgeBand: { thicknessMm: 2, material: 'PVC', status: 'required' }, suitableFor: ['kitchen', 'crockery', 'study'] },
  { id: 'advance-graphite', brand: 'Advance', name: 'Graphite', family: 'solid', finish: 'matte', colourHex: '#303234', thicknessMm: 0.8, edgeBand: { thicknessMm: 1, material: 'PVC', status: 'required' }, suitableFor: ['kitchen', 'tv-unit', 'wardrobe'] },
  { id: 'virgo-sage-green', brand: 'Virgo', name: 'Sage Green', family: 'solid', finish: 'satin', colourHex: '#77816B', thicknessMm: 0.8, edgeBand: { thicknessMm: 1, material: 'PVC', status: 'required' }, suitableFor: ['kitchen', 'wardrobe', 'bed'] },
  { id: 'virgo-smoked-oak', brand: 'Virgo', name: 'Smoked Oak', family: 'woodgrain', finish: 'satin', colourHex: '#5A473B', thicknessMm: 1, edgeBand: { thicknessMm: 2, material: 'ABS', status: 'required' }, suitableFor: ['tv-unit', 'bed', 'crockery'] },
  { id: 'virgo-forest-green', brand: 'Virgo', name: 'Forest Green', family: 'solid', finish: 'matte', colourHex: '#38463A', thicknessMm: 1, edgeBand: { thicknessMm: 2, material: 'ABS', status: 'required' }, suitableFor: ['crockery', 'tv-unit', 'pooja'] },
  { id: 'virgo-dune-oak', brand: 'Virgo', name: 'Dune Oak', family: 'woodgrain', finish: 'textured', colourHex: '#A77B5B', thicknessMm: 0.8, edgeBand: { thicknessMm: 1, material: 'PVC', status: 'required' }, suitableFor: ['wardrobe', 'bed', 'study'] },
] as const;

export const IndianModularDesignPresetSchema = z.object({
  id: z.string(), name: z.string(), family: ModuleFamilySchema, roomTypes: z.array(RoomTypeSchema).min(1),
  referenceStyle: z.array(z.string()), elevationViews: z.array(z.enum(['external', 'internal', 'top', 'section'])).min(1),
  renderRules: z.array(z.string()), productionRules: z.array(z.string())
});
export type IndianModularDesignPreset = z.infer<typeof IndianModularDesignPresetSchema>;

export const IndianModularDesignPresets: IndianModularDesignPreset[] = [
  { id: 'preset-tv-profile-glass', name: 'Floating TV wall with profile-glass display', family: 'tv-unit', roomTypes: ['living'], referenceStyle: ['warm wood', 'off-white shutters', 'profile glass', 'vertical LED'], elevationViews: ['external', 'internal'], renderRules: ['Preserve TV wall proportions', 'Use warm 3000K profile lighting only in the display cabinet', 'Keep a visible ceiling gap unless loft is specified'], productionRules: ['Include glass aluminium profile shutter', 'Include cable-management back panel', 'Generate floating-base clearance'] },
  { id: 'preset-kitchen-l-shape', name: 'L-shaped modular kitchen with lofts', family: 'kitchen-base', roomTypes: ['kitchen'], referenceStyle: ['matte laminate', '20mm granite', 'dado tiles', 'under-cabinet light'], elevationViews: ['external', 'internal', 'top'], renderRules: ['Preserve appliance and service locations', 'Use 20mm countertop', 'Do not invent lighting outside specified zones'], productionRules: ['Separate base, wall, tall and blind-corner units', 'Schedule granite and edge bands', 'Record sink, hob and appliance cutouts'] },
  { id: 'preset-wardrobe-equal-shutters', name: 'Equal-shutter wardrobe with loft and profile bay', family: 'wardrobe', roomTypes: ['bedroom', 'master_bedroom'], referenceStyle: ['equal shutters', 'loft', 'long handles', 'profile-glass bay'], elevationViews: ['external', 'internal'], renderRules: ['Use 560mm carcass plus 20mm back as 580mm total depth', 'Keep shutter widths equal unless explicitly overridden'], productionRules: ['Use 18mm panels', 'Include 30mm dummy or filler where specified', 'Separate hanger, shelf and drawer parts'] },
  { id: 'preset-study-whiteboard', name: 'Study desk with marker-safe back panel', family: 'study', roomTypes: ['study', 'bedroom', 'master_bedroom'], referenceStyle: ['floating desk', 'open shelf', 'marker-safe whiteboard laminate'], elevationViews: ['external', 'internal'], renderRules: ['Remove drawers when requested', 'Keep task lighting directional and restrained'], productionRules: ['Mark whiteboard laminate as a dedicated back-panel material', 'Generate desk, shelf and support parts'] },
  { id: 'preset-pooja-tray-jaali', name: 'Pooja unit with tray, fluted glass and jaali', family: 'pooja', roomTypes: ['pooja', 'living'], referenceStyle: ['fluted glass', 'jaali', 'bells', 'warm concealed lighting'], elevationViews: ['external', 'internal', 'section'], renderRules: ['Keep two drawers below the pooja tray', 'Use a single main tray', 'Keep bells and jaali as explicit accessories'], productionRules: ['Separate tray, drawers, shutters and CNC jaali panel', 'Validate cutout vector before release'] },
  { id: 'preset-bed-storage-headboard', name: 'Hydraulic storage bed with layered headboard', family: 'bed', roomTypes: ['bedroom', 'master_bedroom'], referenceStyle: ['upholstered headboard', 'warm wood', 'floating bedside ledge', 'soft 3000K lighting'], elevationViews: ['external', 'top', 'section'], renderRules: ['Preserve approved mattress and circulation dimensions', 'Keep hydraulic base and headboard proportions tied to scene geometry', 'Do not add bedside units unless placed in the layout'], productionRules: ['Separate side rails, foot rail, head rail, centre partition and deck panels', 'Schedule hydraulic lift hardware separately', 'Keep headboard finish separate from carcass material'] }
];

export function listDesignPresets(roomType?: z.infer<typeof RoomTypeSchema>, family?: z.infer<typeof ModuleFamilySchema>) {
  return IndianModularDesignPresets.filter((preset) => {
    if (roomType) {
      const matchRoom = (roomType === 'master_bedroom' || roomType === 'kids_bedroom')
        ? (preset.roomTypes.includes('bedroom') || preset.roomTypes.includes(roomType))
        : preset.roomTypes.includes(roomType);
      if (!matchRoom) return false;
    }
    return !family || preset.family === family;
  });
}

export const IndianModularCatalog: CatalogModule[] = [
  // ─── KITCHEN BASE MODULES (Standard 600mm Depth, 750mm Height + 100mm Plinth = 850mm Worktop) ───
  { id: 'kit-base-600', family: 'kitchen-base', name: '600 Base Single-Door Cabinet', roomTypes: ['kitchen'], widthMm: 600, depthMm: 600, heightMm: 750, minClearanceMm: 900, sku: 'ULT-KB-600', materialSlots: ['carcass', 'shutter', 'hardware', 'countertop'], tags: ['kitchen', 'base', 'shutter'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Standard 600mm base unit with single soft-close shutter and one adjustable shelf.' },
  { id: 'kit-base-cutlery-600', family: 'kitchen-base', name: '600 3-Drawer Cutlery & Tandem Base', roomTypes: ['kitchen'], widthMm: 600, depthMm: 600, heightMm: 750, minClearanceMm: 900, sku: 'ULT-KB-DR3-600', materialSlots: ['carcass', 'shutter', 'hardware', 'countertop'], tags: ['kitchen', 'base', 'cutlery', 'tandem', 'drawers'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Triple drawer stack with top cutlery tray, middle utensil drawer, and deep lower pot drawer.' },
  { id: 'kit-base-tandem-2pot-600', family: 'kitchen-base', name: '600 2-Pot Deep Tandem Base', roomTypes: ['kitchen'], widthMm: 600, depthMm: 600, heightMm: 750, minClearanceMm: 900, sku: 'ULT-KB-TDM2-600', materialSlots: ['carcass', 'shutter', 'hardware', 'countertop'], tags: ['kitchen', 'base', 'tandem', 'pots', 'drawers'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Dual heavy-duty soft-close tandem drawers (65kg rating) for heavy pots and thali organizers.' },
  { id: 'kit-base-bottle-200', family: 'kitchen-base', name: '200 Stainless Steel Bottle Pull-Out', roomTypes: ['kitchen'], widthMm: 200, depthMm: 600, heightMm: 750, minClearanceMm: 900, sku: 'ULT-KB-BTL-200', materialSlots: ['carcass', 'shutter', 'hardware', 'countertop'], tags: ['kitchen', 'base', 'bottle-pullout', 'spices'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Slim 200mm dual-tier stainless steel pull-out basket for oils, sauces, and spice bottles.' },
  { id: 'kit-base-sink-900', family: 'kitchen-base', name: '900 Waterproof Sink Base with Drip Tray', roomTypes: ['kitchen', 'utility'], widthMm: 900, depthMm: 600, heightMm: 750, minClearanceMm: 900, sku: 'ULT-KS-900', materialSlots: ['carcass', 'shutter', 'hardware', 'countertop'], tags: ['kitchen', 'sink', 'plumbing', 'base'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Sink unit with marine-grade core, stainless steel waterproof bottom tray, and open service cavity.' },
  { id: 'kit-base-hob-900', family: 'kitchen-base', name: '900 Hob Base with Heat Deflector & Drawers', roomTypes: ['kitchen'], widthMm: 900, depthMm: 600, heightMm: 750, minClearanceMm: 900, sku: 'ULT-KB-HOB-900', materialSlots: ['carcass', 'shutter', 'hardware', 'countertop'], tags: ['kitchen', 'hob', 'base', 'heat-deflector', 'tandem'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Under-hob base unit with internal heat deflector insulation shield and dual wide tandem drawers.' },
  { id: 'kit-corner-lemans-1050', family: 'kitchen-corner', name: '1050 LeMans II Blind Corner Carousel', roomTypes: ['kitchen'], widthMm: 1050, depthMm: 600, heightMm: 750, minClearanceMm: 1050, sku: 'ULT-KC-LEM-1050', materialSlots: ['carcass', 'shutter', 'hardware', 'countertop'], tags: ['kitchen', 'corner', 'lemans', 'carousel'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Blind corner unit equipped with smooth double LeMans articulating trays for 100% accessible storage.' },

  // ─── KITCHEN WALL MODULES (Standard 350mm Depth, 720mm Height, Mounted at 1450mm) ───
  { id: 'kit-wall-normal-600', family: 'kitchen-wall', name: '600 Solid Acrylic/Laminate Wall Unit', roomTypes: ['kitchen', 'utility'], widthMm: 600, depthMm: 350, heightMm: 720, minClearanceMm: 900, sku: 'ULT-KW-NRM-600', materialSlots: ['carcass', 'shutter', 'hardware', 'lighting'], tags: ['kitchen', 'wall-unit', 'solid-shutter', 'acrylic'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Upper wall storage with solid anti-fingerprint acrylic/laminate shutters and dual adjustable shelves.' },
  { id: 'kit-wall-profile-glass-600', family: 'kitchen-wall', name: '600 Tinted Profile-Glass Wall Cabinet', roomTypes: ['kitchen', 'dining'], widthMm: 600, depthMm: 350, heightMm: 720, minClearanceMm: 900, sku: 'ULT-KW-PGL-600', materialSlots: ['carcass', 'glass', 'hardware', 'lighting'], tags: ['kitchen', 'wall-unit', 'profile-glass', 'fluted-glass', 'led-channel'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Graphite anodized aluminium profile doors with tinted fluted glass and vertical concealed 3000K LED.' },
  { id: 'kit-wall-bifold-900', family: 'kitchen-wall', name: '900 Bi-Fold Lift-Up Aventos Wall Unit', roomTypes: ['kitchen'], widthMm: 900, depthMm: 350, heightMm: 720, minClearanceMm: 900, sku: 'ULT-KW-AVT-900', materialSlots: ['carcass', 'shutter', 'hardware', 'lighting'], tags: ['kitchen', 'wall-unit', 'aventos', 'bi-fold', 'lift-up'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Bi-fold upward opening mechanism (Blum Aventos HF) with stay-lift hinges and integrated task-light channel.' },

  // ─── KITCHEN TALL MODULES (Standard 600mm Depth, 2100mm / 2400mm Height) ───
  { id: 'kit-tall-microwave-600', family: 'kitchen-tall', name: '600 Built-in Microwave & Oven Tower', roomTypes: ['kitchen'], widthMm: 600, depthMm: 600, heightMm: 2100, minClearanceMm: 900, sku: 'ULT-KT-MW-600', materialSlots: ['carcass', 'shutter', 'hardware'], tags: ['kitchen', 'tall-unit', 'microwave', 'oven', 'appliance'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Full-height appliance tower with dual appliance niche (microwave + oven), heat ventilation gap, and top/bottom storage.' },
  { id: 'kit-tall-pantry-600', family: 'kitchen-tall', name: '600 12-Basket Pantry Pull-Out Tower', roomTypes: ['kitchen', 'utility'], widthMm: 600, depthMm: 600, heightMm: 2100, minClearanceMm: 900, sku: 'ULT-KT-PN-600', materialSlots: ['carcass', 'shutter', 'hardware'], tags: ['kitchen', 'tall-unit', 'pantry', 'pullout', 'chrome-baskets'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Full-height pantry tower equipped with 12 chrome wire baskets on heavy-duty synchronized soft-close runners.' },
  { id: 'kit-tall-fridge-900', family: 'kitchen-tall', name: '900 Integrated Refrigerator Surround', roomTypes: ['kitchen'], widthMm: 900, depthMm: 650, heightMm: 2100, minClearanceMm: 900, sku: 'ULT-KT-FRG-900', materialSlots: ['carcass', 'shutter', 'hardware'], tags: ['kitchen', 'tall-unit', 'refrigerator', 'loft'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Heavy-duty carcass surround for standard double-door refrigerator with top deep loft storage.' },

  // ─── DESIGN FEATURE WALL PANELS (Full Height 2700mm) ───
  { id: 'wall-fluted-pu-2400', family: 'feature-wall', name: '2400 Fluted Charcoal PU Feature Wall', roomTypes: ['living', 'bedroom'], widthMm: 2400, depthMm: 50, heightMm: 2700, minClearanceMm: 900, sku: 'ULT-WL-FLT-2400', materialSlots: ['back-panel', 'lighting'], tags: ['feature-wall', 'fluted-pu', 'living', 'charcoal', 'panelling'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Full-height 2400mm fluted PU wall cladding panel with warm ambient perimeter backlighting channels.' },
  { id: 'wall-slat-acoustic-2400', family: 'feature-wall', name: '2400 Vertical Walnut Acoustic Slat Wall', roomTypes: ['living', 'bedroom', 'study'], widthMm: 2400, depthMm: 50, heightMm: 2700, minClearanceMm: 900, sku: 'ULT-WL-SLT-2400', materialSlots: ['back-panel', 'lighting'], tags: ['feature-wall', 'acoustic-slat', 'walnut', 'sound-absorbing'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Precision CNC walnut acoustic slat paneling over black acoustic felt backing for luxury sound dampening.' },
  { id: 'wall-wainscot-french-3000', family: 'feature-wall', name: '3000 French Classical Moulding & Wainscoting', roomTypes: ['living', 'dining', 'bedroom'], widthMm: 3000, depthMm: 40, heightMm: 2700, minClearanceMm: 900, sku: 'ULT-WL-WNS-3000', materialSlots: ['back-panel', 'shutter'], tags: ['feature-wall', 'wainscoting', 'french-classical', 'moulding'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Classical Parisian wall panelling with double-layered HDHMR boiserie mouldings and satin PU finish.' },
  { id: 'wall-sintered-calacatta-2400', family: 'feature-wall', name: '2400 Calacatta Sintered Stone Feature Wall', roomTypes: ['living', 'dining'], widthMm: 2400, depthMm: 30, heightMm: 2700, minClearanceMm: 900, sku: 'ULT-WL-STN-2400', materialSlots: ['countertop', 'lighting'], tags: ['feature-wall', 'sintered-stone', 'calacatta', 'bookmatched'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Bookmatched 6mm Calacatta Gold sintered porcelain slab panelling with concealed structural Z-brackets.' },

  // ─── WARDROBES & CLOSETS (Standard 600mm Depth, 2400mm / 2700mm Height) ───
  { id: 'wardrobe-2100-four-shutter', family: 'wardrobe', name: '2100 Four-Shutter Wardrobe with Loft', roomTypes: ['bedroom'], widthMm: 2100, depthMm: 600, heightMm: 2700, minClearanceMm: 900, sku: 'ULT-WD-4S-2100', materialSlots: ['carcass', 'shutter', 'hardware'], tags: ['wardrobe', 'four-shutter', 'loft', 'long-handles'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Master bedroom four-shutter wardrobe with separate full-width lofts and vertical profile handles.' },
  { id: 'wardrobe-1800-profile-bay', family: 'wardrobe', name: '1800 Wardrobe with Profile-Glass Bay', roomTypes: ['bedroom'], widthMm: 1800, depthMm: 600, heightMm: 2700, minClearanceMm: 900, sku: 'ULT-WD-PG-1800', materialSlots: ['carcass', 'shutter', 'glass', 'hardware', 'lighting'], tags: ['wardrobe', 'profile-glass', 'loft', 'display'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Full-height wardrobe with one dedicated profile-glass illuminated display bay and closed loft modules.' },
  { id: 'wardrobe-walkin-glass-3000', family: 'wardrobe', name: '3000 Profile-Glass Walk-In Closet', roomTypes: ['bedroom'], widthMm: 3000, depthMm: 600, heightMm: 2700, minClearanceMm: 950, sku: 'ULT-WD-WIK-3000', materialSlots: ['carcass', 'shutter', 'glass', 'hardware', 'lighting'], tags: ['wardrobe', 'walk-in', 'profile-glass', 'tinted-glass', 'sensor-lighting'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Luxury full-height walk-in wardrobe with anodized black aluminium profile doors, tinted fluted glass, and vertical sensor illumination.' },
  { id: 'wardrobe-6-shutter-vanity-3200', family: 'wardrobe', name: '3200 6-Shutter Wardrobe with Integrated Vanity', roomTypes: ['bedroom'], widthMm: 3200, depthMm: 600, heightMm: 2700, minClearanceMm: 950, sku: 'ULT-WD-6S-3200', materialSlots: ['carcass', 'shutter', 'hardware', 'lighting', 'countertop'], tags: ['wardrobe', 'six-shutter', 'vanity-niche', 'loft', 'led-mirror'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Master suite wardrobe featuring equal shutters, full-height lofts, and an integrated backlit vanity dressing alcove.' },

  // ─── TV & MEDIA UNITS (Standard 400mm Depth, 2400mm Height) ───
  { id: 'tv-fluted-2400', family: 'tv-unit', name: '2400 Fluted Media Wall with Floating Console', roomTypes: ['living'], widthMm: 2400, depthMm: 400, heightMm: 2400, minClearanceMm: 900, sku: 'ULT-TV-FLT-2400', materialSlots: ['carcass', 'shutter', 'back-panel', 'hardware', 'lighting'], tags: ['tv-wall', 'fluted-panel', 'floating-base', 'warm-light'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: '2400mm feature TV wall with vertical fluted panelling, cable channel cavity, and dual-drawer floating console.' },
  { id: 'tv-profile-2400', family: 'tv-unit', name: '2400 TV Wall with Profile Glass Display', roomTypes: ['living'], widthMm: 2400, depthMm: 400, heightMm: 2400, minClearanceMm: 900, sku: 'ULT-TV-PROFILE-2400', materialSlots: ['carcass', 'shutter', 'back-panel', 'glass', 'hardware', 'lighting'], tags: ['tv-wall', 'profile-glass', 'floating-base', 'lighting'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'TV composition with one vertical profile-glass display bay, floating console, and warm LED strip integration.' },
  { id: 'tv-acoustic-slat-2400', family: 'tv-unit', name: '2400 Acoustic Slat Floating TV Wall', roomTypes: ['living'], widthMm: 2400, depthMm: 400, heightMm: 2400, minClearanceMm: 900, sku: 'ULT-TV-SLAT-2400', materialSlots: ['carcass', 'shutter', 'back-panel', 'lighting', 'hardware'], tags: ['tv-wall', 'acoustic-slat', 'soundbar-niche', 'floating-console'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Modern TV wall with vertical walnut acoustic slat panelling, recessed soundbar niche, and floating dual-drawer console.' },

  // ─── CROCKERY & DINING BARS (Standard 450mm Depth, 2400mm Height) ───
  { id: 'crockery-1800', family: 'crockery', name: '1800 Full-Wall Crockery & Wine Bar', roomTypes: ['dining', 'living'], widthMm: 1800, depthMm: 450, heightMm: 2400, minClearanceMm: 900, sku: 'ULT-CR-1800', materialSlots: ['carcass', 'shutter', 'glass', 'hardware', 'lighting', 'countertop'], tags: ['crockery', 'full-wall', 'bar', 'fluted-glass', 'warm-light'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Full-height dining wall with closed overhead storage, display glass, counter niche, and lower drawers.' },
  { id: 'crockery-sideboard-1600', family: 'crockery', name: '1600 Dining Sideboard and Display', roomTypes: ['dining', 'living'], widthMm: 1600, depthMm: 450, heightMm: 2100, minClearanceMm: 900, sku: 'ULT-CR-SIDE-1600', materialSlots: ['carcass', 'shutter', 'glass', 'hardware', 'lighting', 'countertop'], tags: ['crockery', 'sideboard', 'display', 'fluted-glass'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Dining sideboard with a counter niche, upper fluted-glass shutters, and closed base storage.' },

  // ─── BEDS & NIGHTSTANDS (Standard 2100mm Depth, 1100mm Height) ───
  { id: 'bed-floating-led-1800', family: 'bed', name: '1800 Floating King Bed with Underglow LED', roomTypes: ['bedroom'], widthMm: 1800, depthMm: 2100, heightMm: 1100, minClearanceMm: 800, sku: 'ULT-BD-FLT-1800', materialSlots: ['carcass', 'fabric', 'back-panel', 'lighting', 'hardware'], tags: ['bedroom', 'king-bed', 'floating', 'concealed-led', 'fluted-headboard'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Wall-anchored floating king bed with recessed plinth, under-glow warm 3000K LED, and full-width fluted acoustic headboard.' },
  { id: 'bed-japandi-platform-1800', family: 'bed', name: '1800 Japandi Low-Platform Bed', roomTypes: ['bedroom'], widthMm: 1800, depthMm: 2150, heightMm: 750, minClearanceMm: 750, sku: 'ULT-BD-JPN-1800', materialSlots: ['carcass', 'back-panel'], tags: ['bedroom', 'japandi', 'low-platform', 'white-oak'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Minimalist low-platform bed in natural White Oak with extended side ledges for bedside essentials.' },
  { id: 'bed-1800', family: 'bed', name: '1800 Hydraulic Storage Bed', roomTypes: ['bedroom'], widthMm: 1800, depthMm: 2100, heightMm: 450, minClearanceMm: 750, sku: 'ULT-BD-1800', materialSlots: ['carcass', 'shutter', 'hardware', 'fabric'], tags: ['bedroom', 'storage-bed', 'hydraulic'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Heavy-duty king hydraulic lift storage bed with internal compartment partitions.' },

  // ─── SACRED MANDIRS & POOJA UNITS (Standard 400mm / 450mm Depth) ───
  { id: 'pooja-1200-jaali', family: 'pooja', name: '1200 Pooja Mandir with CNC Jaali Shutters', roomTypes: ['pooja', 'living'], widthMm: 1200, depthMm: 400, heightMm: 2100, minClearanceMm: 750, sku: 'ULT-PJ-JL-1200', materialSlots: ['carcass', 'shutter', 'back-panel', 'hardware', 'lighting'], tags: ['pooja', 'jaali', 'fluted-glass', 'tray'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'A full-height pooja composition with one main tray, lower storage, and a CNC jaali zone.' },
  { id: 'pooja-mandir-mandapa-1500', family: 'pooja', name: '1500 Sacred Teak Mandir with CNC Backlit Jaali', roomTypes: ['pooja', 'living'], widthMm: 1500, depthMm: 450, heightMm: 2300, minClearanceMm: 800, sku: 'ULT-PJ-MDP-1500', materialSlots: ['carcass', 'shutter', 'back-panel', 'metal', 'lighting'], tags: ['pooja', 'mandir', 'cnc-jaali', 'brass-bells', 'bhog-tray'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Grand pooja mandapa with illuminated CNC marble jaali backdrop, brass bell insets, heavy-duty pull-out bhog tray, and deep storage drawers.' },

  // ─── STUDY & HOME OFFICE (Standard 600mm / 350mm Depth) ───
  { id: 'study-1500', family: 'study', name: '1500 Study Desk with Overhead Storage', roomTypes: ['study', 'bedroom'], widthMm: 1500, depthMm: 600, heightMm: 2400, minClearanceMm: 900, sku: 'ULT-ST-1500', materialSlots: ['carcass', 'shutter', 'back-panel', 'hardware', 'lighting'], tags: ['study', 'desk', 'overhead-storage'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Ergonomic study desk with cable grommet, soft-close drawer pedestal, and overhead book storage.' },
  { id: 'study-1200', family: 'study', name: '1200 Compact Floating Study Desk', roomTypes: ['study', 'bedroom'], widthMm: 1200, depthMm: 350, heightMm: 2100, minClearanceMm: 750, sku: 'ULT-ST-1200', materialSlots: ['carcass', 'shutter', 'back-panel', 'hardware', 'lighting'], tags: ['study', 'desk', 'open-shelf', 'whiteboard'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Compact floating desk with marker-safe whiteboard back panel and top display shelf.' },

  // ─── LOUNGE & DINING FURNITURE ───
  { id: 'sofa-curved-boucle-2800', family: 'sofa', name: '2800 Curved Bouclé Sectional Sofa', roomTypes: ['living'], widthMm: 2800, depthMm: 1600, heightMm: 800, minClearanceMm: 900, sku: 'ULT-SF-CRV-2800', materialSlots: ['fabric', 'metal'], tags: ['living', 'sectional', 'curved', 'boucle', 'luxury'], production: { panelBased: false, hardwareSchedule: false, cutlistSupported: false }, description: 'Sculptural curved sectional in premium off-white bouclé fabric with soft organic contours.' },
  { id: 'dining-calacatta-gold-2100', family: 'dining', name: '2100 Calacatta Gold Marble Dining Table', roomTypes: ['dining', 'living'], widthMm: 2100, depthMm: 1000, heightMm: 750, minClearanceMm: 950, sku: 'ULT-DN-CAL-2100', materialSlots: ['countertop', 'metal'], tags: ['dining', 'eight-seat', 'calacatta-marble', 'fluted-pedestal'], production: { panelBased: false, hardwareSchedule: false, cutlistSupported: false }, description: 'Bookmatched Calacatta Gold marble slab with bevelled edges on dual fluted cylindrical pedestals.' },

  // ─── UTILITY & FOYER ───
  { id: 'utility-laundry-1500', family: 'utility', name: '1500 Laundry & Utility Wall', roomTypes: ['utility', 'kitchen'], widthMm: 1500, depthMm: 650, heightMm: 2400, minClearanceMm: 1000, sku: 'ULT-UT-LN-1500', materialSlots: ['carcass', 'shutter', 'countertop', 'hardware'], tags: ['utility', 'laundry', 'washing-machine', 'tall-storage'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'A service-aware utility wall with washer void, counter, tall storage, and closed lofts.' },
  { id: 'foyer-console-1200', family: 'storage', name: '1200 Floating Foyer Console & Shoe Bench', roomTypes: ['foyer', 'living'], widthMm: 1200, depthMm: 350, heightMm: 2100, minClearanceMm: 800, sku: 'ULT-FY-1200', materialSlots: ['carcass', 'shutter', 'hardware', 'lighting'], tags: ['foyer', 'floating-console', 'drawer', 'key-drop', 'shoe-rack'], production: { panelBased: true, hardwareSchedule: true, cutlistSupported: true }, description: 'Entry foyer storage with soft-close drawers, shoe storage, key niche, and ambient LED lighting.' }
];

export function listCatalog(roomType?: z.infer<typeof RoomTypeSchema>, query?: string) {
  const normalized = query?.trim().toLowerCase();
  return IndianModularCatalog.filter((item) => {
    if (roomType) {
      const matchRoom = (roomType === 'master_bedroom' || roomType === 'kids_bedroom')
        ? (item.roomTypes.includes('bedroom') || item.roomTypes.includes(roomType))
        : item.roomTypes.includes(roomType);
      if (!matchRoom) return false;
    }
    return !normalized || `${item.name} ${item.tags.join(' ')}`.toLowerCase().includes(normalized);
  });
}

const FAMILY_ELEMENTS: Record<z.infer<typeof ModuleFamilySchema>, z.input<typeof ModuleElementSchema>[]> = {
  'kitchen-base': [
    { kind: 'carcass', label: '18mm base carcass', materialSlot: 'carcass', productionRole: 'assembly', notes: ['Include serviceable back clearance.'] },
    { kind: 'shutter', label: 'Base shutters', materialSlot: 'shutter', productionRole: 'cutlist', notes: ['Keep reveal consistent.'] },
    { kind: 'drawer', label: 'Configured drawers', materialSlot: 'shutter', productionRole: 'cutlist', notes: [] },
    { kind: 'plinth_skirting', label: '110mm plinth/skirting', materialSlot: 'carcass', productionRole: 'cutlist', notes: [] },
    { kind: 'countertop', label: 'Countertop slab', materialSlot: 'countertop', productionRole: 'cutlist', notes: ['Thickness must come from project requirements, never a visual estimate.'] },
    { kind: 'service_void', label: 'Plumbing and appliance service void', productionRole: 'service', notes: ['Verify on site before fabrication.'] },
  ],
  'kitchen-wall': [
    { kind: 'carcass', label: '18mm wall carcass', materialSlot: 'carcass', productionRole: 'assembly', notes: [] },
    { kind: 'shutter', label: 'Wall shutters', materialSlot: 'shutter', productionRole: 'cutlist', notes: [] },
    { kind: 'shelf', label: 'Adjustable shelves', materialSlot: 'carcass', productionRole: 'cutlist', notes: [] },
    { kind: 'lighting_anchor', label: 'Under-cabinet light anchor', materialSlot: 'lighting', productionRole: 'accessory', notes: ['Only where specified.'] },
  ],
  'kitchen-tall': [{ kind: 'carcass', label: 'Tall carcass', materialSlot: 'carcass', productionRole: 'assembly', notes: [] }, { kind: 'shutter', label: 'Tall shutters', materialSlot: 'shutter', productionRole: 'cutlist', notes: [] }, { kind: 'appliance_void', label: 'Appliance void', productionRole: 'service', notes: ['Use approved appliance dimensions.'] }],
  'kitchen-corner': [{ kind: 'carcass', label: 'Corner carcass', materialSlot: 'carcass', productionRole: 'assembly', notes: ['Reserve filler before adjacent shutters.'] }, { kind: 'shutter', label: 'Corner shutter', materialSlot: 'shutter', productionRole: 'cutlist', notes: [] }, { kind: 'dummy_filler', label: 'Corner filler', materialSlot: 'carcass', productionRole: 'cutlist', notes: ['Required to prevent handle collision.'] }],
  wardrobe: [{ kind: 'carcass', label: '18mm wardrobe carcass', materialSlot: 'carcass', productionRole: 'assembly', notes: ['Typical depth is 560mm carcass plus 20mm back when approved.'] }, { kind: 'shutter', label: 'Equal wardrobe shutters', materialSlot: 'shutter', productionRole: 'cutlist', notes: [] }, { kind: 'loft', label: 'Loft shutters', materialSlot: 'shutter', productionRole: 'cutlist', notes: [] }, { kind: 'shelf', label: 'Adjustable shelves', materialSlot: 'carcass', productionRole: 'cutlist', notes: [] }, { kind: 'drawer', label: 'Drawer stack', materialSlot: 'shutter', productionRole: 'cutlist', notes: [] }, { kind: 'dummy_filler', label: 'Dummy/filler', materialSlot: 'carcass', productionRole: 'cutlist', notes: ['Use only where the approved design specifies it.'] }, { kind: 'hardware', label: 'Handles and sliding hardware', materialSlot: 'hardware', productionRole: 'accessory', notes: [] }],
  'tv-unit': [{ kind: 'back_panel', label: 'TV back panel', materialSlot: 'back-panel', productionRole: 'cutlist', notes: ['Preserve exact approved TV and cable positions.'] }, { kind: 'carcass', label: 'Base carcass', materialSlot: 'carcass', productionRole: 'assembly', notes: [] }, { kind: 'shutter', label: 'Base shutters', materialSlot: 'shutter', productionRole: 'cutlist', notes: [] }, { kind: 'profile_glass', label: 'Aluminium profile glass display', materialSlot: 'glass', productionRole: 'cutlist', notes: ['Add internal lighting only when specified.'] }, { kind: 'lighting_anchor', label: 'Display/profile light anchor', materialSlot: 'lighting', productionRole: 'accessory', notes: [] }],
  crockery: [{ kind: 'carcass', label: 'Display carcass', materialSlot: 'carcass', productionRole: 'assembly', notes: [] }, { kind: 'profile_glass', label: 'Glass display shutters', materialSlot: 'glass', productionRole: 'cutlist', notes: [] }, { kind: 'shelf', label: 'Glass shelves', materialSlot: 'glass', productionRole: 'cutlist', notes: [] }, { kind: 'lighting_anchor', label: 'Shelf light anchors', materialSlot: 'lighting', productionRole: 'accessory', notes: [] }],
  study: [{ kind: 'carcass', label: 'Study carcass', materialSlot: 'carcass', productionRole: 'assembly', notes: [] }, { kind: 'back_panel', label: 'Marker-safe back panel', materialSlot: 'back-panel', productionRole: 'cutlist', notes: ['Use a verified whiteboard-compatible finish.'] }, { kind: 'shelf', label: 'Open shelves', materialSlot: 'carcass', productionRole: 'cutlist', notes: [] }, { kind: 'drawer', label: 'Optional drawers', materialSlot: 'shutter', productionRole: 'cutlist', notes: ['Omit when the brief says drawer-free.'] }],
  pooja: [{ kind: 'carcass', label: 'Pooja carcass', materialSlot: 'carcass', productionRole: 'assembly', notes: [] }, { kind: 'drawer', label: 'Two drawers below tray', materialSlot: 'shutter', productionRole: 'cutlist', notes: [] }, { kind: 'shelf', label: 'Single pooja tray', materialSlot: 'carcass', productionRole: 'cutlist', notes: ['Do not split into two trays.'] }, { kind: 'shutter', label: 'Main shutters', materialSlot: 'shutter', productionRole: 'cutlist', notes: [] }, { kind: 'profile_glass', label: 'Fluted glass shutter', materialSlot: 'glass', productionRole: 'cutlist', notes: [] }, { kind: 'cnc_panel', label: 'Jaali/CNC panel', productionRole: 'cutlist', notes: ['Release only after vector preflight.'] }, { kind: 'lighting_anchor', label: 'Concealed warm light anchor', materialSlot: 'lighting', productionRole: 'accessory', notes: [] }],
  utility: [{ kind: 'carcass', label: 'Utility carcass', materialSlot: 'carcass', productionRole: 'assembly', notes: [] }, { kind: 'shutter', label: 'Utility shutters', materialSlot: 'shutter', productionRole: 'cutlist', notes: [] }, { kind: 'service_void', label: 'Plumbing/service void', productionRole: 'service', notes: [] }],
  sofa: [{ kind: 'carcass', label: 'Sofa frame', materialSlot: 'carcass', productionRole: 'assembly', notes: [] }, { kind: 'hardware', label: 'Sofa hardware', materialSlot: 'hardware', productionRole: 'accessory', notes: [] }],
  bed: [{ kind: 'carcass', label: 'Bed side/head/foot rails', materialSlot: 'carcass', productionRole: 'cutlist', notes: ['Generate individual sheet panels; never one solid bed box.'] }, { kind: 'shelf', label: 'Storage deck panels', materialSlot: 'carcass', productionRole: 'cutlist', notes: ['Split the hydraulic deck into liftable panels.'] }, { kind: 'back_panel', label: 'Headboard panels', materialSlot: 'fabric', productionRole: 'cutlist', notes: ['Keep upholstered or laminate finish separate from carcass.'] }, { kind: 'hardware', label: 'Hydraulic lift pair', materialSlot: 'hardware', productionRole: 'accessory', notes: ['Verify load rating against mattress and deck weight.'] }],
  dining: [{ kind: 'carcass', label: 'Dining frame', productionRole: 'assembly', notes: [] }],
  'false-ceiling': [{ kind: 'lighting_anchor', label: 'False-ceiling light anchor', materialSlot: 'lighting', productionRole: 'accessory', notes: [] }],
  storage: [{ kind: 'carcass', label: 'Storage carcass', materialSlot: 'carcass', productionRole: 'assembly', notes: [] }, { kind: 'shutter', label: 'Storage shutters', materialSlot: 'shutter', productionRole: 'cutlist', notes: [] }, { kind: 'shelf', label: 'Storage shelves', materialSlot: 'carcass', productionRole: 'cutlist', notes: [] }],
  'feature-wall': [{ kind: 'back_panel', label: 'Feature wall cladding panel', materialSlot: 'back-panel', productionRole: 'cutlist', notes: ['Precision CNC machined or fluted panels.'] }, { kind: 'lighting_anchor', label: 'Perimeter accent lighting channel', materialSlot: 'lighting', productionRole: 'accessory', notes: ['Concealed 3000K warm LED.'] }],
};

export function moduleElementsFor(module: CatalogModule): ModuleElement[] {
  return module.elements?.map((element) => ModuleElementSchema.parse(element)) ?? FAMILY_ELEMENTS[module.family].map((element) => ModuleElementSchema.parse(element));
}

export function moduleConstraintsFor(module: CatalogModule): ModuleConstraint[] {
  return module.constraints?.map((constraint) => ModuleConstraintSchema.parse(constraint)) ?? [
    { kind: 'wall_anchored', label: 'Anchor to a valid wall or room placement', required: true },
    { kind: 'circulation', label: `Maintain at least ${module.minClearanceMm}mm clear circulation`, valueMm: module.minClearanceMm, required: true },
  ];
}

export function getCatalogVault() {
  return {
    version: 'modular-vault.v1',
    sourceOfTruth: 'Approved plan, layout, scene.v1, and production contracts; references are advisory.',
    families: ModuleFamilySchema.options.map((family) => ({ family, modules: IndianModularCatalog.filter((module) => module.family === family).map((module) => module.id) })),
    elementKinds: ModuleElementKindSchema.options,
    constraints: ['wall_anchored', 'opening_clearance', 'service_clearance', 'circulation', 'adjacency', 'stacking'],
    modules: IndianModularCatalog.map((module) => ({ ...module, elements: moduleElementsFor(module), constraints: moduleConstraintsFor(module) })),
    presets: IndianModularDesignPresets,
  };
}

export function validatePlacement(module: CatalogModule, roomType: z.infer<typeof RoomTypeSchema>, clearanceMm: number) {
  const issues: string[] = [];
  if (!module.roomTypes.includes(roomType)) issues.push(`${module.name} is not catalogued for ${roomType}.`);
  if (clearanceMm < module.minClearanceMm) issues.push(`${module.name} needs at least ${module.minClearanceMm} mm clear circulation.`);
  return { valid: issues.length === 0, issues };
}
