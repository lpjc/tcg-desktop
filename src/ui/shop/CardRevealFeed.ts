import { BAND_HEIGHT, ZOOM } from '../../core/constants';
import { rarityCardColors } from '../../game/cards/rarityColors';
import type { RippedCard } from '../../game/economy/ShopEconomy';
import { getWorldLayout } from '../../world/WorldLayout';
import { revealStockGain, stockTokenCenter } from '../saleFxBridge';
import { registerCardReveal } from '../shopBridge';
import './CardRevealFeed.css';

/** How long each reveal lingers before it flies to stock. */
const DWELL_MS = 2000;
const FLY_MS = 520;
/** Keep the row short so heavy sweeping never piles up hundreds of nodes. */
const MAX_VISIBLE = 12;
/** Gap (px) between the row's right edge and the shop's left edge. */
const SHOP_GAP = 12;

interface FeedEntry {
  el: HTMLElement;
  card: RippedCard;
  dwellTimer: number;
}

/**
 * The card-reveal feed: when the player picks a card up off the floor, its art
 * pops in here — anchored just above the road by the shop's left edge — as a
 * horizontal conveyor (newest at the left, oldest at the right anchor). After a
 * fixed dwell each card flies up-and-over into its stock pile; the count ticks
 * when it lands.
 */
export class CardRevealFeed {
  private readonly row: HTMLDivElement;
  /** Oldest-first queue for overflow eviction. */
  private readonly queue: FeedEntry[] = [];

  constructor(containerId: string) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    this.row = document.createElement('div');
    this.row.id = 'card-reveal-feed';
    host.appendChild(this.row);

    this.reposition();
    window.addEventListener('resize', () => this.reposition());
    registerCardReveal({ reveal: (card) => this.reveal(card) });
  }

  /** Anchor the row above the road, just left of the shop zone (right edge fixed). */
  private reposition(): void {
    const shopLeftScreenX = getWorldLayout().shopFrame.x * ZOOM;
    this.row.style.right = `${window.innerWidth - shopLeftScreenX + SHOP_GAP}px`;
    this.row.style.bottom = `${BAND_HEIGHT * ZOOM + 8}px`;
  }

  reveal(card: RippedCard): void {
    this.reposition();
    const colors = rarityCardColors(card.rarity);
    const el = document.createElement('div');
    el.className = `feed-card feed-card--${card.rarity}`;
    if (card.holo) el.classList.add('feed-card--holo');
    if (card.isNew || card.isNewHolo || card.firstFindBonus) el.classList.add('feed-card--new');
    el.style.setProperty('--r-base', colors.base);
    el.style.setProperty('--r-hi', colors.hi);
    el.style.setProperty('--r-edge', colors.edge);
    el.style.setProperty('--r-glow', colors.glow);
    el.style.setProperty('--r-deep', colors.deep);

    const labels = document.createElement('div');
    labels.className = 'feed-card__labels';
    if (card.isNew || card.isNewHolo || card.firstFindBonus) {
      const newLabel = document.createElement('span');
      newLabel.className = 'feed-card__label feed-card__label--new';
      newLabel.textContent = 'NEW!';
      labels.appendChild(newLabel);
    }
    if (card.holo) {
      const holoLabel = document.createElement('span');
      holoLabel.className = 'feed-card__label feed-card__label--holo';
      holoLabel.textContent = 'HOLO!';
      labels.appendChild(holoLabel);
    }

    const glow = document.createElement('span');
    glow.className = 'feed-card__glow';

    const flash = document.createElement('span');
    flash.className = 'feed-card__flash';

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

    el.append(labels, glow, flash, holo, artWrap, name);
    // Newest at the left; oldest sits at the right anchor and exits first.
    this.row.prepend(el);

    const entry: FeedEntry = {
      el,
      card,
      dwellTimer: window.setTimeout(() => this.leave(entry), DWELL_MS),
    };
    this.queue.push(entry);

    while (this.queue.length > MAX_VISIBLE) {
      const oldest = this.queue.shift();
      if (oldest) this.leave(oldest);
    }
  }

  /** Fly a reveal card into its stock pile and release the held count. */
  private leave(entry: FeedEntry): void {
    const idx = this.queue.indexOf(entry);
    if (idx < 0) return;
    this.queue.splice(idx, 1);
    window.clearTimeout(entry.dwellTimer);

    const { el, card } = entry;
    if (el.classList.contains('feed-card--flying')) return;
    el.classList.add('feed-card--flying');

    const token = stockTokenCenter(card.pile);
    if (!token) {
      el.remove();
      revealStockGain(card.pile, 1);
      return;
    }

    const rect = el.getBoundingClientRect();
    const fromX = rect.left + rect.width / 2;
    const fromY = rect.top + rect.height / 2;
    const dx = token.x - fromX;
    const dy = token.y - fromY;
    const arcLift = -28;

    el.style.transition = `transform ${FLY_MS}ms cubic-bezier(0.35, 0, 0.2, 1), opacity ${FLY_MS - 80}ms ease`;
    el.style.transformOrigin = 'center center';
    requestAnimationFrame(() => {
      el.style.transform = `translate(${dx}px, ${dy + arcLift}px) scale(0.15)`;
      el.style.opacity = '0';
    });

    window.setTimeout(() => {
      el.remove();
      revealStockGain(card.pile, 1);
    }, FLY_MS);
  }
}
