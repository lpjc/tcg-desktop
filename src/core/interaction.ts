import { setWindowInteractive } from './clickthrough';

/**
 * Decides, on every mouse move, whether the overlay window should accept mouse
 * input or stay click-through (so the desktop underneath stays usable).
 *
 * The window is interactive when ANY of these is true:
 *  - edit mode is on (whole band is editable),
 *  - a drag is in progress (must not drop interactivity mid-drag),
 *  - the cursor is over a registered "hot" HTML panel (palette, drag handle),
 *  - the cursor is over drawn world content (floors, road, stations) — see the
 *    world hit test registered by WorldScene.
 *
 * This is the single place that drives `setWindowInteractive`, so the
 * click-through behaviour is easy to reason about for the next developer.
 */
class InteractionManager {
  private editMode = false;
  private dragLock = false;
  private hotElements: HTMLElement[] = [];
  private worldHitTest: (clientX: number, clientY: number) => boolean = () => false;

  start(): void {
    const onMove = (e: { clientX: number; clientY: number }) =>
      this.recompute(e.clientX, e.clientY);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('pointermove', onMove);
    this.recompute(-1, -1);
  }

  setEditMode(active: boolean): void {
    this.editMode = active;
    if (active) {
      setWindowInteractive(true);
    } else {
      this.recompute(-1, -1);
    }
  }

  setDragLock(locked: boolean): void {
    this.dragLock = locked;
    if (locked) setWindowInteractive(true);
  }

  registerHotElement(el: HTMLElement): void {
    if (this.hotElements.includes(el)) return;
    this.hotElements.push(el);
    // Eagerly grab interactivity on entry so the first click isn't lost while
    // click-through is still forwarding events to the desktop.
    const activate = () => setWindowInteractive(true);
    el.addEventListener('pointerenter', activate);
    el.addEventListener('mouseenter', activate);
  }

  /** Hit test for drawn world content (floors, road, stations) in client coords. */
  setWorldHitTest(fn: (clientX: number, clientY: number) => boolean): void {
    this.worldHitTest = fn;
  }

  private recompute(clientX: number, clientY: number): void {
    if (this.editMode || this.dragLock) {
      setWindowInteractive(true);
      return;
    }
    const overHot = this.hotElements.some((el) => isOverElement(el, clientX, clientY));
    const overWorld = clientX >= 0 && this.worldHitTest(clientX, clientY);
    setWindowInteractive(overHot || overWorld);
  }
}

function isOverElement(el: HTMLElement, x: number, y: number): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

export const interaction = new InteractionManager();
