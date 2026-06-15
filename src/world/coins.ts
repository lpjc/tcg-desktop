import Phaser from 'phaser';

/** Spinning coin frames under `assets/coin-sprites/` (12×12 source art). */
const COIN_FRAME_COUNT = 14;
const COIN_ANIM = 'coin-spin';
const COIN_SIZE = 10;

export function coinTextureKey(frame: number): string {
  return `coin-${frame}`;
}

export function preloadCoins(scene: Phaser.Scene): void {
  for (let frame = 1; frame <= COIN_FRAME_COUNT; frame++) {
    scene.load.image(coinTextureKey(frame), encodeURI(`/coin-sprites/sprite-1-${frame}.png`));
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

export function spawnCoinBurst(scene: Phaser.Scene, x: number, y: number, count: number): void {
  registerCoinAnim(scene);
  for (let i = 0; i < count; i++) {
    const coin = scene.add
      .sprite(x + Phaser.Math.Between(-8, 8), y - 6, coinTextureKey(1))
      .setOrigin(0.5, 0.5)
      .setDisplaySize(COIN_SIZE, COIN_SIZE)
      .setDepth(99998);
    coin.play(COIN_ANIM);
    scene.tweens.add({
      targets: coin,
      y: coin.y - Phaser.Math.Between(18, 32),
      x: coin.x + Phaser.Math.Between(-8, 8),
      alpha: { from: 1, to: 0 },
      delay: Phaser.Math.Between(200, 500),
      duration: Phaser.Math.Between(900, 1400),
      ease: 'Quad.easeOut',
      onComplete: () => coin.destroy(),
    });
  }
}
