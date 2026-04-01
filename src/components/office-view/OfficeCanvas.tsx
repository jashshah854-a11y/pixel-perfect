import { useRef, useEffect, useState } from "react";
import { useOfficePixiRuntime } from "./useOfficePixiRuntime";
import { buildScene, getSceneHeight, type AgentSprite } from "./officeScene";
import { animateAgents, resetTick } from "./officeTicker";

interface Agent {
  id: string;
  name: string;
  status: string;
  role: string;
  department: string;
  current_task: string | null;
  tokens_used: number;
}

interface OfficeCanvasProps {
  agents: Agent[];
  onAgentClick?: (agent: Agent, screenX: number, screenY: number) => void;
}

export function OfficeCanvas({ agents, onAgentClick }: OfficeCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const app = useOfficePixiRuntime(containerRef);
  const spritesRef = useRef<AgentSprite[]>([]);
  const [canvasHeight, setCanvasHeight] = useState(420);

  // Build scene when app or agents change
  useEffect(() => {
    if (!app) return;

    // Clear stage
    app.stage.removeChildren();
    resetTick();

    const width = app.screen.width;
    const { root, agentSprites } = buildScene(agents, width);
    app.stage.addChild(root);
    spritesRef.current = agentSprites;

    // Set canvas height
    const h = getSceneHeight() + 40;
    setCanvasHeight(h);

    // Wire click handlers
    for (const sprite of agentSprites) {
      sprite.container.on("pointertap", (e) => {
        const bounds = (containerRef.current as HTMLDivElement).getBoundingClientRect();
        const sx = e.global.x + bounds.left;
        const sy = e.global.y + bounds.top;
        onAgentClick?.(sprite.agent, sx, sy);
      });
    }
  }, [app, agents, onAgentClick]);

  // Animation ticker
  useEffect(() => {
    if (!app) return;
    const tickFn = () => animateAgents(spritesRef.current);
    app.ticker.add(tickFn);
    return () => {
      app.ticker.remove(tickFn);
    };
  }, [app]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: canvasHeight, position: "relative" }}
      className="rounded-xl overflow-hidden border border-border/50"
    />
  );
}
