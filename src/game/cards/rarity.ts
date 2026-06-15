/**
 * Card rarities. See IMPLEMENTATION_PLAN.md §3.1: rarities are common/rare/epic/
 * chase, and **common is the bulk filler that never holos** — that is what gives
 * us exactly 7 stock piles (4 non-holo + 3 holo).
 */
export type Rarity = 'common' | 'rare' | 'epic' | 'chase';

export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'chase'];

/** Common never has a holo variant; every other rarity does. */
export function rarityCanHolo(rarity: Rarity): boolean {
  return rarity !== 'common';
}
