import type { AgentSprite } from "./officeScene";

let tick = 0;

export function animateAgents(agentSprites: AgentSprite[]) {
  tick++;
  for (const { container, agent, baseY } of agentSprites) {
    if (agent.status === "working") {
      // Gentle bob
      container.y = baseY + Math.sin(tick * 0.04) * 2;
      // Pulse alpha on status dot (last child)
      const dot = container.children[container.children.length - 1];
      if (dot) dot.alpha = 0.6 + Math.sin(tick * 0.08) * 0.4;
    } else if (agent.status === "idle") {
      // Subtle breathing
      container.scale.set(1 + Math.sin(tick * 0.02) * 0.01);
    } else if (agent.status === "paused") {
      // Yellow glow pulse on the body
      const body = container.children[0];
      if (body) body.alpha = 0.7 + Math.sin(tick * 0.05) * 0.3;
    }
    // offline: no animation
  }
}

export function resetTick() {
  tick = 0;
}
