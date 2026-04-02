import { Graphics, Container } from "pixi.js";
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
  for (const { container, agent, baseY } of agentSprites) {
    if (agent.status === "working") {
      container.y = (container.position.y !== undefined ? container.position.y : baseY) ;
      // Bob using local position
      const localBaseY = container.y;
      container.y = localBaseY + Math.sin(tick * 0.04) * 2 - Math.sin((tick - 1) * 0.04) * 2 + container.y - container.y;
      // Actually just set absolute bob on the container within its parent
      // We need to track the original local Y
      const dot = container.children.find((c) => c.label === "status-dot");
      if (dot) dot.alpha = 0.6 + Math.sin(tick * 0.08) * 0.4;

      const aura = container.children.find((c) => c.label === "agent-aura");
      if (aura) {
        aura.alpha = 0.5 + Math.sin(tick * 0.06) * 0.5;
        aura.scale.set(1 + Math.sin(tick * 0.03) * 0.05);
      }
    } else if (agent.status === "idle") {
      container.scale.set(1 + Math.sin(tick * 0.02) * 0.008);
    } else if (agent.status === "paused") {
      const pauseGlow = container.children.find((c) => c.label === "agent-pause-glow");
      if (pauseGlow) pauseGlow.alpha = 0.5 + Math.sin(tick * 0.05) * 0.5;
      const spriteBody = container.children.find((c) => c.label === "sprite-body");
      if (spriteBody) spriteBody.alpha = 0.75 + Math.sin(tick * 0.04) * 0.25;
    }
  }

  // CEO movement
  if (sceneRef) {
    const ceo = sceneRef.ceoContainer;
    const bounds = sceneRef.ceoBounds;
    const speed = 3;

    if (keyState["w"] || keyState["arrowup"]) {
      ceo.y = Math.max(bounds.y - ceo.parent.y + 30, ceo.y - speed);
    }
    if (keyState["s"] || keyState["arrowdown"]) {
      ceo.y = Math.min(bounds.y + bounds.h - ceo.parent.y, ceo.y + speed);
    }
    if (keyState["a"] || keyState["arrowleft"]) {
      ceo.x = Math.max(bounds.x - ceo.parent.x + 30, ceo.x - speed);
    }
    if (keyState["d"] || keyState["arrowright"]) {
      ceo.x = Math.min(bounds.x + bounds.w - ceo.parent.x, ceo.x + speed);
    }

    // Crown animation
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

  // Particles (coffee steam)
  updateParticles();

  // Wall clocks
  if (tick % 60 === 0) updateWallClocks();
}

// === Particle management ===
function updateParticles() {
  if (!particleGraphics) return;

  // Spawn from break room coffee machine
  if (sceneRef && tick % 20 === 0) {
    const pos = sceneRef.coffeeMachinePos;
    for (let i = 0; i < 3; i++) {
      particles.push({
        x: pos.x + (Math.random() - 0.5) * 8,
        y: pos.y - 30,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.3 - Math.random() * 0.4,
        alpha: 0.3 + Math.random() * 0.2,
        life: 60 + Math.random() * 40,
      });
    }
  }

  // Spawn from desk coffee mugs (every ~40 ticks, 1-2 particles per mug)
  if (sceneRef && tick % 40 === 0) {
    for (const mug of sceneRef.mugPositions) {
      for (let i = 0; i < 2; i++) {
        particles.push({
          x: mug.x + (Math.random() - 0.5) * 4,
          y: mug.y - 6,
          vx: (Math.random() - 0.5) * 0.15,
          vy: -0.2 - Math.random() * 0.25,
          alpha: 0.15 + Math.random() * 0.1,
          life: 40 + Math.random() * 30,
        });
      }
    }
  }

  // Animate monitor screens for working agents
  if (sceneRef) {
    for (const mon of sceneRef.monitorScreens) {
      if (mon.status === "working") {
        // Subtle color shift via alpha oscillation
        mon.container.alpha = 0.8 + Math.sin(tick * 0.08 + mon.container.x * 0.1) * 0.15;
      }
    }
  }

  // Update particles
  particleGraphics.clear();
  const alive: Particle[] = [];
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    p.alpha -= 0.003;
    if (p.life > 0 && p.alpha > 0.01) {
      alive.push(p);
      particleGraphics.circle(p.x, p.y, 1.2 + (1 - p.alpha) * 1.2);
      particleGraphics.fill({ color: 0x9ca3af, alpha: p.alpha });
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
    g.stroke({ width: 0.3, color: 0xef4444, alpha: 0.7 });

    g.circle(0, 0, 1);
    g.fill(0xa1a1aa);
  }
}

export function resetTick() {
  tick = 0;
  clockContainers.length = 0;
  particles = [];
  particleGraphics = null;
  sceneRef = null;
}
