import { rarityCanHolo, type Rarity } from './rarity';
import { rarityColor } from './rarityColors';

/**
 * The 7 stock "piles". Whenever the player gains cards they are abstracted to
 * rarity + holo (the booth and convention visitors only ever see piles, never
 * individual cards). Common has no holo pile — see rarity.ts.
 */
export type PileId =
  | 'common'
  | 'rare'
  | 'epic'
  | 'chase'
  | 'rareHolo'
  | 'epicHolo'
  | 'chaseHolo';

export const PILE_IDS: readonly PileId[] = [
  'common',
  'rare',
  'epic',
  'chase',
  'rareHolo',
  'epicHolo',
  'chaseHolo',
];

export interface PileMeta {
  id: PileId;
  rarity: Rarity;
  holo: boolean;
  label: string;
  /** Base sell value in € (placeholder economy — see IMPLEMENTATION_PLAN §3.2). */
  worth: number;
  /** Display tint — always derived from `rarity` via `rarityColors.ts`. */
  color: number;
}

function pile(
  id: PileId,
  rarity: Rarity,
  holo: boolean,
  label: string,
  worth: number,
): PileMeta {
  return { id, rarity, holo, label, worth, color: rarityColor(rarity) };
}

export const PILES: Record<PileId, PileMeta> = {
  common: pile('common', 'common', false, 'Common', 1),
  rare: pile('rare', 'rare', false, 'Rare', 5),
  epic: pile('epic', 'epic', false, 'Epic', 25),
  chase: pile('chase', 'chase', false, 'Chase', 150),
  rareHolo: pile('rareHolo', 'rare', true, 'Rare Holo', 20),
  epicHolo: pile('epicHolo', 'epic', true, 'Epic Holo', 100),
  chaseHolo: pile('chaseHolo', 'chase', true, 'Chase Holo', 600),
};

/** Map a rarity + holo flag to its stock pile (holo collapses to non-holo for common). */
export function pileIdFor(rarity: Rarity, holo: boolean): PileId {
  if (holo && rarityCanHolo(rarity)) return `${rarity}Holo` as PileId;
  return rarity as PileId;
}
