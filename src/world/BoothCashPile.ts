import Phaser from 'phaser';
import { gameState } from '../game/state/GameState';
import { depthFromFootY } from '../core/depth';
import { coinTextureKey } from './coins';

/** On-table pixel-coin size (smaller than the fly-to-bank burst coins). */
const PILE_COIN_SIZE = 7;

/**
 * Un-collected booth earnings shown as a physical pile of pixel coins growing on
 * the booth table — money literally stacks up until the player walks over to
 * collect (the exact amount is only revealed then, by the collect payout).
 *
 * The pile size is staged by cash-box value, not a 1:1 coin count:
 *   €1–49 · €50–199 · €200–499 · €500+
 * Coins only rebuild when the stage changes, so they don't jitter every sale.
 */
const STAGE_THRESHOLDS = [50, 200, 500];

/** Hand-placed coin offsets per stage (origin 0.5,1) — growing little pyramids. */
const STAGE_LAYOUTS: ReadonlyArray<ReadonlyArray<[number, number]>> = [
  [[0, 0]],
  [[-5, 0], [4, 1], [-1, -3]],
  [[-7, 0], [-1, 0], [5, 1], [-4, -3], [2, -3], [0, -6]],
  [[-9, 0], [-3, 0], [3, 0], [9, 1], [-6, -3], [0, -3], [6, -3], [-3, -6], [3, -6], [0, -9]],
];

export class BoothCashPile {
  private readonly scene: Phaser.Scene;
  private readonly unsubscribe: () => void;
  private coins: Phaser.GameObjects.Image[] = [];
  private anchor?: { x: number; y: number };
  /** Booth sprite foot Y — coins must out-depth the table from here, not their own Y. */
  private depthY = 0;
  private stage = -1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.unsubscribe = gameState.subscribe(() => this.refresh());
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());
  }

  /**
   * Position the pile on the booth table surface. `x, y` is where coins sit;
   * `depthY` is the booth sprite's foot Y so the pile sorts above the table.
   */
  setAnchor(x: number, y: number, depthY: number): void {
    this.anchor = { x, y };
    this.depthY = depthY;
    this.stage = -1; // force a rebuild at the new spot
    this.refresh();
  }

  /** World position of the coin pile centre (origin for the collect coin fly). */
  getWorldAnchor(): { x: number; y: number } | null {
    return this.anchor ? { x: this.anchor.x, y: this.anchor.y } : null;
  }

  private refresh(): void {
    const money = Math.round(gameState.snapshot().cashBox.money);
    const stage = stageForMoney(money);
    if (stage === this.stage) return;
    this.stage = stage;
    this.rebuild(stage);
  }

  private rebuild(stage: number): void {
    this.clearCoins();
    if (!this.anchor || stage <= 0) return;

    const layout = STAGE_LAYOUTS[stage - 1];
    // Depth from the booth's foot, +1, so coins always render on top of the table.
    const baseDepth = depthFromFootY(this.depthY) + 1;
    layout.forEach(([dx, dy], index) => {
      const coin = this.scene.add
        .image(this.anchor!.x + dx, this.anchor!.y + dy, coinTextureKey(1))
        .setOrigin(0.5, 1)
        .setDisplaySize(PILE_COIN_SIZE, PILE_COIN_SIZE)
        .setDepth(baseDepth + index * 0.01);
      // Tiny "drop in" pop on the newest coins.
      coin.setScale(coin.scaleX * 0.4);
      this.scene.tweens.add({
        targets: coin,
        scaleX: PILE_COIN_SIZE / coin.width,
        scaleY: PILE_COIN_SIZE / coin.height,
        duration: 160,
        ease: 'Back.easeOut',
      });
      this.coins.push(coin);
    });
  }

  private clearCoins(): void {
    for (const coin of this.coins) coin.destroy();
    this.coins = [];
  }

  private destroy(): void {
    this.unsubscribe();
    this.clearCoins();
  }
}

function stageForMoney(money: number): number {
  if (money <= 0) return 0;
  let stage = 1;
  for (const threshold of STAGE_THRESHOLDS) {
    if (money >= threshold) stage += 1;
  }
  return stage;
}
