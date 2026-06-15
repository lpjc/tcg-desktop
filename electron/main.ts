import { app, BrowserWindow, ipcMain, screen, globalShortcut } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { uIOhook } from 'uiohook-napi';

/** Must match ZOOM, BAND_HEIGHT and TOP_MARGIN in src/core/constants.ts */
const ZOOM = 2;
const BAND_HEIGHT = 96;
/** Transparent click-through headroom above the band (world px). */
const TOP_MARGIN = 10;
/** Small framed height used only in DEBUG_OPAQUE mode (tidy band-only view). */
const BAND_WINDOW_HEIGHT = (BAND_HEIGHT + TOP_MARGIN) * ZOOM;

const isDev = !app.isPackaged;
// Set DEBUG_OPAQUE=1 to render the overlay as a normal opaque, framed window.
const DEBUG_OPAQUE = process.env.DEBUG_OPAQUE === '1';

let mainWindow: BrowserWindow | null = null;
let clickThroughEnabled = true;
let globalClickHookStarted = false;

/** uiohook button ids. */
const LEFT_MOUSE_BUTTON = 1;
const RIGHT_MOUSE_BUTTON = 2;

/**
 * System-wide click listener (uiohook-napi). The overlay is click-through,
 * so desktop clicks never reach the renderer — this hook forwards every global
 * left/right mouse-down as a `global-click` IPC event, which drives the
 * convention guest charge ("your actions matter" idle mechanic).
 *
 * Failure is non-fatal: the game still runs, guests just charge passively.
 */
function startGlobalClickHook(): void {
  try {
    uIOhook.on('mousedown', (event) => {
      if (event.button !== LEFT_MOUSE_BUTTON && event.button !== RIGHT_MOUSE_BUTTON) return;
      mainWindow?.webContents.send('global-click');
    });
    uIOhook.start();
    globalClickHookStarted = true;
  } catch (error) {
    console.error('[global-click] failed to start input hook:', error);
  }
}

/** Re-apply topmost z-order — toggling click-through or moving the window can drop it on Windows. */
function pinOverlayOnTop(win: BrowserWindow): void {
  win.setAlwaysOnTop(true, 'screen-saver');
}

function layoutsDir(): string {
  return path.join(app.getAppPath(), 'assets', 'layouts');
}

function gameStateFile(): string {
  return path.join(app.getPath('userData'), 'game-state.json');
}

/**
 * The overlay covers the full work area of its monitor: a tall, transparent,
 * click-through window whose bottom holds the small world band while the rest is
 * empty headroom for floating panels (matches inspirational-references). In
 * DEBUG_OPAQUE mode we shrink to just the band so the framed debug window stays
 * tidy.
 */
function overlayBounds(workArea: Electron.Rectangle): Electron.Rectangle {
  const height = DEBUG_OPAQUE ? BAND_WINDOW_HEIGHT : workArea.height;
  return {
    x: workArea.x,
    y: workArea.y + workArea.height - height,
    width: workArea.width,
    height,
  };
}

/**
 * Pin the overlay to the bottom of the monitor it sits on, spanning the full
 * work area. Called on create and when display metrics change.
 */
function snapToDisplayBand(win: BrowserWindow): void {
  const display = screen.getDisplayMatching(win.getBounds());
  win.setBounds(overlayBounds(display.workArea));
  pinOverlayOnTop(win);
}

/** Move the overlay to the next connected monitor (cycles back to the first). */
function switchToNextDisplay(win: BrowserWindow): boolean {
  const displays = screen.getAllDisplays();
  if (displays.length <= 1) return false;

  const current = screen.getDisplayMatching(win.getBounds());
  const currentIndex = displays.findIndex((d) => d.id === current.id);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % displays.length;
  win.setBounds(overlayBounds(displays[nextIndex].workArea));
  pinOverlayOnTop(win);
  return true;
}

function createWindow(): void {
  const { workArea } = screen.getPrimaryDisplay();
  const bounds = overlayBounds(workArea);

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: !DEBUG_OPAQUE,
    frame: DEBUG_OPAQUE,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    hasShadow: false,
    backgroundColor: DEBUG_OPAQUE ? '#202830' : '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  pinOverlayOnTop(mainWindow);

  if (!DEBUG_OPAQUE) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  }

  if (isDev) {
    mainWindow.webContents.on('console-message', (event) => {
      console.log(`[renderer] ${event.message}`);
    });
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error('[renderer gone]', details.reason);
    });
  }

  if (isDev) {
    void mainWindow.loadURL('http://localhost:5173');
  } else {
    void mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  // Another app taking focus can drop z-order on Windows; re-pin without stealing focus.
  mainWindow.on('blur', () => {
    pinOverlayOnTop(mainWindow!);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setClickThrough(enabled: boolean): void {
  if (!mainWindow) return;
  clickThroughEnabled = enabled;
  if (enabled) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    mainWindow.setIgnoreMouseEvents(false);
  }
  pinOverlayOnTop(mainWindow);
}

app.whenReady().then(() => {
  createWindow();
  startGlobalClickHook();

  screen.on('display-metrics-changed', () => {
    if (mainWindow) snapToDisplayBand(mainWindow);
  });

  globalShortcut.register('F2', () => {
    mainWindow?.webContents.send('toggle-place-mode');
  });

  ipcMain.on('set-interactive', (_event, interactive: boolean) => {
    setClickThrough(!interactive);
  });

  ipcMain.on('move-window', (_event, dx: number, dy: number) => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(Math.round(x + dx), Math.round(y + dy));
    pinOverlayOnTop(mainWindow);
  });

  ipcMain.handle('switch-monitor', () => {
    if (!mainWindow) return false;
    return switchToNextDisplay(mainWindow);
  });

  ipcMain.handle('save-layout', async (_event, name: string, data: string) => {
    try {
      const dir = layoutsDir();
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, `${name}.json`), data, 'utf8');
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('load-layout', async (_event, name: string) => {
    try {
      const filePath = path.join(layoutsDir(), `${name}.json`);
      return await fs.readFile(filePath, 'utf8');
    } catch {
      return null;
    }
  });

  // Player save data lives in userData (not the app bundle) so packaged builds
  // can write it. One JSON blob; the renderer owns the schema.
  ipcMain.handle('save-game-state', async (_event, data: string) => {
    try {
      await fs.writeFile(gameStateFile(), data, 'utf8');
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('load-game-state', async () => {
    try {
      return await fs.readFile(gameStateFile(), 'utf8');
    } catch {
      return null;
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (globalClickHookStarted) uIOhook.stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

