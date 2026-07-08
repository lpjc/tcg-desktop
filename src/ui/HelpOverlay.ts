import { interaction } from '../core/interaction';
import './HelpOverlay.css';

const SEEN_KEY = 'tcg-desktop.help-seen';

/**
 * "How to play" panel: opens automatically on a player's first visit (tracked
 * in localStorage) and stays reachable afterwards through a persistent "?"
 * toolbar button under the collection button. Nothing here mutates game state —
 * it is pure onboarding chrome.
 */
export class HelpOverlay {
  private readonly root: HTMLDivElement;
  private readonly openButton: HTMLButtonElement;

  constructor(containerId: string) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    this.root = document.createElement('div');
    this.root.id = 'help-overlay';
    this.root.innerHTML = `
      <div class="help-overlay__panel">
        <h2 class="help-overlay__title">How to play</h2>
        <ul class="help-overlay__list">
          <li>Click the floor to <strong>walk</strong> around your convention booth and shop.</li>
          <li>Walk to the <strong>vending machine</strong> in the shop (right side) to buy card packs.</li>
          <li>Rip packs at the <strong>shop counter</strong> (or the pack button, top right) — new cards fill your binder and your booth stock.</li>
          <li>Guests buy cards from your <strong>booth stock</strong>. Return to the booth to collect the cash box — or stay and sell in person.</li>
          <li>Fill the <strong>collection binder</strong>. Rare pulls sell for more!</li>
        </ul>
        <button type="button" class="help-overlay__start">Let's go</button>
      </div>
    `;
    this.root.hidden = true;
    host.appendChild(this.root);

    this.openButton = document.createElement('button');
    this.openButton.id = 'help-btn';
    this.openButton.type = 'button';
    this.openButton.title = 'How to play';
    this.openButton.textContent = '?';
    host.appendChild(this.openButton);

    interaction.registerHotElement(this.root);
    interaction.registerHotElement(this.openButton);

    this.openButton.addEventListener('click', () => this.open());
    this.root
      .querySelector('.help-overlay__start')
      ?.addEventListener('click', () => this.close());
    // Clicking the scrim (outside the panel) also dismisses.
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) this.close();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.root.hidden) this.close();
    });

    if (!hasSeenHelp()) this.open();
  }

  private open(): void {
    this.root.hidden = false;
  }

  private close(): void {
    this.root.hidden = true;
    markHelpSeen();
  }
}

function hasSeenHelp(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === 'true';
  } catch {
    return true; // no storage — don't nag on every load
  }
}

function markHelpSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, 'true');
  } catch {
    /* ignore */
  }
}
