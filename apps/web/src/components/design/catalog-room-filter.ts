export type RoomCatalogItem = {
  family: string;
  roomTypes?: string[];
};

const bedroomVariants = new Set(['master_bedroom', 'kids_bedroom']);
const roomFamilyAllowlist: Record<string, Set<string>> = {
  kitchen: new Set(['kitchen-base', 'kitchen-wall', 'kitchen-tall', 'kitchen-corner']),
  living: new Set(['tv-unit', 'crockery', 'sofa', 'pooja', 'storage', 'lighting']),
};

export function catalogItemSupportsRoom(item: RoomCatalogItem, roomType: string): boolean {
  if (!Array.isArray(item.roomTypes) || item.roomTypes.length === 0) return false;
  const allowedFamilies = roomFamilyAllowlist[roomType];
  if (allowedFamilies && !allowedFamilies.has(item.family)) return false;
  return item.roomTypes.includes(roomType)
    || (bedroomVariants.has(roomType) && item.roomTypes.includes('bedroom'));
}

export function catalogForRoom<T extends RoomCatalogItem>(items: T[], roomType: string): T[] {
  return items.filter((item) => catalogItemSupportsRoom(item, roomType));
}
