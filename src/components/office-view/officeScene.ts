import { Container } from "pixi.js";
import {
  drawRoom, drawDesk, drawAgent, drawChair, drawWallClock,
  drawCEO, drawCollabTable, drawHallway, drawBreakRoom, drawBed,
  drawWhiteboard, drawFilingCabinet, drawDeskLamp, drawRug,
  DESK_W, DESK_H, getAgentColor,
} from "./officeDrawing";

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
  { name: "Orchestration", tint: 0x3b82f6 },
  { name: "Architecture", tint: 0xa855f7 },
  { name: "UI/UX", tint: 0xf59e0b },
  { name: "Research", tint: 0x10b981 },
  { name: "Review", tint: 0x06b6d4 },
  { name: "DevOps", tint: 0xf43f5e },
];

// Layout constants
const GRID_COLS = 3;
const ROOM_GAP = 16;
const ROOM_PAD_LEFT = 16;
const ROOM_PAD_RIGHT = 16;
const ROOM_HEADER_H = 52;
const SLOT_W = 100;
const SLOT_H = 155;
const ROOM_BOTTOM_PAD = 18;
const CEO_OFFICE_H = 220;
const HALLWAY_H = 32;
const EDGE_PAD = 16;

export interface AgentSprite {
  container: Container;
  agent: Agent;
  baseY: number;
  baseX: number;
}

export interface SceneResult {
  root: Container;
  agentSprites: AgentSprite[];
  ceoContainer: Container;
  ceoBounds: { x: number; y: number; w: number; h: number };
  roomContainers: { container: Container; y: number; h: number; name: string }[];
  coffeeMachinePos: { x: number; y: number };
  mugPositions: { x: number; y: number }[];
  monitorScreens: { container: Container; status: string }[];
}

function slotsPerRow(roomW: number): number {
  return Math.max(1, Math.floor((roomW - ROOM_PAD_LEFT - ROOM_PAD_RIGHT) / SLOT_W));
}

function roomHeight(agentCount: number, roomW: number): number {
  const cols = slotsPerRow(roomW);
  const rows = Math.max(1, Math.ceil(agentCount / cols));
  return ROOM_HEADER_H + rows * SLOT_H + ROOM_BOTTOM_PAD;
}

function hashSpriteNum(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (hash % 14) + 1;
}

let lastSceneHeight = 480;

export function buildScene(
  agents: Agent[],
  parentWidth: number
): SceneResult {
  const root = new Container();
  const agentSprites: AgentSprite[] = [];
  const roomContainers: SceneResult["roomContainers"] = [];
  const mugPositions: { x: number; y: number }[] = [];
  const monitorScreens: { container: Container; status: string }[] = [];
  let cursorY = 0;

  const fullW = parentWidth - EDGE_PAD * 2;

  // === CEO Office ===
  const ceoRoom = drawRoom("CEO Office — Jash", fullW, CEO_OFFICE_H, 0xf59e0b);
  ceoRoom.position.set(EDGE_PAD, cursorY);
  root.addChild(ceoRoom);

  // Rug under collab table
  const rug = drawRug(fullW / 2, CEO_OFFICE_H / 2 + 14, 90, 30, 0xf59e0b);
  ceoRoom.addChild(rug);

  // Collab table
  const collabTable = drawCollabTable(fullW / 2, CEO_OFFICE_H / 2 + 10);
  ceoRoom.addChild(collabTable);

  // CEO avatar
  const ceoAvatar = drawCEO(fullW / 2, CEO_OFFICE_H / 2 - 30);
  ceoRoom.addChild(ceoAvatar);

  const ceoBounds = {
    x: EDGE_PAD + 30,
    y: cursorY + 40,
    w: fullW - 60,
    h: CEO_OFFICE_H - 60,
  };

  // Wall clock
  const ceoClock = drawWallClock(fullW - 24, 15);
  ceoRoom.addChild(ceoClock);

  cursorY += CEO_OFFICE_H + ROOM_GAP;

  // === Hallway ===
  const hallway = drawHallway(fullW);
  hallway.position.set(EDGE_PAD, cursorY);
  root.addChild(hallway);
  cursorY += HALLWAY_H + ROOM_GAP;

  // === Department Grid ===
  const byDept: Record<string, Agent[]> = {};
  for (const a of agents) {
    const dept = a.department || "Dev";
    if (!byDept[dept]) byDept[dept] = [];
    byDept[dept].push(a);
  }

  const cols = parentWidth < 720 ? 2 : GRID_COLS;
  const roomW = Math.floor((fullW - (cols - 1) * ROOM_GAP) / cols);
  const clampedRoomW = Math.max(220, roomW);

  const roomHeights = DEPARTMENTS.map((dept) =>
    roomHeight((byDept[dept.name] || []).length, clampedRoomW)
  );

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

  const deptStartY = cursorY;

  DEPARTMENTS.forEach((dept, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);

    let ry = deptStartY;
    for (let r = 0; r < row; r++) ry += rowHeights[r] + ROOM_GAP;

    const rx = EDGE_PAD + col * (clampedRoomW + ROOM_GAP);
    const rh = rowHeights[row];

    const room = drawRoom(dept.name, clampedRoomW, rh, dept.tint);
    room.position.set(rx, ry);
    root.addChild(room);

    roomContainers.push({ container: room, y: ry, h: rh, name: dept.name });

    // Wall clock
    const clock = drawWallClock(clampedRoomW - 24, 15);
    room.addChild(clock);

    // Whiteboard in top-right area
    const wb = drawWhiteboard(clampedRoomW - 40, 28);
    room.addChild(wb);

    // Filing cabinet in even-indexed rooms
    if (idx % 2 === 0) {
      const fc = drawFilingCabinet(clampedRoomW - 18, rh - 28);
      room.addChild(fc);
    }

    const deptAgents = byDept[dept.name] || [];
    const perRow = slotsPerRow(clampedRoomW);

    deptAgents.forEach((agent, ai) => {
      const agentCol = ai % perRow;
      const agentRow = Math.floor(ai / perRow);

      const slotAreaW = Math.min(deptAgents.length, perRow) * SLOT_W;
      const slotOffsetX = Math.floor((clampedRoomW - slotAreaW) / 2);

      const deskX = slotOffsetX + agentCol * SLOT_W + Math.floor((SLOT_W - DESK_W) / 2);
      const deskY = ROOM_HEADER_H + agentRow * SLOT_H;

      const desk = drawDesk(deskX, deskY);
      room.addChild(desk);

      // Track mug world position (mug is at DESK_W - 14, DESK_H - 14 relative to desk)
      mugPositions.push({
        x: rx + deskX + DESK_W - 14,
        y: ry + deskY + DESK_H - 14,
      });

      // Track monitor screen for working agents
      const monScreen = desk.children.find((c) => c.label === "monitor-screen");
      if (monScreen) {
        monitorScreens.push({ container: monScreen as Container, status: agent.status });
      }

      const chair = drawChair(deskX + DESK_W / 2, deskY + DESK_H + 16, getAgentColor(agent.name));
      room.addChild(chair);

      // Bed for offline agents
      if (agent.status === "offline") {
        const bed = drawBed(deskX + DESK_W + 20, deskY + DESK_H + 30);
        room.addChild(bed);
      }

      const agentX = deskX + DESK_W / 2;
      const agentY = deskY + DESK_H + 50;
      const spriteNum = hashSpriteNum(agent.id);
      const agentContainer = drawAgent(agent.name, agent.status, agentX, agentY, spriteNum, agent.department);
      room.addChild(agentContainer);

      agentSprites.push({
        container: agentContainer,
        agent,
        baseY: ry + agentY,
        baseX: rx + agentX,
      });
    });
  });

  // Update cursorY past department grid
  for (const rh of rowHeights) cursorY += rh + ROOM_GAP;

  // === Break Room ===
  cursorY += ROOM_GAP;
  const breakRoom = drawBreakRoom(fullW);
  breakRoom.position.set(EDGE_PAD, cursorY);
  root.addChild(breakRoom);

  const coffeeMachinePos = { x: EDGE_PAD + 60, y: cursorY + 50 };

  cursorY += 160 + 20;
  lastSceneHeight = cursorY;

  return {
    root,
    agentSprites,
    ceoContainer: ceoAvatar,
    ceoBounds,
    roomContainers,
    coffeeMachinePos,
    mugPositions,
    monitorScreens,
  };
}

export function getSceneHeight(): number {
  return lastSceneHeight;
}
