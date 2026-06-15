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

export const EMOTE_POP_MS = 180;
export const EMOTE_FADE_MS = 320;

/**
 * Pop an emote above (x, y): scale in, hold for `holdMs`, then drift up and fade.
 * Resolves once it has fully gone, so a purchase beat can sequence off it.
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
      duration: EMOTE_POP_MS,
      ease: 'Back.easeOut',
    });

    scene.time.delayedCall(holdMs, () => {
      scene.tweens.add({
        targets: sprite,
        alpha: 0,
        y: y - 12,
        duration: EMOTE_FADE_MS,
        ease: 'Quad.easeIn',
        onComplete: () => {
          sprite.destroy();
          resolve();
        },
      });
    });
  });
}
