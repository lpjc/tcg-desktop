import Phaser from 'phaser';
import { FLOOR_SUBTILE, SHOP_FLOOR_TOP, SHOP_WIDTH, WORLD_HEIGHT } from '../core/constants';
import { getConventionRooms } from '../world/ConventionVenue';
import { SHOP_BACK_COUNTER } from '../world/floorPatterns';

/** Axis-aligned foot-position box an NPC may occupy. */
export interface WanderRect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Horizontal inset from room/shop walls so sprites do not clip edges. */
const EDGE_INSET = 12;
/** Foot Y stays this far above the floor lip and below the band bottom. */
const FOOT_INSET_TOP = 4;
const FOOT_INSET_BOTTOM = 8;

/** World-space rectangle of the shop's behind-the-counter strip (staff only). */
export function shopBackCounterRect(shopFrameX: number): WanderRect {
  return {
    minX: shopFrameX + SHOP_BACK_COUNTER.colStart * FLOOR_SUBTILE,
    maxX: shopFrameX + SHOP_BACK_COUNTER.colEnd * FLOOR_SUBTILE,
    minY: SHOP_FLOOR_TOP,
    maxY: SHOP_FLOOR_TOP + SHOP_BACK_COUNTER.rowEnd * FLOOR_SUBTILE,
  };
}

/**
 * One wander rectangle per convention room, sized to each room's width and
 * floor height (main hall, hall, lobby can all differ per venue preset).
 */
export function conventionWanderRegions(): WanderRect[] {
  return getConventionRooms().map((room) => ({
    minX: room.x + EDGE_INSET,
    maxX: room.x + room.width - EDGE_INSET,
    minY: room.floorTop + FOOT_INSET_TOP,
    maxY: WORLD_HEIGHT - FOOT_INSET_BOTTOM,
  }));
}

/**
 * Shop visitor areas: full shop floor minus the centre-top counter strip.
 * Decomposed into up to three rectangles (left / right of counter, plus the
 * band below it) so random targets never land behind the counter.
 */
export function shopWanderRegions(shopFrameX: number): WanderRect[] {
  const shopMinX = shopFrameX + EDGE_INSET;
  const shopMaxX = shopFrameX + SHOP_WIDTH - EDGE_INSET;
  const shopMinY = SHOP_FLOOR_TOP + FOOT_INSET_TOP;
  const shopMaxY = WORLD_HEIGHT - FOOT_INSET_BOTTOM;
  const counter = shopBackCounterRect(shopFrameX);
  const regions: WanderRect[] = [];

  if (counter.maxY < shopMaxY) {
    regions.push({
      minX: shopMinX,
      maxX: shopMaxX,
      minY: counter.maxY,
      maxY: shopMaxY,
    });
  }

  if (shopMinX < counter.minX) {
    regions.push({
      minX: shopMinX,
      maxX: counter.minX,
      minY: shopMinY,
      maxY: counter.maxY,
    });
  }

  if (counter.maxX < shopMaxX) {
    regions.push({
      minX: counter.maxX,
      maxX: shopMaxX,
      minY: shopMinY,
      maxY: counter.maxY,
    });
  }

  return regions;
}

export function pickRandomRegion(regions: WanderRect[]): WanderRect {
  return Phaser.Utils.Array.GetRandom(regions);
}

export function randomPointInRect(rect: WanderRect): { x: number; y: number } {
  return {
    x: Phaser.Math.Between(rect.minX, rect.maxX),
    y: Phaser.Math.Between(rect.minY, rect.maxY),
  };
}

export function clampToRect(x: number, y: number, rect: WanderRect): { x: number; y: number } {
  return {
    x: Phaser.Math.Clamp(x, rect.minX, rect.maxX),
    y: Phaser.Math.Clamp(y, rect.minY, rect.maxY),
  };
}

export function findRegionContaining(
  x: number,
  y: number,
  regions: WanderRect[],
): WanderRect | null {
  return (
    regions.find(
      (rect) => x >= rect.minX && x <= rect.maxX && y >= rect.minY && y <= rect.maxY,
    ) ?? null
  );
}

/** Closest region by centre distance — used after a layout change evicts an NPC. */
export function nearestRegion(x: number, y: number, regions: WanderRect[]): WanderRect {
  if (regions.length === 1) return regions[0];

  let best = regions[0];
  let bestDist = Infinity;
  for (const rect of regions) {
    const cx = (rect.minX + rect.maxX) / 2;
    const cy = (rect.minY + rect.maxY) / 2;
    const dist = (x - cx) ** 2 + (y - cy) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = rect;
    }
  }
  return best;
}
