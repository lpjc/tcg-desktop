import { interaction } from '../../core/interaction';
import { allSets, type CardSet } from '../../game/cards/cards';
import { shopEconomy } from '../../game/economy/ShopEconomy';
import { gameState, type GameStateData } from '../../game/state/GameState';
import type { CollectionEntry } from '../../game/state/types';
import { SetProgressBars } from '../progress/SetProgressBars';
import { PackReveal } from './PackReveal';
import './PackOpenScreen.css';

/** Per-set accent colours (shared order with the vending machine + head packs). */
const SET_ACCENTS = ['#e0563b', '#3b7fe0', '#6fb83b', '#b85fd8', '#e0a93b', '#3bc6c0'];

type Phase = 'carousel' | 'reveal';

/**
 * The pack-opening overlay: a peer of the collection binder that slides up from
 * the bottom and floats over the world (no scrim, desktop stays live behind it).
 * It is a carousel of every set — the focused set shows full detail (pack cover,
 * the five completion bars, pending-pack count, an Open Pack! button), while the
 * neighbours peek in at the sides. Locked sets stay a mystery ('?' cover, '???'
 * name, blanked bars, no Open button).
 *
 * Opening a pack rips it immediately (committing collection + stock + prestige),
 * then hands the frozen pulls to `PackReveal` for a purely cosmetic flip reveal.
 * Buying still happens in-world at the vending machine; this overlay only
 * consumes the `pendingPacks` queue.
 */
export class PackOpenScreen {
  private readonly root: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly carousel: HTMLDivElement;
  private readonly reveal = new PackReveal();
  private readonly focusBars = new SetProgressBars();

  private open = false;
  private phase: Phase = 'carousel';
  private index = 0;
  /** Single-flight guard so a double-click can't rip two packs. */
  private busyRip = false;
  private readonly openListeners = new Set<(open: boolean) => void>();

  constructor(containerId: string) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    this.root = document.createElement('div');
    this.root.id = 'pack-root';
    this.root.setAttribute('aria-hidden', 'true');

    this.panel = document.createElement('div');
    this.panel.className = 'pack-panel';
    this.panel.dataset.phase = 'carousel';

    const header = document.createElement('div');
    header.className = 'pack-panel__header';
    const title = document.createElement('div');
    title.className = 'pack-panel__title';
    title.textContent = 'Open Packs';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'pack-panel__close';
    close.textContent = '\u2715';
    close.title = 'Close (Esc)';
    close.addEventListener('click', () => this.close());
    header.append(title, close);

    this.carousel = document.createElement('div');
    this.carousel.className = 'pack-carousel';

    this.panel.append(header, this.carousel, this.reveal.el);
    this.root.appendChild(this.panel);
    host.appendChild(this.root);

    // The panel captures pointer events so clicks never route to the world
    // behind it; it is registered hot so it stays clickable through the overlay.
    interaction.registerHotElement(this.panel);
    this.bindGlobalInput();
    gameState.subscribe((data) => {
      if (this.open && this.phase === 'carousel') this.renderCarousel(data);
    });
  }

  // ---- public API ----------------------------------------------------------

  toggle(): void {
    this.open ? this.close() : this.show();
  }

  show(): void {
    if (this.open) return;
    this.open = true;
    this.setPhase('carousel');
    this.index = this.pickInitialIndex(gameState.snapshot());
    this.renderCarousel(gameState.snapshot());
    this.root.classList.add('is-open');
    this.root.setAttribute('aria-hidden', 'false');
    this.emitOpen();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    // Closing mid-reveal does not roll back the pack — the pulls are already
    // committed. We just drop the cosmetic reveal and reset to the carousel.
    this.reveal.reset();
    this.setPhase('carousel');
    this.root.classList.remove('is-open');
    this.root.setAttribute('aria-hidden', 'true');
    this.emitOpen();
  }

  isOpen(): boolean {
    return this.open;
  }

  onOpenChange(listener: (open: boolean) => void): void {
    this.openListeners.add(listener);
    listener(this.open);
  }

  // ---- carousel -------------------------------------------------------------

  private renderCarousel(data: Readonly<GameStateData>): void {
    const sets = allSets();
    this.carousel.innerHTML = '';
    if (sets.length === 0) return;
    this.index = ((this.index % sets.length) + sets.length) % sets.length;

    const multi = sets.length > 1;
    const prevIdx = (this.index - 1 + sets.length) % sets.length;
    const nextIdx = (this.index + 1) % sets.length;

    const arrowLeft = this.buildArrow('left', () => this.navigate(-1), multi);
    const arrowRight = this.buildArrow('right', () => this.navigate(1), multi);

    const stage = document.createElement('div');
    stage.className = 'pack-stage';
    if (multi) stage.appendChild(this.buildPeek(sets[prevIdx], data, () => this.navigate(-1)));
    stage.appendChild(this.buildFocused(sets[this.index], data));
    if (multi) stage.appendChild(this.buildPeek(sets[nextIdx], data, () => this.navigate(1)));

    this.carousel.append(arrowLeft, stage, arrowRight);
  }

  private buildFocused(set: CardSet, data: Readonly<GameStateData>): HTMLElement {
    const unlocked = data.unlockedSets.includes(set.id);
    const count = packCountForSet(set.id, data.pendingPacks);
    const accent = accentFor(set.id);

    const card = document.createElement('div');
    card.className = 'set-card';

    const pack = document.createElement('div');
    pack.className = 'set-card__pack';
    pack.style.setProperty('--accent', accent);
    if (!unlocked) {
      pack.classList.add('set-card__pack--locked');
      pack.textContent = '?';
    } else {
      const packName = document.createElement('span');
      packName.className = 'set-card__pack-name';
      packName.textContent = set.name;
      pack.appendChild(packName);
    }

    const title = document.createElement('div');
    title.className = 'set-card__title';
    title.textContent = unlocked ? set.name : '???';

    const theme = document.createElement('div');
    theme.className = 'set-card__theme';
    theme.textContent = unlocked ? set.theme : 'Locked set';

    if (unlocked) this.focusBars.update(set.id, data.collection);
    else this.focusBars.renderLocked(set.id);

    const count_el = document.createElement('div');
    count_el.className = 'set-card__count';
    count_el.textContent = unlocked ? (count > 0 ? `${count} pack${count === 1 ? '' : 's'}` : 'No packs') : 'Locked';

    card.append(pack, title, theme, this.focusBars.el, count_el);

    if (unlocked) {
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'pack-action-btn pack-action-btn--primary set-card__open';
      open.textContent = 'Open Pack!';
      open.disabled = count <= 0 || this.busyRip;
      open.addEventListener('click', () => this.openPack(set.id));
      card.appendChild(open);
    }

    return card;
  }

  private buildPeek(
    set: CardSet,
    data: Readonly<GameStateData>,
    onClick: () => void,
  ): HTMLElement {
    const unlocked = data.unlockedSets.includes(set.id);
    const peek = document.createElement('button');
    peek.type = 'button';
    peek.className = 'pack-peek';

    const mini = document.createElement('div');
    mini.className = 'pack-peek__pack';
    mini.style.setProperty('--accent', accentFor(set.id));
    if (!unlocked) {
      mini.classList.add('pack-peek__pack--locked');
      mini.textContent = '?';
    }

    const name = document.createElement('span');
    name.className = 'pack-peek__name';
    name.textContent = unlocked ? set.name : '???';

    peek.append(mini, name);
    peek.addEventListener('click', onClick);
    return peek;
  }

  private buildArrow(dir: 'left' | 'right', onClick: () => void, enabled: boolean): HTMLElement {
    const arrow = document.createElement('button');
    arrow.type = 'button';
    arrow.className = `pack-arrow pack-arrow--${dir}`;
    arrow.textContent = dir === 'left' ? '\u2039' : '\u203a';
    arrow.disabled = !enabled;
    arrow.addEventListener('click', onClick);
    return arrow;
  }

  private navigate(dir: number): void {
    const sets = allSets();
    if (sets.length <= 1) return;
    this.index = (this.index + dir + sets.length) % sets.length;
    this.renderCarousel(gameState.snapshot());
  }

  // ---- opening + reveal -----------------------------------------------------

  private openPack(setId: string): void {
    if (this.busyRip) return;
    this.busyRip = true;

    // Switch to the reveal phase BEFORE committing so the carousel subscriber
    // skips rebuilding (and never flashes the decremented count / updated bars)
    // while the rip commits underneath.
    this.setPhase('reveal');

    // Snapshot the collection before the rip; the reveal shows this pre-pack
    // progress through the flips and only animates to the committed state on the
    // summary, so the bar never spoils what's still face-down.
    const preCollection = cloneCollection(gameState.snapshot().collection);

    // Commit immediately (no held-count callback): the reveal is cosmetic over
    // an already-committed result, so the pulls can't be spoiled by live state.
    const cards = shopEconomy.ripPack(setId);
    this.busyRip = false;

    if (!cards || cards.length === 0) {
      this.toCarousel();
      return;
    }

    this.reveal.begin({
      setId,
      setName: setNameFor(setId),
      accent: accentFor(setId),
      cards,
      preCollection,
      hasMorePacks: () => packCountForSet(setId, gameState.snapshot().pendingPacks) > 0,
      onOpenAnother: () => this.openPack(setId),
      onBack: () => this.toCarousel(),
    });
  }

  private toCarousel(): void {
    this.reveal.reset();
    this.setPhase('carousel');
    this.renderCarousel(gameState.snapshot());
  }

  private setPhase(phase: Phase): void {
    this.phase = phase;
    this.panel.dataset.phase = phase;
  }

  // ---- helpers --------------------------------------------------------------

  /** Focus the first set with packs waiting, else the first unlocked set. */
  private pickInitialIndex(data: Readonly<GameStateData>): number {
    const sets = allSets();
    const withPacks = sets.findIndex(
      (s) => packCountForSet(s.id, data.pendingPacks) > 0,
    );
    if (withPacks >= 0) return withPacks;
    const unlocked = sets.findIndex((s) => data.unlockedSets.includes(s.id));
    return unlocked >= 0 ? unlocked : 0;
  }

  private bindGlobalInput(): void {
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.open) {
        event.preventDefault();
        this.close();
      }
    });
  }

  private emitOpen(): void {
    for (const listener of this.openListeners) listener(this.open);
  }
}

/** Deep-copy the collection so a later in-place discover can't mutate the snapshot. */
function cloneCollection(
  collection: Readonly<Record<string, CollectionEntry>>,
): Record<string, CollectionEntry> {
  const copy: Record<string, CollectionEntry> = {};
  for (const [id, entry] of Object.entries(collection)) {
    copy[id] = { discovered: entry.discovered, holo: entry.holo };
  }
  return copy;
}

function packCountForSet(setId: string, pendingPacks: readonly string[]): number {
  let n = 0;
  for (const id of pendingPacks) if (id === setId) n += 1;
  return n;
}

function accentFor(setId: string): string {
  const idx = allSets().findIndex((s) => s.id === setId);
  return SET_ACCENTS[(idx < 0 ? 0 : idx) % SET_ACCENTS.length];
}

function setNameFor(setId: string): string {
  return allSets().find((s) => s.id === setId)?.name ?? setId;
}
