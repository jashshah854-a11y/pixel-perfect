# Premium 4K AI Command Center — Office Redesign

## Vision
Transform the current office from a functional grid of rooms into an immersive, cinematic AI command center with executive-grade visual quality.

---

## Phase 1: Room & Layout Upgrade

**CEO War Room** (top):
- Wider, taller room with holographic-style data overlays
- Multiple monitor wall (3 screens side by side) showing live agent status
- Executive desk with ambient underglow
- Premium rug with geometric pattern
- Subtle grid floor pattern with cyan accent lines

**Department Rooms** (6 rooms in 3x2 grid):
- Deeper floors with premium checkerboard tiles
- LED strip accents along walls (colored per department)
- Each room gets a holographic department insignia (circle + icon glyph)
- Glass partition effect on room borders (frosted glass stroke)

**Break Room** → **Neural Lounge**:
- Rename and redesign as a sleek relaxation/recharge zone
- Add ambient lighting effects (warm glow patches)
- Premium coffee bar with steam particles

---

## Phase 2: Agent Figure Enhancement

- Add subtle idle sway animation (weight shifting left/right)
- Working agents get floating code/text particles above their heads
- Status indicators become glowing rings instead of dots
- Agents cast directional shadows based on desk lamp positions

---

## Phase 3: Environment Enrichment

**New Objects**:
- Server rack (in DevOps room) — blinking LED lights
- Research globe (in Research room) — wireframe sphere
- Code terminal (on each desk) — scrolling green text lines on monitor
- Ambient ceiling lights — soft glow cones from above

**Existing Upgrades**:
- Monitors get visible code/data lines scrolling
- Coffee mugs get more detailed steam
- Whiteboards get diagrams (circles + lines)

---

## Phase 4: Atmosphere & Polish

- Ambient particle layer: floating dust motes with slow drift
- Subtle vignette overlay (darker edges)
- Room-to-room connecting lines (data flow visualization)
- Premium font upgrade for room labels (larger, tracked out)

---

## Files Changed
- `src/components/office-view/officeDrawing.ts` — Major rewrite of room, desk, agent rendering
- `src/components/office-view/officeScene.ts` — Updated layout constants, new objects placement
- `src/components/office-view/officeTicker.ts` — New animations (idle sway, code particles, LED blink)
- `src/components/office-view/OfficeCanvas.tsx` — Ambient overlay layer

## What Stays the Same
- WASD CEO movement
- Agent click interaction
- Database schema
- All other pages