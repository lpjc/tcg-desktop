import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktop', {
  setInteractive: (interactive: boolean) => {
    ipcRenderer.send('set-interactive', interactive);
  },
  moveWindow: (dx: number, dy: number) => {
    ipcRenderer.send('move-window', dx, dy);
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
});
