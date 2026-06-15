import { gameState } from '../game/state/GameState';
import './MoneyPill.css';

/**
 * Always-visible bank balance, just above the world band (the chunky "money
 * pill" from the inspirational references). Pulses when the balance rises.
 */
export class MoneyPill {
  private readonly el: HTMLDivElement;
  private readonly amountEl: HTMLSpanElement;
  private lastMoney = 0;

  constructor(containerId: string) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    this.el = document.createElement('div');
    this.el.id = 'money-pill';

    const coin = document.createElement('span');
    coin.className = 'money-pill__coin';
    coin.textContent = '€';

    this.amountEl = document.createElement('span');
    this.amountEl.className = 'money-pill__amount';

    this.el.append(coin, this.amountEl);
    host.appendChild(this.el);

    gameState.subscribe((data) => this.render(data.money));
  }

  showGain(amount: number): void {
    const pop = document.createElement('span');
    pop.className = 'money-pill__gain';
    pop.textContent = `+€${Math.round(amount).toLocaleString('en-US')}`;
    this.el.appendChild(pop);
    void pop
      .animate(
        [
          { transform: 'translateY(0)', opacity: '1' },
          { transform: 'translateY(-14px)', opacity: '0' },
        ],
        { duration: 900, easing: 'ease-out', fill: 'forwards' },
      )
      .finished.then(() => pop.remove())
      .catch(() => pop.remove());
  }

  getCenter(): { x: number; y: number } {
    const rect = this.el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  private render(money: number): void {
    this.amountEl.textContent = formatMoney(money);
    if (money > this.lastMoney) {
      this.el.classList.remove('money-pill--pulse');
      // Force reflow so re-adding the class restarts the animation.
      void this.el.offsetWidth;
      this.el.classList.add('money-pill--pulse');
    }
    this.lastMoney = money;
  }
}

function formatMoney(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}
