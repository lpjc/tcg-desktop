import Phaser from 'phaser';
import { spawnCoinBurst } from './coins';

/**
 * Legacy booth payout burst at a world position. Prefer `playBoothCollect` in
 * purchaseFx.ts for the table-pile → money-pill flow.
 */
export function playBoothPayout(
  scene: Phaser.Scene,
  x: number,
  y: number,
  sales: number,
): void {
  const coinCount = Phaser.Math.Clamp(sales, 3, 8);
  spawnCoinBurst(scene, x, y, coinCount);
}
