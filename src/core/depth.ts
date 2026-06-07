import { DEPTH_OBJECT_BASE } from './constants';

/** Y-sort depth from foot (bottom-center) world Y. */
export function depthFromFootY(footY: number): number {
  return DEPTH_OBJECT_BASE + footY;
}

export function snapToGrid(value: number, grid = 16): number {
  return Math.round(value / grid) * grid;
}
