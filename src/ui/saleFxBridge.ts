import type { PileId } from '../game/cards/piles';
import type { FlyPoint } from './flyFx';

interface SaleFxHandlers {
  suppressStockFly: (pile: PileId) => void;
  flyStockCard: (pile: PileId, target: FlyPoint) => Promise<void>;
  moneyPillCenter: () => FlyPoint | null;
  showMoneyGain: (amount: number) => void;
}

let handlers: SaleFxHandlers | null = null;

export function registerSaleFx(next: SaleFxHandlers): void {
  handlers = next;
}

export function suppressStockFly(pile: PileId): void {
  handlers?.suppressStockFly(pile);
}

export function flyStockCardTo(pile: PileId, target: FlyPoint): Promise<void> {
  if (!handlers) return Promise.resolve();
  return handlers.flyStockCard(pile, target);
}

export function moneyPillCenter(): FlyPoint | null {
  return handlers?.moneyPillCenter() ?? null;
}

export function showMoneyGain(amount: number): void {
  handlers?.showMoneyGain(amount);
}
