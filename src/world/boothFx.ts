import Phaser from 'phaser';
import type { CashBox } from '../game/state/types';

/**
 * The satisfying booth payout: a rising "N sales! +€X +Y Rep" callout plus a
 * little burst of coins, played where the player stands when they collect.
 */
export function playBoothPayout(
  scene: Phaser.Scene,
  x: number,
  y: number,
  box: CashBox,
): void {
  const lines = [`${box.sales} sale${box.sales === 1 ? '' : 's'}!`, `+€${Math.round(box.money)}`];
  const rep = Math.round(box.reputation);
  if (rep >= 1) lines.push(`+${rep} Rep`);

  const text = scene.add
    .text(x, y - 30, lines.join('\n'), {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffe08a',
      align: 'center',
      stroke: '#3a2a10',
      strokeThickness: 3,
    })
    .setOrigin(0.5, 1)
    .setDepth(99999);

  scene.tweens.add({
    targets: text,
    y: text.y - 18,
    alpha: { from: 1, to: 0 },
    duration: 1400,
    ease: 'Quad.easeOut',
    onComplete: () => text.destroy(),
  });

  const coinCount = Phaser.Math.Clamp(box.sales, 3, 8);
  for (let i = 0; i < coinCount; i++) {
    const coin = scene.add
      .circle(x + Phaser.Math.Between(-8, 8), y - 6, 2.5, 0xffd34d)
      .setStrokeStyle(1, 0x9a6a10)
      .setDepth(99998);
    scene.tweens.add({
      targets: coin,
      y: coin.y - Phaser.Math.Between(14, 26),
      x: coin.x + Phaser.Math.Between(-6, 6),
      alpha: { from: 1, to: 0 },
      duration: Phaser.Math.Between(600, 1000),
      ease: 'Quad.easeOut',
      onComplete: () => coin.destroy(),
    });
  }
}
