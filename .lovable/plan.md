

# Fix Character Faces + Enrich Environment

## Problem
Agents currently render as pixel art sprites (`/sprites/*.png`) — pixelated figures that look unnatural. The CEO uses procedural drawing but the face proportions create a mask-like appearance. You want smooth, human characters with natural faces, plus a richer lived-in environment.

---

## Part 1: Replace Pixel Art Sprites with Smooth Procedural Characters

**In `officeDrawing.ts` — rewrite `drawAgent`:**

Remove the `Sprite.from(...)` call entirely. Draw each agent as a smooth vector humanoid:

- **Head**: Circle (radius ~10), warm skin tone `0xf5d0a9`. No elongated shapes.
- **Eyes**: Two small filled circles (radius 1.5) placed at the horizontal center of the head, spaced 6px apart. Dark fill `0x2d2d2d`. Single white highlight dot (0.6px) in each eye.
- **Mouth**: A short arc (width ~5px) — upward curve for working, straight line for idle, slight frown for paused, none for offline.
- **No nose protrusion** — just a tiny dot or nothing. This is what caused the plague-doctor look previously.
- **Hair**: A half-circle cap on top of the head. Color varies per agent using a hash of the name (brown, black, auburn, blonde palette).
- **Body**: Rounded rectangle torso (14×16), tinted with the agent's department color. Subtle collar line at top.
- **Arms**: Two small rounded rectangles hanging from torso sides. Skin-colored hands (small circles at bottom).
- **Legs**: Two short rounded rectangles below torso, dark pants color. Small shoe shapes at bottom.

**Key proportions** (preventing the mask look):
- Head-to-body ratio: ~1:1.2 (head slightly smaller than torso height)
- Eyes sit at vertical center of face, not too high
- Face width = head diameter, no protruding features
- Total figure height ~52px (matches current `SPRITE_H`)

**Also rewrite `drawCEO`** with the same face system, keeping the suit/tie/crown.

**Remove** sprite preloading from `OfficeCanvas.tsx` (`SPRITE_URLS`, `Assets.load`).

### Files changed
- `src/components/office-view/officeDrawing.ts` — `drawAgent` and `drawCEO` rewritten
- `src/components/office-view/OfficeCanvas.tsx` — remove sprite asset loading, make init synchronous again

---

## Part 2: Enrich Environment

Add functional, grounded objects to department rooms and break room. All procedural Graphics drawing.

**New drawing functions in `officeDrawing.ts`:**

| Object | Where | Description |
|--------|-------|-------------|
| Whiteboard | Each department room, top-right area | White rounded rect with faint marker lines, small tray at bottom with colored dots (markers) |
| Water cooler | Break room, right side | Blue-tinted bottle on grey base, small cup dispenser |
| Filing cabinet | Alternating department rooms | Dark metal rect with 3 drawer lines and small handle circles |
| Desk lamp | Every other desk | Small angled arm with cone shade, warm glow circle underneath |
| Rug | CEO office, under collab table | Subtle ellipse with warm color and low alpha |

**Placement in `officeScene.ts`:**
- After drawing each room, add 1 whiteboard at `(roomW - 50, 30)`
- Add filing cabinet to rooms at even indices at `(roomW - 30, roomH - 50)`
- Add desk lamps to every other desk slot
- Add rug and water cooler to existing break room and CEO office

### Files changed
- `src/components/office-view/officeDrawing.ts` — add `drawWhiteboard`, `drawWaterCooler`, `drawFilingCabinet`, `drawDeskLamp`, `drawRug`
- `src/components/office-view/officeScene.ts` — place new objects in rooms

---

## What stays the same
- All animations in `officeTicker.ts` (bobbing, aura pulse, particles, clocks)
- Room layout, department grid, break room structure
- Agent click interaction, WASD CEO movement
- Database schema, all other pages

