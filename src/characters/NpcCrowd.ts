import Phaser from 'phaser';
import { getWorldLayout } from '../world/WorldLayout';
import { Npc, type NpcErrand } from './Npc';
import { NPC_CHARACTERS, type CharacterKey } from './characterSheets';
import {
  conventionRoadEntrance,
  conventionWanderRegions,
  shopRoadEntrance,
  shopWanderRegions,
  type SceneEntrance,
  type WanderRect,
} from './wanderZones';

/** A populated area of the world whose background crowd this class owns. */
interface CrowdZone {
  id: 'convention' | 'shop';
  /** Rebuilt on venue switch / shop relayout; each NPC holds this reference. */
  regions: WanderRect[];
  entrance: SceneEntrance;
  chars: readonly CharacterKey[];
  npcs: Npc[];
}

/** The shop only ever has a couple of random browsers. */
const SHOP_TARGET = 2;

/** How often the shop is topped back up toward its target (one NPC at a time). */
const MAINTAIN_INTERVAL_MS = 1300;

/**
 * Owns every background character in the world.
 *
 * The two zones are populated differently:
 * - **Shop:** random top-up to `SHOP_TARGET` on a maintenance timer, visitors
 *   fading in/out at the road doorway on the shop's left edge.
 * - **Convention:** no random spawning. Guests arrive **only** through
 *   `ConventionGuestChargeController` (the timed/click-boosted doorway charge)
 *   via `spawnConventionGuest`. The crowd still owns their wander regions,
 *   relayout handling, and despawn bookkeeping.
 *
 * Convention NPCs wander across all venue rooms but only enter/exit at the
 * rightmost room's road doorway (lobby or foyer, depending on venue preset).
 * Shop visitors use the full shop floor except the centre-top behind-the-counter
 * strip.
 */
export class NpcCrowd {
  private readonly scene: Phaser.Scene;
  private readonly convention: CrowdZone;
  private readonly shop: CrowdZone;
  private maintainTimer?: Phaser.Time.TimerEvent;
  /** Convention decor spots — NPCs occasionally stroll here and linger. */
  private conventionFurniturePicker: (() => { x: number; y: number } | null) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.convention = {
      id: 'convention',
      regions: conventionWanderRegions(),
      entrance: conventionRoadEntrance(),
      chars: NPC_CHARACTERS,
      npcs: [],
    };
    this.shop = {
      id: 'shop',
      regions: shopWanderRegions(getWorldLayout().shopFrame.x),
      entrance: shopRoadEntrance(getWorldLayout().shopFrame.x),
      chars: NPC_CHARACTERS,
      npcs: [],
    };

    this.maintainTimer = scene.time.addEvent({
      delay: MAINTAIN_INTERVAL_MS,
      loop: true,
      callback: () => this.maintain(),
    });

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());
  }

  syncToPlayerScene(_playerScene: 'convention' | 'shop'): void {
    // Only the shop bulk-fills; the convention starts empty and fills one
    // charged guest at a time.
    this.fillZone(this.shop);
  }

  /** Live convention headcount — the charge controller's flood-cap input. */
  conventionCount(): number {
    return this.convention.npcs.length;
  }

  /** Lets convention guests occasionally browse decor (booth props, venue furniture). */
  setConventionFurniturePicker(picker: () => { x: number; y: number } | null): void {
    this.conventionFurniturePicker = picker;
  }

  /**
   * Spawn a fully-charged convention guest, already visible at the road spot
   * where its silhouette just "plinged" (no fade-in); it walks in through the
   * doorway. Returns null when furniture blocks the door line.
   */
  spawnConventionGuest(
    charKey: CharacterKey,
    at: { x: number; y: number },
    errand?: NpcErrand | null,
  ): Npc | null {
    return this.spawn(this.convention, charKey, at, errand);
  }

  onPlayerSceneChange(_playerScene: 'convention' | 'shop'): void {
    /* crowds are player-independent by design */
  }

  shiftShop(deltaShopX: number): void {
    if (deltaShopX === 0) return;
    for (const npc of this.shop.npcs) npc.shiftX(deltaShopX);
    this.rebuildShopRegions();
  }

  relayoutConvention(): void {
    this.rebuildConventionRegions();
  }

  applyDepths(): void {
    for (const npc of this.convention.npcs) npc.applyDepth();
    for (const npc of this.shop.npcs) npc.applyDepth();
  }

  destroy(): void {
    this.maintainTimer?.remove(false);
    this.maintainTimer = undefined;
    for (const npc of [...this.convention.npcs, ...this.shop.npcs]) npc.destroy();
    this.convention.npcs = [];
    this.shop.npcs = [];
  }

  private maintain(): void {
    if (this.shop.npcs.length < SHOP_TARGET) {
      this.spawn(this.shop, Phaser.Utils.Array.GetRandom(this.shop.chars as CharacterKey[]));
    }
  }

  private fillZone(zone: CrowdZone): void {
    // Stop at the first failed spawn (blocked doorway); the maintenance timer
    // keeps topping up later, so a temporarily blocked entrance is harmless.
    while (zone.npcs.length < SHOP_TARGET) {
      const charKey = Phaser.Utils.Array.GetRandom(zone.chars as CharacterKey[]);
      if (!this.spawn(zone, charKey)) return;
    }
  }

  /** Spawned NPC, or null when the doorway is blocked / regions are empty. */
  private spawn(
    zone: CrowdZone,
    charKey: CharacterKey,
    materializeAt?: { x: number; y: number },
    errand?: NpcErrand | null,
  ): Npc | null {
    const furniturePicker =
      zone.id === 'convention' ? this.conventionFurniturePicker : null;
    const npc = Npc.trySpawn(
      this.scene,
      charKey,
      zone.regions,
      zone.entrance,
      (gone) => {
        const index = zone.npcs.indexOf(gone);
        if (index >= 0) zone.npcs.splice(index, 1);
      },
      materializeAt,
      errand,
      furniturePicker,
    );
    if (!npc) return null;
    zone.npcs.push(npc);
    return npc;
  }

  private rebuildConventionRegions(): void {
    this.convention.regions = conventionWanderRegions();
    this.convention.entrance = conventionRoadEntrance();
    for (const npc of this.convention.npcs) {
      npc.setRegions(this.convention.regions);
      npc.onBoundsChanged();
    }
  }

  private rebuildShopRegions(): void {
    const shopX = getWorldLayout().shopFrame.x;
    this.shop.regions = shopWanderRegions(shopX);
    this.shop.entrance = shopRoadEntrance(shopX);
    for (const npc of this.shop.npcs) {
      npc.setRegions(this.shop.regions);
      npc.onBoundsChanged();
    }
  }
}
