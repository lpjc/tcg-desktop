/**
 * Resolve a file inside the Vite publicDir (`assets/`) to a URL that works at
 * any deploy base: the dev server root, Electron, or a subpath host like
 * itch.io (which serves the game from a nested URL — see `base: './'` in
 * vite.config.ts).
 *
 * Always use this instead of hand-writing root-absolute paths (`/foo.png`).
 * Encodes spaces in pack file names (e.g. Sierra "Slice N.png").
 */
export function assetUrl(relPath: string): string {
  return encodeURI(import.meta.env.BASE_URL + relPath);
}
