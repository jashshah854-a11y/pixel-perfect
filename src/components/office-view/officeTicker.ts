import { Graphics, Text, TextStyle, Container } from "pixi.js";
import type { AgentSprite, SceneResult } from "./officeScene";

let tick = 0;

// === Key state for CEO movement ===
export const keyState: Record<string, boolean> = {};

// === Particle system ===
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  life: number;
  type: "steam" | "dust" | "code";
}

let particles: Particle[] = [];
let particleGraphics: Graphics | null = null;

// === Clock containers ===
const clockContainers: { hands: Graphics }[] = [];

// === Scene references ===
let sceneRef: SceneResult | null = null;

// === Claim notification system ===
interface ClaimNotification {
  agentId: string;
  taskTitle: string;
  timer: number;     // ticks remaining
  container: Container | null;
}

const pendingClaims: ClaimNotification[] = [];

export function triggerClaimNotification(agentId: string, taskTitle: string) {
  pendingClaims.push({ agentId, taskTitle, timer: 180, container: null }); // 3 seconds at 60fps
}

// === Idle behavior system ===
type IdleAction = "none" | "look_left" | "look_right" | "stretch" | "shift_weight" | "lean_back" | "nod";

interface IdleState {
  action: IdleAction;
  timer: number;       // ticks remaining for current action
  cooldown: number;     // ticks until next action allowed
  phase: number;        // progress 0-1 through the action
  seed: number;         // per-agent randomization
}

const idleStates = new Map<string, IdleState>();

function getIdleState(agentId: string): IdleState {
  let s = idleStates.get(agentId);
  if (!s) {
    s = {
      action: "none",
      timer: 0,
      cooldown: Math.floor(80 + Math.random() * 200), // stagger initial cooldowns
      phase: 0,
      seed: Math.random(),
    };
    idleStates.set(agentId, s);
  }
  return s;
}

const IDLE_ACTIONS: IdleAction[] = ["look_left", "look_right", "stretch", "shift_weight", "lean_back", "nod"];
const ACTION_DURATIONS: Record<IdleAction, number> = {
  none: 0,
  look_left: 80,
  look_right: 80,
  stretch: 100,
  shift_weight: 90,
  lean_back: 110,
  nod: 60,
};

function pickIdleAction(seed: number): IdleAction {
  const idx = Math.floor(Math.random() * IDLE_ACTIONS.length);
  return IDLE_ACTIONS[idx];
}

// Smooth ease-in-out for natural motion
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Bell curve: peaks at 0.5, zero at 0 and 1
function bell(t: number): number {
  return Math.sin(t * Math.PI);
}

export function setSceneRef(scene: SceneResult) {
  sceneRef = scene;
}

export function registerClock(handsGraphics: Graphics) {
  clockContainers.push({ hands: handsGraphics });
}

export function setParticleGraphics(g: Graphics) {
  particleGraphics = g;
}

// === Main animation function ===
export function animateScene(agentSprites: AgentSprite[]) {
  tick++;

  // Animate agents
  for (const { container, agent } of agentSprites) {
    if (agent.status === "working") {
      // Subtle bob
      const body = container.children.find((c) => c.label === "sprite-body");
      if (body) body.y = Math.sin(tick * 0.04) * 1.5;

      // Status dot pulse
      const dot = container.children.find((c) => c.label === "status-dot");
      if (dot) dot.alpha = 0.6 + Math.sin(tick * 0.08) * 0.4;

      // Aura ring pulse
      const aura = container.children.find((c) => c.label === "agent-aura");
      if (aura) {
        aura.alpha = 0.4 + Math.sin(tick * 0.06) * 0.4;
        aura.scale.set(1 + Math.sin(tick * 0.03) * 0.04);
      }
    } else if (agent.status === "idle") {
      const body = container.children.find((c) => c.label === "sprite-body");
      const state = getIdleState(agent.id);

      // Background breathing always active
      container.scale.set(1 + Math.sin(tick * 0.02) * 0.006);

      // Idle behavior state machine
      if (state.action === "none") {
        // Default gentle sway
        if (body) body.x = Math.sin(tick * 0.015 + state.seed * 100) * 0.6;
        if (body) body.y = 0;
        if (body) body.rotation = 0;

        state.cooldown--;
        if (state.cooldown <= 0) {
          state.action = pickIdleAction(state.seed);
          state.timer = ACTION_DURATIONS[state.action];
          state.phase = 0;
        }
      } else {
        const duration = ACTION_DURATIONS[state.action];
        state.phase = 1 - state.timer / duration;
        const t = bell(state.phase); // smooth rise and fall

        if (body) {
          switch (state.action) {
            case "look_left":
              // Head/body slight turn left
              body.x = -1.8 * t;
              body.rotation = -0.04 * t;
              body.y = 0;
              break;

            case "look_right":
              body.x = 1.8 * t;
              body.rotation = 0.04 * t;
              body.y = 0;
              break;

            case "stretch":
              // Rise up slightly, then settle
              body.y = -3 * t;
              body.x = 0;
              body.rotation = 0;
              // Scale up very slightly for "arms stretching" feel
              container.scale.set(1 + 0.015 * t);
              break;

            case "shift_weight":
              // Lateral lean
              body.x = Math.sin(state.phase * Math.PI * 2) * 1.5;
              body.y = Math.abs(Math.sin(state.phase * Math.PI * 2)) * -0.5;
              body.rotation = Math.sin(state.phase * Math.PI * 2) * 0.02;
              break;

            case "lean_back":
              // Lean backward slightly
              body.y = -1.5 * t;
              body.x = 0;
              body.rotation = -0.03 * t;
              break;

            case "nod":
              // Quick double nod
              body.y = Math.sin(state.phase * Math.PI * 3) * -1.2;
              body.x = 0;
              body.rotation = Math.sin(state.phase * Math.PI * 3) * -0.015;
              break;
          }
        }

        state.timer--;
        if (state.timer <= 0) {
          // Reset to neutral
          if (body) {
            body.x = 0;
            body.y = 0;
            body.rotation = 0;
          }
          state.action = "none";
          // Randomized cooldown: 3-8 seconds at 60fps
          state.cooldown = Math.floor(180 + Math.random() * 300);
        }
      }
    } else if (agent.status === "paused") {
      const pauseGlow = container.children.find((c) => c.label === "agent-pause-glow");
      if (pauseGlow) pauseGlow.alpha = 0.4 + Math.sin(tick * 0.05) * 0.4;
      const body = container.children.find((c) => c.label === "sprite-body");
      if (body) body.alpha = 0.75 + Math.sin(tick * 0.04) * 0.25;
    }
  }

  // CEO movement
  if (sceneRef) {
    const ceo = sceneRef.ceoContainer;
    const bounds = sceneRef.ceoBounds;
    const speed = 3;

    if (keyState["w"] || keyState["arrowup"])
      ceo.y = Math.max(bounds.y - ceo.parent.y + 30, ceo.y - speed);
    if (keyState["s"] || keyState["arrowdown"])
      ceo.y = Math.min(bounds.y + bounds.h - ceo.parent.y, ceo.y + speed);
    if (keyState["a"] || keyState["arrowleft"])
      ceo.x = Math.max(bounds.x - ceo.parent.x + 30, ceo.x - speed);
    if (keyState["d"] || keyState["arrowright"])
      ceo.x = Math.min(bounds.x + bounds.w - ceo.parent.x, ceo.x + speed);

    // Crown float
    const crown = ceo.children.find((c) => c.label === "ceo-crown");
    if (crown) {
      crown.y = -28 - 10 + Math.sin(tick * 0.06) * 2;
      crown.rotation = Math.sin(tick * 0.04) * 0.05;
    }

    // CEO aura pulse
    const aura = ceo.children.find((c) => c.label === "ceo-aura");
    if (aura) {
      aura.alpha = 0.04 + Math.sin(tick * 0.05) * 0.04;
      aura.scale.set(1 + Math.sin(tick * 0.03) * 0.03);
    }
  }

  // Particles
  updateParticles();

  // LED strip pulse on rooms
  if (sceneRef) {
    for (const room of sceneRef.roomContainers) {
      const led = room.container.children.find((c) => c.label === "led-strip");
      if (led) {
        led.alpha = 0.7 + Math.sin(tick * 0.02 + room.y * 0.01) * 0.3;
      }
      // Department insignia rotation
      const insignia = room.container.children.find((c) => c.label === "dept-insignia");
      if (insignia) {
        insignia.rotation = Math.sin(tick * 0.01) * 0.08;
      }
    }
  }

  // Wall clocks
  if (tick % 60 === 0) updateWallClocks();
}

// === Particle management ===
function updateParticles() {
  if (!particleGraphics) return;

  // Coffee steam from break room
  if (sceneRef && tick % 18 === 0) {
    const pos = sceneRef.coffeeMachinePos;
    for (let i = 0; i < 3; i++) {
      particles.push({
        x: pos.x + (Math.random() - 0.5) * 8,
        y: pos.y - 30,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.3 - Math.random() * 0.4,
        alpha: 0.25 + Math.random() * 0.15,
        life: 60 + Math.random() * 40,
        type: "steam",
      });
    }
  }

  // Desk mug steam
  if (sceneRef && tick % 35 === 0) {
    for (const mug of sceneRef.mugPositions) {
      for (let i = 0; i < 2; i++) {
        particles.push({
          x: mug.x + (Math.random() - 0.5) * 4,
          y: mug.y - 6,
          vx: (Math.random() - 0.5) * 0.12,
          vy: -0.2 - Math.random() * 0.2,
          alpha: 0.12 + Math.random() * 0.08,
          life: 35 + Math.random() * 25,
          type: "steam",
        });
      }
    }
  }

  // Floating dust motes (ambient)
  if (sceneRef && tick % 30 === 0) {
    for (let i = 0; i < 2; i++) {
      particles.push({
        x: Math.random() * 1200 + 16,
        y: Math.random() * 600 + 50,
        vx: (Math.random() - 0.5) * 0.1,
        vy: -0.05 - Math.random() * 0.05,
        alpha: 0.06 + Math.random() * 0.04,
        life: 120 + Math.random() * 80,
        type: "dust",
      });
    }
  }

  // Code particles above working agents
  if (sceneRef && tick % 25 === 0) {
    for (const sprite of sceneRef.agentSprites) {
      if (sprite.agent.status === "working") {
        particles.push({
          x: sprite.baseX + (Math.random() - 0.5) * 12,
          y: sprite.baseY - 20,
          vx: (Math.random() - 0.5) * 0.2,
          vy: -0.4 - Math.random() * 0.3,
          alpha: 0.15 + Math.random() * 0.1,
          life: 30 + Math.random() * 20,
          type: "code",
        });
      }
    }
  }

  // Monitor screen shimmer for working agents
  if (sceneRef) {
    for (const mon of sceneRef.monitorScreens) {
      if (mon.status === "working") {
        mon.container.alpha = 0.8 + Math.sin(tick * 0.1 + mon.container.x * 0.05) * 0.15;
      }
    }
  }

  // Render particles
  particleGraphics.clear();
  const alive: Particle[] = [];
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    p.alpha -= p.type === "dust" ? 0.0005 : 0.003;
    if (p.life > 0 && p.alpha > 0.005) {
      alive.push(p);
      if (p.type === "steam") {
        particleGraphics.circle(p.x, p.y, 1.2 + (1 - p.alpha) * 1.5);
        particleGraphics.fill({ color: 0x9ca3af, alpha: p.alpha });
      } else if (p.type === "dust") {
        particleGraphics.circle(p.x, p.y, 0.8);
        particleGraphics.fill({ color: 0xffffff, alpha: p.alpha });
      } else if (p.type === "code") {
        particleGraphics.circle(p.x, p.y, 0.6);
        particleGraphics.fill({ color: 0x22c55e, alpha: p.alpha });
      }
    }
  }
  particles = alive;
}

// === Wall clocks ===
function updateWallClocks() {
  const now = new Date();
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const s = now.getSeconds();

  for (const clock of clockContainers) {
    const g = clock.hands;
    g.clear();

    const hAngle = ((h + m / 60) * Math.PI * 2) / 12 - Math.PI / 2;
    g.moveTo(0, 0);
    g.lineTo(Math.cos(hAngle) * 4, Math.sin(hAngle) * 4);
    g.stroke({ width: 1, color: 0xa1a1aa });

    const mAngle = (m * Math.PI * 2) / 60 - Math.PI / 2;
    g.moveTo(0, 0);
    g.lineTo(Math.cos(mAngle) * 5.5, Math.sin(mAngle) * 5.5);
    g.stroke({ width: 0.6, color: 0xa1a1aa });

    const sAngle = (s * Math.PI * 2) / 60 - Math.PI / 2;
    g.moveTo(0, 0);
    g.lineTo(Math.cos(sAngle) * 6, Math.sin(sAngle) * 6);
    g.stroke({ width: 0.3, color: 0x3b82f6, alpha: 0.7 });

    g.circle(0, 0, 1);
    g.fill(0x3b82f6);
  }
}

export function resetTick() {
  tick = 0;
  clockContainers.length = 0;
  particles = [];
  particleGraphics = null;
  sceneRef = null;
  idleStates.clear();
}
