import Phaser from 'phaser';
import { ZOOM } from '../core/constants';
import { depthFromFootY } from '../core/depth';
import type { Npc } from '../characters/Npc';
import { PILES, type PileId } from '../game/cards/piles';
import type { Rarity } from '../game/cards/rarity';
import { rarityTokenColorsInt } from '../game/cards/rarityColors';

/**
 * The sold card, rendered as a Phaser world sprite (not a DOM fly) so it can be
 * depth-sorted against world characters. Flying it in the world is the only way
 * to make the back-turned buyer occlude the card as it lands — a DOM element on
 * the overlay always draws above the transparent canvas.
 *
 * The token matches the DOM stock-bar tokens (`rarityTokenColors`): flat fill,
 * 2px pixel bevel, 2px dark outline — drawn once per rarity into a cached texture.
 */
const CARD_W = 16;
const CARD_H = 22;
const BEVEL = 2;
const OUTLINE = 2;
const OUTLINE_COLOR = 0x0e1219;

/** Card token screen size matches the DOM stock tokens, so undo the camera zoom. */
const BASE_SCALE = 1 / ZOOM;
/** Grow at the arc midpoint, shrink slightly as it "lands" — mirrors the DOM fly. */
const PEAK_SCALE = 1.18;
const END_SCALE = 0.7;
/** Opacity only dips at the very start/end so the card reads solid mid-flight. */
const FADE_EDGE = 0.05;

function cardTextureKey(rarity: Rarity): string {
  return `sale-card-${rarity}`;
}

/** Draw the rarity's card token into a cached texture once; return its key. */
export function ensureCardTexture(scene: Phaser.Scene, rarity: Rarity): string {
  const key = cardTextureKey(rarity);
  if (scene.textures.exists(key)) return key;

  const { base, hi, edge } = rarityTokenColorsInt(rarity);
  const w = CARD_W + OUTLINE * 2;
  const h = CARD_H + OUTLINE * 2;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  g.fillStyle(OUTLINE_COLOR, 1).fillRect(0, 0, w, h);
  g.fillStyle(base, 1).fillRect(OUTLINE, OUTLINE, CARD_W, CARD_H);
  // Highlight bevel: top + left edges.
  g.fillStyle(hi, 1);
  g.fillRect(OUTLINE, OUTLINE, CARD_W, BEVEL);
  g.fillRect(OUTLINE, OUTLINE, BEVEL, CARD_H);
  // Shadow bevel: bottom + right edges.
  g.fillStyle(edge, 1);
  g.fillRect(OUTLINE, OUTLINE + CARD_H - BEVEL, CARD_W, BEVEL);
  g.fillRect(OUTLINE + CARD_W - BEVEL, OUTLINE, BEVEL, CARD_H);

  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}

/**
 * Glide a card from a world point (the stock bar token, converted via
 * `screenToWorld`) into the buyer. Depth sits just behind the NPC so the buyer,
 * back to the camera, occludes the card as it arrives. Purely cosmetic — the
 * stock was already decremented; a dropped tween only affects visuals.
 */
export function flyCardToNpc(
  scene: Phaser.Scene,
  from: { x: number; y: number },
  npc: Npc,
  pile: PileId,
  durationMs: number,
): void {
  const key = ensureCardTexture(scene, PILES[pile].rarity);
  const to = { x: npc.x, y: npc.y - 10 };

  const card = scene.add.image(from.x, from.y, key).setOrigin(0.5, 0.5);
  card.setDepth(depthFromFootY(npc.y) - 1);
  card.setScale(BASE_SCALE).setAlpha(0);

  const progress = { t: 0 };
  scene.tweens.add({
    targets: progress,
    t: 1,
    duration: durationMs,
    ease: 'Cubic.easeInOut',
    onUpdate: () => {
      const t = progress.t;
      card.x = Phaser.Math.Linear(from.x, to.x, t);
      card.y = Phaser.Math.Linear(from.y, to.y, t);

      const mult =
        t < 0.5
          ? Phaser.Math.Linear(1, PEAK_SCALE, t / 0.5)
          : Phaser.Math.Linear(PEAK_SCALE, END_SCALE, (t - 0.5) / 0.5);
      card.setScale(BASE_SCALE * mult);

      card.alpha =
        t < FADE_EDGE ? t / FADE_EDGE : t > 1 - FADE_EDGE ? (1 - t) / FADE_EDGE : 1;
    },
    onComplete: () => card.destroy(),
  });
}
