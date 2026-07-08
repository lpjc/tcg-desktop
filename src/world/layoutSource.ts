import { assetUrl } from '../assets/assetUrl';

/**
 * Load a named world layout (`assets/layouts/<name>.json`) — the files the
 * F2 editor saves.
 *
 * Priority:
 *  1. Electron: read via the desktop bridge (filesystem, always freshest).
 *  2. Browser: fetch the same file from the Vite publicDir (`assets/` is
 *     served/copied verbatim, so web builds ship the latest saved layouts).
 *
 * Returns null when the layout does not exist in either source; callers fall
 * back to their bundled defaults.
 */
export async function loadLayoutJson<T>(name: string): Promise<T | null> {
  if (window.desktop) {
    try {
      const saved = await window.desktop.loadLayout(name);
      if (saved) return JSON.parse(saved) as T;
    } catch {
      /* fall through to fetch */
    }
  }
  try {
    const response = await fetch(assetUrl(`layouts/${name}.json`));
    if (response.ok) return (await response.json()) as T;
  } catch {
    /* fall through to caller fallback */
  }
  return null;
}
