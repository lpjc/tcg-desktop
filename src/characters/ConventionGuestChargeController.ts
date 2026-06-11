import Phaser from 'phaser';
import { ROAD_FLOOR_TOP, WORLD_HEIGHT } from '../core/constants';
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
import { conventionRoadEntrance, conventionWanderRegions } from './wanderZones';

/** Passive fill: an unattended charge completes in this long. */
const GUEST_CHARGE_BASE_MS = 10_000;
/** Charge added per global click, left or right (≈1s of passive fill; ~10 clicks fills the bar). */
const CLICK_GUEST_CHARGE_BOOST = 0.1;
/**
 * Hard floor between arrivals: even a maxed-out bar waits this long after the
 * charge started, so autoclickers can't dump a frame full of guests.
 */
const MIN_GUEST_CHARGE_MS = 600;
/**
 * Perf ceiling on concurrent convention NPCs. At the cap the fully-charged
 * silhouette waits on the road ("the con is packed") until someone leaves.
 */
const CONVENTION_FLOOD_CAP = 30;
/** Retry delay when furniture fully blocks the doorway or road spot. */
const BLOCKED_DOOR_RETRY_MS = 1300;

/**
 * How far past the doorway line the silhouette stands — clears the convention
 * frame edge so the incoming guest visibly waits out on the road.
 */
const ROAD_STANDOFF = 18;
/** Foot-Y insets keeping the silhouette in the lower half of the road strip. */
const ROAD_FOOT_INSET_TOP = 12;
const ROAD_FOOT_INSET_BOTTOM = 8;
/** Foot positions sampled along the road strip when placing the silhouette. */
const ROAD_SPOT_SAMPLES = 5;

/** Grey-ish translucent look of the uncharged silhouette. */
const SILHOUETTE_TINT = 0x32323c;
const SILHOUETTE_ALPHA = 0.45;
/**
 * The fill mask is padded sideways so the click pulse (slight horizontal
 * stretch) never clips against the mask edges; only the bottom-up reveal
 * line is meaningful.
 */
const FILL_MASK_SIDE_PAD = 4;

/** Per-click feedback: quick squash pulse + sparks popping off the fill line. */
const CLICK_PULSE_MS = 80;
const CLICK_PULSE_SCALE_X = 1.2;
const CLICK_PULSE_SCALE_Y = 0.85;
const CLICK_SPARK_COUNT = 3;
const CLICK_SPARK_RISE = 10;
const CLICK_SPARK_MS = 280;

/** Arrival "pling" (visual-only for now — see playArrivalPling). */
const PLING_FLASH_MS = 160;
const PLING_BOUNCE_MS = 240;
const PLING_BOUNCE_SCALE = 1.15;

/** Visible art height per idle-down frame, keyed by texture key. */
const artHeightCache = new Map<string, number>();

/**
 * The 16×32 character frames are mostly transparent padding above the head —
 * the drawn art only occupies the bottom ~21px. The bottom-up reveal must span
 * the ART, not the frame, or the silhouette looks "full" at ~65% progress and
 * then seems to stall for seconds before the pling. Measured once per
 * character by scanning the frame for its first non-transparent row.
 */
function measureArtHeight(scene: Phaser.Scene, charKey: CharacterKey): number {
  const textureKey = characterTextureKey(charKey, 'idle');
  const cached = artHeightCache.get(textureKey);
  if (cached !== undefined) return cached;

  const frameIndex = DIRECTION_FRAME_START.down;
  let artHeight = CHAR_FRAME_HEIGHT; // fallback: full frame
  scan: for (let row = 0; row < CHAR_FRAME_HEIGHT; row++) {
    for (let col = 0; col < CHAR_FRAME_WIDTH; col++) {
      const alpha = scene.textures.getPixelAlpha(col, row, textureKey, frameIndex);
      if (alpha > 0) {
        artHeight = CHAR_FRAME_HEIGHT - row;
        break scan;
      }
    }
  }
  artHeightCache.set(textureKey, artHeight);
  return artHeight;
}

/**
 * The "idle, but your actions matter" doorway: exactly one incoming convention
 * guest charges out on the road in front of the lobby doorway at a time.
 *
 * - A grey silhouette of the actual guest sprite stands still on the road just
 *   outside the doorway; the full-color sprite is revealed bottom-up (feet
 *   first) by a geometry mask as `guestChargeProgress` fills.
 * - Progress is a single 0→1 value: passive time (full in ~10s) and global
 *   click boosts — left or right, anywhere on the desktop, forwarded from the
 *   Electron uiohook via `desktop.onGlobalClick` — feed the same number, so
 *   timer and bar can never disagree. Each click also fires a small squash
 *   pulse + spark on the silhouette. The `MIN_GUEST_CHARGE_MS` floor caps the
 *   arrival rate.
 * - On completion the silhouette "plings" (white flash + scale bounce), turns
 *   into a normal wandering `Npc` via `NpcCrowd.spawnConventionGuest` (which
 *   walks in through the doorway), and the next silhouette starts charging.
 * - At `CONVENTION_FLOOD_CAP` the full silhouette waits on the road until a
 *   guest wanders out. A blocked doorway/road spot pauses/retries, mirroring
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
  /** Visible art height of the current guest's frame — the reveal's full span. */
  private artHeight = CHAR_FRAME_HEIGHT;
  /** Where the silhouette stands: out on the road, past the doorway line. */
  private roadSpot: { x: number; y: number } | null = null;

  private silhouette?: Phaser.GameObjects.Sprite;
  private colorFill?: Phaser.GameObjects.Sprite;
  private fillMaskGraphics?: Phaser.GameObjects.Graphics;
  private retryEvent?: Phaser.Time.TimerEvent;
  private pulseTween?: Phaser.Tweens.Tween;
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

  /** A global click (left or right) anywhere hurries the guest along. */
  onGlobalClick(): void {
    if (this.destroyed || this.plinging || !this.roadSpot) return;
    if (!this.isBoostAllowed()) return;
    this.guestChargeProgress = Math.min(1, this.guestChargeProgress + CLICK_GUEST_CHARGE_BOOST);
    this.playClickPulse();
  }

  /**
   * Venue switch moved/rebuilt the convention doorway: re-anchor the charging
   * silhouette to the new road spot, keeping its progress.
   */
  relayout(): void {
    if (!this.started || this.destroyed || this.plinging) return;
    this.relocateRoadSpot();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.retryEvent?.remove(false);
    this.clearVisuals();
  }

  private update(_time: number, delta: number): void {
    if (this.destroyed || this.plinging || !this.roadSpot) return;

    this.guestChargeProgress = Math.min(
      1,
      this.guestChargeProgress + delta / GUEST_CHARGE_BASE_MS,
    );
    this.redrawFillMask();

    const elapsed = this.scene.time.now - this.chargeStartedAt;
    if (this.guestChargeProgress < 1 || elapsed < MIN_GUEST_CHARGE_MS) return;
    if (this.crowd.conventionCount() >= CONVENTION_FLOOD_CAP) return; // wait on the road
    this.pling();
  }

  /** Reset progress and stand a fresh grey silhouette out on the road. */
  private beginNextCharge(): void {
    if (this.destroyed) return;
    this.guestChargeProgress = 0;
    this.chargeStartedAt = this.scene.time.now;
    this.charKey = Phaser.Utils.Array.GetRandom(NPC_CHARACTERS as unknown as CharacterKey[]);
    this.relocateRoadSpot();
  }

  /** (Re)place the silhouette, keeping progress; pause+retry when blocked. */
  private relocateRoadSpot(): void {
    this.clearVisuals();
    this.roadSpot = this.findRoadSpot();
    if (!this.roadSpot) {
      this.scheduleRetry(() => this.relocateRoadSpot());
      return;
    }
    this.buildSilhouette();
  }

  /**
   * A standable foot spot on the road strip just past the doorway. Requires
   * the door line itself to be enterable (findDoorSpot) so a finished guest
   * can actually walk in.
   */
  private findRoadSpot(): { x: number; y: number } | null {
    const entrance = conventionRoadEntrance();
    if (!findDoorSpot(entrance, conventionWanderRegions())) return null;

    const field = getObstacleField();
    const x = entrance.x + ROAD_STANDOFF;
    const minY = ROAD_FLOOR_TOP + ROAD_FOOT_INSET_TOP;
    const maxY = WORLD_HEIGHT - ROAD_FOOT_INSET_BOTTOM;
    const startOffset = Math.random() * (maxY - minY);
    for (let i = 0; i < ROAD_SPOT_SAMPLES; i++) {
      const y = minY + ((startOffset + ((maxY - minY) * i) / ROAD_SPOT_SAMPLES) % (maxY - minY + 1));
      if (field.isWalkable(x, y)) return { x, y };
    }
    return null;
  }

  private scheduleRetry(retry: () => void): void {
    this.retryEvent?.remove(false);
    this.retryEvent = this.scene.time.delayedCall(BLOCKED_DOOR_RETRY_MS, retry);
  }

  /**
   * Two stacked copies of the guest's idle frame at the road spot:
   * - `silhouette`: solid dark tint at low alpha (the grey "incoming" ghost),
   * - `colorFill`: the real sprite, masked to its bottom `progress` fraction so
   *   color rises from the feet as the charge fills.
   * Both use a static frame — the guest only comes alive on the pling.
   */
  private buildSilhouette(): void {
    if (!this.roadSpot) return;
    const { x, y } = this.roadSpot;
    const texture = characterTextureKey(this.charKey, 'idle');
    const frame = DIRECTION_FRAME_START.down;
    const depth = depthFromFootY(y);
    this.artHeight = measureArtHeight(this.scene, this.charKey);

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
    if (!this.fillMaskGraphics || !this.roadSpot) return;
    const { x, y } = this.roadSpot;
    const width = CHAR_FRAME_WIDTH + FILL_MASK_SIDE_PAD * 2;
    // Span the visible art, not the frame: full color exactly at progress 1.
    const revealedHeight = this.artHeight * this.guestChargeProgress;
    this.fillMaskGraphics
      .clear()
      .fillStyle(0xffffff)
      .fillRect(x - width / 2, y - revealedHeight, width, revealedHeight);
  }

  /** Per-click juice: quick squash pulse + white sparks off the fill line. */
  private playClickPulse(): void {
    if (!this.silhouette || !this.colorFill || !this.roadSpot) return;

    this.pulseTween?.stop();
    this.silhouette.setScale(1);
    this.colorFill.setScale(1);
    this.pulseTween = this.scene.tweens.add({
      targets: [this.silhouette, this.colorFill],
      scaleX: CLICK_PULSE_SCALE_X,
      scaleY: CLICK_PULSE_SCALE_Y,
      duration: CLICK_PULSE_MS,
      yoyo: true,
      ease: 'Quad.easeOut',
    });

    // Sparks pop out of the current fill line and drift up while fading.
    const { x, y } = this.roadSpot;
    const fillLineY = y - this.artHeight * this.guestChargeProgress;
    for (let i = 0; i < CLICK_SPARK_COUNT; i++) {
      const spark = this.scene.add
        .rectangle(
          x + Phaser.Math.Between(-7, 7),
          fillLineY + Phaser.Math.Between(-2, 2),
          2,
          2,
          0xffffff,
        )
        .setDepth(depthFromFootY(y) + 1);
      this.scene.tweens.add({
        targets: spark,
        y: spark.y - CLICK_SPARK_RISE - Phaser.Math.Between(0, 4),
        alpha: 0,
        duration: CLICK_SPARK_MS,
        ease: 'Quad.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }

  /**
   * Arrival! White flash + scale bounce, then the silhouette becomes a real
   * NPC that walks in through the doorway, and the next charge starts.
   */
  private pling(): void {
    if (!this.roadSpot || !this.colorFill) return;

    this.plinging = true;
    const spot = this.roadSpot;
    const arrivingChar = this.charKey;

    // Fully revealed for the pop — drop the mask so the bounce isn't clipped
    // to the unscaled frame rectangle.
    this.guestChargeProgress = 1;
    this.pulseTween?.stop();
    this.colorFill.setScale(1);
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
        const guest = this.crowd.spawnConventionGuest(arrivingChar, spot);
        if (!guest) {
          // Doorway got blocked mid-charge: keep the full silhouette waiting
          // at a fresh spot until the door line opens up again.
          this.relocateRoadSpot();
          return;
        }
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
    this.pulseTween?.stop();
    this.pulseTween = undefined;
    this.colorFill?.clearMask(true);
    this.fillMaskGraphics?.destroy();
    this.fillMaskGraphics = undefined;
    this.silhouette?.destroy();
    this.silhouette = undefined;
    this.colorFill?.destroy();
    this.colorFill = undefined;
    this.roadSpot = null;
  }
}
