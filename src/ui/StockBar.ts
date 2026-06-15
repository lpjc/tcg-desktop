import { gameState } from '../game/state/GameState';
import { PILES, type PileId } from '../game/cards/piles';
import { rarityTokenColors } from '../game/cards/rarityColors';
import { animateFly, elementCenter, type FlyPoint } from './flyFx';
import './flyFx.css';
import './StockBar.css';

/**
 * Stock shown as a currency row beside the money pill: one little trading-card
 * token per pile, grouped by rarity (common · rare · epic · chase), with the
 * holo piles carrying white diagonal stripes (same colour, but shiny) that track
 * the cursor across the screen.
 *
 * Display-only (no pointer events) — stock is a resource readout, not a control.
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
  /** Last seen counts, so we can detect which pile a sale came from. */
  private prevCounts = new Map<PileId, number>();
  /** Piles whose fly-out is handled by the purchase animation instead. */
  private suppressedFly = new Set<PileId>();

  constructor(containerId: string) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    this.el = document.createElement('div');
    this.el.id = 'stock-bar';

    DISPLAY_ORDER.forEach((pile, index) => this.el.appendChild(this.buildCard(pile, index)));
    host.appendChild(this.el);

    this.trackPointerShine();
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

  /** Skip the default fly-out — the purchase animation owns this pile's card. */
  suppressSaleFly(pile: PileId): void {
    this.suppressedFly.add(pile);
  }

  /** Fly a stock token from the HUD into a screen-space target (the buyer). */
  flyCardToTarget(pile: PileId, target: FlyPoint): Promise<void> {
    const token = this.cardEls.get(pile);
    if (!token) return Promise.resolve();

    const meta = PILES[pile];
    const colors = rarityTokenColors(meta.rarity);
    const from = elementCenter(token);

    const fly = document.createElement('div');
    fly.className = 'sale-fly-card';
    fly.style.setProperty('--card-color', colors.base);
    fly.style.setProperty('--card-hi', colors.hi);
    fly.style.setProperty('--card-edge', colors.edge);
    document.getElementById('editor-ui')?.appendChild(fly);

    return animateFly(fly, from, target, { duration: 680, endScale: 0.5 });
  }
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
      const prev = this.prevCounts.get(pile);
      const countEl = this.countEls.get(pile);
      const cardEl = this.cardEls.get(pile);
      if (countEl) countEl.textContent = abbreviate(count);
      if (cardEl) {
        cardEl.classList.toggle('stock-card--empty', count <= 0);
        cardEl.title = `${PILES[pile].label}: ${count}`;
      }
      if (prev !== undefined && count < prev) {
        if (this.suppressedFly.has(pile)) {
          this.suppressedFly.delete(pile);
        } else {
          this.flyOutCard(pile);
        }
      }
      this.prevCounts.set(pile, count);
    }
  }

  /** Spawn a short-lived card copy that lifts out of the pile token and fades. */
  private flyOutCard(pile: PileId): void {
    const token = this.cardEls.get(pile);
    if (!token) return;
    const meta = PILES[pile];
    const colors = rarityTokenColors(meta.rarity);

    const fly = document.createElement('div');
    fly.className = 'stock-fly';
    fly.style.left = `${token.offsetLeft}px`;
    fly.style.setProperty('--card-color', colors.base);
    fly.style.setProperty('--card-hi', colors.hi);
    fly.style.setProperty('--card-edge', colors.edge);
    this.el.appendChild(fly);

    const drift = (Math.random() - 0.5) * 10;
    fly
      .animate(
        [
          { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
          { transform: `translate(${drift}px, -22px) rotate(${drift}deg)`, opacity: 0 },
        ],
        { duration: 650, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
      )
      .finished.then(() => fly.remove())
      .catch(() => fly.remove());
  }
}

/** Compact large counts so the token stays small (1234 → 1.2k). */
function abbreviate(value: number): string {
  if (value < 1000) return String(value);
  return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)}k`;
}
