import Phaser from 'phaser';
import { gameState } from '../game/state/GameState';
import { depthFromFootY } from '../core/depth';

/** Booster-pack token size (source px). */
export const PACK_W = 10;
export const PACK_H = 14;
export const PACK_TEXTURE = 'counter-pack';
/** Counter decor pack scale — tidy but readable on the table. */
const TABLE_SCALE = 0.85;
const SCALED_H = PACK_H * TABLE_SCALE;

/**
 * Bought-but-unripped packs shown as a tidy ambient pack on the shop counter —
 * the shop twin of `BoothCashPile`. Decoration only: ripping happens on the
 * per-set packs above the player's head at the counter (`HeadPackPiles`).
 * Subscribes to the pending-pack queue so the display grows and shrinks with
 * what you own.
 */
export class PackPile {
  private readonly scene: Phaser.Scene;
  private readonly unsubscribe: () => void;
  private packSprite: Phaser.GameObjects.Image | null = null;
  private backSprite: Phaser.GameObjects.Image | null = null;
  private countLabel: Phaser.GameObjects.Text | null = null;
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

  /** Sit the pack on the counter surface; `depthY` is the counter foot for sorting. */
  setAnchor(x: number, y: number, depthY: number): void {
    this.anchor = { x, y };
    this.depthY = depthY;
    this.shownCount = -1;
    this.refresh();
  }

  /** World position of the top of the pack (burst origin if ever needed). */
  getWorldAnchor(): { x: number; y: number } | null {
    return this.anchor ? { x: this.anchor.x, y: this.anchor.y } : null;
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
    const { x, y } = this.anchor;

    if (count > 1) {
      this.backSprite = this.scene.add
        .image(x + 2, y - 2, PACK_TEXTURE)
        .setOrigin(0.5, 1)
        .setScale(TABLE_SCALE)
        .setTint(0x6f86d8)
        .setDepth(baseDepth);
    }

    this.packSprite = this.scene.add
      .image(x, y, PACK_TEXTURE)
      .setOrigin(0.5, 1)
      .setScale(TABLE_SCALE)
      .setDepth(baseDepth + 0.02);

    this.countLabel = this.scene.add
      .text(x, y - SCALED_H - 3, `x${count}`, {
        fontFamily: 'VCR OSD Mono, monospace',
        fontSize: '7px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 1)
      .setStroke('#0e1219', 3)
      .setDepth(baseDepth + 0.03);
  }

  private clear(): void {
    this.packSprite?.destroy();
    this.backSprite?.destroy();
    this.countLabel?.destroy();
    this.packSprite = null;
    this.backSprite = null;
    this.countLabel = null;
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
  g.fillStyle(0x6f86d8, 1).fillRect(1, 1, PACK_W - 2, 3);
  g.fillStyle(0x9fb2ef, 1).fillRect(1, 1, 2, PACK_H - 2);
  g.fillStyle(0x1f2a52, 1).fillRect(PACK_W - 3, 1, 2, PACK_H - 2);
  g.fillStyle(0xffffff, 0.5).fillRect(PACK_W - 5, 4, 1, PACK_H - 6);

  g.generateTexture(PACK_TEXTURE, PACK_W, PACK_H);
  g.destroy();
}
