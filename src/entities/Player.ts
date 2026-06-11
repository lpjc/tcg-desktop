import Phaser from 'phaser';
import {
  DIRECTION_FRAME_START,
  characterTextureKey,
  type Facing,
} from '../characters/characterSheets';
import { playFacing } from '../characters/registerCharacterAnims';
import { depthFromFootY } from '../core/depth';
import { followPath } from '../core/pathWalk';
import { getObstacleField } from '../world/obstacleField';
import { isPlayerWalkSurface } from '../world/worldSurface';

/**
 * The player is a non-controllable avatar: it represents the result of the
 * player's choices (stock / buy / sell / display / trade). It only ever walks
 * from one station to another when commanded via `walkTo`, never by direct
 * keyboard input.
 */
export class Player extends Phaser.GameObjects.Sprite {
  private walkTween?: Phaser.Tweens.Tween;
  private facing: Facing = 'down';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, characterTextureKey('adam', 'idle'), DIRECTION_FRAME_START.down);
    this.setOrigin(0.5, 1);
    scene.add.existing(this);
    playFacing(this, 'adam', 'idle', this.facing);
    this.applyDepth();
  }

  getFootY(): number {
    return this.y;
  }

  isWalking(): boolean {
    return this.walkTween?.isPlaying() ?? false;
  }

  applyDepth(): void {
    this.setDepth(depthFromFootY(this.getFootY()) + 0.5);
  }

  /** Turn to a direction while standing still (e.g. to face a station). */
  faceDirection(facing: Facing): void {
    if (this.isWalking()) return;
    this.facing = facing;
    playFacing(this, 'adam', 'idle', this.facing);
  }

  /** Walk to a target foot position, routing around furniture obstacles. */
  walkTo(targetX: number, targetY: number, onArrive?: () => void): void {
    this.walkTween?.stop();

    const path = getObstacleField().findPath(
      this.x,
      this.y,
      targetX,
      targetY,
      isPlayerWalkSurface,
    );
    if (path.length === 0) {
      return;
    }

    this.walkTween = followPath(this.scene, this.asPathWalker(), path, {
      speed: 48,
      useAccel: true,
      onComplete: onArrive,
    });
  }

  private asPathWalker() {
    const player = this;
    return {
      // Live getters: followPath reads the walker position at each leg start.
      get x() {
        return player.x;
      },
      get y() {
        return player.y;
      },
      setPosition: (x: number, y: number) => this.setPosition(x, y),
      applyDepth: () => this.applyDepth(),
      setFacing: (facing: Facing) => {
        this.facing = facing;
      },
      playWalk: () => playFacing(this, 'adam', 'walk', this.facing),
      playIdle: () => playFacing(this, 'adam', 'idle', this.facing),
    };
  }
}
