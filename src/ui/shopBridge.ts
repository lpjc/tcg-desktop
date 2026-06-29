/**
 * Thin bridge between the Phaser world (station arrivals) and the DOM pack
 * vending screen. The world never imports that widget directly; it calls these
 * functions and the UI registers its handlers at construction — same decoupling
 * as `saleFxBridge`.
 *
 * Pack OPENING is no longer driven from the world: it lives in the pack-opening
 * overlay (`ui/packs/PackOpenScreen`), opened from its toolbar button. Only the
 * in-world vending machine (buying) still talks through this bridge.
 */
interface PackVendingFx {
  open: () => void;
  close: () => void;
}

let vending: PackVendingFx | null = null;

export function registerPackVending(handlers: PackVendingFx): void {
  vending = handlers;
}

export function openPackVending(): void {
  vending?.open();
}

export function closePackVending(): void {
  vending?.close();
}
