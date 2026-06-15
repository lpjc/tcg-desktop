import Phaser from 'phaser';

/** Spinning coin frames under `assets/coin-sprites/` (12×12 source art). */
const COIN_FRAME_COUNT = 14;

/** Asset URL for one coin frame — the single source of truth for the coin path. */
export function coinSpriteUrl(frame: number): string {
  return encodeURI(`/coin-sprites/sprite-1-${frame}.png`);
}

export function coinTextureKey(frame: number): string {
  return `coin-${frame}`;
}

export function preloadCoins(scene: Phaser.Scene): void {
  for (let frame = 1; frame <= COIN_FRAME_COUNT; frame++) {
    scene.load.image(coinTextureKey(frame), coinSpriteUrl(frame));
  }
}
