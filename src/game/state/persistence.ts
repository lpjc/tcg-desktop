import type { GameStateData } from './types';

/**
 * Save/load the game-state blob. In Electron it goes to userData via the desktop
 * bridge; in plain-browser dev it falls back to localStorage so the loop still
 * persists across reloads.
 */
const STATE_KEY = 'tcg-desktop.game-state';

export async function loadGameStateData(): Promise<Partial<GameStateData> | null> {
  if (window.desktop?.loadGameState) {
    try {
      const raw = await window.desktop.loadGameState();
      return raw ? (JSON.parse(raw) as Partial<GameStateData>) : null;
    } catch {
      return null;
    }
  }
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as Partial<GameStateData>) : null;
  } catch {
    return null;
  }
}

export async function saveGameStateData(data: GameStateData): Promise<void> {
  const json = JSON.stringify(data);
  if (window.desktop?.saveGameState) {
    try {
      await window.desktop.saveGameState(json);
    } catch {
      /* ignore — a failed save is non-fatal */
    }
    return;
  }
  try {
    localStorage.setItem(STATE_KEY, json);
  } catch {
    /* ignore */
  }
}
