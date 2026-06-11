import Phaser from 'phaser';
import type { Placeable, StationAnchor } from '../entities/Placeable';
import { FLOOR_SUBTILE, FLOOR_WALK_Y, TILE, WORLD_HEIGHT } from '../core/constants';
import { getWorldLayout } from './WorldLayout';

export interface WorldRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Walkers may pass this close (px) to a collision box, no closer. */
const FOOT_PAD = 3;
const PATH_CELL = FLOOR_SUBTILE;
const MAX_BFS_NODES = 6000;

/**
 * Optional walkable-area constraint for pathfinding. Returns true when a foot
 * position is allowed (e.g. NPC wander regions); the player passes none and
 * may walk anywhere that is not blocked by furniture.
 */
export type AllowedFn = (x: number, y: number) => boolean;

/** World-space collision box from catalog data (sprite foot = placeable x/y). */
export function placeableCollisionWorld(p: Placeable): WorldRect {
  const item = p.catalogItem;
  const col = p.getCollisionBox();
  return {
    x: p.x - item.footX + col.x,
    y: p.y - item.footY + col.y,
    w: col.w,
    h: col.h,
  };
}

/**
 * Whether a placed item blocks walkers.
 *
 * An explicit editor override ("mark collidable", C key) always wins. Without
 * one, floor furniture blocks while wall decor placed high does not (its
 * collision box sits above the foot-traffic band).
 */
export function placeableBlocksWalking(p: Placeable): boolean {
  if (p.collidableOverride !== null) return p.collidableOverride;
  const rect = placeableCollisionWorld(p);
  const footBandTop = FLOOR_WALK_Y - 14;
  return rect.y + rect.h >= footBandTop && rect.y <= WORLD_HEIGHT - 2;
}

function footBlockedAt(x: number, y: number, rects: WorldRect[]): boolean {
  for (const rect of rects) {
    if (
      x >= rect.x - FOOT_PAD &&
      x <= rect.x + rect.w + FOOT_PAD &&
      y >= rect.y - FOOT_PAD &&
      y <= rect.y + rect.h + FOOT_PAD
    ) {
      return true;
    }
  }
  return false;
}

function toCell(value: number): number {
  return Math.round(value / PATH_CELL);
}

function cellCenter(cell: number): number {
  return cell * PATH_CELL;
}

function cellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/** Highest grid row whose cell center is still a valid foot Y. */
function maxPathCellY(): number {
  return Math.floor((WORLD_HEIGHT - 4) / PATH_CELL);
}

/** Unit step pointing away from the collision box for each anchor side. */
const ANCHOR_OUTWARD: Record<StationAnchor, [number, number]> = {
  below: [0, 1],
  above: [0, -1],
  left: [-1, 0],
  right: [1, 0],
};

/**
 * Foot position just outside a collision rect on the requested side
 * (FOOT_PAD keeps feet off the box, +1 clears the inclusive pad check).
 */
export function stationAnchorPoint(
  rect: WorldRect,
  anchor: StationAnchor,
): { x: number; y: number } {
  const gap = FOOT_PAD + 1;
  switch (anchor) {
    case 'left':
      return { x: rect.x - gap, y: rect.y + rect.h / 2 };
    case 'right':
      return { x: rect.x + rect.w + gap, y: rect.y + rect.h / 2 };
    case 'above':
      return { x: rect.x + rect.w / 2, y: rect.y - gap };
    case 'below':
      return { x: rect.x + rect.w / 2, y: rect.y + rect.h + gap };
  }
}

function isInPathGrid(cx: number, cy: number, worldW: number): boolean {
  return cx >= 0 && cy >= 0 && cx * PATH_CELL < worldW && cy <= maxPathCellY();
}

export class ObstacleField {
  private rects: WorldRect[] = [];

  rebuild(placeables: Placeable[]): void {
    this.rects = placeables.filter(placeableBlocksWalking).map(placeableCollisionWorld);
  }

  isFootBlocked(x: number, y: number): boolean {
    return footBlockedAt(x, y, this.rects);
  }

  /** Free of furniture AND inside the allowed walkable area (when given). */
  isWalkable(x: number, y: number, allowed?: AllowedFn): boolean {
    if (allowed && !allowed(x, y)) return false;
    return !footBlockedAt(x, y, this.rects);
  }

  /**
   * Walkable stand point at a station's anchored side. Starts at the anchor
   * point and steps outward (away from the box) when blocked by neighbouring
   * furniture; falls back to the nearest free grid cell.
   */
  standPointForStation(
    rect: WorldRect,
    anchor: StationAnchor,
    allowed?: AllowedFn,
  ): { x: number; y: number } | null {
    const base = stationAnchorPoint(rect, anchor);
    const [ox, oy] = ANCHOR_OUTWARD[anchor];
    for (let step = 0; step <= PATH_CELL * 3; step += PATH_CELL / 2) {
      const x = base.x + ox * step;
      const y = Phaser.Math.Clamp(base.y + oy * step, 16, WORLD_HEIGHT - 4);
      if (this.isWalkable(x, y, allowed)) return { x, y };
    }
    const cell = this.nearestFreeCell(base.x, base.y, allowed);
    if (!cell) return null;
    return { x: cellCenter(cell.cx), y: cellCenter(cell.cy) };
  }

  /**
   * Nearest unobstructed foot position for a walker to stand at a station.
   * Prefers the walk lane at `worldX`, then expands horizontally.
   */
  findStandPointNear(
    worldX: number,
    preferredY: number = FLOOR_WALK_Y,
    allowed?: AllowedFn,
  ): { x: number; y: number } | null {
    const y = Phaser.Math.Clamp(preferredY, 16, WORLD_HEIGHT - 4);
    const maxDx = TILE * 8;
    for (let dx = 0; dx <= maxDx; dx += PATH_CELL) {
      const offsets = dx === 0 ? [0] : [-dx, dx];
      for (const off of offsets) {
        const x = worldX + off;
        if (this.isWalkable(x, y, allowed)) return { x, y };
      }
    }
    const cell = this.nearestFreeCell(worldX, y, allowed);
    if (!cell) return null;
    return { x: cellCenter(cell.cx), y: cellCenter(cell.cy) };
  }

  segmentClear(x1: number, y1: number, x2: number, y2: number, allowed?: AllowedFn): boolean {
    const steps = Math.max(1, Math.ceil(Phaser.Math.Distance.Between(x1, y1, x2, y2) / PATH_CELL));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Phaser.Math.Linear(x1, x2, t);
      const y = Phaser.Math.Linear(y1, y2, t);
      if (!this.isWalkable(x, y, allowed)) return false;
    }
    return true;
  }

  /**
   * Grid path from foot (x1,y1) to (x2,y2). Returns sequential waypoints
   * excluding the start. Empty when unreachable. `allowed` constrains the
   * route (e.g. to NPC wander regions) — the goal itself must satisfy it.
   */
  findPath(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    allowed?: AllowedFn,
  ): Array<{ x: number; y: number }> {
    if (allowed && !allowed(x2, y2)) return [];
    if (this.segmentClear(x1, y1, x2, y2, allowed)) {
      return [{ x: x2, y: y2 }];
    }

    const start = this.nearestFreeCell(x1, y1, allowed);
    const goal = this.nearestFreeCell(x2, y2, allowed);
    if (!start || !goal) return [];

    const worldW = getWorldLayout().worldWidth;
    const queue: Array<{ cx: number; cy: number }> = [{ cx: start.cx, cy: start.cy }];
    const cameFrom = new Map<string, string | null>();
    cameFrom.set(cellKey(start.cx, start.cy), null);

    const goalKey = cellKey(goal.cx, goal.cy);
    let visited = 0;

    while (queue.length > 0 && visited < MAX_BFS_NODES) {
      visited += 1;
      const current = queue.shift()!;
      const key = cellKey(current.cx, current.cy);
      if (key === goalKey) {
        const raw = this.reconstructPath(cameFrom, goal.cx, goal.cy, x2, y2, allowed);
        return this.smoothPath(x1, y1, raw, allowed);
      }

      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const ncx = current.cx + dx;
        const ncy = current.cy + dy;
        if (!isInPathGrid(ncx, ncy, worldW)) {
          continue;
        }
        const nKey = cellKey(ncx, ncy);
        if (cameFrom.has(nKey)) continue;
        if (!this.isWalkable(cellCenter(ncx), cellCenter(ncy), allowed)) continue;
        cameFrom.set(nKey, key);
        queue.push({ cx: ncx, cy: ncy });
      }
    }

    return [];
  }

  /**
   * String-pulling: replace BFS cell staircases with the longest clear
   * straight legs so walkers move in natural diagonals instead of zigzags.
   */
  private smoothPath(
    startX: number,
    startY: number,
    waypoints: Array<{ x: number; y: number }>,
    allowed?: AllowedFn,
  ): Array<{ x: number; y: number }> {
    if (waypoints.length <= 1) return waypoints;
    const out: Array<{ x: number; y: number }> = [];
    let fromX = startX;
    let fromY = startY;
    let i = 0;
    while (i < waypoints.length) {
      let j = waypoints.length - 1;
      while (j > i && !this.segmentClear(fromX, fromY, waypoints[j].x, waypoints[j].y, allowed)) {
        j -= 1;
      }
      out.push(waypoints[j]);
      fromX = waypoints[j].x;
      fromY = waypoints[j].y;
      i = j + 1;
    }
    return out;
  }

  private nearestFreeCell(
    x: number,
    y: number,
    allowed?: AllowedFn,
  ): { cx: number; cy: number } | null {
    const worldW = getWorldLayout().worldWidth;
    const originCx = toCell(x);
    const originCy = toCell(y);
    for (let radius = 0; radius <= 8; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const cx = originCx + dx;
          const cy = originCy + dy;
          if (!isInPathGrid(cx, cy, worldW)) continue;
          if (this.isWalkable(cellCenter(cx), cellCenter(cy), allowed)) {
            return { cx, cy };
          }
        }
      }
    }
    return null;
  }

  private reconstructPath(
    cameFrom: Map<string, string | null>,
    goalCx: number,
    goalCy: number,
    exactEndX: number,
    exactEndY: number,
    allowed?: AllowedFn,
  ): Array<{ x: number; y: number }> {
    const cells: Array<{ cx: number; cy: number }> = [];
    let key: string | null = cellKey(goalCx, goalCy);
    while (key) {
      const [cx, cy] = key.split(',').map(Number);
      cells.push({ cx, cy });
      key = cameFrom.get(key) ?? null;
    }
    cells.reverse();
    const waypoints = cells.slice(1).map((cell) => ({
      x: cellCenter(cell.cx),
      y: cellCenter(cell.cy),
    }));
    // Finish at the exact target only when it is itself standable; otherwise
    // stop at the nearest free cell (prevents walkers ending inside furniture).
    const last = waypoints[waypoints.length - 1];
    const endStandable = this.isWalkable(exactEndX, exactEndY, allowed);
    if (endStandable && (!last || last.x !== exactEndX || last.y !== exactEndY)) {
      waypoints.push({ x: exactEndX, y: exactEndY });
    }
    return waypoints;
  }
}

let activeField = new ObstacleField();

export function getObstacleField(): ObstacleField {
  return activeField;
}

export function rebuildObstacleField(placeables: Placeable[]): void {
  activeField.rebuild(placeables);
}
