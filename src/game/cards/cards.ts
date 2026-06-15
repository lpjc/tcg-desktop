import type { Rarity } from './rarity';

/**
 * A single collectible card. `artKey` is intentionally optional for now — the
 * binder renders a placeholder until real card art is supplied.
 */
export interface Card {
  id: string;
  setId: string;
  name: string;
  rarity: Rarity;
  artKey?: string;
}

/** A themed group of ~30 cards. Sets unlock alongside conventions (see brief). */
export interface CardSet {
  id: string;
  name: string;
  theme: string;
  cardIds: string[];
}

const setRegistry = new Map<string, CardSet>();
const cardRegistry = new Map<string, Card>();

/** Register a set and its cards (called once at boot per set). */
export function registerSet(set: CardSet, cards: Card[]): void {
  setRegistry.set(set.id, set);
  for (const card of cards) cardRegistry.set(card.id, card);
}

export function getSet(id: string): CardSet | undefined {
  return setRegistry.get(id);
}

export function getCard(id: string): Card | undefined {
  return cardRegistry.get(id);
}

export function allSets(): CardSet[] {
  return [...setRegistry.values()];
}
