import { getCard, getSet } from './cards';
import { rarityCanHolo, type Rarity } from './rarity';
import type { CollectionEntry } from '../state/types';

/**
 * Per-set completion: the binder rewards five tiers, each its own condition
 * (IMPLEMENTATION_PLAN §2.5). The tiers are independent, but the prestige the
 * brief quotes — **+1 / 3 / 6 / 10 / 15** — is *cumulative*: each tier adds
 * 1, 2, 3, 4, 5 prestige, so completing all five totals 15.
 *
 *  | tier   | condition (all of …)                         | +prestige | cumulative |
 *  |--------|----------------------------------------------|-----------|------------|
 *  | common | common cards discovered                      | +1        | 1          |
 *  | rare   | rare cards discovered                        | +2        | 3          |
 *  | epic   | epic cards discovered                        | +3        | 6          |
 *  | chase  | chase cards discovered                       | +4        | 10         |
 *  | holo   | rare/epic/chase cards discovered **in holo** | +5        | 15         |
 *
 * A tier with no cards in the set (e.g. a set with no epics) is never "achieved"
 * and grants no prestige, so empty tiers can't hand out a free bonus.
 */
export type TierId = Rarity | 'holo';

export interface CompletionTier {
  id: TierId;
  label: string;
  /** Cumulative prestige milestone shown on the tier pip (1/3/6/10/15). */
  cumulativePrestige: number;
  /** Prestige this tier alone adds when achieved (1/2/3/4/5). */
  prestige: number;
  achieved: boolean;
  have: number;
  need: number;
}

export interface SetCompletion {
  setId: string;
  /** Distinct cards ever discovered in the set. */
  discovered: number;
  total: number;
  /** 0..1 discovery progress, for the title-bar bar. */
  fraction: number;
  tiers: CompletionTier[];
  /** Sum of prestige from achieved tiers (0..15). */
  prestige: number;
}

const TIER_LABELS: Record<TierId, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  chase: 'Chase',
  holo: 'Holo',
};

/** Prestige added by each tier, in order — cumulative totals are 1/3/6/10/15. */
const TIER_PRESTIGE: Record<TierId, number> = {
  common: 1,
  rare: 2,
  epic: 3,
  chase: 4,
  holo: 5,
};

const TIER_ORDER: TierId[] = ['common', 'rare', 'epic', 'chase', 'holo'];

function isDiscovered(entry: CollectionEntry | undefined): boolean {
  return entry?.discovered === true;
}

/** Compute completion + tiers + prestige for a set given the player's collection. */
export function computeSetCompletion(
  setId: string,
  collection: Readonly<Record<string, CollectionEntry>>,
): SetCompletion {
  const set = getSet(setId);
  const cardIds = set?.cardIds ?? [];

  let discovered = 0;
  let cumulative = 0;
  const tiers: CompletionTier[] = TIER_ORDER.map((id) => {
    cumulative += TIER_PRESTIGE[id];
    return {
      id,
      label: TIER_LABELS[id],
      cumulativePrestige: cumulative,
      prestige: TIER_PRESTIGE[id],
      achieved: false,
      have: 0,
      need: 0,
    };
  });
  const tierById = new Map(tiers.map((tier) => [tier.id, tier]));

  for (const cardId of cardIds) {
    const card = getCard(cardId);
    if (!card) continue;
    const entry = collection[cardId];
    const discoveredHere = isDiscovered(entry);
    if (discoveredHere) discovered += 1;

    // Rarity tier: how many of this rarity exist vs are discovered.
    const rarityTier = tierById.get(card.rarity);
    if (rarityTier) {
      rarityTier.need += 1;
      if (discoveredHere) rarityTier.have += 1;
    }

    // Holo tier: only holo-capable cards count, and only when discovered in holo.
    if (rarityCanHolo(card.rarity)) {
      const holoTier = tierById.get('holo')!;
      holoTier.need += 1;
      if (discoveredHere && entry?.holo) holoTier.have += 1;
    }
  }

  let prestige = 0;
  for (const tier of tiers) {
    tier.achieved = tier.need > 0 && tier.have >= tier.need;
    if (tier.achieved) prestige += tier.prestige;
  }

  const total = cardIds.length;
  return {
    setId,
    discovered,
    total,
    fraction: total > 0 ? discovered / total : 0,
    tiers,
    prestige,
  };
}
