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
const ROOM_GAP = 16;
const ROOM_PAD_LEFT = 16;
const ROOM_PAD_RIGHT = 16;
const ROOM_HEADER_H = 52;
const SLOT_W = 110;
const SLOT_H = 160;
const ROOM_BOTTOM_PAD = 20;
const CEO_OFFICE_H = 360;
const HALLWAY_H = 36;
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

// Helper: draw multi-monitor command wall
function drawCommandWall(g: Graphics, x: number, y: number, w: number) {
  // 5 screens arranged in an arc
  const screens = 5;
  const sw = 34, sh = 22;
  const totalW = screens * (sw + 4);
  const startX = x - totalW / 2;
  for (let i = 0; i < screens; i++) {
    const sx = startX + i * (sw + 4);
    g.roundRect(sx, y, sw, sh, 2);
    g.fill(0x0a0a0e);
    g.stroke({ color: 0x3b82f6, width: 0.5, alpha: 0.25 });
    g.roundRect(sx + 2, y + 2, sw - 4, sh - 4, 1);
    g.fill({ color: 0x0d1b2a, alpha: 0.9 });
    // Simulated data lines
    for (let l = 0; l < 3; l++) {
      const lw = 6 + (i * 3 + l * 7) % 12;
      g.roundRect(sx + 4, y + 5 + l * 5, lw, 2, 1);
      g.fill({ color: 0x3b82f6, alpha: 0.15 + (l * 0.05) });
    }
  }
  // Monitor glow
  g.ellipse(x, y + sh + 4, totalW / 2, 8);
  g.fill({ color: 0x3b82f6, alpha: 0.03 });
}

// Helper: draw CEO personal desk
function drawCEODesk(g: Graphics, x: number, y: number) {
  // L-shaped executive desk
  g.roundRect(x - 45, y, 90, 35, 4);
  g.fill(0x18181b);
  g.roundRect(x - 43, y + 2, 86, 31, 3);
  g.fill(0x1e1e22);
  g.stroke({ color: 0xf59e0b, width: 0.3, alpha: 0.15 });
  // Side extension
  g.roundRect(x + 42, y + 5, 20, 25, 3);
  g.fill(0x1e1e22);
  g.stroke({ color: 0x27272a, width: 0.4 });
  // Desktop items
  // Triple monitor
  for (let i = 0; i < 3; i++) {
    const mx = x - 28 + i * 24;
    g.roundRect(mx, y - 16, 20, 14, 2);
    g.fill(0x0a0a0e);
    g.stroke({ color: 0x27272a, width: 0.6 });
    g.roundRect(mx + 2, y - 14, 16, 10, 1);
    g.fill({ color: 0x0d1b2a, alpha: 0.95 });
  }
  // Keyboard
  g.roundRect(x - 14, y + 8, 28, 8, 2);
  g.fill(0x18181b);
  g.stroke({ color: 0x27272a, width: 0.4 });
  // Notepad
  g.roundRect(x + 46, y + 8, 10, 14, 1);
  g.fill(0x1c1c20);
  g.stroke({ color: 0x27272a, width: 0.3 });
}

// Helper: draw status board
function drawStatusBoard(g: Graphics, x: number, y: number) {
  g.roundRect(x - 28, y, 56, 36, 3);
  g.fill(0x0c0c10);
  g.stroke({ color: 0x3b82f6, width: 0.6, alpha: 0.3 });
  // Title bar
  g.roundRect(x - 26, y + 2, 52, 8, 1);
  g.fill({ color: 0x3b82f6, alpha: 0.12 });
  // Status rows
  for (let i = 0; i < 3; i++) {
    const ry = y + 14 + i * 7;
    g.circle(x - 20, ry + 2, 2);
    g.fill({ color: [0x22c55e, 0xeab308, 0x3b82f6][i], alpha: 0.6 });
    g.roundRect(x - 14, ry, 30 - i * 4, 3, 1);
    g.fill({ color: 0xffffff, alpha: 0.06 });
  }
}

// Draw large central meeting table with 8 chairs
function drawMeetingTable(fullW: number, y: number): Container {
  const c = new Container();
  c.label = "meeting-table";

  const g = new Graphics();
  // Table shadow
  g.ellipse(0, 8, 100, 14);
  g.fill({ color: 0x000000, alpha: 0.08 });
  // Table surface — large oval
  g.ellipse(0, 0, 90, 22);
  g.fill(0x18181b);
  g.ellipse(0, 0, 88, 20);
  g.fill(0x1e1e22);
  g.stroke({ color: 0x27272a, width: 0.5 });
  // Surface details
  g.ellipse(0, 0, 70, 15);
  g.stroke({ color: 0x3b82f6, width: 0.2, alpha: 0.06 });
  // Center holographic projector
  g.circle(0, 0, 6);
  g.fill({ color: 0x3b82f6, alpha: 0.08 });
  g.circle(0, 0, 3);
  g.fill({ color: 0x3b82f6, alpha: 0.15 });
  g.circle(0, 0, 1.5);
  g.fill({ color: 0x3b82f6, alpha: 0.3 });
  c.addChild(g);

  // 8 chairs around the table
  const chairPositions = [
    { x: -65, y: -12 }, { x: -25, y: -28 }, { x: 25, y: -28 }, { x: 65, y: -12 },
    { x: -65, y: 16 }, { x: -25, y: 32 }, { x: 25, y: 32 }, { x: 65, y: 16 },
  ];
  for (const pos of chairPositions) {
    const ch = new Graphics();
    ch.ellipse(pos.x, pos.y, 8, 4);
    ch.fill({ color: 0x1e1e22, alpha: 0.8 });
    ch.stroke({ color: 0x27272a, width: 0.4 });
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

  // === CEO WAR ROOM — Expanded with 3 zones ===
  const ceoRoom = drawRoom("CEO WAR ROOM — JASH", fullW, CEO_OFFICE_H, 0xf59e0b);
  ceoRoom.position.set(EDGE_PAD, cursorY);
  root.addChild(ceoRoom);

  // Zone boundaries
  const leftZoneW = Math.floor(fullW * 0.25);
  const centerStart = leftZoneW;
  const rightZoneStart = Math.floor(fullW * 0.75);
  const centerW = rightZoneStart - centerStart;

  // --- LEFT ZONE: Personal CEO Office ---
  // Golden rug
  const rug = drawRug(leftZoneW / 2, CEO_OFFICE_H / 2 + 30, 60, 25, 0xf59e0b);
  ceoRoom.addChild(rug);

  // CEO desk with triple monitors
  const deskG = new Graphics();
  drawCEODesk(deskG, leftZoneW / 2, CEO_OFFICE_H / 2 - 10);
  ceoRoom.addChild(deskG);

  // CEO avatar (positioned at personal desk)
  const ceoAvatar = drawCEO(leftZoneW / 2, CEO_OFFICE_H / 2 + 50);
  ceoRoom.addChild(ceoAvatar);

  // Ceiling lights for CEO zone
  ceoRoom.addChild(drawCeilingLight(leftZoneW / 2, 36, 0xf59e0b));

  // --- CENTER ZONE: Large Meeting Space ---
  // Overhead lighting
  ceoRoom.addChild(drawCeilingLight(centerStart + centerW / 2 - 40, 36, 0xf59e0b));
  ceoRoom.addChild(drawCeilingLight(centerStart + centerW / 2 + 40, 36, 0xf59e0b));

  // Command wall (multi-monitor display)
  const cmdWallG = new Graphics();
  drawCommandWall(cmdWallG, centerStart + centerW / 2, 42, centerW);
  ceoRoom.addChild(cmdWallG);

  // Large meeting table with 8 chairs
  const meetingTable = drawMeetingTable(centerW, CEO_OFFICE_H / 2 + 40);
  meetingTable.position.set(centerStart + centerW / 2, CEO_OFFICE_H / 2 + 40);
  ceoRoom.addChild(meetingTable);

  // Whiteboard on center wall
  const wb = drawWhiteboard(centerStart + centerW / 2 - 60, 58);
  ceoRoom.addChild(wb);

  // --- RIGHT ZONE: Command Console ---
  // Status boards
  const sbG = new Graphics();
  drawStatusBoard(sbG, rightZoneStart + (fullW - rightZoneStart) / 2, 50);
  drawStatusBoard(sbG, rightZoneStart + (fullW - rightZoneStart) / 2, 100);
  ceoRoom.addChild(sbG);

  // Holographic activity indicator
  const holoG = new Graphics();
  const hx = rightZoneStart + (fullW - rightZoneStart) / 2;
  holoG.circle(hx, CEO_OFFICE_H - 60, 18);
  holoG.stroke({ color: 0x3b82f6, width: 0.8, alpha: 0.2 });
  holoG.circle(hx, CEO_OFFICE_H - 60, 12);
  holoG.stroke({ color: 0x3b82f6, width: 0.5, alpha: 0.15 });
  holoG.circle(hx, CEO_OFFICE_H - 60, 6);
  holoG.fill({ color: 0x3b82f6, alpha: 0.1 });
  holoG.label = "holo-indicator";
  ceoRoom.addChild(holoG);

  // Ceiling light for right zone
  ceoRoom.addChild(drawCeilingLight(rightZoneStart + (fullW - rightZoneStart) / 2, 36, 0x3b82f6));

  // Zone divider lines (subtle)
  const divG = new Graphics();
  divG.moveTo(leftZoneW, 38);
  divG.lineTo(leftZoneW, CEO_OFFICE_H - 8);
  divG.stroke({ color: 0xf59e0b, width: 0.3, alpha: 0.1 });
  divG.moveTo(rightZoneStart, 38);
  divG.lineTo(rightZoneStart, CEO_OFFICE_H - 8);
  divG.stroke({ color: 0xf59e0b, width: 0.3, alpha: 0.1 });
  ceoRoom.addChild(divG);

  const ceoBounds = {
    x: EDGE_PAD + 10,
    y: cursorY + 40,
    w: fullW - 20,
    h: CEO_OFFICE_H - 60,
  };

  const ceoClock = drawWallClock(fullW - 28, 18);
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
  const clampedRoomW = Math.max(240, roomW);

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

    // Clock
    const clock = drawWallClock(clampedRoomW - 28, 18);
    room.addChild(clock);

    // Whiteboard
    const rwb = drawWhiteboard(clampedRoomW - 44, 30);
    room.addChild(rwb);

    // Ceiling light
    room.addChild(drawCeilingLight(clampedRoomW / 2, 38, dept.tint));

    // Department-specific objects
    if (dept.name === "DevOps") {
      const rack = drawServerRack(clampedRoomW - 20, rh - 30);
      room.addChild(rack);
    } else if (dept.name === "Research") {
      const globe = drawResearchGlobe(clampedRoomW - 22, rh - 22);
      room.addChild(globe);
    } else if (idx % 2 === 0) {
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

      // Mug position
      mugPositions.push({
        x: rx + deskX + DESK_W - 14,
        y: ry + deskY + DESK_H - 16,
      });

      // Track monitor screens
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

  // === Neural Lounge — REST & RECHARGE ===
  cursorY += ROOM_GAP;
  const breakRoom = drawBreakRoom(fullW);
  breakRoom.position.set(EDGE_PAD, cursorY);
  root.addChild(breakRoom);

  const coffeeMachinePos = { x: EDGE_PAD + 60, y: cursorY + 55 };

  cursorY += 180 + 24;
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
