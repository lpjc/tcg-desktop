import {
  CONVENTION_WIDTH,
  FLOOR_SUBTILE,
  ROAD_FLOOR_TOP,
  ROAD_HEIGHT,
  SHOP_WIDTH,
  WORLD_HEIGHT,
  ZOOM,
} from '../core/constants';

export type SceneFrameId = 'convention' | 'shop';

export interface SceneFrame {
  id: SceneFrameId;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoadZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Minimum road width (a few floor sub-tiles) on very narrow screens. */
export const MIN_ROAD_WIDTH = FLOOR_SUBTILE * 4;

export interface WorldLayoutSnapshot {
  roadWidth: number;
  worldWidth: number;
  conventionFrame: SceneFrame;
  roadZone: RoadZone;
  shopFrame: SceneFrame;
}

/**
 * Lay out the single-screen world: convention (fixed) | road (flex) | shop (fixed).
 *
 * The overlay is always 100% of the monitor work-area width at the fixed small
 * zoom. Convention and shop keep constant world-pixel widths; only the road
 * grows or shrinks so the three zones exactly fill the visible band:
 *
 *   roadWidth = viewportWorldWidth − CONVENTION_WIDTH − SHOP_WIDTH
 *
 * Road width is snapped down to the 8px floor grid so tiles paint cleanly.
 */
export function computeWorldLayout(
  viewportPxWidth: number,
  zoom: number = ZOOM,
): WorldLayoutSnapshot {
  const viewWorldW = viewportPxWidth / zoom;
  let roadWidth = viewWorldW - CONVENTION_WIDTH - SHOP_WIDTH;
  roadWidth = Math.max(MIN_ROAD_WIDTH, roadWidth);
  roadWidth = Math.floor(roadWidth / FLOOR_SUBTILE) * FLOOR_SUBTILE;

  const shopX = CONVENTION_WIDTH + roadWidth;
  const worldWidth = shopX + SHOP_WIDTH;

  return {
    roadWidth,
    worldWidth,
    conventionFrame: {
      id: 'convention',
      x: 0,
      y: 0,
      width: CONVENTION_WIDTH,
      height: WORLD_HEIGHT,
    },
    roadZone: {
      x: CONVENTION_WIDTH,
      y: ROAD_FLOOR_TOP,
      width: roadWidth,
      height: ROAD_HEIGHT,
    },
    shopFrame: {
      id: 'shop',
      x: shopX,
      y: 0,
      width: SHOP_WIDTH,
      height: WORLD_HEIGHT,
    },
  };
}

let current: WorldLayoutSnapshot = computeWorldLayout(1920);

export function getWorldLayout(): WorldLayoutSnapshot {
  return current;
}

export function setWorldLayout(layout: WorldLayoutSnapshot): void {
  current = layout;
}

export function getSceneFrames(): Record<SceneFrameId, SceneFrame> {
  return {
    convention: current.conventionFrame,
    shop: current.shopFrame,
  };
}

export function frameForX(x: number): SceneFrameId {
  const { roadZone } = current;
  if (x < roadZone.x + roadZone.width * 0.5) return 'convention';
  return 'shop';
}

export function isInRoadZone(x: number): boolean {
  const { roadZone } = current;
  return x >= roadZone.x && x < roadZone.x + roadZone.width;
}
