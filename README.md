# TCG Desktop

Transparent, always-on-top desktop companion game (convention floor + shop).

## Run (development)

```bash
npm install
npm run generate:catalog   # after adding/changing Sierra PNGs
npm run dev
```

## Controls

Play mode (default):

| Input | Action |
|---|---|
| **Click a station** | Avatar walks to that booth/desk/display. The avatar is never directly controlled. |
| **F2** | Enter edit mode |

The window is click-through except over stations and the palette — so your desktop stays usable.

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
