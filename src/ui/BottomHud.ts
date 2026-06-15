import { MoneyPill } from './MoneyPill';
import { StockBar } from './StockBar';
import { registerSaleFx } from './saleFxBridge';
import './BottomHud.css';

/**
 * The persistent resource row just above the world band (bottom-left): the money
 * pill next to the stock bar. Both are display-only currencies, so the row is
 * click-through.
 */
export class BottomHud {
  constructor(containerId: string) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    const row = document.createElement('div');
    row.id = 'bottom-hud';
    host.appendChild(row);

    const moneyPill = new MoneyPill('bottom-hud');
    const stockBar = new StockBar('bottom-hud');

    registerSaleFx({
      suppressStockFly: (pile) => stockBar.suppressSaleFly(pile),
      flyStockCard: (pile, target) => stockBar.flyCardToTarget(pile, target),
      moneyPillCenter: () => moneyPill.getCenter(),
      showMoneyGain: (amount) => moneyPill.showGain(amount),
    });
  }
}
