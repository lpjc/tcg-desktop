import { PILE_IDS, type PileId } from '../cards/piles';

/**
 * The kind of convention visitor that just arrived. Different visitors want
 * different piles, which is what makes the spawn exciting ("oh, a whale!").
 * Rare visitors (collector/whale) become more common as Prestige rises.
 */
export interface VisitorProfile {
  id: 'normal' | 'collector' | 'whale';
  label: string;
  /** Base relative chance of spawning (before Prestige scaling). */
  spawnWeight: number;
  /** Whether Prestige boosts this visitor's spawn chance. */
  rare: boolean;
  /** Relative buy preference per pile (0 = never buys that pile). */
  buy: Record<PileId, number>;
}

function buyWeights(weights: Partial<Record<PileId, number>>): Record<PileId, number> {
  const full = {} as Record<PileId, number>;
  for (const id of PILE_IDS) full[id] = weights[id] ?? 0;
  return full;
}

export const VISITOR_PROFILES: readonly VisitorProfile[] = [
  {
    id: 'normal',
    label: 'Visitor',
    spawnWeight: 100,
    rare: false,
    buy: buyWeights({ common: 10, rare: 4, epic: 1, rareHolo: 1 }),
  },
  {
    id: 'collector',
    label: 'Collector',
    spawnWeight: 18,
    rare: true,
    buy: buyWeights({ common: 2, rare: 8, epic: 6, chase: 1, rareHolo: 4, epicHolo: 3 }),
  },
  {
    id: 'whale',
    label: 'Whale',
    spawnWeight: 4,
    rare: true,
    buy: buyWeights({ rare: 2, epic: 6, chase: 8, rareHolo: 3, epicHolo: 6, chaseHolo: 6 }),
  },
];

/** Each Prestige point raises rare visitors' spawn weight by this fraction. */
const PRESTIGE_RARE_BONUS = 0.05;

/** Pick a visitor profile, with Prestige tilting toward the rare ones. */
export function pickVisitorProfile(prestige: number): VisitorProfile {
  const rareMultiplier = 1 + Math.max(0, prestige) * PRESTIGE_RARE_BONUS;
  const weighted = VISITOR_PROFILES.map((profile) => ({
    profile,
    weight: profile.rare ? profile.spawnWeight * rareMultiplier : profile.spawnWeight,
  }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.profile;
  }
  return VISITOR_PROFILES[0];
}
