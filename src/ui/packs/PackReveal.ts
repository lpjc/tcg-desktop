import { audio } from '../../audio/audio';
import { rarityCardColors, rarityTokenColors } from '../../game/cards/rarityColors';
import type { RippedCard } from '../../game/economy/ShopEconomy';
import { gameState } from '../../game/state/GameState';
import type { CollectionEntry } from '../../game/state/types';
import { SetProgressBars } from '../progress/SetProgressBars';
import './PackReveal.css';

/** Pack-cover tear time before the cards fan out. */
const TEAR_MS = 720;
/** Stagger between cards as they fan into the row. */
const FAN_STAGGER_MS = 90;
/** Stagger used by 'Reveal All'. */
const REVEAL_ALL_STAGGER_MS = 140;
/** Delay after a flip starts before the "+1 to stock" token floats up. */
const GAIN_DELAY_MS = 220;

export interface RevealBeginOptions {
  setId: string;
  setName: string;
  accent: string;
  cards: RippedCard[];
  /**
   * The collection as it was *before* this pack was ripped. The progress bar
   * shows this pre-pack state through the tear and flips, then animates to the
   * committed (post-pack) state on the summary — the payoff — so nothing is
   * spoiled while the cards are still face-down.
   */
  preCollection: Readonly<Record<string, CollectionEntry>>;
  /** Whether the active set still has packs after this one (drives 'Open Another'). */
  hasMorePacks: () => boolean;
  onOpenAnother: () => void;
  onBack: () => void;
}

/**
 * The pack-opening reveal: a soft pack tear, then the five pulls fan out
 * face-down. The player clicks each to flip it (or 'Reveal All'); flips carry
 * the emphasis language — rarity-scaled glow, an entrance flash, lingering
 * NEW!/HOLO! tags, and a "+1 to stock" token that floats up. Once all five are
 * up, the (frozen) progress bar animates to its post-pack state.
 *
 * Layout is fixed from the first frame — cards stage, progress bar, then a
 * footer button row — so revealing the final card never shifts anything; the
 * summary only animates the bar's fills and swaps the footer's buttons.
 *
 * The reveal is a presentation over an already-committed result: `ripPack` ran
 * before this began, so the pulls' new/holo flags are frozen on each card and
 * cannot be spoiled by live state. Closing mid-reveal does not roll anything
 * back; the cards are already in the collection and stock.
 */
export class PackReveal {
  readonly el: HTMLDivElement;
  private readonly stage: HTMLDivElement;
  private readonly footer: HTMLDivElement;
  private readonly track = new SetProgressBars();

  private cards: RippedCard[] = [];
  private cardEls: HTMLElement[] = [];
  private flipped = 0;
  private opts: RevealBeginOptions | null = null;
  private timers: number[] = [];

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'pack-reveal';

    this.stage = document.createElement('div');
    this.stage.className = 'pack-reveal__stage';

    this.footer = document.createElement('div');
    this.footer.className = 'pack-reveal__footer';

    // Order is permanent: cards, then the progress bar, then the buttons. Each
    // region holds its own height so the summary causes no layout shift.
    this.el.append(this.stage, this.track.el, this.footer);
  }

  /** Start a fresh reveal for one ripped pack. */
  begin(opts: RevealBeginOptions): void {
    this.reset();
    this.opts = opts;
    this.cards = opts.cards;
    this.flipped = 0;

    // Seed the bar with pre-pack progress so it's present (no shift) and frozen
    // until the summary reveals the gains.
    this.track.update(opts.setId, opts.preCollection);

    const tearer = document.createElement('div');
    tearer.className = 'pack-tear';
    tearer.style.setProperty('--accent', opts.accent);
    const tearName = document.createElement('span');
    tearName.className = 'pack-tear__name';
    tearName.textContent = opts.setName;
    tearer.appendChild(tearName);
    this.stage.appendChild(tearer);

    // Kick the tear animation, then swap to the fanned cards.
    this.timers.push(
      window.setTimeout(() => {
        tearer.classList.add('pack-tear--ripping');
        audio.playSfx('rip');
      }, 30),
    );
    this.timers.push(window.setTimeout(() => this.showCards(), TEAR_MS));
  }

  private showCards(): void {
    this.stage.innerHTML = '';
    this.cardEls = [];

    const row = document.createElement('div');
    row.className = 'pack-reveal__row';

    this.cards.forEach((card, i) => {
      const el = this.buildCard(card, i);
      row.appendChild(el);
      this.cardEls.push(el);
      // Fan in with a stagger.
      this.timers.push(
        window.setTimeout(() => el.classList.add('reveal-card--in'), i * FAN_STAGGER_MS),
      );
    });

    this.stage.appendChild(row);

    const revealAll = button(
      'Reveal All',
      'pack-action-btn pack-action-btn--ghost',
      () => this.revealAll(),
    );
    this.footer.appendChild(revealAll);
  }

  private buildCard(card: RippedCard, index: number): HTMLElement {
    const colors = rarityCardColors(card.rarity);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `reveal-card reveal-card--${card.rarity}`;
    if (card.holo) el.classList.add('reveal-card--holo');
    el.style.setProperty('--r-base', colors.base);
    el.style.setProperty('--r-hi', colors.hi);
    el.style.setProperty('--r-edge', colors.edge);
    el.style.setProperty('--r-glow', colors.glow);
    el.style.setProperty('--r-deep', colors.deep);

    // The glow lives on the card root (not the face) so it haloes the card even
    // while it's back-facing — letting the player anticipate the rarity before
    // the flip ("ooh, a chase — which one?!").
    const glow = span('reveal-card__glow');

    const inner = document.createElement('span');
    inner.className = 'reveal-card__inner';

    const back = document.createElement('span');
    back.className = 'reveal-card__back';

    const face = document.createElement('span');
    face.className = 'reveal-card__face';
    face.append(
      span('reveal-card__flash'),
      this.buildLabels(card),
      span('reveal-card__holo'),
      this.buildArt(card),
      this.buildName(card),
    );

    inner.append(back, face);
    el.append(glow, inner);
    el.addEventListener('click', () => this.flipCard(index));
    return el;
  }

  private buildLabels(card: RippedCard): HTMLElement {
    const labels = document.createElement('span');
    labels.className = 'reveal-card__labels';
    if (card.isNew || card.isNewHolo || card.firstFindBonus) {
      const tag = document.createElement('span');
      tag.className = 'reveal-card__label reveal-card__label--new';
      tag.textContent = 'NEW!';
      labels.appendChild(tag);
    }
    if (card.holo) {
      const tag = document.createElement('span');
      tag.className = 'reveal-card__label reveal-card__label--holo';
      tag.textContent = 'HOLO!';
      labels.appendChild(tag);
    }
    return labels;
  }

  private buildArt(card: RippedCard): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = 'reveal-card__art';
    if (card.artKey) {
      const img = document.createElement('img');
      img.src = card.artKey;
      img.alt = '';
      img.draggable = false;
      wrap.appendChild(img);
    }
    return wrap;
  }

  private buildName(card: RippedCard): HTMLElement {
    const name = document.createElement('span');
    name.className = 'reveal-card__name';
    name.textContent = card.name;
    return name;
  }

  private flipCard(index: number): void {
    const el = this.cardEls[index];
    if (!el || el.classList.contains('reveal-card--flipped')) return;
    el.classList.add('reveal-card--flipped');

    const card = this.cards[index];
    audio.playSfx('flip');
    // Big pulls get a stinger on top of the flip.
    if (card && (card.holo || card.rarity === 'epic' || card.rarity === 'chase')) {
      audio.playSfx('rare');
    }

    // As the face turns up, a "+1 to stock" token floats off the card — the
    // pull is already banked in the stock pile of its rarity.
    if (card) this.timers.push(window.setTimeout(() => this.spawnGain(el, card), GAIN_DELAY_MS));

    this.flipped += 1;
    if (this.flipped >= this.cards.length) {
      this.timers.push(window.setTimeout(() => this.showSummary(), 520));
    }
  }

  /** A small rarity-coloured stock token that floats up off a just-flipped card. */
  private spawnGain(cardEl: HTMLElement, card: RippedCard): void {
    const colors = rarityTokenColors(card.rarity);
    const gain = document.createElement('span');
    gain.className = 'reveal-gain';

    const plus = document.createElement('span');
    plus.className = 'reveal-gain__plus';
    plus.textContent = '+';

    const token = document.createElement('span');
    token.className = 'reveal-gain__token';
    if (card.holo) token.classList.add('is-holo');
    token.style.setProperty('--c-base', colors.base);
    token.style.setProperty('--c-hi', colors.hi);
    token.style.setProperty('--c-edge', colors.edge);

    gain.append(plus, token);
    cardEl.appendChild(gain);
    this.timers.push(window.setTimeout(() => gain.remove(), 1000));
  }

  private revealAll(): void {
    this.cardEls.forEach((el, i) => {
      if (el.classList.contains('reveal-card--flipped')) return;
      this.timers.push(window.setTimeout(() => this.flipCard(i), i * REVEAL_ALL_STAGGER_MS));
    });
  }

  private showSummary(): void {
    if (!this.opts) return;

    // The same bar that was frozen at pre-pack progress now animates to the
    // committed (post-rip) collection — chips light up in place as the payoff.
    this.track.update(this.opts.setId, gameState.snapshot().collection);

    this.footer.innerHTML = '';
    if (this.opts.hasMorePacks()) {
      this.footer.appendChild(
        button('Open Another', 'pack-action-btn pack-action-btn--primary', () =>
          this.opts?.onOpenAnother(),
        ),
      );
    }
    this.footer.appendChild(button('Back', 'pack-action-btn', () => this.opts?.onBack()));
  }

  /** Tear down any in-flight reveal (timers + DOM) so a new one starts clean. */
  reset(): void {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
    this.stage.innerHTML = '';
    this.footer.innerHTML = '';
    this.cardEls = [];
    this.cards = [];
    this.flipped = 0;
  }
}

function span(className: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  return el;
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}
