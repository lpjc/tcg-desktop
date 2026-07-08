import { audio } from '../audio/audio';
import { interaction } from '../core/interaction';
import './MusicToggleButton.css';

/**
 * Player-facing music on/off toggle in the right-edge toolbar (under the "?"
 * button). Shows a note glyph; struck through while muted. The preference
 * persists via the audio manager (localStorage).
 */
export class MusicToggleButton {
  private readonly el: HTMLButtonElement;

  constructor(containerId: string) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    this.el = document.createElement('button');
    this.el.id = 'music-toggle-btn';
    this.el.type = 'button';
    this.el.textContent = '\u266A';
    host.appendChild(this.el);

    interaction.registerHotElement(this.el);
    this.el.addEventListener('click', () => audio.toggleMusic());
    audio.onMusicChange((enabled) => {
      this.el.classList.toggle('is-muted', !enabled);
      this.el.title = enabled ? 'Music: on' : 'Music: off';
    });
  }
}
