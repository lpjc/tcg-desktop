import Phaser from 'phaser';
import { getCatalogItem, type CatalogItem } from '../assets/catalog';
import { depthFromFootY } from '../core/depth';

export type PlaceableLayer = 'booth' | 'venue' | 'shop';

export interface PlacedObjectData {
  catalogId: string;
  x: number;
  y: number;
  interaction?: string;
}

export class Placeable extends Phaser.GameObjects.Image {
  readonly catalogId: string;
  readonly catalogItem: CatalogItem;
  readonly instanceId: string;
  readonly layer: PlaceableLayer;

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

    this.setOrigin(item.footX / item.width, 1);
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
    };
  }
}
