import { registerSet, type Card, type CardSet } from './cards';
import type { Rarity } from './rarity';

/**
 * A single placeholder set so the economy and the binder have real data to work
 * with before an authored set arrives. Card art is borrowed from the bundled
 * "Free Mythic Monsters" pack (copied to `assets/cards/embergrove/NN.png`); the
 * binder treats each card as its monster, shown as a silhouette until discovered.
 * Replace names + art once the first real set is designed.
 */
const SET_ID = 'embergrove';

/** 30 cards: 18 common, 8 rare, 3 epic, 1 chase. */
const RARITY_PLAN: Rarity[] = [
  ...Array<Rarity>(18).fill('common'),
  ...Array<Rarity>(8).fill('rare'),
  ...Array<Rarity>(3).fill('epic'),
  ...Array<Rarity>(1).fill('chase'),
];

/**
 * One evocative name per card (index = card number − 1). Purely flavour so the
 * binder reads like a creature collection rather than "#01". Order roughly tracks
 * rarity: humble grove-dwellers first, the chase monster last.
 */
const MONSTER_NAMES: string[] = [
  'Cinderling',
  'Mossback',
  'Embernewt',
  'Thornkit',
  'Sootmoth',
  'Glimmerbug',
  'Barkbiter',
  'Pebbletoad',
  'Ashfin',
  'Dewscale',
  'Foxfire',
  'Hollowmask',
  'Bramblehorn',
  'Mudlurk',
  'Sparkmaw',
  'Driftcap',
  'Gloomspore',
  'Tanglevine',
  'Pyreclaw',
  'Frostquill',
  'Stormsnout',
  'Ironhide',
  'Voidgazer',
  'Lumenwing',
  'Magmacrest',
  'Riverwyrm',
  'Duskstag',
  'Sablefang',
  'Runebound',
  'Emberlord Vael',
];

/** Public URL (Vite `publicDir: assets`) for a card's monster art. */
function artKeyFor(cardNumber: number): string {
  return `/cards/${SET_ID}/${String(cardNumber).padStart(2, '0')}.png`;
}

/** Register the placeholder set and return its id. */
export function registerPlaceholderSet(): string {
  const cards: Card[] = RARITY_PLAN.map((rarity, index) => {
    const cardNumber = index + 1;
    const num = String(cardNumber).padStart(2, '0');
    return {
      id: `${SET_ID}-${num}`,
      setId: SET_ID,
      name: MONSTER_NAMES[index] ?? `Embergrove #${num}`,
      rarity,
      artKey: artKeyFor(cardNumber),
    };
  });
  const set: CardSet = {
    id: SET_ID,
    name: 'Embergrove',
    theme: 'Starter set',
    cardIds: cards.map((card) => card.id),
  };
  registerSet(set, cards);
  return SET_ID;
}
