
# Autonomous Task Intake & Assignment System

## Overview
When a plan or task is submitted, an edge function evaluates all agents, assigns ownership based on role/department fit, and moves work to active status automatically.

## Database Changes
- New `task_assignments` table to track which agent claimed what, why, and their role (owner/support/observer)
- Add realtime to tasks table for live updates

## Edge Function: `assign-task`
- Receives a task ID
- Loads all agents and the task details
- Uses role-based matching logic:
  - **Hivemind** (Orchestration) → project management, coordination tasks
  - **Omega** (Architecture) → system design, infrastructure tasks
  - **Prism** (Frontend) → UI, design, frontend tasks
  - **Oracle** (Intelligence) → data analysis, research tasks
  - **Sentinel** (Security) → security, compliance tasks
  - **Hawkeye** (QA) → testing, quality tasks
  - **Atlas** (Backend) → API, database, backend tasks
- Scores each agent's fit (0-100) based on keyword matching and department relevance
- Assigns: top scorer = owner, 2nd+ with score > 50 = support, rest = inactive
- Inserts assignment records with reasoning
- Updates task status from "queued" → "in_progress"
- Updates assigned agent's status to "working" with current_task set

## Frontend: Task Assignment Feed
- New component showing real-time assignment decisions
- Visible on Tasks page as an "Assignment Log" panel
- Shows: task title, owner agent, support agents, reasoning, timestamp

## Auto-trigger
- TaskForm submission calls the edge function after inserting the task
- Plan creation on Plans page also triggers assignment

## Files Changed
- `supabase/functions/assign-task/index.ts` — new edge function
- `src/components/TaskForm.tsx` — call assign-task after insert
- `src/components/AssignmentFeed.tsx` — new component showing assignment log
- `src/pages/TasksPage.tsx` — add AssignmentFeed
- Migration: create `task_assignments` table
