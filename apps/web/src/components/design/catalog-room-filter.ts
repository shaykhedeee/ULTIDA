export type RoomCatalogItem = {
  family: string;
  roomTypes?: string[];
};

const bedroomVariants = new Set(['master_bedroom', 'kids_bedroom']);
const roomFamilyAllowlist: Record<string, Set<string>> = {
  kitchen: new Set(['kitchen-base', 'kitchen-wall', 'kitchen-tall', 'kitchen-corner', 'lighting', 'utility']),
  living: new Set(['tv-unit', 'crockery', 'sofa', 'pooja', 'storage', 'lighting', 'freestanding-lighting', 'feature-wall', 'rug', 'study', 'dining']),
  dining: new Set(['dining', 'crockery', 'lighting', 'freestanding-lighting', 'feature-wall', 'rug']),
  bedroom: new Set(['bed', 'wardrobe', 'tv-unit', 'study', 'storage', 'lighting', 'freestanding-lighting', 'feature-wall', 'rug']),
  study: new Set(['study', 'storage', 'lighting', 'freestanding-lighting', 'feature-wall', 'rug']),
  pooja: new Set(['pooja', 'storage', 'lighting', 'freestanding-lighting']),
  foyer: new Set(['storage', 'lighting', 'freestanding-lighting', 'feature-wall', 'rug', 'utility']),
  utility: new Set(['utility', 'storage', 'kitchen-base', 'lighting']),
  balcony: new Set(['storage', 'lighting', 'freestanding-lighting']),
};

export function catalogItemSupportsRoom(item: RoomCatalogItem, roomType: string): boolean {
  if (!Array.isArray(item.roomTypes) || item.roomTypes.length === 0) return false;
  if (roomType === 'other') return true;
  const allowedFamilies = roomFamilyAllowlist[roomType];
  if (allowedFamilies && !allowedFamilies.has(item.family)) return false;
  return item.roomTypes.includes(roomType)
    || (bedroomVariants.has(roomType) && item.roomTypes.includes('bedroom'));
}

export function catalogForRoom<T extends RoomCatalogItem>(items: T[], roomType: string): T[] {
  return items.filter((item) => catalogItemSupportsRoom(item, roomType));
}
