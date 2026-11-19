# Bus Fever: Party Passenger Loop

A playable mobile-first portrait (9:16) **parking jam + color sorting** puzzle game built with **TypeScript, Vite, and Phaser 3**.

---

## Quick Start

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (default `http://localhost:5173/`). You can also deep-link straight to a specific level with `?level=1` (e.g., `http://localhost:5173/?level=20`).

### Useful Commands
- `npm run dev` — Start the Vite development server
- `npm run build` — Type-check with `tsc --noEmit` and build production bundle (`dist/`)
- `npm test` — Run all Vitest unit and level validation tests
- `npm run validate-levels` — Run the standalone level geometry, parity, and booster-free solvability validator across `/src/levels/*.json`

---

## Architecture Overview

The game separates pure deterministic simulation logic (unit-tested in Node/Vitest) from Phaser 3 rendering and audio:

```text
src/
  types/
    game.ts              # Core data contracts, color palette, booster & save types
  systems/
    BusSystem.ts         # 2D Swept Oriented Bounding Box (SAT) collision + mystery unlocks
    ParkingLot.ts        # 7-slot parking strip (1 VIP, 3 normal, 3 '+' extra slots)
    PassengerSystem.ts   # Queue expansion, front-only color matching, segment jumble
    BoosterSystem.ts     # Level-gated boosters (VIP, Arrange, Jumble, Unlock Slot)
    GameEngine.ts        # Snapshot-based Undo, Win/Lose deadlock evaluation, star rating
    LevelSolver.ts       # Geometry/parity checker & memoized DFS booster-free solver
  utils/
    LevelLoader.ts       # Dynamic import.meta.glob loader for /src/levels/*.json
    SaveManager.ts       # localStorage persistence (progression, coins, boosters, missions, settings)
    TrackGeometry.ts     # Arc-length parameterized Catmull-Rom track splines (ring/heart/snake/figure8)
    TextureFactory.ts    # Procedural 3D-look sprites (buses, passengers, crates, arrows, icons)
  audio/
    SoundManager.ts      # Web Audio SFX synthesizer + navigator.vibrate haptics
  scenes/
    HomeScene.ts         # Meta hub: Play CTA, Level Select (1–25), Maple Event, Missions, Leaderboard
    GameScene.ts         # Gameplay canvas: Top Passenger Loop + Middle Parking Strip + Bottom Board
    UIScene.ts           # Overlay HUD: Header (Undo/Restart/Level/Pause), Booster Bar, Win/Fail/Booster Modals
  levels/
    level-01.json .. level-25.json
    level-event-01.json  # "Maple Bus Escape Challenge" seasonal event
  systems/
    InfiniteLevelGenerator.ts  # Procedural verified endless levels for Level 26+
```

---

## How to Add a Level (Data-Only)

Levels are automatically discovered by `LevelLoader` from `src/levels/*.json` via Vite's `import.meta.glob`. Drop a new JSON file (e.g., `src/levels/level-26.json`) and run `npm run validate-levels` to verify zero overlaps, matching color capacities, and booster-free solvability.

### Level JSON Schema Example

```json
{
  "id": 26,
  "name": "Sunset Roundabout",
  "gridSize": {
    "cols": 6,
    "rows": 6
  },
  "buses": [
    {
      "id": "b1",
      "color": "blue",
      "capacity": 6,
      "x": 0.5,
      "y": 0,
      "direction": "left",
      "type": "normal"
    },
    {
      "id": "b2",
      "color": "brown",
      "capacity": 8,
      "x": 2,
      "y": 1.5,
      "direction": "up-right",
      "type": "mystery",
      "unlockAfter": 4
    }
  ],
  "obstacles": [
    {
      "id": "o1",
      "x": 3,
      "y": 2,
      "width": 0.86,
      "height": 0.86,
      "angle": 0
    }
  ],
  "passengerQueue": [
    { "color": "blue", "count": 6 },
    { "color": "brown", "count": 8 }
  ],
  "trackShape": "heart",
  "theme": "park",
  "slotsUnlocked": 3,
  "vipUnlocked": false,
  "boostersAvailable": {
    "vip": true,
    "arrange": true,
    "jumble": true
  },
  "undoLimit": 3,
  "tutorialHint": "Optional onboarding banner text"
}
```

### Field Reference
- **Colors (`BusColor`)**: `pink`, `orange`, `green`, `purple`, `yellow`, `cyan`, `blue`, `red`, `brown`, `navy`
- **Directions (`Direction`)**: `up`, `down`, `left`, `right`, `up-left`, `up-right`, `down-left`, `down-right`
- **Bus Types**: `normal`, `mystery` (uses `unlockAfter` = number of board exits before unlocking)
- **Track Shapes**: `ring`, `heart`, `snake`, `figure8`
- **Themes**: `city`, `park`, `maple`
- **Parity Requirement**: For every color `c`, `sum(bus.capacity)` must equal `sum(passengerSegment.count)`.

---

## Tuning Difficulty

1. **Parking Slot Buffer (`slotsUnlocked`)**: Keeping `slotsUnlocked` at `3` creates tighter slot pressure; raising it to `4` makes a level more forgiving.
2. **Queue Segment Interleaving**: Splitting a bus's passengers across non-adjacent segments (or placing late-exiting inner bus colors earlier in `passengerQueue`) forces players to reserve slots carefully.
3. **Board Layering & Obstacles**: Blocking inner buses behind outer buses (`up`/`down`/`left`/`right` chains or 45-degree diagonal clusters) and adding static wooden `obstacles` increases topological depth.
4. **Mystery Buses (`unlockAfter`)**: Higher `unlockAfter` values keep bus colors hidden longer, limiting early color visibility and delaying access to those seats.
5. **Progression Rollout**:
   - **Levels 1–4**: `up`/`left`/`right` arrows, 2–4 colors, `city` theme (VIP unlocks at Level 4).
   - **Levels 5–10**: Mixed orthogonal arrows (`down` added), 5–6 colors, `ring`/`heart`/`snake`/`figure8` (Arrange unlocks at Level 8).
   - **Levels 11–19**: `park` theme, wooden obstacles (Level 11+), Jumble booster (Level 13+), Mystery buses (Level 14+).
   - **Levels 20–25**: Hard diagonal clusters, dark colors (`brown`, `navy`), obstacles, and multi-stage Mystery locks.
