# TCG Desktop

Convention-booth / card-shop management game. Runs two ways:

- **Desktop companion** (Electron): transparent, always-on-top band at the bottom of your monitor.
- **Web build** (itch.io / any static host): same game with an opaque page backdrop.

## Run (development)

```bash
npm install
npm run generate:catalog   # after adding/changing Sierra PNGs
npm run dev
```

## Web build (itch.io)

```bash
npm run build              # outputs a static site to dist/
npx vite preview           # play the production build locally
```

Zip the **contents** of `dist/` (index.html at the zip root, forward-slash paths —
`tar.exe -a -cf itch-build.zip -C dist <entries>` on Windows; PowerShell's
`Compress-Archive` writes backslash paths that break on itch.io) and upload as an
HTML project with "played in the browser" checked. Saves live in localStorage.
Layouts are fetched from `layouts/*.json` (the same files the F2 editor saves) —
see `src/world/layoutSource.ts`.

## Controls

Play mode (default):

| Input | Action |
|---|---|
| **Click a station** | Avatar walks to that booth/desk/display. The avatar is never directly controlled. |
| **?** button | How-to-play overlay (auto-opens on first run) |
| **♪** button | Toggle background music |
| **BG** button | Cycle the page wallpaper (web build only) |
| **F3** | Toggle the developer overlay (off by default) |
| **F2** | Enter edit mode (requires dev overlay on) |
| **V** | Cycle convention venue (requires dev overlay on) |

In Electron the window is click-through except over stations and panels — so your desktop stays usable.

Edit mode (F2):

| Input | Action |
|---|---|
| **Pick asset → click world** | Place it (16px grid, foot-anchored). A ghost preview follows the cursor. |
| **Floors tab → click/drag** | Paint floor tiles (8px grid) |
| **Right-click** | Delete furniture under cursor / erase floor tile |
| **Delete** | Remove selected object |
| **Arrow keys** | Nudge selected object |
| **Tab** | Switch scene (convention ↔ shop) |
| **Ctrl+S** | Save current scene layout to `assets/layouts/` |

## Layout & scale

The overlay is fixed at the **small** zoom (`ZOOM = 2` in `src/core/constants.ts`,
~192px tall), locked to the **bottom** of the monitor, and **100% work-area width**.
Convention (left) and shop (right) are fixed world-pixel widths; the **road** between
them grows or shrinks to fill the rest — see `src/world/WorldLayout.ts`.

## Assets

Sierra furniture pack lives in `assets/sierrassets/`. Regenerate `src/data/asset-catalog.json` with `npm run generate:catalog`. Saved layouts (Ctrl+S) go to `assets/layouts/`.

## Audio

Game SFX in `assets/sfx/` are small mono WAVs generated from the raw FilmCow pack in
`art-source/FilmCow Designed SFX/` — regenerate with `npm run generate:sfx` (sound→file
mapping lives in `scripts/build-sfx.mjs`). Background music: `assets/music/` (lofi track,
toggled with the ♪ button). Playback goes through `src/audio/audio.ts`.

## Backgrounds (web build)

Classic Windows wallpapers in `assets/backgrounds/` are downscaled copies of the
originals in `art-source/backgrounds/` — rebuild with `scripts/build-backgrounds.ps1`,
then update the `WALLPAPERS` list in `src/ui/BackgroundCycler.ts`.
