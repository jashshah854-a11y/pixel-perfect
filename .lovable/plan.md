

# Claw-Empire Style Office — Smooth, Lively, Full-Featured

Rebuild the Office page to match claw-empire's architecture and liveliness, but with smooth anti-aliased rendering instead of pixelated art. All procedural — no sprite files needed.

---

## What Changes

### Current State
- 6 department rooms in a 3-col grid with desks, chairs, circle avatars
- Basic bobbing/breathing animations, wall clocks
- No CEO, no break room, no hallway, no walking, no particles

### Target State
A vertically scrolling office floor with distinct zones:

```text
┌─────────────────────────────────────────┐
│  CEO Office (Jash)                      │
│  WASD-controlled avatar + crown         │
│  6-seat collaboration table             │
├─────────────────────────────────────────┤
│  Hallway (separator strip)              │
├───────────┬───────────┬─────────────────┤
│  Dev      │  Design   │  Planning       │
│  agents   │  agents   │  agents         │
│  at desks │  at desks │  at desks       │
├───────────┼───────────┼─────────────────┤
│  Ops      │  QA       │  DevSecOps      │
│  agents   │  agents   │  agents         │
├───────────┴───────────┴─────────────────┤
│  Break Room                             │
│  Coffee machine, bookshelf, steam       │
└─────────────────────────────────────────┘
```

---

## Key Features

### 1. CEO Office (top zone)
- Full-width room at top with unique tint (gold/warm)
- Procedural CEO avatar: larger circle with crown floating above (bobbing `sin` animation)
- WASD/arrow key movement within the CEO office bounds (7px/frame, bounded)
- 6-seat collaboration table in the center (procedural rounded rect + chairs)
- Viewport auto-scrolls to follow CEO if scene is taller than viewport

### 2. Hallway
- 32px tall separator between CEO office and department grid
- Subtle floor pattern, different tile color
- Decorative: small potted plants at edges

### 3. Department Grid (existing, enhanced)
- Keep current 3-col layout with all existing furniture
- Agents get a **bed** drawn next to desk (hidden unless status is `offline` or `sleeping`)
- When offline, agent avatar moves to bed position, dims to 0.35 alpha
- Room highlight: pulsing accent border when CEO enters that department's Y-range

### 4. Break Room (bottom zone)
- Full-width room at bottom
- Procedural coffee machine (chrome body, indicator lights, drip tray)
- Bookshelf (individual books with colored spines, small trophy)
- Animated coffee steam particles (small circles rising from machine, fading out)
- 2-3 break room chairs/sofas

### 5. Ambient Particle System
- **Coffee steam**: 8-12 small circles rising from each coffee mug on desks, fading and drifting
- **Monitor glow pulse**: subtle alpha oscillation on the desk glow ellipse
- Managed in ticker with a simple particle pool (array of {x, y, alpha, vy} objects)

### 6. CEO Crown Animation
- Small golden triangle/crown shape above CEO circle
- Floating bob: `y = baseY + sin(tick * 0.06) * 2`
- Subtle rotation: `rotation = sin(tick * 0.04) * 0.05`

---

## Files Modified/Created

### Modified
- **`officeScene.ts`** — Add CEO office zone, hallway, break room, beds. Scene now builds top-to-bottom: CEO → hallway → department grid → break room. Export CEO container for movement.
- **`officeDrawing.ts`** — Add: `drawCEO()`, `drawCrown()`, `drawCollabTable()`, `drawHallway()`, `drawBreakRoom()`, `drawCoffeeMachine()`, `drawBookshelf()`, `drawBed()`, `drawPlant()`
- **`officeTicker.ts`** — Add: CEO movement (WASD key state), crown animation, room highlight pulse, coffee steam particles, viewport follow
- **`OfficeCanvas.tsx`** — Wire keyboard listeners for CEO movement, pass key state to ticker, handle viewport scrolling
- **`OfficePage.tsx`** — No major changes (canvas handles everything)

### Architecture
```text
OfficeCanvas.tsx
├── useOfficePixiRuntime.ts  (unchanged)
├── officeScene.ts           (CEO office + hallway + departments + break room)
├── officeDrawing.ts         (all procedural art)
└── officeTicker.ts          (animations + CEO movement + particles)
```

---

## Technical Details

### CEO Movement
- Track key state via `keydown`/`keyup` on the canvas container (tabIndex=0)
- Each tick: move CEO container by 7px in pressed direction(s), clamp to CEO office bounds
- Auto-scroll: if CEO.y is near edge of viewport, scroll the PixiJS stage or container div

### Particle System (simple)
- Array of `{x, y, vx, vy, alpha, life}` objects
- Each tick: update position, decrement alpha/life, remove dead particles
- Spawn new particles at coffee mug positions every ~30 ticks
- Render as small Graphics circles (redrawn each frame, or use a shared particle container)

### Room Highlight
- Track which department room's Y-range the CEO is in
- That room's border stroke alpha pulses: `0.35 + sin(tick * 0.06) * 0.25`

### Bed Drawing
- Small rounded rectangle (mattress) with pillow circle, blanket overlay
- Positioned offset from desk, only visible when agent status is `offline`
- Agent avatar repositions to bed center when offline

### Smooth Rendering (already in place)
- `antialias: true` ✓
- No `imageRendering: "pixelated"` ✓
- `resolution: devicePixelRatio` ✓

### No Database Changes
Uses existing `agents` table. No new tables or columns needed.

