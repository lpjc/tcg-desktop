import Phaser from 'phaser';
import type { Facing } from '../characters/characterSheets';
import { planWalkMotion } from './walkMotion';

export interface PathWalker {
  x: number;
  y: number;
  setPosition(x: number, y: number): void;
  applyDepth?(): void;
  setFacing?(facing: Facing): void;
  playWalk?(): void;
  playIdle?(): void;
}

export interface FollowPathOptions {
  /** Constant speed (px/s) when useAccel is false. */
  speed: number;
  /** Player-style accel/decel per leg. */
  useAccel?: boolean;
  onComplete?: () => void;
}

/**
 * Walk a sprite through waypoints sequentially, stopping at obstacles implicitly
 * by only receiving pre-validated paths.
 */
export function followPath(
  scene: Phaser.Scene,
  walker: PathWalker,
  waypoints: Array<{ x: number; y: number }>,
  options: FollowPathOptions,
): Phaser.Tweens.Tween | undefined {
  if (waypoints.length === 0) {
    options.onComplete?.();
    return undefined;
  }

  let index = 0;
  let activeTween: Phaser.Tweens.Tween | undefined;

  const walkLeg = (): void => {
    const target = waypoints[index];
    const startX = walker.x;
    const startY = walker.y;
    const dx = target.x - startX;
    const dy = target.y - startY;
    const distance = Math.hypot(dx, dy);

    if (distance < 1) {
      index += 1;
      if (index >= waypoints.length) {
        walker.playIdle?.();
        options.onComplete?.();
        return;
      }
      walkLeg();
      return;
    }

    // Face along the dominant movement axis of this leg.
    const facing: Facing =
      Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    walker.setFacing?.(facing);
    walker.playWalk?.();

    const proxy = { t: 0 };
    const plan = options.useAccel ? planWalkMotion(distance) : null;
    const duration = plan ? plan.durationMs : (distance / options.speed) * 1000;

    activeTween = scene.tweens.add({
      targets: proxy,
      t: 1,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        const p = plan ? plan.progressAt(proxy.t) : proxy.t;
        walker.setPosition(
          Phaser.Math.Linear(startX, target.x, p),
          Phaser.Math.Linear(startY, target.y, p),
        );
        walker.applyDepth?.();
      },
      onComplete: () => {
        walker.setPosition(target.x, target.y);
        walker.applyDepth?.();
        index += 1;
        if (index >= waypoints.length) {
          walker.playIdle?.();
          options.onComplete?.();
          return;
        }
        walkLeg();
      },
    });
  };

  walkLeg();
  return activeTween;
}
