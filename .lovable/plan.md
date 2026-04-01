

# Agent Office — Personal AI Agent Dashboard

A dark-mode, mobile-friendly command center for managing 7 AI coding agents, their tasks, plans, job sweep results, and an inbox. Single user (Jash), no auth.

## Design System
- **Dark mode only** — background `#0a0a0a`, cards `#141414`, borders `#262626`
- Zinc/neutral tones, blue accent (`#3b82f6`) for active states/CTAs
- Inter font, monospace for numbers/scores/tokens
- Flat cards with subtle borders, no gradients, no animations
- Generous padding (p-4 to p-6), consistent gaps (gap-4)

## Layout
- **Top bar**: "Agent Office" title, total token counter, inbox notification badge
- **Desktop**: Sidebar navigation (Dashboard, Agents, Tasks, Plans, Jobs, Inbox)
- **Mobile**: Bottom tab bar navigation, single column layout

## Database (Supabase, RLS disabled)
5 tables: `agents`, `tasks`, `plans`, `inbox`, `sweep_results` — per the provided schema. Seed 7 agents (Hivemind, Omega, Prism, Oracle, Sentinel, Hawkeye, Atlas).

## Pages

### 1. Dashboard (Home)
- Agent Status Grid: 7 cards (2-3 col desktop, 1 col mobile) with name, department badge, status dot, current task, tokens used
- Quick Stats Row: queued tasks, in-progress, done today, unread inbox
- Recent Inbox: last 5 messages

### 2. Agents
- Expandable agent cards with full details, task history, token usage
- Inline status update dropdown
- "Assign Task" button that opens task creation with agent pre-selected

### 3. Tasks (Kanban)
- 4-column board: Queued → In Progress → Done → Blocked
- Task cards with title, assigned agent, priority badge, source badge
- "New Task" slide-over form with all fields
- Filter bar: by agent, priority, status

### 4. Plans
- List view sorted newest first with title, status badge, date
- Click to expand: renders markdown content
- "New Plan" form with title + markdown textarea
- Status dropdown progression: draft → approved → executing → done

### 5. Jobs (Ghost Sweep)
- Table of sweep results sorted by ghost_score descending
- Color-coded ghost scores (green 70+, yellow 40-69, red <40)
- Verdict badges, fit_score ≥ 6 row highlighting
- Filters by verdict and minimum ghost score
- "Apply" button opens URL in new tab

### 6. Inbox
- Chronological message list with agent name, message, type badge, timestamp
- Mark as read on click, "Mark all read" button
- Filter by type and agent

## Shared Components
`AgentCard`, `TaskCard`, `TaskForm`, `PlanCard`, `PlanForm`, `InboxMessage`, `SweepTable`, `StatCard`, `StatusBadge`, `Layout`

## UX Details
- Empty states for all lists/tables
- Skeleton loaders while data fetches
- Manual refresh (no WebSockets)
- No auth, no settings, no chat, no analytics charts

