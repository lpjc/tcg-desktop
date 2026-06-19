import type { Rarity } from '../../game/cards/rarity';
import { rarityCardColors } from '../../game/cards/rarityColors';
import type { CollectionEntry } from '../../game/state/types';
import './CardPocket.css';

/** Everything a pocket needs to draw one card (its slot in the binder). */
export interface PocketCard {
  id: string;
  /** 1-based number within the set, shown as #NN. */
  number: number;
  name: string;
  rarity: Rarity;
  artKey?: string;
  canHolo: boolean;
}

/**
 * One card slot in the binder. The card is mostly its monster: a card-shaped
 * frame with the creature as the hero. Until discovered it reads as a pure
 * silhouette (dark slot + black monster shape + "?"), echoing the bestiary that
 * inspired this. Once discovered the rarity frame, colour art, gem and name
 * light up; holo cards gain a cursor-reactive foil sheen.
 *
 * Build once per page, then `setEntry` flips discovered/holo state without
 * recreating the <img> (no flicker on unrelated game-state updates).
 */
export class CardPocket {
  readonly el: HTMLButtonElement;
  private readonly nameEl: HTMLElement;
  private readonly card: PocketCard;

  constructor(card: PocketCard, index: number) {
    this.card = card;
    const colors = rarityCardColors(card.rarity);

    this.el = document.createElement('button');
    this.el.type = 'button';
    this.el.className = 'pocket';
    this.el.dataset.rarity = card.rarity;
    this.el.dataset.state = 'undiscovered';
    this.el.style.setProperty('--r-base', colors.base);
    this.el.style.setProperty('--r-hi', colors.hi);
    this.el.style.setProperty('--r-edge', colors.edge);
    this.el.style.setProperty('--r-glow', colors.glow);
    this.el.style.setProperty('--r-deep', colors.deep);
    // Stagger the idle bob so creatures don't all breathe in unison.
    this.el.style.setProperty('--bob-delay', `${(index % 5) * 0.4 + (index % 2) * 0.2}s`);
    // Per-card offset so holo sheens don't all align (less mechanical).
    this.el.style.setProperty('--i', String(card.number));

    const inner = document.createElement('span');
    inner.className = 'pocket__inner';

    const artWrap = document.createElement('span');
    artWrap.className = 'pocket__art-wrap';
    if (card.artKey) {
      const art = document.createElement('img');
      art.className = 'pocket__art';
      art.src = card.artKey;
      art.alt = '';
      art.draggable = false;
      artWrap.appendChild(art);
    }

    // Foil is printed into the card stock; the creature art sits above it.
    const holo = document.createElement('span');
    holo.className = 'pocket__holo';

    const mystery = document.createElement('span');
    mystery.className = 'pocket__mystery';
    mystery.textContent = '?';

    const num = document.createElement('span');
    num.className = 'pocket__num';
    num.textContent = `#${String(card.number).padStart(2, '0')}`;

    this.nameEl = document.createElement('span');
    this.nameEl.className = 'pocket__name';

    inner.append(holo, artWrap, mystery, num, this.nameEl);
    this.el.appendChild(inner);

    this.setEntry(undefined);
  }

  /** Apply the player's discovery state for this card. */
  setEntry(entry: CollectionEntry | undefined): void {
    const discovered = entry?.discovered === true;
    const holo = discovered && this.card.canHolo && entry?.holo === true;
    this.el.dataset.state = discovered ? 'discovered' : 'undiscovered';
    this.el.classList.toggle('pocket--holo', holo);
    this.nameEl.textContent = discovered ? this.card.name : '???';
    this.el.title = discovered
      ? `${this.card.name} — ${this.card.rarity}${holo ? ' holo' : ''}`
      : 'Undiscovered';
  }
}
