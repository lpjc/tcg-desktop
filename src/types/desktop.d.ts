export interface DesktopBridge {
  setInteractive: (interactive: boolean) => void;
  moveWindow: (dx: number, dy: number) => void;
  switchMonitor: () => Promise<boolean>;
  saveLayout: (name: string, data: string) => Promise<boolean>;
  loadLayout: (name: string) => Promise<string | null>;
  /** Persist the player's game-state JSON blob to userData. */
  saveGameState: (data: string) => Promise<boolean>;
  /** Read the player's game-state JSON blob (null when none saved yet). */
  loadGameState: () => Promise<string | null>;
  onTogglePlaceMode: (callback: () => void) => () => void;
  /** System-wide left/right mouse-down events (even outside the overlay). */
  onGlobalClick: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

export {};
