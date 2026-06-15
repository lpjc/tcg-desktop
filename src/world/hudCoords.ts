import Phaser from 'phaser';
import type { FlyPoint } from '../ui/flyFx';

/**
 * Convert a world-space point on the Phaser band to viewport pixels, so DOM HUD
 * flies (coins to the money pill, a sold card onto a buyer) can target it.
 *
 * The canvas fills the window at the origin, so screen = (world - cameraView) ×
 * zoom. We read `cam.worldView` (which already accounts for scroll + zoom)
 * rather than raw scroll, per the camera notes in ARCHITECTURE §6.1.
 */
export function worldToScreen(scene: Phaser.Scene, worldX: number, worldY: number): FlyPoint {
  const cam = scene.cameras.main;
  const view = cam.worldView;
  return { x: (worldX - view.x) * cam.zoom, y: (worldY - view.y) * cam.zoom };
}

/**
 * Inverse of `worldToScreen`: viewport pixels back to a world-space point. Used
 * to launch a world-rendered sale card from a DOM HUD token (the stock bar) so
 * it can depth-sort against world sprites mid-flight.
 */
export function screenToWorld(scene: Phaser.Scene, screenX: number, screenY: number): { x: number; y: number } {
  const cam = scene.cameras.main;
  const view = cam.worldView;
  return { x: screenX / cam.zoom + view.x, y: screenY / cam.zoom + view.y };
}
