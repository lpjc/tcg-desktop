import Phaser from 'phaser';
import { depthFromFootY } from '../core/depth';
import {
  DIRECTION_FRAME_START,
  characterTextureKey,
  type CharacterKey,
  type Facing,
} from './characterSheets';
import { followPath } from '../core/pathWalk';
import { getObstacleField } from '../world/obstacleField';
import { playFacing } from './registerCharacterAnims';
import {
  pickRandomRegion,
  randomPointInRect,
  withinAnyRegion,
  type SceneEntrance,
  type WanderRect,
} from './wanderZones';

/** Quick transparency fade on arrival/exit — the "pop into life" effect. */
const FADE_MS = 220;
/** Background characters stroll noticeably slower than the player. */
const STROLL_SPEED = 38;
const MIN_PAUSE_MS = 500;
const MAX_PAUSE_MS = 2400;
/** Legs walked before an NPC heads for an exit and despawns. */
const MIN_LEGS = 3;
const MAX_LEGS = 8;
/** Failed wander-target picks in a row before the NPC gives up and leaves. */
const MAX_TARGET_FAILURES = 5;
/** Failed walk-to-exit attempts before fading out in place as a last resort. */
const MAX_EXIT_FAILURES = 3;
/** How far past the doorway an NPC walks while fading in/out. */
const DOOR_OVERSHOOT = 10;

/** Doorway foot positions sampled when spawning/exiting. */
const DOOR_SAMPLES = 7;

/** How long a buyer lingers at the booth (emote visible) before leaving. */
const ERRAND_PAUSE_MS = 1100;

/**
 * A one-off destination for an NPC: walk here, run `onArrive`, then leave. Used
 * for convention buyers (walk to the booth → purchase + emote → walk away)
 * instead of the default aimless wandering.
 */
export interface NpcErrand {
  target: { x: number; y: number };
  onArrive: (npc: Npc) => void;
}

/**
 * Find a standable foot position on the doorway line (inside the scene, clear
 * of furniture, inside a wander region). Returns null when furniture fully
 * blocks the entrance — callers must then skip spawning entirely.
 */
export function findDoorSpot(
  entrance: SceneEntrance,
  regions: WanderRect[],
): { x: number; y: number } | null {
  const field = getObstacleField();
  const allowed = (x: number, y: number) => withinAnyRegion(x, y, regions);
  const span = entrance.maxY - entrance.minY;
  const startOffset = Math.random() * span;
  for (let i = 0; i < DOOR_SAMPLES; i++) {
    const y = entrance.minY + ((startOffset + (span * i) / DOOR_SAMPLES) % (span + 1));
    if (field.isWalkable(entrance.x, y, allowed)) {
      return { x: entrance.x, y };
    }
  }
  return null;
}

/**
 * A background convention-goer / shop visitor.
 *
 * Lifecycle (never teleports, always enters/exits through the road doorway):
 * 1. Arrives one of two ways:
 *    - Default: spawns just outside the doorway at alpha 0, fades in while
 *      walking to a standable spot on the door line (shop visitors).
 *    - Materialized: starts fully visible at a given road spot — used by
 *      `ConventionGuestChargeController`, whose silhouette already stood there
 *      and "plinged" into this NPC — then walks in through the doorway.
 * 2. Strolls between random points inside its wander regions for a few legs;
 *    every path is routed around collidable furniture and constrained to the
 *    regions, so NPCs never cut through the road or walk over tables.
 * 3. Walks back to the doorway, steps outside while fading out, then despawns.
 *    If the doorway became unreachable it retries a few times and finally
 *    fades out in place — the only fallback, and still a smooth fade.
 *
 * NPCs are decorative: never interactive, no game state.
 */
export class Npc extends Phaser.GameObjects.Sprite {
  private readonly charKey: CharacterKey;
  private regions: WanderRect[];
  private readonly entrance: SceneEntrance;
  private readonly onDespawn: (npc: Npc) => void;
  private facing: Facing = 'down';
  private moveTween?: Phaser.Tweens.Tween;
  private fadeTween?: Phaser.Tweens.Tween;
  private pauseEvent?: Phaser.Time.TimerEvent;
  private legsRemaining: number;
  private targetFailures = 0;
  private exitFailures = 0;
  private leaving = false;
  private despawned = false;
  /** Optional walk-to-booth-and-buy errand; once done the NPC just leaves. */
  private errand: NpcErrand | null;
  private errandDone = false;

  /**
   * Spawn an NPC at the scene's doorway, or null when furniture blocks the
   * entrance (the crowd simply tries again on a later maintenance tick).
   *
   * `materializeAt` skips the alpha fade-in: the NPC starts fully visible at
   * that spot on the road (the guest-charge silhouette just "plinged" into it
   * there) and walks in through the doorway like everyone else.
   */
  static trySpawn(
    scene: Phaser.Scene,
    charKey: CharacterKey,
    regions: WanderRect[],
    entrance: SceneEntrance,
    onDespawn: (npc: Npc) => void,
    materializeAt?: { x: number; y: number },
    errand?: NpcErrand | null,
  ): Npc | null {
    if (regions.length === 0) return null;
    const doorSpot = findDoorSpot(entrance, regions);
    if (!doorSpot) return null;
    return new Npc(
      scene,
      charKey,
      regions,
      entrance,
      doorSpot,
      onDespawn,
      materializeAt ?? null,
      errand ?? null,
    );
  }

  private constructor(
    scene: Phaser.Scene,
    charKey: CharacterKey,
    regions: WanderRect[],
    entrance: SceneEntrance,
    doorSpot: { x: number; y: number },
    onDespawn: (npc: Npc) => void,
    materializeAt: { x: number; y: number } | null,
    errand: NpcErrand | null,
  ) {
    const start = materializeAt ?? {
      x: entrance.outside === 'right' ? entrance.x + DOOR_OVERSHOOT : entrance.x - DOOR_OVERSHOOT,
      y: doorSpot.y,
    };

    super(scene, start.x, start.y, characterTextureKey(charKey, 'idle'), DIRECTION_FRAME_START.down);
    this.charKey = charKey;
    this.regions = regions;
    this.entrance = entrance;
    this.onDespawn = onDespawn;
    this.errand = errand;
    this.legsRemaining = Phaser.Math.Between(MIN_LEGS, MAX_LEGS);

    this.setOrigin(0.5, 1);
    this.setAlpha(materializeAt ? 1 : 0);
    scene.add.existing(this);
    this.applyDepth();

    if (!materializeAt) {
      this.fadeTween = scene.tweens.add({ targets: this, alpha: 1, duration: FADE_MS, ease: 'Linear' });
    }

    // The hop from the road onto the door line. Only checked against furniture
    // (the outside strip is not part of any wander region).
    if (getObstacleField().segmentClear(this.x, this.y, doorSpot.x, doorSpot.y)) {
      this.walkAlong([doorSpot], () => this.startNextLeg());
    } else {
      // The door spot itself is verified free; skip the outside hop.
      this.setPosition(doorSpot.x, doorSpot.y);
      this.startNextLeg();
    }
  }

  getFootY(): number {
    return this.y;
  }

  applyDepth(): void {
    this.setDepth(depthFromFootY(this.y));
  }

  /** Slide horizontally with the shop frame (resize / venue width change). */
  shiftX(dx: number): void {
    this.x += dx;
    this.applyDepth();
  }

  /** Pick up rebuilt wander rectangles after a venue switch or shop relayout. */
  setRegions(regions: WanderRect[]): void {
    this.regions = regions;
  }

  /** Resume wandering after wander rectangles were rebuilt. */
  onBoundsChanged(): void {
    if (this.leaving) return;
    this.moveTween?.stop();
    this.pauseEvent?.remove(false);
    if (!withinAnyRegion(this.x, this.y, this.regions)) {
      // Stranded outside the new bounds — head for the exit (graceful fade
      // fallback inside leave() if even that is unreachable).
      this.leave();
      return;
    }
    this.startNextLeg();
  }

  private allowedFn(): (x: number, y: number) => boolean {
    return (x, y) => withinAnyRegion(x, y, this.regions);
  }

  private startNextLeg(): void {
    if (this.leaving || !this.scene) return;
    if (this.errand && !this.errandDone) {
      this.goToErrand();
      return;
    }
    if (this.legsRemaining <= 0 || this.targetFailures >= MAX_TARGET_FAILURES) {
      this.leave();
      return;
    }
    const target = this.pickReachableTarget();
    if (!target) {
      // Don't burn a leg on a failed pick; pause and try again.
      this.targetFailures += 1;
      this.pauseThen(() => this.startNextLeg());
      return;
    }
    this.targetFailures = 0;
    this.legsRemaining -= 1;
    this.walkAlong(target.path, () => this.pauseThen(() => this.startNextLeg()));
  }

  /**
   * Walk to the errand target (e.g. the booth front), run its callback, then
   * linger briefly (so the emote reads) before leaving. Falls back to normal
   * wandering if the target can't be reached.
   */
  private goToErrand(): void {
    if (!this.errand || !this.scene) return;
    const errand = this.errand;
    const obstacles = getObstacleField();
    const allowed = this.allowedFn();
    const dest = obstacles.isWalkable(errand.target.x, errand.target.y, allowed)
      ? errand.target
      : obstacles.findStandPointNear(errand.target.x, errand.target.y, allowed);

    this.errandDone = true; // one attempt; never loop on the errand
    if (!dest) {
      this.startNextLeg();
      return;
    }
    const path = obstacles.findPath(this.x, this.y, dest.x, dest.y, allowed);
    if (path.length === 0) {
      this.startNextLeg();
      return;
    }
    this.walkAlong(path, () => {
      this.facing = 'up'; // face the booth across the counter
      playFacing(this, this.charKey, 'idle', this.facing);
      errand.onArrive(this);
      this.pauseEvent = this.scene.time.delayedCall(ERRAND_PAUSE_MS, () => this.leave());
    });
  }

  private pickReachableTarget(): { path: Array<{ x: number; y: number }> } | null {
    const obstacles = getObstacleField();
    const allowed = this.allowedFn();
    for (let attempt = 0; attempt < 14; attempt++) {
      const targetRegion = pickRandomRegion(this.regions);
      const point = randomPointInRect(targetRegion);
      if (!obstacles.isWalkable(point.x, point.y, allowed)) continue;
      const path = obstacles.findPath(this.x, this.y, point.x, point.y, allowed);
      if (path.length > 0) return { path };
    }
    return null;
  }

  private pauseThen(next: () => void): void {
    if (!this.scene) return;
    playFacing(this, this.charKey, 'idle', this.facing);
    this.pauseEvent = this.scene.time.delayedCall(
      Phaser.Math.Between(MIN_PAUSE_MS, MAX_PAUSE_MS),
      next,
    );
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.walkToExit();
  }

  private walkToExit(): void {
    if (!this.scene) return;
    const doorSpot = findDoorSpot(this.entrance, this.regions);
    const exitPath = doorSpot
      ? getObstacleField().findPath(this.x, this.y, doorSpot.x, doorSpot.y, this.allowedFn())
      : [];

    if (exitPath.length === 0) {
      this.exitFailures += 1;
      if (this.exitFailures >= MAX_EXIT_FAILURES) {
        this.fadeOutAndDespawn();
        return;
      }
      this.pauseThen(() => this.walkToExit());
      return;
    }

    this.walkAlong(exitPath, () => this.stepOutsideAndDespawn());
  }

  /** At the doorway: fade while taking the last few steps off-scene. */
  private stepOutsideAndDespawn(): void {
    if (!this.scene) return;
    const outsideX =
      this.entrance.outside === 'right'
        ? this.entrance.x + DOOR_OVERSHOOT
        : this.entrance.x - DOOR_OVERSHOOT;
    this.fadeOutAndDespawn();
    if (getObstacleField().segmentClear(this.x, this.y, outsideX, this.y)) {
      this.moveTween?.stop();
      this.moveTween = followPath(this.scene, this.asPathWalker(), [{ x: outsideX, y: this.y }], {
        speed: STROLL_SPEED,
      });
    }
  }

  /** Last-resort exit and the tail end of a doorway exit: smooth fade, never a pop. */
  private fadeOutAndDespawn(): void {
    if (this.despawned || !this.scene) return;
    this.fadeTween?.stop();
    this.fadeTween = this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: FADE_MS + 120,
      ease: 'Linear',
      onComplete: () => this.despawn(),
    });
  }

  private despawn(): void {
    if (this.despawned) return;
    this.despawned = true;
    this.onDespawn(this);
    this.destroy();
  }

  private walkAlong(waypoints: Array<{ x: number; y: number }>, onArrive: () => void): void {
    this.moveTween?.stop();
    this.moveTween = followPath(this.scene, this.asPathWalker(), waypoints, {
      speed: STROLL_SPEED,
      onComplete: onArrive,
    });
  }

  private asPathWalker() {
    const npc = this;
    return {
      // Live getters: followPath reads the walker position at each leg start.
      get x() {
        return npc.x;
      },
      get y() {
        return npc.y;
      },
      setPosition: (x: number, y: number) => this.setPosition(x, y),
      applyDepth: () => this.applyDepth(),
      setFacing: (facing: Facing) => {
        this.facing = facing;
      },
      playWalk: () => playFacing(this, this.charKey, 'walk', this.facing),
      playIdle: () => playFacing(this, this.charKey, 'idle', this.facing),
    };
  }

  destroy(fromScene?: boolean): void {
    this.moveTween?.stop();
    this.fadeTween?.stop();
    this.pauseEvent?.remove(false);
    super.destroy(fromScene);
  }
}
