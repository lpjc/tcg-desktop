import { getCard, getSet } from '../cards/cards';
import { rarityCanHolo, type Rarity } from '../cards/rarity';

/**
 * Pure pack-opening rolls. Given a set and the player's Luck, decide what 5 cards
 * a pack contains. This module is deliberately side-effect free (no game-state
 * writes, no animation) so it stays easy to reason about and test — the caller
 * (`ShopEconomy`) is what commits the result to collection + stock.
 *
 * Rules (see IMPLEMENTATION_PLAN §3.2 + the pack-loop design):
 *  - 5 cards, each rolled independently on a rarity table.
 *  - A pack is guaranteed at least one rare-or-better card.
 *  - Luck biases each roll toward higher rarities, but with diminishing returns
 *    for every non-common already pulled in the SAME pack (so all-chase packs
 *    stay rare even at high Luck).
 *  - Only rare/epic/chase can holo; common never does.
 */

export const PACK_SIZE = 5;

export interface RolledCard {
  cardId: string;
  rarity: Rarity;
  holo: boolean;
}

/** Relative chance of each rarity on a single base (Luck-free) roll. */
const BASE_RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 72,
  rare: 22,
  epic: 5,
  chase: 1,
};

/** Base holo chance for a holo-capable card, before Luck. */
const BASE_HOLO_CHANCE: Record<Rarity, number> = {
  common: 0,
  rare: 0.08,
  epic: 0.12,
  chase: 0.22,
};

/** Each Luck point multiplies the non-common weights by (1 + this). */
const LUCK_WEIGHT_GAIN = 0.12;
/** Each non-common already pulled in this pack damps Luck's push on later cards. */
const LUCK_DIMINISH_PER_HIT = 0.6;
/** Each Luck point adds this to a holo sub-roll (small, capped by chance ceiling). */
const LUCK_HOLO_GAIN = 0.004;
const HOLO_CHANCE_CEILING = 0.6;

const NON_COMMON: readonly Rarity[] = ['rare', 'epic', 'chase'];

/**
 * Roll a full pack from `setId`. Returns concrete cards (by id) drawn from the
 * set's pool at each rolled rarity. Empty when the set is unknown or has no cards.
 */
export function rollPack(setId: string, luck = 0): RolledCard[] {
  const pool = cardIdsByRarity(setId);
  if (pool === null) return [];

  const cards: RolledCard[] = [];
  let nonCommonPulled = 0;

  for (let i = 0; i < PACK_SIZE; i++) {
    const rarity = rollRarity(luck, nonCommonPulled);
    if (rarity !== 'common') nonCommonPulled += 1;
    cards.push(makeCard(pool, rarity, luck));
  }

  // Guarantee: if the whole pack came up common, upgrade one slot to rare+.
  if (nonCommonPulled === 0) {
    const rarity = rollNonCommonRarity(luck);
    cards[cards.length - 1] = makeCard(pool, rarity, luck);
  }

  return cards;
}

/** Roll a single card's rarity, with Luck damped by non-commons already pulled. */
function rollRarity(luck: number, nonCommonPulled: number): Rarity {
  const luckFactor = 1 + effectiveLuck(luck, nonCommonPulled) * LUCK_WEIGHT_GAIN;
  const weights: Record<Rarity, number> = {
    common: BASE_RARITY_WEIGHTS.common,
    rare: BASE_RARITY_WEIGHTS.rare * luckFactor,
    epic: BASE_RARITY_WEIGHTS.epic * luckFactor,
    chase: BASE_RARITY_WEIGHTS.chase * luckFactor,
  };
  return weightedRarity(weights);
}

/** Roll only among rare/epic/chase (used for the rare-or-better guarantee). */
function rollNonCommonRarity(luck: number): Rarity {
  const luckFactor = 1 + effectiveLuck(luck, 0) * LUCK_WEIGHT_GAIN;
  return weightedRarity({
    common: 0,
    rare: BASE_RARITY_WEIGHTS.rare,
    epic: BASE_RARITY_WEIGHTS.epic * luckFactor,
    chase: BASE_RARITY_WEIGHTS.chase * luckFactor,
  });
}

/** Luck after diminishing returns from non-commons already in this pack. */
function effectiveLuck(luck: number, nonCommonPulled: number): number {
  return Math.max(0, luck) / (1 + nonCommonPulled * LUCK_DIMINISH_PER_HIT);
}

function weightedRarity(weights: Record<Rarity, number>): Rarity {
  const total = NON_COMMON.reduce((sum, r) => sum + weights[r], weights.common);
  let roll = Math.random() * total;
  for (const rarity of ['common', ...NON_COMMON] as Rarity[]) {
    roll -= weights[rarity];
    if (roll <= 0) return rarity;
  }
  return 'common';
}

/** Pick a concrete card of `rarity` from the pool and roll its holo flag. */
function makeCard(pool: RarityPool, rarity: Rarity, luck: number): RolledCard {
  const cardId = pickFromPool(pool, rarity);
  const holo = rollHolo(cardId ? getCardRarity(cardId) : rarity, luck);
  return { cardId: cardId ?? '', rarity: cardId ? getCardRarity(cardId) : rarity, holo };
}

function rollHolo(rarity: Rarity, luck: number): boolean {
  if (!rarityCanHolo(rarity)) return false;
  const chance = Math.min(
    HOLO_CHANCE_CEILING,
    BASE_HOLO_CHANCE[rarity] + Math.max(0, luck) * LUCK_HOLO_GAIN,
  );
  return Math.random() < chance;
}

type RarityPool = Record<Rarity, string[]>;

/** Group a set's card ids by rarity; null when the set has no cards. */
function cardIdsByRarity(setId: string): RarityPool | null {
  const set = getSet(setId);
  if (!set || set.cardIds.length === 0) return null;
  const pool: RarityPool = { common: [], rare: [], epic: [], chase: [] };
  for (const id of set.cardIds) {
    const card = getCard(id);
    if (card) pool[card.rarity].push(id);
  }
  return pool;
}

/**
 * Random card of `rarity` from the pool. Falls back to the nearest lower rarity
 * that has cards (so a set missing a tier still yields a valid card).
 */
function pickFromPool(pool: RarityPool, rarity: Rarity): string | null {
  const order: Rarity[] = ['chase', 'epic', 'rare', 'common'];
  const start = order.indexOf(rarity);
  for (let i = start; i < order.length; i++) {
    const ids = pool[order[i]];
    if (ids.length > 0) return ids[Math.floor(Math.random() * ids.length)];
  }
  return null;
}

function getCardRarity(cardId: string): Rarity {
  return getCard(cardId)?.rarity ?? 'common';
}
