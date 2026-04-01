

# Integrations Redesign + Agent Office Space

Two features: (1) a cleaner, calmer Integrations page, and (2) a new interactive "Office" page where your 7 agents live, move around, and can talk to each other.

---

## 1. Integrations Page Redesign

**Problem:** Too many cards, tabs, dots, counts — visually overwhelming.

**New design:** A clean grouped list layout instead of a noisy grid.

- **Remove the tab bar entirely.** Instead, show tools grouped by category with subtle section headers (e.g. "AI Models", "Infrastructure").
- **Simplify each row:** Just the tool name, a single status dot, and last-ping timestamp. No category label per card (redundant with the section), no config role text, no test button on every card.
- **Click to expand:** Clicking a row opens inline details (accordion-style) instead of a slide-out sheet — less jarring. Shows API URL, notes, config, and a Test Connection button only in expanded state.
- **Header:** Minimal — just "Integrations" title and a single summary line like "11 active · 5 available · 2 error" using colored dots.
- **Layout:** Single column list, max-width ~640px, centered. Feels like a settings page, not a dashboard.

### Files changed
- `src/pages/IntegrationsPage.tsx` — full rewrite from grid to grouped accordion list

---

## 2. Agent Office Space (new page: `/office`)

Inspired by clawEmpire — a visual 2D office floor where each agent has a desk/workspace and you can see what they're doing.

### Visual concept
```text
┌─────────────────────────────────────────────┐
│                AGENT OFFICE                 │
│                                             │
│   ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐      │
│   │ 🟢  │  │ ⚪  │  │ 🟢  │  │ ⚪  │      │
│   │Hive │  │Omega│  │Prism│  │Oracle│      │
│   │mind │  │     │  │     │  │     │      │
│   │work-│  │idle │  │work-│  │idle │      │
│   │ ing │  │     │  │ ing │  │     │      │
│   └─────┘  └─────┘  └─────┘  └─────┘      │
│                                             │
│   ┌─────┐  ┌─────┐  ┌─────┐               │
│   │ 🟡  │  │ ⚪  │  │ 🔴  │               │
│   │Sent-│  │Hawk-│  │Atlas│               │
│   │inel │  │ eye │  │     │               │
│   │paus-│  │idle │  │off- │               │
│   │ ed  │  │     │  │line │               │
│   └─────┘  └─────┘  └─────┘               │
│                                             │
│  ┌─── Chat Room ──────────────────────┐     │
│  │ Hivemind: Starting deploy pipeline │     │
│  │ Atlas: Ready, waiting for build    │     │
│  │ Sentinel: Reviewing PR #42         │     │
│  │ > Type a message...                │     │
│  └────────────────────────────────────┘     │
└─────────────────────────────────────────────┘
```

### Design
- **Office floor:** Grid of "desks" — each agent gets a card-like workspace showing their avatar (colored circle with initial), name, status, current task, and a subtle idle/working animation (pulsing dot, not distracting).
- **Status visualization:** Working agents have a green glow/pulse. Idle agents are dimmed. Offline agents are greyed out.
- **Click an agent:** Opens a popover/panel with full details — role, department, token usage, ability to change status or assign a task.
- **Chat Room panel** at the bottom: A shared message feed where agents "talk." This uses the `inbox` table filtered to agent-to-agent messages, displayed chronologically. You (Jash) can also type messages into the chat. New messages get inserted into `inbox` with `from_agent = null` (meaning from you).
- **No animation/movement** of agents walking around (keeping it simple and performant). The "office" feel comes from the spatial layout and the chat room.

### Technical details
- New page: `src/pages/OfficePage.tsx`
- New route: `/office` added to `App.tsx`
- New nav item in `Layout.tsx` (with a Building icon)
- Chat inserts to `inbox` table with a new type `"chat"` to distinguish from system messages
- Database: Add `to_agent` column to `inbox` table (nullable text) so agents can message each other, not just broadcast
- Components: `AgentDesk` (single workspace tile), `OfficeChat` (the chat panel)

### Files changed
- `src/pages/OfficePage.tsx` — new page
- `src/components/AgentDesk.tsx` — workspace tile component
- `src/components/OfficeChat.tsx` — chat room component
- `src/App.tsx` — add `/office` route
- `src/components/Layout.tsx` — add "Office" nav item
- Database migration — add `to_agent` column to `inbox`

