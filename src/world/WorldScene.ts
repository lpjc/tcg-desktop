import Phaser from 'phaser';
import { getCatalogItem, getFloorTileId } from '../assets/catalog';
import { preloadCatalogAssets } from '../assets/loader';
import {
  CONVENTION_FLOOR_TOP,
  CONVENTION_WIDTH,
  FLOOR_SUBTILE,
  FLOOR_WALK_Y,
  SHOP_FLOOR_TOP,
  SHOP_WIDTH,
  WORLD_HEIGHT,
  ZOOM,
} from '../core/constants';
import { Player } from '../entities/Player';
import { PlaceMode, type LayoutData } from '../editor/PlaceMode';
import { interaction } from '../core/interaction';
import { paintFloorLip, paintTiledFloor } from './floorPaint';
import { buildRoadFloor } from './RoadFloor';
import { CameraDirector } from './CameraDirector';
import {
  computeWorldLayout,
  getWorldLayout,
  setWorldLayout,
  type SceneFrameId,
} from './WorldLayout';

import conventionLayout from '../data/layouts/convention.json';
import shopLayout from '../data/layouts/shop.json';

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private cameraDirector!: CameraDirector;
  private placeMode!: PlaceMode;
  private baseFloorTiles: Phaser.GameObjects.Image[] = [];
  private floorLips: Phaser.GameObjects.Graphics[] = [];
  private roadFloor?: Phaser.GameObjects.Graphics;

  constructor() {
    super('WorldScene');
  }

  preload(): void {
    preloadCatalogAssets(this);
    this.load.image('player', encodeURI('/sierrassets/pets/Slice 1.png'));
  }

  create(): void {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    setWorldLayout(computeWorldLayout(this.scale.width, ZOOM));
    this.rebuildBaseFloors();

    this.placeMode = new PlaceMode(this, 'convention', () => undefined);
    void this.bootstrapLayouts();

    this.player = new Player(this, CONVENTION_WIDTH / 2, FLOOR_WALK_Y);
    this.cameraDirector = new CameraDirector(this.cameras.main, getWorldLayout().worldWidth);

    interaction.start();
    interaction.setStationHitTest((clientX, clientY) => {
      if (this.placeMode.isActive()) return true;
      const world = this.cameras.main.getWorldPoint(clientX, clientY);
      return this.placeMode.stationAtWorld(world.x, world.y) !== null;
    });

    this.input.on('pointerdown', this.onPlayClick, this);

    this.input.keyboard?.on('keydown-TAB', (event: KeyboardEvent) => {
      event.preventDefault();
      if (!this.placeMode.isActive()) return;
      const next: SceneFrameId =
        this.placeMode.getEditingFrame() === 'convention' ? 'shop' : 'convention';
      this.placeMode.setEditingFrame(next);
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
        this.placeMode.nudgeSelected(nudge[0], nudge[1]);
      }
    });

    this.scale.on('resize', (gameSize: { width: number }) => {
      this.handleBandResize(gameSize.width);
    });
  }

  update(): void {
    if (!this.placeMode) return;
    if (!this.placeMode.isActive()) {
      this.sortDepths();
    }
  }

  /** Play mode: clicking a station walks the avatar to it. */
  private onPlayClick(pointer: Phaser.Input.Pointer): void {
    if (this.placeMode.isActive()) return;
    if (pointer.rightButtonDown()) return;

    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const station = this.placeMode.stationAtWorld(world.x, world.y);
    if (!station) return;

    const targetX = station.x;
    const targetY = Phaser.Math.Clamp(station.y + 4, 16, WORLD_HEIGHT - 4);
    this.player.walkTo(targetX, targetY);
  }

  /**
   * When the window width changes, grow or shrink the road so convention + road +
   * shop still fill 100% of the band. Shop content shifts with the shop frame.
   */
  private handleBandResize(viewportPxWidth: number): void {
    const oldLayout = getWorldLayout();
    const newLayout = computeWorldLayout(viewportPxWidth, ZOOM);
    if (
      newLayout.roadWidth === oldLayout.roadWidth &&
      newLayout.shopFrame.x === oldLayout.shopFrame.x
    ) {
      return;
    }

    const deltaShopX = newLayout.shopFrame.x - oldLayout.shopFrame.x;
    this.placeMode.shiftShopContent(
      deltaShopX,
      oldLayout.shopFrame.x,
      oldLayout.shopFrame.width,
    );
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

    const layout = getWorldLayout();
    const roomZones: Array<{
      x: number;
      width: number;
      floorTop: number;
      tileId: string;
      lipColor: number;
    }> = [
      {
        x: 0,
        width: CONVENTION_WIDTH,
        floorTop: CONVENTION_FLOOR_TOP,
        tileId: getFloorTileId('convention'),
        lipColor: 0xc8a868,
      },
      {
        x: layout.shopFrame.x,
        width: SHOP_WIDTH,
        floorTop: SHOP_FLOOR_TOP,
        tileId: getFloorTileId('shop'),
        lipColor: 0xb8b8c0,
      },
    ];

    for (const zone of roomZones) {
      const item = getCatalogItem(zone.tileId);
      if (!item) continue;
      this.baseFloorTiles.push(
        ...paintTiledFloor(this, zone.x, zone.width, zone.floorTop, item.id),
      );
      this.floorLips.push(paintFloorLip(this, zone.x, zone.width, zone.floorTop, zone.lipColor));
    }

    this.roadFloor = buildRoadFloor(this, layout.roadZone);
  }

  private async bootstrapLayouts(): Promise<void> {
    this.placeMode.clearAllPlaceables();

    const defaults: Record<SceneFrameId, LayoutData> = {
      convention: conventionLayout as LayoutData,
      shop: shopLayout as LayoutData,
    };

    for (const frame of ['convention', 'shop'] as const) {
      let layout = defaults[frame];
      if (window.desktop) {
        const saved = await window.desktop.loadLayout(frame);
        if (saved) {
          layout = JSON.parse(saved) as LayoutData;
        }
      }
      this.placeMode.seedFloor(frame, layout.floor);
      this.placeMode.seedPlaceables(frame, layout.objects);
    }

    for (const p of this.placeMode.getAllPlaceables()) {
      p.applyDepth();
    }
  }

  private sortDepths(): void {
    for (const entity of this.placeMode.getAllPlaceables()) {
      entity.applyDepth();
    }
    this.player.applyDepth();
  }
}
