import Phaser from 'phaser';
import { windowBandHeight } from './core/constants';
import { MonitorSwitchButton } from './ui/MonitorSwitchButton';
import { WorldScene } from './world/WorldScene';

/**
 * Phaser bootstrap for the desktop overlay band.
 *
 * - Fixed small zoom (ZOOM); window height = windowBandHeight() (~192px).
 * - Width is 100% of the monitor work area; convention | road | shop fill it
 *   via `WorldLayout` (road flexes on resize).
 * - `transparent: true` lets the desktop show through.
 */

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: windowBandHeight(),
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
  game.scale.resize(window.innerWidth, windowBandHeight());
}

window.addEventListener('resize', resizeCanvas);

if (window.desktop) {
  new MonitorSwitchButton('editor-ui');
}

export default game;
