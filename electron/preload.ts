import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktop', {
  setInteractive: (interactive: boolean) => {
    ipcRenderer.send('set-interactive', interactive);
  },
  moveWindow: (dx: number, dy: number) => {
    ipcRenderer.send('move-window', dx, dy);
  },
  switchMonitor: () => {
    return ipcRenderer.invoke('switch-monitor') as Promise<boolean>;
  },
  saveLayout: (name: string, data: string) => {
    return ipcRenderer.invoke('save-layout', name, data) as Promise<boolean>;
  },
  loadLayout: (name: string) => {
    return ipcRenderer.invoke('load-layout', name) as Promise<string | null>;
  },
  onTogglePlaceMode: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('toggle-place-mode', listener);
    return () => ipcRenderer.removeListener('toggle-place-mode', listener);
  },
  // Fired for every system-wide left mouse-down (uiohook in main process),
  // including clicks outside the overlay — drives the guest charge boost.
  onGlobalClick: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('global-click', listener);
    return () => ipcRenderer.removeListener('global-click', listener);
  },
});
