import Phaser from 'phaser';
import { depthFromFootY } from '../core/depth';
import {
  DIRECTION_FRAME_START,
  characterTextureKey,
  type CharacterKey,
} from './characterSheets';
import { playFacing } from './registerCharacterAnims';
import {
  clampToRect,
  findRegionContaining,
  nearestRegion,
  pickRandomRegion,
  randomPointInRect,
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

/**
 * A background convention-goer / shop visitor. Spawns at a zone edge, fades in,
 * strolls between random points for a few legs, then walks to the nearest edge
 * while fading out and removes itself. NPCs are decorative: they are never
 * interactive and carry no game state.
 *
 * Wander area is one of several rectangles (per convention room, or per shop
 * sub-zone with the counter strip carved out).
 */
export class Npc extends Phaser.GameObjects.Sprite {
  private readonly charKey: CharacterKey;
  private regions: WanderRect[];
  private region: WanderRect;
  private readonly onDespawn: (npc: Npc) => void;
  private facingLeft = false;
  private moveTween?: Phaser.Tweens.Tween;
  private fadeTween?: Phaser.Tweens.Tween;
  private pauseEvent?: Phaser.Time.TimerEvent;
  private legsRemaining: number;
  private leaving = false;

  constructor(
    scene: Phaser.Scene,
    charKey: CharacterKey,
    regions: WanderRect[],
    onDespawn: (npc: Npc) => void,
  ) {
    if (regions.length === 0) {
      throw new Error('Npc requires at least one wander region');
    }

    const region = pickRandomRegion(regions);
    const enterFromLeft = Math.random() < 0.5;
    const startX = enterFromLeft ? region.minX : region.maxX;
    const startY = Phaser.Math.Between(region.minY, region.maxY);

    super(scene, startX, startY, characterTextureKey(charKey, 'idle'), DIRECTION_FRAME_START.right);
    this.charKey = charKey;
    this.regions = regions;
    this.region = region;
    this.onDespawn = onDespawn;
    this.legsRemaining = Phaser.Math.Between(MIN_LEGS, MAX_LEGS);

    this.setOrigin(0.5, 1);
    this.setAlpha(0);
    scene.add.existing(this);
    this.applyDepth();

    this.fadeTween = scene.tweens.add({ targets: this, alpha: 1, duration: FADE_MS, ease: 'Linear' });
    this.startNextLeg();
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
    this.syncRegion();
  }

  /** Resume wandering after wander rectangles were rebuilt. */
  onBoundsChanged(): void {
    if (this.leaving) return;
    this.syncRegion();
    this.moveTween?.stop();
    this.pauseEvent?.remove(false);
    this.startNextLeg();
  }

  private syncRegion(): void {
    const current = findRegionContaining(this.x, this.y, this.regions);
    this.region = current ?? nearestRegion(this.x, this.y, this.regions);
    const clamped = clampToRect(this.x, this.y, this.region);
    this.setPosition(clamped.x, clamped.y);
    this.applyDepth();
  }

  private startNextLeg(): void {
    if (this.leaving || !this.scene) return;
    if (this.legsRemaining <= 0) {
      this.leave();
      return;
    }
    this.legsRemaining -= 1;
    const target = randomPointInRect(this.region);
    this.walkTo(target.x, target.y, () => this.pauseThen(() => this.startNextLeg()));
  }

  private pauseThen(next: () => void): void {
    if (!this.scene) return;
    playFacing(this, this.charKey, 'idle', this.facingLeft);
    this.pauseEvent = this.scene.time.delayedCall(
      Phaser.Math.Between(MIN_PAUSE_MS, MAX_PAUSE_MS),
      next,
    );
  }

  private leave(): void {
    this.leaving = true;
    const exitLeft = this.x - this.region.minX < this.region.maxX - this.x;
    const exitX = exitLeft ? this.region.minX - 10 : this.region.maxX + 10;
    this.fadeTween?.stop();
    this.fadeTween = this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: FADE_MS + 120,
      ease: 'Linear',
    });
    this.walkTo(exitX, this.y, () => {
      this.onDespawn(this);
      this.destroy();
    });
  }

  private walkTo(targetX: number, targetY: number, onArrive: () => void): void {
    this.moveTween?.stop();
    const clamped = clampToRect(targetX, targetY, this.region);
    targetX = clamped.x;
    targetY = clamped.y;

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) {
      onArrive();
      return;
    }

    if (Math.abs(dx) > 0.5) this.facingLeft = dx < 0;
    playFacing(this, this.charKey, 'walk', this.facingLeft);

    const startX = this.x;
    const startY = this.y;
    const proxy = { t: 0 };
    this.moveTween = this.scene.tweens.add({
      targets: proxy,
      t: 1,
      duration: (distance / STROLL_SPEED) * 1000,
      ease: 'Linear',
      onUpdate: () => {
        this.setPosition(
          Phaser.Math.Linear(startX, targetX, proxy.t),
          Phaser.Math.Linear(startY, targetY, proxy.t),
        );
        this.applyDepth();
      },
      onComplete: () => {
        this.setPosition(targetX, targetY);
        this.applyDepth();
        onArrive();
      },
    });
  }

  destroy(fromScene?: boolean): void {
    this.moveTween?.stop();
    this.fadeTween?.stop();
    this.pauseEvent?.remove(false);
    super.destroy(fromScene);
  }
}
