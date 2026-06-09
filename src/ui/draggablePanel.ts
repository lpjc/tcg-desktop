export interface DraggablePanelOptions {
  /** localStorage key for { left, top }. */
  storageKey: string;
  /** Panel width used to clamp horizontal movement. */
  width?: number;
  /** Minimum visible height kept on screen. */
  minVisibleHeight?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function restorePanelPosition(panel: HTMLElement, storageKey: string): void {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const { left, top } = JSON.parse(raw) as { left: number; top: number };
    if (!Number.isFinite(left) || !Number.isFinite(top)) return;
    panel.style.position = 'fixed';
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  } catch {
    /* ignore corrupt saved position */
  }
}

function savePanelPosition(panel: HTMLElement, storageKey: string): void {
  const rect = panel.getBoundingClientRect();
  localStorage.setItem(
    storageKey,
    JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }),
  );
}

/**
 * Drag a fixed panel by a handle. Saves position to localStorage on release.
 */
export function enablePanelDrag(
  panel: HTMLElement,
  handle: HTMLElement,
  options: DraggablePanelOptions,
): void {
  const width = options.width ?? panel.getBoundingClientRect().width;
  const minVisible = options.minVisibleHeight ?? 24;

  restorePanelPosition(panel, options.storageKey);

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    dragging = true;
    panel.style.position = 'fixed';
    const rect = panel.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    handle.setPointerCapture(event.pointerId);
    handle.classList.add('dragging');
    event.preventDefault();
  });

  handle.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const maxLeft = Math.max(0, window.innerWidth - width - 4);
    const maxTop = Math.max(0, window.innerHeight - minVisible);
    const left = clamp(event.clientX - offsetX, 0, maxLeft);
    const top = clamp(event.clientY - offsetY, 0, maxTop);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  });

  const endDrag = (event: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    handle.releasePointerCapture(event.pointerId);
    savePanelPosition(panel, options.storageKey);
  };

  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
}

/**
 * Drag a panel by its handle, but ignore tiny movement so clicks still fire.
 */
export function enablePanelDragWithClickThreshold(
  panel: HTMLElement,
  handle: HTMLElement,
  options: DraggablePanelOptions & { clickThreshold?: number; onClick?: () => void },
): void {
  const threshold = options.clickThreshold ?? 5;
  const width = options.width ?? panel.getBoundingClientRect().width;
  const minVisible = options.minVisibleHeight ?? 24;

  restorePanelPosition(panel, options.storageKey);

  let dragging = false;
  let moved = false;
  let offsetX = 0;
  let offsetY = 0;
  let startX = 0;
  let startY = 0;

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    dragging = true;
    moved = false;
    startX = event.clientX;
    startY = event.clientY;
    panel.style.position = 'fixed';
    const rect = panel.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  handle.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    if (!moved) {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.hypot(dx, dy) < threshold) return;
      moved = true;
      handle.classList.add('dragging');
    }
    const maxLeft = Math.max(0, window.innerWidth - width - 4);
    const maxTop = Math.max(0, window.innerHeight - minVisible);
    const left = clamp(event.clientX - offsetX, 0, maxLeft);
    const top = clamp(event.clientY - offsetY, 0, maxTop);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  });

  const endDrag = (event: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    handle.releasePointerCapture(event.pointerId);
    if (moved) {
      savePanelPosition(panel, options.storageKey);
    } else {
      options.onClick?.();
    }
  };

  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
}
