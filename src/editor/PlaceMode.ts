import Phaser from 'phaser';
import { getCatalogItem, type CatalogItem } from '../assets/catalog';
import { snapToGrid } from '../core/depth';
import { interaction } from '../core/interaction';
import {
  DEPTH_FLOOR,
  SHOP_FLOOR_TOP,
  SHOP_WIDTH,
  TILE,
  FLOOR_SUBTILE,
} from '../core/constants';
import {
  Placeable,
  type PlacedObjectData,
  type PlaceableLayer,
} from '../entities/Placeable';
import {
  conventionPropsLayoutName,
  conventionRoomBounds,
  getActiveConventionVenue,
  getActiveConventionVenueId,
  getBoothAnchor,
  getConventionRoomAt,
  getConventionRooms,
  getConventionWidth,
  type ConventionPropsLayout,
  type PlayerBoothLayout,
} from '../world/ConventionVenue';
import { frameForX, getSceneFrames, type SceneFrameId } from '../world/WorldLayout';
import { AssetPalette } from './AssetPalette';

export interface LayoutData {
  frame: SceneFrameId;
  objects: PlacedObjectData[];
  floor?: PlacedObjectData[];
}

export type ConventionEditLayer = 'booth' | 'venue';

const FURNITURE_PAINT_ALPHA = 0.18;
const FURNITURE_NORMAL_ALPHA = 1;
const INACTIVE_LAYER_ALPHA = 0.45;
const INACTIVE_FRAME_ALPHA = 0.38;
/** Extra pixels around sprite bounds so clicks register reliably. */
const EDITOR_HIT_PAD = 6;

export class PlaceMode {
  private scene: Phaser.Scene;
  private palette: AssetPalette;
  private gridGraphics: Phaser.GameObjects.Graphics;
  private selectionGraphics: Phaser.GameObjects.Graphics;
  private ghost?: Phaser.GameObjects.Image;
  private active = false;
  private paintMode = false;
  private editingFrame: SceneFrameId = 'convention';
  private conventionEditLayer: ConventionEditLayer = 'booth';
  private boothAnchor = getBoothAnchor();
  private selectedCatalog: CatalogItem | null = null;
  private selectedPlaceable: Placeable | null = null;
  private dragging: Placeable | null = null;
  private placeables: Placeable[] = [];
  private floorTiles = new Map<string, Phaser.GameObjects.Image>();
  private nextInstanceId = 1;
  private hudEl: HTMLElement;
  private hudBody: HTMLElement;
  private currentStation: Placeable | null = null;
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
    this.selectionGraphics = scene.add.graphics().setDepth(9200).setVisible(false);
    this.drawGrid();

    this.palette = new AssetPalette('editor-ui', (item) => {
      if (this.paintMode && item.category !== 'floor') return;
      this.selectedCatalog = item;
      this.selectedPlaceable = null;
      this.updateGhost();
      this.updateSelectionOutline();
    });

    this.hudEl = document.createElement('div');
    this.hudEl.id = 'hud-banner';
    this.hudBody = document.createElement('div');
    this.hudBody.className = 'hud-body';
    this.hudEl.appendChild(this.hudBody);
    document.getElementById('editor-ui')?.appendChild(this.hudEl);
    this.updateHud();

    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('contextmenu', this.onContextMenu, this);
    scene.input.keyboard?.on('keydown-F2', () => this.toggle());
    window.desktop?.onTogglePlaceMode(() => this.toggle());
    scene.input.keyboard?.on('keydown-P', () => {
      if (!this.active) return;
      this.togglePaintMode();
    });
    scene.input.keyboard?.on('keydown-B', () => {
      if (!this.active || this.editingFrame !== 'convention' || this.paintMode) return;
      this.toggleConventionEditLayer();
    });
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

  isPaintMode(): boolean {
    return this.paintMode;
  }

  getEditingFrame(): SceneFrameId {
    return this.editingFrame;
  }

  getConventionEditLayer(): ConventionEditLayer {
    return this.conventionEditLayer;
  }

  setBoothAnchor(anchor: { x: number; y: number }): void {
    const dx = anchor.x - this.boothAnchor.x;
    const dy = anchor.y - this.boothAnchor.y;
    this.boothAnchor = anchor;
    if (dx === 0 && dy === 0) return;
    for (const p of this.placeables) {
      if (p.layer === 'booth') {
        p.setFootPosition(p.x + dx, p.y + dy);
      }
    }
  }

  toggleConventionEditLayer(): void {
    this.conventionEditLayer = this.conventionEditLayer === 'booth' ? 'venue' : 'booth';
    this.selectedPlaceable = null;
    this.dragging = null;
    this.applyFurnitureAlpha();
    this.updateSelectionOutline();
    this.updateHud();
  }

  setEditingFrame(frame: SceneFrameId): void {
    if (this.editingFrame === frame) return;
    this.editingFrame = frame;
    this.selectedPlaceable = null;
    this.dragging = null;
    interaction.setDragLock(false);
    this.applyFurnitureAlpha();
    this.drawGrid();
    this.updateSelectionOutline();
    this.updateHud();
  }

  toggle(): void {
    this.setActive(!this.active);
  }

  togglePaintMode(): void {
    this.setPaintMode(!this.paintMode);
  }

  setPaintMode(on: boolean): void {
    if (this.paintMode === on) return;
    this.paintMode = on;
    this.selectedPlaceable = null;
    this.dragging = null;
    if (on) {
      this.selectedCatalog = null;
      this.palette.setFloorOnly(true);
      this.ghost?.setVisible(false);
    } else {
      this.palette.setFloorOnly(false);
      this.selectedCatalog = null;
      this.ghost?.setVisible(false);
    }
    this.applyFurnitureAlpha();
    this.updateSelectionOutline();
    this.updateHud();
  }

  setActive(active: boolean): void {
    this.active = active;
    this.gridGraphics.setVisible(active);
    this.palette.setVisible(active);
    interaction.setEditMode(active);
    if (!active) {
      this.setPaintMode(false);
      this.ghost?.setVisible(false);
      this.selectedPlaceable = null;
      this.dragging = null;
      interaction.setDragLock(false);
      this.applyFurnitureAlpha();
      this.selectionGraphics.setVisible(false);
    }
    this.updateHud();
  }

  /** Play-mode HUD: which station the avatar is at right now. */
  setCurrentStation(station: Placeable | null): void {
    this.currentStation = station;
    if (!this.active) this.updateHud();
  }

  /** Nearest clickable station to a foot position (used on spawn / after walking). */
  nearestStationTo(worldX: number, worldY: number): Placeable | null {
    const threshold = TILE * 2;
    let best: Placeable | null = null;
    let bestDist = threshold;
    for (const p of this.placeables) {
      const dist = Math.hypot(p.x - worldX, p.y - worldY);
      if (dist < bestDist) {
        bestDist = dist;
        best = p;
      }
    }
    return best;
  }

  // ---- seeding / persistence -------------------------------------------------

  seedPlaceables(frame: SceneFrameId, objects: PlacedObjectData[]): void {
    const frameX = getSceneFrames()[frame].x;
    const layer: PlaceableLayer = frame === 'shop' ? 'shop' : 'venue';
    for (const obj of objects) {
      const worldX = this.toWorldX(frame, frameX, obj.x);
      this.spawnPlaceable({ ...obj, x: worldX }, layer);
    }
    this.applyFurnitureAlpha();
  }

  seedBooth(layout: PlayerBoothLayout): void {
    const anchor = this.boothAnchor;
    for (const obj of layout.objects) {
      this.spawnPlaceable(
        { catalogId: obj.catalogId, x: anchor.x + obj.x, y: anchor.y + obj.y },
        'booth',
      );
    }
    this.applyFurnitureAlpha();
  }

  seedVenueProps(layout: ConventionPropsLayout): void {
    for (const obj of layout.objects) {
      this.spawnPlaceable({ catalogId: obj.catalogId, x: obj.x, y: obj.y }, 'venue');
    }
    this.seedFloor('convention', layout.floor);
  }

  seedFloor(frame: SceneFrameId, tiles: PlacedObjectData[] | undefined): void {
    if (!tiles) return;
    const frameX = getSceneFrames()[frame].x;
    for (const tile of tiles) {
      const worldX = this.toWorldX(frame, frameX, tile.x);
      this.paintFloorTile(tile.catalogId, worldX, tile.y);
    }
  }

  private toWorldX(frame: SceneFrameId, frameX: number, x: number): number {
    if (frame !== 'shop') return x;
    if (x < SHOP_WIDTH) return frameX + x;
    const legacyShopOrigin = getConventionWidth() + 80;
    return frameX + (x - legacyShopOrigin);
  }

  clearAllPlaceables(): void {
    for (const p of this.placeables) p.destroy();
    this.placeables = [];
  }

  clearConventionContent(): void {
    const frame = getSceneFrames().convention;
    this.placeables = this.placeables.filter((p) => {
      if (this.isInFrame(p.x, frame) && (p.layer === 'booth' || p.layer === 'venue')) {
        p.destroy();
        return false;
      }
      return true;
    });
    for (const [key, tile] of [...this.floorTiles.entries()]) {
      if (this.isInFrame(tile.x, frame)) {
        tile.destroy();
        this.floorTiles.delete(key);
      }
    }
    this.selectedPlaceable = null;
    this.dragging = null;
  }

  getAllPlaceables(): Placeable[] {
    return this.placeables;
  }

  stationAtWorld(
    worldX: number,
    worldY: number,
    frameId: SceneFrameId | 'all' = 'all',
  ): Placeable | null {
    const frame = frameId === 'all' ? null : getSceneFrames()[frameId];
    const layerFilter = frameId !== 'all' ? this.editLayerFilter() : null;
    return this.pickPlaceableAt(worldX, worldY, frame, layerFilter);
  }

  /**
   * Editor hit-test: finds furniture under the cursor in whichever scene frame
   * (convention or shop) was clicked, and switches the editor to that frame.
   */
  private editorPickAt(worldX: number, worldY: number): Placeable | null {
    const primary = frameForX(worldX);
    const order: SceneFrameId[] =
      primary === 'convention' ? ['convention', 'shop'] : ['shop', 'convention'];

    for (const frameId of order) {
      const frame = getSceneFrames()[frameId];
      const hit = this.pickPlaceableAt(worldX, worldY, frame, null, EDITOR_HIT_PAD);
      if (hit) {
        if (frameId !== this.editingFrame) this.setEditingFrame(frameId);
        return hit;
      }
    }
    return null;
  }

  private pickPlaceableAt(
    worldX: number,
    worldY: number,
    frame: { x: number; width: number } | null,
    layerFilter: PlaceableLayer | null,
    hitPad = 0,
  ): Placeable | null {
    const hits: Placeable[] = [];
    for (const p of this.placeables) {
      if (frame && !this.isInFrame(p.x, frame)) continue;
      if (layerFilter && p.layer !== layerFilter) continue;
      if (this.hitsPlaceable(p, worldX, worldY, hitPad)) hits.push(p);
    }
    if (hits.length === 0) return null;
    hits.sort((a, b) => b.getFootY() - a.getFootY());
    return hits[0];
  }

  toLayout(frame: SceneFrameId): LayoutData {
    const bounds = getSceneFrames()[frame];
    const inFrame = (x: number) => this.isInFrame(x, bounds);
    const layer =
      frame === 'shop' ? 'shop' : this.conventionEditLayer === 'booth' ? 'booth' : 'venue';
    return {
      frame,
      objects: this.placeables
        .filter((p) => inFrame(p.x) && p.layer === layer)
        .map((p) => {
          const data = p.toData();
          if (frame === 'shop') data.x -= bounds.x;
          if (frame === 'convention' && layer === 'booth') {
            data.x -= this.boothAnchor.x;
            data.y -= this.boothAnchor.y;
          }
          return data;
        }),
      floor:
        frame === 'convention' && layer === 'venue'
          ? [...this.floorTiles.values()]
              .filter((t) => inFrame(t.x))
              .map((t) => ({
                catalogId: t.getData('catalogId') as string,
                x: t.x,
                y: t.y,
              }))
          : undefined,
    };
  }

  toBoothLayout(): PlayerBoothLayout {
    const anchor = this.boothAnchor;
    return {
      objects: this.placeables
        .filter((p) => p.layer === 'booth')
        .map((p) => ({
          catalogId: p.catalogId,
          x: p.x - anchor.x,
          y: p.y - anchor.y,
        })),
    };
  }

  toVenuePropsLayout(): ConventionPropsLayout {
    return {
      venueId: getActiveConventionVenueId(),
      objects: this.placeables
        .filter((p) => p.layer === 'venue')
        .map((p) => p.toData()),
      floor: [...this.floorTiles.values()]
        .filter((t) => this.isInFrame(t.x, getSceneFrames().convention))
        .map((t) => ({
          catalogId: t.getData('catalogId') as string,
          x: t.x,
          y: t.y,
        })),
    };
  }

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
    this.updateSelectionOutline();
  }

  onLayoutBoundsChanged(): void {
    this.drawGrid();
    this.updateSelectionOutline();
  }

  // ---- spawning --------------------------------------------------------------

  private spawnPlaceable(data: PlacedObjectData, layer: PlaceableLayer): Placeable {
    const placeable = new Placeable(this.scene, `inst_${this.nextInstanceId++}`, data, layer);
    this.placeables.push(placeable);
    if (this.paintMode) {
      placeable.setAlpha(FURNITURE_PAINT_ALPHA);
    }
    return placeable;
  }

  private currentPlaceableLayer(): PlaceableLayer {
    if (this.editingFrame === 'shop') return 'shop';
    return this.conventionEditLayer === 'booth' ? 'booth' : 'venue';
  }

  private editLayerFilter(): PlaceableLayer | null {
    if (this.editingFrame !== 'convention' || !this.active || this.paintMode) return null;
    return this.conventionEditLayer;
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
    this.focusFrameAtWorldX(world.x);
    const shiftRemove = pointer.event.shiftKey;

    if (this.paintMode || this.selectedCatalog?.category === 'floor') {
      if (shiftRemove && this.canPaintFloor()) {
        const pos = this.snapFloor(world.x, world.y);
        this.eraseFloorTile(pos.x, pos.y);
        this.notifyChange();
        return;
      }
      if (this.selectedCatalog?.category === 'floor' && this.canPaintFloor()) {
        this.paintFloorAt(world.x, world.y);
      }
      return;
    }

    if (shiftRemove) {
      const removeTarget = this.editorPickAt(world.x, world.y);
      if (removeTarget) {
        this.removePlaceable(removeTarget);
        return;
      }
    }

    const hit = this.editorPickAt(world.x, world.y);
    if (hit) {
      this.selectPlaceableForEdit(hit);
      this.dragging = hit;
      interaction.setDragLock(true);
      this.updateSelectionOutline();
      return;
    }

    if (this.selectedCatalog) {
      const pos = this.snapFurniture(world.x, world.y);
      const occupied = this.pickPlaceableNearFoot(pos.x, pos.y, this.editingFrame);
      if (occupied) {
        this.selectPlaceableForEdit(occupied);
        this.dragging = occupied;
        interaction.setDragLock(true);
        this.updateSelectionOutline();
        return;
      }
      const placed = this.spawnPlaceable(
        { catalogId: this.selectedCatalog.id, x: pos.x, y: pos.y },
        this.currentPlaceableLayer(),
      );
      this.selectPlaceableForEdit(placed);
      this.notifyChange();
      return;
    }

    this.selectedPlaceable = null;
    this.dragging = null;
    this.updateSelectionOutline();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.active) {
      this.ghost?.setVisible(false);
      return;
    }
    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

    if (!this.dragging && this.selectedCatalog) {
      this.focusFrameAtWorldX(world.x);
    }

    if (this.dragging && pointer.isDown && !pointer.rightButtonDown()) {
      const pos = this.snapFurniture(world.x, world.y);
      this.dragging.setFootPosition(pos.x, pos.y);
      this.dragging.setDepth(9600);
      this.updateSelectionOutline();
      return;
    }

    this.updateGhostPosition(world.x, world.y);

    const paintingFloor =
      this.canPaintFloor() &&
      this.selectedCatalog?.category === 'floor' &&
      pointer.isDown &&
      !pointer.rightButtonDown();
    if (paintingFloor) {
      this.paintFloorAt(world.x, world.y);
    }
  }

  private onPointerUp(): void {
    if (this.dragging) {
      this.dragging.applyDepth();
      this.dragging = null;
      interaction.setDragLock(false);
      this.notifyChange();
    }
  }

  private onContextMenu(pointer: Phaser.Input.Pointer): void {
    if (!this.active) return;
    pointer.event.preventDefault();
    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

    if (this.canPaintFloor() && (this.paintMode || this.selectedCatalog?.category === 'floor')) {
      const pos = this.snapFloor(world.x, world.y);
      this.eraseFloorTile(pos.x, pos.y);
      this.notifyChange();
      return;
    }

    const hit = this.editorPickAt(world.x, world.y);
    if (hit) this.removePlaceable(hit);
  }

  /** Select a placed object for move/nudge/delete; sync convention layer if needed. */
  private selectPlaceableForEdit(placeable: Placeable): void {
    this.selectedPlaceable = placeable;
    this.selectedCatalog = null;
    this.palette.clearSelection();
    this.ghost?.setVisible(false);

    if (
      this.editingFrame === 'convention' &&
      (placeable.layer === 'booth' || placeable.layer === 'venue') &&
      placeable.layer !== this.conventionEditLayer
    ) {
      this.conventionEditLayer = placeable.layer;
      this.applyFurnitureAlpha();
      this.updateHud();
    }
  }

  private canPaintFloor(): boolean {
    return this.editingFrame === 'convention' && this.conventionEditLayer === 'venue';
  }

  private paintFloorAt(worldX: number, worldY: number): void {
    if (!this.selectedCatalog || this.selectedCatalog.category !== 'floor') return;
    const pos = this.snapFloor(worldX, worldY);
    this.paintFloorTile(this.selectedCatalog.id, pos.x, pos.y);
    this.notifyChange();
  }

  deleteSelected(): void {
    if (!this.active || !this.selectedPlaceable || this.paintMode) return;
    this.removePlaceable(this.selectedPlaceable);
  }

  private removePlaceable(hit: Placeable): void {
    this.placeables = this.placeables.filter((p) => p !== hit);
    hit.destroy();
    if (this.selectedPlaceable === hit) this.selectedPlaceable = null;
    if (this.dragging === hit) {
      this.dragging = null;
      interaction.setDragLock(false);
    }
    this.updateSelectionOutline();
    this.notifyChange();
  }

  nudgeSelected(dx: number, dy: number): void {
    if (!this.active || !this.selectedPlaceable || this.paintMode) return;
    const p = this.selectedPlaceable;
    const zone = this.zoneAt(p.x, this.editingFrame);
    p.setFootPosition(
      Phaser.Math.Clamp(p.x + dx, zone.x + TILE / 2, zone.x + zone.width - TILE / 2),
      Phaser.Math.Clamp(p.y + dy, zone.floorTop + TILE, zone.y + zone.height - FLOOR_SUBTILE),
    );
    this.updateSelectionOutline();
    this.notifyChange();
  }

  // ---- zones, snapping & hit-testing -----------------------------------------

  private isInFrame(x: number, frame: { x: number; width: number }): boolean {
    return x >= frame.x && x < frame.x + frame.width;
  }

  private zoneAt(
    worldX: number,
    frameId: SceneFrameId,
  ): { x: number; width: number; floorTop: number; y: number; height: number } {
    const frame = getSceneFrames()[frameId];
    if (frameId === 'convention') {
      const room = getConventionRoomAt(worldX);
      if (room) {
        const b = conventionRoomBounds(room, frame.x);
        return { ...b, y: frame.y, height: frame.height };
      }
    }
    return {
      x: frame.x,
      width: frame.width,
      floorTop: SHOP_FLOOR_TOP,
      y: frame.y,
      height: frame.height,
    };
  }

  private snapFurniture(worldX: number, worldY: number): { x: number; y: number } {
    const zone = this.zoneAt(worldX, this.editingFrame);
    return {
      x: Phaser.Math.Clamp(snapToGrid(worldX), zone.x + TILE / 2, zone.x + zone.width - TILE / 2),
      y: Phaser.Math.Clamp(
        snapToGrid(worldY),
        zone.floorTop + TILE,
        zone.y + zone.height - FLOOR_SUBTILE,
      ),
    };
  }

  private snapFloor(worldX: number, worldY: number): { x: number; y: number } {
    const zone = this.zoneAt(worldX, this.editingFrame);
    const gx = Math.floor((worldX - zone.x) / FLOOR_SUBTILE) * FLOOR_SUBTILE + zone.x + FLOOR_SUBTILE / 2;
    const gy = Math.floor(worldY / FLOOR_SUBTILE) * FLOOR_SUBTILE + FLOOR_SUBTILE / 2;
    return {
      x: Phaser.Math.Clamp(gx, zone.x + FLOOR_SUBTILE / 2, zone.x + zone.width - FLOOR_SUBTILE / 2),
      y: Phaser.Math.Clamp(gy, zone.floorTop + FLOOR_SUBTILE / 2, zone.height - FLOOR_SUBTILE / 2),
    };
  }

  private hitsPlaceable(p: Placeable, x: number, y: number, pad = 0): boolean {
    const left = p.x - p.catalogItem.footX - pad;
    const top = p.y - p.catalogItem.footY - pad;
    const right = left + p.catalogItem.width + pad * 2;
    const bottom = p.y + pad;
    return x >= left && x <= right && y >= top && y <= bottom;
  }

  /** True when a placed item already occupies this foot position (prevents duplicates). */
  private pickPlaceableNearFoot(
    footX: number,
    footY: number,
    frameId: SceneFrameId,
  ): Placeable | null {
    const frame = getSceneFrames()[frameId];
    const threshold = TILE * 0.75;
    let best: Placeable | null = null;
    let bestDist = threshold;
    for (const p of this.placeables) {
      if (!this.isInFrame(p.x, frame)) continue;
      const dist = Math.hypot(p.x - footX, p.y - footY);
      if (dist < bestDist) {
        bestDist = dist;
        best = p;
      }
    }
    return best;
  }

  /** Switch the editor to convention or shop based on where the pointer is. */
  private focusFrameAtWorldX(worldX: number): void {
    if (this.paintMode || this.dragging) return;
    const frame = frameForX(worldX);
    if (frame !== this.editingFrame) this.setEditingFrame(frame);
  }

  private stationDisplayName(station: Placeable | null): string {
    if (!station) return '—';
    return station.catalogItem.name;
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

  // ---- selection & furniture dimming -----------------------------------------

  private applyFurnitureAlpha(): void {
    const frame = getSceneFrames()[this.editingFrame];
    for (const p of this.placeables) {
      if (!this.isInFrame(p.x, frame)) {
        p.setAlpha(this.active ? INACTIVE_FRAME_ALPHA : FURNITURE_NORMAL_ALPHA);
        continue;
      }
      if (this.paintMode && this.active) {
        p.setAlpha(FURNITURE_PAINT_ALPHA);
        continue;
      }
      if (this.editingFrame === 'convention' && this.active) {
        const isActiveLayer = p.layer === this.conventionEditLayer;
        p.setAlpha(isActiveLayer ? FURNITURE_NORMAL_ALPHA : INACTIVE_LAYER_ALPHA);
        continue;
      }
      p.setAlpha(FURNITURE_NORMAL_ALPHA);
    }
  }

  private updateSelectionOutline(): void {
    this.selectionGraphics.clear();
    if (!this.active || !this.selectedPlaceable || this.paintMode) {
      this.selectionGraphics.setVisible(false);
      return;
    }
    const p = this.selectedPlaceable;
    const left = p.x - p.catalogItem.footX;
    const top = p.y - p.catalogItem.footY;
    const w = p.catalogItem.width;
    const h = p.catalogItem.footY;
    const color = p.layer === 'booth' ? 0xffc86e : 0x6ecfff;
    this.selectionGraphics.setVisible(true);
    this.selectionGraphics.lineStyle(1, color, 0.95);
    this.selectionGraphics.strokeRect(left - 1, top - 1, w + 2, h + 2);
    this.selectionGraphics.lineStyle(1, 0xffffff, 0.35);
    this.selectionGraphics.strokeRect(left, top, w, h);
  }

  // ---- misc ------------------------------------------------------------------

  private drawGrid(): void {
    const frame = getSceneFrames()[this.editingFrame];
    this.gridGraphics.clear();
    this.gridGraphics.lineStyle(1, 0xffffff, 0.1);

    const zones =
      this.editingFrame === 'convention'
        ? getConventionRooms().map((room) => conventionRoomBounds(room, frame.x))
        : [{ x: frame.x, width: frame.width, floorTop: SHOP_FLOOR_TOP }];

    for (const zone of zones) {
      for (let x = zone.x; x <= zone.x + zone.width; x += TILE) {
        this.gridGraphics.lineBetween(x, zone.floorTop, x, frame.y + frame.height);
      }
      for (let y = zone.floorTop; y <= frame.y + frame.height; y += TILE) {
        this.gridGraphics.lineBetween(zone.x, y, zone.x + zone.width, y);
      }
      this.gridGraphics.lineStyle(1, 0x6ecfff, 0.25);
      this.gridGraphics.lineBetween(zone.x, zone.floorTop, zone.x + zone.width, zone.floorTop);
      this.gridGraphics.lineStyle(1, 0xffffff, 0.1);
    }
  }

  private notifyChange(): void {
    this.onLayoutChange(this.editingFrame, this.toLayout(this.editingFrame));
  }

  async saveCurrentFrame(): Promise<void> {
    let name: string;
    let json: string;

    if (this.editingFrame === 'shop') {
      name = 'shop';
      json = JSON.stringify(this.toLayout('shop'), null, 2);
    } else if (this.conventionEditLayer === 'booth') {
      name = 'player_booth';
      json = JSON.stringify(this.toBoothLayout(), null, 2);
    } else {
      name = conventionPropsLayoutName();
      json = JSON.stringify(this.toVenuePropsLayout(), null, 2);
    }

    if (window.desktop) {
      await window.desktop.saveLayout(name, json);
    } else {
      console.log(`Layout save (browser) [${name}]:`, json);
    }
    this.updateHud('Saved!');
  }

  private updateHud(extra?: string): void {
    if (!this.active) {
      this.hudBody.innerHTML = `
        <div>Current station: <strong>${this.stationDisplayName(this.currentStation)}</strong></div>
        <div>Click a station to walk · F2 edit</div>
        ${extra ? `<div>${extra}</div>` : ''}
      `;
      return;
    }

    const venue = getActiveConventionVenue();
    const mode = this.paintMode ? 'PAINT' : 'EDIT';
    const frameLabel =
      this.editingFrame === 'convention'
        ? `${venue.name} · ${this.conventionEditLayer === 'booth' ? 'your booth' : 'venue props'}`
        : 'shop';
    const hint = this.paintMode
      ? 'Paint floor · Shift+click erase tile · P exit · Ctrl+S save props'
      : this.editingFrame === 'convention'
        ? 'Click/drag move · Shift+click remove · Del · B booth/venue · Ctrl+S'
        : 'Click/drag move · Shift+click remove · Del · Pick asset to place · Ctrl+S';

    this.hudBody.innerHTML = `
      <div><strong>${mode}</strong> — ${frameLabel}</div>
      <div>${hint}</div>
      ${extra ? `<div>${extra}</div>` : ''}
    `;
  }
}
