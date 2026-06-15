import type { PileId } from '../game/cards/piles';
import type { FlyPoint } from './flyFx';

/**
 * A thin bridge between the world (Phaser) sale code and the DOM HUD singletons
 * (the stock bar + money pill). The world never imports those widgets directly;
 * it calls these functions and the HUD registers its handlers at construction.
 *
 * Everything here is COSMETIC. The economy is committed synchronously by
 * `BoothEconomy`/`GameState` before any of this runs, so a missing handler or a
 * dropped animation can never lose or double a sale.
 */
interface StockFx {
  /** Viewport-pixel centre of a pile's stock token (launch point for the sale card). */
  tokenCenter: (pile: PileId) => FlyPoint | null;
}

interface MoneyFx {
  /** Screen centre of the money pill — where coins should land. */
  center: () => FlyPoint | null;
  /** Hold the next banked increase back so it can be revealed on coin arrival. */
  expectGain: () => void;
  /** Reveal a held increase now (coins landed) — ticks the number + "+€X". */
  revealGain: () => void;
}

let stock: StockFx | null = null;
let money: MoneyFx | null = null;

export function registerStockFx(handlers: StockFx): void {
  stock = handlers;
}

export function registerMoneyFx(handlers: MoneyFx): void {
  money = handlers;
}

export function stockTokenCenter(pile: PileId): FlyPoint | null {
  return stock?.tokenCenter(pile) ?? null;
}

export function moneyPillCenter(): FlyPoint | null {
  return money?.center() ?? null;
}

export function expectMoneyGain(): void {
  money?.expectGain();
}

export function revealMoneyGain(): void {
  money?.revealGain();
}
