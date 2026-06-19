import Phaser from 'phaser';
import { gameState } from '../game/state/GameState';
import { depthFromFootY } from '../core/depth';

/** Booster-pack token size (source px). */
export const PACK_W = 10;
export const PACK_H = 14;
/** Most packs drawn as real sprites; beyond this a "+N" count carries the rest. */
const MAX_SHOWN = 5;
export const PACK_TEXTURE = 'counter-pack';
/** Table packs are pure ambient decoration now — drawn tiny (rips happen overhead). */
const TABLE_SCALE = 0.5;

/** Hand-placed little fan of pack offsets (origin 0.5,1), grows toward the back. */
const PACK_LAYOUT: ReadonlyArray<[number, number, number]> = [
  [0, 0, 0],
  [-7, -1, -8],
  [6, -1, 7],
  [-3, -4, -4],
  [3, -4, 5],
];

/**
 * Bought-but-unripped packs shown as a tiny ambient pile on the shop counter —
 * the shop twin of `BoothCashPile`. It's decoration only: the actual ripping
 * happens on the per-set piles that appear above the player's head at the
 * counter (see `HeadPackPiles`). Subscribes to the pending-pack queue so the
 * little stack grows and shrinks with what you own.
 */
export class PackPile {
  private readonly scene: Phaser.Scene;
  private readonly unsubscribe: () => void;
  private packs: Phaser.GameObjects.Image[] = [];
  private anchor?: { x: number; y: number };
  private depthY = 0;
  private shownCount = -1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    ensurePackTexture(scene);
    this.unsubscribe = gameState.subscribe(() => this.refresh());
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());
  }

  /** Sit the pile on the counter surface; `depthY` is the counter foot for sorting. */
  setAnchor(x: number, y: number, depthY: number): void {
    this.anchor = { x, y };
    this.depthY = depthY;
    this.shownCount = -1;
    this.refresh();
  }

  /** World position of the top of the pile (where a ripped pack bursts from). */
  getWorldAnchor(): { x: number; y: number } | null {
    return this.anchor ? { x: this.anchor.x, y: this.anchor.y } : null;
  }

  /** Quick jolt of the pile — feedback for each tear click on a pack. */
  shake(): void {
    if (this.packs.length === 0) return;
    this.scene.tweens.add({
      targets: this.packs,
      angle: { from: -5, to: 5 },
      duration: 55,
      yoyo: true,
      ease: 'Sine.easeInOut',
      onComplete: () => this.packs.forEach((p) => p.setAngle(0)),
    });
  }

  private refresh(): void {
    const count = gameState.snapshot().pendingPacks.length;
    if (count === this.shownCount) return;
    this.shownCount = count;
    this.rebuild(count);
  }

  private rebuild(count: number): void {
    this.clear();
    if (!this.anchor || count <= 0) return;

    const baseDepth = depthFromFootY(this.depthY) + 1;
    const shown = Math.min(count, MAX_SHOWN);
    for (let i = 0; i < shown; i++) {
      const [dx, dy, sort] = PACK_LAYOUT[i];
      const pack = this.scene.add
        .image(this.anchor.x + dx * TABLE_SCALE, this.anchor.y + dy * TABLE_SCALE, PACK_TEXTURE)
        .setOrigin(0.5, 1)
        .setScale(TABLE_SCALE)
        .setDepth(baseDepth + (sort + 8) * 0.01);
      this.packs.push(pack);
    }
  }

  private clear(): void {
    for (const pack of this.packs) pack.destroy();
    this.packs = [];
  }

  private destroy(): void {
    this.unsubscribe();
    this.clear();
  }
}

/** Draw the booster-pack token once: dark foil pouch, bright crimped top, shine. */
export function ensurePackTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(PACK_TEXTURE)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  g.fillStyle(0x0e1219, 1).fillRect(0, 0, PACK_W, PACK_H);
  g.fillStyle(0x394a86, 1).fillRect(1, 1, PACK_W - 2, PACK_H - 2);
  // Crimped top strip.
  g.fillStyle(0x6f86d8, 1).fillRect(1, 1, PACK_W - 2, 3);
  // Highlight + shadow bevel.
  g.fillStyle(0x9fb2ef, 1).fillRect(1, 1, 2, PACK_H - 2);
  g.fillStyle(0x1f2a52, 1).fillRect(PACK_W - 3, 1, 2, PACK_H - 2);
  // Diagonal foil shine.
  g.fillStyle(0xffffff, 0.5).fillRect(PACK_W - 5, 4, 1, PACK_H - 6);

  g.generateTexture(PACK_TEXTURE, PACK_W, PACK_H);
  g.destroy();
}
