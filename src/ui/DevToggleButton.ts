import { interaction } from '../core/interaction';
import { devUi } from './devUi';
import { enablePanelDragWithClickThreshold } from './draggablePanel';
import './DevToggleButton.css';

/**
 * Always-visible control that shows or hides developer overlay chrome so you
 * can preview the player-facing view. The game canvas stays visible either way.
 */
export class DevToggleButton {
  private readonly el: HTMLButtonElement;

  constructor(containerId: string) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    this.el = document.createElement('button');
    this.el.id = 'dev-toggle-btn';
    this.el.type = 'button';
    this.el.title = 'Toggle developer overlay (F3)';
    host.appendChild(this.el);

    interaction.registerHotElement(this.el);
    enablePanelDragWithClickThreshold(this.el, this.el, {
      storageKey: 'tcg-desktop.dev-toggle-pos',
      width: 72,
      minVisibleHeight: 20,
      onClick: () => devUi.toggle(),
    });
    devUi.subscribe((visible) => this.syncLabel(visible));

    window.addEventListener('keydown', (event) => {
      if (event.code !== 'F3') return;
      event.preventDefault();
      devUi.toggle();
    });
  }

  private syncLabel(visible: boolean): void {
    this.el.classList.toggle('active', visible);
    this.el.textContent = visible ? 'DEV ON' : 'DEV';
  }
}
