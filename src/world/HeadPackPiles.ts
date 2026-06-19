import Phaser from 'phaser';
import { allSets } from '../game/cards/cards';
import { gameState } from '../game/state/GameState';
import { PACK_TEXTURE, PACK_W, PACK_H, ensurePackTexture } from './PackPile';

/** Render the piles above the player's head, on top of world characters. */
const DEPTH = 5000;
const PILE_SPACING = 22;
const STACK_STEP = 3;
const MAX_STACK = 4;
/** Per-set accent tints (match the vending machine's PACK_ACCENTS order). */
const ACCENT_INTS = [0xe0563b, 0x3b7fe0, 0x6fb83b, 0xb85fd8, 0xe0a93b, 0x3bc6c0];

interface PileVisual {
  setId: string;
  cx: number;
  cy: number;
  sprites: Phaser.GameObjects.Image[];
  label: Phaser.GameObjects.Text;
}

/**
 * The bought packs shown as clickable per-set piles floating above the player's
 * head while they stand at the shop counter. Clicking a pile is what tears that
 * set's pack (see `PackRipController`); the tiny table pile is just decoration.
 * Hidden whenever the player isn't at the counter.
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

  /** Position the piles above a point (the player's head) and show them. */
  showAt(x: number, headY: number): void {
    this.anchor = { x, y: headY };
    this.active = true;
    this.rebuild();
  }

  hide(): void {
    this.active = false;
    this.clear();
  }

  /** Which set's pile is under the point, or null. */
  hitTest(worldX: number, worldY: number, pad = 4): string | null {
    for (const pile of this.piles) {
      const halfW = PACK_W / 2 + pad;
      const top = pile.cy - PACK_H - MAX_STACK * STACK_STEP - pad;
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

  /** World position a torn pack should burst from (top of its pile). */
  pilePosition(setId: string): { x: number; y: number } | null {
    const pile = this.piles.find((p) => p.setId === setId);
    return pile ? { x: pile.cx, y: pile.cy - PACK_H } : null;
  }

  /** Quick jolt of a set's pile when one of its packs is being torn. */
  shake(setId: string): void {
    const pile = this.piles.find((p) => p.setId === setId);
    if (!pile || pile.sprites.length === 0) return;
    this.scene.tweens.add({
      targets: pile.sprites,
      angle: { from: -6, to: 6 },
      duration: 55,
      yoyo: true,
      ease: 'Sine.easeInOut',
      onComplete: () => pile.sprites.forEach((s) => s.setAngle(0)),
    });
  }

  private rebuild(): void {
    this.clear();
    if (!this.active) return;

    const groups = this.groupPending();
    const span = (groups.length - 1) * PILE_SPACING;
    groups.forEach((group, i) => {
      const cx = this.anchor.x - span / 2 + i * PILE_SPACING;
      const cy = this.anchor.y;
      this.piles.push(this.buildPile(group.setId, group.count, cx, cy, i));
    });
  }

  private buildPile(setId: string, count: number, cx: number, cy: number, index: number): PileVisual {
    const tint = ACCENT_INTS[this.setAccentIndex(setId) % ACCENT_INTS.length];
    const sprites: Phaser.GameObjects.Image[] = [];
    const shown = Math.min(count, MAX_STACK);
    for (let s = 0; s < shown; s++) {
      const sprite = this.scene.add
        .image(cx, cy - s * STACK_STEP, PACK_TEXTURE)
        .setOrigin(0.5, 1)
        .setTint(tint)
        .setDepth(DEPTH + index + s * 0.01);
      sprites.push(sprite);
    }
    const label = this.scene.add
      .text(cx, cy - PACK_H - shown * STACK_STEP - 2, `x${count}`, {
        fontFamily: 'VCR OSD Mono, monospace',
        fontSize: '8px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 1)
      .setStroke('#0e1219', 3)
      .setDepth(DEPTH + index + 1);
    return { setId, cx, cy, sprites, label };
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
      pile.sprites.forEach((s) => s.destroy());
      pile.label.destroy();
    }
    this.piles = [];
  }

  private destroy(): void {
    this.unsubscribe();
    this.clear();
  }
}
