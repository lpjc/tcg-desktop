import { getCard } from '../../game/cards/cards';
import { rarityColor, shadeColor } from '../../game/cards/rarityColors';
import type { CollectionEntry } from '../../game/state/types';
import './CardCountStrip.css';

/**
 * A full-width row of tiny card-shaped marks, one per card in the set — the
 * collection counter. A mark is pure black until its card is discovered, then it
 * fills with that card's rarity colour. At a glance it reads as "cards collected
 * / total", and roughly maps to the binder layout below it.
 */
export class CardCountStrip {
  readonly el: HTMLDivElement;
  private readonly marksWrap: HTMLDivElement;
  private readonly countEl: HTMLSpanElement;
  private marks: HTMLElement[] = [];
  private cardIds: string[] = [];

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'count-strip';

    this.marksWrap = document.createElement('div');
    this.marksWrap.className = 'count-strip__marks';

    this.countEl = document.createElement('span');
    this.countEl.className = 'count-strip__count';

    this.el.append(this.marksWrap, this.countEl);
  }

  /** Rebuild one mark per card (call on set change). */
  setCards(cardIds: string[]): void {
    this.cardIds = cardIds;
    this.marks = cardIds.map((cardId) => {
      const mark = document.createElement('span');
      mark.className = 'count-strip__mark';
      const rarity = getCard(cardId)?.rarity;
      if (rarity) {
        mark.style.setProperty('--mark', shadeColor(rarityColor(rarity), 0));
        mark.style.setProperty('--mark-hi', shadeColor(rarityColor(rarity), 0.45));
      }
      return mark;
    });
    this.marksWrap.replaceChildren(...this.marks);
  }

  /** Recolour marks from discovery state and update the count. */
  update(collection: Readonly<Record<string, CollectionEntry>>): void {
    let found = 0;
    this.cardIds.forEach((cardId, index) => {
      const discovered = collection[cardId]?.discovered === true;
      if (discovered) found += 1;
      this.marks[index]?.classList.toggle('count-strip__mark--found', discovered);
    });
    this.countEl.textContent = `${found} / ${this.cardIds.length}`;
  }
}
