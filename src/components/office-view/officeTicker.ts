import { Graphics } from "pixi.js";
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
      // Idle sway — weight shifting
      const body = container.children.find((c) => c.label === "sprite-body");
      if (body) {
        body.x = Math.sin(tick * 0.015) * 0.8;
      }
      // Breathing
      container.scale.set(1 + Math.sin(tick * 0.02) * 0.006);
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
        // Tiny bright dots
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
}
