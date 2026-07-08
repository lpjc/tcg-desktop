import { assetUrl } from '../../assets/assetUrl';
import { registerSet, type Card, type CardSet } from './cards';
import type { Rarity } from './rarity';

/**
 * Placeholder sets so the economy and binder have real data before authored sets
 * arrive. Card art is borrowed from the "Free Mythic Monsters" pack in `art-source/`
 * (copied to `assets/cards/embergrove/NN.png`); cards are monster-first, shown as
 * a silhouette until discovered. Several sets are registered so the binder is a
 * real multi-spread book to flip through — replace names/art with authored sets
 * later (just point each card's `artKey` at the real art).
 */

/** 30 cards per set: 18 common, 8 rare, 3 epic, 1 chase. */
const RARITY_PLAN: Rarity[] = [
  ...Array<Rarity>(18).fill('common'),
  ...Array<Rarity>(8).fill('rare'),
  ...Array<Rarity>(3).fill('epic'),
  ...Array<Rarity>(1).fill('chase'),
];

const SET_SIZE = RARITY_PLAN.length;
/** How many distinct monster art files exist in `assets/cards/embergrove/`. */
const ART_COUNT = 30;

/** Hand-written names for the starter set (index = card number − 1). */
const EMBERGROVE_NAMES: string[] = [
  'Cinderling', 'Mossback', 'Embernewt', 'Thornkit', 'Sootmoth', 'Glimmerbug',
  'Barkbiter', 'Pebbletoad', 'Ashfin', 'Dewscale', 'Foxfire', 'Hollowmask',
  'Bramblehorn', 'Mudlurk', 'Sparkmaw', 'Driftcap', 'Gloomspore', 'Tanglevine',
  'Pyreclaw', 'Frostquill', 'Stormsnout', 'Ironhide', 'Voidgazer', 'Lumenwing',
  'Magmacrest', 'Riverwyrm', 'Duskstag', 'Sablefang', 'Runebound', 'Emberlord Vael',
];

/** Word pools for deterministically naming the extra placeholder sets. */
const NAME_PARTS: Record<string, { pre: string[]; suf: string[]; chase: string }> = {
  tidehollow: {
    pre: ['Tide', 'Brine', 'Coral', 'Wave', 'Mist', 'Pearl', 'Reef', 'Kelp',
      'Marsh', 'Foam', 'Squid', 'Naga', 'Abyss', 'Deep', 'Silt', 'Glacier',
      'Current', 'Lagoon'],
    suf: ['maw', 'fin', 'scale', 'wraith', 'kin', 'spawn', 'gaze', 'coil'],
    chase: 'Leviath, the Drowned Crown',
  },
  duskmoor: {
    pre: ['Dusk', 'Shade', 'Gloom', 'Night', 'Hollow', 'Raven', 'Bone', 'Grave',
      'Wisp', 'Crypt', 'Veil', 'Mourn', 'Cinder', 'Pale', 'Soot', 'Hex',
      'Wither', 'Murk'],
    suf: ['fang', 'shroud', 'mark', 'born', 'thorn', 'gaze', 'rend', 'howl'],
    chase: 'Nox, the Unlit',
  },
};

/** Public URL (Vite `publicDir: assets`) for one of the monster art files. */
function artKeyFor(artNumber: number): string {
  return assetUrl(`cards/embergrove/${String(artNumber).padStart(2, '0')}.png`);
}

function buildCards(setId: string, names: string[], artOffset: number): Card[] {
  return RARITY_PLAN.map((rarity, index) => {
    const num = String(index + 1).padStart(2, '0');
    // Reuse the shared monster pool; offset so each set shows different monsters.
    const artNumber = ((index + artOffset) % ART_COUNT) + 1;
    return {
      id: `${setId}-${num}`,
      setId,
      name: names[index] ?? `${setId} #${num}`,
      rarity,
      artKey: artKeyFor(artNumber),
    };
  });
}

/** Compose plausible names for a generated set from its word pools. */
function generatedNames(setId: string): string[] {
  const parts = NAME_PARTS[setId];
  if (!parts) return [];
  const names: string[] = [];
  for (let i = 0; i < SET_SIZE; i++) {
    if (i === SET_SIZE - 1) {
      names.push(parts.chase);
    } else {
      const pre = parts.pre[i % parts.pre.length];
      const suf = parts.suf[(i * 3) % parts.suf.length];
      names.push(pre + suf);
    }
  }
  return names;
}

function register(setId: string, name: string, theme: string, names: string[], artOffset: number): void {
  const cards = buildCards(setId, names, artOffset);
  const set: CardSet = { id: setId, name, theme, cardIds: cards.map((c) => c.id) };
  registerSet(set, cards);
}

/** Register all placeholder sets; returns the starter set id. */
export function registerPlaceholderSet(): string {
  register('embergrove', 'Embergrove', 'Starter set', EMBERGROVE_NAMES, 0);
  register('tidehollow', 'Tidehollow', 'Tidal depths', generatedNames('tidehollow'), 10);
  register('duskmoor', 'Duskmoor', 'Shadowed moor', generatedNames('duskmoor'), 20);
  return 'embergrove';
}
