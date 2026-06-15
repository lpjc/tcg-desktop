import { interaction } from '../../core/interaction';
import type { CollectionScreen } from './CollectionScreen';
import './CollectionButton.css';

/**
 * The persistent, player-facing button that opens the Collection binder — the
 * first occupant of the right-edge toy toolbar from the reference UI. Always
 * visible (it is not dev chrome) and lights up green while the binder is open
 * ("you're here"). Registered as a hot element so it stays clickable through the
 * otherwise click-through overlay window.
 */
export class CollectionButton {
  private readonly el: HTMLButtonElement;

  constructor(containerId: string, screen: CollectionScreen) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    this.el = document.createElement('button');
    this.el.id = 'collection-btn';
    this.el.type = 'button';
    this.el.title = 'Collection binder';

    const icon = document.createElement('img');
    icon.src = '/icons/collection.png';
    icon.alt = 'Collection';
    icon.draggable = false;
    this.el.appendChild(icon);

    host.appendChild(this.el);

    interaction.registerHotElement(this.el);
    this.el.addEventListener('click', () => screen.toggle());
    screen.onOpenChange((open) => this.el.classList.toggle('active', open));
  }
}
