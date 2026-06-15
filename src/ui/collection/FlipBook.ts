import './FlipBook.css';

export type FlipDirection = 'forward' | 'backward';

/** The two cream page elements that make up one visible spread. */
export interface Spread {
  left: HTMLElement;
  right: HTMLElement;
}

/**
 * An open two-page book. Shows one spread at a time and turns a leaf around the
 * centre spine with a CSS 3D rotation (perspective on the container, a temporary
 * leaf carrying real page elements as its faces). No drag — turns are driven by
 * the binder's arrows/tabs.
 *
 * The page elements are reparented (never cloned), so their pockets keep their
 * identity and live-update bindings across a turn.
 */
export class FlipBook {
  readonly el: HTMLDivElement;
  private readonly slotLeft: HTMLDivElement;
  private readonly slotRight: HTMLDivElement;
  private cur: Spread | null = null;
  private busy = false;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'flipbook';

    this.slotLeft = document.createElement('div');
    this.slotLeft.className = 'flipbook__slot flipbook__slot--left';
    const spine = document.createElement('div');
    spine.className = 'flipbook__spine';
    this.slotRight = document.createElement('div');
    this.slotRight.className = 'flipbook__slot flipbook__slot--right';

    this.el.append(this.slotLeft, spine, this.slotRight);
  }

  get flipping(): boolean {
    return this.busy;
  }

  /** Place a spread immediately (no animation). */
  setSpread(spread: Spread): void {
    this.cur = spread;
    this.slotLeft.replaceChildren(spread.left);
    this.slotRight.replaceChildren(spread.right);
  }

  /** Turn one leaf to reveal `next`. Resolves when the animation completes. */
  async flip(direction: FlipDirection, next: Spread, durationMs = 520): Promise<void> {
    if (this.busy || !this.cur) {
      this.setSpread(next);
      return;
    }
    this.busy = true;
    try {
      if (direction === 'forward') {
        await this.turn(this.cur.right, next.left, next.right, 'forward', durationMs);
      } else {
        await this.turn(this.cur.left, next.right, next.left, 'backward', durationMs);
      }
      this.cur = next;
    } finally {
      this.busy = false;
    }
  }

  /**
   * Run one leaf turn.
   * - forward: the leaf is the current RIGHT page (front) flipping over the spine
   *   to become the next LEFT page (back); the next RIGHT page is revealed beneath.
   * - backward: the mirror — current LEFT page flips to next RIGHT page; next LEFT
   *   is revealed beneath.
   */
  private async turn(
    frontPage: HTMLElement,
    backPage: HTMLElement,
    revealPage: HTMLElement,
    direction: FlipDirection,
    durationMs: number,
  ): Promise<void> {
    const forward = direction === 'forward';
    const revealSlot = forward ? this.slotRight : this.slotLeft;
    const settleSlot = forward ? this.slotLeft : this.slotRight;
    const overSlot = forward ? this.slotRight : this.slotLeft;

    // Reveal the incoming page beneath where the leaf will lift from.
    revealSlot.replaceChildren(revealPage);

    const leaf = document.createElement('div');
    leaf.className = `flipbook__leaf flipbook__leaf--${direction}`;
    const front = document.createElement('div');
    front.className = 'flipbook__face flipbook__face--front';
    front.appendChild(frontPage);
    const back = document.createElement('div');
    back.className = 'flipbook__face flipbook__face--back';
    back.appendChild(backPage);
    leaf.append(front, back);

    // Match the leaf to the slot it lifts from.
    const elRect = this.el.getBoundingClientRect();
    const slotRect = overSlot.getBoundingClientRect();
    leaf.style.left = `${slotRect.left - elRect.left}px`;
    leaf.style.top = `${slotRect.top - elRect.top}px`;
    leaf.style.width = `${slotRect.width}px`;
    leaf.style.height = `${slotRect.height}px`;
    leaf.style.transformOrigin = forward ? 'left center' : 'right center';
    this.el.appendChild(leaf);

    const from = 'rotateY(0deg)';
    const to = forward ? 'rotateY(-180deg)' : 'rotateY(180deg)';
    const anim = leaf.animate(
      [{ transform: from }, { transform: to }],
      { duration: durationMs, easing: 'cubic-bezier(0.4, 0.05, 0.25, 1)', fill: 'forwards' },
    );
    await anim.finished.catch(() => undefined);

    // Settle: the leaf's back page lands in the opposite slot.
    settleSlot.replaceChildren(backPage);
    leaf.remove();
  }
}
