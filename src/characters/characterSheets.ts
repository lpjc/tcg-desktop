/**
 * Character roster + sprite-sheet layout for the LimeZu "Modern Interiors"
 * free character pack (`assets/Characters_free/`).
 *
 * Every animation strip in the pack is laid out as 4 directions × 6 frames at
 * a 16×32 frame size. The direction order (verified against the idle sheet) is:
 *
 *   down (0–5) · up (6–11) · left (12–17) · right (18–23)
 *
 * The world only ever moves characters horizontally along the floor band, so we
 * only build LEFT and RIGHT animations; the down/up frames are intentionally
 * unused.
 */

/** Width of a single character frame in source pixels. */
export const CHAR_FRAME_WIDTH = 16;
/** Height of a single character frame in source pixels (head sticks above the cell). */
export const CHAR_FRAME_HEIGHT = 32;
/** Frames per direction in every animation strip. */
export const FRAMES_PER_DIRECTION = 6;

/** First frame index of each facing within a 24-frame strip. */
export const DIRECTION_FRAME_START = {
  down: 0,
  up: 6,
  left: 12,
  right: 18,
} as const;

/** The playable avatar. Never despawns or fades. */
export const PROTAGONIST: CharacterKey = 'adam';

/** Background characters that populate the convention and shop. */
export const NPC_CHARACTERS = ['alex', 'amelia', 'bob'] as const;

/** Every character we load sheets for. */
export const ALL_CHARACTERS = ['adam', 'alex', 'amelia', 'bob'] as const;

export type CharacterKey = (typeof ALL_CHARACTERS)[number];

/** PNG file name uses a capitalised character name (e.g. `Adam_run_16x16.png`). */
function capitalize(name: CharacterKey): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Public URL of an animation sheet, served from Vite `publicDir` (`assets/`). */
export function characterSheetUrl(name: CharacterKey, sheet: 'idle' | 'walk'): string {
  const file = sheet === 'idle' ? 'idle_anim' : 'run';
  return encodeURI(`/Characters_free/${capitalize(name)}_${file}_16x16.png`);
}

/** Phaser texture key for a character's loaded sheet. */
export function characterTextureKey(name: CharacterKey, sheet: 'idle' | 'walk'): string {
  return `char_${name}_${sheet}`;
}
