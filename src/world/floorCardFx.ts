import Phaser from 'phaser';
import { SHOP_FLOOR_TOP, WORLD_HEIGHT, ZOOM } from '../core/constants';
import { depthFromFootY } from '../core/depth';
import type { Rarity } from '../game/cards/rarity';
import type { RippedCard } from '../game/economy/ShopEconomy';
import { rarityColor } from '../game/cards/rarityColors';
import { revealStockGain } from '../ui/saleFxBridge';
import { revealRippedCard } from '../ui/shopBridge';
import { getWorldLayout } from './WorldLayout';
import { ensureCardTexture } from './saleCardFx';

/** Floor card token scale (a touch bigger than stock tokens so it's clickable). */
const CARD_SCALE = 1.4 / ZOOM;
const BEAM_TEXTURE = 'rarity-beam';
/** Pixels the pointer must travel (held) before a tap becomes a scoop-sweep. */
const SWEEP_THRESHOLD = 6;
/** Minimum ms between sweep collects (~10/s). */
const SWEEP_INTERVAL_MS = 100;
/** Beams are loud; cull them once the floor gets this busy (perf + readability). */
const BEAM_CAP = 40;
/** Hard cap on floor sprites; oldest auto-collect into stock beyond this. */
const FLOOR_CAP = 250;
/** Inset from shop frame edges when clamping scatter. */
const SHOP_SCATTER_MARGIN = 10;

interface FloorEntry {
  id: number;
  sprite: Phaser.GameObjects.Image;
  beam: Phaser.GameObjects.Image | null;
  card: RippedCard;
  holoTween?: Phaser.Tweens.Tween;
}

/** Beam height/alpha scale per rarity (thin laser, brightest at base). */
const BEAM_RARITY: Record<Rarity, { scaleY: number; alpha: number }> = {
  common: { scaleY: 0.75, alpha: 0.55 },
  rare: { scaleY: 0.9, alpha: 0.7 },
  epic: { scaleY: 1.05, alpha: 0.82 },
  chase: { scaleY: 1.25, alpha: 0.95 },
};

/**
 * The persistent field of cards lying on the shop floor. Ripping a pack flings
 * its cards out here (chaotic, bouncy); they stay until the player picks them up
 * — a tap reveals one in the feed bar, or holding the button and sweeping the
 * pointer scoops a steady rhythm of them. Cards accumulate across packs and
 * visits (you can leave them and come back).
 *
 * Purely cosmetic: every card was already committed to collection + stock at rip
 * time. Picking one up poofs the floor sprite and hands the card to the reveal
 * bar, which flies it into stock when its dwell ends.
 */
export class FloorCardField {
  private readonly scene: Phaser.Scene;
  private readonly entries = new Map<number, FloorEntry>();
  private readonly order: number[] = [];
  private nextId = 1;
  private beamsActive = true;

  // Pointer state for tap-vs-sweep pickup (drag from anywhere on the floor).
  private pointerDownId: number | null = null;
  private downPos = { x: 0, y: 0 };
  private sweeping = false;
  private gestureClaimed = false;
  private lastCollectAt = 0;
  private onTapEmpty: ((worldX: number, worldY: number) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    ensureBeamTexture(scene);
  }

  /** Called when a tap on empty floor resolves (no sweep, no card under down). */
  setOnTapEmpty(handler: (worldX: number, worldY: number) => void): void {
    this.onTapEmpty = handler;
  }

  /** Fling a ripped pack's cards onto the floor around `burstFrom`. */
  addBurst(cards: RippedCard[], burstFrom: { x: number; y: number }, floorY: number): void {
    cards.forEach((card, i) => this.spawnCard(card, burstFrom, floorY, i));
    this.enforceCaps();
  }

  private shopScatterBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    const shop = getWorldLayout().shopFrame;
    return {
      minX: shop.x + SHOP_SCATTER_MARGIN,
      maxX: shop.x + shop.width - SHOP_SCATTER_MARGIN,
      minY: SHOP_FLOOR_TOP + SHOP_SCATTER_MARGIN,
      maxY: WORLD_HEIGHT - SHOP_SCATTER_MARGIN,
    };
  }

  private spawnCard(card: RippedCard, from: { x: number; y: number }, floorY: number, index: number): void {
    const key = ensureCardTexture(this.scene, card.rarity);
    const id = this.nextId++;
    const bounds = this.shopScatterBounds();

    let targetX = from.x + Phaser.Math.Between(-100, 100);
    let restY = floorY + Phaser.Math.Between(-28, 22);
    targetX = Phaser.Math.Clamp(targetX, bounds.minX, bounds.maxX);
    restY = Phaser.Math.Clamp(restY, bounds.minY, bounds.maxY);
    const restAngle = Phaser.Math.Between(-32, 32);

    const sprite = this.scene.add.image(from.x, from.y, key).setOrigin(0.5, 1);
    sprite.setScale(CARD_SCALE);
    sprite.setDepth(depthFromFootY(restY));

    const entry: FloorEntry = { id, sprite, beam: null, card };
    this.entries.set(id, entry);
    this.order.push(id);

    const duration = Phaser.Math.Between(560, 820);
    const delay = index * 28;
    this.scene.tweens.add({
      targets: sprite,
      x: targetX,
      duration,
      delay,
      ease: 'Quad.easeOut',
    });
    this.scene.tweens.add({
      targets: sprite,
      y: restY,
      duration,
      delay,
      ease: 'Back.easeOut',
      easeParams: [1.1],
      onUpdate: () => sprite.setDepth(depthFromFootY(sprite.y)),
      onComplete: () => {
        sprite.setDepth(depthFromFootY(restY));
        this.attachBeam(entry);
      },
    });
    this.scene.tweens.add({
      targets: sprite,
      angle: restAngle,
      duration,
      delay,
      ease: 'Quad.easeOut',
    });
  }

  /** Give an entry its rarity laser beam, unless the floor is too busy for beams. */
  private attachBeam(entry: FloorEntry): void {
    if (!this.beamsActive || entry.beam || !entry.sprite.active) return;
    const spec = BEAM_RARITY[entry.card.rarity];
    const beam = this.scene.add
      .image(entry.sprite.x, entry.sprite.y - 2, BEAM_TEXTURE)
      .setOrigin(0.5, 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(rarityColor(entry.card.rarity))
      .setAlpha(spec.alpha)
      .setScale(1, spec.scaleY)
      .setDepth(entry.sprite.depth - 0.5);
    entry.beam = beam;

    if (entry.card.holo) {
      const hue = { h: 0 };
      entry.holoTween = this.scene.tweens.add({
        targets: hue,
        h: 1,
        duration: 2200,
        repeat: -1,
        onUpdate: () => {
          const rgb = Phaser.Display.Color.HSVToRGB(hue.h, 0.65, 1) as Phaser.Types.Display.ColorObject;
          beam.setTint(Phaser.Display.Color.GetColor(rgb.r, rgb.g, rgb.b));
        },
      });
    }
  }

  private clearBeam(entry: FloorEntry): void {
    entry.holoTween?.stop();
    entry.holoTween = undefined;
    entry.beam?.destroy();
    entry.beam = null;
  }

  // ---- pointer (pickup) ----------------------------------------------------

  /**
   * Begin a floor gesture (card or empty). Returns true when the gesture is
   * claimed so the world won't walk on pointer-down.
   */
  handlePointerDown(worldX: number, worldY: number): boolean {
    this.pointerDownId = this.hitTest(worldX, worldY);
    this.downPos = { x: worldX, y: worldY };
    this.sweeping = false;
    this.gestureClaimed = true;
    return true;
  }

  handlePointerMove(pointer: Phaser.Input.Pointer, worldX: number, worldY: number): void {
    if (!pointer.isDown || !this.gestureClaimed) return;

    const moved = Phaser.Math.Distance.Between(worldX, worldY, this.downPos.x, this.downPos.y);
    if (!this.sweeping && moved > SWEEP_THRESHOLD) {
      this.sweeping = true;
      this.trySweepCollect(worldX, worldY);
      return;
    }

    if (this.sweeping) this.trySweepCollect(worldX, worldY);
  }

  handlePointerUp(worldX: number, worldY: number): void {
    if (!this.gestureClaimed) return;

    if (!this.sweeping) {
      if (this.pointerDownId !== null) {
        this.collect(this.pointerDownId);
      } else {
        const moved = Phaser.Math.Distance.Between(worldX, worldY, this.downPos.x, this.downPos.y);
        if (moved <= SWEEP_THRESHOLD) {
          this.onTapEmpty?.(this.downPos.x, this.downPos.y);
        }
      }
    }

    this.pointerDownId = null;
    this.sweeping = false;
    this.gestureClaimed = false;
  }

  private trySweepCollect(worldX: number, worldY: number): void {
    const now = this.scene.time.now;
    if (now - this.lastCollectAt < SWEEP_INTERVAL_MS) return;
    const id = this.hitTest(worldX, worldY);
    if (id === null) return;
    this.lastCollectAt = now;
    this.collect(id);
  }

  /** Whether any floor card sits under the point (for the world hit test). */
  isOverCard(worldX: number, worldY: number): boolean {
    return this.hitTest(worldX, worldY) !== null;
  }

  /** Topmost card under the point (ignores cards already flying away). */
  private hitTest(worldX: number, worldY: number, pad = 3): number | null {
    let best: number | null = null;
    let bestDepth = -Infinity;
    for (const id of this.order) {
      const entry = this.entries.get(id);
      if (!entry) continue;
      const b = entry.sprite.getBounds();
      if (
        worldX >= b.left - pad &&
        worldX <= b.right + pad &&
        worldY >= b.top - pad &&
        worldY <= b.bottom + pad &&
        entry.sprite.depth > bestDepth
      ) {
        best = id;
        bestDepth = entry.sprite.depth;
      }
    }
    return best;
  }

  /** Poof the floor sprite and hand the card to the reveal bar. */
  private collect(id: number): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.detach(id);
    this.clearBeam(entry);
    this.poofSprite(entry.sprite);
    revealRippedCard(entry.card);
  }

  /** Quietly release held stock with no reveal (perf-cap overflow). */
  private autoCollect(id: number): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.detach(id);
    this.clearBeam(entry);
    this.poofSprite(entry.sprite);
    revealStockGain(entry.card.pile, 1);
  }

  private poofSprite(sprite: Phaser.GameObjects.Image): void {
    this.scene.tweens.add({
      targets: sprite,
      scaleX: sprite.scaleX * 0.4,
      scaleY: sprite.scaleY * 0.4,
      alpha: 0,
      duration: 120,
      ease: 'Quad.easeIn',
      onComplete: () => sprite.destroy(),
    });
  }

  private detach(id: number): void {
    this.entries.delete(id);
    const at = this.order.indexOf(id);
    if (at >= 0) this.order.splice(at, 1);
    if (this.pointerDownId === id) this.pointerDownId = null;
  }

  /** Apply the beam cap (cull/restore beams) and the hard floor cap (overflow). */
  private enforceCaps(): void {
    const count = this.entries.size;
    if (count > BEAM_CAP && this.beamsActive) {
      this.beamsActive = false;
      for (const entry of this.entries.values()) this.clearBeam(entry);
    } else if (count <= BEAM_CAP && !this.beamsActive) {
      this.beamsActive = true;
      for (const entry of this.entries.values()) this.attachBeam(entry);
    }

    while (this.entries.size > FLOOR_CAP && this.order.length > 0) {
      this.autoCollect(this.order[0]);
    }
  }
}

/**
 * Thin vertical laser shaft: crisp bright at the card's foot, fading sharply
 * upward — steady loot indicator, not a soft pulsing glow.
 */
function ensureBeamTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(BEAM_TEXTURE)) return;
  const w = 3;
  const h = 52;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  for (let y = 0; y < h; y++) {
    const down = (y + 1) / h;
    const alpha = Math.pow(down, 2.8) * 0.98;
    g.fillStyle(0xffffff, alpha);
    g.fillRect(0, y, w, 1);
  }
  g.generateTexture(BEAM_TEXTURE, w, h);
  g.destroy();
}
