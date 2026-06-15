import Phaser from 'phaser';
import { DEPTH_UI, ZOOM } from '../core/constants';
import { depthFromFootY } from '../core/depth';
import type { FlyPoint } from '../ui/flyFx';
import { coinTextureKey, registerCoinAnim } from './coins';
import { screenToWorld } from './hudCoords';

/**
 * Sale/collect coins rendered in the Phaser world (not DOM flies) so they can
 * spawn behind a buyer and arc up into the money pill — same layering trick as
 * `saleCardFx`. The pill itself is still DOM; coins fade out at the world point
 * that maps to its screen centre.
 */
const COIN_ANIM = 'coin-spin';
/** 12px source art → 10px on screen, undo camera zoom. */
const COIN_BASE_SCALE = (10 / 12) / ZOOM;
const PEAK_SCALE = 1.18;
const END_SCALE = 0.45;
const FADE_EDGE = 0.05;
/** Once clear of the buyer, coins climb above the world band toward the HUD. */
const HUD_DEPTH = DEPTH_UI - 10;

export interface FlyWorldCoinsOptions {
  duration?: number;
  stagger?: number;
  /** Trip fraction at which the first coin cues `onFirstArrive` (default ~0.55). */
  revealAt?: number;
  /** Starting depth — e.g. just behind a buyer's feet. */
  spawnDepth: number;
}

function depthAlongArc(t: number, footY: number, spawnDepth: number): number {
  if (t < 0.2) return spawnDepth;
  const yDepth = depthFromFootY(footY);
  return Phaser.Math.Linear(Math.max(spawnDepth, yDepth), HUD_DEPTH, (t - 0.2) / 0.8);
}

function flyOneCoin(
  scene: Phaser.Scene,
  from: { x: number; y: number },
  to: { x: number; y: number },
  durationMs: number,
  spawnDepth: number,
): Promise<void> {
  registerCoinAnim(scene);
  const coin = scene.add.sprite(from.x, from.y, coinTextureKey(1)).setOrigin(0.5, 0.5);
  coin.play(COIN_ANIM);
  coin.setDepth(spawnDepth);
  coin.setScale(COIN_BASE_SCALE).setAlpha(0);

  const progress = { t: 0 };
  return new Promise((resolve) => {
    scene.tweens.add({
      targets: progress,
      t: 1,
      duration: durationMs,
      ease: 'Cubic.easeInOut',
      onUpdate: () => {
        const t = progress.t;
        coin.x = Phaser.Math.Linear(from.x, to.x, t);
        coin.y = Phaser.Math.Linear(from.y, to.y, t);
        coin.setDepth(depthAlongArc(t, coin.y, spawnDepth));

        const mult =
          t < 0.5
            ? Phaser.Math.Linear(1, PEAK_SCALE, t / 0.5)
            : Phaser.Math.Linear(PEAK_SCALE, END_SCALE, (t - 0.5) / 0.5);
        coin.setScale(COIN_BASE_SCALE * mult);

        coin.alpha =
          t < FADE_EDGE ? t / FADE_EDGE : t > 1 - FADE_EDGE ? (1 - t) / FADE_EDGE : 1;
      },
      onComplete: () => {
        coin.destroy();
        resolve();
      },
    });
  });
}

/**
 * Spinning world coins from a world-space origin to the money pill. `onFirstArrive`
 * fires once, when the first coin reaches the `revealAt` fraction of its trip.
 */
export function flyCoinsToPill(
  scene: Phaser.Scene,
  from: { x: number; y: number },
  pillScreen: FlyPoint,
  count: number,
  options: FlyWorldCoinsOptions,
  onFirstArrive?: () => void,
): Promise<void> {
  const clamped = Math.max(1, Math.min(count, 8));
  const duration = options.duration ?? 1100;
  const stagger = options.stagger ?? 70;
  const revealAt = options.revealAt ?? 0.55;
  const to = screenToWorld(scene, pillScreen.x, pillScreen.y);
  let arrived = false;

  const flights = Array.from({ length: clamped }, (_, index) => {
    const jitter = { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 6 };
    const delay = index * stagger;
    const coinDuration = duration + index * 40;
    const origin = { x: from.x + jitter.x / ZOOM, y: from.y + jitter.y / ZOOM };

    if (index === 0 && onFirstArrive) {
      scene.time.delayedCall(delay + coinDuration * revealAt, () => {
        if (!arrived) {
          arrived = true;
          onFirstArrive();
        }
      });
    }

    return new Promise<void>((resolve) => {
      scene.time.delayedCall(delay, () => {
        void flyOneCoin(scene, origin, to, coinDuration, options.spawnDepth).then(resolve);
      });
    });
  });

  return Promise.all(flights).then(() => undefined);
}
