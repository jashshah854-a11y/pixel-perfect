

# PixiJS Canvas Agent Office

Replace the current HTML-based Office page with an interactive 2D canvas office powered by PixiJS 8, where agents sit at desks in department rooms with animations and status indicators.

---

## What Gets Built

A full-screen PixiJS canvas showing a top-down office floor with:
- **Department rooms** (3-column grid): Dev, Design, Planning, Operations, QA, DevSecOps — each with a tinted floor, wall header, and agent desks
- **Agent desks**: Procedurally drawn (monitor, keyboard, chair, coffee mug) — no sprite files needed
- **Agent characters**: Simple procedural avatars (colored circles with initials, matching existing `agentColors`) that bob/pulse based on status
- **Status visualization**: Working = green pulse, idle = subtle breathing, paused = yellow glow, offline = greyed/sleeping
- **Click interaction**: Clicking an agent opens an HTML overlay popover with full details (reuses existing `AgentDesk` popover content)
- **Chat room**: HTML overlay at bottom of page (keeps existing `OfficeChat` component, positioned over the canvas)
- **Smooth rendering**: `antialias: true`, `scaleMode: "linear"` — no pixel crunch

## Architecture

```text
OfficePage.tsx
├── OfficeCanvas.tsx          (PixiJS canvas + React bridge)
│   ├── useOfficePixiRuntime.ts  (PixiJS app init, resize, cleanup)
│   ├── officeScene.ts           (build rooms, desks, agents)
│   ├── officeTicker.ts          (animation loop: bobbing, pulses, clock)
│   └── officeDrawing.ts         (procedural desk/furniture/avatar drawing)
├── OfficeChat.tsx            (existing, overlaid as HTML)
└── Agent click popover       (HTML overlay, positioned at click coords)
```

## Technical Details

### Dependencies
- Install `pixi.js@^8` (the only new dependency)

### Files Created/Modified
1. **`src/components/office-view/useOfficePixiRuntime.ts`** — Initialize PixiJS Application, attach to container ref, handle resize/cleanup
2. **`src/components/office-view/officeDrawing.ts`** — Procedural drawing functions: `drawDesk()`, `drawAgent()`, `drawRoom()`, `drawFloor()`
3. **`src/components/office-view/officeScene.ts`** — Build the full scene: lay out department rooms in a grid, place agents at desks based on DB data
4. **`src/components/office-view/officeTicker.ts`** — Animation ticker: agent bobbing, status pulse, wall clock hands
5. **`src/components/office-view/OfficeCanvas.tsx`** — React component wrapping the PixiJS canvas, queries agents from Supabase, rebuilds scene on data change
6. **`src/pages/OfficePage.tsx`** — Modified: replace HTML grid with `OfficeCanvas` + overlay `OfficeChat`

### Visual Layout
```text
┌──────────────────────────────────────────────┐
│  Dev Room        │  Design Room   │  Planning │
│  ┌──┐ ┌──┐      │  ┌──┐ ┌──┐    │  ┌──┐     │
│  │H │ │O │      │  │P │ │  │    │  │Or│     │
│  └──┘ └──┘      │  └──┘ └──┘    │  └──┘     │
│  desk  desk     │  desk  desk   │  desk     │
├──────────────────┴───────────────┴───────────┤
│  Operations      │  QA Room      │  DevSecOps│
│  ┌──┐            │  ┌──┐         │  ┌──┐     │
│  │S │            │  │Hw│         │  │At│     │
│  └──┘            │  └──┘         │  └──┘     │
│  desk            │  desk         │  desk     │
├──────────────────────────────────────────────┤
│  ┌─── Chat Room ──────────────────────────┐  │
│  │ Hivemind: Starting deploy pipeline     │  │
│  │ > Type a message...                    │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### Procedural Art (No Sprites Needed)
All visuals drawn with PixiJS Graphics API:
- **Rooms**: Rounded rectangles with tinted fills per department theme, subtle border, header bar with department name
- **Desks**: Layered rectangles (wood surface, monitor rectangle with glow, small keyboard, coffee mug circle)
- **Agents**: Colored circle (matching `agentColors` from existing code) with white initial letter, seated at desk. Status dot in corner.
- **Furniture details**: Paper stacks, pencil holders — simple geometric shapes

### Animations (via ticker)
- Working agents: gentle vertical bob (`sin(tick * 0.04) * 2`), green aura pulse
- Idle agents: slow breathing scale (`1 + sin(tick * 0.02) * 0.01`)
- Offline agents: `alpha: 0.4`, no animation
- Monitor screens: subtle color shift to simulate activity

### Interaction
- Canvas click → hit-test agent sprites → show HTML popover overlay at screen position
- Popover reuses the same agent detail content (role, department, tokens, current task)

### No Changes To
- Database schema (uses existing `agents` table)
- `OfficeChat` component (reused as-is, positioned as HTML overlay)
- Other pages or components

