import type { CollectionEntry } from '../../game/state/types';
import { CardPocket, type PocketCard } from './CardPocket';
import './BinderPage.css';

/** Cards shown per binder page (5 across × 2 down) — chunky, low-density. */
export const PAGE_SIZE = 10;

/**
 * One spread of the binder: a fixed grid of card pockets for the current page of
 * the current set. The screen owns which set/page is showing and hands this a
 * slice of cards; discovery updates only flip pocket state (no rebuild/flicker).
 */
export class BinderPage {
  readonly el: HTMLDivElement;
  private pockets = new Map<string, CardPocket>();

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'binder-page';
  }

  /** Rebuild the pockets for a page slice (call on set/page change). */
  setCards(cards: PocketCard[]): void {
    this.el.replaceChildren();
    this.pockets.clear();
    cards.forEach((card, index) => {
      const pocket = new CardPocket(card, index);
      this.pockets.set(card.id, pocket);
      this.el.appendChild(pocket.el);
    });
  }

  /** Re-apply discovery state to the visible pockets. */
  update(collection: Readonly<Record<string, CollectionEntry>>): void {
    for (const [cardId, pocket] of this.pockets) {
      pocket.setEntry(collection[cardId]);
    }
  }
}
