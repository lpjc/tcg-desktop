import Phaser from 'phaser';
import { WORLD_HEIGHT, ZOOM } from '../core/constants';

/**
 * Positions the main camera to show the entire world band at once.
 *
 * Convention (left), responsive road (centre), and shop (right) all fit on one
 * screen — there is no scene panning. After `setZoom(ZOOM)`, always use
 * `centerOn(worldWidth / 2, WORLD_HEIGHT / 2)` so the full layout is visible.
 *
 * See the file-level comment in the previous CameraDirector revision (and
 * ARCHITECTURE §6.1) for why raw scrollX/scrollY must not be used after zoom.
 */
export class CameraDirector {
  private camera: Phaser.Cameras.Scene2D.Camera;

  constructor(camera: Phaser.Cameras.Scene2D.Camera, worldWidth: number) {
    this.camera = camera;
    camera.setZoom(ZOOM);
    camera.setRoundPixels(true);
    this.refit(worldWidth);
  }

  /** Re-centre after the responsive road changes world width. */
  refit(worldWidth: number): void {
    this.camera.centerOn(worldWidth / 2, WORLD_HEIGHT / 2);
  }
}
