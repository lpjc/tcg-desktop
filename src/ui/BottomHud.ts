import { MoneyPill } from './MoneyPill';
import { StockBar } from './StockBar';
import './BottomHud.css';

/**
 * The persistent resource row just above the world band (bottom-left): the money
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
