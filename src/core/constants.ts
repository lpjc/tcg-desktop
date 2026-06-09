/** World cell size in source pixels — never scale individual sprites. */
export const TILE = 16;

/** Floor sub-tile size (Sierra floor pack is 8×8). */
export const FLOOR_SUBTILE = 8;

/** Editor furniture snap grid (8px — half the 16px world TILE). */
export const PLACE_GRID = FLOOR_SUBTILE;

/**
 * Fixed overlay magnification (small companion size only).
 * Window/canvas pixel height = (BAND_HEIGHT + TOP_MARGIN) × ZOOM.
 */
export const ZOOM = 2;

/**
 * Logical height of the bottom world band (source pixels).
 * Must match the art band.
 */
export const BAND_HEIGHT = 96;

/**
 * Extra transparent headroom (world px) above the band — gives tall sprites
 * and high-hung wall decor room to render, and click-through desktop space.
 * Visible world Y range is -TOP_MARGIN .. WORLD_HEIGHT.
 * Must match TOP_MARGIN in electron/main.ts.
 */
export const TOP_MARGIN = 10;

/** Highest foot Y when placing wall decor / floating props in the editor. */
export const PLACE_Y_MIN = 4 - TOP_MARGIN;

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
 * - Window height is set by electron/main.ts ((BAND_HEIGHT + TOP_MARGIN) × ZOOM);
 *   the canvas simply fills the window and `CameraDirector` glues the band to
 *   the window bottom.
 * - World width is dynamic: convention + responsive road + shop — see `WorldLayout.ts`.
 * - Camera shows the entire band at once; position with `centerOn(worldWidth/2, …)`.
 */
