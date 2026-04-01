import { Container } from "pixi.js";
import { drawRoom, drawDesk, drawAgent, drawChair, drawWallClock, DESK_W, DESK_H, getAgentColor } from "./officeDrawing";

interface Agent {
  id: string;
  name: string;
  status: string;
  role: string;
  department: string;
  current_task: string | null;
  tokens_used: number;
}

interface DepartmentDef {
  name: string;
  tint: number;
}

const DEPARTMENTS: DepartmentDef[] = [
  { name: "Dev", tint: 0x3b82f6 },
  { name: "Design", tint: 0xa855f7 },
  { name: "Planning", tint: 0xf59e0b },
  { name: "Operations", tint: 0x10b981 },
  { name: "QA", tint: 0x06b6d4 },
  { name: "DevSecOps", tint: 0xf43f5e },
];

const ROOM_W = 300;
const ROOM_H = 220;
const ROOM_GAP = 16;
const COLS = 3;
const SLOT_W = 120;

export interface AgentSprite {
  container: Container;
  agent: Agent;
  baseY: number;
  baseX: number;
}

export function buildScene(
  agents: Agent[],
  parentWidth: number
): { root: Container; agentSprites: AgentSprite[] } {
  const root = new Container();
  const agentSprites: AgentSprite[] = [];

  // Group agents by department
  const byDept: Record<string, Agent[]> = {};
  for (const a of agents) {
    const dept = a.department || "Dev";
    if (!byDept[dept]) byDept[dept] = [];
    byDept[dept].push(a);
  }

  // Calculate centering offset
  const gridW = COLS * ROOM_W + (COLS - 1) * ROOM_GAP;
  const offsetX = Math.max(16, (parentWidth - gridW) / 2);

  DEPARTMENTS.forEach((dept, idx) => {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const rx = offsetX + col * (ROOM_W + ROOM_GAP);
    const ry = row * (ROOM_H + ROOM_GAP);

    const room = drawRoom(dept.name, ROOM_W, ROOM_H, dept.tint);
    room.position.set(rx, ry);
    root.addChild(room);

    // Wall clock in top-right of room
    const clock = drawWallClock(ROOM_W - 20, 15);
    room.addChild(clock);

    const deptAgents = byDept[dept.name] || [];
    deptAgents.forEach((agent, ai) => {
      const deskX = 20 + ai * SLOT_W;
      const deskY = 55;

      // Desk
      const desk = drawDesk(deskX, deskY);
      room.addChild(desk);

      // Chair below desk
      const chair = drawChair(deskX + DESK_W / 2, deskY + DESK_H + 18, getAgentColor(agent.name));
      room.addChild(chair);

      // Agent below chair
      const agentX = deskX + DESK_W / 2;
      const agentY = deskY + DESK_H + 52;
      const agentContainer = drawAgent(agent.name, agent.status, agentX, agentY);
      room.addChild(agentContainer);

      agentSprites.push({
        container: agentContainer,
        agent,
        baseY: agentY,
        baseX: agentX,
      });
    });
  });

  return { root, agentSprites };
}

export function getSceneHeight(): number {
  const rows = Math.ceil(DEPARTMENTS.length / COLS);
  return rows * (ROOM_H + ROOM_GAP) - ROOM_GAP + 20;
}
