import { Graphics, Text, TextStyle, Container } from "pixi.js";

const DESK_W = 80;
const DESK_H = 50;

const AGENT_COLORS: Record<string, number> = {
  hivemind: 0x3b82f6,
  omega: 0xa855f7,
  prism: 0x10b981,
  oracle: 0xf59e0b,
  sentinel: 0xf43f5e,
  hawkeye: 0x06b6d4,
  atlas: 0x6366f1,
};

const STATUS_COLORS: Record<string, number> = {
  working: 0x22c55e,
  idle: 0x71717a,
  paused: 0xeab308,
  offline: 0xef4444,
};

export function getAgentColor(name: string): number {
  return AGENT_COLORS[name.toLowerCase()] || 0x71717a;
}

export function drawDesk(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);

  // Desk surface
  const desk = new Graphics();
  desk.roundRect(0, 0, DESK_W, DESK_H, 4);
  desk.fill({ color: 0x292524 });
  desk.stroke({ color: 0x3f3f46, width: 1 });
  c.addChild(desk);

  // Monitor
  const monitor = new Graphics();
  monitor.roundRect(DESK_W / 2 - 18, 4, 36, 24, 2);
  monitor.fill({ color: 0x18181b });
  monitor.stroke({ color: 0x3f3f46, width: 1 });
  // Screen glow
  monitor.roundRect(DESK_W / 2 - 15, 7, 30, 18, 1);
  monitor.fill({ color: 0x1e3a5f, alpha: 0.8 });
  c.addChild(monitor);

  // Keyboard
  const kb = new Graphics();
  kb.roundRect(DESK_W / 2 - 14, 32, 28, 8, 1);
  kb.fill({ color: 0x27272a });
  c.addChild(kb);

  // Coffee mug
  const mug = new Graphics();
  mug.circle(DESK_W - 12, 38, 5);
  mug.fill({ color: 0x44403c });
  mug.stroke({ color: 0x57534e, width: 1 });
  c.addChild(mug);

  return c;
}

export function drawAgent(
  name: string,
  status: string,
  x: number,
  y: number
): Container {
  const c = new Container();
  c.position.set(x, y);
  c.label = `agent-${name}`;

  const color = getAgentColor(name);
  const radius = 18;

  // Agent circle
  const body = new Graphics();
  body.circle(0, 0, radius);
  body.fill({ color });
  if (status === "offline") {
    body.alpha = 0.4;
  }
  c.addChild(body);

  // Initial letter
  const initial = new Text({
    text: name.charAt(0).toUpperCase(),
    style: new TextStyle({
      fontFamily: "Inter, sans-serif",
      fontSize: 16,
      fontWeight: "bold",
      fill: 0xffffff,
    }),
  });
  initial.anchor.set(0.5);
  if (status === "offline") initial.alpha = 0.4;
  c.addChild(initial);

  // Status dot
  const dot = new Graphics();
  dot.circle(radius - 2, -radius + 2, 4);
  dot.fill({ color: STATUS_COLORS[status] || 0x71717a });
  c.addChild(dot);

  // Make interactive
  c.eventMode = "static";
  c.cursor = "pointer";
  c.hitArea = { contains: (px: number, py: number) => px * px + py * py <= radius * radius };

  return c;
}

export function drawRoom(
  name: string,
  w: number,
  h: number,
  tint: number
): Container {
  const c = new Container();

  // Floor
  const floor = new Graphics();
  floor.roundRect(0, 0, w, h, 8);
  floor.fill({ color: tint, alpha: 0.08 });
  floor.stroke({ color: tint, width: 1, alpha: 0.15 });
  c.addChild(floor);

  // Header bar
  const header = new Graphics();
  header.roundRect(0, 0, w, 28, 8);
  header.fill({ color: tint, alpha: 0.15 });
  c.addChild(header);

  // Room name
  const label = new Text({
    text: name,
    style: new TextStyle({
      fontFamily: "Inter, sans-serif",
      fontSize: 11,
      fontWeight: "600",
      fill: 0xa1a1aa,
    }),
  });
  label.position.set(10, 7);
  c.addChild(label);

  return c;
}

export { DESK_W, DESK_H };
