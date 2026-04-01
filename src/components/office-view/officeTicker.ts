import { Graphics } from "pixi.js";
import type { AgentSprite } from "./officeScene";

let tick = 0;

export function animateAgents(agentSprites: AgentSprite[]) {
  tick++;

  for (const { container, agent, baseY } of agentSprites) {
    if (agent.status === "working") {
      // Gentle bob
      container.y = baseY + Math.sin(tick * 0.04) * 2;

      // Pulse status dot
      const dot = container.children.find((c) => c.label === "status-dot");
      if (dot) dot.alpha = 0.6 + Math.sin(tick * 0.08) * 0.4;

      // Pulse aura
      const aura = container.children.find((c) => c.label === "agent-aura");
      if (aura) {
        aura.alpha = 0.5 + Math.sin(tick * 0.06) * 0.5;
        aura.scale.set(1 + Math.sin(tick * 0.03) * 0.05);
      }
    } else if (agent.status === "idle") {
      // Subtle breathing
      container.scale.set(1 + Math.sin(tick * 0.02) * 0.008);
    } else if (agent.status === "paused") {
      // Yellow glow pulse
      const body = container.children[1]; // body after shadow
      if (body) body.alpha = 0.7 + Math.sin(tick * 0.05) * 0.3;
    }
    // offline: no animation
  }

  // Animate wall clocks (find them in the scene)
  // This is handled per-clock via the "clock-hands" label
  updateWallClocks();
}

// Track clock containers for animation
const clockContainers: { hands: Graphics; lastUpdate: number }[] = [];

export function registerClock(handsGraphics: Graphics) {
  clockContainers.push({ hands: handsGraphics, lastUpdate: 0 });
}

function updateWallClocks() {
  const now = new Date();
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const s = now.getSeconds();

  // Only update every 60 ticks (~1 second at 60fps)
  if (tick % 60 !== 0) return;

  for (const clock of clockContainers) {
    const g = clock.hands;
    g.clear();

    // Hour hand
    const hAngle = ((h + m / 60) * Math.PI * 2) / 12 - Math.PI / 2;
    g.moveTo(0, 0);
    g.lineTo(Math.cos(hAngle) * 4, Math.sin(hAngle) * 4);
    g.stroke({ width: 1, color: 0xa1a1aa });

    // Minute hand
    const mAngle = (m * Math.PI * 2) / 60 - Math.PI / 2;
    g.moveTo(0, 0);
    g.lineTo(Math.cos(mAngle) * 5.5, Math.sin(mAngle) * 5.5);
    g.stroke({ width: 0.6, color: 0xa1a1aa });

    // Second hand
    const sAngle = (s * Math.PI * 2) / 60 - Math.PI / 2;
    g.moveTo(0, 0);
    g.lineTo(Math.cos(sAngle) * 6, Math.sin(sAngle) * 6);
    g.stroke({ width: 0.3, color: 0xef4444, alpha: 0.7 });

    // Center dot
    g.circle(0, 0, 1);
    g.fill(0xa1a1aa);
  }
}

export function resetTick() {
  tick = 0;
  clockContainers.length = 0;
}
