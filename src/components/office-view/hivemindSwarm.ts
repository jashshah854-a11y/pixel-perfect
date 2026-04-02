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
  progress: number;       // 0-1 through current phase
  originX: number;
  originY: number;
  targetX: number;
  targetY: number;
  targetRoom: string;
  workDuration: number;   // ticks to work
  workTimer: number;
  size: number;           // 0.4-0.7 scale factor
  seed: number;
  pulseOffset: number;
}

interface SwarmMission {
  targetRoom: string;
  agentCount: number;     // 1-5 based on task intensity
  taskTitle: string;
}

let subAgents: SubAgent[] = [];
let missionQueue: SwarmMission[] = [];
let hivemindSprite: AgentSprite | null = null;
let sceneRef: SceneResult | null = null;
let swarmContainer: Container | null = null;
let nextId = 0;
let globalTick = 0;

// Phase durations in ticks (60fps)
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

  // Eyes — small blue dots (Hivemind signature)
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

  // Trail particles container
  const trail = new Graphics();
  trail.label = "mini-trail";
  c.addChild(trail);

  c.scale.set(scale);
  return c;
}

// =============================================
// Easing functions
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
  swarmContainer = new Container();
  swarmContainer.label = "hivemind-swarm";
  parentContainer.addChild(swarmContainer);

  // Find Hivemind agent sprite
  hivemindSprite = scene.agentSprites.find(
    (s) => s.agent.name.toLowerCase() === "hivemind"
  ) || null;
}

export function dispatchSwarm(targetRoom: string, taskTitle: string, intensity: number = 1) {
  // Scale sub-agent count with intensity: 1-5
  const count = Math.max(1, Math.min(5, Math.ceil(intensity)));
  missionQueue.push({ targetRoom, agentCount: count, taskTitle });
}

export function triggerSwarmFromAssignment(
  assignments: Array<{ agent_id: string; role: string; fit_score: number }>,
  taskTitle: string,
  agents: Array<{ id: string; name: string; department: string }>
) {
  // Find support/owner agents that aren't Hivemind
  const hivemindAssignment = assignments.find(a => {
    const agent = agents.find(ag => ag.id === a.agent_id);
    return agent?.name.toLowerCase() === "hivemind" && (a.role === "support" || a.role === "owner");
  });

  if (!hivemindAssignment) return;

  // Find target departments from non-Hivemind assignments
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

  // Find target room position
  const targetRoomData = sceneRef.roomContainers.find(
    (r) => r.name.toLowerCase() === mission.targetRoom.toLowerCase()
  );
  if (!targetRoomData) return;

  const originX = hivemindSprite.baseX;
  const originY = hivemindSprite.baseY;

  // Target: center of the room, spread slightly
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
      progress: 0,
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
    };

    // Stagger spawns
    sub.progress = -i * 0.15;

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

  const alive: SubAgent[] = [];

  for (const sub of subAgents) {
    sub.progress += 1 / getPhraseDuration(sub.phase);

    if (sub.progress < 0) {
      // Still in stagger delay
      alive.push(sub);
      continue;
    }

    const t = Math.min(1, sub.progress);

    switch (sub.phase) {
      case "spawning": {
        // Emerge from Hivemind with expanding glow
        const et = easeOutCubic(t);
        sub.container.alpha = et;
        sub.container.scale.set(sub.size * et);

        // Slight upward pop
        sub.container.x = sub.originX + (Math.sin(sub.seed * 20) * 8) * et;
        sub.container.y = sub.originY - 15 * et;

        // Glow pulse during spawn
        const glow = sub.container.children.find(c => c.label === "mini-glow");
        if (glow) {
          glow.alpha = 0.3 * et;
          glow.scale.set(1 + et * 0.5);
        }

        if (t >= 1) advancePhase(sub);
        break;
      }

      case "traveling": {
        // Smooth arc path to target
        const et = easeInOutQuad(t);
        const startX = sub.originX + (Math.sin(sub.seed * 20) * 8);
        const startY = sub.originY - 15;

        // Bezier-like arc
        const midY = Math.min(startY, sub.targetY) - 40 - sub.seed * 30;
        const oneMinusT = 1 - et;

        sub.container.x = oneMinusT * oneMinusT * startX + 2 * oneMinusT * et * ((startX + sub.targetX) / 2) + et * et * sub.targetX;
        sub.container.y = oneMinusT * oneMinusT * startY + 2 * oneMinusT * et * midY + et * et * sub.targetY;

        sub.container.alpha = 1;
        sub.container.scale.set(sub.size);

        // Trail effect
        drawTrail(sub, et);

        // Rotation during travel
        sub.container.rotation = Math.sin(et * Math.PI * 2) * 0.1;

        if (t >= 1) {
          sub.container.rotation = 0;
          advancePhase(sub);
        }
        break;
      }

      case "working": {
        // Ambient presence at target location
        sub.workTimer++;
        const wt = globalTick + sub.pulseOffset * 60;

        // Gentle floating bob
        sub.container.x = sub.targetX + Math.sin(wt * 0.03) * 3;
        sub.container.y = sub.targetY + Math.sin(wt * 0.025) * 2;

        // Subtle scale pulse (breathing)
        sub.container.scale.set(sub.size * (1 + Math.sin(wt * 0.04) * 0.03));

        // Work glow intensity
        const glow = sub.container.children.find(c => c.label === "mini-glow");
        if (glow) {
          glow.alpha = 0.15 + Math.sin(wt * 0.06) * 0.1;
        }

        // Occasional "data burst" particle
        if (sub.workTimer % 45 === 0) {
          emitWorkParticle(sub);
        }

        if (sub.workTimer >= sub.workDuration) advancePhase(sub);
        break;
      }

      case "returning": {
        // Arc path back to Hivemind
        const et = easeInOutQuad(t);
        const midY = Math.min(sub.targetY, sub.originY) - 35 - sub.seed * 20;
        const oneMinusT = 1 - et;

        sub.container.x = oneMinusT * oneMinusT * sub.targetX + 2 * oneMinusT * et * ((sub.targetX + sub.originX) / 2) + et * et * sub.originX;
        sub.container.y = oneMinusT * oneMinusT * sub.targetY + 2 * oneMinusT * et * midY + et * et * sub.originY;

        sub.container.rotation = Math.sin(et * Math.PI * 2) * -0.08;

        // Fade slightly during return
        sub.container.alpha = 1 - et * 0.2;

        drawTrail(sub, et);

        if (t >= 1) {
          sub.container.rotation = 0;
          advancePhase(sub);
        }
        break;
      }

      case "reabsorbing": {
        // Shrink and merge into Hivemind
        const et = easeInCubic(t);

        sub.container.x = sub.originX;
        sub.container.y = sub.originY;
        sub.container.scale.set(sub.size * (1 - et));
        sub.container.alpha = 1 - et;

        // Bright flash on merge
        const glow = sub.container.children.find(c => c.label === "mini-glow");
        if (glow) {
          glow.alpha = 0.5 * (1 - et);
          glow.scale.set(1 + et * 2);
        }

        if (t >= 1) {
          sub.phase = "done";
          swarmContainer?.removeChild(sub.container);
          sub.container.destroy({ children: true });

          // Flash Hivemind's aura on reabsorb
          if (hivemindSprite) {
            const aura = hivemindSprite.container.children.find(c => c.label === "agent-aura");
            if (aura) {
              aura.alpha = 0.9;
              aura.scale.set(1.15);
            }
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

  // Hivemind subtle glow when subs are active
  if (hivemindSprite && subAgents.length > 0) {
    const aura = hivemindSprite.container.children.find(c => c.label === "agent-aura");
    if (aura) {
      const intensity = Math.min(subAgents.length / 5, 1);
      aura.alpha = Math.max(aura.alpha, 0.3 + intensity * 0.4 + Math.sin(globalTick * 0.05) * 0.1);
    }
  }
}

function getPhraseDuration(phase: SwarmPhase): number {
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
    case "spawning": sub.phase = "traveling"; break;
    case "traveling": sub.phase = "working"; break;
    case "working": sub.phase = "returning"; break;
    case "returning": sub.phase = "reabsorbing"; break;
    case "reabsorbing": sub.phase = "done"; break;
  }
}

function drawTrail(sub: SubAgent, _t: number) {
  const trail = sub.container.children.find(c => c.label === "mini-trail") as Graphics | undefined;
  if (!trail) return;
  trail.clear();

  // Small trailing dots
  for (let i = 1; i <= 3; i++) {
    const alpha = 0.15 / i;
    const offset = i * 4;
    trail.circle(-offset * Math.sign(sub.targetX - sub.originX), offset * 0.3, 1.2 / i);
    trail.fill({ color: 0x3b82f6, alpha });
  }
}

function emitWorkParticle(sub: SubAgent) {
  const glow = sub.container.children.find(c => c.label === "mini-glow");
  if (glow) {
    glow.alpha = 0.4;
    glow.scale.set(1.3);
  }
}

export function getActiveSubAgentCount(): number {
  return subAgents.filter(s => s.phase !== "done").length;
}

export function resetSwarm() {
  for (const sub of subAgents) {
    if (sub.container.parent) {
      sub.container.parent.removeChild(sub.container);
    }
    sub.container.destroy({ children: true });
  }
  subAgents = [];
  missionQueue = [];
  hivemindSprite = null;
  sceneRef = null;
  swarmContainer = null;
  nextId = 0;
  globalTick = 0;
}
