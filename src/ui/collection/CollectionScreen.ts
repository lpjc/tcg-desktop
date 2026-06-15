import { interaction } from '../../core/interaction';
import { allSets, getCard, getSet } from '../../game/cards/cards';
import { rarityCanHolo } from '../../game/cards/rarity';
import { rarityCardColors } from '../../game/cards/rarityColors';
import { computeSetCompletion, type CompletionTier } from '../../game/cards/setCompletion';
import { gameState, type GameStateData } from '../../game/state/GameState';
import { BinderPage, PAGE_SIZE } from './BinderPage';
import { SetTabs, type SetTabInfo } from './SetTabs';
import type { PocketCard } from './CardPocket';
import './CollectionScreen.css';

/**
 * The Collection binder: a chunky toy panel that floats up over a dimmed desktop
 * when the persistent Collection button is tapped. One set per spread, paged in
 * tens; left rail switches sets; the title bar shows discovery progress and the
 * footer the five completion tiers (and the prestige they grant).
 *
 * Renders as HTML/CSS over the Phaser band (IMPLEMENTATION_PLAN §1). It owns the
 * open/close lifecycle and feeds the cursor position to the holo foils.
 */
export class CollectionScreen {
  private readonly overlay: HTMLDivElement;
  private readonly binder: HTMLDivElement;
  private readonly titleEl: HTMLElement;
  private readonly themeEl: HTMLElement;
  private readonly iconEl: HTMLImageElement;
  private readonly progressFill: HTMLElement;
  private readonly progressLabel: HTMLElement;
  private readonly tiersEl: HTMLElement;
  private readonly prestigeEl: HTMLElement;
  private readonly pageLabel: HTMLElement;
  private readonly prevBtn: HTMLButtonElement;
  private readonly nextBtn: HTMLButtonElement;
  private readonly setTabs: SetTabs;
  private readonly page: BinderPage;

  private open = false;
  private activeSetId: string;
  private pageIndex = 0;
  private readonly openListeners = new Set<(open: boolean) => void>();

  constructor(containerId: string) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    this.activeSetId = allSets()[0]?.id ?? '';

    this.overlay = document.createElement('div');
    this.overlay.id = 'collection-overlay';
    this.overlay.setAttribute('aria-hidden', 'true');

    const scrim = document.createElement('div');
    scrim.className = 'collection-scrim';
    scrim.addEventListener('click', () => this.close());

    this.binder = document.createElement('div');
    this.binder.className = 'binder';

    // ---- title bar --------------------------------------------------------
    const titlebar = document.createElement('div');
    titlebar.className = 'binder__titlebar';

    this.iconEl = document.createElement('img');
    this.iconEl.className = 'binder__icon';
    this.iconEl.alt = '';
    this.iconEl.draggable = false;

    const titleWrap = document.createElement('div');
    titleWrap.className = 'binder__titles';
    this.titleEl = document.createElement('div');
    this.titleEl.className = 'binder__title';
    this.themeEl = document.createElement('div');
    this.themeEl.className = 'binder__theme';
    titleWrap.append(this.titleEl, this.themeEl);

    const progress = document.createElement('div');
    progress.className = 'binder__progress';
    const bar = document.createElement('div');
    bar.className = 'binder__bar';
    this.progressFill = document.createElement('div');
    this.progressFill.className = 'binder__bar-fill';
    bar.appendChild(this.progressFill);
    this.progressLabel = document.createElement('div');
    this.progressLabel.className = 'binder__count';
    progress.append(bar, this.progressLabel);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'binder__close';
    closeBtn.textContent = '\u2715';
    closeBtn.title = 'Close (Esc)';
    closeBtn.addEventListener('click', () => this.close());

    titlebar.append(this.iconEl, titleWrap, progress, closeBtn);

    // ---- body (tabs + page) ----------------------------------------------
    const body = document.createElement('div');
    body.className = 'binder__body';

    this.setTabs = new SetTabs((setId) => this.setActiveSet(setId));

    const pagePanel = document.createElement('div');
    pagePanel.className = 'binder__page-panel';
    this.page = new BinderPage();
    pagePanel.appendChild(this.page.el);

    body.append(this.setTabs.el, pagePanel);

    // ---- footer (tiers + pager) ------------------------------------------
    const footer = document.createElement('div');
    footer.className = 'binder__footer';

    const prestigeWrap = document.createElement('div');
    prestigeWrap.className = 'binder__prestige';
    const star = document.createElement('img');
    star.className = 'binder__prestige-icon';
    star.src = '/icons/star.png';
    star.alt = '';
    this.prestigeEl = document.createElement('span');
    this.prestigeEl.className = 'binder__prestige-val';
    prestigeWrap.append(star, this.prestigeEl);

    this.tiersEl = document.createElement('div');
    this.tiersEl.className = 'binder__tiers';

    const pager = document.createElement('div');
    pager.className = 'binder__pager';
    this.prevBtn = this.buildPagerButton('left', () => this.gotoPage(this.pageIndex - 1));
    this.pageLabel = document.createElement('span');
    this.pageLabel.className = 'binder__page-label';
    this.nextBtn = this.buildPagerButton('right', () => this.gotoPage(this.pageIndex + 1));
    pager.append(this.prevBtn, this.pageLabel, this.nextBtn);

    footer.append(prestigeWrap, this.tiersEl, pager);

    this.binder.append(titlebar, body, footer);
    this.overlay.append(scrim, this.binder);
    host.appendChild(this.overlay);

    interaction.registerHotElement(this.overlay);
    this.bindGlobalInput();
    // Only repaint while open; the binder reads fresh state each time it opens.
    gameState.subscribe((data) => {
      if (this.open) this.render(data);
    });
  }

  // ---- public API ----------------------------------------------------------

  toggle(): void {
    this.open ? this.close() : this.show();
  }

  show(): void {
    if (this.open) return;
    this.open = true;
    this.pageIndex = 0;
    this.rebuildPage();
    this.render(gameState.snapshot());
    this.overlay.classList.add('is-open');
    this.overlay.setAttribute('aria-hidden', 'false');
    this.emitOpen();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.overlay.classList.remove('is-open');
    this.overlay.setAttribute('aria-hidden', 'true');
    this.emitOpen();
  }

  isOpen(): boolean {
    return this.open;
  }

  /** Notify when the binder opens/closes (e.g. so the opener button can light up). */
  onOpenChange(listener: (open: boolean) => void): void {
    this.openListeners.add(listener);
    listener(this.open);
  }

  private emitOpen(): void {
    for (const listener of this.openListeners) listener(this.open);
  }

  // ---- rendering -----------------------------------------------------------

  private render(data: Readonly<GameStateData>): void {
    const set = getSet(this.activeSetId);
    if (!set) return;

    const completion = computeSetCompletion(this.activeSetId, data.collection);

    this.iconEl.src = this.setIconArt(this.activeSetId);
    this.titleEl.textContent = set.name;
    this.themeEl.textContent = set.theme;
    this.progressFill.style.width = `${Math.round(completion.fraction * 100)}%`;
    this.progressLabel.textContent = `${completion.discovered}/${completion.total}`;
    this.prestigeEl.textContent = `+${completion.prestige}`;

    this.renderTiers(completion.tiers);
    this.renderTabs(data);
    this.page.update(data.collection);
    this.renderPager();
  }

  private renderTiers(tiers: CompletionTier[]): void {
    this.tiersEl.replaceChildren();
    for (const tier of tiers) {
      const pip = document.createElement('div');
      pip.className = 'tier-pip';
      pip.dataset.achieved = tier.achieved ? 'yes' : 'no';
      pip.title = `${tier.label}: ${tier.have}/${tier.need} \u2192 +${tier.cumulativePrestige} prestige`;
      if (tier.id === 'holo') {
        pip.classList.add('tier-pip--holo');
      } else {
        pip.style.setProperty('--pip', rarityCardColors(tier.id).base);
      }
      const val = document.createElement('span');
      val.className = 'tier-pip__val';
      val.textContent = `+${tier.cumulativePrestige}`;
      pip.appendChild(val);
      this.tiersEl.appendChild(pip);
    }
  }

  private renderTabs(data: Readonly<GameStateData>): void {
    const tabs: SetTabInfo[] = allSets().map((set) => ({
      id: set.id,
      name: set.name,
      // Every registered set is active content the player participates in; the
      // locked-tab path is reserved for future not-yet-unlocked sets.
      unlocked: true,
      fraction: computeSetCompletion(set.id, data.collection).fraction,
    }));
    this.setTabs.render(tabs, this.activeSetId);
  }

  private renderPager(): void {
    const pages = this.pageCount();
    this.pageLabel.textContent = `${this.pageIndex + 1} / ${pages}`;
    this.prevBtn.disabled = this.pageIndex <= 0;
    this.nextBtn.disabled = this.pageIndex >= pages - 1;
  }

  // ---- navigation ----------------------------------------------------------

  private setActiveSet(setId: string): void {
    if (setId === this.activeSetId) return;
    this.activeSetId = setId;
    this.pageIndex = 0;
    this.rebuildPage();
    this.render(gameState.snapshot());
  }

  private gotoPage(index: number): void {
    const clamped = Math.max(0, Math.min(index, this.pageCount() - 1));
    if (clamped === this.pageIndex) return;
    this.pageIndex = clamped;
    this.rebuildPage();
    this.page.update(gameState.snapshot().collection);
    this.renderPager();
  }

  /** Rebuild the visible pockets for the current set + page, then apply state. */
  private rebuildPage(): void {
    const cards = this.pocketCardsForPage();
    this.page.setCards(cards);
    this.page.update(gameState.snapshot().collection);
  }

  // ---- data helpers --------------------------------------------------------

  private pocketCardsForPage(): PocketCard[] {
    const set = getSet(this.activeSetId);
    if (!set) return [];
    const start = this.pageIndex * PAGE_SIZE;
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

  private pageCount(): number {
    const set = getSet(this.activeSetId);
    const total = set?.cardIds.length ?? 0;
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }

  /** A set's signature art = its rarest (last) card's monster. */
  private setIconArt(setId: string): string {
    const set = getSet(setId);
    const lastId = set?.cardIds[set.cardIds.length - 1];
    return (lastId && getCard(lastId)?.artKey) || '/icons/collection.png';
  }

  private buildPagerButton(dir: 'left' | 'right', onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'binder__page-btn';
    btn.title = dir === 'left' ? 'Previous page' : 'Next page';
    const icon = document.createElement('img');
    icon.src = `/icons/chevron-${dir}.png`;
    icon.alt = dir === 'left' ? 'Previous' : 'Next';
    btn.appendChild(icon);
    btn.addEventListener('click', onClick);
    return btn;
  }

  private bindGlobalInput(): void {
    // Feed the cursor to the holo foils (normalised 0..1, same idea as StockBar).
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
