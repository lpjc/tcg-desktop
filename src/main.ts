import Phaser from 'phaser';
import { DevToggleButton } from './ui/DevToggleButton';
import { MonitorSwitchButton } from './ui/MonitorSwitchButton';
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

new DevToggleButton('editor-ui');

if (window.desktop) {
  new MonitorSwitchButton('editor-ui');
}

export default game;
