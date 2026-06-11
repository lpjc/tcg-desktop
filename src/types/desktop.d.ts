export interface DesktopBridge {
  setInteractive: (interactive: boolean) => void;
  moveWindow: (dx: number, dy: number) => void;
  switchMonitor: () => Promise<boolean>;
  saveLayout: (name: string, data: string) => Promise<boolean>;
  loadLayout: (name: string) => Promise<string | null>;
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
