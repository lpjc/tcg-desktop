import { registerSet, type Card, type CardSet } from './cards';
import type { Rarity } from './rarity';

/**
 * A single placeholder set so the economy and (later) the binder have real data
 * to work with before any card art exists. Replace with authored sets once the
 * first real set's card list + art arrive.
 */
const SET_ID = 'embergrove';

/** 30 cards: 18 common, 8 rare, 3 epic, 1 chase. */
const RARITY_PLAN: Rarity[] = [
  ...Array<Rarity>(18).fill('common'),
  ...Array<Rarity>(8).fill('rare'),
  ...Array<Rarity>(3).fill('epic'),
  ...Array<Rarity>(1).fill('chase'),
];

/** Register the placeholder set and return its id. */
export function registerPlaceholderSet(): string {
  const cards: Card[] = RARITY_PLAN.map((rarity, index) => {
    const num = String(index + 1).padStart(2, '0');
    return { id: `${SET_ID}-${num}`, setId: SET_ID, name: `Embergrove #${num}`, rarity };
  });
  const set: CardSet = {
    id: SET_ID,
    name: 'Embergrove',
    theme: 'Starter set (placeholder)',
    cardIds: cards.map((card) => card.id),
  };
  registerSet(set, cards);
  return SET_ID;
}
