import { gameState } from '../game/state/GameState';
import { PILES, type PileId } from '../game/cards/piles';
import { rarityTokenColors } from '../game/cards/rarityColors';
import type { FlyPoint } from './flyFx';
import { registerStockFx } from './saleFxBridge';
import './StockBar.css';

/**
 * Stock shown as a currency row beside the money pill: one little trading-card
 * token per pile, grouped by rarity (common · rare · epic · chase), with the
 * holo piles carrying white diagonal stripes (same colour, but shiny) that track
 * the cursor across the screen.
 *
 * Display-only (no pointer events) — stock is a resource readout, not a control.
 * Counts always mirror committed game state. On a booth sale the world animates a
 * card from here into the buyer; this bar only exposes a token's screen position
 * (via `saleFxBridge`) — the flying card itself is rendered in the Phaser world
 * (see `saleCardFx`) so the buyer can occlude it.
 */
const DISPLAY_ORDER: readonly PileId[] = [
  'common',
  'rare',
  'rareHolo',
  'epic',
  'epicHolo',
  'chase',
  'chaseHolo',
];

/** First pile of each rarity tier (except common) — gets a group gap before it. */
const GROUP_START_PILES = new Set<PileId>(['rare', 'epic', 'chase']);

export class StockBar {
  private readonly el: HTMLDivElement;
  private readonly countEls = new Map<PileId, HTMLElement>();
  private readonly cardEls = new Map<PileId, HTMLElement>();

  constructor(containerId: string) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    this.el = document.createElement('div');
    this.el.id = 'stock-bar';

    DISPLAY_ORDER.forEach((pile, index) => this.el.appendChild(this.buildCard(pile, index)));
    host.appendChild(this.el);

    this.trackPointerShine();
    registerStockFx({ tokenCenter: (pile) => this.tokenCenter(pile) });
    gameState.subscribe((data) => this.render(data.stock));
  }

  private buildCard(pile: PileId, index: number): HTMLElement {
    const meta = PILES[pile];
    const colors = rarityTokenColors(meta.rarity);
    const card = document.createElement('div');
    card.className = [
      'stock-card',
      meta.holo ? 'stock-card--holo' : '',
      GROUP_START_PILES.has(pile) ? 'stock-card--group-start' : '',
    ]
      .filter(Boolean)
      .join(' ');
    card.style.setProperty('--card-color', colors.base);
    card.style.setProperty('--card-hi', colors.hi);
    card.style.setProperty('--card-edge', colors.edge);
    card.style.setProperty('--i', String(index));

    if (meta.holo) {
      const shine = document.createElement('i');
      shine.className = 'stock-card__shine';
      card.appendChild(shine);
    }

    const count = document.createElement('span');
    count.className = 'stock-card__count';
    card.appendChild(count);

    this.cardEls.set(pile, card);
    this.countEls.set(pile, count);
    return card;
  }

  /** Feed the cursor's normalised position to CSS so holo sheens shift in real time. */
  private trackPointerShine(): void {
    const onMove = (event: PointerEvent | MouseEvent) => {
      const mx = event.clientX / Math.max(1, window.innerWidth);
      const my = event.clientY / Math.max(1, window.innerHeight);
      this.el.style.setProperty('--mx', mx.toFixed(3));
      this.el.style.setProperty('--my', my.toFixed(3));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('mousemove', onMove);
  }

  private render(stock: Record<PileId, number>): void {
    for (const pile of DISPLAY_ORDER) {
      const count = stock[pile] ?? 0;
      const countEl = this.countEls.get(pile);
      const cardEl = this.cardEls.get(pile);
      if (countEl) countEl.textContent = abbreviate(count);
      if (cardEl) {
        cardEl.classList.toggle('stock-card--empty', count <= 0);
        cardEl.title = `${PILES[pile].label}: ${count}`;
      }
    }
  }

  /**
   * Viewport-pixel centre of a pile's token — the launch point the world uses to
   * fly the sold card into the buyer. Null when the token isn't mounted.
   */
  private tokenCenter(pile: PileId): FlyPoint | null {
    const token = this.cardEls.get(pile);
    if (!token) return null;
    const rect = token.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
}

/** Compact large counts so the token stays small (1234 → 1.2k). */
function abbreviate(value: number): string {
  if (value < 1000) return String(value);
  return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)}k`;
}
