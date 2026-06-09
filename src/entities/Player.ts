import Phaser from 'phaser';
import { DIRECTION_FRAME_START, characterTextureKey } from '../characters/characterSheets';
import { playFacing } from '../characters/registerCharacterAnims';
import { depthFromFootY } from '../core/depth';
import { planWalkMotion } from '../core/walkMotion';

/**
 * The player is a non-controllable avatar: it represents the result of the
 * player's choices (stock / buy / sell / display / trade). It only ever walks
 * from one station to another when commanded via `walkTo`, never by direct
 * keyboard input.
 */
export class Player extends Phaser.GameObjects.Sprite {
  private walkTween?: Phaser.Tweens.Tween;
  private facingLeft = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, characterTextureKey('adam', 'idle'), DIRECTION_FRAME_START.right);
    this.setOrigin(0.5, 1);
    scene.add.existing(this);
    playFacing(this, 'adam', 'idle', this.facingLeft);
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

  /** Walk to a target foot position; fixed accel/decel, distance-based cruise. */
  walkTo(targetX: number, targetY: number, onArrive?: () => void): void {
    this.walkTween?.stop();

    const startX = this.x;
    const startY = this.y;
    const distance = Phaser.Math.Distance.Between(startX, startY, targetX, targetY);
    if (distance < 1) {
      this.setPosition(targetX, targetY);
      this.applyDepth();
      onArrive?.();
      return;
    }

    this.facingLeft = targetX < startX;
    playFacing(this, 'adam', 'walk', this.facingLeft);

    const plan = planWalkMotion(distance);
    const proxy = { t: 0 };

    this.walkTween = this.scene.tweens.add({
      targets: proxy,
      t: 1,
      duration: plan.durationMs,
      ease: 'Linear',
      onUpdate: () => {
        const p = plan.progressAt(proxy.t);
        this.setPosition(
          Phaser.Math.Linear(startX, targetX, p),
          Phaser.Math.Linear(startY, targetY, p),
        );
        this.applyDepth();
      },
      onComplete: () => {
        this.setPosition(targetX, targetY);
        playFacing(this, 'adam', 'idle', this.facingLeft);
        this.applyDepth();
        onArrive?.();
      },
    });
  }
}
