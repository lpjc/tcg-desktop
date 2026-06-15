import Phaser from 'phaser';
import './ui/theme.css';
import { DevToggleButton } from './ui/DevToggleButton';
import { DevGamePanel } from './ui/DevGamePanel';
import { BottomHud } from './ui/BottomHud';
import { MonitorSwitchButton } from './ui/MonitorSwitchButton';
import { CollectionScreen } from './ui/collection/CollectionScreen';
import { CollectionButton } from './ui/collection/CollectionButton';
import { registerPlaceholderSet } from './game/cards/placeholderSet';
import { gameState } from './game/state/GameState';
import { WorldScene } from './world/WorldScene';

/**
 * Phaser bootstrap for the desktop overlay band.
 *
 * - Canvas always fills the Electron window (whose height is set in
 *   electron/main.ts to (BAND_HEIGHT + TOP_MARGIN) × ZOOM); the camera glues
 *   the world band to the window bottom, headroom above stays transparent.
 * - Width is 100% of the monitor work area; convention | road | shop fill it
 *   via `WorldLayout` (road flexes on resize).
 * - `transparent: true` lets the desktop show through.
 */

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'game-container',
  backgroundColor: 'rgba(0,0,0,0)',
  transparent: true,
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.NONE,
  },
  scene: [WorldScene],
});

function resizeCanvas(): void {
  game.scale.resize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', resizeCanvas);

// Start loading the pixel font now so Phaser canvas text uses it, not a fallback.
void document.fonts?.load('16px "VCR OSD Mono"');

// Game state: register card data, then hydrate the save (async) before UI binds.
registerPlaceholderSet();
void gameState.load();

new DevToggleButton('editor-ui');
new BottomHud('editor-ui');
new DevGamePanel('editor-ui');

// Collection binder: persistent opener button + the floating screen it toggles.
const collectionScreen = new CollectionScreen('editor-ui');
new CollectionButton('editor-ui', collectionScreen);

if (window.desktop) {
  new MonitorSwitchButton('editor-ui');
}

export default game;
