import { gameState } from '../game/state/GameState';
import { registerMoneyFx } from './saleFxBridge';
import type { FlyPoint } from './flyFx';
import './MoneyPill.css';

/**
 * If a held gain is never revealed (e.g. the coin animation was interrupted by a
 * scene shutdown), snap the number to the truth after this long so the display
 * can never get stuck behind the real balance. Comfortably outlasts the savoured
 * purchase beat (coins land ~3.6s after the sale commits — see purchaseFx.ts).
 */
const REVEAL_SELF_HEAL_MS = 6000;

/**
 * Always-visible bank balance, just above the world band (the chunky "money
 * pill" from the inspirational references).
 *
 * The shown number is decoupled from the live balance: when a sale/collect banks
 * money while coins are flying in, we *hold* the increase and only reveal it
 * (tick the number + "+€X" pop) when `revealGain` is called as the coins land.
 * Game state stays the single source of truth — `displayed` always converges to
 * `actual`, and a self-heal timer guarantees it even if a reveal never arrives.
 */
export class MoneyPill {
  private readonly el: HTMLDivElement;
  private readonly amountEl: HTMLSpanElement;
  /** Real banked balance (game-state truth). */
  private actual = 0;
  /** Currently shown balance (may briefly lag `actual` during a coin fly). */
  private displayed = 0;
  private initialized = false;
  /** True while a banked gain is being held back for an incoming coin fly. */
  private expecting = false;
  private healTimer?: number;

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

    registerMoneyFx({
      center: () => this.center(),
      expectGain: () => this.expectGain(),
      revealGain: () => this.revealGain(),
    });
    gameState.subscribe((data) => this.onState(data.money));
  }

  private onState(money: number): void {
    this.actual = money;

    // First emit (and any decrease) snaps silently — no fly to wait on.
    if (!this.initialized || money <= this.displayed) {
      this.initialized = true;
      this.displayed = money;
      this.renderAmount();
      return;
    }

    // An increase we were told to expect is held back for the coin arrival.
    if (this.expecting) return;

    // An increase nobody is animating (e.g. loaded save): show it right away.
    this.displayed = money;
    this.renderAmount();
    this.pulse();
  }

  /** Hold the next banked increase so it reveals when its coins land. */
  private expectGain(): void {
    this.expecting = true;
    if (this.healTimer !== undefined) window.clearTimeout(this.healTimer);
    this.healTimer = window.setTimeout(() => this.revealGain(), REVEAL_SELF_HEAL_MS);
  }

  /** Coins landed (or self-heal fired): catch the number up and pop "+€X". */
  private revealGain(): void {
    if (this.healTimer !== undefined) {
      window.clearTimeout(this.healTimer);
      this.healTimer = undefined;
    }
    this.expecting = false;

    const gain = this.actual - this.displayed;
    this.displayed = this.actual;
    this.renderAmount();
    if (gain > 0) {
      this.pulse();
      this.showGain(gain);
    }
  }

  /** Viewport-pixel centre of the pill — the target for flying coins. */
  private center(): FlyPoint {
    const rect = this.el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  private renderAmount(): void {
    this.amountEl.textContent = formatMoney(this.displayed);
  }

  private pulse(): void {
    this.el.classList.remove('money-pill--pulse');
    void this.el.offsetWidth; // restart the animation
    this.el.classList.add('money-pill--pulse');
  }

  /** A small "+€X" that rises off the pill when coins hit — holds readable, then fades. */
  private showGain(amount: number): void {
    const gain = document.createElement('div');
    gain.className = 'money-gain';
    gain.textContent = `+€${Math.round(amount)}`;
    this.el.appendChild(gain);
    gain
      .animate(
        [
          { transform: 'translate(-50%, 0)', opacity: 1 },
          { transform: 'translate(-50%, -6px)', opacity: 1, offset: 0.7 },
          { transform: 'translate(-50%, -16px)', opacity: 0 },
        ],
        { duration: 1650, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
      )
      .finished.then(() => gain.remove())
      .catch(() => gain.remove());
  }
}

function formatMoney(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}
