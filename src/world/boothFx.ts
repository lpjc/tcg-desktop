import Phaser from 'phaser';
import type { CashBox } from '../game/state/types';
import { spawnCoinBurst } from './coins';

/**
 * Booth collect payout: "+€X" (+ rep when any) and a coin burst where the player
 * stands.
 */
export function playBoothPayout(
  scene: Phaser.Scene,
  x: number,
  y: number,
  box: CashBox,
): void {
  const lines = [`+€${Math.round(box.money)}`];
  const rep = Math.round(box.reputation);
  if (rep >= 1) lines.push(`+${rep} Rep`);

  const text = scene.add
    .text(x, y - 30, lines.join('\n'), {
      fontFamily: 'VCR OSD Mono, monospace',
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
    y: text.y - 6,
    duration: 280,
    ease: 'Back.easeOut',
  });
  scene.tweens.add({
    targets: text,
    y: text.y - 20,
    alpha: 0,
    delay: 1100,
    duration: 900,
    ease: 'Quad.easeIn',
    onComplete: () => text.destroy(),
  });

  const coinCount = Phaser.Math.Clamp(box.sales, 3, 8);
  spawnCoinBurst(scene, x, y, coinCount);
}

/**
 * A single live sale made while the player mans the booth: a small "+€X"
 * (and "+Y Rep" when any) floats up and fades right where it sold.
 */
export function playLiveSale(
  scene: Phaser.Scene,
  x: number,
  y: number,
  price: number,
  reputation: number,
): void {
  const rep = Math.round(reputation);
  const label = rep >= 1 ? `+€${price}\n+${rep} Rep` : `+€${price}`;

  const text = scene.add
    .text(x + Phaser.Math.Between(-4, 4), y, label, {
      fontFamily: 'VCR OSD Mono, monospace',
      fontSize: '9px',
      color: '#ffe08a',
      align: 'center',
      stroke: '#3a2a10',
      strokeThickness: 3,
    })
    .setOrigin(0.5, 1)
    .setDepth(99999);

  scene.tweens.add({
    targets: text,
    y: text.y - 16,
    alpha: { from: 1, to: 0 },
    duration: 900,
    ease: 'Quad.easeOut',
    onComplete: () => text.destroy(),
  });
}
