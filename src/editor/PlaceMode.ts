import Phaser from 'phaser';
import { getCatalogItem, type CatalogItem } from '../assets/catalog';
import { snapToGrid } from '../core/depth';
import { interaction } from '../core/interaction';
import {
  CONVENTION_FLOOR_TOP,
  CONVENTION_WIDTH,
  DEPTH_FLOOR,
  SHOP_FLOOR_TOP,
  SHOP_WIDTH,
  TILE,
  FLOOR_SUBTILE,
} from '../core/constants';
import { Placeable, type PlacedObjectData } from '../entities/Placeable';
import { getSceneFrames, type SceneFrameId } from '../world/WorldLayout';
import { AssetPalette } from './AssetPalette';

export interface LayoutData {
  frame: SceneFrameId;
  objects: PlacedObjectData[];
  floor?: PlacedObjectData[];
}

export class PlaceMode {
  private scene: Phaser.Scene;
  private palette: AssetPalette;
  private gridGraphics: Phaser.GameObjects.Graphics;
  private ghost?: Phaser.GameObjects.Image;
  private active = false;
  private editingFrame: SceneFrameId = 'convention';
  private selectedCatalog: CatalogItem | null = null;
  private selectedPlaceable: Placeable | null = null;
  private placeables: Placeable[] = [];
  private floorTiles = new Map<string, Phaser.GameObjects.Image>();
  private nextInstanceId = 1;
  private hudEl: HTMLElement;
  private onLayoutChange: (frame: SceneFrameId, data: LayoutData) => void;

  constructor(
    scene: Phaser.Scene,
    editingFrame: SceneFrameId,
    onLayoutChange: (frame: SceneFrameId, data: LayoutData) => void,
  ) {
    this.scene = scene;
    this.editingFrame = editingFrame;
    this.onLayoutChange = onLayoutChange;

    this.gridGraphics = scene.add.graphics().setDepth(9000).setVisible(false);
    this.drawGrid();

    this.palette = new AssetPalette('editor-ui', (item) => {
      this.selectedCatalog = item;
      this.selectedPlaceable = null;
      this.updateGhost();
    });

    this.hudEl = document.createElement('div');
    this.hudEl.id = 'hud-banner';
    document.getElementById('editor-ui')?.appendChild(this.hudEl);
    this.updateHud();

    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('contextmenu', this.onContextMenu, this);
    scene.input.keyboard?.on('keydown-F2', () => this.toggle());
    window.desktop?.onTogglePlaceMode(() => this.toggle());
    scene.input.keyboard?.on('keydown-DELETE', () => this.deleteSelected());
    scene.input.keyboard?.on('keydown-S', (event: KeyboardEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
        void this.saveCurrentFrame();
      }
    });
  }

  isActive(): boolean {
    return this.active;
  }

  getEditingFrame(): SceneFrameId {
    return this.editingFrame;
  }

  setEditingFrame(frame: SceneFrameId): void {
    this.editingFrame = frame;
    this.drawGrid();
    this.updateHud();
  }

  toggle(): void {
    this.setActive(!this.active);
  }

  setActive(active: boolean): void {
    this.active = active;
    this.gridGraphics.setVisible(active);
    this.palette.setVisible(active);
    interaction.setEditMode(active);
    if (!active) {
      this.ghost?.setVisible(false);
      this.selectedPlaceable = null;
    }
    this.updateHud();
  }

  // ---- seeding / persistence -------------------------------------------------

  seedPlaceables(frame: SceneFrameId, objects: PlacedObjectData[]): void {
    const frameX = getSceneFrames()[frame].x;
    for (const obj of objects) {
      const worldX = this.toWorldX(frame, frameX, obj.x);
      this.spawnPlaceable({ ...obj, x: worldX });
    }
  }

  seedFloor(frame: SceneFrameId, tiles: PlacedObjectData[] | undefined): void {
    if (!tiles) return;
    const frameX = getSceneFrames()[frame].x;
    for (const tile of tiles) {
      const worldX = this.toWorldX(frame, frameX, tile.x);
      this.paintFloorTile(tile.catalogId, worldX, tile.y);
    }
  }

  /**
   * Shop layouts store frame-relative x (0…SHOP_WIDTH).
   * Legacy saves used absolute world x from the old fixed 80px road (shop at x=400).
   */
  private toWorldX(frame: SceneFrameId, frameX: number, x: number): number {
    if (frame !== 'shop') return x;
    if (x < SHOP_WIDTH) return frameX + x;
    const legacyShopOrigin = CONVENTION_WIDTH + 80;
    return frameX + (x - legacyShopOrigin);
  }

  clearAllPlaceables(): void {
    for (const p of this.placeables) p.destroy();
    this.placeables = [];
  }

  getAllPlaceables(): Placeable[] {
    return this.placeables;
  }

  /** Find the topmost placeable (a "station") under a world point, any frame. */
  stationAtWorld(worldX: number, worldY: number): Placeable | null {
    for (let i = this.placeables.length - 1; i >= 0; i--) {
      const p = this.placeables[i];
      if (this.hitsPlaceable(p, worldX, worldY)) return p;
    }
    return null;
  }

  toLayout(frame: SceneFrameId): LayoutData {
    const bounds = getSceneFrames()[frame];
    const inFrame = (x: number) => x >= bounds.x && x <= bounds.x + bounds.width;
    return {
      frame,
      // Shop coords are saved relative to the shop frame so layouts survive road resize.
      objects: this.placeables
        .filter((p) => inFrame(p.x))
        .map((p) => {
          const data = p.toData();
          if (frame === 'shop') data.x -= bounds.x;
          return data;
        }),
      floor: [...this.floorTiles.values()]
        .filter((t) => inFrame(t.x))
        .map((t) => {
          const x = frame === 'shop' ? t.x - bounds.x : t.x;
          return { catalogId: t.getData('catalogId') as string, x, y: t.y };
        }),
    };
  }

  /** Move shop content when the responsive road changes width. */
  shiftShopContent(deltaX: number, oldShopX: number, shopWidth: number): void {
    if (deltaX === 0) return;
    for (const p of this.placeables) {
      if (p.x >= oldShopX && p.x < oldShopX + shopWidth) {
        p.setFootPosition(p.x + deltaX, p.y);
      }
    }
    for (const tile of this.floorTiles.values()) {
      if (tile.x >= oldShopX && tile.x < oldShopX + shopWidth) {
        tile.setPosition(tile.x + deltaX, tile.y);
      }
    }
    this.drawGrid();
  }

  onLayoutBoundsChanged(): void {
    this.drawGrid();
  }

  // ---- spawning --------------------------------------------------------------

  private spawnPlaceable(data: PlacedObjectData): Placeable {
    const placeable = new Placeable(this.scene, `inst_${this.nextInstanceId++}`, data);
    this.placeables.push(placeable);
    return placeable;
  }

  private floorKey(x: number, y: number): string {
    return `${x}_${y}`;
  }

  private paintFloorTile(catalogId: string, x: number, y: number): void {
    const item = getCatalogItem(catalogId);
    if (!item) return;
    const key = this.floorKey(x, y);
    const existing = this.floorTiles.get(key);
    if (existing) existing.destroy();

    const tile = this.scene.add
      .image(x, y, item.id)
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH_FLOOR + 1);
    tile.setData('catalogId', catalogId);
    this.floorTiles.set(key, tile);
  }

  private eraseFloorTile(x: number, y: number): void {
    const key = this.floorKey(x, y);
    const existing = this.floorTiles.get(key);
    if (existing) {
      existing.destroy();
      this.floorTiles.delete(key);
    }
  }

  // ---- pointer handling ------------------------------------------------------

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.active) return;
    if (pointer.rightButtonDown()) return;

    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

    if (this.selectedCatalog?.category === 'floor') {
      this.paintFloorAt(world.x, world.y);
      return;
    }

    if (this.selectedCatalog) {
      const pos = this.snapFurniture(world.x, world.y);
      const placed = this.spawnPlaceable({ catalogId: this.selectedCatalog.id, x: pos.x, y: pos.y });
      this.selectedPlaceable = placed;
      this.notifyChange();
      return;
    }

    this.selectedPlaceable = this.stationAtWorld(world.x, world.y);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.active) {
      this.ghost?.setVisible(false);
      return;
    }
    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.updateGhostPosition(world.x, world.y);

    if (pointer.isDown && !pointer.rightButtonDown() && this.selectedCatalog?.category === 'floor') {
      this.paintFloorAt(world.x, world.y);
    }
  }

  private onContextMenu(pointer: Phaser.Input.Pointer): void {
    if (!this.active) return;
    pointer.event.preventDefault();
    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

    if (this.selectedCatalog?.category === 'floor') {
      const pos = this.snapFloor(world.x, world.y);
      this.eraseFloorTile(pos.x, pos.y);
      this.notifyChange();
      return;
    }

    const hit = this.stationAtWorld(world.x, world.y);
    if (hit) {
      this.placeables = this.placeables.filter((p) => p !== hit);
      hit.destroy();
      if (this.selectedPlaceable === hit) this.selectedPlaceable = null;
      this.notifyChange();
    }
  }

  private paintFloorAt(worldX: number, worldY: number): void {
    if (!this.selectedCatalog) return;
    const pos = this.snapFloor(worldX, worldY);
    this.paintFloorTile(this.selectedCatalog.id, pos.x, pos.y);
    this.notifyChange();
  }

  deleteSelected(): void {
    if (!this.active || !this.selectedPlaceable) return;
    const hit = this.selectedPlaceable;
    this.placeables = this.placeables.filter((p) => p !== hit);
    hit.destroy();
    this.selectedPlaceable = null;
    this.notifyChange();
  }

  nudgeSelected(dx: number, dy: number): void {
    if (!this.active || !this.selectedPlaceable) return;
    const frame = getSceneFrames()[this.editingFrame];
    const p = this.selectedPlaceable;
    const floorTop = this.floorTopFor(this.editingFrame);
    p.setFootPosition(
      Phaser.Math.Clamp(p.x + dx, frame.x + TILE / 2, frame.x + frame.width - TILE / 2),
      Phaser.Math.Clamp(p.y + dy, floorTop + TILE, frame.y + frame.height - FLOOR_SUBTILE),
    );
    this.notifyChange();
  }

  // ---- snapping & hit-testing ------------------------------------------------

  private floorTopFor(frameId: SceneFrameId): number {
    return frameId === 'convention' ? CONVENTION_FLOOR_TOP : SHOP_FLOOR_TOP;
  }

  private snapFurniture(worldX: number, worldY: number): { x: number; y: number } {
    const frame = getSceneFrames()[this.editingFrame];
    const floorTop = this.floorTopFor(this.editingFrame);
    return {
      x: Phaser.Math.Clamp(snapToGrid(worldX), frame.x + TILE / 2, frame.x + frame.width - TILE / 2),
      y: Phaser.Math.Clamp(
        snapToGrid(worldY),
        floorTop + TILE,
        frame.y + frame.height - FLOOR_SUBTILE,
      ),
    };
  }

  private snapFloor(worldX: number, worldY: number): { x: number; y: number } {
    const frame = getSceneFrames()[this.editingFrame];
    const floorTop = this.floorTopFor(this.editingFrame);
    const gx = Math.floor((worldX - frame.x) / FLOOR_SUBTILE) * FLOOR_SUBTILE + frame.x + FLOOR_SUBTILE / 2;
    const gy = Math.floor(worldY / FLOOR_SUBTILE) * FLOOR_SUBTILE + FLOOR_SUBTILE / 2;
    return {
      x: Phaser.Math.Clamp(gx, frame.x + FLOOR_SUBTILE / 2, frame.x + frame.width - FLOOR_SUBTILE / 2),
      y: Phaser.Math.Clamp(gy, floorTop + FLOOR_SUBTILE / 2, frame.height - FLOOR_SUBTILE / 2),
    };
  }

  private hitsPlaceable(p: Placeable, x: number, y: number): boolean {
    const left = p.x - p.catalogItem.footX;
    const top = p.y - p.catalogItem.footY;
    const right = left + p.catalogItem.width;
    const bottom = p.y;
    return x >= left && x <= right && y >= top && y <= bottom;
  }

  // ---- ghost preview ---------------------------------------------------------

  private updateGhost(): void {
    if (!this.selectedCatalog) {
      this.ghost?.setVisible(false);
      return;
    }
    if (!this.ghost) {
      this.ghost = this.scene.add.image(0, 0, this.selectedCatalog.id).setDepth(9500).setAlpha(0.55);
    } else {
      this.ghost.setTexture(this.selectedCatalog.id).setVisible(true).setAlpha(0.55);
    }
    const item = this.selectedCatalog;
    if (item.category === 'floor') {
      this.ghost.setOrigin(0.5, 0.5);
    } else {
      this.ghost.setOrigin(item.footX / item.width, 1);
    }
  }

  private updateGhostPosition(worldX: number, worldY: number): void {
    if (!this.ghost || !this.selectedCatalog) return;
    const pos =
      this.selectedCatalog.category === 'floor'
        ? this.snapFloor(worldX, worldY)
        : this.snapFurniture(worldX, worldY);
    this.ghost.setVisible(true).setPosition(pos.x, pos.y);
  }

  // ---- misc ------------------------------------------------------------------

  private drawGrid(): void {
    const frame = getSceneFrames()[this.editingFrame];
    const floorTop = this.floorTopFor(this.editingFrame);
    this.gridGraphics.clear();
    this.gridGraphics.lineStyle(1, 0xffffff, 0.1);
    for (let x = frame.x; x <= frame.x + frame.width; x += TILE) {
      this.gridGraphics.lineBetween(x, floorTop, x, frame.y + frame.height);
    }
    for (let y = floorTop; y <= frame.y + frame.height; y += TILE) {
      this.gridGraphics.lineBetween(frame.x, y, frame.x + frame.width, y);
    }
  }

  private notifyChange(): void {
    this.onLayoutChange(this.editingFrame, this.toLayout(this.editingFrame));
  }

  async saveCurrentFrame(): Promise<void> {
    const layout = this.toLayout(this.editingFrame);
    const json = JSON.stringify(layout, null, 2);
    if (window.desktop) {
      await window.desktop.saveLayout(this.editingFrame, json);
    } else {
      console.log('Layout save (browser):', json);
    }
    this.updateHud('Saved!');
  }

  private updateHud(extra?: string): void {
    const mode = this.active ? 'EDIT' : 'PLAY';
    const hint = this.active
      ? 'Pick an asset → click to place · Floors: click/drag to paint · Right-click delete · Tab switch scene · Ctrl+S save'
      : 'Click a station to walk there · F2 to edit';
    this.hudEl.innerHTML = `
      <div><strong>${mode}</strong> — ${this.editingFrame}</div>
      <div>${hint}</div>
      ${extra ? `<div>${extra}</div>` : ''}
    `;
  }
}
