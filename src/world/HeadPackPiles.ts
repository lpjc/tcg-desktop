import Phaser from 'phaser';
import { allSets } from '../game/cards/cards';
import { gameState } from '../game/state/GameState';
import { PACK_TEXTURE, PACK_W, PACK_H, ensurePackTexture } from './PackPile';

/** Render head packs above the player, on top of world characters. */
const DEPTH = 5000;
const PILE_SPACING = 30;
const HEAD_SCALE = 1.6;
const SCALED_W = PACK_W * HEAD_SCALE;
const SCALED_H = PACK_H * HEAD_SCALE;
/** Per-set accent tints (match the vending machine's PACK_ACCENTS order). */
const ACCENT_INTS = [0xe0563b, 0x3b7fe0, 0x6fb83b, 0xb85fd8, 0xe0a93b, 0x3bc6c0];

interface PileVisual {
  setId: string;
  cx: number;
  cy: number;
  sprite: Phaser.GameObjects.Image;
  countText: Phaser.GameObjects.Text;
  tearCrease: Phaser.GameObjects.Graphics;
  interactive: boolean;
}

/**
 * Bought packs shown as one bigger pack per set above the player's head at the
 * shop counter. Clicking a set's pack tears it (`PackRipController`). When the
 * player owns no packs, a grey placeholder is shown instead.
 */
export class HeadPackPiles {
  private readonly scene: Phaser.Scene;
  private readonly unsubscribe: () => void;
  private piles: PileVisual[] = [];
  private anchor = { x: 0, y: 0 };
  private active = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    ensurePackTexture(scene);
    this.unsubscribe = gameState.subscribe(() => this.rebuild());
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());
  }

  /** Position the packs above a point (the player's head) and show them. */
  showAt(x: number, headY: number): void {
    this.anchor = { x, y: headY };
    this.active = true;
    this.rebuild();
  }

  hide(): void {
    this.active = false;
    this.clear();
  }

  /** Which set's pack is under the point, or null (placeholder is not clickable). */
  hitTest(worldX: number, worldY: number, pad = 6): string | null {
    for (const pile of this.piles) {
      if (!pile.interactive) continue;
      const halfW = SCALED_W / 2 + pad;
      const top = pile.cy - SCALED_H - pad;
      if (
        worldX >= pile.cx - halfW &&
        worldX <= pile.cx + halfW &&
        worldY >= top &&
        worldY <= pile.cy + pad
      ) {
        return pile.setId;
      }
    }
    return null;
  }

  isOverPile(worldX: number, worldY: number): boolean {
    return this.active && this.hitTest(worldX, worldY) !== null;
  }

  /** World position a torn pack should burst from (top of the pack). */
  pilePosition(setId: string): { x: number; y: number } | null {
    const pile = this.piles.find((p) => p.setId === setId);
    return pile ? { x: pile.cx, y: pile.cy - SCALED_H } : null;
  }

  /** Soft squash + growing tear crease for each rip click. */
  tearStep(setId: string, progress01: number): void {
    const pile = this.piles.find((p) => p.setId === setId);
    if (!pile || !pile.interactive) return;

    const sprite = pile.sprite;
    this.scene.tweens.killTweensOf(sprite);
    sprite.setScale(HEAD_SCALE, HEAD_SCALE * 0.88);
    this.scene.tweens.add({
      targets: sprite,
      scaleY: HEAD_SCALE,
      y: pile.cy - 1.5,
      duration: 140,
      ease: 'Sine.easeOut',
      yoyo: true,
      onComplete: () => {
        sprite.setScale(HEAD_SCALE);
        sprite.y = pile.cy;
      },
    });

    this.drawTearCrease(pile, progress01);
  }

  private drawTearCrease(pile: PileVisual, progress01: number): void {
    const g = pile.tearCrease;
    g.clear();
    if (progress01 <= 0) return;

    const topY = pile.cy - SCALED_H + 2;
    const halfW = SCALED_W * 0.42;
    const tearLen = halfW * 2 * Phaser.Math.Clamp(progress01, 0.05, 1);
    const segments = 5;
    const step = tearLen / segments;

    g.lineStyle(1.5, 0xffffff, 0.85);
    g.beginPath();
    g.moveTo(pile.cx - halfW, topY);
    for (let i = 1; i <= segments; i++) {
      const x = pile.cx - halfW + step * i;
      const jag = i % 2 === 0 ? 1.5 : -1;
      g.lineTo(x, topY + jag);
    }
    g.strokePath();
  }

  private rebuild(): void {
    this.clear();
    if (!this.active) return;

    const groups = this.groupPending();
    if (groups.length === 0) {
      this.piles.push(this.buildPlaceholder(this.anchor.x, this.anchor.y));
      return;
    }

    const span = (groups.length - 1) * PILE_SPACING;
    groups.forEach((group, i) => {
      const cx = this.anchor.x - span / 2 + i * PILE_SPACING;
      const cy = this.anchor.y;
      this.piles.push(this.buildPack(group.setId, group.count, cx, cy, i));
    });
  }

  private buildPack(setId: string, count: number, cx: number, cy: number, index: number): PileVisual {
    const tint = ACCENT_INTS[this.setAccentIndex(setId) % ACCENT_INTS.length];
    const sprite = this.scene.add
      .image(cx, cy, PACK_TEXTURE)
      .setOrigin(0.5, 1)
      .setTint(tint)
      .setScale(HEAD_SCALE)
      .setDepth(DEPTH + index);

    const countText = this.scene.add
      .text(cx, cy - SCALED_H * 0.55, String(count), {
        fontFamily: 'VCR OSD Mono, monospace',
        fontSize: '11px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5)
      .setStroke('#0e1219', 3)
      .setDepth(DEPTH + index + 0.1);

    const tearCrease = this.scene.add.graphics().setDepth(DEPTH + index + 0.2);

    return { setId, cx, cy, sprite, countText, tearCrease, interactive: true };
  }

  private buildPlaceholder(cx: number, cy: number): PileVisual {
    const sprite = this.scene.add
      .image(cx, cy, PACK_TEXTURE)
      .setOrigin(0.5, 1)
      .setTint(0x8899aa)
      .setAlpha(0.45)
      .setScale(HEAD_SCALE)
      .setDepth(DEPTH);

    const countText = this.scene.add
      .text(cx, cy - SCALED_H - 4, 'no packs', {
        fontFamily: 'VCR OSD Mono, monospace',
        fontSize: '8px',
        color: '#c8d0dc',
      })
      .setOrigin(0.5, 1)
      .setStroke('#0e1219', 3)
      .setDepth(DEPTH + 0.1);

    const tearCrease = this.scene.add.graphics().setDepth(DEPTH + 0.2);

    return { setId: '', cx, cy, sprite, countText, tearCrease, interactive: false };
  }

  private groupPending(): { setId: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const setId of gameState.snapshot().pendingPacks) {
      counts.set(setId, (counts.get(setId) ?? 0) + 1);
    }
    return [...counts.entries()].map(([setId, count]) => ({ setId, count }));
  }

  private setAccentIndex(setId: string): number {
    const idx = allSets().findIndex((set) => set.id === setId);
    return idx < 0 ? 0 : idx;
  }

  private clear(): void {
    for (const pile of this.piles) {
      pile.sprite.destroy();
      pile.countText.destroy();
      pile.tearCrease.destroy();
    }
    this.piles = [];
  }

  private destroy(): void {
    this.unsubscribe();
    this.clear();
  }
}
