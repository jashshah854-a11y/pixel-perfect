

# CEO Command Center Redesign

This is a large, coordinated transformation spanning scene layout, navigation, task assignment, orchestration flow, inbox control, and a knowledge/learning dashboard. Here is the implementation plan.

---

## 1. Navigation Overhaul

**Sidebar becomes collapsible slide-out panel:**
- Replace the static `<aside>` in `Layout.tsx` with a hover-activated slide-out panel using absolute positioning
- Hidden by default (width: 0), expands on mouse enter near left edge (within 16px) or a small trigger icon
- Smooth CSS transition (300ms ease)
- Swap nav order: Office, **Tasks** (second), Agents, Plans, Inbox

**Files:** `src/components/Layout.tsx`

---

## 2. Office Scene Spatial Redesign

Rework `officeScene.ts` to restructure the CEO War Room into three distinct zones:

```text
┌─────────────────────────────────────────────────┐
│ CEO WAR ROOM                                    │
│ ┌──────────┐  ┌─────────────────────┐  ┌──────┐│
│ │ Personal │  │   Central Meeting   │  │Quick ││
│ │ CEO      │  │   Table (large,     │  │Assign││
│ │ Office   │  │   clear purpose)    │  │Panel ││
│ │ (left)   │  │   with chairs       │  │      ││
│ └──────────┘  └─────────────────────┘  └──────┘│
│ [Multi-monitor wall]  [Activity indicators]     │
└─────────────────────────────────────────────────┘
```

- **Left zone (25% width):** CEO avatar, personal desk with monitors, golden rug — the "personal office"
- **Center zone (50% width):** Large conference table with 8 chairs, overhead lighting, whiteboard — clear "meeting/collaboration space"
- **Right zone (25% width):** Quick task assignment panel (drawn as a command console with inline task creation)
- Increase `CEO_OFFICE_H` from 240 to ~360 for more presence
- Add ambient elements: holographic displays, status boards, data feeds to make it feel active

**Neural Lounge clarity:** Rename to "NEURAL LOUNGE — REST & RECHARGE", add sleeping pods alongside sofas, dim the lighting tint, add "zen" ambient particles. This makes it clearly a rest/recovery space.

**Files:** `src/components/office-view/officeScene.ts`, `src/components/office-view/officeDrawing.ts`

---

## 3. Department Room Click-to-Enter Interaction

Add click handlers on department room containers so clicking a room zooms/scrolls the canvas to that room. This removes the "can't access workspaces" limitation.

- Each room becomes clickable (already has `eventMode` potential)
- On click, smooth scroll the container div to that room's Y position
- Add a visual hover effect (brighter border glow) on room hover
- Add a "Back to CEO" button overlay when scrolled to a department

**Files:** `src/components/office-view/OfficeCanvas.tsx`, `src/components/office-view/officeScene.ts`

---

## 4. In-Office Task Assignment

Add a React overlay panel on the right side of the Office page (not in PixiJS) for quick task creation and assignment without leaving the Office.

- Small floating panel with: title input, priority selector, "Assign" button
- On submit: creates task in DB, calls `assign-task` edge function, triggers claim animation + Hivemind dispatch
- Panel is collapsible, toggled via a button in the Office header

**Files:** `src/pages/OfficePage.tsx` (new `QuickTaskPanel` component inline or separate file)

---

## 5. Omega Orchestrator Flow

Modify the plan submission flow so plans are routed through Omega:

- Update `decompose-plan/index.ts` to explicitly assign the coordination task to Omega (agent with role containing "orchestrat" or name "omega")
- Omega gets `owner` role on the coordination subtask; other subtasks get assigned to best-fit agents as before
- Add inbox notification: "Omega received your plan and is distributing work"
- On the Plans page, show "Sent to Omega for orchestration" status badge after submission

**Files:** `supabase/functions/decompose-plan/index.ts`, `src/pages/PlansPage.tsx`

---

## 6. Inbox Clear All

Add a "Clear All" button to InboxPage that deletes all inbox messages (with confirmation dialog).

- Migration: Add DELETE RLS policy on inbox table (`true` for public)
- Button with `AlertDialog` confirmation: "This will permanently remove all messages. Continue?"
- On confirm: `supabase.from("inbox").delete().neq("id", "")`

**Files:** `src/pages/InboxPage.tsx`, new migration for DELETE policy

---

## 7. Learning & Knowledge Log

Create a new `KnowledgeLog` component accessible from the Office page (as a slide-out panel or tab):

- Query `tasks` table (completed), join with `task_assignments` and `agent_memory`
- Display as expandable cards:
  - Task title, completion date, assigned agent name, priority badge
  - Expandable detail: description, agent reasoning from `task_assignments.reasoning`, memories learned from `agent_memory` linked via `source_task_id`
- Filter by agent, date range, task type
- Summary stats at top: total completed, total memories, avg confidence

**Files:** New `src/components/KnowledgeLog.tsx`, integrate into `src/pages/OfficePage.tsx`

---

## Technical Summary

| Area | Files Modified | New Files |
|------|---------------|-----------|
| Navigation | `Layout.tsx` | — |
| Scene layout | `officeScene.ts`, `officeDrawing.ts` | — |
| Room interaction | `OfficeCanvas.tsx` | — |
| Quick assign | `OfficePage.tsx` | `QuickTaskPanel.tsx` |
| Omega orchestrator | `decompose-plan/index.ts`, `PlansPage.tsx` | — |
| Inbox clear | `InboxPage.tsx` | Migration |
| Knowledge log | `OfficePage.tsx` | `KnowledgeLog.tsx` |

**Migration needed:** DELETE policy on `inbox` table.

