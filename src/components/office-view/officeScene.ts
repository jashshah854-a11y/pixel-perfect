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

// Layout constants
const GRID_COLS = 3;
const ROOM_GAP = 16;
const ROOM_PAD_LEFT = 16;
const ROOM_PAD_RIGHT = 16;
const ROOM_HEADER_H = 52;  // wall / header zone
const SLOT_W = 100;        // horizontal space per agent slot
const SLOT_H = 155;        // vertical space per agent row (desk + chair + avatar + gap)
const ROOM_BOTTOM_PAD = 18;

export interface AgentSprite {
  container: Container;
  agent: Agent;
  baseY: number;
  baseX: number;
}

/** How many agent columns fit inside a room of the given width */
function slotsPerRow(roomW: number): number {
  return Math.max(1, Math.floor((roomW - ROOM_PAD_LEFT - ROOM_PAD_RIGHT) / SLOT_W));
}

/** Dynamic room height based on how many agent rows are needed */
function roomHeight(agentCount: number, roomW: number): number {
  const cols = slotsPerRow(roomW);
  const rows = Math.max(1, Math.ceil(agentCount / cols));
  return ROOM_HEADER_H + rows * SLOT_H + ROOM_BOTTOM_PAD;
}

/** Scene-level state so getSceneHeight() can return the computed value */
let lastSceneHeight = 480;

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

  // Responsive column count: drop to 2 cols if viewport is narrow
  const cols = parentWidth < 720 ? 2 : GRID_COLS;

  // Room width scales to fill parent evenly
  const roomW = Math.floor(
    (parentWidth - 32 - (cols - 1) * ROOM_GAP) / cols
  );
  const clampedRoomW = Math.max(220, roomW);

  // Pre-calculate each department's room height
  const roomHeights = DEPARTMENTS.map((dept) =>
    roomHeight((byDept[dept.name] || []).length, clampedRoomW)
  );

  // For each grid row, all rooms share the tallest height in that row
  const gridRows = Math.ceil(DEPARTMENTS.length / cols);
  const rowHeights: number[] = [];
  for (let r = 0; r < gridRows; r++) {
    let maxH = 0;
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx < roomHeights.length) maxH = Math.max(maxH, roomHeights[idx]);
    }
    rowHeights.push(maxH);
  }

  // Cumulative row Y offsets
  const rowY: number[] = [];
  let cy = 0;
  for (const h of rowHeights) {
    rowY.push(cy);
    cy += h + ROOM_GAP;
  }
  lastSceneHeight = cy - ROOM_GAP + 20;

  const offsetX = 16; // left edge padding

  DEPARTMENTS.forEach((dept, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const rx = offsetX + col * (clampedRoomW + ROOM_GAP);
    const ry = rowY[row];
    const rh = rowHeights[row];

    const room = drawRoom(dept.name, clampedRoomW, rh, dept.tint);
    room.position.set(rx, ry);
    root.addChild(room);

    // Wall clock top-right
    const clock = drawWallClock(clampedRoomW - 24, 15);
    room.addChild(clock);

    const deptAgents = byDept[dept.name] || [];
    const perRow = slotsPerRow(clampedRoomW);

    deptAgents.forEach((agent, ai) => {
      const agentCol = ai % perRow;
      const agentRow = Math.floor(ai / perRow);

      // Center slots horizontally within the room
      const slotAreaW = Math.min(deptAgents.length, perRow) * SLOT_W;
      const slotOffsetX = Math.floor((clampedRoomW - slotAreaW) / 2);

      const deskX = slotOffsetX + agentCol * SLOT_W + Math.floor((SLOT_W - DESK_W) / 2);
      const deskY = ROOM_HEADER_H + agentRow * SLOT_H;

      const desk = drawDesk(deskX, deskY);
      room.addChild(desk);

      const chair = drawChair(deskX + DESK_W / 2, deskY + DESK_H + 16, getAgentColor(agent.name));
      room.addChild(chair);

      const agentX = deskX + DESK_W / 2;
      const agentY = deskY + DESK_H + 50;
      const agentContainer = drawAgent(agent.name, agent.status, agentX, agentY);
      room.addChild(agentContainer);

      agentSprites.push({
        container: agentContainer,
        agent,
        baseY: ry + agentY,
        baseX: rx + agentX,
      });
    });
  });

  return { root, agentSprites };
}

export function getSceneHeight(): number {
  return lastSceneHeight;
}
