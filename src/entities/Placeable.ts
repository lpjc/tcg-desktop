import Phaser from 'phaser';
import { applyCatalogScale, getCatalogItem, type CatalogItem } from '../assets/catalog';
import { depthFromFootY } from '../core/depth';

export type PlaceableLayer = 'booth' | 'venue' | 'shop';

export interface PlacedObjectData {
  catalogId: string;
  x: number;
  y: number;
  interaction?: string;
  /**
   * Editor override: does this item block walkers? Omitted = derive from the
   * catalog collision box (tables block, rugs/wall decor do not).
   */
  collidable?: boolean;
}

export class Placeable extends Phaser.GameObjects.Image {
  readonly catalogId: string;
  readonly catalogItem: CatalogItem;
  readonly instanceId: string;
  readonly layer: PlaceableLayer;
  /** null = no override (use catalog heuristic); set via editor "C" toggle. */
  collidableOverride: boolean | null;

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

  applyDepth(): void {
    this.setDepth(depthFromFootY(this.getFootY()));
  }

  toData(): PlacedObjectData {
    return {
      catalogId: this.catalogId,
      x: this.x,
      y: this.y,
      ...(this.collidableOverride !== null ? { collidable: this.collidableOverride } : {}),
    };
  }
}
