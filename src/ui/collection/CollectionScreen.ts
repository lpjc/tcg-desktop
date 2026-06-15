import { interaction } from '../../core/interaction';
import { allSets, getCard } from '../../game/cards/cards';
import { rarityCanHolo } from '../../game/cards/rarity';
import { gameState, type GameStateData } from '../../game/state/GameState';
import { BinderPage, PAGE_SIZE } from './BinderPage';
import { CardCountStrip } from './CardCountStrip';
import { FlipBook } from './FlipBook';
import { SetTabs, type SetTabInfo } from './SetTabs';
import type { PocketCard } from './CardPocket';
import './CollectionScreen.css';

/** One built spread: the two cream page leaves + their live pocket grids. */
interface BuiltSpread {
  left: HTMLElement;
  right: HTMLElement;
  leftPage: BinderPage;
  rightPage: BinderPage;
}

/**
 * The Collection binder: a wide, open book that slides up from the bottom of the
 * screen and floats over the world band — no dimming scrim, so it reads as part
 * of the game rather than a modal overlay. Each set is one two-page spread (15
 * pockets a side); the arrows and the section tabs turn pages with a 3D flip
 * (see FlipBook). The desktop stays interactive behind it; ESC or the button
 * close it.
 */
export class CollectionScreen {
  private readonly root: HTMLDivElement;
  private readonly binder: HTMLDivElement;
  private readonly setTabs: SetTabs;
  private readonly countStrip: CardCountStrip;
  private readonly flipBook: FlipBook;
  private readonly currentNameEl: HTMLElement;
  private readonly currentThemeEl: HTMLElement;
  private readonly pageLabel: HTMLElement;
  private readonly prevBtn: HTMLButtonElement;
  private readonly nextBtn: HTMLButtonElement;

  private open = false;
  private busy = false;
  private index = 0;
  private leftPage: BinderPage | null = null;
  private rightPage: BinderPage | null = null;
  private readonly openListeners = new Set<(open: boolean) => void>();

  constructor(containerId: string) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    this.root = document.createElement('div');
    this.root.id = 'collection-root';
    this.root.setAttribute('aria-hidden', 'true');

    this.binder = document.createElement('div');
    this.binder.className = 'binder';

    // ---- top bar: section tabs + current set + close ----------------------
    const topbar = document.createElement('div');
    topbar.className = 'binder__topbar';

    this.setTabs = new SetTabs((setId) => this.goToSet(setId));

    const current = document.createElement('div');
    current.className = 'binder__current';
    this.currentNameEl = document.createElement('div');
    this.currentNameEl.className = 'binder__current-name';
    this.currentThemeEl = document.createElement('div');
    this.currentThemeEl.className = 'binder__current-theme';
    current.append(this.currentNameEl, this.currentThemeEl);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'binder__close';
    closeBtn.textContent = '\u2715';
    closeBtn.title = 'Close (Esc)';
    closeBtn.addEventListener('click', () => this.close());

    topbar.append(this.setTabs.el, current, closeBtn);

    // ---- full-width card-count strip --------------------------------------
    this.countStrip = new CardCountStrip();

    // ---- the open book ----------------------------------------------------
    this.flipBook = new FlipBook();

    // ---- footer: centred pager (turns between sets) -----------------------
    const footer = document.createElement('div');
    footer.className = 'binder__footer';
    const pager = document.createElement('div');
    pager.className = 'binder__pager';
    this.prevBtn = this.buildPagerButton('left', () => this.step(-1));
    this.pageLabel = document.createElement('span');
    this.pageLabel.className = 'binder__page-label';
    this.nextBtn = this.buildPagerButton('right', () => this.step(1));
    pager.append(this.prevBtn, this.pageLabel, this.nextBtn);
    footer.appendChild(pager);

    this.binder.append(topbar, this.countStrip.el, this.flipBook.el, footer);
    this.root.appendChild(this.binder);
    host.appendChild(this.root);

    interaction.registerHotElement(this.binder);
    this.bindGlobalInput();
    gameState.subscribe((data) => {
      if (this.open && !this.busy) this.applyState(data);
    });
  }

  // ---- public API ----------------------------------------------------------

  toggle(): void {
    this.open ? this.close() : this.show();
  }

  show(): void {
    if (this.open) return;
    this.open = true;
    const spread = this.buildSpread(this.index);
    this.adoptSpread(spread);
    this.flipBook.setSpread({ left: spread.left, right: spread.right });
    this.applyState(gameState.snapshot());
    this.root.classList.add('is-open');
    this.root.setAttribute('aria-hidden', 'false');
    this.emitOpen();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.root.classList.remove('is-open');
    this.root.setAttribute('aria-hidden', 'true');
    this.emitOpen();
  }

  isOpen(): boolean {
    return this.open;
  }

  /** Notify when the binder opens/closes (so the opener button can light up). */
  onOpenChange(listener: (open: boolean) => void): void {
    this.openListeners.add(listener);
    listener(this.open);
  }

  private emitOpen(): void {
    for (const listener of this.openListeners) listener(this.open);
  }

  // ---- navigation ----------------------------------------------------------

  private step(delta: number): void {
    void this.goTo(this.index + delta);
  }

  private goToSet(setId: string): void {
    const target = allSets().findIndex((set) => set.id === setId);
    if (target >= 0) void this.goTo(target);
  }

  /** Turn the book to a target spread, riffling one leaf at a time. */
  private async goTo(target: number): Promise<void> {
    const last = allSets().length - 1;
    const clamped = Math.max(0, Math.min(target, last));
    if (this.busy || clamped === this.index) return;
    this.busy = true;
    try {
      const dir = clamped > this.index ? 'forward' : 'backward';
      // A multi-set jump riffles quickly; a single step gets the full turn.
      const stepMs = Math.abs(clamped - this.index) > 1 ? 280 : 520;
      while (this.index !== clamped) {
        const nextIndex = this.index + (dir === 'forward' ? 1 : -1);
        const spread = this.buildSpread(nextIndex);
        this.adoptSpread(spread);
        await this.flipBook.flip(dir, { left: spread.left, right: spread.right }, stepMs);
        this.index = nextIndex;
        this.applyState(gameState.snapshot());
      }
    } finally {
      this.busy = false;
      this.applyState(gameState.snapshot());
    }
  }

  // ---- rendering -----------------------------------------------------------

  private applyState(data: Readonly<GameStateData>): void {
    const set = allSets()[this.index];
    if (!set) return;

    this.currentNameEl.textContent = set.name;
    this.currentThemeEl.textContent = set.theme;

    this.countStrip.setCards(set.cardIds);
    this.countStrip.update(data.collection);

    this.leftPage?.update(data.collection);
    this.rightPage?.update(data.collection);

    this.renderTabs(data);
    this.renderPager();
  }

  private renderTabs(data: Readonly<GameStateData>): void {
    const tabs: SetTabInfo[] = allSets().map((set) => ({
      id: set.id,
      name: set.name,
      // Every registered set is playable today; the locked path is reserved for
      // future not-yet-unlocked sets.
      unlocked: true,
      fraction: this.discoveredFraction(set.cardIds, data),
    }));
    this.setTabs.render(tabs, allSets()[this.index]?.id ?? '');
  }

  private renderPager(): void {
    const count = allSets().length;
    this.pageLabel.textContent = `${this.index + 1} / ${count}`;
    this.prevBtn.disabled = this.index <= 0 || this.busy;
    this.nextBtn.disabled = this.index >= count - 1 || this.busy;
  }

  // ---- building spreads ----------------------------------------------------

  /** Make the just-built spread the live one (its pockets get state updates). */
  private adoptSpread(spread: BuiltSpread): void {
    this.leftPage = spread.leftPage;
    this.rightPage = spread.rightPage;
  }

  private buildSpread(setIndex: number): BuiltSpread {
    const left = this.buildLeaf(setIndex, 'left');
    const right = this.buildLeaf(setIndex, 'right');
    return { left: left.el, right: right.el, leftPage: left.page, rightPage: right.page };
  }

  private buildLeaf(setIndex: number, side: 'left' | 'right'): { el: HTMLElement; page: BinderPage } {
    const leaf = document.createElement('div');
    leaf.className = `book-leaf book-leaf--${side}`;
    const page = new BinderPage();
    page.setCards(this.pocketCards(setIndex, side));
    page.update(gameState.snapshot().collection);
    leaf.appendChild(page.el);
    return { el: leaf, page };
  }

  private pocketCards(setIndex: number, side: 'left' | 'right'): PocketCard[] {
    const set = allSets()[setIndex];
    if (!set) return [];
    const start = side === 'left' ? 0 : PAGE_SIZE;
    return set.cardIds.slice(start, start + PAGE_SIZE).flatMap((cardId, offset) => {
      const card = getCard(cardId);
      if (!card) return [];
      return [
        {
          id: card.id,
          number: start + offset + 1,
          name: card.name,
          rarity: card.rarity,
          artKey: card.artKey,
          canHolo: rarityCanHolo(card.rarity),
        },
      ];
    });
  }

  private discoveredFraction(cardIds: string[], data: Readonly<GameStateData>): number {
    if (cardIds.length === 0) return 0;
    const found = cardIds.filter((id) => data.collection[id]?.discovered === true).length;
    return found / cardIds.length;
  }

  // ---- chrome + input ------------------------------------------------------

  private buildPagerButton(dir: 'left' | 'right', onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'binder__page-btn';
    btn.title = dir === 'left' ? 'Previous set' : 'Next set';
    const icon = document.createElement('img');
    icon.src = `/icons/chevron-${dir}.png`;
    icon.alt = dir === 'left' ? 'Previous' : 'Next';
    btn.appendChild(icon);
    btn.addEventListener('click', onClick);
    return btn;
  }

  private bindGlobalInput(): void {
    // Feed the cursor to the holo sheens (normalised 0..1, same as StockBar).
    const onMove = (event: PointerEvent | MouseEvent) => {
      if (!this.open) return;
      this.binder.style.setProperty('--mx', (event.clientX / window.innerWidth).toFixed(3));
      this.binder.style.setProperty('--my', (event.clientY / window.innerHeight).toFixed(3));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.open) {
        event.preventDefault();
        this.close();
      }
    });
  }
}
