/** World cell size in source pixels — never scale individual sprites. */
export const TILE = 16;

/** Floor sub-tile size (Sierra floor pack is 8×8). */
export const FLOOR_SUBTILE = 8;

/**
 * Fixed overlay magnification (small companion size only).
 * Window/canvas pixel height = BAND_HEIGHT × ZOOM (~192px on any display).
 */
export const ZOOM = 2;

/**
 * Logical height of the bottom world band (source pixels).
 * Must match the art band; window pixel height is BAND_HEIGHT × ZOOM.
 */
export const BAND_HEIGHT = 96;

/** Fixed world-pixel width of the shop zone (right). Road flexes between them. */
export const SHOP_WIDTH = 200;

export const WORLD_HEIGHT = BAND_HEIGHT;

/**
 * Per-zone floor tops (world Y). Everything above is transparent so the desktop
 * shows through — this is what sells the "companion on your desk" look.
 *
 * Convention: tall floor on the left; shop: medium floor on the right; road: a
 * shallow strip at the bottom of the centre column only.
 */
/** Matches tallest convention room — see `ConventionVenue.ts`. */
export const SHOP_FLOOR_TOP = 18;
export const ROAD_FLOOR_TOP = 72;

export const ROAD_HEIGHT = WORLD_HEIGHT - ROAD_FLOOR_TOP;

/** Default foot Y for characters walking on the bottom edge of room floors. */
export const FLOOR_WALK_Y = WORLD_HEIGHT - 12;

export const PLAYER_SPEED = 48;

export const DEPTH_FLOOR = 0;
export const DEPTH_OBJECT_BASE = 10;
export const DEPTH_UI = 10000;

/**
 * Magnification and horizontal layout:
 * - Zoom is fixed at ZOOM (see above).
 * - World width is dynamic: convention + responsive road + shop — see `WorldLayout.ts`.
 * - Camera shows the entire band at once; position with `centerOn(worldWidth/2, …)`.
 */
export function windowBandHeight(): number {
  return BAND_HEIGHT * ZOOM;
}
