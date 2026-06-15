import { MoneyPill } from './MoneyPill';
import { StockBar } from './StockBar';
import './BottomHud.css';

/**
 * The persistent bottom-centre resource row: the money pill next to the stock
 * bar. Both are display-only currencies, so the row is click-through.
 */
export class BottomHud {
  constructor(containerId: string) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    const row = document.createElement('div');
    row.id = 'bottom-hud';
    host.appendChild(row);

    new MoneyPill('bottom-hud');
    new StockBar('bottom-hud');
  }
}
