import Phaser from 'phaser';
import { depthFromFootY } from '../core/depth';
import { getObstacleField } from '../world/obstacleField';
import {
  CHAR_FRAME_HEIGHT,
  CHAR_FRAME_WIDTH,
  DIRECTION_FRAME_START,
  NPC_CHARACTERS,
  characterTextureKey,
  type CharacterKey,
} from './characterSheets';
import { findDoorSpot } from './Npc';
import type { NpcCrowd } from './NpcCrowd';
import {
  conventionRoadEntrance,
  conventionWanderRegions,
  withinAnyRegion,
} from './wanderZones';

/** Passive fill: an unattended charge completes in this long. */
const GUEST_CHARGE_BASE_MS = 10_000;
/** Charge added per global left click (≈1s of passive fill; ~10 clicks fills the bar). */
const CLICK_GUEST_CHARGE_BOOST = 0.1;
/**
 * Hard floor between arrivals: even a maxed-out bar waits this long after the
 * charge started, so autoclickers can't dump a frame full of guests.
 */
const MIN_GUEST_CHARGE_MS = 600;
/**
 * Perf ceiling on concurrent convention NPCs. At the cap the fully-charged
 * silhouette waits in the doorway ("the con is packed") until someone leaves.
 */
const CONVENTION_FLOOD_CAP = 30;
/** Retry delay when furniture fully blocks the doorway line. */
const BLOCKED_DOOR_RETRY_MS = 1300;

/** Grey-ish translucent look of the uncharged silhouette. */
const SILHOUETTE_TINT = 0x32323c;
const SILHOUETTE_ALPHA = 0.45;

/** Arrival "pling" (visual-only for now — see playArrivalPling). */
const PLING_FLASH_MS = 160;
const PLING_BOUNCE_MS = 240;
const PLING_BOUNCE_SCALE = 1.15;

/**
 * The "idle, but your actions matter" doorway: exactly one incoming convention
 * guest charges in the road doorway at a time.
 *
 * - A grey silhouette of the actual guest sprite stands still on the door
 *   line; the full-color sprite is revealed bottom-up (feet first) by a
 *   geometry mask as `guestChargeProgress` fills.
 * - Progress is a single 0→1 value: passive time (full in ~10s) and global
 *   left-click boosts (+10% each, forwarded from the Electron uiohook via
 *   `desktop.onGlobalClick`) feed the same number, so timer and bar can never
 *   disagree. Spamming front-loads the bar; the `MIN_GUEST_CHARGE_MS` floor
 *   caps the arrival rate.
 * - On completion the silhouette "plings" (white flash + scale bounce), turns
 *   into a normal wandering `Npc` via `NpcCrowd.spawnConventionGuest`, and the
 *   next silhouette immediately starts charging.
 * - At `CONVENTION_FLOOD_CAP` the full silhouette waits in the doorway until a
 *   guest wanders out. A furniture-blocked doorway pauses/retries, mirroring
 *   `Npc.trySpawn`'s skip-and-retry.
 *
 * This replaces the convention's old random top-up; the shop crowd is
 * untouched.
 */
export class ConventionGuestChargeController {
  private readonly scene: Phaser.Scene;
  private readonly crowd: NpcCrowd;
  /** False while place mode is active — editing clicks must not spawn guests. */
  private readonly isBoostAllowed: () => boolean;

  /** The one number that is both "time remaining" and "bar fill" (0→1). */
  private guestChargeProgress = 0;
  /** scene.time.now when the current charge began — drives the min-charge floor. */
  private chargeStartedAt = 0;
  private charKey: CharacterKey = NPC_CHARACTERS[0];
  private doorSpot: { x: number; y: number } | null = null;

  private silhouette?: Phaser.GameObjects.Sprite;
  private colorFill?: Phaser.GameObjects.Sprite;
  private fillMaskGraphics?: Phaser.GameObjects.Graphics;
  private retryEvent?: Phaser.Time.TimerEvent;
  private plinging = false;
  private started = false;
  private destroyed = false;

  constructor(scene: Phaser.Scene, crowd: NpcCrowd, isBoostAllowed: () => boolean) {
    this.scene = scene;
    this.crowd = crowd;
    this.isBoostAllowed = isBoostAllowed;

    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());
  }

  /** Begin the first charge — call after layouts/obstacles are bootstrapped. */
  start(): void {
    if (this.started || this.destroyed) return;
    this.started = true;
    this.beginNextCharge();
  }

  /** A global left click anywhere on the desktop hurries the guest along. */
  onGlobalClick(): void {
    if (this.destroyed || this.plinging || !this.doorSpot) return;
    if (!this.isBoostAllowed()) return;
    this.guestChargeProgress = Math.min(1, this.guestChargeProgress + CLICK_GUEST_CHARGE_BOOST);
  }

  /**
   * Venue switch moved/rebuilt the convention doorway: re-anchor the charging
   * silhouette to the new entrance, keeping its progress.
   */
  relayout(): void {
    if (!this.started || this.destroyed || this.plinging) return;
    this.relocateDoorSpot();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.retryEvent?.remove(false);
    this.clearVisuals();
  }

  private update(_time: number, delta: number): void {
    if (this.destroyed || this.plinging || !this.doorSpot) return;

    this.guestChargeProgress = Math.min(
      1,
      this.guestChargeProgress + delta / GUEST_CHARGE_BASE_MS,
    );
    this.redrawFillMask();

    const elapsed = this.scene.time.now - this.chargeStartedAt;
    if (this.guestChargeProgress < 1 || elapsed < MIN_GUEST_CHARGE_MS) return;
    if (this.crowd.conventionCount() >= CONVENTION_FLOOD_CAP) return; // wait at the door
    this.pling();
  }

  /** Reset progress and stand a fresh grey silhouette in the doorway. */
  private beginNextCharge(): void {
    if (this.destroyed) return;
    this.clearVisuals();
    this.guestChargeProgress = 0;
    this.chargeStartedAt = this.scene.time.now;
    this.charKey = Phaser.Utils.Array.GetRandom(NPC_CHARACTERS as unknown as CharacterKey[]);

    this.doorSpot = findDoorSpot(conventionRoadEntrance(), conventionWanderRegions());
    if (!this.doorSpot) {
      this.scheduleDoorRetry(() => this.beginNextCharge());
      return;
    }
    this.buildSilhouette();
  }

  /** Move an in-progress charge to a fresh door spot (or pause if none). */
  private relocateDoorSpot(): void {
    this.clearVisuals();
    this.doorSpot = findDoorSpot(conventionRoadEntrance(), conventionWanderRegions());
    if (!this.doorSpot) {
      this.scheduleDoorRetry(() => this.relocateDoorSpot());
      return;
    }
    this.buildSilhouette();
  }

  private scheduleDoorRetry(retry: () => void): void {
    this.retryEvent?.remove(false);
    this.retryEvent = this.scene.time.delayedCall(BLOCKED_DOOR_RETRY_MS, retry);
  }

  /**
   * Two stacked copies of the guest's idle frame at the door spot:
   * - `silhouette`: solid dark tint at low alpha (the grey "incoming" ghost),
   * - `colorFill`: the real sprite, masked to its bottom `progress` fraction so
   *   color rises from the feet as the charge fills.
   * Both use a static frame — the guest only comes alive on the pling.
   */
  private buildSilhouette(): void {
    if (!this.doorSpot) return;
    const { x, y } = this.doorSpot;
    const texture = characterTextureKey(this.charKey, 'idle');
    const frame = DIRECTION_FRAME_START.down;
    const depth = depthFromFootY(y);

    this.silhouette = this.scene.add
      .sprite(x, y, texture, frame)
      .setOrigin(0.5, 1)
      .setTintFill(SILHOUETTE_TINT)
      .setAlpha(SILHOUETTE_ALPHA)
      .setDepth(depth);

    this.colorFill = this.scene.add
      .sprite(x, y, texture, frame)
      .setOrigin(0.5, 1)
      .setDepth(depth);

    // Mask graphics are never added to the display list; they only define the
    // revealed rectangle. Redrawn every frame in redrawFillMask().
    this.fillMaskGraphics = this.scene.make.graphics();
    this.colorFill.setMask(this.fillMaskGraphics.createGeometryMask());
    this.redrawFillMask();
  }

  private redrawFillMask(): void {
    if (!this.fillMaskGraphics || !this.doorSpot) return;
    const { x, y } = this.doorSpot;
    const revealedHeight = CHAR_FRAME_HEIGHT * this.guestChargeProgress;
    this.fillMaskGraphics
      .clear()
      .fillStyle(0xffffff)
      .fillRect(x - CHAR_FRAME_WIDTH / 2, y - revealedHeight, CHAR_FRAME_WIDTH, revealedHeight);
  }

  /**
   * Arrival! White flash + scale bounce, then the silhouette becomes a real
   * wandering NPC and the next charge starts immediately.
   */
  private pling(): void {
    if (!this.doorSpot || !this.colorFill) return;

    // Furniture may have been placed on the doorway mid-charge (place mode):
    // re-verify before materializing a guest inside a table.
    const regions = conventionWanderRegions();
    const standable = getObstacleField().isWalkable(
      this.doorSpot.x,
      this.doorSpot.y,
      (px, py) => withinAnyRegion(px, py, regions),
    );
    if (!standable) {
      this.relocateDoorSpot();
      return;
    }

    this.plinging = true;
    const spot = this.doorSpot;
    const arrivingChar = this.charKey;

    // Fully revealed for the pop — drop the mask so the bounce isn't clipped
    // to the unscaled frame rectangle.
    this.guestChargeProgress = 1;
    this.colorFill.clearMask(true);
    this.fillMaskGraphics?.destroy();
    this.fillMaskGraphics = undefined;
    this.playArrivalPling();

    const flash = this.scene.add
      .sprite(spot.x, spot.y, this.colorFill.texture.key, this.colorFill.frame.name)
      .setOrigin(0.5, 1)
      .setTintFill(0xffffff)
      .setDepth(this.colorFill.depth + 1);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: PLING_FLASH_MS,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });
    this.scene.tweens.add({
      targets: [this.colorFill, flash],
      scaleX: PLING_BOUNCE_SCALE,
      scaleY: PLING_BOUNCE_SCALE,
      duration: PLING_BOUNCE_MS / 2,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.plinging = false;
        this.crowd.spawnConventionGuest(arrivingChar, spot);
        this.beginNextCharge();
      },
    });
  }

  /**
   * Audio seam: the pling is visual-only until the app grows a sound system.
   * Wire the actual "pling!" sample here when it does.
   */
  private playArrivalPling(): void {
    /* no-op — flash + bounce carry the moment for now */
  }

  private clearVisuals(): void {
    this.retryEvent?.remove(false);
    this.retryEvent = undefined;
    this.colorFill?.clearMask(true);
    this.fillMaskGraphics?.destroy();
    this.fillMaskGraphics = undefined;
    this.silhouette?.destroy();
    this.silhouette = undefined;
    this.colorFill?.destroy();
    this.colorFill = undefined;
    this.doorSpot = null;
  }
}
