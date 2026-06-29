import { interaction } from '../../core/interaction';
import { gameState } from '../../game/state/GameState';
import type { PackOpenScreen } from './PackOpenScreen';
import './PackOpenButton.css';

/**
 * The toolbar button that opens the pack-opening overlay, sitting just above the
 * collection button. A badge shows the total number of unopened packs (hidden at
 * zero); the button always opens the overlay (it doubles as a set-progress
 * viewer even with no packs waiting). Lights up green while the overlay is open.
 */
export class PackOpenButton {
  private readonly el: HTMLButtonElement;
  private readonly badge: HTMLSpanElement;

  constructor(containerId: string, screen: PackOpenScreen) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    this.el = document.createElement('button');
    this.el.id = 'pack-open-btn';
    this.el.type = 'button';
    this.el.title = 'Open packs';

    const glyph = document.createElement('span');
    glyph.className = 'pack-open-btn__glyph';

    this.badge = document.createElement('span');
    this.badge.className = 'pack-open-btn__badge';

    this.el.append(glyph, this.badge);
    host.appendChild(this.el);

    interaction.registerHotElement(this.el);
    this.el.addEventListener('click', () => screen.toggle());
    screen.onOpenChange((open) => this.el.classList.toggle('active', open));

    gameState.subscribe((data) => this.renderBadge(data.pendingPacks.length));
    this.renderBadge(gameState.snapshot().pendingPacks.length);
  }

  private renderBadge(count: number): void {
    this.badge.textContent = count > 99 ? '99+' : String(count);
    this.badge.classList.toggle('is-hidden', count <= 0);
  }
}
