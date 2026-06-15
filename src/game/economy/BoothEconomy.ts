import { PILES, type PileId } from '../cards/piles';
import type { Rarity } from '../cards/rarity';
import { gameState } from '../state/GameState';
import type { CashBox } from '../state/types';
import { pickVisitorProfile, type VisitorProfile } from './visitorProfiles';

/** Reputation earned per sale, by rarity (rarer cards build the booth's name). */
const REP_GAIN: Record<Rarity, number> = {
  common: 0.2,
  rare: 0.5,
  epic: 1,
  chase: 3,
};

/** Each Reputation point adds this fraction to every sale price. */
const REPUTATION_PRICE_BONUS = 0.01;

export interface SaleResult {
  pile: PileId;
  price: number;
  reputation: number;
  profile: VisitorProfile;
}

/**
 * The convention money loop. A visitor arriving at the convention picks a pile
 * they want (filtered to what's actually in stock), buys one card, and the sale
 * lands in the booth cash box. The player collects the cash box at the booth.
 *
 * Visitors buy whether or not the player is present — that's the whole point of
 * the "convention runs itself" idle loop.
 */
export class BoothEconomy {
  /**
   * Pick a pile and quote a price without mutating state — used to drive the
   * purchase animation before stock/payment are committed.
   */
  resolveSale(): SaleResult | null {
    const data = gameState.snapshot();
    const profile = pickVisitorProfile(data.skills.prestige);
    const pile = this.choosePile(profile, data.stock);
    if (!pile) return null;

    const meta = PILES[pile];
    const price = Math.round(meta.worth * (1 + data.skills.reputation * REPUTATION_PRICE_BONUS));
    const reputation = REP_GAIN[meta.rarity];
    return { pile, price, reputation, profile };
  }

  /** Remove one card from stock when the sale card flies out of the HUD. */
  commitStock(pile: PileId): boolean {
    return gameState.takeFromStock(pile, 1);
  }

  /**
   * Apply payment after the sale animation lands. When `directToBank` (player at
   * the booth) money goes straight to the bank; otherwise it stacks in the cash
   * box on the table.
   */
  commitPayment(sale: SaleResult, directToBank: boolean): void {
    if (directToBank) {
      gameState.sellDirect(sale.price, sale.reputation);
    } else {
      gameState.recordSale(sale.price, sale.reputation);
    }
  }

  /** Flush the booth cash box into the bank; returns the collected summary. */
  collect(): CashBox {
    return gameState.collectCashBox();
  }

  /** Weighted pick among piles the visitor wants AND that have stock. */
  private choosePile(profile: VisitorProfile, stock: Record<PileId, number>): PileId | null {
    const candidates = (Object.keys(profile.buy) as PileId[]).filter(
      (pile) => profile.buy[pile] > 0 && stock[pile] > 0,
    );
    if (candidates.length === 0) return null;

    const total = candidates.reduce((sum, pile) => sum + profile.buy[pile], 0);
    let roll = Math.random() * total;
    for (const pile of candidates) {
      roll -= profile.buy[pile];
      if (roll <= 0) return pile;
    }
    return candidates[candidates.length - 1];
  }
}
