import Phaser from 'phaser';
import { gameState } from '../game/state/GameState';

/**
 * A small gold "€N" tag that floats above the booth showing un-collected sales
 * piling up ("they can pile up over there and you go to collect"). Hidden when
 * the cash box is empty. Re-anchored whenever the booth moves (venue switch).
 */
export class BoothCashBubble {
  private readonly scene: Phaser.Scene;
  private readonly unsubscribe: () => void;
  private text?: Phaser.GameObjects.Text;
  private anchor?: { x: number; y: number };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.unsubscribe = gameState.subscribe(() => this.refresh());
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());
  }

  /** Position the tag above the booth (top-of-sprite world coords). */
  setAnchor(x: number, y: number): void {
    this.anchor = { x, y };
    this.refresh();
  }

  private refresh(): void {
    const money = Math.round(gameState.snapshot().cashBox.money);
    if (!this.anchor || money <= 0) {
      this.text?.setVisible(false);
      return;
    }
    if (!this.text) {
      this.text = this.scene.add
        .text(0, 0, '', {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#3a2a10',
          backgroundColor: '#ffd34d',
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5, 1)
        .setDepth(99990);
    }
    this.text.setVisible(true).setPosition(this.anchor.x, this.anchor.y).setText(`€${money}`);
  }

  private destroy(): void {
    this.unsubscribe();
    this.text?.destroy();
    this.text = undefined;
  }
}
