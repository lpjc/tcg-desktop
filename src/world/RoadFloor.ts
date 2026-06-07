import Phaser from 'phaser';
import { DEPTH_FLOOR, FLOOR_SUBTILE } from '../core/constants';
import type { RoadZone } from './WorldLayout';

/**
 * Shallow road strip at the bottom of the centre column. The large transparent
 * gap above (see ROAD_FLOOR_TOP in constants) is what lets the desktop show
 * through between the taller room floors on either side.
 */
export function buildRoadFloor(scene: Phaser.Scene, zone: RoadZone): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(DEPTH_FLOOR + 0.5);

  const x0 = zone.x;
  const x1 = zone.x + zone.width;
  const y0 = zone.y;
  const y1 = zone.y + zone.height;
  const kerb = 4;

  // Asphalt
  g.fillStyle(0x5a5a64, 1);
  g.fillRect(x0, y0 + kerb, zone.width, y1 - y0 - kerb * 2);

  // Kerbs (top + bottom of the shallow strip)
  g.fillStyle(0x8a7a5a, 1);
  g.fillRect(x0, y0, zone.width, kerb);
  g.fillRect(x0, y1 - kerb, zone.width, kerb);

  // Centre dashed line
  g.fillStyle(0xe8d060, 1);
  const midY = (y0 + y1) / 2 - 1;
  for (let tx = x0 + 8; tx < x1; tx += FLOOR_SUBTILE * 2) {
    g.fillRect(tx, midY, FLOOR_SUBTILE, 2);
  }

  return g;
}
