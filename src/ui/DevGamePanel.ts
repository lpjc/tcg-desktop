import { allSets } from '../game/cards/cards';
import type { PileId } from '../game/cards/piles';
import { rarityCanHolo } from '../game/cards/rarity';
import { getCard } from '../game/cards/cards';
import { gameState } from '../game/state/GameState';
import { interaction } from '../core/interaction';
import { devUi } from './devUi';
import './DevGamePanel.css';

/** A "pack-ish" spread of stock to seed the convention loop with variety. */
const STOCK_BUNDLE: Record<PileId, number> = {
  common: 20,
  rare: 8,
  epic: 3,
  chase: 1,
  rareHolo: 4,
  epicHolo: 2,
  chaseHolo: 1,
};

/**
 * Developer-only seed controls (visible with the dev overlay, F3). Lets us drive
 * the economy before the shop exists: grant stock/money, discover the placeholder
 * set, or wipe the save.
 */
export class DevGamePanel {
  private readonly el: HTMLDivElement;

  constructor(containerId: string) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    this.el = document.createElement('div');
    this.el.id = 'dev-game-panel';
    this.el.append(
      this.button('+ Stock', () => this.grantStock()),
      this.button('+ €1000', () => gameState.addMoney(1000)),
      this.button('Discover set', () => this.discoverSets()),
      this.button('Reset save', () => gameState.reset()),
    );
    host.appendChild(this.el);

    interaction.registerHotElement(this.el);
    devUi.subscribe((visible) => {
      this.el.style.display = visible ? '' : 'none';
    });
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dev-game-panel__btn';
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    interaction.registerHotElement(btn);
    return btn;
  }

  private grantStock(): void {
    for (const [pile, count] of Object.entries(STOCK_BUNDLE)) {
      gameState.grantStock(pile as PileId, count);
    }
  }

  private discoverSets(): void {
    for (const set of allSets()) {
      gameState.unlockSet(set.id);
      for (const cardId of set.cardIds) {
        const card = getCard(cardId);
        const holo = card ? rarityCanHolo(card.rarity) && Math.random() < 0.3 : false;
        gameState.discoverCard(cardId, holo);
      }
    }
  }
}
