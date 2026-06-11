import Phaser from 'phaser';
import {
  applyCatalogScale,
  getCatalogItem,
  type CatalogItem,
  type CollisionBox,
} from '../assets/catalog';
import { depthFromFootY } from '../core/depth';

export type PlaceableLayer = 'booth' | 'venue' | 'shop';

/** Which side of a station's collision box the player stands at when arriving. */
export type StationAnchor = 'below' | 'left' | 'right' | 'above';

export interface PlacedObjectData {
  catalogId: string;
  x: number;
  y: number;
  /** When true, the player can click this object to walk here (off by default). */
  station?: boolean;
  /** Stand side for a station (editor: A cycles). Omitted = 'below'. */
  anchor?: StationAnchor;
  /**
   * Editor override: does this item block walkers? Omitted = derive from the
   * catalog collision box (tables block, rugs/wall decor do not).
   */
  collidable?: boolean;
  /** Per-instance collision footprint in sprite-local pixels (editor: Shift+arrows). */
  collision?: CollisionBox;
}

export class Placeable extends Phaser.GameObjects.Image {
  readonly catalogId: string;
  readonly catalogItem: CatalogItem;
  readonly instanceId: string;
  readonly layer: PlaceableLayer;
  /** null = no override (use catalog heuristic); set via editor "C" toggle. */
  collidableOverride: boolean | null;
  /** null = use catalog collision; set when resized in the editor. */
  collisionBoxOverride: CollisionBox | null;
  /** Walk target for the player when clicked in play mode. */
  isStation: boolean;
  /** Side of the collision box where the player stands at this station. */
  stationAnchor: StationAnchor;

  constructor(
    scene: Phaser.Scene,
    instanceId: string,
    data: PlacedObjectData,
    layer: PlaceableLayer = 'venue',
  ) {
    const item = getCatalogItem(data.catalogId);
    if (!item) {
      throw new Error(`Unknown catalog id: ${data.catalogId}`);
    }

    super(scene, data.x, data.y, item.id);
    this.catalogId = data.catalogId;
    this.catalogItem = item;
    this.instanceId = instanceId;
    this.layer = layer;
    this.collidableOverride = data.collidable ?? null;
    this.collisionBoxOverride = data.collision ? { ...data.collision } : null;
    this.isStation = data.station ?? false;
    this.stationAnchor = data.anchor ?? 'below';

    this.setOrigin(item.footX / item.width, 1);
    applyCatalogScale(this, item);
    this.applyDepth();
    scene.add.existing(this);
  }

  getFootY(): number {
    return this.y;
  }

  setFootPosition(x: number, y: number): void {
    this.setPosition(x, y);
    this.applyDepth();
  }

  /** Sprite-local collision box (catalog default or per-instance override). */
  getCollisionBox(): CollisionBox {
    return this.collisionBoxOverride ?? this.catalogItem.collision;
  }

  /** Copy catalog collision into an editable override (first Shift+arrow nudge). */
  ensureCollisionBoxOverride(): void {
    if (this.collisionBoxOverride === null) {
      this.collisionBoxOverride = { ...this.catalogItem.collision };
    }
  }

  applyDepth(): void {
    this.setDepth(depthFromFootY(this.getFootY()));
  }

  toData(): PlacedObjectData {
    return {
      catalogId: this.catalogId,
      x: this.x,
      y: this.y,
      ...(this.isStation ? { station: true } : {}),
      ...(this.isStation && this.stationAnchor !== 'below'
        ? { anchor: this.stationAnchor }
        : {}),
      ...(this.collidableOverride !== null ? { collidable: this.collidableOverride } : {}),
      ...(this.collisionBoxOverride ? { collision: { ...this.collisionBoxOverride } } : {}),
    };
  }
}
