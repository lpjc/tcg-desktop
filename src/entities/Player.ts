import Phaser from 'phaser';
import { PLAYER_SPEED } from '../core/constants';
import { depthFromFootY } from '../core/depth';

/**
 * The player is a non-controllable avatar: it represents the result of the
 * player's choices (stock / buy / sell / display / trade). It only ever walks
 * from one station to another when commanded via `walkTo`, never by direct
 * keyboard input.
 */
export class Player extends Phaser.GameObjects.Sprite {
  private walkTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    this.setOrigin(0.5, 1);
    scene.add.existing(this);
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

  /** Walk to a target foot position; duration scales with distance. */
  walkTo(targetX: number, targetY: number, onArrive?: () => void): void {
    this.walkTween?.stop();

    const distance = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
    if (distance < 1) {
      this.setPosition(targetX, targetY);
      this.applyDepth();
      onArrive?.();
      return;
    }

    const duration = (distance / PLAYER_SPEED) * 1000;
    this.setFlipX(targetX < this.x);

    this.walkTween = this.scene.tweens.add({
      targets: this,
      x: targetX,
      y: targetY,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.applyDepth(),
      onComplete: () => {
        this.applyDepth();
        onArrive?.();
      },
    });
  }
}
