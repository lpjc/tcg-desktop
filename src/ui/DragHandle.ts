import { interaction } from '../core/interaction';

/**
 * A small always-visible grip that lets the user move the overlay window.
 *
 * Because the window is normally click-through, we rely on the InteractionManager
 * to make the window interactive while the cursor is over this handle. During an
 * active drag we use pointer capture + a drag lock so the move keeps working even
 * if the cursor briefly leaves the grip.
 */
export class DragHandle {
  private el: HTMLElement;
  private dragging = false;
  private last = { x: 0, y: 0 };

  constructor(containerId: string) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    this.el = document.createElement('div');
    this.el.id = 'drag-handle';
    this.el.title = 'Drag to move the window';
    this.el.innerHTML = '<span class="grip-dots"></span>';
    host.appendChild(this.el);

    interaction.registerHotElement(this.el);
    this.injectStyles();
    this.bindEvents();
  }

  private bindEvents(): void {
    this.el.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.last = { x: e.screenX, y: e.screenY };
      this.el.setPointerCapture(e.pointerId);
      interaction.setDragLock(true);
      this.el.classList.add('dragging');
      e.preventDefault();
    });

    this.el.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.screenX - this.last.x;
      const dy = e.screenY - this.last.y;
      this.last = { x: e.screenX, y: e.screenY };
      if (dx !== 0 || dy !== 0) {
        window.desktop?.moveWindow(dx, dy);
      }
    });

    const end = (e: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      try {
        this.el.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
      interaction.setDragLock(false);
      this.el.classList.remove('dragging');
    };
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
  }

  private injectStyles(): void {
    if (document.getElementById('drag-handle-styles')) return;
    const style = document.createElement('style');
    style.id = 'drag-handle-styles';
    style.textContent = `
      #drag-handle {
        position: absolute;
        top: 6px;
        left: 50%;
        transform: translateX(-50%);
        width: 64px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 9px;
        background: rgba(12, 14, 20, 0.55);
        border: 1px solid rgba(255,255,255,0.18);
        pointer-events: auto;
        cursor: grab;
        z-index: 1200;
      }
      #drag-handle:hover { background: rgba(12, 14, 20, 0.8); }
      #drag-handle.dragging { cursor: grabbing; }
      #drag-handle .grip-dots {
        width: 28px;
        height: 6px;
        background-image: radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px);
        background-size: 6px 6px;
        background-position: center;
      }
    `;
    document.head.appendChild(style);
  }
}
