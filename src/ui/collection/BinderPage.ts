import type { CollectionEntry } from '../../game/state/types';
import { CardPocket, type PocketCard } from './CardPocket';
import './BinderPage.css';

/** Cards per binder page (5 across × 3 down). Two pages = a 30-card set spread. */
export const PAGE_SIZE = 15;

/**
 * One leaf of the open binder: a fixed 5×3 grid of card pockets for one page of a
 * set. The book shows two of these side by side (a spread); the FlipBook reparents
 * these page elements during a page turn, so each keeps its own pockets. Discovery
 * updates only flip pocket state (no rebuild/flicker).
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
