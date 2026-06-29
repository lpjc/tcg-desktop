import type { CollectionEntry } from '../../game/state/types';
import { getCard, getSet } from '../../game/cards/cards';
import { rarityCanHolo, type Rarity } from '../../game/cards/rarity';
import { rarityTokenColors } from '../../game/cards/rarityColors';
import { computeSetCompletion, type TierId } from '../../game/cards/setCompletion';
import './SetProgressBars.css';

/** The rarity brackets, in order; the holo bracket is appended after them. */
const RARITY_SECTIONS: Rarity[] = ['common', 'rare', 'epic', 'chase'];
const TIER_LABELS: Record<TierId, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  chase: 'Chase',
  holo: 'Holos',
};

interface Chip {
  el: HTMLElement;
  cardId: string;
}

interface Section {
  tier: TierId;
  bonus: HTMLElement;
  chips: Chip[];
}

/**
 * One compact completion bar for a whole set, split into bracket sections
 * (Common / Rare / Epic / Chase / Holos). Each section is a fanned row of
 * overlapping mini-cards — one per card in the bracket, lit when discovered,
 * a dark silhouette when not (the binder's found/undiscovered language, shrunk)
 * — with that bracket's prestige bonus sitting on top (a check when complete).
 *
 * The structure is rebuilt only when the set changes; re-applying the same set's
 * collection just toggles chips, so newly found cards light up in place (the
 * progress payoff after opening a pack) instead of redrawing.
 */
export class SetProgressBars {
  readonly el: HTMLDivElement;
  private builtSetId: string | null = null;
  private sections: Section[] = [];

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'set-progress';
  }

  /** Fill the bar from the player's collection for `setId`. */
  update(setId: string, collection: Readonly<Record<string, CollectionEntry>>): void {
    this.ensureBuilt(setId);
    this.el.classList.remove('set-progress--locked');

    const tiers = new Map(computeSetCompletion(setId, collection).tiers.map((t) => [t.id, t]));
    for (const section of this.sections) {
      for (const chip of section.chips) {
        const entry = collection[chip.cardId];
        const found =
          section.tier === 'holo'
            ? entry?.discovered === true && entry?.holo === true
            : entry?.discovered === true;
        chip.el.classList.toggle('is-found', found);
      }
      const tier = tiers.get(section.tier);
      if (tier) {
        section.bonus.textContent = tier.achieved ? '\u2713' : `+${tier.prestige}`;
        section.bonus.classList.toggle('is-complete', tier.achieved);
      }
    }
  }

  /** Show the set as a locked mystery: silhouette chips, hidden bonuses. */
  renderLocked(setId: string): void {
    this.ensureBuilt(setId);
    this.el.classList.add('set-progress--locked');
    for (const section of this.sections) {
      for (const chip of section.chips) chip.el.classList.remove('is-found');
      section.bonus.textContent = '?';
      section.bonus.classList.remove('is-complete');
    }
  }

  private ensureBuilt(setId: string): void {
    if (this.builtSetId === setId) return;
    this.build(setId);
    this.builtSetId = setId;
  }

  private build(setId: string): void {
    this.el.innerHTML = '';
    this.sections = [];

    const cardIds = getSet(setId)?.cardIds ?? [];
    const cards = cardIds.map((id) => getCard(id)).filter((c): c is NonNullable<typeof c> => !!c);

    for (const rarity of RARITY_SECTIONS) {
      const ids = cards.filter((c) => c.rarity === rarity).map((c) => c.id);
      this.appendSection(rarity, ids);
    }

    // The holo bracket spans every holo-capable card; each chip keeps its own
    // rarity tint so a chase holo still reads gold under the foil.
    const holoIds = cards.filter((c) => rarityCanHolo(c.rarity)).map((c) => c.id);
    this.appendSection('holo', holoIds);
  }

  private appendSection(tier: TierId, cardIds: string[]): void {
    const sectionEl = document.createElement('div');
    sectionEl.className = `set-progress__section set-progress__section--${tier}`;
    // A bracket the set has no cards for (e.g. a set with no epics) never grants
    // its bonus — dim it so it doesn't read as an unearned reward.
    if (cardIds.length === 0) sectionEl.classList.add('set-progress__section--empty');

    const bonus = document.createElement('span');
    bonus.className = 'set-progress__bonus';

    const chipRow = document.createElement('div');
    chipRow.className = 'set-progress__chips';

    const chips: Chip[] = [];
    for (const cardId of cardIds) {
      const rarity = getCard(cardId)?.rarity ?? 'common';
      const colors = rarityTokenColors(rarity);
      const chip = document.createElement('span');
      chip.className = 'set-progress__chip';
      if (tier === 'holo') chip.classList.add('set-progress__chip--holo');
      chip.style.setProperty('--c-base', colors.base);
      chip.style.setProperty('--c-hi', colors.hi);
      chip.style.setProperty('--c-edge', colors.edge);
      chipRow.appendChild(chip);
      chips.push({ el: chip, cardId });
    }

    const label = document.createElement('span');
    label.className = 'set-progress__section-label';
    label.textContent = TIER_LABELS[tier];

    sectionEl.append(bonus, chipRow, label);
    this.el.appendChild(sectionEl);
    this.sections.push({ tier, bonus, chips });
  }
}
