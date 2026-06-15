import Phaser from 'phaser';
import type { FlyPoint } from '../ui/flyFx';

/** Convert a world-space point on the Phaser band to viewport pixels. */
export function worldToScreen(scene: Phaser.Scene, worldX: number, worldY: number): FlyPoint {
  const cam = scene.cameras.main;
  const out = new Phaser.Math.Vector2();
  cam.getScreenPoint(worldX, worldY, out);
  return { x: out.x, y: out.y };
}

/** Screen point where coins should leave a buyer's hands. */
export function buyerCoinOrigin(scene: Phaser.Scene, worldX: number, worldY: number): FlyPoint {
  return worldToScreen(scene, worldX, worldY - 18);
}

/** Screen point where a sold card should land on the buyer. */
export function buyerCardTarget(scene: Phaser.Scene, worldX: number, worldY: number): FlyPoint {
  return worldToScreen(scene, worldX, worldY - 12);
}
