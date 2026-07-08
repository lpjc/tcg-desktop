import Phaser from 'phaser';
import { assetUrl } from '../assets/assetUrl';

/** Spinning coin frames under `assets/coin-sprites/` (12×12 source art). */
const COIN_FRAME_COUNT = 14;
const COIN_ANIM = 'coin-spin';

/** Asset URL for one coin frame — the single source of truth for the coin path. */
export function coinSpriteUrl(frame: number): string {
  return assetUrl(`coin-sprites/sprite-1-${frame}.png`);
}

export function coinTextureKey(frame: number): string {
  return `coin-${frame}`;
}

export function preloadCoins(scene: Phaser.Scene): void {
  for (let frame = 1; frame <= COIN_FRAME_COUNT; frame++) {
    scene.load.image(coinTextureKey(frame), coinSpriteUrl(frame));
  }
}

export function registerCoinAnim(scene: Phaser.Scene): void {
  if (scene.anims.exists(COIN_ANIM)) return;
  scene.anims.create({
    key: COIN_ANIM,
    frames: Array.from({ length: COIN_FRAME_COUNT }, (_, index) => ({
      key: coinTextureKey(index + 1),
    })),
    frameRate: 14,
    repeat: -1,
  });
}
