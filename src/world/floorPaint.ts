import Phaser from 'phaser';
import { DEPTH_FLOOR, FLOOR_SUBTILE, WORLD_HEIGHT } from '../core/constants';

/** First 8px floor row at or below a zone's top edge. */
export function firstFloorRow(floorTopY: number): number {
  return Math.ceil(floorTopY / FLOOR_SUBTILE) * FLOOR_SUBTILE;
}

/**
 * Paint 8×8 floor tiles only within [floorTopY … bottom]. Rows above floorTopY
 * stay transparent so the desktop shows through.
 */
export function paintTiledFloor(
  scene: Phaser.Scene,
  x: number,
  width: number,
  floorTopY: number,
  textureKey: string,
): Phaser.GameObjects.Image[] {
  return paintPatternedFloor(scene, x, width, floorTopY, () => textureKey);
}

/**
 * Paint a repeating tile pattern across a floor zone. `pickTile` receives
 * column/row indices in 8px sub-tile space (0,0 = top-left of the zone).
 */
export function paintPatternedFloor(
  scene: Phaser.Scene,
  x: number,
  width: number,
  floorTopY: number,
  pickTile: (col: number, row: number) => string,
): Phaser.GameObjects.Image[] {
  const tiles: Phaser.GameObjects.Image[] = [];
  const y0 = firstFloorRow(floorTopY);
  let row = 0;

  for (let ty = y0; ty < WORLD_HEIGHT; ty += FLOOR_SUBTILE, row++) {
    let col = 0;
    for (let tx = x; tx < x + width; tx += FLOOR_SUBTILE, col++) {
      const tile = scene.add
        .image(tx + FLOOR_SUBTILE / 2, ty + FLOOR_SUBTILE / 2, pickTile(col, row))
        .setOrigin(0.5, 0.5)
        .setDepth(DEPTH_FLOOR);
      tiles.push(tile);
    }
  }

  return tiles;
}

/** Subtle front lip at the top of a room floor — reads as a ledge into the room. */
export function paintFloorLip(
  scene: Phaser.Scene,
  x: number,
  width: number,
  floorTopY: number,
  color: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(DEPTH_FLOOR + 1);
  const y = firstFloorRow(floorTopY);
  g.fillStyle(color, 0.85);
  g.fillRect(x, y - 2, width, 2);
  g.fillStyle(0x000000, 0.12);
  g.fillRect(x, y, width, 1);
  return g;
}
