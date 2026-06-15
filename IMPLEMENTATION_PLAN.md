# Implementation Plan — TCG Desktop

Turns `Game Mechanic Brief.md` into a build order. The brief is the **design source of
truth**; this doc is the **build plan** (sequence, data model, decisions, assets).

> Status legend: ✅ done · 🔜 next · ⬜ planned · ❓ needs your decision

---

## 0. Guiding constraints (apply to everything below)

1. **The world band stays small, always.** The rendered world is a short band along the bottom
   (`BAND_HEIGHT 96 × ZOOM 2`). The band never grows. **The window, however, is tall and fully
   transparent** above the band (click-through to the desktop) — big toy panels float up into that
   transparent headroom, exactly like the reference game (`inspirational-references/`). So the
   *world* is small but there's roomy transparent space for chunky panels.
2. **Menus are "station screens" that float above the band.** Interacting with a station (or the
   persistent Collection button) animates a big chunky panel up into the transparent headroom over
   a dimmed world; closing returns to the world. The world band itself never resizes.
3. **Classic card ratio.** Cards are `63 × 88` (≈ `0.716 : 1`, portrait). A focused card renders
   ~`76px` tall world → ~`54px` wide. One full card fits the band height with room for chrome.
4. **Placeholders first.** Build systems against generated placeholder card art + proposed
   economy numbers so nothing waits on real assets. Real art/data slot in later.
5. **Code style.** Small, well-named components; CSS in separate files; update comments/docs
   when refactoring so the next dev grasps intent.

---

## 1. Architecture decisions

| Decision | Choice | Why |
|---|---|---|
| **Window vs world** | Window is **tall + transparent + click-through**; world band stays small at the bottom | Gives roomy headroom to float big toy panels (matches reference) while keeping the world a small companion strip. Requires `electron/main.ts` height + click-through changes (Phase 0) |
| **Menu rendering** | HTML/CSS panels floating in the transparent headroom over a dimmed band | The rolodex (CSS 3D `perspective`/`rotateX`) and chunky panels are far cleaner in CSS; matches existing HTML UI pattern + "CSS in separate files" rule |
| **In-world effects** | Stay in Phaser | Pack cards flying onto the shop floor, coins flying to bank, NPCs buying — these are world-space and depth-sorted |
| **Game state** | Single `GameState` store module (`src/game/state/`) + JSON save via Electron IPC | Mirrors existing layout-save IPC; one source of truth, easy to persist/debug |
| **Card economy abstraction** | Visitors/booth read **stock piles** (rarity+holo), never individual cards | Straight from brief — only collection cares about specific cards |
| **Menu ↔ world bridge** | A `StationScreen` controller: station interaction opens the matching HTML screen, pauses world input | One consistent open/close path for all stations |

---

## 1A. UI design language (from `inspirational-references/`)

The reference is a similar bottom-band companion game. We adopt its **toy feel** and reject its
dense menus. Every station screen is **big, chunky, paged, low-density** — show a few big things at
a time and page through the rest. It's a game, not a website.

**Keep (the toy feel):**
- Chunky **pixel-art framed panels**: thick rounded borders, warm tan/wood fill, soft shadow.
- A chunky **title bar** per panel: station icon + big pixel **X** close button.
- Right-edge **vertical toolbar** of big icon buttons (persistent Collection/etc. buttons live here).
- **Money pill** bottom-center: coin icon + big number.
- **Green pixel outline** on a selected/active station (great "you're here" affordance).
- Rarity shown as **chunky colour** (big tokens / glows), never tiny dots.
- Panels **animate up** from the band into the transparent headroom.

**Avoid (the "website" feel):**
- Dense index grids (ref shot 1 — fish index).
- Spreadsheet buy-lists with `+`/`+10` rows (ref shot 4 — bait store).
- Tiny inventory cells, dropdown-driven sorting, desktop-app density.

**Template = the principle, not a widget.** Big/chunky/paged/low-density is the constant; **each
screen gets a layout that fits its own content**, never one forced gimmick. Don't over-invest in any
single mechanism — build the simplest version that feels good and iterate.

---

## 2. Full mechanic extraction (nothing from the brief omitted)

### 2.1 Pillars
- **Convention** = money generation (passive: visitors buy stock → money).
- **Shop** = card generation (buy → rip → reveal → stock + collection).
- **Collection** = meta/optimization (binder + display case, a skill system).

### 2.2 Cards, sets, rarity, holo, stock
- A **set** ≈ 30 cards, common theme: common / rare / epic + 1–2 **chase**. Sets unlock over time.
- **Stock** = cards abstracted by **rarity + holo** into **7 piles** (see §3.1). Booth & visitors
  only ever see piles. Each pile has a worth; NPC types have per-pile buy likelihoods.
- **Collection** cares about the *actual card* (discovery, rarity, holo).

### 2.3 Convention (passive)
1. Visitors arrive → 2. buy cards (consume stock) → 3. you earn money.
- Cash accumulates in a **cash box** whether or not you're present.
- **Trade offers** appear sometimes (see §2.6).
- Rare/"whale" visitors buy high-value piles → spawn variety is exciting.

### 2.4 Shop (active)
1. Buy pack (by set, bulk quantity) → 2. **rip**: click pack, cards pop out → 3. each card
   flies onto the floor **face-down + rarity glow** → 4. click to pick up (or hold-hover to
   grab many) → 5. **animate-reveal**: new card = "first!", holo = "holo!" → 6. card added to
   **collection** (existing-but-now-holo → holo-fied) **and** to **stock** (rarity+holo only).

### 2.5 Collection (binder + display case)
- **Binder:** one **set per page**; shows all ever-seen cards. Completion gives **5 tiers**,
  each tier unlocked by discovering: all common · all rare · all epic · all chase · all holo.
  Set bonus shown as cumulative **`+1/3/6/10/15 prestige`**.
- **Display Case:** **3 slots**. Click a card in the binder → fills an empty slot; click an
  occupied slot → removes it (empties). Cards show their bonus when cased. **Hidden combos**
  exist and only reveal once they activate.
- **Skills (4 core):**
  - **+Reputation** — more money per sell
  - **+Luck** — better rarity when opening packs
  - **+Prestige** — higher chance convention spawns a rare visitor
  - **+Attraction** — faster convention visitor spawn time

### 2.6 Trade offers (quest NPCs)
- A visitor stands opposite you at the booth; a **`?`** appears → click to show task as
  pictograms, e.g. `1x [specific card]` or `5x [rare][holo]`.
- Outline **green** if completable, **grey** if not. Click when green → complete → reward.
- **Two trade types:**
  - **Named-card** trade → checks **discovery** ("have you ever discovered Fire Dragon"),
    **non-consuming**.
  - **Quantity/pile** trade (e.g. "2x chase") → **consumes** from stock.

### 2.7 Stations
- **Booth:** shows stock + current per-pile prices; **collect** accumulated sales on arrival
  (`"12 sales! +€127 +3 Reputation"`); coins/cash fly to bank. Stand to auto-collect.
- **Vending Machine:** rotating inventory, **3 options, pick 1 per rotation**, rotates ~every
  15 min. Purchases: permanent / timed boost / discount. Examples: +20% visit speed 10m;
  100 commons at 50%; 3 packs at 50%; 2× sale price 10m; chase holo at 50%; +X stat permanent;
  clicks count double 10m.
- **Shop Counter:** buy packs (by set, bulk qty) + open packs.
- **Arcade Machine:** **not a minigame** — meta screen of total stats (with sources) + achievements.

### 2.8 Resources
- **Money** — buys packs + vending. **Collection** — permanent discoveries, never lost.
- **Stock** — economic fuel consumed by visitors.

### 2.9 Unlocks / progression
- **Trades are the progression gate.** Completing certain trade offers unlocks a **new
  convention**; each new convention unlock also unlocks a **new set** of cards. Conventions and
  sets unlock together. (Conventions = the existing venue presets `default_expo`, `wide_lobby`, …)

---

## 3. Locked design decisions (proposed — correct me if wrong)

### 3.1 Rarity & the 7 stock piles ✅ confirmed
"Uncommon" in the brief = **common** (a slip). Confirmed model: rarities are
**common / rare / epic / chase**; common can't be holo:

| Rarity | Non-holo pile | Holo pile |
|---|---|---|
| Common | ✅ | — (no holo) |
| Rare | ✅ | ✅ |
| Epic | ✅ | ✅ |
| Chase | ✅ | ✅ |

→ **7 piles:** `common, rare, epic, chase, rareHolo, epicHolo, chaseHolo`. Common is the
bulk filler that can't be holo. (Matches binder's "all holo" tier = all rare/epic/chase holos.)

### 3.2 Economy defaults (placeholder numbers, easy to tune)
- **Pile worth (€):** common 1 · rare 5 · epic 25 · chase 150 · rareHolo 20 · epicHolo 100 · chaseHolo 600
- **Pack:** cost €100, 6 cards = 5 commons + 1 "rare-or-better" slot (weighted; Luck shifts upward)
- **Binder set bonus:** prestige `+1/3/6/10/15` cumulative across the 5 tiers
- **Visitor profiles:** `normal` (commons mostly), `collector` (rare/epic), `whale` (epic/chase/holo).
  Prestige raises rare-visitor odds; Attraction shortens spawn interval.

### 3.3 Card render size
Focused card height `76px` world (`~54px` wide) at classic `63:88` ratio.

---

## 4. Data model (Phase 0 foundation)

```
Card        { id, setId, name, rarity, canBeHolo, artKey }
CardSet     { id, name, theme, cardIds[], unlock }
PileId      = common | rare | epic | chase | rareHolo | epicHolo | chaseHolo
GameState {
  money: number
  stock: Record<PileId, number>
  collection: Record<cardId, { discovered: boolean; holo: boolean }>
  skills: { reputation; luck; prestige; attraction }
  displayCase: [cardId|null, cardId|null, cardId|null]
  unlockedConventions: string[]   // venue ids; trades unlock these
  unlockedSets: string[]          // unlocked alongside each convention
  cashBox: { sales: number; money: number; reputation: number }   // un-collected booth earnings
  vending: { rotationStartedAt; offers[3]; purchasedThisRotation }
  boosts: { id; expiresAt; ... }[]
  stats / achievements
}
```

---

## 5. Phased roadmap

Each phase is independently runnable. We start with the **collection rolodex** per your call —
it de-risks the hardest band-UI question and gives an immediate, satisfying screen.

### Phase 0 — Economic spine + state + tall window 🔜
- **Window/overlay change:** make the Electron window **tall + transparent + click-through**
  (`electron/main.ts`), world band still glued small at the bottom; click-through becomes
  interactive over the band, the right toolbar, the money pill, and any open panel.
- Data model (§4), `GameState` store, JSON persistence via Electron IPC.
- Dev/debug seed buttons ("grant stock", "grant money", "discover set").
- No art needed.

### Phase 1 — Collection binder 🔜  ← start here
- HTML/CSS **binder page**: one **set per page** (brief), shown as a chunky page of **big card
  pockets** (a few per row; page within a set if the set is large). Thematic + scannable — a card
  binder, not a dense grid.
- Discovered = art; undiscovered = silhouette/locked pocket; holo = shimmer.
- Switch sets (page left/right); per-set **completion tiers** + prestige bonus display.
- Opens from a **persistent on-screen button** (no walking); floats up over a dimmed band.
- Components: `CollectionScreen`, `BinderPage`, `CardPocket`, `SetTabs` (+ separate CSS files).
- The tall window (Phase 0) gives room for big pockets — no rolodex trick needed.
- *(Optional later flourish: a zoomed "flip-through" rolodex view — only if it earns its keep.)*

### Phase 2 — Display case + skills
3 slots, click-to-add / click-to-remove from binder, cased-card bonuses, hidden combos,
skill aggregation (binder prestige + case + vending) feeding a `Skills` provider.

### Phase 3 — Convention money loop
Wire existing guest-charge NPCs to **buy**: pick a pile by visitor profile → decrement stock →
add to cash box. **Booth station** screen: stock + prices; collect animation
(`"12 sales! +€127 +3 Reputation"`, coins fly). Visitor variety (normal/collector/whale),
Prestige/Attraction effects.

### Phase 4 — Shop pack loop
**Shop Counter** screen: buy packs (by set, bulk). In-world **rip**: cards fly onto shop floor
face-down + rarity glow → click / hold-hover to reveal → "first!"/"holo!" → into collection + stock.
Luck shifts odds.

### Phase 5 — Trade offers + unlocks
Booth `?` visitors; pictogram tasks; green/grey completability; named-card (discovery) vs
pile-quantity (consume) trades; rewards. **Certain trades unlock a new convention + its set**
(progression gate — see §2.9).

### Phase 6 — Vending machine
3-option rotating offers, 15-min rotation, one purchase per rotation, timed boosts + permanents
+ discounts, `boosts` runtime.

### Phase 7 — Arcade (meta screen)
Stats with sources + achievements. Not a minigame.

### Phase 8 — Polish & save
Set unlock progression, audio (reveal/holo/cash/pling), balancing pass, more sets.

---

## 6. What we need from you (assets + data)

### Assets (placeholders fine until you're ready)
- **Card faces** — start with **one set (~30)**; classic `63:88` portrait. Style? (pixel-art to
  match, or crisp illustration in the popup.)
- **Card back** (face-down look).
- **Pack art** (booster you rip).
- **Money/coin** sprite (for fly-to-bank).
- **4 skill icons** — Reputation, Luck, Prestige, Attraction.
- *(later)* SFX: reveal, holo, cash, pling.

(Rarity glows, "first!/holo!" badges, holo shimmer → generated in code.)

### Design data (more blocking than art)
- **First set definition:** ~30 card names/themes + which are common/rare/epic/chase + which can be holo.
- Confirm/adjust **economy numbers** (§3.2).
- Confirm **rarity/pile model** (§3.1).

---

## 7. Resolved decisions

1. **Rarity model:** ✅ common/rare/epic/chase, holo on rare/epic/chase, common can't be holo
   = 7 piles ("uncommon" in the brief = common).
2. **Collection access:** ✅ persistent on-screen button (no walking).
3. **Menu tech:** ✅ HTML/CSS overlays over a dimmed Phaser band.
4. **Unlocks:** ✅ trades unlock new conventions; each convention unlock also unlocks its set
   (§2.9). Recorded in `Game Mechanic Brief.md`.
5. **Window/panels:** ✅ tall transparent click-through window; small world band at the bottom;
   big chunky toy panels float into the transparent headroom (§0, §1, §1A).

### Still needed from you (assets + first-set data) — see §6
First set card list (names + rarity + holo-eligibility), card faces, card back, pack art,
coin sprite, 4 skill icons.
