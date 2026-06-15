import { rarityCanHolo, type Rarity } from './rarity';

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
  /** Display tint for chunky pile tokens / glows. */
  color: number;
}

export const PILES: Record<PileId, PileMeta> = {
  common: { id: 'common', rarity: 'common', holo: false, label: 'Common', worth: 1, color: 0x9aa6b2 },
  rare: { id: 'rare', rarity: 'rare', holo: false, label: 'Rare', worth: 5, color: 0x4f9dde },
  epic: { id: 'epic', rarity: 'epic', holo: false, label: 'Epic', worth: 25, color: 0xa463f2 },
  chase: { id: 'chase', rarity: 'chase', holo: false, label: 'Chase', worth: 150, color: 0xf2b341 },
  rareHolo: { id: 'rareHolo', rarity: 'rare', holo: true, label: 'Rare Holo', worth: 20, color: 0x6fd0ff },
  epicHolo: { id: 'epicHolo', rarity: 'epic', holo: true, label: 'Epic Holo', worth: 100, color: 0xc89bff },
  chaseHolo: { id: 'chaseHolo', rarity: 'chase', holo: true, label: 'Chase Holo', worth: 600, color: 0xffe08a },
};

/** Map a rarity + holo flag to its stock pile (holo collapses to non-holo for common). */
export function pileIdFor(rarity: Rarity, holo: boolean): PileId {
  if (holo && rarityCanHolo(rarity)) return `${rarity}Holo` as PileId;
  return rarity as PileId;
}
