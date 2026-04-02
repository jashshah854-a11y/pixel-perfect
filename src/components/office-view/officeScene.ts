import { Container, Graphics } from "pixi.js";
import {
  drawRoom, drawDesk, drawAgent, drawChair, drawWallClock,
  drawCEO, drawCollabTable, drawHallway, drawBreakRoom, drawBed,
  drawWhiteboard, drawFilingCabinet, drawDeskLamp, drawRug,
  drawServerRack, drawResearchGlobe, drawCeilingLight,
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

const GRID_COLS = 3;
const ROOM_GAP = 12;
const ROOM_PAD_LEFT = 16;
const ROOM_PAD_RIGHT = 16;
const ROOM_HEADER_H = 48;
const SLOT_W = 110;
const SLOT_H = 150;
const ROOM_BOTTOM_PAD = 16;
const CEO_OFFICE_H = 280;
const HALLWAY_H = 20;
const EDGE_PAD = 12;

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

// Helper: draw multi-monitor command wall
function drawCommandWall(g: Graphics, x: number, y: number, _w: number) {
  const screens = 5;
  const sw = 30, sh = 18;
  const totalW = screens * (sw + 3);
  const startX = x - totalW / 2;
  for (let i = 0; i < screens; i++) {
    const sx = startX + i * (sw + 3);
    g.roundRect(sx, y, sw, sh, 2);
    g.fill(0x0a0a0e);
    g.stroke({ color: 0x3b82f6, width: 0.5, alpha: 0.2 });
    g.roundRect(sx + 2, y + 2, sw - 4, sh - 4, 1);
    g.fill({ color: 0x0d1b2a, alpha: 0.9 });
    for (let l = 0; l < 3; l++) {
      const lw = 5 + (i * 3 + l * 7) % 10;
      g.roundRect(sx + 3, y + 4 + l * 4, lw, 1.5, 1);
      g.fill({ color: 0x3b82f6, alpha: 0.12 + (l * 0.04) });
    }
  }
  g.ellipse(x, y + sh + 3, totalW / 2, 6);
  g.fill({ color: 0x3b82f6, alpha: 0.02 });
}

// Helper: draw CEO personal desk
function drawCEODesk(g: Graphics, x: number, y: number) {
  g.roundRect(x - 40, y, 80, 30, 4);
  g.fill(0x18181b);
  g.roundRect(x - 38, y + 2, 76, 26, 3);
  g.fill(0x1e1e22);
  g.stroke({ color: 0xf59e0b, width: 0.3, alpha: 0.12 });
  // Side extension
  g.roundRect(x + 38, y + 4, 16, 22, 3);
  g.fill(0x1e1e22);
  g.stroke({ color: 0x27272a, width: 0.4 });
  // Triple monitor
  for (let i = 0; i < 3; i++) {
    const mx = x - 24 + i * 20;
    g.roundRect(mx, y - 12, 16, 10, 2);
    g.fill(0x0a0a0e);
    g.stroke({ color: 0x27272a, width: 0.5 });
    g.roundRect(mx + 1.5, y - 10.5, 13, 7, 1);
    g.fill({ color: 0x0d1b2a, alpha: 0.95 });
  }
  // Keyboard
  g.roundRect(x - 12, y + 7, 24, 7, 2);
  g.fill(0x18181b);
  g.stroke({ color: 0x27272a, width: 0.3 });
}

// Helper: draw status board
function drawStatusBoard(g: Graphics, x: number, y: number) {
  g.roundRect(x - 24, y, 48, 30, 3);
  g.fill(0x0c0c10);
  g.stroke({ color: 0x3b82f6, width: 0.5, alpha: 0.25 });
  g.roundRect(x - 22, y + 2, 44, 7, 1);
  g.fill({ color: 0x3b82f6, alpha: 0.1 });
  for (let i = 0; i < 3; i++) {
    const ry = y + 12 + i * 6;
    g.circle(x - 17, ry + 1.5, 1.5);
    g.fill({ color: [0x22c55e, 0xeab308, 0x3b82f6][i], alpha: 0.5 });
    g.roundRect(x - 12, ry, 26 - i * 4, 2.5, 1);
    g.fill({ color: 0xffffff, alpha: 0.05 });
  }
}

// Draw meeting table
function drawMeetingTable(fullW: number, y: number): Container {
  const c = new Container();
  c.label = "meeting-table";

  const g = new Graphics();
  g.ellipse(0, 6, 70, 10);
  g.fill({ color: 0x000000, alpha: 0.06 });
  g.ellipse(0, 0, 64, 16);
  g.fill(0x18181b);
  g.ellipse(0, 0, 62, 14);
  g.fill(0x1e1e22);
  g.stroke({ color: 0x27272a, width: 0.4 });
  // Center projector
  g.circle(0, 0, 4);
  g.fill({ color: 0x3b82f6, alpha: 0.06 });
  g.circle(0, 0, 2);
  g.fill({ color: 0x3b82f6, alpha: 0.12 });
  c.addChild(g);

  // 6 chairs
  const chairPositions = [
    { x: -48, y: -8 }, { x: 0, y: -20 }, { x: 48, y: -8 },
    { x: -48, y: 12 }, { x: 0, y: 24 }, { x: 48, y: 12 },
  ];
  for (const pos of chairPositions) {
    const ch = new Graphics();
    ch.ellipse(pos.x, pos.y, 6, 3);
    ch.fill({ color: 0x1e1e22, alpha: 0.7 });
    ch.stroke({ color: 0x27272a, width: 0.3 });
    c.addChild(ch);
  }

  c.position.set(fullW / 2, y);
  return c;
}

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

  // === CEO WAR ROOM ===
  const ceoRoom = drawRoom("CEO WAR ROOM — JASH", fullW, CEO_OFFICE_H, 0xf59e0b);
  ceoRoom.position.set(EDGE_PAD, cursorY);
  root.addChild(ceoRoom);

  // Center CEO avatar in the room
  const ceoX = fullW / 2;
  const ceoY = CEO_OFFICE_H * 0.55;

  // CEO desk centered
  const deskG = new Graphics();
  drawCEODesk(deskG, ceoX, ceoY - 50);
  ceoRoom.addChild(deskG);

  // Golden rug under CEO
  const rug = drawRug(ceoX, ceoY + 20, 50, 20, 0xf59e0b);
  ceoRoom.addChild(rug);

  // CEO avatar centered
  const ceoAvatar = drawCEO(ceoX, ceoY + 10);
  ceoRoom.addChild(ceoAvatar);

  // Command wall centered above desk
  const cmdWallG = new Graphics();
  drawCommandWall(cmdWallG, ceoX, 36, fullW);
  ceoRoom.addChild(cmdWallG);

  // Status boards on right side
  const rightX = fullW - 60;
  const sbG = new Graphics();
  drawStatusBoard(sbG, rightX, 50);
  drawStatusBoard(sbG, rightX, 90);
  ceoRoom.addChild(sbG);

  // Whiteboard on left side
  const wb = drawWhiteboard(80, 50);
  ceoRoom.addChild(wb);

  // Ceiling lights
  ceoRoom.addChild(drawCeilingLight(ceoX - 60, 32, 0xf59e0b));
  ceoRoom.addChild(drawCeilingLight(ceoX + 60, 32, 0xf59e0b));

  // Meeting table to the left
  const meetingTable = drawMeetingTable(fullW * 0.35, CEO_OFFICE_H * 0.55);
  meetingTable.position.set(fullW * 0.18, CEO_OFFICE_H * 0.55);
  ceoRoom.addChild(meetingTable);

  // Holographic indicator on right
  const holoG = new Graphics();
  const hx = rightX;
  holoG.circle(hx, CEO_OFFICE_H - 45, 14);
  holoG.stroke({ color: 0x3b82f6, width: 0.6, alpha: 0.15 });
  holoG.circle(hx, CEO_OFFICE_H - 45, 8);
  holoG.stroke({ color: 0x3b82f6, width: 0.4, alpha: 0.1 });
  holoG.circle(hx, CEO_OFFICE_H - 45, 4);
  holoG.fill({ color: 0x3b82f6, alpha: 0.08 });
  holoG.label = "holo-indicator";
  ceoRoom.addChild(holoG);

  const ceoClock = drawWallClock(fullW - 24, 16);
  ceoRoom.addChild(ceoClock);

  const ceoBounds = {
    x: EDGE_PAD + 10,
    y: cursorY + 35,
    w: fullW - 20,
    h: CEO_OFFICE_H - 50,
  };

  cursorY += CEO_OFFICE_H;

  // === Soft divider (gradient fade instead of harsh hallway) ===
  const divider = new Graphics();
  divider.rect(EDGE_PAD, cursorY, fullW, HALLWAY_H);
  divider.fill({ color: 0x0a0a0e, alpha: 1 });
  // Subtle top gradient line
  divider.rect(EDGE_PAD + fullW * 0.15, cursorY + HALLWAY_H / 2 - 0.5, fullW * 0.7, 1);
  divider.fill({ color: 0x262626, alpha: 0.3 });
  // Two small dots as visual anchors
  divider.circle(EDGE_PAD + fullW * 0.5, cursorY + HALLWAY_H / 2, 1.5);
  divider.fill({ color: 0x3b82f6, alpha: 0.15 });
  root.addChild(divider);
  cursorY += HALLWAY_H;

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
    room.eventMode = "static";
    room.cursor = "pointer";
    root.addChild(room);

    roomContainers.push({ container: room, y: ry, h: rh, name: dept.name });

    const clock = drawWallClock(clampedRoomW - 24, 16);
    room.addChild(clock);

    const rwb = drawWhiteboard(clampedRoomW - 40, 28);
    room.addChild(rwb);

    room.addChild(drawCeilingLight(clampedRoomW / 2, 34, dept.tint));

    if (dept.name === "DevOps") {
      const rack = drawServerRack(clampedRoomW - 18, rh - 26);
      room.addChild(rack);
    } else if (dept.name === "Research") {
      const globe = drawResearchGlobe(clampedRoomW - 20, rh - 20);
      room.addChild(globe);
    } else if (idx % 2 === 0) {
      const fc = drawFilingCabinet(clampedRoomW - 16, rh - 24);
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

      mugPositions.push({
        x: rx + deskX + DESK_W - 14,
        y: ry + deskY + DESK_H - 16,
      });

      const monL = desk.children.find((c) => c.label === "monitor-screen-l");
      const monR = desk.children.find((c) => c.label === "monitor-screen-r");
      if (monL) monitorScreens.push({ container: monL as Container, status: agent.status });
      if (monR) monitorScreens.push({ container: monR as Container, status: agent.status });

      const chair = drawChair(deskX + DESK_W / 2, deskY + DESK_H + 18, getAgentColor(agent.name));
      room.addChild(chair);

      if (agent.status === "offline") {
        const bed = drawBed(deskX + DESK_W + 22, deskY + DESK_H + 32);
        room.addChild(bed);
      }

      const agentX = deskX + DESK_W / 2;
      const agentY = deskY + DESK_H + 52;
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

  for (const rh of rowHeights) cursorY += rh + ROOM_GAP;

  // === Break Room — compact ===
  cursorY += 8;
  const breakRoom = drawBreakRoom(fullW);
  breakRoom.position.set(EDGE_PAD, cursorY);
  root.addChild(breakRoom);

  const coffeeMachinePos = { x: EDGE_PAD + 60, y: cursorY + 50 };

  cursorY += 140 + 16;
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
