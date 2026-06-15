import Phaser from 'phaser';
import { PILES, type PileId } from '../game/cards/piles';

/**
 * Speech-bubble emotes shown above a visitor when they buy, giving the player a
 * readable cue for *what* just sold. The mapping escalates with rarity, and any
 * holo collapses to the "cool" flex so a holo sale always reads at a glance.
 *
 * Source art is 42×42; drawn small (`EMOTE_SIZE`) above the character's head.
 */
export type EmoteKey = 'happy' | 'very-happy' | 'amazed' | 'happy-cry' | 'cool-shades';

const EMOTE_KEYS: readonly EmoteKey[] = [
  'happy',
  'very-happy',
  'amazed',
  'happy-cry',
  'cool-shades',
];

const EMOTE_SIZE = 13;
const EMOTE_DEPTH = 99995;

export function emoteTextureKey(key: EmoteKey): string {
  return `emote-${key}`;
}

export function preloadEmotes(scene: Phaser.Scene): void {
  for (const key of EMOTE_KEYS) {
    scene.load.image(emoteTextureKey(key), encodeURI(`/emote-sprites/${key}.png`));
  }
}

/** The emote that signals a sale from a given stock pile. */
export function emoteForPile(pile: PileId): EmoteKey {
  const meta = PILES[pile];
  if (meta.holo) return 'cool-shades';
  switch (meta.rarity) {
    case 'common':
      return 'happy';
    case 'rare':
      return 'very-happy';
    case 'epic':
      return 'amazed';
    case 'chase':
      return 'happy-cry';
  }
}

/** Pop a short-lived emote above (x, y): scale-in, drift up, fade out. */
export function showEmote(scene: Phaser.Scene, x: number, y: number, key: EmoteKey): void {
  void showEmoteHeld(scene, x, y, key, 850);
}

/**
 * Purchase emote: scale in, hold for `holdMs`, then fade out. Resolves when gone.
 */
export function showEmoteHeld(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: EmoteKey,
  holdMs = 1000,
): Promise<void> {
  return new Promise((resolve) => {
    const sprite = scene.add
      .image(x, y, emoteTextureKey(key))
      .setOrigin(0.5, 1)
      .setDepth(EMOTE_DEPTH);
    sprite.setDisplaySize(EMOTE_SIZE, EMOTE_SIZE);

    const { scaleX, scaleY } = sprite;
    sprite.setScale(scaleX * 0.4, scaleY * 0.4).setAlpha(0);

    scene.tweens.add({
      targets: sprite,
      scaleX,
      scaleY,
      alpha: 1,
      y: y - 4,
      duration: 180,
      ease: 'Back.easeOut',
    });

    scene.time.delayedCall(holdMs, () => {
      scene.tweens.add({
        targets: sprite,
        alpha: 0,
        y: y - 10,
        duration: 180,
        ease: 'Quad.easeIn',
        onComplete: () => {
          sprite.destroy();
          resolve();
        },
      });
    });
  });
}
