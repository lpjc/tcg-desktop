import Phaser from 'phaser';
import { catalog, type CatalogItem } from './catalog';

/**
 * Preload all catalogued sprites. Paths must be URL-encoded: Sierra pack files are
 * named `Slice N.png` (spaces). Without `encodeURI`, loads can fail silently in
 * some environments. A failed load is a separate issue from the camera-off-world
 * blank canvas — see `CameraDirector.ts` and ARCHITECTURE §6.1.
 */
export function preloadCatalogAssets(scene: Phaser.Scene): void {
  for (const item of catalog.items) {
    scene.load.image(item.id, encodeURI(`/${item.file}`));
  }
}

export function textureKeyForItem(item: CatalogItem): string {
  return item.id;
}
