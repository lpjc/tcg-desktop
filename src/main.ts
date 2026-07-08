import Phaser from 'phaser';
import './ui/theme.css';
import { assetUrl } from './assets/assetUrl';
import { audio } from './audio/audio';
import { DevToggleButton } from './ui/DevToggleButton';
import { DevGamePanel } from './ui/DevGamePanel';
import { BottomHud } from './ui/BottomHud';
import { MonitorSwitchButton } from './ui/MonitorSwitchButton';
import { CollectionScreen } from './ui/collection/CollectionScreen';
import { CollectionButton } from './ui/collection/CollectionButton';
import { PackOpenScreen } from './ui/packs/PackOpenScreen';
import { PackOpenButton } from './ui/packs/PackOpenButton';
import { PackVendingScreen } from './ui/shop/PackVendingScreen';
import { HelpOverlay } from './ui/HelpOverlay';
import { MusicToggleButton } from './ui/MusicToggleButton';
import { BackgroundCycler } from './ui/BackgroundCycler';
import { registerPlaceholderSet } from './game/cards/placeholderSet';
import { gameState } from './game/state/GameState';
import { WorldScene } from './world/WorldScene';

/**
 * Phaser bootstrap. Two hosting modes share this entry point:
 *
 * - Electron overlay (`window.desktop` present): the canvas fills the
 *   transparent window (height set in electron/main.ts), the camera glues the
 *   world band to the window bottom, and the desktop shows through.
 * - Plain browser / itch.io: same layout, but the page provides an opaque
 *   backdrop (`body.web-page` in theme.css) instead of the desktop.
 *
 * Width is 100% of the window; convention | road | shop fill it via
 * `WorldLayout` (road flexes on resize).
 */

// In a plain browser there is no desktop to show through — give the page an
// opaque backdrop so the transparent canvas reads as a game frame.
if (!window.desktop) {
  document.body.classList.add('web-page');
}

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

// Register + load the pixel font via the FontFace API (not a CSS @font-face)
// so the file URL respects the deploy base (itch.io serves from a subpath).
// Loading it eagerly also means Phaser canvas text uses it, not a fallback.
const pixelFont = new FontFace(
  'VCR OSD Mono',
  `url(${assetUrl('fonts/vcr_osd_mono/VCR_OSD_MONO_1.001.ttf')})`,
  { display: 'block' },
);
document.fonts.add(pixelFont);
void pixelFont.load();

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

// Onboarding: auto-opens on first run, then lives behind the "?" button.
new HelpOverlay('editor-ui');

// Audio: SFX + looping background music (starts on the first user gesture,
// per browser autoplay policy). The toolbar button toggles the music.
audio.init();
new MusicToggleButton('editor-ui');

// Web only: classic Windows wallpaper behind the canvas + "BG" cycle button.
// Electron shows the real desktop instead, so no cycler there.
if (!window.desktop) {
  new BackgroundCycler('editor-ui');
}

if (window.desktop) {
  new MonitorSwitchButton('editor-ui');
}

export default game;
