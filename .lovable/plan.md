
# Multi-Agent Collaboration & Learning System

## Overview
Build a persistent intelligence layer across the agent office with three pillars: cross-agent collaboration, long-term learning from interactions, and autonomous self-improvement.

---

## Part 1: Database Schema

### New Tables
1. **`agent_memory`** — Persistent learning store per agent
   - agent_id, memory_type (preference/pattern/correction/insight), content, source_task_id, confidence, created_at
   - Types: "preference" (my style/standards), "pattern" (recurring task patterns), "correction" (mistakes to avoid), "insight" (learned from research)

2. **`agent_collaborations`** — Cross-agent coordination log
   - id, task_id, from_agent, to_agent, collab_type (handoff/request_help/share_finding/review), message, status (pending/accepted/completed), created_at

3. **`agent_research_log`** — Autonomous research tracking
   - id, agent_id, topic, findings, source_url, relevance_score, applied (boolean), researched_at

### Modified Tables
- Enable realtime on agent_collaborations for live coordination visibility

---

## Part 2: Edge Functions

### `agent-collaborate` — Cross-agent coordination
- Accepts: from_agent, to_agent, task_id, collab_type, message
- Creates collaboration record
- Sends inbox notification to receiving agent
- Updates both agents' status when collaboration starts

### `agent-learn` — Memory extraction from completed tasks
- Accepts: task_id (completed task)
- Analyzes task title, description, assignment history, corrections
- Extracts learnings per agent: what worked, what was corrected, patterns
- Stores in agent_memory with confidence scoring
- Uses Lovable AI to extract structured insights from task context

### `agent-research` — Autonomous self-improvement
- Accepts: agent_id
- Based on agent's role/department, generates relevant research topics
- Uses Lovable AI to synthesize improvements
- Stores findings in agent_research_log
- Only applies insights above confidence threshold (guardrail)

---

## Part 3: UI Components

### CollaborationPanel (new)
- Shows active collaborations between agents
- Visual thread of handoffs, requests, shared findings
- Displayed on Tasks page and Office page

### AgentMemoryView (new)
- Shows what each agent has learned over time
- Categorized by: preferences, patterns, corrections, insights
- Accessible from agent detail popover

### ResearchActivityFeed (new)
- Shows autonomous research activity
- What agents studied, what they learned, what was applied
- Visible on Dashboard or dedicated section

---

## Part 4: Integration Points

- TaskForm → after task completion, triggers `agent-learn`
- Office idle state → periodically triggers `agent-research` for idle agents
- Task assignment → checks agent_memory for better routing decisions
- Collaboration triggers automatically when task spans multiple departments

---

## Files Changed
- Migration: 3 new tables
- `supabase/functions/agent-collaborate/index.ts` — new
- `supabase/functions/agent-learn/index.ts` — new
- `supabase/functions/agent-research/index.ts` — new
- `src/components/CollaborationPanel.tsx` — new
- `src/components/AgentMemoryView.tsx` — new
- `src/components/ResearchFeed.tsx` — new
- `src/pages/TasksPage.tsx` — add collaboration panel
- `src/pages/OfficePage.tsx` — add collaboration visibility
- `src/pages/AgentsPage.tsx` — add memory view to agent cards
