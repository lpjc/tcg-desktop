import { shopEconomy } from '../game/economy/ShopEconomy';
import { expectStockGain } from '../ui/saleFxBridge';
import type { FloorCardField } from './floorCardFx';
import type { HeadPackPiles } from './HeadPackPiles';

/** How far above the player's foot the pack piles float. */
const HEAD_OFFSET = 34;
/** Cards land on the floor this far in front of the player's feet. */
const FLOOR_DROP_AHEAD = 6;
/** Every pack rips over exactly this many clicks (steady rhythm). */
const TEAR_CLICKS = 5;

/**
 * Drives pack ripping at the shop counter. While the player stands at the
 * counter, their bought packs float above their head as per-set packs
 * (`HeadPackPiles`); clicking a pack tears that set's top pack over five soft
 * clicks, and the final click bursts its cards onto the floor (`FloorCardField`)
 * — committing the pack to collection + stock atomically at that instant.
 *
 * Picking the cards back up is handled by the floor field itself (it works
 * anywhere, anytime), so this controller only owns tearing.
 */
export class PackRipController {
  private readonly headPiles: HeadPackPiles;
  private readonly floorField: FloorCardField;
  private readonly getPlayer: () => { x: number; y: number };

  private atCounter = false;
  private tearingSetId: string | null = null;
  private tearProgress = 0;

  constructor(
    headPiles: HeadPackPiles,
    floorField: FloorCardField,
    getPlayer: () => { x: number; y: number },
  ) {
    this.headPiles = headPiles;
    this.floorField = floorField;
    this.getPlayer = getPlayer;
  }

  /** The player arrived at / left the shop counter. */
  setAtCounter(at: boolean): void {
    this.atCounter = at;
    this.resetTear();
    if (at) {
      const player = this.getPlayer();
      this.headPiles.showAt(player.x, player.y - HEAD_OFFSET);
    } else {
      this.headPiles.hide();
    }
  }

  /** Returns true when a head-pack tear consumed the click (so no walk happens). */
  handlePointerDown(worldX: number, worldY: number): boolean {
    if (!this.atCounter) return false;
    const setId = this.headPiles.hitTest(worldX, worldY);
    if (setId === null) return false;
    this.tearOnce(setId);
    return true;
  }

  private tearOnce(setId: string): void {
    if (this.tearingSetId !== setId) {
      this.tearingSetId = setId;
      this.tearProgress = 0;
    }
    this.tearProgress += 1;
    this.headPiles.tearStep(setId, this.tearProgress / TEAR_CLICKS);
    if (this.tearProgress >= TEAR_CLICKS) {
      this.resetTear();
      this.burst(setId);
    }
  }

  private burst(setId: string): void {
    const burstFrom = this.headPiles.pilePosition(setId) ?? this.getPlayer();
    // Hold the incoming stock counts so they tick up as cards leave the reveal bar.
    const cards = shopEconomy.ripPack(setId, (ripped) => {
      for (const c of ripped) expectStockGain(c.pile, 1);
    });
    if (!cards || cards.length === 0) return;

    const floorY = this.getPlayer().y + FLOOR_DROP_AHEAD;
    this.floorField.addBurst(cards, burstFrom, floorY);
  }

  private resetTear(): void {
    this.tearingSetId = null;
    this.tearProgress = 0;
  }
}
