import Phaser from 'phaser';
import { EMOTE_FADE_MS, emoteForPile, showEmoteHeld } from '../characters/emotes';
import type { Npc } from '../characters/Npc';
import type { SaleResult } from '../game/economy/BoothEconomy';
import { flyCoins } from '../ui/flyFx';
import { flyStockCard, moneyPillCenter, revealMoneyGain } from '../ui/saleFxBridge';
import { worldToScreen } from './hudCoords';

/**
 * Purchase + collect animations. These are PURELY COSMETIC: the economy is
 * already committed (stock taken, money banked or boxed) by the caller before
 * any of this runs. Nothing here mutates game state, so a dropped or interrupted
 * animation only affects visuals — it can never lose or double a sale.
 */

/*
 * Beats are back-to-back; each motion is drawn out so the player can read it:
 *
 *   t=0              card glides stock bar → buyer (CARD_FLY_MS)
 *   t=CARD_FLY_MS    card lands → emote pops immediately
 *   t=…+EMOTE_HOLD  emote starts fading → coins launch to the pill (overlap)
 *   t=coins land     buyer walks off (`purchaseLeaveDelayMs`)
 */
const CARD_FLY_MS = 1500;
const EMOTE_HOLD_MS = 750;
const COIN_FLY_MS = 1100;
const COIN_STAGGER_MS = 70;

/** Coins launch the moment the emote begins to fade — no gap after the reaction. */
const PAY_AT_MS = CARD_FLY_MS + EMOTE_HOLD_MS;

/** A few coins, scaled gently by price, so a chase sale rains a little more. */
function coinCountForValue(value: number): number {
  if (value < 5) return 2;
  if (value < 25) return 3;
  if (value < 100) return 4;
  return 5;
}

/**
 * A guest just bought a card. Card → emote → pay: the card changes hands first,
 * the buyer reacts the instant it lands, and coins fly as the emote fades (only
 * when the player mans the booth). Gaps between beats are minimal; each motion
 * itself is slow enough to read.
 */
export function playPurchaseSale(
  scene: Phaser.Scene,
  npc: Npc,
  sale: SaleResult,
  playerAtBooth: boolean,
): void {
  const coinOrigin = worldToScreen(scene, npc.x, npc.y - 16);
  const cardTarget = worldToScreen(scene, npc.x, npc.y - 10);

  // 1. Card glides from the stock bar into the buyer's hands.
  flyStockCard(sale.pile, cardTarget, CARD_FLY_MS);

  // 2. The instant it lands: pop + emote.
  scene.time.delayedCall(CARD_FLY_MS, () => {
    npc.pop();
    void showEmoteHeld(scene, npc.x, npc.y - 22, emoteForPile(sale.pile), EMOTE_HOLD_MS);
  });

  // 3. As the emote fades, coins fly to the pill (manned booth only).
  if (playerAtBooth) {
    scene.time.delayedCall(PAY_AT_MS, () => {
      const pill = moneyPillCenter();
      if (pill) {
        void flyCoins(coinOrigin, pill, coinCountForValue(sale.price), () => revealMoneyGain(), {
          duration: COIN_FLY_MS,
          stagger: COIN_STAGGER_MS,
        });
      } else {
        revealMoneyGain();
      }
    });
  }
}

/** Rough end-to-end length of a manned purchase beat (for tuning NPC leave timing). */
export function mannedPurchaseBeatMs(coinCount: number): number {
  const clamped = Math.max(1, Math.min(coinCount, 8));
  return PAY_AT_MS + COIN_FLY_MS + (clamped - 1) * COIN_STAGGER_MS;
}

/** How long the buyer stands before walking off, matched to the purchase beat. */
export function purchaseLeaveDelayMs(sale: SaleResult, playerAtBooth: boolean): number {
  const beat = playerAtBooth
    ? mannedPurchaseBeatMs(coinCountForValue(sale.price))
    : unmannedPurchaseBeatMs();
  return beat + 80;
}

/** End-to-end when the player is away (card + emote fade, no coin fly). */
export function unmannedPurchaseBeatMs(): number {
  return CARD_FLY_MS + EMOTE_HOLD_MS + EMOTE_FADE_MS;
}

/**
 * Booth collect: coins lift off the table cash pile and fly into the money pill,
 * which reveals the banked total when they land. The cash box was already
 * flushed by the caller, so this just animates the transfer.
 */
export function playBoothCollect(
  scene: Phaser.Scene,
  tableWorld: { x: number; y: number },
  totalMoney: number,
): void {
  const pill = moneyPillCenter();
  if (!pill || totalMoney <= 0) {
    revealMoneyGain();
    return;
  }
  const from = worldToScreen(scene, tableWorld.x, tableWorld.y - 6);
  void flyCoins(from, pill, coinCountForValue(totalMoney), () => revealMoneyGain(), {
    duration: COIN_FLY_MS,
    stagger: COIN_STAGGER_MS,
  });
}
