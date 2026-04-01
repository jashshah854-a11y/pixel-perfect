import { Graphics, Text, TextStyle, Container } from "pixi.js";

// === Constants ===
const DESK_W = 72;
const DESK_H = 38;
const AGENT_RADIUS = 20;

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

// === Blend helper ===
function blend(from: number, to: number, t: number): number {
  const c = Math.max(0, Math.min(1, t));
  const fr = (from >> 16) & 0xff, fg = (from >> 8) & 0xff, fb = from & 0xff;
  const tr = (to >> 16) & 0xff, tg = (to >> 8) & 0xff, tb = to & 0xff;
  return (Math.round(fr + (tr - fr) * c) << 16) |
    (Math.round(fg + (tg - fg) * c) << 8) |
    Math.round(fb + (tb - fb) * c);
}

// === Desk Drawing (claw-empire quality) ===
export function drawDesk(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);

  const g = new Graphics();

  // Multi-layer shadow
  g.ellipse(DESK_W / 2, DESK_H + 4, DESK_W / 2 + 6, 6);
  g.fill({ color: 0x000000, alpha: 0.06 });
  g.ellipse(DESK_W / 2, DESK_H + 3, DESK_W / 2 + 4, 5);
  g.fill({ color: 0x000000, alpha: 0.1 });
  g.ellipse(DESK_W / 2, DESK_H + 2, DESK_W / 2 + 2, 3.5);
  g.fill({ color: 0x000000, alpha: 0.12 });

  // Desk legs
  g.roundRect(3, DESK_H - 2, 3, 6, 1);
  g.fill(0x3f3834);
  g.roundRect(DESK_W - 6, DESK_H - 2, 3, 6, 1);
  g.fill(0x3f3834);

  // Desk body — layered warm wood
  g.roundRect(0, 0, DESK_W, DESK_H, 3);
  g.fill(0x2a2520);
  g.roundRect(1, 1, DESK_W - 2, DESK_H - 2, 2);
  g.fill(0x3d342c);
  g.roundRect(2, 2, DESK_W - 4, DESK_H - 4, 1.5);
  g.fill(0x4a3f35);

  // Top highlight
  g.roundRect(2, 2, DESK_W - 4, 5, 1);
  g.fill({ color: 0x5c4f42, alpha: 0.3 });

  // Wood grain lines
  for (let i = 0; i < 4; i++) {
    g.moveTo(4, 5 + i * 7);
    g.lineTo(DESK_W - 4, 5 + i * 7);
    g.stroke({ width: 0.3, color: 0x5a4d40, alpha: 0.25 });
  }

  // Bottom edge shadow
  g.moveTo(2, DESK_H - 1);
  g.lineTo(DESK_W - 2, DESK_H - 1);
  g.stroke({ width: 0.6, color: 0x1a1512, alpha: 0.3 });
  c.addChild(g);

  // Monitor
  const mon = new Graphics();
  // Monitor stand
  mon.rect(DESK_W / 2 - 3, 3, 6, 3);
  mon.fill(0x27272a);
  mon.rect(DESK_W / 2 - 8, 1, 16, 3);
  mon.fill(0x27272a);
  // Screen frame
  mon.roundRect(DESK_W / 2 - 20, -18, 40, 20, 2);
  mon.fill(0x1c1c1e);
  mon.stroke({ color: 0x333336, width: 1 });
  // Screen (labeled "screen" for ticker animation)
  mon.roundRect(DESK_W / 2 - 17, -15, 34, 14, 1);
  mon.fill({ color: 0x1a2a40, alpha: 0.9 });
  mon.label = "monitor-screen";
  c.addChild(mon);

  // Monitor glow (ambient light on desk surface)
  const glow = new Graphics();
  glow.ellipse(DESK_W / 2, 2, 22, 6);
  glow.fill({ color: 0x3b82f6, alpha: 0.04 });
  glow.label = "monitor-glow";
  c.addChild(glow);

  // Keyboard
  const kb = new Graphics();
  kb.roundRect(DESK_W / 2 - 16, 8, 32, 10, 1.5);
  kb.fill(0x27272a);
  kb.stroke({ color: 0x3f3f46, width: 0.5 });
  // Key rows
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      kb.roundRect(DESK_W / 2 - 14 + col * 3.7, 9.5 + row * 2.8, 2.8, 2, 0.3);
      kb.fill({ color: 0x3a3a3e, alpha: 0.6 });
    }
  }
  // Spacebar
  kb.roundRect(DESK_W / 2 - 8, 9.5 + 3 * 2.8, 16, 2, 0.5);
  kb.fill({ color: 0x3a3a3e, alpha: 0.5 });
  c.addChild(kb);

  // Coffee mug
  const mug = new Graphics();
  const mx = DESK_W - 14, my = DESK_H - 14;
  // Mug body
  mug.roundRect(mx - 5, my - 6, 10, 10, 2);
  mug.fill(0x44403c);
  mug.stroke({ color: 0x57534e, width: 0.8 });
  // Handle
  mug.arc(mx + 5, my - 1, 4, -1.2, 1.2);
  mug.stroke({ width: 1, color: 0x57534e });
  // Liquid
  mug.ellipse(mx, my - 4, 3.5, 1.5);
  mug.fill({ color: 0x7c5a3a, alpha: 0.7 });
  // Rim highlight
  mug.ellipse(mx, my - 6, 4, 1.2);
  mug.stroke({ width: 0.4, color: 0x6b6560, alpha: 0.5 });
  mug.label = "coffee-mug";
  c.addChild(mug);

  // Paper stack
  const papers = new Graphics();
  const px = 6, py = DESK_H - 16;
  for (let i = 2; i >= 0; i--) {
    const ox = i * 0.8, oy = i * 1.2;
    papers.roundRect(px + ox, py + oy, 14, 10, 0.5);
    papers.fill(blend(0x2a2a2e, 0x333338, i / 2));
    papers.stroke({ color: 0x3f3f46, width: 0.3 });
    // Text lines
    for (let l = 0; l < 3; l++) {
      papers.moveTo(px + ox + 2, py + oy + 2.5 + l * 2.5);
      papers.lineTo(px + ox + 10 - l * 1.5, py + oy + 2.5 + l * 2.5);
      papers.stroke({ width: 0.3, color: 0x52525b, alpha: 0.4 });
    }
  }
  c.addChild(papers);

  // Pencil holder
  const ph = new Graphics();
  const phx = DESK_W - 14, phy = 8;
  ph.roundRect(phx - 4, phy, 8, 10, 1);
  ph.fill(0x3a3530);
  ph.stroke({ color: 0x4a443e, width: 0.5 });
  // Pencils
  ph.moveTo(phx - 2, phy);
  ph.lineTo(phx - 3, phy - 6);
  ph.stroke({ width: 1, color: 0xeab308, alpha: 0.7 });
  ph.moveTo(phx + 1, phy);
  ph.lineTo(phx + 2, phy - 5);
  ph.stroke({ width: 1, color: 0x3b82f6, alpha: 0.7 });
  ph.moveTo(phx + 3, phy + 1);
  ph.lineTo(phx + 4, phy - 4);
  ph.stroke({ width: 1, color: 0xef4444, alpha: 0.6 });
  c.addChild(ph);

  return c;
}

// === Chair ===
export function drawChair(x: number, y: number, accentColor: number): Container {
  const c = new Container();
  c.position.set(x, y);

  const g = new Graphics();
  // Chair base shadow
  g.ellipse(0, 8, 10, 3);
  g.fill({ color: 0x000000, alpha: 0.1 });
  // Seat
  g.ellipse(0, 0, 10, 5);
  g.fill(blend(accentColor, 0x000000, 0.3));
  g.stroke({ color: blend(accentColor, 0x000000, 0.1), width: 0.5 });
  // Back rest
  g.roundRect(-8, -12, 16, 10, 3);
  g.fill(blend(accentColor, 0x000000, 0.2));
  g.stroke({ color: blend(accentColor, 0xffffff, 0.1), width: 0.3 });
  // Highlight
  g.roundRect(-5, -10, 10, 4, 1.5);
  g.fill({ color: blend(accentColor, 0xffffff, 0.2), alpha: 0.15 });
  c.addChild(g);

  return c;
}

// === Agent Avatar ===
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

  // Shadow
  const shadow = new Graphics();
  shadow.ellipse(0, AGENT_RADIUS - 2, AGENT_RADIUS * 0.8, 4);
  shadow.fill({ color: 0x000000, alpha: 0.15 });
  c.addChild(shadow);

  // Aura (for working status)
  if (status === "working") {
    const aura = new Graphics();
    aura.circle(0, 0, AGENT_RADIUS + 4);
    aura.fill({ color: 0x22c55e, alpha: 0.08 });
    aura.label = "agent-aura";
    c.addChild(aura);
  }

  // Body circle
  const body = new Graphics();
  body.circle(0, 0, AGENT_RADIUS);
  body.fill(color);
  // Inner gradient highlight
  body.circle(-4, -5, AGENT_RADIUS * 0.6);
  body.fill({ color: 0xffffff, alpha: 0.08 });
  if (status === "offline") {
    body.alpha = 0.35;
  }
  c.addChild(body);

  // Ring
  const ring = new Graphics();
  ring.circle(0, 0, AGENT_RADIUS);
  ring.stroke({ color: blend(color, 0xffffff, 0.2), width: 1.5, alpha: 0.4 });
  if (status === "offline") ring.alpha = 0.35;
  c.addChild(ring);

  // Initial letter
  const initial = new Text({
    text: name.charAt(0).toUpperCase(),
    style: new TextStyle({
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 18,
      fontWeight: "bold",
      fill: 0xffffff,
    }),
  });
  initial.anchor.set(0.5);
  if (status === "offline") initial.alpha = 0.35;
  c.addChild(initial);

  // Status dot
  const dot = new Graphics();
  dot.circle(AGENT_RADIUS - 3, -AGENT_RADIUS + 3, 5);
  dot.fill(STATUS_COLORS[status] || 0x71717a);
  dot.stroke({ color: 0x0a0a0a, width: 1.5 });
  dot.label = "status-dot";
  c.addChild(dot);

  // Name label below
  const label = new Text({
    text: name,
    style: new TextStyle({
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 9,
      fill: 0x71717a,
      fontWeight: "500",
    }),
  });
  label.anchor.set(0.5, 0);
  label.position.set(0, AGENT_RADIUS + 4);
  if (status === "offline") label.alpha = 0.35;
  c.addChild(label);

  // Make interactive
  c.eventMode = "static";
  c.cursor = "pointer";
  c.hitArea = { contains: (px: number, py: number) => px * px + py * py <= AGENT_RADIUS * AGENT_RADIUS };

  return c;
}

// === Room Drawing ===
export function drawRoom(
  name: string,
  w: number,
  h: number,
  tint: number
): Container {
  const c = new Container();

  // Floor with tiled pattern
  const floor = new Graphics();
  floor.roundRect(0, 0, w, h, 6);
  floor.fill({ color: tint, alpha: 0.04 });
  c.addChild(floor);

  // Floor tiles (checkerboard, subtle)
  const tileSize = 24;
  const tiles = new Graphics();
  for (let ty = 32; ty < h - 4; ty += tileSize) {
    for (let tx = 4; tx < w - 4; tx += tileSize) {
      const isEven = ((Math.floor(tx / tileSize) + Math.floor(ty / tileSize)) % 2) === 0;
      if (isEven) {
        const tw = Math.min(tileSize, w - 4 - tx);
        const th = Math.min(tileSize, h - 4 - ty);
        tiles.rect(tx, ty, tw, th);
        tiles.fill({ color: tint, alpha: 0.03 });
      }
    }
  }
  c.addChild(tiles);

  // Room border
  const border = new Graphics();
  border.roundRect(0, 0, w, h, 6);
  border.stroke({ color: tint, width: 1, alpha: 0.12 });
  c.addChild(border);

  // Wall header with gradient
  const wallH = 30;
  const wall = new Graphics();
  const bands = 12;
  const bandH = wallH / bands;
  for (let i = 0; i < bands; i++) {
    const alpha = 0.12 + (1 - i / bands) * 0.08;
    wall.rect(0, i * bandH, w, bandH + 0.5);
    wall.fill({ color: tint, alpha });
  }
  // Round top corners
  wall.roundRect(0, 0, w, wallH, 6);
  wall.stroke({ color: tint, width: 0.5, alpha: 0.15 });
  c.addChild(wall);

  // Room name
  const label = new Text({
    text: name,
    style: new TextStyle({
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 11,
      fontWeight: "600",
      fill: blend(tint, 0xffffff, 0.4),
      letterSpacing: 0.5,
    }),
  });
  label.position.set(12, 8);
  c.addChild(label);

  // Windows on wall
  const windowCount = Math.min(Math.floor(w / 60), 3);
  const windowW = 18, windowH = 12;
  const windowStartX = w - windowCount * 28 - 8;
  for (let i = 0; i < windowCount; i++) {
    const wx = windowStartX + i * 28;
    const wy = 8;
    const win = new Graphics();
    // Frame
    win.roundRect(wx, wy, windowW, windowH, 1.5);
    win.fill({ color: 0x1a2a40, alpha: 0.4 });
    win.stroke({ color: tint, width: 0.5, alpha: 0.2 });
    // Panes
    win.moveTo(wx + windowW / 2, wy);
    win.lineTo(wx + windowW / 2, wy + windowH);
    win.stroke({ width: 0.3, color: tint, alpha: 0.15 });
    win.moveTo(wx, wy + windowH / 2);
    win.lineTo(wx + windowW, wy + windowH / 2);
    win.stroke({ width: 0.3, color: tint, alpha: 0.15 });
    // Sky reflection
    win.roundRect(wx + 2, wy + 1, windowW / 2 - 3, windowH / 2 - 2, 0.5);
    win.fill({ color: 0x60a5fa, alpha: 0.06 });
    c.addChild(win);
  }

  // Ambient corner shadow (bottom-right)
  const ambientShadow = new Graphics();
  ambientShadow.roundRect(w - 30, h - 30, 30, 30, 6);
  ambientShadow.fill({ color: 0x000000, alpha: 0.02 });
  c.addChild(ambientShadow);

  return c;
}

// === Wall Clock ===
export function drawWallClock(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);
  c.label = "wall-clock";

  const g = new Graphics();
  // Clock face
  g.circle(0, 0, 8);
  g.fill({ color: 0x1c1c1e, alpha: 0.8 });
  g.stroke({ color: 0x3f3f46, width: 0.8 });
  // Hour markers
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI * 2) / 12 - Math.PI / 2;
    const x1 = Math.cos(angle) * 5.5;
    const y1 = Math.sin(angle) * 5.5;
    const x2 = Math.cos(angle) * 7;
    const y2 = Math.sin(angle) * 7;
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke({ width: i % 3 === 0 ? 0.8 : 0.3, color: 0x71717a, alpha: 0.6 });
  }
  c.addChild(g);

  // Hands container (animated by ticker)
  const hands = new Graphics();
  hands.label = "clock-hands";
  c.addChild(hands);

  return c;
}

export { DESK_W, DESK_H, AGENT_RADIUS };
