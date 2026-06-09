import Phaser from 'phaser';
import {
  ALL_CHARACTERS,
  CHAR_FRAME_HEIGHT,
  CHAR_FRAME_WIDTH,
  DIRECTION_FRAME_START,
  FRAMES_PER_DIRECTION,
  characterSheetUrl,
  characterTextureKey,
  type CharacterKey,
} from './characterSheets';

export type CharacterAction = 'idle' | 'walk';
type Facing = 'left' | 'right';

const WALK_FRAME_RATE = 10;
const IDLE_FRAME_RATE = 6;

/** Queue every character's idle + walk sheets for loading. Call from `preload`. */
export function preloadCharacters(scene: Phaser.Scene): void {
  const frame = { frameWidth: CHAR_FRAME_WIDTH, frameHeight: CHAR_FRAME_HEIGHT };
  for (const name of ALL_CHARACTERS) {
    scene.load.spritesheet(characterTextureKey(name, 'idle'), characterSheetUrl(name, 'idle'), frame);
    scene.load.spritesheet(characterTextureKey(name, 'walk'), characterSheetUrl(name, 'walk'), frame);
  }
}

/** Animation key for a character/action/facing combination. */
export function characterAnimKey(
  name: CharacterKey,
  action: CharacterAction,
  facing: Facing,
): string {
  return `${name}-${action}-${facing}`;
}

function createDirectionalAnim(
  scene: Phaser.Scene,
  name: CharacterKey,
  action: CharacterAction,
  facing: Facing,
): void {
  const key = characterAnimKey(name, action, facing);
  if (scene.anims.exists(key)) return;

  const textureKey = characterTextureKey(name, action === 'walk' ? 'walk' : 'idle');
  const start = DIRECTION_FRAME_START[facing];
  scene.anims.create({
    key,
    frames: scene.anims.generateFrameNumbers(textureKey, {
      start,
      end: start + FRAMES_PER_DIRECTION - 1,
    }),
    frameRate: action === 'walk' ? WALK_FRAME_RATE : IDLE_FRAME_RATE,
    repeat: -1,
  });
}

/**
 * Build left/right idle + walk animations for every character. Idempotent, so
 * it is safe to call once per scene `create`.
 */
export function registerAllCharacterAnims(scene: Phaser.Scene): void {
  for (const name of ALL_CHARACTERS) {
    for (const action of ['idle', 'walk'] as const) {
      createDirectionalAnim(scene, name, action, 'left');
      createDirectionalAnim(scene, name, action, 'right');
    }
  }
}

/**
 * Play the correct animation for a sprite, restarting only when the target
 * animation changes so we never stutter a looping clip.
 */
export function playFacing(
  sprite: Phaser.GameObjects.Sprite,
  name: CharacterKey,
  action: CharacterAction,
  facingLeft: boolean,
): void {
  const key = characterAnimKey(name, action, facingLeft ? 'left' : 'right');
  if (sprite.anims.currentAnim?.key === key && sprite.anims.isPlaying) return;
  sprite.play(key);
}
