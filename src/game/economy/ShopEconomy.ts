import { getCard } from '../cards/cards';
import { pileIdFor, type PileId } from '../cards/piles';
import type { Rarity } from '../cards/rarity';
import { gameState } from '../state/GameState';
import { rollPack } from './packs';

/** Placeholder pack price (see IMPLEMENTATION_PLAN §3.2 — easy to tune). */
export const PACK_PRICE = 100;

/** Prestige granted the first time a rare-or-better card is discovered. */
const FIRST_FIND_PRESTIGE: Record<Rarity, number> = {
  common: 0,
  rare: 0.5,
  epic: 1,
  chase: 3,
};

/** One ripped card, enriched with what the cosmetic reveal needs to show. */
export interface RippedCard {
  cardId: string;
  name: string;
  rarity: Rarity;
  holo: boolean;
  artKey?: string;
  /** Stock pile this card folded into (rarity + holo). */
  pile: PileId;
  /** First time this card is ever discovered. */
  isNew: boolean;
  /** Card was known, but this is the first holo copy. */
  isNewHolo: boolean;
  /** New + rare-or-better → earned the prestige "first find" bonus. */
  firstFindBonus: boolean;
}

/**
 * The shop side of the economy: buy packs (money → a pack queued on the shop
 * counter) and rip them (queue → cards committed to collection + stock).
 *
 * Mirrors `BoothEconomy`'s contract: every state change is committed
 * **synchronously and atomically** here; the world/UI animations that follow are
 * purely cosmetic, so a dropped reveal can never lose or duplicate a card.
 */
export class ShopEconomy {
  canAfford(): boolean {
    return gameState.snapshot().money >= PACK_PRICE;
  }

  /** Buy one pack of `setId`: spend money, queue it onto the counter. */
  buyPack(setId: string): boolean {
    if (!gameState.spendMoney(PACK_PRICE)) return false;
    gameState.queuePack(setId);
    return true;
  }

  /**
   * Rip a queued pack of a specific set: roll its contents, then commit every
   * card to the collection (discovery) and stock (rarity+holo pile) at once.
   * Returns the ripped cards for the cosmetic reveal, or null when no pack of
   * that set is queued.
   *
   * `beforeStockCommit` runs after rolling but before any stock is granted, so
   * the stock bar can "hold" the incoming counts and reveal them later as the
   * cosmetic mini-cards are picked up off the floor. The whole method is
   * synchronous, so the commit stays atomic — a dropped reveal can never lose or
   * duplicate a card.
   */
  ripPack(setId: string, beforeStockCommit?: (cards: RippedCard[]) => void): RippedCard[] | null {
    const dequeued = gameState.dequeuePackOfSet(setId);
    if (dequeued === null) return null;

    const { collection, skills } = gameState.snapshot();

    const cards: RippedCard[] = rollPack(setId, skills.luck).map((rolled) => {
      const card = getCard(rolled.cardId);
      const prior = collection[rolled.cardId];
      const isNew = prior?.discovered !== true;
      const isNewHolo = rolled.holo && prior?.holo !== true;
      const firstFindBonus = isNew && rolled.rarity !== 'common';
      return {
        cardId: rolled.cardId,
        name: card?.name ?? rolled.cardId,
        rarity: rolled.rarity,
        holo: rolled.holo,
        artKey: card?.artKey,
        pile: pileIdFor(rolled.rarity, rolled.holo),
        isNew,
        isNewHolo,
        firstFindBonus,
      };
    });

    beforeStockCommit?.(cards);

    for (const c of cards) {
      gameState.discoverCard(c.cardId, c.holo);
      gameState.grantStock(c.pile, 1);
      if (c.firstFindBonus) gameState.addPrestige(FIRST_FIND_PRESTIGE[c.rarity]);
    }

    return cards;
  }
}

/** Shared instance — the shop economy is stateless (it reads/writes gameState). */
export const shopEconomy = new ShopEconomy();
