import Phaser from 'phaser';
import { emoteForPile, showEmoteHeld } from '../characters/emotes';
import type { Npc } from '../characters/Npc';
import type { SaleResult } from '../game/economy/BoothEconomy';
import { flyCoins } from '../ui/flyFx';
import {
  flyStockCardTo,
  moneyPillCenter,
  showMoneyGain,
  suppressStockFly,
} from '../ui/saleFxBridge';
import { buyerCardTarget, buyerCoinOrigin, worldToScreen } from './hudCoords';

const POST_SALE_BEAT_MS = 500;

function delay(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => scene.time.delayedCall(ms, resolve));
}

/** Brief highlight + hop so the buyer reads as the active party. */
function popBuyer(npc: Npc): Promise<void> {
  const scene = npc.scene;
  if (!scene) return Promise.resolve();

  return new Promise((resolve) => {
    const baseY = npc.y;
    npc.setTint(0xfff0b8);
    scene.tweens.add({
      targets: npc,
      y: baseY - 5,
      duration: 110,
      ease: 'Quad.easeOut',
      yoyo: true,
      onComplete: () => {
        npc.clearTint();
        resolve();
      },
    });
  });
}

function coinCountForPrice(price: number): number {
  if (price < 5) return 2;
  if (price < 25) return 3;
  if (price < 100) return 4;
  return 5;
}

/**
 * Full purchase beat: emote → buyer pop → (coins to money pill when manned) →
 * card from stock HUD into the buyer → short beat → caller lets the NPC leave.
 */
export async function playPurchaseSale(
  scene: Phaser.Scene,
  npc: Npc,
  sale: SaleResult,
  opts: {
    playerAtBooth: boolean;
    commitStock: (pile: typeof sale.pile) => boolean;
    commitPayment: (sale: SaleResult, directToBank: boolean) => void;
  },
): Promise<void> {
  await showEmoteHeld(scene, npc.x, npc.y - 22, emoteForPile(sale.pile), 1000);
  await popBuyer(npc);

  const cardTarget = buyerCardTarget(scene, npc.x, npc.y);

  if (opts.playerAtBooth) {
    const pill = moneyPillCenter();
    if (pill) {
      const coinFrom = buyerCoinOrigin(scene, npc.x, npc.y);
      await flyCoins(coinFrom, pill, coinCountForPrice(sale.price), () => {
        opts.commitPayment(sale, true);
        showMoneyGain(sale.price);
        // TODO(awaiting-stat-system): float +Rep when a reputation HUD exists.
      });
    } else {
      opts.commitPayment(sale, true);
    }
  }

  suppressStockFly(sale.pile);
  if (!opts.commitStock(sale.pile)) return;

  await flyStockCardTo(sale.pile, cardTarget);

  if (!opts.playerAtBooth) {
    opts.commitPayment(sale, false);
  }

  await delay(scene, POST_SALE_BEAT_MS);
}

/**
 * Booth collect: coins lift off the table pile and fly into the money pill.
 * Bank balance updates when the first coin arrives.
 */
export async function playBoothCollect(
  scene: Phaser.Scene,
  tableWorld: { x: number; y: number },
  totalMoney: number,
  onCollected: () => void,
): Promise<void> {
  const pill = moneyPillCenter();
  if (!pill || totalMoney <= 0) {
    onCollected();
    return;
  }

  const from = worldToScreen(scene, tableWorld.x, tableWorld.y - 6);
  await flyCoins(from, pill, coinCountForPrice(totalMoney), () => {
    onCollected();
    showMoneyGain(totalMoney);
    // TODO(awaiting-stat-system): surface accumulated booth reputation on collect.
  });
}
