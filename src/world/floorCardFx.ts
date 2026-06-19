import Phaser from 'phaser';
import { DEPTH_UI, ZOOM } from '../core/constants';
import { depthFromFootY } from '../core/depth';
import type { RippedCard } from '../game/economy/ShopEconomy';
import { rarityColor } from '../game/cards/rarityColors';
import { revealStockGain, stockTokenCenter } from '../ui/saleFxBridge';
import { revealRippedCard } from '../ui/shopBridge';
import { screenToWorld } from './hudCoords';
import { ensureCardTexture } from './saleCardFx';

/** Floor card token scale (a touch bigger than stock tokens so it's clickable). */
const CARD_SCALE = 1.4 / ZOOM;
const BEAM_TEXTURE = 'rarity-beam';
const FLY_MS = 560;
/** Pixels the pointer must travel (held) before a tap becomes a scoop-sweep. */
const SWEEP_THRESHOLD = 6;
/** Beams are loud; cull them once the floor gets this busy (perf + readability). */
const BEAM_CAP = 40;
/** Hard cap on floor sprites; oldest auto-collect into stock beyond this. */
const FLOOR_CAP = 250;

interface FloorEntry {
  id: number;
  sprite: Phaser.GameObjects.Image;
  beam: Phaser.GameObjects.Image | null;
  card: RippedCard;
  breatheTween?: Phaser.Tweens.Tween;
  holoTween?: Phaser.Tweens.Tween;
}

/**
 * The persistent field of cards lying on the shop floor. Ripping a pack flings
 * its cards out here (chaotic, bouncy); they stay until the player picks them up
 * — a single click reveals + flies one into stock in one motion, or holding the
 * button and sweeping the pointer scoops a streak of them. Cards accumulate
 * across packs and across visits (you can leave them and come back).
 *
 * Purely cosmetic: every card was already committed to collection + stock at rip
 * time. Picking one up just flies the token into its stock pile (releasing the
 * held count) and pops a reveal in the feed.
 */
export class FloorCardField {
  private readonly scene: Phaser.Scene;
  private readonly entries = new Map<number, FloorEntry>();
  private readonly order: number[] = [];
  private nextId = 1;
  private beamsActive = true;

  // Pointer state for tap-vs-sweep pickup.
  private pointerDownId: number | null = null;
  private downPos = { x: 0, y: 0 };
  private sweeping = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    ensureBeamTexture(scene);
  }

  /** Fling a ripped pack's cards onto the floor around `burstFrom`. */
  addBurst(cards: RippedCard[], burstFrom: { x: number; y: number }, floorY: number): void {
    cards.forEach((card, i) => this.spawnCard(card, burstFrom, floorY, i));
    this.enforceCaps();
  }

  private spawnCard(card: RippedCard, from: { x: number; y: number }, floorY: number, index: number): void {
    const key = ensureCardTexture(this.scene, card.rarity);
    const id = this.nextId++;

    const targetX = from.x + Phaser.Math.Between(-52, 52);
    const restY = floorY + Phaser.Math.Between(-7, 9);
    const restAngle = Phaser.Math.Between(-26, 26);

    const sprite = this.scene.add.image(from.x, from.y, key).setOrigin(0.5, 1);
    sprite.setScale(CARD_SCALE);
    sprite.setDepth(depthFromFootY(restY));

    const entry: FloorEntry = { id, sprite, beam: null, card };
    this.entries.set(id, entry);
    this.order.push(id);

    // Chaotic launch: x drifts out, y bounces down (glances off the floor),
    // the card spins to a random resting tilt — physics-y without a physics body.
    const duration = Phaser.Math.Between(520, 760);
    const delay = index * 24;
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
      ease: 'Bounce.easeOut',
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

  /** Give an entry its rarity beam, unless the floor is too busy for beams. */
  private attachBeam(entry: FloorEntry): void {
    if (!this.beamsActive || entry.beam || !entry.sprite.active) return;
    const beam = this.scene.add
      .image(entry.sprite.x, entry.sprite.y - 2, BEAM_TEXTURE)
      .setOrigin(0.5, 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(rarityColor(entry.card.rarity))
      .setAlpha(0.7)
      .setDepth(entry.sprite.depth - 0.5);
    entry.beam = beam;

    // Gentle "alive" breathe (never fully off — a steady loot shine, not a blink).
    entry.breatheTween = this.scene.tweens.add({
      targets: beam,
      alpha: { from: 0.5, to: 0.82 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
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
    entry.breatheTween?.stop();
    entry.holoTween?.stop();
    entry.breatheTween = undefined;
    entry.holoTween = undefined;
    entry.beam?.destroy();
    entry.beam = null;
  }

  // ---- pointer (pickup) ----------------------------------------------------

  /** Returns true when a floor card was grabbed (so it won't count as a walk). */
  handlePointerDown(worldX: number, worldY: number): boolean {
    const id = this.hitTest(worldX, worldY);
    if (id === null) return false;
    this.pointerDownId = id;
    this.downPos = { x: worldX, y: worldY };
    this.sweeping = false;
    return true;
  }

  handlePointerMove(pointer: Phaser.Input.Pointer, worldX: number, worldY: number): void {
    if (!pointer.isDown || this.pointerDownId === null) return;
    if (!this.sweeping) {
      const moved = Phaser.Math.Distance.Between(worldX, worldY, this.downPos.x, this.downPos.y);
      if (moved <= SWEEP_THRESHOLD) return;
      this.sweeping = true;
      this.collect(this.pointerDownId);
    }
    const id = this.hitTest(worldX, worldY);
    if (id !== null) this.collect(id);
  }

  handlePointerUp(): void {
    if (!this.sweeping && this.pointerDownId !== null) this.collect(this.pointerDownId);
    this.pointerDownId = null;
    this.sweeping = false;
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

  /** Reveal + fly a card into stock — the single pickup action. */
  private collect(id: number): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.detach(id);
    this.clearBeam(entry);
    revealRippedCard(entry.card);
    this.flyToStock(entry);
  }

  /** Quietly send a card to stock with no reveal (used by the perf-cap overflow). */
  private autoCollect(id: number): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.detach(id);
    this.clearBeam(entry);
    this.flyToStock(entry);
  }

  private flyToStock(entry: FloorEntry): void {
    const { sprite, card } = entry;
    const token = stockTokenCenter(card.pile);
    if (!token) {
      sprite.destroy();
      revealStockGain(card.pile, 1);
      return;
    }
    const to = screenToWorld(this.scene, token.x, token.y);
    const from = { x: sprite.x, y: sprite.y };
    sprite.setDepth(DEPTH_UI - 5);
    const progress = { t: 0 };
    this.scene.tweens.add({
      targets: progress,
      t: 1,
      duration: FLY_MS,
      ease: 'Cubic.easeInOut',
      onUpdate: () => {
        const t = progress.t;
        sprite.x = Phaser.Math.Linear(from.x, to.x, t);
        sprite.y = Phaser.Math.Linear(from.y, to.y, t) - Math.sin(t * Math.PI) * 12;
        sprite.setScale(CARD_SCALE * Phaser.Math.Linear(1, 0.5, t));
        sprite.setAlpha(t > 0.85 ? (1 - t) / 0.15 : 1);
      },
      onComplete: () => {
        sprite.destroy();
        revealStockGain(card.pile, 1);
      },
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
 * Soft vertical light shaft (white, tinted per card): brightest at the card's
 * foot, fading up into the air — a steady Diablo-style loot beam.
 */
function ensureBeamTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(BEAM_TEXTURE)) return;
  const w = 9;
  const h = 46;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  for (let y = 0; y < h; y++) {
    // y=0 is the top of the texture (up in the air), y=h-1 the bottom (the card).
    const down = (y + 1) / h; // 0 at top → 1 at the card
    const alpha = Math.pow(down, 1.5) * 0.95;
    const inset = Math.round((1 - down) * (w / 2 - 0.5));
    g.fillStyle(0xffffff, alpha);
    g.fillRect(inset, y, w - inset * 2, 1);
  }
  g.generateTexture(BEAM_TEXTURE, w, h);
  g.destroy();
}
