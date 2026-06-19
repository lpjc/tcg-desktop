import type { PileId } from '../cards/piles';

/** What we know about a single card: ever discovered, and whether in holo. */
export interface CollectionEntry {
  discovered: boolean;
  holo: boolean;
}

/**
 * Un-collected booth earnings. Visitors buy whether or not the player is at the
 * booth; sales pile up here until collected (see brief — "12 sales! +€127").
 */
export interface CashBox {
  sales: number;
  money: number;
  reputation: number;
}

/** The four core meta skills (see brief / IMPLEMENTATION_PLAN §2.5). */
export interface Skills {
  reputation: number;
  luck: number;
  prestige: number;
  attraction: number;
}

/** The full persisted player state. One JSON blob; the renderer owns the schema. */
export interface GameStateData {
  version: number;
  money: number;
  stock: Record<PileId, number>;
  collection: Record<string, CollectionEntry>;
  skills: Skills;
  displayCase: (string | null)[];
  unlockedConventions: string[];
  unlockedSets: string[];
  cashBox: CashBox;
  /**
   * Packs bought but not yet ripped, as a queue of set ids (one entry per pack).
   * They pile on the shop counter — just like the cash box, they persist and are
   * resolved later when the player walks over to rip them.
   */
  pendingPacks: string[];
}
