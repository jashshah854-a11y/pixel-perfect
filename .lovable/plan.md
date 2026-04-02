

# Predictive Intelligence & Autonomous Command Center

A six-phase system evolution adding prediction, simulation, autonomy, external integrations, continuous learning, and executive visibility.

---

## Phase 1: Predictive Intelligence — Suggestions Engine

**New edge function: `supabase/functions/generate-suggestions/index.ts`**
- Queries recent tasks, agent workloads, blocked items, completion patterns, and agent_memory
- Uses Lovable AI (gemini-3-flash-preview) to analyze system state and generate 3-5 actionable suggestions
- Each suggestion includes: type (next_task | optimization | reassignment | risk | efficiency), title, description, confidence, and affected agents
- Returns structured output via tool calling

**New component: `src/components/PredictivePanel.tsx`**
- Fetches suggestions on mount and every 60s via polling
- Displays suggestions as prioritized cards with type-specific icons and color coding
- Each suggestion has an "Act" button that either creates a task, reassigns work, or navigates to relevant page
- Integrated into OfficePage as a new overlay panel option ("Predict" button alongside Health/Summary/Knowledge)

**Database**: New `system_suggestions` table to persist and track acted-upon suggestions (migration).

---

## Phase 2: Outcome Simulation Engine

**Upgrade `src/components/PlanPreview.tsx`**
- Add three outcome scenarios: best/expected/worst case
- For each scenario, calculate:
  - Estimated completion time based on agent workload counts
  - Risk score based on blocked task history and agent availability
  - Hivemind need assessment (if any agent is overloaded, flag Hivemind support)
- Show workload distribution bar chart per agent
- Show potential delay points (agents with 2+ active tasks)
- All computed from real DB state (tasks, assignments, agent status)

**New function in PlanPreview**: `simulateOutcomes()` that takes current system state and returns three scenario objects with metrics.

---

## Phase 3: Autonomous Execution Mode

**New edge function: `supabase/functions/autonomous-tick/index.ts`**
- Runs when triggered (via UI button or interval)
- Omega generates plans from queued/unaddressed system needs using Lovable AI
- Checks for idle agents and unassigned tasks, auto-routes them
- Dispatches Hivemind sub-agents when workload exceeds threshold
- All actions logged to `autonomous_actions` table

**Database migration**: New `autonomous_actions` table (id, action_type, description, agent_id, task_id, created_at, approved boolean)

**New component: `src/components/AutonomousControl.tsx`**
- Toggle switch for autonomous mode (stored in localStorage)
- When enabled, triggers `autonomous-tick` every 90s
- Shows live log of autonomous decisions
- "Override" button to pause and review pending actions
- Guardrails: max 3 autonomous task creations per tick, no deletion, scope limited to task creation/assignment/Hivemind dispatch

**Integration**: Added to OfficePage as a floating control in the header bar.

---

## Phase 4: Real-World Integration Layer

**New edge function: `supabase/functions/agent-action/index.ts`**
- Modular action executor supporting: email (via Lovable email if domain configured), webhook triggers, document logging
- Each action type is a handler within the function
- All actions logged to `external_actions` table with full audit trail

**Database migration**: New `external_actions` table (id, agent_id, task_id, action_type, target, payload, result, status, created_at)

**UI: Action log in SystemHealthPanel**
- New section showing recent external actions with status indicators
- Expandable to see payload and result

**Initial integrations**:
- Webhook trigger (POST to configured URL)
- Internal document logging (stores structured notes in agent_memory)
- Email notification (if email domain is configured)

---

## Phase 5: Continuous Learning & Adaptation

**Upgrade `assign-task` edge function**:
- After scoring, check `system_suggestions` for previously acted-upon suggestions that match the current task pattern
- Boost agents whose past predictions were correct (track prediction accuracy in agent_memory)
- Add a `prediction_accuracy` field to agent scoring

**Upgrade `generate-suggestions` edge function**:
- Include feedback loop: when a suggestion is acted on, track outcome
- Weight future suggestions by historical accuracy
- Surface "learning improvements" in the suggestions (e.g., "Prism's UI accuracy improved 15% this week")

**New section in KnowledgeLog**: "Learning Trajectory" showing per-agent confidence evolution over time as a simple sparkline or trend indicator.

---

## Phase 6: Executive Visibility Layer

**Upgrade `src/components/ExecutiveSummary.tsx`**:
- Add "Predicted Next Steps" section pulling from suggestions engine
- Add "Autonomous Actions" section showing recent auto-decisions
- Add "System Risks" section computed from blocked tasks, overloaded agents, and failed external actions
- Add "Learning Progress" row showing agent memory growth trend

---

## Technical Summary

| Component | Files | Type |
|-----------|-------|------|
| Suggestions engine | `generate-suggestions/index.ts`, `PredictivePanel.tsx` | Edge function + component |
| Outcome simulation | `PlanPreview.tsx` upgrade | Component |
| Autonomous mode | `autonomous-tick/index.ts`, `AutonomousControl.tsx` | Edge function + component |
| External actions | `agent-action/index.ts` | Edge function |
| Learning adaptation | `assign-task/index.ts` upgrade, `generate-suggestions` upgrade | Edge function |
| Executive upgrade | `ExecutiveSummary.tsx` upgrade | Component |
| OfficePage integration | `OfficePage.tsx` | Component |

**Migrations needed**:
1. `system_suggestions` table (type, title, description, confidence, status, acted_at, created_at)
2. `autonomous_actions` table (action_type, description, agent_id, task_id, approved, created_at)
3. `external_actions` table (agent_id, task_id, action_type, target, payload, result, status, created_at)

All three tables with public SELECT/INSERT RLS policies.

