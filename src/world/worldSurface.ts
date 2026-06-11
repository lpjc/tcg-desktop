import { ROAD_FLOOR_TOP, SHOP_FLOOR_TOP } from '../core/constants';
import { getConventionRooms } from './ConventionVenue';
import { firstFloorRow } from './floorPaint';
import { getWorldLayout } from './WorldLayout';

/**
 * Hit-test a world point against the drawn world surface: convention room
 * floors, the road, and the shop floor (each including its 2px front lip).
 *
 * Used to decide when the click-through overlay window should accept mouse
 * input — anywhere art is painted must block clicks to the desktop; only the
 * transparent headroom above floors stays click-through. Furniture sticking up
 * above a floor top is covered separately by the station hit test.
 */
/**
 * Whether a foot position is on painted floor or road art — used to keep the
 * player on walkable surfaces instead of cutting through transparent headroom.
 */
export function isPlayerWalkSurface(worldX: number, worldY: number): boolean {
  return isOverWorldSurface(worldX, worldY);
}

export function isOverWorldSurface(worldX: number, worldY: number): boolean {
  for (const room of getConventionRooms()) {
    if (inZone(worldX, worldY, room.x, room.width, room.floorTop)) return true;
  }

  const { roadZone, shopFrame } = getWorldLayout();
  return (
    inZone(worldX, worldY, roadZone.x, roadZone.width, ROAD_FLOOR_TOP) ||
    inZone(worldX, worldY, shopFrame.x, shopFrame.width, SHOP_FLOOR_TOP)
  );
}

function inZone(x: number, y: number, zoneX: number, zoneWidth: number, floorTop: number): boolean {
  // Floors paint from the first 8px row at/below floorTop; the lip sits 2px above it.
  const top = firstFloorRow(floorTop) - 2;
  return x >= zoneX && x < zoneX + zoneWidth && y >= top;
}
