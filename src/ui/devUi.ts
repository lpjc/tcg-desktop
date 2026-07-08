const STORAGE_KEY = 'tcg-desktop.dev-ui';

type DevUiListener = (visible: boolean) => void;

/**
 * Whether developer overlay chrome (HUD, palette, monitor switch) is shown.
 * Off by default so players never see dev tools — F3 opts in, and the choice
 * persists for the session's browser/profile.
 */
let visible = readStored();

const listeners = new Set<DevUiListener>();

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
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
