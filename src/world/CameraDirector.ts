import Phaser from 'phaser';
import { WORLD_HEIGHT, ZOOM } from '../core/constants';

/**
 * Positions the main camera to show the entire world band at once.
 *
 * Convention (left), responsive road (centre), and shop (right) all fit on one
 * screen — there is no scene panning. Vertically the band is glued to the
 * window **bottom**: whatever extra height the window has (TOP_MARGIN in
 * electron/main.ts) becomes transparent headroom above the band, so the band
 * is never clipped even if window and canvas heights briefly disagree.
 *
 * After `setZoom(ZOOM)`, always position with `centerOn` — see ARCHITECTURE
 * §6.1 for why raw scrollX/scrollY must not be used after zoom.
 */
export class CameraDirector {
  private camera: Phaser.Cameras.Scene2D.Camera;

  constructor(camera: Phaser.Cameras.Scene2D.Camera, worldWidth: number) {
    this.camera = camera;
    camera.setZoom(ZOOM);
    camera.setRoundPixels(true);
    this.refit(worldWidth);
  }

  /** Re-centre after the responsive road changes world width or the window resizes. */
  refit(worldWidth: number): void {
    const visibleWorldHeight = this.camera.height / ZOOM;
    this.camera.centerOn(worldWidth / 2, WORLD_HEIGHT - visibleWorldHeight / 2);
  }
}
