import type { RippedCard } from '../game/economy/ShopEconomy';

/**
 * Thin bridge between the Phaser world (station arrivals, pack rips, card
 * pickups) and the DOM shop UI singletons (the pack vending screen + the
 * card-reveal feed). The world never imports those widgets directly; it calls
 * these functions and the UI registers its handlers at construction — same
 * decoupling as `saleFxBridge`.
 */
interface PackVendingFx {
  open: () => void;
  close: () => void;
}

interface CardRevealFx {
  /** Pop one ripped card into the reveal feed (fire-and-forget, auto-fades). */
  reveal: (card: RippedCard) => void;
}

let vending: PackVendingFx | null = null;
let cardReveal: CardRevealFx | null = null;

export function registerPackVending(handlers: PackVendingFx): void {
  vending = handlers;
}

export function openPackVending(): void {
  vending?.open();
}

export function closePackVending(): void {
  vending?.close();
}

export function registerCardReveal(handlers: CardRevealFx): void {
  cardReveal = handlers;
}

/** Pop a ripped card into the DOM reveal feed (no-op if none is mounted). */
export function revealRippedCard(card: RippedCard): void {
  cardReveal?.reveal(card);
}
