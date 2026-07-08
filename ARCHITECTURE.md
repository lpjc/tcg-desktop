# TCG Desktop — Architecture & Plan

A 2D pixel-art, top-down **desktop companion** game. It renders as a full-width,
always-on-top, transparent, click-through overlay anchored to the bottom strip of
the screen. Two locations — a **convention floor** and a **shop** — connected by a
**road** in the middle that pans the camera between them. Gameplay (selling /
showcasing / buying / restocking) comes later; this plan is about getting a
**beautiful, correctly-scaled, walkable world** on screen and a workflow for
hand-building it.

---

## 1. Guiding constraints

- **Desktop companion:** frameless, transparent, always-on-top, click-through
  (you can use your desktop through it), full screen width, content in a bottom band.
- **Look:** small, crisp pixel art — Game Boy / Stardew scale. No blur, no misaligned
  sprites, no "everything is huge" problem.
- **Division of labor:** the human handcrafts the world (placement, composition);
  the engine *guarantees* technical correctness (native scale, alignment, depth).
- **Scope now:** world rendering + camera + walkable character + depth + an in-engine
  **place-mode editor**. Game systems are stubbed behind clean seams.

---

## 2. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Desktop shell | **Electron** | Most mature transparent + always-on-top + click-through (`setIgnoreMouseEvents(…, { forward: true })`) support. |
| Game engine | **Phaser 3** | Built-in tilemaps, sprites, depth sorting, `pixelArt` mode, transparent canvas. |
| Language | **TypeScript** | Safer entity/layout/asset-catalog code; better for the next developer. |
| Bundler | **Vite** | Fast dev server + HMR for the renderer; simple Electron integration. |
| Layout/asset data | **JSON** | Human-diffable layouts and asset catalog the engine loads. |

Tauri was considered (lighter) but Electron's click-through + mouse-forwarding story
is more reliable cross-platform, which matters for a click-through overlay.

### Web build (itch.io)

The renderer also ships as a plain static site (`npm run build` → `dist/`) with no
Electron. Everything desktop-specific degrades behind the optional `window.desktop`
bridge:

- **Saves** fall back to localStorage (`src/game/state/persistence.ts`).
- **Layouts** are fetched from `layouts/*.json` in the publicDir — the same files the
  F2 editor saves — instead of the IPC filesystem read (`src/world/layoutSource.ts`).
- **Asset URLs** all go through `assetUrl()` (`src/assets/assetUrl.ts`) so they respect
  Vite's relative `base: './'` and work from itch.io's nested upload URLs.
- **Backdrop:** with no desktop showing through the transparent canvas, `body.web-page`
  (added in `main.ts` when `window.desktop` is absent) paints an opaque night-sky page.
- Raw art packs not used at runtime live in `art-source/`, outside the shipped publicDir.

---

## 3. Project structure

```
TCG Desktop/
├─ ARCHITECTURE.md              # this file
├─ package.json
├─ electron/
│  ├─ main.ts                   # window: transparent, frameless, always-on-top, click-through
│  └─ preload.ts                # safe IPC bridge (toggle click-through, save/load layouts)
├─ src/                         # Phaser renderer (game)
│  ├─ main.ts                   # Phaser.Game bootstrap + global scale config
│  ├─ core/
│  │  ├─ constants.ts           # TILE=16, ZOOM=2, BAND_HEIGHT, convention/shop widths
│  │  ├─ depth.ts               # foot-anchor Y-sort helpers
│  │  └─ clickthrough.ts        # renderer side of hover→interactive toggle
│  ├─ world/
│  │  ├─ WorldScene.ts          # single-screen world + responsive road resize
│  │  ├─ WorldLayout.ts         # convention | flex road | shop layout math
│  │  └─ CameraDirector.ts      # centres camera on full world (no panning)
│  ├─ characters/
│  │  ├─ characterSheets.ts     # LimeZu roster + 16×32 sheet layout (dir order: down,up,left,right)
│  │  ├─ registerCharacterAnims.ts # preload sheets, build 4-dir idle+walk anims, playFacing()
│  │  ├─ Npc.ts                 # one background goer: arrive (fade or materialize) → wander → fade-out leave
│  │  ├─ NpcCrowd.ts            # owns all background NPCs; random top-up for the shop only
│  │  └─ ConventionGuestChargeController.ts # doorway silhouette charge: timed + global-click-boosted guest spawn
│  ├─ entities/
│  │  ├─ Player.ts              # protagonist (Adam); walks station→station, never fades
│  │  └─ Placeable.ts           # a placed furniture instance (foot-anchored, depth-sorted)
│  ├─ editor/
│  │  ├─ PlaceMode.ts           # edit/play toggle, grid, drag-snap-place, delete
│  │  └─ AssetPalette.ts        # scrollable picker of catalogued sprites
│  ├─ ui/
│  │  └─ DragHandle.ts          # grip that moves the overlay between monitors (IPC)
│  └─ assets/
│     ├─ catalog.ts             # loads asset-catalog.json
│     └─ loader.ts              # loads sprites with correct foot origins
├─ assets/
│  ├─ sierrassets/              # imported PNGs (native size, untouched)
│  ├─ asset-catalog.json        # slice id → {name, category, footX, footY, collision}
│  └─ layouts/
│     ├─ convention.json        # placed objects (authored in place-mode)
│     └─ shop.json
```

---

## 4. The overlay layer (Electron)

- Window: `transparent: true`, `frame: false`, `alwaysOnTop: true`, `skipTaskbar`
  (optional), sized to **full screen width × a bottom band height**, positioned at the
  bottom of the work area.
- **Click-through by default:** `win.setIgnoreMouseEvents(true, { forward: true })`.
  `forward: true` keeps mouse-move events flowing so the renderer can detect when the
  cursor is over something interactive.
- **Hover toggle:** the renderer hit-tests the cursor against interactables/UI. When
  over one → IPC → `setIgnoreMouseEvents(false)` (window becomes clickable). When not →
  back to click-through. In **place mode** the whole band is clickable.
- IPC (via `preload.ts`): `setInteractive(bool)`, `saveLayout(name, json)`,
  `loadLayout(name)`, plus a global hotkey to toggle play/edit.
- **Global click hook:** the main process runs a system-wide left/right
  mouse-down listener (`uiohook-napi`, a native N-API module with prebuilt
  binaries) and forwards each click as a `global-click` IPC event
  (`onGlobalClick` on the bridge). The overlay is click-through, so this is the
  only way desktop clicks reach the game — it powers the convention guest
  charge (§6.2). Hook failure is non-fatal: guests then charge passively only.

---

## 5. Scaling discipline (the core fix)

These rules are enforced in code so the past "too big / misaligned" failures can't recur:

1. **1 source pixel = 1 logical pixel everywhere. Individual sprites are NEVER resized.**
2. **One fixed integer camera zoom** (`ZOOM = 2` in `constants.ts`) — the small
   companion size (~212px window height). Not user-adjustable.
3. **Nearest-neighbor** rendering via Phaser `pixelArt: true` (+ `roundPixels`).
4. **Grid:** world cell = **16px**; floor uses **8px** sub-tiles (4 per cell). All native.
5. **Foot anchor:** every placeable/character uses **bottom-center origin**; `depth = footY`.
   Fixes alignment *and* drives Y-sort in one move.

The world band is always `BAND_HEIGHT` (96) source pixels tall, plus `TOP_MARGIN` (10)
source pixels of transparent click-through headroom above it (window height =
`(BAND_HEIGHT + TOP_MARGIN) × ZOOM`; the camera keeps the band glued to the window
bottom, visible world Y runs `-TOP_MARGIN..96`). Horizontal width is dynamic:
convention (320px) + responsive road + shop (320px) = viewport width at zoom.

---

## 6. World model & camera (single-screen)

- **Single view:** convention (left), responsive road (centre), shop (right) — all
  visible at once on the bottom desktop band. No camera panning.
- `WorldLayout.ts` computes frame rects from `window.innerWidth / ZOOM`. The road width
  is whatever remains after the fixed convention and shop widths; it snaps to the 8px
  floor grid.
- On window resize, `WorldScene` rebuilds road/shop base floors and shifts shop
  placeables by the delta. Shop layout JSON stores **frame-relative** x coordinates.
- `CameraDirector.ts` centres on `worldWidth / 2` with `camera.centerOn(…, WORLD_HEIGHT/2)`.
  Do **not** use raw `scrollX`/`scrollY` after zoom — see `CameraDirector.ts` and §6.1.
- Electron pins the window to the **bottom** of the monitor work area at **100% width**
  (`snapToDisplayBand` on create and `display-metrics-changed`).

### 6.1 Debugging a blank canvas (pitfall log)

| Symptom | Likely cause | What to check |
|---|---|---|
| HUD / palette / drag grip visible, Phaser band empty | Camera aimed off-world after zoom | `cameras.main.worldView` should overlap `0…worldWidth`, `0…WORLD_HEIGHT` |
| Palette thumbnails broken, loader errors | Asset paths with spaces not URL-encoded | `encodeURI` in `loader.ts` and `AssetPalette.ts` |
| Nothing interactive | Click-through still on | `InteractionManager` hot zones / edit mode (`F2`) |

**Opaque debug window:** `DEBUG_OPAQUE=1 npm run dev` — renders a normal framed window
(see `electron/main.ts`) so you can screenshot the canvas without desktop wallpaper
behind it. Renderer `console.log` is forwarded to the terminal in dev.

---

## 6.2 Characters & crowd

- **Protagonist (Adam):** `Player.ts`. Only moves when commanded (`walkTo`), always
  fully opaque. Walk timing comes from `core/walkMotion.ts` — a **fixed-acceleration**
  trapezoidal profile (constant ramp to a fixed top speed, then cruise). Ramp feel is
  identical for every trip; only the cruise length grows with distance. Do **not** swap
  this back to a normalized ease, which makes short hops snappy and long hops sluggish.
- **NPCs (Alex / Amelia / Bob):** `NpcCrowd.ts` owns every background NPC,
  **independently of the player** — both scenes stay alive no matter where Adam is.
  The two zones are populated differently:
  - **Shop:** random top-up to a small target on a maintenance timer (unchanged).
  - **Convention:** guests arrive **only** via the guest charge (below); the crowd
    still owns their wander regions, relayout handling, and despawn bookkeeping.

  Wander areas come from `characters/wanderZones.ts`: one rectangle per
  convention room (each room's `width` + `floorTop` from the active venue preset), and
  for the shop the full floor minus the centre-top behind-counter strip (`SHOP_BACK_COUNTER`
  in `floorPatterns.ts`). Convention NPCs may cross all room thresholds; both scenes
  only enter/exit at their road doorway (lobby for convention, left edge for shop).
  NPCs stroll a few legs, then walk back out through the same doorway and despawn.
  NPCs are decorative (no interaction, no game state).
- **Convention guest charge ("idle, but your actions matter"):**
  `ConventionGuestChargeController.ts`. Exactly one incoming guest charges **out on
  the road in front of the lobby doorway** at a time: a grey silhouette of the
  actual guest sprite stands still while the full-color sprite is revealed
  **bottom-up** by a geometry mask. `guestChargeProgress` is a single 0→1 value —
  passive fill (`GUEST_CHARGE_BASE_MS` ≈ 10s) and **global clicks (left or right)
  anywhere on the desktop** (`CLICK_GUEST_CHARGE_BOOST` = +10% each, via the
  uiohook bridge in §4) feed the same number, so timer and bar can never disagree.
  Each click fires a small squash pulse + spark on the silhouette. On completion
  the silhouette "plings" (white flash + scale bounce; audio seam in
  `playArrivalPling`) and materializes into a normal wandering `Npc` at that road
  spot, which walks in through the doorway — then the next charge starts
  immediately. Guardrails: `MIN_GUEST_CHARGE_MS` (600ms) floors the arrival rate
  against autoclickers; at `CONVENTION_FLOOD_CAP` (30) the full silhouette waits
  on the road until a guest wanders out; a blocked doorway/road spot
  pauses/retries; clicks are ignored while place mode is active.
- **NPC lifecycle never teleports:** `Npc.trySpawn` first finds a free foot spot on the
  doorway line (`findDoorSpot`); if furniture blocks the whole entrance the spawn is
  skipped and the maintenance timer retries later. Exits walk to the doorway and fade
  while stepping outside; if the doorway became unreachable the NPC retries a few times,
  then fades out in place (the only fallback — still a fade, never a pop).
- **Collision & pathfinding:** `world/obstacleField.ts` builds collision rects from
  every placed item (catalog `collision` box, or the per-object `collidable` override
  set in the editor with **C** — e.g. rug = walk-through, table = blocking). Player and
  NPC walks route around these via BFS on an 8px grid with string-pulling smoothing.
  NPC paths are additionally constrained to their wander regions (`withinAnyRegion`),
  so they never cut through the road or other scenes. The field is rebuilt on layout
  edits, venue switches, and bootstrap (`WorldScene.rebuildObstacles`).
- **Sheets:** LimeZu "Modern Interiors" free pack, 16×32 frames, strips ordered
  `right,up,left,down` (6 frames each). Idle+walk anims are built for all four
  facings (`run` sheet drives "walk"); walkers face the dominant axis of each
  path leg, and the player turns toward a station's collision box on arrival.

## 7. Depth (walk behind / in front)

- Player and every `Placeable` get `depth = footY` (bottom-center world Y), re-applied on move.
- Always-below (floor) and always-above (e.g. hanging banners) live on fixed layers.
- This is the Stardew/Pokémon technique; with foot anchoring it's automatic.

---

## 8. Asset pipeline

- Import Sierra PNGs **at native size, untouched** into `assets/sierrassets/`.
- **Problem:** individual sprites are named `Slice N.png` (non-semantic), and trimmed to
  varying sizes. **Solution:** an `asset-catalog.json` mapping each slice to
  `{ name, category, footX, footY, collisionBox }`. Built once (semi-automatically:
  default foot = bottom-center, then refined in place-mode), so the palette shows
  meaningful items and every placement is foot-correct.
- Floor/wall 8px tiles become a Phaser tileset for the ground band.

---

## 9. Place-mode editor (your handcrafting tool)

- **Toggle** play ⇄ edit via hotkey (e.g. `F2`). Edit mode makes the overlay fully clickable
  and shows a faint 16px grid.
- **`AssetPalette`:** scrollable, categorized picker of catalogued sprites.
- **Place:** click a palette item → drag in world → **snaps to grid, foot-anchored, depth-sorted live**.
  Right-click deletes; arrow-nudge for fine placement.
- **Per-frame:** you're always editing the active scene frame (convention or shop).
- **Save/Load:** writes `assets/layouts/<frame>.json` via IPC; the game loads these on start.
- This is the cure for "AI can't build a pretty world": **you compose**, the engine guarantees
  it's crisp, aligned, and correctly layered.

---

## 10. Data formats

**`asset-catalog.json`** (per sprite):
```json
{ "id": "slice_42", "file": "sierrassets/furniture/Slice 42.png",
  "name": "Arcade machine", "category": "machines",
  "footX": 8, "footY": 31, "collision": { "x": 0, "y": 24, "w": 16, "h": 8 } }
```

**`layouts/<frame>.json`** (placed instances):
```json
{ "frame": "convention",
  "objects": [ { "catalogId": "slice_42", "x": 96, "y": 160 } ] }
```

---

## 11. Interaction seams (stubbed now)

- A `Placeable` may carry an optional `interaction` tag (`shop_counter`, `booth`, …).
- `door`/road zone → `CameraDirector` pan (already part of Option 2).
- Buy/sell/restock logic plugs into these tags later without touching rendering.

---

## 12. Build & run

- `npm run dev` — Vite renderer + Electron with HMR.
- `npm run build` / `npm run package` — production overlay app.

---

## 13. Milestones

1. **M0 — Scaffold:** Electron transparent/click-through overlay hosting a Phaser canvas. Prove the window behavior.
2. **M1 — Scale + floor:** `constants.ts` knobs, pixelArt, 8px floor band rendered crisp at target zoom.
3. **M2 — Player + depth:** walkable foot-anchored character, Y-sort against a few placed sprites.
4. **M3 — Camera (Option 2):** convention/shop frames + road-triggered pan.
5. **M4 — Place mode:** palette + grid snap + save/load layouts. **(Asset proof milestone.)**
6. **M5 — Asset catalog pass:** name/foot/collision the Sierra sprites you'll actually use.
7. **M6+ — Game systems:** interactions, inventory, sell/buy loop.

> The **asset-viability proof you care about lands at M4** — real Sierra furniture,
> correctly scaled and small, placed by hand, with walk-behind depth working.
