import Phaser from 'phaser';
import './ui/theme.css';
import { DevToggleButton } from './ui/DevToggleButton';
import { DevGamePanel } from './ui/DevGamePanel';
import { BottomHud } from './ui/BottomHud';
import { MonitorSwitchButton } from './ui/MonitorSwitchButton';
import { CollectionScreen } from './ui/collection/CollectionScreen';
import { CollectionButton } from './ui/collection/CollectionButton';
import { PackOpenScreen } from './ui/packs/PackOpenScreen';
import { PackOpenButton } from './ui/packs/PackOpenButton';
import { PackVendingScreen } from './ui/shop/PackVendingScreen';
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
const starterSetId = registerPlaceholderSet();
void gameState.load().then(() => {
  // Make the starter set buyable out of the box; later sets unlock via trades.
  if (gameState.snapshot().unlockedSets.length === 0) gameState.unlockSet(starterSetId);
});

new DevToggleButton('editor-ui');
new BottomHud('editor-ui');
new DevGamePanel('editor-ui');

// Collection binder + pack-opening overlay: persistent opener buttons and the
// floating screens they toggle. The two overlays are mutually exclusive — opening
// one closes the other so ESC and the active-button state never desync.
const collectionScreen = new CollectionScreen('editor-ui');
new CollectionButton('editor-ui', collectionScreen);
const packScreen = new PackOpenScreen('editor-ui');
new PackOpenButton('editor-ui', packScreen);
packScreen.onOpenChange((open) => {
  if (open) collectionScreen.close();
});
collectionScreen.onOpenChange((open) => {
  if (open) packScreen.close();
});

// Shop vending purchase screen — registers itself on the shop bridge so the
// world can open it on arrival at the pack vending machine.
new PackVendingScreen('editor-ui');

if (window.desktop) {
  new MonitorSwitchButton('editor-ui');
}

export default game;
