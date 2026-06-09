const STORAGE_KEY = 'tcg-desktop.dev-ui';

type DevUiListener = (visible: boolean) => void;

/** Whether developer overlay chrome (HUD, palette, monitor switch) is shown. */
let visible = readStored();

const listeners = new Set<DevUiListener>();

function readStored(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'false') return false;
  } catch {
    /* ignore */
  }
  return true;
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(visible));
  } catch {
    /* ignore */
  }
}

export const devUi = {
  isVisible(): boolean {
    return visible;
  },

  toggle(): void {
    devUi.setVisible(!visible);
  },

  setVisible(next: boolean): void {
    if (visible === next) return;
    visible = next;
    persist();
    for (const listener of listeners) listener(visible);
  },

  subscribe(listener: DevUiListener): () => void {
    listeners.add(listener);
    listener(visible);
    return () => listeners.delete(listener);
  },
};
