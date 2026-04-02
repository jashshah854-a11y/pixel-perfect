import { useRef, useEffect, useState, useCallback } from "react";
import { useOfficePixiRuntime } from "./useOfficePixiRuntime";
import { buildScene, getSceneHeight, type AgentSprite } from "./officeScene";
import { animateScene, resetTick, registerClock, keyState, setSceneRef, setParticleGraphics, triggerClaimNotification, setCollabGraphics, updateCollaborations } from "./officeTicker";
import { initSwarm, updateSwarm, resetSwarm, dispatchSwarm } from "./hivemindSwarm";
import { Graphics } from "pixi.js";
import { playSpawnPulse, playClaimChime } from "@/lib/sounds";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react";

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
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const app = useOfficePixiRuntime(containerRef);
  const spritesRef = useRef<AgentSprite[]>([]);
  const [canvasHeight, setCanvasHeight] = useState(480);
  const [scrolledToDept, setScrolledToDept] = useState<string | null>(null);

  // Build scene when app or agents change
  useEffect(() => {
    if (!app || !app.stage) return;

    const init = () => {
      if (!app.stage) return;
      app.stage.removeChildren();
      resetTick();
      resetSwarm();

      const width = app.screen.width;
      const scene = buildScene(agents, width);
      app.stage.addChild(scene.root);
      spritesRef.current = scene.agentSprites;

      // Particle overlay
      const particleLayer = new Graphics();
      app.stage.addChild(particleLayer);
      setParticleGraphics(particleLayer);

      // Set scene ref for ticker
      setSceneRef(scene);

      // Collaboration graph layer
      const collabLayer = new Graphics();
      app.stage.addChild(collabLayer);
      setCollabGraphics(collabLayer);

      // Init Hivemind swarm system
      initSwarm(scene, app.stage);

      // Load active collaborations
      import("@/integrations/supabase/client").then(({ supabase }) => {
        supabase.from("agent_collaborations").select("*").in("status", ["pending", "in_progress"]).then(({ data }) => {
          if (data) updateCollaborations(data);
        });
        const channel = supabase.channel("collab-graph")
          .on("postgres_changes", { event: "*", schema: "public", table: "agent_collaborations" }, () => {
            supabase.from("agent_collaborations").select("*").in("status", ["pending", "in_progress"]).then(({ data }) => {
              if (data) updateCollaborations(data);
            });
          })
          .subscribe();
        (window as any).__collabChannel = channel;
      });

      // Set canvas height and force PixiJS renderer resize
      const h = getSceneHeight() + 40;
      setCanvasHeight(h);
      requestAnimationFrame(() => {
        if (containerRef.current) {
          app.renderer.resize(containerRef.current.clientWidth, h);
        }
      });

      // Register wall clocks
      const findClocks = (container: import("pixi.js").Container) => {
        for (const child of container.children) {
          if (child.label === "wall-clock") {
            const hands = (child as import("pixi.js").Container).children.find(
              (c) => c.label === "clock-hands"
            );
            if (hands instanceof Graphics) {
              registerClock(hands);
            }
          }
          if ("children" in child) {
            findClocks(child as import("pixi.js").Container);
          }
        }
      };
      findClocks(scene.root);

      // Wire click handlers for agents
      for (const sprite of scene.agentSprites) {
        sprite.container.on("pointertap", (e) => {
          const bounds = (containerRef.current as HTMLDivElement).getBoundingClientRect();
          const sx = e.global.x + bounds.left;
          const sy = e.global.y + bounds.top;
          onAgentClick?.(sprite.agent, sx, sy);
        });
      }

      // Wire click handlers for department rooms (scroll to them)
      for (const room of scene.roomContainers) {
        room.container.on("pointertap", () => {
          if (wrapperRef.current) {
            const scrollTarget = room.y - 20;
            wrapperRef.current.scrollTo({ top: scrollTarget, behavior: "smooth" });
            setScrolledToDept(room.name);
          }
        });

        // Hover glow effect
        room.container.on("pointerenter", () => {
          const border = room.container.children.find((c) => c.label === "room-border");
          if (border) border.alpha = 1.5;
        });
        room.container.on("pointerleave", () => {
          const border = room.container.children.find((c) => c.label === "room-border");
          if (border) border.alpha = 1;
        });
      }
    };

    init();

    // Listen for swarm dispatch events
    const handleSwarm = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.targetRoom && detail?.taskTitle) {
        dispatchSwarm(detail.targetRoom, detail.taskTitle, detail.intensity || 2);
        playSpawnPulse();
      }
    };

    // Listen for agent claim events
    const handleClaim = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.agentId && detail?.taskTitle) {
        triggerClaimNotification(detail.agentId, detail.taskTitle);
        playClaimChime();
      }
    };

    window.addEventListener("hivemind-dispatch", handleSwarm);
    window.addEventListener("agent-claim", handleClaim);

    return () => {
      window.removeEventListener("hivemind-dispatch", handleSwarm);
      window.removeEventListener("agent-claim", handleClaim);
    };
  }, [app, agents, onAgentClick]);

  // Animation ticker
  useEffect(() => {
    if (!app || !app.ticker) return;
    const tickFn = () => {
      animateScene(spritesRef.current);
      updateSwarm();
    };
    app.ticker.add(tickFn);
    return () => {
      app.ticker?.remove(tickFn);
    };
  }, [app]);

  // Keyboard handlers for CEO movement
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      e.preventDefault();
      keyState[key] = true;
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    keyState[key] = false;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.tabIndex = 0;
    el.style.outline = "none";

    el.addEventListener("keydown", handleKeyDown);
    el.addEventListener("keyup", handleKeyUp);

    return () => {
      el.removeEventListener("keydown", handleKeyDown);
      el.removeEventListener("keyup", handleKeyUp);
      for (const k of Object.keys(keyState)) {
        keyState[k] = false;
      }
    };
  }, [handleKeyDown, handleKeyUp]);

  const scrollToCEO = () => {
    if (wrapperRef.current) {
      wrapperRef.current.scrollTo({ top: 0, behavior: "smooth" });
      setScrolledToDept(null);
    }
  };

  return (
    <div ref={wrapperRef} className="relative max-h-[75vh] overflow-y-auto rounded-xl border border-border/30">
      <div
        ref={containerRef}
        style={{ width: "100%", height: canvasHeight, position: "relative", background: "#0d0d12" }}
        className="focus:ring-1 focus:ring-primary/30"
      />

      {/* Back to CEO button */}
      {scrolledToDept && (
        <Button
          size="sm"
          variant="outline"
          className="fixed bottom-24 md:bottom-8 right-8 z-40 shadow-lg"
          onClick={scrollToCEO}
        >
          <ArrowUp className="h-3.5 w-3.5 mr-1" /> Back to CEO
        </Button>
      )}
    </div>
  );
}
