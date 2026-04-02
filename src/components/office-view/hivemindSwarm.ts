import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { SceneResult, AgentSprite } from "./officeScene";

// =============================================
// Hivemind Sub-Agent Swarm System
// =============================================

type SwarmPhase = "spawning" | "traveling" | "working" | "returning" | "reabsorbing" | "done";

interface SubAgent {
  id: number;
  container: Container;
  phase: SwarmPhase;
  progress: number;
  originX: number;
  originY: number;
  targetX: number;
  targetY: number;
  targetRoom: string;
  workDuration: number;
  workTimer: number;
  size: number;
  seed: number;
  pulseOffset: number;
  lastTrailX: number;
  lastTrailY: number;
}

interface SwarmMission {
  targetRoom: string;
  agentCount: number;
  taskTitle: string;
}

// Persistent trail points
interface TrailPoint {
  x: number;
  y: number;
  alpha: number;
  size: number;
}

let subAgents: SubAgent[] = [];
let missionQueue: SwarmMission[] = [];
let hivemindSprite: AgentSprite | null = null;
let sceneRef: SceneResult | null = null;
let swarmContainer: Container | null = null;
let trailGraphics: Graphics | null = null;
let overlayContainer: Container | null = null;
let overlayBg: Graphics | null = null;
let overlayText: Text | null = null;
let trailPoints: TrailPoint[] = [];
let nextId = 0;
let globalTick = 0;

const SPAWN_DURATION = 45;
const TRAVEL_DURATION = 90;
const WORK_MIN = 300;
const WORK_MAX = 600;
const RETURN_DURATION = 90;
const REABSORB_DURATION = 40;

// =============================================
// Drawing a mini-Hivemind
// =============================================

function drawMiniHivemind(scale: number, seed: number): Container {
  const c = new Container();
  const g = new Graphics();

  const r = 8 * scale;
  const bodyH = 12 * scale;

  // Body glow
  const glow = new Graphics();
  glow.circle(0, 0, r * 2.5);
  glow.fill({ color: 0x3b82f6, alpha: 0.08 });
  glow.label = "mini-glow";
  c.addChild(glow);

  // Body
  g.roundRect(-r, -bodyH, r * 2, bodyH + r, r * 0.6);
  g.fill(0x1e293b);
  g.stroke({ color: 0x3b82f6, width: 0.8, alpha: 0.6 });

  // Head
  const headR = r * 0.7;
  g.circle(0, -bodyH - headR * 0.4, headR);
  g.fill(0xf5d0a9);

  // Eyes
  const eyeY = -bodyH - headR * 0.4;
  g.circle(-headR * 0.3, eyeY - 1, 1.2);
  g.fill(0x3b82f6);
  g.circle(headR * 0.3, eyeY - 1, 1.2);
  g.fill(0x3b82f6);

  // Hivemind "H" badge
  const badge = new Graphics();
  badge.roundRect(-4 * scale, -3 * scale, 8 * scale, 6 * scale, 1);
  badge.fill({ color: 0x3b82f6, alpha: 0.3 });
  badge.y = -bodyH * 0.5;
  c.addChild(badge);

  const hText = new Text({
    text: "H",
    style: new TextStyle({
      fontSize: 5 * scale,
      fontFamily: "monospace",
      fill: 0x93c5fd,
      fontWeight: "bold",
    }),
  });
  hText.anchor.set(0.5);
  hText.y = -bodyH * 0.5;
  c.addChild(hText);

  c.addChild(g);
  c.scale.set(scale);
  return c;
}

// =============================================
// Easing
// =============================================

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t: number): number {
  return t * t * t;
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// =============================================
// Public API
// =============================================

export function initSwarm(scene: SceneResult, parentContainer: Container) {
  sceneRef = scene;

  // Trail layer (below sub-agents)
  trailGraphics = new Graphics();
  trailGraphics.label = "hivemind-trails";
  parentContainer.addChild(trailGraphics);

  swarmContainer = new Container();
  swarmContainer.label = "hivemind-swarm";
  parentContainer.addChild(swarmContainer);

  // Activity overlay (top-right corner)
  overlayContainer = new Container();
  overlayContainer.label = "hivemind-overlay";
  overlayContainer.position.set(parentContainer.width > 100 ? 16 : 16, 8);
  overlayContainer.alpha = 0;
  parentContainer.addChild(overlayContainer);

  overlayBg = new Graphics();
  overlayContainer.addChild(overlayBg);

  overlayText = new Text({
    text: "",
    style: new TextStyle({
      fontSize: 9,
      fontFamily: "monospace",
      fill: 0x93c5fd,
      lineHeight: 14,
    }),
  });
  overlayText.position.set(8, 6);
  overlayContainer.addChild(overlayText);

  hivemindSprite = scene.agentSprites.find(
    (s) => s.agent.name.toLowerCase() === "hivemind"
  ) || null;
}

export function dispatchSwarm(targetRoom: string, taskTitle: string, intensity: number = 1) {
  const count = Math.max(1, Math.min(5, Math.ceil(intensity)));
  missionQueue.push({ targetRoom, agentCount: count, taskTitle });
}

export function triggerSwarmFromAssignment(
  assignments: Array<{ agent_id: string; role: string; fit_score: number }>,
  taskTitle: string,
  agents: Array<{ id: string; name: string; department: string }>
) {
  const hivemindAssignment = assignments.find(a => {
    const agent = agents.find(ag => ag.id === a.agent_id);
    return agent?.name.toLowerCase() === "hivemind" && (a.role === "support" || a.role === "owner");
  });
  if (!hivemindAssignment) return;

  const targetDepts = assignments
    .filter(a => a.role === "owner" || a.role === "support")
    .map(a => agents.find(ag => ag.id === a.agent_id)?.department)
    .filter((d): d is string => !!d && d !== "Orchestration");

  const targetRoom = targetDepts[0] || "Architecture";
  const intensity = Math.ceil(hivemindAssignment.fit_score / 25);
  dispatchSwarm(targetRoom, taskTitle, intensity);
}

function spawnSubAgents(mission: SwarmMission) {
  if (!hivemindSprite || !sceneRef || !swarmContainer) return;

  const targetRoomData = sceneRef.roomContainers.find(
    (r) => r.name.toLowerCase() === mission.targetRoom.toLowerCase()
  );
  if (!targetRoomData) return;

  const originX = hivemindSprite.baseX;
  const originY = hivemindSprite.baseY;
  const roomCenterX = targetRoomData.container.x + 60;
  const roomCenterY = targetRoomData.y + targetRoomData.h * 0.6;

  for (let i = 0; i < mission.agentCount; i++) {
    const seed = Math.random();
    const size = 0.5 + seed * 0.3;
    const spread = (i - (mission.agentCount - 1) / 2) * 25;

    const container = drawMiniHivemind(size, seed);
    container.position.set(originX, originY);
    container.alpha = 0;
    swarmContainer.addChild(container);

    const sub: SubAgent = {
      id: nextId++,
      container,
      phase: "spawning",
      progress: -i * 0.15,
      originX,
      originY,
      targetX: roomCenterX + spread,
      targetY: roomCenterY + (seed - 0.5) * 30,
      targetRoom: mission.targetRoom,
      workDuration: WORK_MIN + Math.floor(Math.random() * (WORK_MAX - WORK_MIN)),
      workTimer: 0,
      size,
      seed,
      pulseOffset: i * 0.7,
      lastTrailX: originX,
      lastTrailY: originY,
    };

    subAgents.push(sub);
  }
}

// =============================================
// Per-frame animation
// =============================================

export function updateSwarm() {
  globalTick++;

  // Process mission queue
  if (missionQueue.length > 0 && hivemindSprite) {
    const mission = missionQueue.shift()!;
    spawnSubAgents(mission);
  }

  // Fade and render trail points
  renderTrails();

  const alive: SubAgent[] = [];

  for (const sub of subAgents) {
    sub.progress += 1 / getPhaseDuration(sub.phase);

    if (sub.progress < 0) {
      alive.push(sub);
      continue;
    }

    const t = Math.min(1, sub.progress);

    switch (sub.phase) {
      case "spawning": {
        const et = easeOutCubic(t);
        sub.container.alpha = et;
        sub.container.scale.set(sub.size * et);
        sub.container.x = sub.originX + (Math.sin(sub.seed * 20) * 8) * et;
        sub.container.y = sub.originY - 15 * et;

        const glow = sub.container.children.find(c => c.label === "mini-glow");
        if (glow) {
          glow.alpha = 0.3 * et;
          glow.scale.set(1 + et * 0.5);
        }

        if (t >= 1) advancePhase(sub);
        break;
      }

      case "traveling": {
        const et = easeInOutQuad(t);
        const startX = sub.originX + (Math.sin(sub.seed * 20) * 8);
        const startY = sub.originY - 15;
        const midY = Math.min(startY, sub.targetY) - 40 - sub.seed * 30;
        const oneMinusT = 1 - et;

        const newX = oneMinusT * oneMinusT * startX + 2 * oneMinusT * et * ((startX + sub.targetX) / 2) + et * et * sub.targetX;
        const newY = oneMinusT * oneMinusT * startY + 2 * oneMinusT * et * midY + et * et * sub.targetY;

        sub.container.x = newX;
        sub.container.y = newY;
        sub.container.alpha = 1;
        sub.container.scale.set(sub.size);
        sub.container.rotation = Math.sin(et * Math.PI * 2) * 0.1;

        // Emit trail points every few pixels
        const dx = newX - sub.lastTrailX;
        const dy = newY - sub.lastTrailY;
        if (dx * dx + dy * dy > 36) {
          trailPoints.push({ x: newX, y: newY, alpha: 0.35, size: 1.8 * sub.size });
          sub.lastTrailX = newX;
          sub.lastTrailY = newY;
        }

        if (t >= 1) {
          sub.container.rotation = 0;
          advancePhase(sub);
        }
        break;
      }

      case "working": {
        sub.workTimer++;
        const wt = globalTick + sub.pulseOffset * 60;
        sub.container.x = sub.targetX + Math.sin(wt * 0.03) * 3;
        sub.container.y = sub.targetY + Math.sin(wt * 0.025) * 2;
        sub.container.scale.set(sub.size * (1 + Math.sin(wt * 0.04) * 0.03));

        const glow = sub.container.children.find(c => c.label === "mini-glow");
        if (glow) {
          glow.alpha = 0.15 + Math.sin(wt * 0.06) * 0.1;
        }

        if (sub.workTimer % 45 === 0) {
          const gl = sub.container.children.find(c => c.label === "mini-glow");
          if (gl) { gl.alpha = 0.4; gl.scale.set(1.3); }
        }

        if (sub.workTimer >= sub.workDuration) advancePhase(sub);
        break;
      }

      case "returning": {
        const et = easeInOutQuad(t);
        const midY = Math.min(sub.targetY, sub.originY) - 35 - sub.seed * 20;
        const oneMinusT = 1 - et;

        const newX = oneMinusT * oneMinusT * sub.targetX + 2 * oneMinusT * et * ((sub.targetX + sub.originX) / 2) + et * et * sub.originX;
        const newY = oneMinusT * oneMinusT * sub.targetY + 2 * oneMinusT * et * midY + et * et * sub.originY;

        sub.container.x = newX;
        sub.container.y = newY;
        sub.container.rotation = Math.sin(et * Math.PI * 2) * -0.08;
        sub.container.alpha = 1 - et * 0.2;

        // Return trails
        const dx = newX - sub.lastTrailX;
        const dy = newY - sub.lastTrailY;
        if (dx * dx + dy * dy > 36) {
          trailPoints.push({ x: newX, y: newY, alpha: 0.25, size: 1.4 * sub.size });
          sub.lastTrailX = newX;
          sub.lastTrailY = newY;
        }

        if (t >= 1) {
          sub.container.rotation = 0;
          advancePhase(sub);
        }
        break;
      }

      case "reabsorbing": {
        const et = easeInCubic(t);
        sub.container.x = sub.originX;
        sub.container.y = sub.originY;
        sub.container.scale.set(sub.size * (1 - et));
        sub.container.alpha = 1 - et;

        const glow = sub.container.children.find(c => c.label === "mini-glow");
        if (glow) {
          glow.alpha = 0.5 * (1 - et);
          glow.scale.set(1 + et * 2);
        }

        if (t >= 1) {
          sub.phase = "done";
          swarmContainer?.removeChild(sub.container);
          sub.container.destroy({ children: true });

          if (hivemindSprite) {
            const aura = hivemindSprite.container.children.find(c => c.label === "agent-aura");
            if (aura) { aura.alpha = 0.9; aura.scale.set(1.15); }
          }
        }
        break;
      }

      case "done":
        break;
    }

    if (sub.phase !== "done") alive.push(sub);
  }

  subAgents = alive;

  // Hivemind glow when subs are active
  if (hivemindSprite && subAgents.length > 0) {
    const aura = hivemindSprite.container.children.find(c => c.label === "agent-aura");
    if (aura) {
      const intensity = Math.min(subAgents.length / 5, 1);
      aura.alpha = Math.max(aura.alpha, 0.3 + intensity * 0.4 + Math.sin(globalTick * 0.05) * 0.1);
    }
  }

  // Update activity overlay
  updateOverlay();
}

// =============================================
// Persistent blue energy trails
// =============================================

function renderTrails() {
  if (!trailGraphics) return;
  trailGraphics.clear();

  const alive: TrailPoint[] = [];
  for (const p of trailPoints) {
    p.alpha -= 0.004; // ~4 second fade
    p.size *= 0.998;
    if (p.alpha > 0.01) {
      alive.push(p);
      trailGraphics.circle(p.x, p.y, p.size);
      trailGraphics.fill({ color: 0x3b82f6, alpha: p.alpha });

      // Outer glow ring
      trailGraphics.circle(p.x, p.y, p.size * 2.5);
      trailGraphics.fill({ color: 0x3b82f6, alpha: p.alpha * 0.15 });
    }
  }
  trailPoints = alive;
}

// =============================================
// Activity overlay
// =============================================

function updateOverlay() {
  if (!overlayContainer || !overlayBg || !overlayText) return;

  const activeCount = subAgents.filter(s => s.phase !== "done").length;

  if (activeCount === 0) {
    overlayContainer.alpha = Math.max(0, overlayContainer.alpha - 0.03);
    return;
  }

  overlayContainer.alpha = Math.min(1, overlayContainer.alpha + 0.05);

  // Collect room stats
  const roomCounts: Record<string, { working: number; traveling: number }> = {};
  for (const sub of subAgents) {
    if (sub.phase === "done") continue;
    if (!roomCounts[sub.targetRoom]) roomCounts[sub.targetRoom] = { working: 0, traveling: 0 };
    if (sub.phase === "working") roomCounts[sub.targetRoom].working++;
    else roomCounts[sub.targetRoom].traveling++;
  }

  let text = `⚡ HIVEMIND  ${activeCount} deployed\n`;
  for (const [room, counts] of Object.entries(roomCounts)) {
    const status = counts.working > 0 ? `${counts.working} working` : `${counts.traveling} en route`;
    text += `  → ${room}: ${status}\n`;
  }

  overlayText.text = text.trim();

  // Redraw background
  const bounds = overlayText.getBounds();
  overlayBg.clear();
  overlayBg.roundRect(0, 0, bounds.width + 16, bounds.height + 12, 6);
  overlayBg.fill({ color: 0x0a0f1a, alpha: 0.85 });
  overlayBg.stroke({ color: 0x3b82f6, width: 0.5, alpha: 0.4 });
}

// =============================================
// Helpers
// =============================================

function getPhaseDuration(phase: SwarmPhase): number {
  switch (phase) {
    case "spawning": return SPAWN_DURATION;
    case "traveling": return TRAVEL_DURATION;
    case "returning": return RETURN_DURATION;
    case "reabsorbing": return REABSORB_DURATION;
    default: return 1;
  }
}

function advancePhase(sub: SubAgent) {
  sub.progress = 0;
  switch (sub.phase) {
    case "spawning": sub.phase = "traveling"; sub.lastTrailX = sub.container.x; sub.lastTrailY = sub.container.y; break;
    case "traveling": sub.phase = "working"; break;
    case "working": sub.phase = "returning"; sub.lastTrailX = sub.container.x; sub.lastTrailY = sub.container.y; break;
    case "returning": sub.phase = "reabsorbing"; break;
    case "reabsorbing": sub.phase = "done"; break;
  }
}

export function getActiveSubAgentCount(): number {
  return subAgents.filter(s => s.phase !== "done").length;
}

export function resetSwarm() {
  for (const sub of subAgents) {
    if (sub.container.parent) sub.container.parent.removeChild(sub.container);
    sub.container.destroy({ children: true });
  }
  subAgents = [];
  missionQueue = [];
  hivemindSprite = null;
  sceneRef = null;
  swarmContainer = null;
  trailGraphics = null;
  trailPoints = [];
  overlayContainer = null;
  overlayBg = null;
  overlayText = null;
  nextId = 0;
  globalTick = 0;
}
