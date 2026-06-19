import { BAND_HEIGHT, ZOOM } from '../../core/constants';
import { rarityCardColors } from '../../game/cards/rarityColors';
import type { RippedCard } from '../../game/economy/ShopEconomy';
import { getWorldLayout } from '../../world/WorldLayout';
import { registerCardReveal } from '../shopBridge';
import './CardRevealFeed.css';

/** How long each reveal lingers before it fades out. */
const LINGER_MS = 2500;
const FADE_MS = 500;
/** Keep the column short so heavy sweeping never piles up hundreds of nodes. */
const MAX_VISIBLE = 8;
/** Gap (px) between the column's right edge and the shop's left edge. */
const SHOP_GAP = 12;

/**
 * The card-reveal feed: when the player picks a card up off the floor, its art
 * pops in here — anchored just above the road by the shop's left edge — and the
 * reveals stack upward and fade, so rapid pickups read as a rising "ding ding
 * ding" stream rather than a blocking modal. Purely informational; the card was
 * already committed to stock at rip time and is flying into the bar in parallel.
 */
export class CardRevealFeed {
  private readonly column: HTMLDivElement;

  constructor(containerId: string) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    this.column = document.createElement('div');
    this.column.id = 'card-reveal-feed';
    host.appendChild(this.column);

    this.reposition();
    window.addEventListener('resize', () => this.reposition());
    registerCardReveal({ reveal: (card) => this.reveal(card) });
  }

  /** Anchor the column above the road, just left of the shop zone. */
  private reposition(): void {
    const shopLeftScreenX = getWorldLayout().shopFrame.x * ZOOM;
    this.column.style.right = `${window.innerWidth - shopLeftScreenX + SHOP_GAP}px`;
    this.column.style.bottom = `${BAND_HEIGHT * ZOOM + 8}px`;
  }

  reveal(card: RippedCard): void {
    // Re-anchor each time: the world layout may have settled after construction.
    this.reposition();
    const colors = rarityCardColors(card.rarity);
    const el = document.createElement('div');
    el.className = 'feed-card';
    if (card.holo) el.classList.add('feed-card--holo');
    el.style.setProperty('--r-base', colors.base);
    el.style.setProperty('--r-hi', colors.hi);
    el.style.setProperty('--r-edge', colors.edge);
    el.style.setProperty('--r-glow', colors.glow);
    el.style.setProperty('--r-deep', colors.deep);

    const holo = document.createElement('span');
    holo.className = 'feed-card__holo';

    const artWrap = document.createElement('span');
    artWrap.className = 'feed-card__art-wrap';
    if (card.artKey) {
      const art = document.createElement('img');
      art.className = 'feed-card__art';
      art.src = card.artKey;
      art.alt = '';
      art.draggable = false;
      artWrap.appendChild(art);
    }

    const name = document.createElement('span');
    name.className = 'feed-card__name';
    name.textContent = card.name;

    const badge = this.badgeText(card);
    if (badge) {
      const badgeEl = document.createElement('span');
      badgeEl.className = `feed-card__badge feed-card__badge--${badge.kind}`;
      badgeEl.textContent = badge.text;
      el.appendChild(badgeEl);
    }

    el.append(holo, artWrap, name);
    // Newest sits at the bottom of the bottom-anchored column; older ones rise.
    this.column.prepend(el);

    while (this.column.childElementCount > MAX_VISIBLE) {
      this.column.lastElementChild?.remove();
    }

    window.setTimeout(() => {
      el.classList.add('feed-card--out');
      window.setTimeout(() => el.remove(), FADE_MS);
    }, LINGER_MS);
  }

  private badgeText(card: RippedCard): { text: string; kind: string } | null {
    if (card.firstFindBonus) return { text: 'FIRST FIND!', kind: 'first' };
    if (card.isNew) return { text: 'NEW!', kind: 'new' };
    if (card.holo || card.isNewHolo) return { text: 'HOLO!', kind: 'holo' };
    return null;
  }
}
