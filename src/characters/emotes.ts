import Phaser from 'phaser';
import { assetUrl } from '../assets/assetUrl';
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
  return assetUrl(`emote-sprites/${file}`);
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

/** Soft fade-in while a buyer reads the booth — unhurried, no pop bounce. */
const BROWSE_EMOTE_FADE_IN_MS = 1000;
const BROWSE_EMOTE_HOLD_MIN_MS = 2000;
const BROWSE_EMOTE_HOLD_MAX_MS = 5000;
/** Gentle drift away once they've finished looking. */
const BROWSE_EMOTE_FADE_OUT_MS = 700;
const BROWSE_EMOTE_GAP_MIN_MS = 400;
const BROWSE_EMOTE_GAP_MAX_MS = 900;
/** Brief beat after arriving before the first browsing emote appears. */
const BROWSE_EMOTE_START_MS = 500;

function randomBrowseHoldMs(): number {
  return Phaser.Math.Between(BROWSE_EMOTE_HOLD_MIN_MS, BROWSE_EMOTE_HOLD_MAX_MS);
}

/** Full length of one browse emote (fade in → linger → fade out → gap). */
function browseEmoteBeatMs(holdMs: number): number {
  return (
    BROWSE_EMOTE_FADE_IN_MS +
    holdMs +
    BROWSE_EMOTE_FADE_OUT_MS +
    Phaser.Math.Between(BROWSE_EMOTE_GAP_MIN_MS, BROWSE_EMOTE_GAP_MAX_MS)
  );
}

/**
 * A slow, soft emote for the booth-browsing beat: ease in over ~1s, linger
 * 2–5s, then drift away. Purchase emotes keep their snappy pop.
 */
function showBrowseEmote(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: BrowseEmoteKey,
  holdMs: number,
): void {
  const sprite = scene.add
    .image(x, y, emoteTextureKey(key))
    .setOrigin(0.5, 1)
    .setDepth(EMOTE_DEPTH);
  sprite.setDisplaySize(EMOTE_SIZE, EMOTE_SIZE);

  const { scaleX, scaleY } = sprite;
  const restY = y - 3;
  sprite.setScale(scaleX * 0.88, scaleY * 0.88).setAlpha(0).setY(restY + 2);

  scene.tweens.add({
    targets: sprite,
    scaleX,
    scaleY,
    alpha: 1,
    y: restY,
    duration: BROWSE_EMOTE_FADE_IN_MS,
    ease: 'Sine.easeOut',
  });

  scene.time.delayedCall(BROWSE_EMOTE_FADE_IN_MS + holdMs, () => {
    scene.tweens.add({
      targets: sprite,
      alpha: 0,
      y: restY - 6,
      duration: BROWSE_EMOTE_FADE_OUT_MS,
      ease: 'Sine.easeInOut',
      onComplete: () => sprite.destroy(),
    });
  });
}

/**
 * Cycle random "browsing" emotes above a buyer for the stand-and-look window
 * before they commit to a purchase. Purely cosmetic.
 *
 * @returns Ms from booth arrival until the last scheduled browse emote has fully
 *          faded out — callers should wait this long before the purchase beat.
 */
export function playBrowseEmotes(
  scene: Phaser.Scene,
  x: number,
  y: number,
  browseMs: number,
): number {
  let at = BROWSE_EMOTE_START_MS;
  let sequenceEndMs = 0;
  while (at + BROWSE_EMOTE_FADE_IN_MS + BROWSE_EMOTE_HOLD_MIN_MS <= browseMs) {
    const when = at;
    const holdMs = randomBrowseHoldMs();
    const key = Phaser.Utils.Array.GetRandom([...BROWSE_EMOTE_KEYS]);
    scene.time.delayedCall(when, () => {
      showBrowseEmote(scene, x, y, key, holdMs);
    });
    sequenceEndMs = when + BROWSE_EMOTE_FADE_IN_MS + holdMs + BROWSE_EMOTE_FADE_OUT_MS;
    at += browseEmoteBeatMs(holdMs);
  }
  return sequenceEndMs > 0 ? sequenceEndMs : browseMs;
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
