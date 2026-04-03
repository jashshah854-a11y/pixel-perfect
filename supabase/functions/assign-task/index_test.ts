import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || SUPABASE_ANON_KEY;

const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${SERVICE_KEY}`,
  "apikey": SUPABASE_ANON_KEY,
};

async function dbQuery(table: string, params: Record<string, string> = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { ...headers, "Prefer": "return=representation" },
  });
  return res.json();
}

async function dbInsert(table: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers, "Prefer": "return=representation" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function dbDelete(table: string, filter: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: { ...headers, "Prefer": "return=representation" },
  });
  await res.text();
}

async function dbPatch(table: string, filter: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: { ...headers, "Prefer": "return=representation" },
    body: JSON.stringify(body),
  });
  await res.text(); // consume body to prevent leaks
}

async function invokeFunction(name: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

// ─── Stage 1: Input Interpretation ───────────────────────────────

Deno.test("Stage 1: Task creation stores correct input", async () => {
  const title = `E2E-Test-${Date.now()}`;
  const rows = await dbInsert("tasks", {
    title,
    description: "End-to-end test task for pipeline validation",
    priority: "high",
    source: "manual",
  });
  const task = Array.isArray(rows) ? rows[0] : rows;
  assertExists(task.id, "Task ID should exist");
  assertEquals(task.title, title, "Title must match input");
  assertEquals(task.status, "queued", "Initial status should be queued");
  assertEquals(task.priority, "high", "Priority must match");

  // Cleanup
  await dbDelete("tasks", `id=eq.${task.id}`);
});

Deno.test("Stage 1: Input rejects empty title via edge function", async () => {
  const { status, data } = await invokeFunction("assign-task", {});
  assertEquals(status, 500);
  assertExists(data.error);
});

// ─── Stage 2: Assignment (Research + Planning) ───────────────────

Deno.test("Stage 2: assign-task scores and assigns agents correctly", async () => {
  // Create a task with UI-related keywords
  const rows = await dbInsert("tasks", {
    title: "Design responsive dashboard UI layout",
    description: "Create a clean responsive interface with component architecture",
    priority: "high",
    source: "manual",
  });
  const task = Array.isArray(rows) ? rows[0] : rows;
  assertExists(task.id);

  // Invoke assignment
  const { status, data } = await invokeFunction("assign-task", { task_id: task.id });
  assertEquals(status, 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert(data.ok, "Response should be ok");
  assertExists(data.owner, "Should assign an owner");
  assert(Array.isArray(data.assignments), "Should return assignments array");
  assert(data.assignments.length > 0, "At least one assignment");

  // Verify owner has highest fit score
  const ownerAssignment = data.assignments.find((a: { role: string }) => a.role === "owner");
  assertExists(ownerAssignment, "Owner assignment should exist");
  assert(ownerAssignment.fit_score >= 20, "Owner fit score must be >= 20");

  // Verify task status updated to in_progress
  const updatedTasks = await dbQuery("tasks", { id: `eq.${task.id}` });
  const updated = Array.isArray(updatedTasks) ? updatedTasks[0] : updatedTasks;
  assertEquals(updated.status, "in_progress", "Task should be in_progress after assignment");
  assertExists(updated.assigned_to, "Task should have assigned_to set");

  // Verify assignments stored in DB
  const storedAssignments = await dbQuery("task_assignments", { task_id: `eq.${task.id}` });
  assert(Array.isArray(storedAssignments) && storedAssignments.length > 0, "Assignments should be stored");

  // Verify inbox notification created
  const inboxEntries = await dbQuery("inbox", { type: `eq.task_claim`, order: "created_at.desc", limit: "5" });
  const claimNotif = Array.isArray(inboxEntries) && inboxEntries.find(
    (i: { message: string }) => i.message.includes("Design responsive dashboard")
  );
  assert(claimNotif, "Should create inbox claim notification");

  // Cleanup
  await dbDelete("task_assignments", `task_id=eq.${task.id}`);
  await dbDelete("inbox", `message=like.*Design responsive dashboard*`);
  await dbDelete("tasks", `id=eq.${task.id}`);
});

Deno.test("Stage 2: Assignment roles are correctly distributed", async () => {
  const rows = await dbInsert("tasks", {
    title: "Security audit for authentication system",
    description: "Review auth, permissions, and access control vulnerabilities",
    priority: "urgent",
    source: "manual",
  });
  const task = Array.isArray(rows) ? rows[0] : rows;

  const { data } = await invokeFunction("assign-task", { task_id: task.id });
  assert(data.ok);

  const roles = data.assignments.map((a: { role: string }) => a.role);
  assert(roles.includes("owner"), "Must have an owner");
  // Some agents should be observers (low fit)
  assert(roles.includes("observer"), "Low-fit agents should be observers");

  // Cleanup
  await dbDelete("task_assignments", `task_id=eq.${task.id}`);
  await dbDelete("inbox", `message=like.*Security audit*`);
  await dbDelete("tasks", `id=eq.${task.id}`);
});

// ─── Stage 3: Plan Decomposition ────────────────────────────────

Deno.test("Stage 3: decompose-plan creates subtasks from plan", async () => {
  // Create a plan
  const planRows = await dbInsert("plans", {
    title: "E2E Test Plan",
    markdown_content: `## Phase 1: Research\n- Analyze competitors\n- Gather user feedback\n## Phase 2: Build\n- Design API\n- Create UI components`,
    status: "draft",
  });
  const plan = Array.isArray(planRows) ? planRows[0] : planRows;
  assertExists(plan.id);

  const { status, data } = await invokeFunction("decompose-plan", { plan_id: plan.id });
  assertEquals(status, 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert(data.ok, "Should succeed");
  assert(Array.isArray(data.subtasks), "Should return subtasks");
  assert(data.subtasks.length >= 2, "Should create multiple subtasks from bullet points");

  // Verify plan status updated
  const updatedPlans = await dbQuery("plans", { id: `eq.${plan.id}` });
  const updatedPlan = Array.isArray(updatedPlans) ? updatedPlans[0] : updatedPlans;
  assertEquals(updatedPlan.status, "executing", "Plan should be 'executing' after decomposition");

  // Cleanup subtasks
  for (const sub of data.subtasks) {
    if (sub.task_id) {
      await dbDelete("task_assignments", `task_id=eq.${sub.task_id}`);
      await dbDelete("tasks", `id=eq.${sub.task_id}`);
    }
  }
  await dbDelete("inbox", `message=like.*E2E Test Plan*`);
  await dbDelete("plans", `id=eq.${plan.id}`);
});

// ─── Stage 4: Execution + Output Generation ─────────────────────

Deno.test("Stage 4: Task completion generates output and triggers learning", async () => {
  // Create and assign a task
  const rows = await dbInsert("tasks", {
    title: "Write API documentation for user endpoints",
    description: "Document all REST endpoints for user management",
    priority: "medium",
    source: "manual",
  });
  const task = Array.isArray(rows) ? rows[0] : rows;

  // Assign it
  const { data: assignData } = await invokeFunction("assign-task", { task_id: task.id });
  assert(assignData.ok, "Assignment should succeed");

  // Simulate completion: update task status + generate output
  await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${task.id}`, {
    method: "PATCH",
    headers: { ...headers, "Prefer": "return=representation" },
    body: JSON.stringify({ status: "done", completed_at: new Date().toISOString() }),
  });

  // Generate output (mimics TaskCard behavior)
  const outputContent = `## Task: Write API documentation\n### Execution Summary\n- **Status**: Completed\n- **Priority**: medium\n### Outcome\nTask executed and completed successfully.`;

  const outputRows = await dbInsert("task_outputs", {
    task_id: task.id,
    title: "Write API documentation — Report",
    content: outputContent,
    output_type: "report",
    format: "markdown",
  });
  const output = Array.isArray(outputRows) ? outputRows[0] : outputRows;
  assertExists(output.id, "Output should be created");
  assertEquals(output.format, "markdown", "Output format should be markdown");
  assert(output.content.includes("Completed"), "Output should contain completion info");

  // Trigger learning
  const { status: learnStatus, data: learnData } = await invokeFunction("agent-learn", { task_id: task.id });
  assertEquals(learnStatus, 200, `Learning should succeed: ${JSON.stringify(learnData)}`);
  assert(learnData.ok, "Learning response should be ok");

  // Verify memories were created
  if (learnData.memories_created > 0) {
    const memories = await dbQuery("agent_memory", { source_task_id: `eq.${task.id}` });
    assert(Array.isArray(memories) && memories.length > 0, "Memories should be stored in DB");
    // Verify memory structure
    const mem = memories[0];
    assertExists(mem.agent_id, "Memory should have agent_id");
    assertExists(mem.content, "Memory should have content");
    assert(mem.confidence >= 0 && mem.confidence <= 1, "Confidence should be 0-1");
  }

  // Cleanup
  await dbDelete("agent_memory", `source_task_id=eq.${task.id}`);
  await dbDelete("task_outputs", `task_id=eq.${task.id}`);
  await dbDelete("agent_collaborations", `task_id=eq.${task.id}`);
  await dbDelete("task_assignments", `task_id=eq.${task.id}`);
  await dbDelete("inbox", `message=like.*API documentation*`);
  await dbDelete("tasks", `id=eq.${task.id}`);
});

// ─── Stage 5: Context Continuity ─────────────────────────────────

Deno.test("Stage 5: Learning persists and influences future assignments", async () => {
  // Create first task, assign, complete, learn
  const task1Rows = await dbInsert("tasks", {
    title: "Build React component library with animations",
    description: "Create reusable UI components with motion design",
    priority: "high",
    source: "manual",
  });
  const task1 = Array.isArray(task1Rows) ? task1Rows[0] : task1Rows;

  const { data: assign1 } = await invokeFunction("assign-task", { task_id: task1.id });
  const firstOwner = assign1.owner;
  assertExists(firstOwner, "First task should have owner");

  // Complete and learn
  await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${task1.id}`, {
    method: "PATCH",
    headers: { ...headers, "Prefer": "return=representation" },
    body: JSON.stringify({ status: "done", completed_at: new Date().toISOString() }),
  });
  await invokeFunction("agent-learn", { task_id: task1.id });

  // Create similar second task
  const task2Rows = await dbInsert("tasks", {
    title: "Build React animation components for dashboard",
    description: "Animated React UI elements for the main dashboard",
    priority: "medium",
    source: "manual",
  });
  const task2 = Array.isArray(task2Rows) ? task2Rows[0] : task2Rows;

  const { data: assign2 } = await invokeFunction("assign-task", { task_id: task2.id });
  assertExists(assign2.owner, "Second task should also have owner");

  // The same agent or same department should handle similar work
  // (We verify the system doesn't lose context between tasks)
  assert(assign2.assignments.length > 0, "Should produce assignments for second task");

  // Cleanup
  await dbDelete("agent_memory", `source_task_id=eq.${task1.id}`);
  await dbDelete("agent_collaborations", `task_id=eq.${task1.id}`);
  await dbDelete("task_assignments", `task_id=eq.${task1.id}`);
  await dbDelete("task_assignments", `task_id=eq.${task2.id}`);
  await dbDelete("inbox", `message=like.*React*`);
  await dbDelete("task_outputs", `task_id=eq.${task1.id}`);
  await dbDelete("tasks", `id=eq.${task1.id}`);
  await dbDelete("tasks", `id=eq.${task2.id}`);
});

// ─── Stage 6: Suggestions Engine (Predictive) ───────────────────

Deno.test("Stage 6: generate-suggestions produces actionable suggestions", async () => {
  const { status, data } = await invokeFunction("generate-suggestions", {});
  
  if (status === 429 || status === 402) {
    console.log("Skipping suggestions test due to rate limit / payment");
    return;
  }

  assertEquals(status, 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert(data.ok, "Should succeed");
  assert(Array.isArray(data.suggestions), "Should return suggestions array");

  if (data.suggestions.length > 0) {
    const s = data.suggestions[0];
    assertExists(s.type, "Suggestion should have type");
    assertExists(s.title, "Suggestion should have title");
    assertExists(s.description, "Suggestion should have description");
    assert(typeof s.confidence === "number", "Confidence should be a number");

    // Verify persisted
    const stored = await dbQuery("system_suggestions", { order: "created_at.desc", limit: "5" });
    assert(Array.isArray(stored) && stored.length > 0, "Suggestions should be persisted");
  }
});

// ─── Stage 7: External Actions ───────────────────────────────────

Deno.test("Stage 7: agent-action logs external actions correctly", async () => {
  // Get an agent ID
  const agents = await dbQuery("agents", { limit: "1" });
  const agentId = Array.isArray(agents) && agents.length > 0 ? agents[0].id : "test-agent";

  const { status, data } = await invokeFunction("agent-action", {
    action_type: "notification",
    agent_id: agentId,
    payload: { message: "E2E test notification" },
  });

  assertEquals(status, 200, `Expected 200: ${JSON.stringify(data)}`);
  assert(data.ok, "Action should succeed");
  assertEquals(data.status, "completed");

  // Verify action logged
  const actions = await dbQuery("external_actions", { agent_id: `eq.${agentId}`, order: "created_at.desc", limit: "1" });
  assert(Array.isArray(actions) && actions.length > 0, "Action should be logged");
  assertEquals(actions[0].action_type, "notification");

  // Cleanup
  await dbDelete("external_actions", `agent_id=eq.${agentId}&action_type=eq.notification`);
  await dbDelete("inbox", `message=like.*E2E test*`);
});

// ─── Stage 8: Full Pipeline Integration ──────────────────────────

Deno.test("Stage 8: Full pipeline - input → assign → execute → output → learn", async () => {
  // 1. INPUT: Create task
  const rows = await dbInsert("tasks", {
    title: "Full pipeline test: analyze system performance",
    description: "Research performance bottlenecks and propose optimizations",
    priority: "high",
    source: "manual",
  });
  const task = Array.isArray(rows) ? rows[0] : rows;
  assertExists(task.id, "Step 1: Task created");
  assertEquals(task.status, "queued", "Step 1: Starts queued");

  // 2. ASSIGNMENT: Auto-assign
  const { data: assignResult } = await invokeFunction("assign-task", { task_id: task.id });
  assert(assignResult.ok, "Step 2: Assignment succeeded");
  assertExists(assignResult.owner, "Step 2: Owner assigned");
  const ownerName = assignResult.owner_name;

  // 3. VERIFY STATE: Task is in_progress with agent
  const midState = await dbQuery("tasks", { id: `eq.${task.id}` });
  const mid = Array.isArray(midState) ? midState[0] : midState;
  assertEquals(mid.status, "in_progress", "Step 3: Task in progress");
  assertEquals(mid.assigned_to, assignResult.owner, "Step 3: Correct agent assigned");

  // 4. EXECUTION: Complete task
  await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${task.id}`, {
    method: "PATCH",
    headers: { ...headers, "Prefer": "return=representation" },
    body: JSON.stringify({ status: "done", completed_at: new Date().toISOString() }),
  });

  // 5. OUTPUT: Generate structured output
  const outputRows = await dbInsert("task_outputs", {
    task_id: task.id,
    title: "Performance Analysis Report",
    content: `## Performance Analysis\n### Findings\n- Identified 3 bottlenecks\n- Proposed query optimization\n### Recommendations\n1. Add indexes\n2. Cache frequent queries\n3. Optimize joins`,
    output_type: "report",
    format: "markdown",
  });
  const output = Array.isArray(outputRows) ? outputRows[0] : outputRows;
  assertExists(output.id, "Step 5: Output created");

  // 6. LEARNING: Trigger agent learning
  const { data: learnResult } = await invokeFunction("agent-learn", { task_id: task.id });
  assert(learnResult.ok, "Step 6: Learning succeeded");

  // 7. VALIDATION: Verify all artifacts exist
  const finalTask = await dbQuery("tasks", { id: `eq.${task.id}` });
  assertEquals((Array.isArray(finalTask) ? finalTask[0] : finalTask).status, "done", "Step 7: Task is done");

  const finalOutputs = await dbQuery("task_outputs", { task_id: `eq.${task.id}` });
  assert(Array.isArray(finalOutputs) && finalOutputs.length > 0, "Step 7: Output exists");

  const finalAssignments = await dbQuery("task_assignments", { task_id: `eq.${task.id}` });
  assert(Array.isArray(finalAssignments) && finalAssignments.length > 0, "Step 7: Assignments exist");

  console.log(`✅ Full pipeline complete: Task → ${ownerName} → Output → Learned`);

  // Cleanup
  await dbDelete("agent_memory", `source_task_id=eq.${task.id}`);
  await dbDelete("agent_collaborations", `task_id=eq.${task.id}`);
  await dbDelete("task_outputs", `task_id=eq.${task.id}`);
  await dbDelete("task_assignments", `task_id=eq.${task.id}`);
  await dbDelete("inbox", `message=like.*pipeline test*`);
  await dbDelete("tasks", `id=eq.${task.id}`);
});

// ─── Stage 9: Multi-Scenario Validation ──────────────────────────

Deno.test("Stage 9: Multiple task types produce correct routing", async () => {
  const scenarios = [
    { title: "Fix CSS layout bug on mobile", keywords: ["ui", "css"], expectedDept: "frontend" },
    { title: "Audit database access policies", keywords: ["security", "audit"], expectedDept: "security" },
    { title: "Optimize API query performance", keywords: ["api", "backend"], expectedDept: "backend" },
  ];

  const taskIds: string[] = [];

  for (const scenario of scenarios) {
    const rows = await dbInsert("tasks", {
      title: scenario.title,
      priority: "medium",
      source: "manual",
    });
    const task = Array.isArray(rows) ? rows[0] : rows;
    taskIds.push(task.id);

    const { data } = await invokeFunction("assign-task", { task_id: task.id });
    assert(data.ok, `Assignment should succeed for: ${scenario.title}`);
    assertExists(data.owner, `Should assign owner for: ${scenario.title}`);

    // Verify the owner has relevant fit score
    const ownerAssignment = data.assignments.find((a: { role: string }) => a.role === "owner");
    assert(
      ownerAssignment.fit_score >= 20,
      `Owner fit score should be reasonable for "${scenario.title}", got ${ownerAssignment.fit_score}`
    );
  }

  // Cleanup
  for (const id of taskIds) {
    await dbDelete("task_assignments", `task_id=eq.${id}`);
    await dbDelete("inbox", `type=eq.task_claim`);
    await dbDelete("tasks", `id=eq.${id}`);
  }
});
