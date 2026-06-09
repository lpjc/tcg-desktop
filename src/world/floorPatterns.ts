import { SHOP_WIDTH, FLOOR_SUBTILE } from '../core/constants';
import {
  getConventionRooms,
  type ConventionFloorTheme,
  type ConventionRoomDef,
} from './ConventionVenue';

/**
 * One uniform fill per room with border tiles on shared vertical dividers.
 */
export function conventionRoomPicker(
  room: ConventionRoomDef,
  roomIndex: number,
  floor: ConventionFloorTheme,
): (col: number, row: number) => string {
  const rooms = getConventionRooms();
  const cols = Math.floor(room.width / FLOOR_SUBTILE);
  const isFirst = roomIndex === 0;
  const isLast = roomIndex === rooms.length - 1;

  return (col, _row) => {
    const onDivider = (!isFirst && col === 0) || (!isLast && col === cols - 1);
    return onDivider ? floor.border : floor.fill;
  };
}

/** Light grey-blue shop weave — slices 116–119 and 49 (37 is reserved for counter back). */
const SHOP_FLOOR_TILES = [
  'floors_slice_116',
  'floors_slice_117',
  'floors_slice_118',
  'floors_slice_119',
  'floors_slice_49',
] as const;

const SHOP_PATTERN = [
  [0, 1, 2, 3, 4],
  [3, 4, 0, 1, 2],
  [1, 2, 3, 4, 0],
  [4, 0, 1, 2, 3],
  [2, 3, 4, 0, 1],
];

const SHOP_COLS = Math.floor(SHOP_WIDTH / FLOOR_SUBTILE);

/**
 * Centre-top strip behind the counter — solid slice 37.
 * Column/row indices are relative to the shop frame origin (8px grid).
 */
export const SHOP_BACK_COUNTER = {
  colStart: Math.floor((SHOP_COLS - 9) / 2),
  colEnd: Math.floor((SHOP_COLS - 9) / 2) + 9,
  rowEnd: 5,
};

export function pickShopFloorTile(col: number, row: number): string {
  if (
    row < SHOP_BACK_COUNTER.rowEnd &&
    col >= SHOP_BACK_COUNTER.colStart &&
    col < SHOP_BACK_COUNTER.colEnd
  ) {
    return 'floors_slice_37';
  }
  return SHOP_FLOOR_TILES[SHOP_PATTERN[row % 5][col % 5]];
}
