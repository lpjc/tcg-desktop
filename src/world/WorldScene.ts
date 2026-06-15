import Phaser from 'phaser';
import { preloadCatalogAssets } from '../assets/loader';
import { ConventionGuestChargeController } from '../characters/ConventionGuestChargeController';
import { NpcCrowd } from '../characters/NpcCrowd';
import { conventionWanderRegions, withinAnyRegion } from '../characters/wanderZones';
import { preloadCharacters, registerAllCharacterAnims } from '../characters/registerCharacterAnims';
import {
  FLOOR_SUBTILE,
  FLOOR_WALK_Y,
  SHOP_FLOOR_TOP,
  SHOP_WIDTH,
  ZOOM,
} from '../core/constants';
import {
  getActiveConventionVenue,
  getBoothAnchor,
  listConventionVenueIds,
  parseLipColor,
  setActiveConventionVenue,
  type ConventionPropsLayout,
  type PlayerBoothLayout,
} from './ConventionVenue';
import { Placeable, type StationAnchor } from '../entities/Placeable';
import type { Facing } from '../characters/characterSheets';
import { Player } from '../entities/Player';
import { PlaceMode, type LayoutData } from '../editor/PlaceMode';
import { interaction } from '../core/interaction';
import { conventionRoomPicker, pickShopFloorTile } from './floorPatterns';
import { paintFloorLip, paintPatternedFloor } from './floorPaint';
import { buildRoadFloor } from './RoadFloor';
import {
  getObstacleField,
  placeableCollisionWorld,
  rebuildObstacleField,
  stationAnchorPoint,
} from './obstacleField';
import { emoteForPile, preloadEmotes, showEmote } from '../characters/emotes';
import type { Npc, NpcErrand } from '../characters/Npc';
import { isOverWorldSurface, isPlayerWalkSurface } from './worldSurface';
import { CameraDirector } from './CameraDirector';
import { BoothEconomy } from '../game/economy/BoothEconomy';
import { BoothCashBubble } from './BoothCashBubble';
import { playBoothPayout } from './boothFx';
import {
  computeWorldLayout,
  frameForX,
  getWorldLayout,
  setWorldLayout,
  type SceneFrameId,
} from './WorldLayout';

import playerBoothLayout from '../data/layouts/player_booth.json';
import defaultExpoProps from '../data/layouts/conventions/default_expo_props.json';
import wideLobbyProps from '../data/layouts/conventions/wide_lobby_props.json';
import shopLayout from '../data/layouts/shop.json';

const VENUE_PROPS_DEFAULTS: Record<string, ConventionPropsLayout> = {
  default_expo: defaultExpoProps as ConventionPropsLayout,
  wide_lobby: wideLobbyProps as ConventionPropsLayout,
};

/** The player stands on the anchor side of a station, so they face the opposite way. */
const FACING_TOWARD_STATION: Record<StationAnchor, Facing> = {
  below: 'up',
  above: 'down',
  left: 'right',
  right: 'left',
};

/** Customers stand opposite the player at the booth (the front of the counter). */
const OPPOSITE_ANCHOR: Record<StationAnchor, StationAnchor> = {
  below: 'above',
  above: 'below',
  left: 'right',
  right: 'left',
};

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private npcCrowd!: NpcCrowd;
  private guestCharge!: ConventionGuestChargeController;
  private boothEconomy!: BoothEconomy;
  private boothCashBubble!: BoothCashBubble;
  private playerScene: SceneFrameId = 'convention';
  private cameraDirector!: CameraDirector;
  private placeMode!: PlaceMode;
  private baseFloorTiles: Phaser.GameObjects.Image[] = [];
  private floorLips: Phaser.GameObjects.Graphics[] = [];
  private roadFloor?: Phaser.GameObjects.Graphics;
  private venueIndex = 0;

  constructor() {
    super('WorldScene');
  }

  preload(): void {
    preloadCatalogAssets(this);
    preloadCharacters(this);
    preloadEmotes(this);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    setWorldLayout(computeWorldLayout(this.scale.width, ZOOM));
    this.rebuildBaseFloors();

    this.placeMode = new PlaceMode(this, 'convention', () => this.rebuildObstacles());

    registerAllCharacterAnims(this);

    const booth = getBoothAnchor();
    const spawn =
      getObstacleField().findStandPointNear(booth.x + 96, FLOOR_WALK_Y, isPlayerWalkSurface) ??
      { x: booth.x + 96, y: FLOOR_WALK_Y };
    this.player = new Player(this, spawn.x, spawn.y);
    this.npcCrowd = new NpcCrowd(this);
    this.npcCrowd.setConventionFurniturePicker(() => this.pickFurnitureBrowseSpot());
    this.boothEconomy = new BoothEconomy();
    this.boothCashBubble = new BoothCashBubble(this);
    this.guestCharge = new ConventionGuestChargeController(
      this,
      this.npcCrowd,
      () => !this.placeMode.isActive(),
      () => this.buildGuestErrand(),
    );
    this.wireGuestChargeClicks();
    this.playerScene = frameForX(this.player.x);
    void this.bootstrapLayouts().then(() => {
      this.snapPlayerToWalkable();
      this.syncCurrentStation();
      this.refreshBoothAnchor();
      this.npcCrowd.syncToPlayerScene(this.playerScene);
      // First charge only after obstacles exist, so the door spot is real.
      this.guestCharge.start();
    });
    this.cameraDirector = new CameraDirector(this.cameras.main, getWorldLayout().worldWidth);

    interaction.start();
    interaction.setWorldHitTest((clientX, clientY) => {
      if (this.placeMode.isActive()) return true;
      const world = this.cameras.main.getWorldPoint(clientX, clientY);
      if (isOverWorldSurface(world.x, world.y)) return true;
      return this.placeMode.stationAtWorld(world.x, world.y) !== null;
    });

    this.input.on('pointerdown', this.onPlayClick, this);

    this.input.keyboard?.on('keydown-V', (event: KeyboardEvent) => {
      if (this.placeMode.isActive()) return;
      event.preventDefault();
      void this.cycleConventionVenue();
    });

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (!this.placeMode.isActive()) return;
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-FLOOR_SUBTILE, 0],
        ArrowRight: [FLOOR_SUBTILE, 0],
        ArrowUp: [0, -FLOOR_SUBTILE],
        ArrowDown: [0, FLOOR_SUBTILE],
      };
      const nudge = arrows[event.code];
      if (nudge) {
        event.preventDefault();
        if (event.shiftKey) {
          this.placeMode.nudgeSelectedCollision(nudge[0], nudge[1], event.ctrlKey);
        } else {
          this.placeMode.nudgeSelected(nudge[0], nudge[1]);
        }
      }
    });

    this.scale.on('resize', (gameSize: { width: number }) => {
      this.handleBandResize(gameSize.width);
    });
  }

  update(): void {
    if (!this.placeMode) return;

    const scene = frameForX(this.player.x);
    if (scene !== this.playerScene) {
      this.npcCrowd.onPlayerSceneChange(scene);
      this.playerScene = scene;
    }

    if (!this.placeMode.isActive()) {
      this.sortDepths();
    }
  }

  /**
   * Every system-wide click (left or right) hurries the incoming guest along.
   * In Electron the uiohook bridge sees ALL desktop clicks (the overlay is
   * click-through); in plain-browser dev there is no bridge, so page clicks
   * stand in.
   */
  private wireGuestChargeClicks(): void {
    const boost = () => this.guestCharge.onGlobalClick();
    if (window.desktop?.onGlobalClick) {
      const unsubscribe = window.desktop.onGlobalClick(boost);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    } else {
      const domListener = (event: PointerEvent) => {
        if (event.button === 0 || event.button === 2) boost();
      };
      window.addEventListener('pointerdown', domListener);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
        window.removeEventListener('pointerdown', domListener),
      );
    }
  }

  private onPlayClick(pointer: Phaser.Input.Pointer): void {
    if (this.placeMode.isActive()) return;
    if (pointer.rightButtonDown()) return;

    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const station = this.placeMode.stationAtWorld(world.x, world.y);
    if (!station) return;

    const stand = getObstacleField().standPointForStation(
      placeableCollisionWorld(station),
      station.stationAnchor,
      isPlayerWalkSurface,
    );
    if (!stand) return;

    this.player.walkTo(stand.x, stand.y, () => {
      this.syncCurrentStation(station);
      // Booth-layer stations are the player's booth: arriving collects sales.
      if (station.layer === 'booth') this.collectBooth();
    });
  }

  /**
   * Build a "walk to the booth front and buy" errand for an arriving guest.
   * Returns null when no booth exists yet — guests then just wander.
   */
  private buildGuestErrand(): NpcErrand | null {
    const booths = this.placeMode
      .getAllPlaceables()
      .filter((p) => p.isStation && p.layer === 'booth');
    if (booths.length === 0) return null;

    const booth = Phaser.Utils.Array.GetRandom(booths);
    const front = stationAnchorPoint(
      placeableCollisionWorld(booth),
      OPPOSITE_ANCHOR[booth.stationAnchor],
    );
    // Jitter so several buyers don't stack on the exact same spot.
    const target = { x: front.x + Phaser.Math.Between(-10, 10), y: front.y };
    return { target, onArrive: (npc) => this.onBuyerAtBooth(npc) };
  }

  /** A guest reached the booth: make the sale and pop the rarity-cue emote. */
  private onBuyerAtBooth(npc: Npc): void {
    const sale = this.boothEconomy.onGuestArrived();
    if (!sale) return;
    showEmote(this, npc.x, npc.y - 22, emoteForPile(sale.pile));
  }

  /**
   * A stand spot in front of random booth/venue decor — NPCs occasionally stroll
   * here and linger to make the floor feel browsed, not scripted.
   */
  private pickFurnitureBrowseSpot(): { x: number; y: number } | null {
    const regions = conventionWanderRegions();
    const allowed = (x: number, y: number) => withinAnyRegion(x, y, regions);
    const decor = this.placeMode
      .getAllPlaceables()
      .filter((p) => (p.layer === 'booth' || p.layer === 'venue') && !p.isStation);
    if (decor.length === 0) return null;

    const field = getObstacleField();
    const picks = Phaser.Utils.Array.Shuffle([...decor]).slice(0, 5);
    for (const piece of picks) {
      const front = stationAnchorPoint(placeableCollisionWorld(piece), 'below');
      const stand = field.isWalkable(front.x, front.y, allowed)
        ? front
        : field.findStandPointNear(front.x, front.y, allowed);
      if (stand) return stand;
    }
    return null;
  }

  /** Flush the booth cash box into the bank with a payout callout + coin burst. */
  private collectBooth(): void {
    const collected = this.boothEconomy.collect();
    if (collected.sales <= 0) return;
    playBoothPayout(this, this.player.x, this.player.y, collected);
  }

  /** Re-anchor the pending-cash tag above the current booth station. */
  private refreshBoothAnchor(): void {
    const booth = this.placeMode
      .getAllPlaceables()
      .find((p) => p.isStation && p.layer === 'booth');
    if (booth) this.boothCashBubble.setAnchor(booth.x, booth.y - booth.displayHeight - 2);
  }

  /** Layout furniture can cover the default booth spawn — snap onto a free tile. */
  private snapPlayerToWalkable(): void {
    const field = getObstacleField();
    if (field.isWalkable(this.player.x, this.player.y, isPlayerWalkSurface)) return;
    const stand = field.findStandPointNear(this.player.x, FLOOR_WALK_Y, isPlayerWalkSurface);
    if (!stand) return;
    this.player.setPosition(stand.x, stand.y);
    this.player.applyDepth();
  }

  private syncCurrentStation(station?: Placeable): void {
    const at =
      station ?? this.placeMode.nearestStationTo(this.player.x, this.player.y);
    this.placeMode.setCurrentStation(at);
    if (at) {
      this.player.faceDirection(FACING_TOWARD_STATION[at.stationAnchor]);
    }
  }

  private async cycleConventionVenue(): Promise<void> {
    const ids = listConventionVenueIds();
    if (ids.length <= 1) return;
    this.venueIndex = (this.venueIndex + 1) % ids.length;
    await this.switchConventionVenue(ids[this.venueIndex]);
  }

  async switchConventionVenue(venueId: string): Promise<void> {
    if (!setActiveConventionVenue(venueId)) return;

    const oldLayout = getWorldLayout();
    setWorldLayout(computeWorldLayout(this.scale.width, ZOOM));
    const newLayout = getWorldLayout();

    const deltaShopX = newLayout.shopFrame.x - oldLayout.shopFrame.x;
    this.placeMode.shiftShopContent(deltaShopX, oldLayout.shopFrame.x, oldLayout.shopFrame.width);
    this.npcCrowd.shiftShop(deltaShopX);

    this.placeMode.setBoothAnchor(getBoothAnchor());
    this.placeMode.clearConventionContent();
    this.rebuildBaseFloors();
    await this.loadConventionContent();
    this.placeMode.onLayoutBoundsChanged();
    this.cameraDirector.refit(newLayout.worldWidth);

    for (const p of this.placeMode.getAllPlaceables()) {
      p.applyDepth();
    }
    this.rebuildObstacles();
    this.snapPlayerToWalkable();
    this.npcCrowd.relayoutConvention();
    this.guestCharge.relayout();
    this.refreshBoothAnchor();
  }

  private handleBandResize(viewportPxWidth: number): void {
    const oldLayout = getWorldLayout();
    const newLayout = computeWorldLayout(viewportPxWidth, ZOOM);
    if (
      newLayout.roadWidth === oldLayout.roadWidth &&
      newLayout.shopFrame.x === oldLayout.shopFrame.x
    ) {
      // Width unchanged, but a height-only resize still needs re-anchoring
      // (the camera glues the band to the window bottom).
      this.cameraDirector.refit(oldLayout.worldWidth);
      return;
    }

    const deltaShopX = newLayout.shopFrame.x - oldLayout.shopFrame.x;
    this.placeMode.shiftShopContent(
      deltaShopX,
      oldLayout.shopFrame.x,
      oldLayout.shopFrame.width,
    );
    this.npcCrowd.shiftShop(deltaShopX);
    setWorldLayout(newLayout);
    this.rebuildBaseFloors();
    this.placeMode.onLayoutBoundsChanged();
    this.cameraDirector.refit(newLayout.worldWidth);
  }

  private rebuildBaseFloors(): void {
    for (const tile of this.baseFloorTiles) tile.destroy();
    this.baseFloorTiles = [];
    for (const lip of this.floorLips) lip.destroy();
    this.floorLips = [];
    this.roadFloor?.destroy();

    const venue = getActiveConventionVenue();
    const layout = getWorldLayout();
    const roomZones: Array<{
      x: number;
      width: number;
      floorTop: number;
      pickTile: (col: number, row: number) => string;
      lipColor: number;
    }> = [
      ...venue.rooms.map((room, index) => ({
        x: room.x,
        width: room.width,
        floorTop: room.floorTop,
        pickTile: conventionRoomPicker(room, index, venue.floor),
        lipColor: parseLipColor(venue.floor.lipColor),
      })),
      {
        x: layout.shopFrame.x,
        width: SHOP_WIDTH,
        floorTop: SHOP_FLOOR_TOP,
        pickTile: pickShopFloorTile,
        lipColor: 0xb8b8c0,
      },
    ];

    for (const zone of roomZones) {
      this.baseFloorTiles.push(
        ...paintPatternedFloor(this, zone.x, zone.width, zone.floorTop, zone.pickTile),
      );
      this.floorLips.push(paintFloorLip(this, zone.x, zone.width, zone.floorTop, zone.lipColor));
    }

    this.roadFloor = buildRoadFloor(this, layout.roadZone);
  }

  private async bootstrapLayouts(): Promise<void> {
    this.placeMode.clearAllPlaceables();
    this.placeMode.setBoothAnchor(getBoothAnchor());
    await this.loadConventionContent();

    let shop = shopLayout as LayoutData;
    if (window.desktop) {
      const saved = await window.desktop.loadLayout('shop');
      if (saved) shop = JSON.parse(saved) as LayoutData;
    }
    this.placeMode.seedPlaceables('shop', shop.objects);

    for (const p of this.placeMode.getAllPlaceables()) {
      p.applyDepth();
    }
    this.rebuildObstacles();
  }

  private rebuildObstacles(): void {
    rebuildObstacleField(this.placeMode.getAllPlaceables());
  }

  private async loadConventionContent(): Promise<void> {
    const venueId = getActiveConventionVenue().id;

    let booth = playerBoothLayout as PlayerBoothLayout;
    if (window.desktop) {
      const savedBooth = await window.desktop.loadLayout('player_booth');
      if (savedBooth) booth = JSON.parse(savedBooth) as PlayerBoothLayout;
    }
    this.placeMode.seedBooth(booth);

    let props = VENUE_PROPS_DEFAULTS[venueId] ?? { venueId, objects: [] };
    const propsName = `convention_${venueId}_props`;
    if (window.desktop) {
      const savedProps = await window.desktop.loadLayout(propsName);
      if (savedProps) props = JSON.parse(savedProps) as ConventionPropsLayout;
      else {
        const legacy = await window.desktop.loadLayout('convention');
        if (legacy && venueId === 'default_expo') {
          const old = JSON.parse(legacy) as LayoutData;
          props = { venueId, objects: old.objects, floor: old.floor };
        }
      }
    }
    this.placeMode.seedVenueProps(props);
  }

  private sortDepths(): void {
    for (const entity of this.placeMode.getAllPlaceables()) {
      entity.applyDepth();
    }
    this.npcCrowd.applyDepths();
    this.player.applyDepth();
  }
}
