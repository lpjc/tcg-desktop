/**
 * Thin bridge between the Phaser world (station arrivals) and the DOM shop
 * screens. The world never imports those widgets directly; it calls these
 * functions and each UI registers its handlers at construction — same
 * decoupling as `saleFxBridge`.
 *
 * Two stations route through here: the vending machine opens the pack BUYING
 * screen, and the shop counter opens the pack OPENING overlay (the same one
 * behind the toolbar button).
 */
interface OverlayHandlers {
  open: () => void;
  close: () => void;
}

let vending: OverlayHandlers | null = null;
let packOpen: OverlayHandlers | null = null;

export function registerPackVending(handlers: OverlayHandlers): void {
  vending = handlers;
}

export function openPackVending(): void {
  vending?.open();
}

export function closePackVending(): void {
  vending?.close();
}

export function registerPackOpen(handlers: OverlayHandlers): void {
  packOpen = handlers;
}

export function openPackOpenScreen(): void {
  packOpen?.open();
}
