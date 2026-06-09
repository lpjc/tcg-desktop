import { interaction } from '../core/interaction';
import './MonitorSwitchButton.css';

/**
 * Cycles the overlay window to the next connected monitor.
 * Only shown when running inside Electron (window.desktop is available).
 */
export class MonitorSwitchButton {
  private el: HTMLButtonElement;

  constructor(containerId: string) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    this.el = document.createElement('button');
    this.el.id = 'switch-monitor-btn';
    this.el.type = 'button';
    this.el.textContent = 'SWITCH MONITOR';
    this.el.title = 'Move overlay to the next monitor';
    host.appendChild(this.el);

    interaction.registerHotElement(this.el);
    this.el.addEventListener('click', () => void this.onClick());
  }

  private async onClick(): Promise<void> {
    if (!window.desktop) return;
    this.el.disabled = true;
    try {
      await window.desktop.switchMonitor();
    } finally {
      this.el.disabled = false;
    }
  }
}
