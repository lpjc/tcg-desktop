import Phaser from 'phaser';
import { PILES, type PileId } from '../game/cards/piles';

/**
 * Speech-bubble emotes shown above a visitor when they buy, giving the player a
 * readable cue for *what* just sold. The mapping escalates with rarity, and any
 * holo collapses to the "cool" flex so a holo sale always reads at a glance.
 *
 * Source art is 42×42; drawn small (`EMOTE_SIZE`) above the character's head.
 */
export type PurchaseEmoteKey = 'happy' | 'very-happy' | 'amazed' | 'happy-cry' | 'cool-shades';

/** Shown while a buyer browses the booth before deciding what to buy. */
export type BrowseEmoteKey = 'wide-eyes' | 'thinking' | 'eyes-no-mouth';

export type EmoteKey = PurchaseEmoteKey | BrowseEmoteKey;

const PURCHASE_EMOTE_KEYS: readonly PurchaseEmoteKey[] = [
  'happy',
  'very-happy',
  'amazed',
  'happy-cry',
  'cool-shades',
];

const BROWSE_EMOTE_KEYS: readonly BrowseEmoteKey[] = [
  'wide-eyes',
  'thinking',
  'eyes-no-mouth',
];

/** Filename overrides when the asset name does not match the emote key. */
const EMOTE_FILES: Partial<Record<EmoteKey, string>> = {
  'eyes-no-mouth': 'eyes no mouth.png',
};

function emoteAssetPath(key: EmoteKey): string {
  const file = EMOTE_FILES[key] ?? `${key}.png`;
  return encodeURI(`/emote-sprites/${file}`);
}

const EMOTE_SIZE = 13;
const EMOTE_DEPTH = 99995;

export function emoteTextureKey(key: EmoteKey): string {
  return `emote-${key}`;
}

export function preloadEmotes(scene: Phaser.Scene): void {
  const keys: readonly EmoteKey[] = [...PURCHASE_EMOTE_KEYS, ...BROWSE_EMOTE_KEYS];
  for (const key of keys) {
    scene.load.image(emoteTextureKey(key), emoteAssetPath(key));
  }
}

/** The emote that signals a sale from a given stock pile. */
export function emoteForPile(pile: PileId): PurchaseEmoteKey {
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

const BROWSE_EMOTE_HOLD_MS = 650;
const BROWSE_EMOTE_GAP_MIN_MS = 120;
const BROWSE_EMOTE_GAP_MAX_MS = 320;
const BROWSE_EMOTE_START_MS = 250;

/** One full browse emote cycle (pop + hold + fade + gap before the next). */
function browseEmoteBeatMs(): number {
  return BROWSE_EMOTE_HOLD_MS + EMOTE_POP_MS + EMOTE_FADE_MS + Phaser.Math.Between(
    BROWSE_EMOTE_GAP_MIN_MS,
    BROWSE_EMOTE_GAP_MAX_MS,
  );
}

/**
 * Cycle random "browsing" emotes above a buyer for the stand-and-look window
 * before they commit to a purchase. Purely cosmetic.
 */
export function playBrowseEmotes(
  scene: Phaser.Scene,
  x: number,
  y: number,
  browseMs: number,
): void {
  let at = BROWSE_EMOTE_START_MS;
  while (at + BROWSE_EMOTE_HOLD_MS < browseMs) {
    const when = at;
    const key = Phaser.Utils.Array.GetRandom([...BROWSE_EMOTE_KEYS]);
    scene.time.delayedCall(when, () => {
      void showEmoteHeld(scene, x, y, key, BROWSE_EMOTE_HOLD_MS);
    });
    at += browseEmoteBeatMs();
  }
}

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
