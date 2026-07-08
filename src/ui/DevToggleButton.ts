import { interaction } from '../core/interaction';
import { devUi } from './devUi';
import { enablePanelDragWithClickThreshold } from './draggablePanel';
import './DevToggleButton.css';

/**
 * Control that hides developer overlay chrome again once it is on. Hidden while
 * the dev UI is off so players never see it — F3 is the (undocumented) way in.
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
    this.el.style.display = visible ? '' : 'none';
    this.el.classList.toggle('active', visible);
    this.el.textContent = visible ? 'DEV ON' : 'DEV';
  }
}
