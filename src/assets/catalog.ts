import catalogData from '../data/asset-catalog.json';

export interface CollisionBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CatalogItem {
  id: string;
  file: string;
  name: string;
  category: string;
  /** Display scale when source art is larger than the Sierra 16px grid (e.g. free pack). */
  scale?: number;
  width: number;
  height: number;
  footX: number;
  footY: number;
  collision: CollisionBox;
}

/** Apply catalog display scale (1:1 for Sierra assets). */
export function applyCatalogScale(image: { setScale: (scale: number) => void }, item: CatalogItem): void {
  image.setScale(item.scale ?? 1);
}

export interface AssetCatalog {
  version: number;
  floorTiles: {
    convention: string;
    road: string;
    shop: string;
  };
  items: CatalogItem[];
}

export const catalog = catalogData as AssetCatalog;

export function getCatalogItem(id: string): CatalogItem | undefined {
  return catalog.items.find((item) => item.id === id);
}

export function getFurnitureItems(): CatalogItem[] {
  return catalog.items.filter((item) => item.category === 'furniture');
}

export function getItemsByCategory(category: string): CatalogItem[] {
  return catalog.items.filter((item) => item.category === category);
}

export function getCategories(): string[] {
  return [...new Set(catalog.items.map((item) => item.category))];
}

export function getFloorTileId(zone: 'convention' | 'road' | 'shop'): string {
  return catalog.floorTiles[zone];
}
