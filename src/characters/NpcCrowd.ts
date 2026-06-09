import Phaser from 'phaser';
import { getWorldLayout } from '../world/WorldLayout';
import { Npc } from './Npc';
import { NPC_CHARACTERS, type CharacterKey } from './characterSheets';
import {
  conventionRoadEntrance,
  conventionWanderRegions,
  shopRoadEntrance,
  shopWanderRegions,
  type SceneEntrance,
  type WanderRect,
} from './wanderZones';

/** A populated area of the world that maintains its own background crowd. */
interface CrowdZone {
  id: 'convention' | 'shop';
  /** Rebuilt on venue switch / shop relayout; each NPC holds this reference. */
  regions: WanderRect[];
  entrance: SceneEntrance;
  target: number;
  chars: readonly CharacterKey[];
  npcs: Npc[];
}

/** Convention is busy; the shop only ever has a couple of browsers. */
const CONVENTION_TARGET = 7;
const SHOP_TARGET = 2;

/** How often we top a zone back up toward its target (one NPC at a time). */
const MAINTAIN_INTERVAL_MS = 1300;

/**
 * Owns every background character in the world.
 *
 * Convention NPCs wander across all venue rooms but only fade in/out at the
 * rightmost room's road doorway (lobby or foyer, depending on venue preset). Shop visitors use the full shop
 * floor except the centre-top behind-the-counter strip, entering from the road
 * on the left.
 */
export class NpcCrowd {
  private readonly scene: Phaser.Scene;
  private readonly convention: CrowdZone;
  private readonly shop: CrowdZone;
  private maintainTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.convention = {
      id: 'convention',
      regions: conventionWanderRegions(),
      entrance: conventionRoadEntrance(),
      target: CONVENTION_TARGET,
      chars: NPC_CHARACTERS,
      npcs: [],
    };
    this.shop = {
      id: 'shop',
      regions: shopWanderRegions(getWorldLayout().shopFrame.x),
      entrance: shopRoadEntrance(getWorldLayout().shopFrame.x),
      target: SHOP_TARGET,
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
    this.fillZone(this.convention);
    this.fillZone(this.shop);
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
    this.topUp(this.convention);
    this.topUp(this.shop);
  }

  private topUp(zone: CrowdZone): void {
    if (zone.npcs.length < zone.target) this.spawn(zone);
  }

  private fillZone(zone: CrowdZone): void {
    // Stop at the first failed spawn (blocked doorway); the maintenance timer
    // keeps topping up later, so a temporarily blocked entrance is harmless.
    while (zone.npcs.length < zone.target) {
      if (!this.spawn(zone)) return;
    }
  }

  /** True when an NPC was actually spawned (doorway clear). */
  private spawn(zone: CrowdZone): boolean {
    const charKey = Phaser.Utils.Array.GetRandom(zone.chars as CharacterKey[]);
    const npc = Npc.trySpawn(this.scene, charKey, zone.regions, zone.entrance, (gone) => {
      const index = zone.npcs.indexOf(gone);
      if (index >= 0) zone.npcs.splice(index, 1);
    });
    if (!npc) return false;
    zone.npcs.push(npc);
    return true;
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
