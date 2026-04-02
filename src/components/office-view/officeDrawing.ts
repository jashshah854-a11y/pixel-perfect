import { Graphics, Text, TextStyle, Container } from "pixi.js";

// === Constants ===
const DESK_W = 72;
const DESK_H = 38;
const AGENT_RADIUS = 20;
const CEO_RADIUS = 28;

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

// === Desk Drawing ===
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
  mon.rect(DESK_W / 2 - 3, 3, 6, 3);
  mon.fill(0x27272a);
  mon.rect(DESK_W / 2 - 8, 1, 16, 3);
  mon.fill(0x27272a);
  mon.roundRect(DESK_W / 2 - 20, -18, 40, 20, 2);
  mon.fill(0x1c1c1e);
  mon.stroke({ color: 0x333336, width: 1 });
  mon.roundRect(DESK_W / 2 - 17, -15, 34, 14, 1);
  mon.fill({ color: 0x1a2a40, alpha: 0.9 });
  mon.label = "monitor-screen";
  c.addChild(mon);

  // Monitor glow
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
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      kb.roundRect(DESK_W / 2 - 14 + col * 3.7, 9.5 + row * 2.8, 2.8, 2, 0.3);
      kb.fill({ color: 0x3a3a3e, alpha: 0.6 });
    }
  }
  kb.roundRect(DESK_W / 2 - 8, 9.5 + 3 * 2.8, 16, 2, 0.5);
  kb.fill({ color: 0x3a3a3e, alpha: 0.5 });
  c.addChild(kb);

  // Coffee mug
  const mug = new Graphics();
  const mx = DESK_W - 14, my = DESK_H - 14;
  mug.roundRect(mx - 5, my - 6, 10, 10, 2);
  mug.fill(0x44403c);
  mug.stroke({ color: 0x57534e, width: 0.8 });
  mug.arc(mx + 5, my - 1, 4, -1.2, 1.2);
  mug.stroke({ width: 1, color: 0x57534e });
  mug.ellipse(mx, my - 4, 3.5, 1.5);
  mug.fill({ color: 0x7c5a3a, alpha: 0.7 });
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
  g.ellipse(0, 8, 10, 3);
  g.fill({ color: 0x000000, alpha: 0.1 });
  g.ellipse(0, 0, 10, 5);
  g.fill(blend(accentColor, 0x000000, 0.3));
  g.stroke({ color: blend(accentColor, 0x000000, 0.1), width: 0.5 });
  g.roundRect(-8, -12, 16, 10, 3);
  g.fill(blend(accentColor, 0x000000, 0.2));
  g.stroke({ color: blend(accentColor, 0xffffff, 0.1), width: 0.3 });
  g.roundRect(-5, -10, 10, 4, 1.5);
  g.fill({ color: blend(accentColor, 0xffffff, 0.2), alpha: 0.15 });
  c.addChild(g);

  return c;
}

// === Agent Avatar (Humanoid Figure) ===
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
  const isOffline = status === "offline";
  const baseAlpha = isOffline ? 0.35 : 1;

  // Ground shadow
  const shadow = new Graphics();
  shadow.ellipse(0, 22, 12, 4);
  shadow.fill({ color: 0x000000, alpha: 0.18 * baseAlpha });
  c.addChild(shadow);

  // Aura (for working status)
  if (status === "working") {
    const aura = new Graphics();
    aura.ellipse(0, 0, 18, 24);
    aura.fill({ color: 0x22c55e, alpha: 0.08 });
    aura.label = "agent-aura";
    c.addChild(aura);
  }

  // --- Legs ---
  const legs = new Graphics();
  legs.alpha = baseAlpha;
  // Left leg
  legs.roundRect(-7, 10, 5, 14, 2);
  legs.fill(0x1e293b);
  // Right leg
  legs.roundRect(2, 10, 5, 14, 2);
  legs.fill(0x1e293b);
  // Shoes
  legs.roundRect(-8, 22, 7, 3, 1.5);
  legs.fill(0x27272a);
  legs.roundRect(1, 22, 7, 3, 1.5);
  legs.fill(0x27272a);
  c.addChild(legs);

  // --- Body / Torso ---
  const body = new Graphics();
  body.alpha = baseAlpha;
  // Main torso
  body.roundRect(-10, -8, 20, 20, 5);
  body.fill(color);
  // Shirt highlight
  body.roundRect(-8, -6, 16, 8, 3);
  body.fill({ color: 0xffffff, alpha: 0.1 });
  // Collar
  body.moveTo(-3, -8);
  body.lineTo(0, -5);
  body.lineTo(3, -8);
  body.stroke({ width: 1, color: blend(color, 0xffffff, 0.3), alpha: 0.5 });
  c.addChild(body);

  // --- Arms ---
  const arms = new Graphics();
  arms.alpha = baseAlpha;
  // Left arm
  arms.roundRect(-14, -6, 5, 16, 2.5);
  arms.fill(blend(color, 0x000000, 0.15));
  // Left hand
  arms.circle(-11.5, 11, 3);
  arms.fill(0xf0c8a0);
  // Right arm
  arms.roundRect(9, -6, 5, 16, 2.5);
  arms.fill(blend(color, 0x000000, 0.15));
  // Right hand
  arms.circle(11.5, 11, 3);
  arms.fill(0xf0c8a0);
  c.addChild(arms);

  // --- Head ---
  const head = new Graphics();
  head.alpha = baseAlpha;
  // Neck
  head.roundRect(-3, -12, 6, 6, 2);
  head.fill(0xf0c8a0);
  // Head shape
  head.circle(0, -20, 11);
  head.fill(0xf0c8a0);
  // Hair — short cap style, NOT side tufts
  const hairColor = blend(color, 0x1a1a2e, 0.6);
  // Top hair cap
  head.arc(0, -20, 11.5, -Math.PI * 0.85, -Math.PI * 0.15);
  head.fill(hairColor);
  // Fringe/bangs
  head.roundRect(-9, -29, 18, 5, 3);
  head.fill(hairColor);
  c.addChild(head);

  // --- Face ---
  const face = new Graphics();
  face.alpha = baseAlpha;
  // Eyes — bigger, friendlier
  face.circle(-4, -20, 2.5);
  face.fill(0xffffff);
  face.circle(4, -20, 2.5);
  face.fill(0xffffff);
  // Pupils
  face.circle(-3.5, -20, 1.2);
  face.fill(0x2d2d3f);
  face.circle(4.5, -20, 1.2);
  face.fill(0x2d2d3f);
  // Eye shine
  face.circle(-3, -20.8, 0.6);
  face.fill({ color: 0xffffff, alpha: 0.8 });
  face.circle(5, -20.8, 0.6);
  face.fill({ color: 0xffffff, alpha: 0.8 });
  // Mouth
  if (status === "working") {
    // Smile
    face.arc(0, -16, 3, 0.1, Math.PI - 0.1);
    face.stroke({ width: 0.8, color: 0x8b6b52 });
  } else if (status === "offline") {
    // Sleeping mouth
    face.moveTo(-2, -16);
    face.lineTo(2, -16);
    face.stroke({ width: 0.8, color: 0x8b6b52 });
  } else {
    // Neutral
    face.arc(0, -17, 2, 0.2, Math.PI - 0.2);
    face.stroke({ width: 0.7, color: 0x8b6b52 });
  }
  // Blush
  face.ellipse(-6, -17, 2, 1.2);
  face.fill({ color: 0xe8a0a0, alpha: 0.2 });
  face.ellipse(6, -17, 2, 1.2);
  face.fill({ color: 0xe8a0a0, alpha: 0.2 });
  c.addChild(face);

  // Status dot
  const dot = new Graphics();
  dot.circle(12, -28, 4);
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
      fill: 0xa1a1aa,
      fontWeight: "500",
    }),
  });
  label.anchor.set(0.5, 0);
  label.position.set(0, 26);
  label.alpha = baseAlpha;
  c.addChild(label);

  // Make interactive
  c.eventMode = "static";
  c.cursor = "pointer";
  c.hitArea = { contains: (px: number, py: number) => px > -16 && px < 16 && py > -32 && py < 28 };

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
  c.label = "department-room";

  const base = new Graphics();
  base.roundRect(0, 0, w, h, 8);
  base.fill({ color: 0x111116, alpha: 0.92 });
  c.addChild(base);

  const floor = new Graphics();
  floor.roundRect(0, 0, w, h, 8);
  floor.fill({ color: tint, alpha: 0.06 });
  c.addChild(floor);

  // Floor tiles
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
  border.roundRect(0, 0, w, h, 8);
  border.stroke({ color: tint, width: 1.5, alpha: 0.35 });
  border.label = "room-border";
  c.addChild(border);

  // Top accent bar
  const topBar = new Graphics();
  topBar.roundRect(0, 0, w, 3, 8);
  topBar.fill({ color: tint, alpha: 0.7 });
  c.addChild(topBar);

  // Wall header gradient
  const wallH = 36;
  const wall = new Graphics();
  const bands = 16;
  const bandH = wallH / bands;
  for (let i = 0; i < bands; i++) {
    const alpha = 0.22 - (i / bands) * 0.18;
    wall.rect(0, 3 + i * bandH, w, bandH + 0.5);
    wall.fill({ color: tint, alpha });
  }
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

  // Windows
  const windowCount = Math.min(Math.floor(w / 60), 3);
  const windowW = 18, windowH = 12;
  const windowStartX = w - windowCount * 28 - 8;
  for (let i = 0; i < windowCount; i++) {
    const wx = windowStartX + i * 28;
    const wy = 8;
    const win = new Graphics();
    win.roundRect(wx, wy, windowW, windowH, 1.5);
    win.fill({ color: 0x1a2a40, alpha: 0.4 });
    win.stroke({ color: tint, width: 0.5, alpha: 0.2 });
    win.moveTo(wx + windowW / 2, wy);
    win.lineTo(wx + windowW / 2, wy + windowH);
    win.stroke({ width: 0.3, color: tint, alpha: 0.15 });
    win.moveTo(wx, wy + windowH / 2);
    win.lineTo(wx + windowW, wy + windowH / 2);
    win.stroke({ width: 0.3, color: tint, alpha: 0.15 });
    win.roundRect(wx + 2, wy + 1, windowW / 2 - 3, windowH / 2 - 2, 0.5);
    win.fill({ color: 0x60a5fa, alpha: 0.06 });
    c.addChild(win);
  }

  return c;
}

// === Wall Clock ===
export function drawWallClock(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);
  c.label = "wall-clock";

  const g = new Graphics();
  g.circle(0, 0, 8);
  g.fill({ color: 0x1c1c1e, alpha: 0.8 });
  g.stroke({ color: 0x3f3f46, width: 0.8 });
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

  const hands = new Graphics();
  hands.label = "clock-hands";
  c.addChild(hands);

  return c;
}

// === CEO Avatar (Humanoid Figure) ===
export function drawCEO(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);
  c.label = "ceo-avatar";

  const ceoColor = 0xf59e0b;

  // Ground shadow
  const shadow = new Graphics();
  shadow.ellipse(0, 26, 14, 5);
  shadow.fill({ color: 0x000000, alpha: 0.22 });
  c.addChild(shadow);

  // Golden aura
  const aura = new Graphics();
  aura.ellipse(0, 0, 22, 30);
  aura.fill({ color: 0xf59e0b, alpha: 0.06 });
  aura.label = "ceo-aura";
  c.addChild(aura);

  // --- Legs ---
  const legs = new Graphics();
  legs.roundRect(-8, 12, 6, 16, 2);
  legs.fill(0x1e293b);
  legs.roundRect(2, 12, 6, 16, 2);
  legs.fill(0x1e293b);
  legs.roundRect(-9, 26, 8, 3, 1.5);
  legs.fill(0x1a1a2e);
  legs.roundRect(1, 26, 8, 3, 1.5);
  legs.fill(0x1a1a2e);
  c.addChild(legs);

  // --- Body ---
  const body = new Graphics();
  body.roundRect(-12, -10, 24, 24, 6);
  body.fill(ceoColor);
  // Suit lapels
  body.roundRect(-10, -8, 20, 10, 3);
  body.fill({ color: 0xffffff, alpha: 0.1 });
  // Tie
  body.moveTo(0, -8);
  body.lineTo(-2, -2);
  body.lineTo(0, 2);
  body.lineTo(2, -2);
  body.closePath();
  body.fill(0xef4444);
  c.addChild(body);

  // --- Arms ---
  const arms = new Graphics();
  arms.roundRect(-16, -8, 5, 18, 2.5);
  arms.fill(blend(ceoColor, 0x000000, 0.15));
  arms.circle(-13.5, 11, 3.5);
  arms.fill(0xdbb896);
  arms.roundRect(11, -8, 5, 18, 2.5);
  arms.fill(blend(ceoColor, 0x000000, 0.15));
  arms.circle(13.5, 11, 3.5);
  arms.fill(0xdbb896);
  c.addChild(arms);

  // --- Head ---
  const head = new Graphics();
  head.roundRect(-3, -14, 6, 6, 2);
  head.fill(0xf0c8a0);
  head.circle(0, -24, 13);
  head.fill(0xf0c8a0);
  // Hair — clean short style
  head.arc(0, -24, 13.5, -Math.PI * 0.85, -Math.PI * 0.15);
  head.fill(0x1a1a2e);
  head.roundRect(-10, -35, 20, 6, 3);
  head.fill(0x1a1a2e);
  c.addChild(head);

  // --- Face ---
  const face = new Graphics();
  face.circle(-5, -25, 2.2);
  face.fill(0xffffff);
  face.circle(5, -25, 2.2);
  face.fill(0xffffff);
  face.circle(-4.5, -25, 1.2);
  face.fill(0x1a1a2e);
  face.circle(5.5, -25, 1.2);
  face.fill(0x1a1a2e);
  face.circle(-4, -25.5, 0.5);
  face.fill({ color: 0xffffff, alpha: 0.8 });
  face.circle(6, -25.5, 0.5);
  face.fill({ color: 0xffffff, alpha: 0.8 });
  // Confident smile
  face.arc(0, -19, 4, 0.1, Math.PI - 0.1);
  face.stroke({ width: 1, color: 0x8b6b52 });
  // Blush
  face.ellipse(-7, -20, 2.5, 1.5);
  face.fill({ color: 0xe8a0a0, alpha: 0.2 });
  face.ellipse(7, -20, 2.5, 1.5);
  face.fill({ color: 0xe8a0a0, alpha: 0.2 });
  c.addChild(face);

  // Crown
  const crown = drawCrown();
  crown.position.set(0, -38);
  crown.label = "ceo-crown";
  c.addChild(crown);

  // Name
  const label = new Text({
    text: "Jash (CEO)",
    style: new TextStyle({
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 10,
      fill: 0xfbbf24,
      fontWeight: "600",
    }),
  });
  label.anchor.set(0.5, 0);
  label.position.set(0, 30);
  c.addChild(label);

  // Interactive
  c.eventMode = "static";
  c.cursor = "pointer";

  return c;
}

// === Crown ===
export function drawCrown(): Container {
  const c = new Container();
  const g = new Graphics();

  // Crown shape — 3-point crown
  g.moveTo(-10, 4);
  g.lineTo(-10, -2);
  g.lineTo(-6, 2);
  g.lineTo(-2, -6);
  g.lineTo(0, -2);
  g.lineTo(2, -6);
  g.lineTo(6, 2);
  g.lineTo(10, -2);
  g.lineTo(10, 4);
  g.closePath();
  g.fill(0xfbbf24);
  g.stroke({ color: 0xf59e0b, width: 0.8 });

  // Jewels
  g.circle(-2, -4, 1.2);
  g.fill(0xef4444);
  g.circle(2, -4, 1.2);
  g.fill(0x3b82f6);
  g.circle(0, -1, 1);
  g.fill(0x22c55e);

  c.addChild(g);
  return c;
}

// === Collaboration Table (CEO office) ===
export function drawCollabTable(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);
  c.label = "collab-table";

  const g = new Graphics();
  // Shadow
  g.ellipse(0, 6, 80, 10);
  g.fill({ color: 0x000000, alpha: 0.08 });
  // Table surface
  g.roundRect(-70, -18, 140, 36, 6);
  g.fill(0x2a2520);
  g.roundRect(-68, -16, 136, 32, 5);
  g.fill(0x3d342c);
  g.stroke({ color: 0x4a3f35, width: 0.5 });
  // Wood grain
  for (let i = 0; i < 5; i++) {
    g.moveTo(-60, -12 + i * 7);
    g.lineTo(60, -12 + i * 7);
    g.stroke({ width: 0.2, color: 0x5a4d40, alpha: 0.2 });
  }
  c.addChild(g);

  // 6 chairs around table
  const chairPositions = [
    { x: -50, y: -30 }, { x: 0, y: -30 }, { x: 50, y: -30 },
    { x: -50, y: 30 }, { x: 0, y: 30 }, { x: 50, y: 30 },
  ];
  for (const pos of chairPositions) {
    const chair = new Graphics();
    chair.ellipse(pos.x, pos.y, 8, 4);
    chair.fill({ color: 0x4a3f35, alpha: 0.6 });
    chair.ellipse(pos.x, pos.y, 6, 3);
    chair.fill({ color: 0x57534e, alpha: 0.4 });
    c.addChild(chair);
  }

  return c;
}

// === Hallway ===
export function drawHallway(w: number): Container {
  const c = new Container();
  c.label = "hallway";
  const h = 32;

  const g = new Graphics();
  g.rect(0, 0, w, h);
  g.fill(0x0e0e12);

  // Tile pattern
  const tileW = 32;
  for (let tx = 0; tx < w; tx += tileW) {
    const isEven = (Math.floor(tx / tileW) % 2) === 0;
    g.rect(tx, 0, Math.min(tileW, w - tx), h);
    g.fill({ color: isEven ? 0x141418 : 0x111115, alpha: 1 });
  }

  // Accent lines
  g.moveTo(0, 0);
  g.lineTo(w, 0);
  g.stroke({ width: 1, color: 0x262626, alpha: 0.5 });
  g.moveTo(0, h);
  g.lineTo(w, h);
  g.stroke({ width: 1, color: 0x262626, alpha: 0.5 });
  c.addChild(g);

  // Potted plants at edges
  const plant1 = drawPlant(20, h / 2);
  const plant2 = drawPlant(w - 20, h / 2);
  c.addChild(plant1);
  c.addChild(plant2);

  return c;
}

// === Potted Plant ===
export function drawPlant(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);

  const g = new Graphics();
  // Pot
  g.roundRect(-6, 0, 12, 10, 2);
  g.fill(0x78350f);
  g.stroke({ color: 0x92400e, width: 0.5 });
  // Soil
  g.ellipse(0, 1, 5, 2);
  g.fill(0x44403c);
  // Leaves
  g.ellipse(-4, -4, 5, 3);
  g.fill({ color: 0x22c55e, alpha: 0.7 });
  g.ellipse(3, -6, 4, 3);
  g.fill({ color: 0x16a34a, alpha: 0.7 });
  g.ellipse(0, -8, 3, 4);
  g.fill({ color: 0x15803d, alpha: 0.6 });
  c.addChild(g);

  return c;
}

// === Break Room ===
export function drawBreakRoom(w: number): Container {
  const h = 160;
  const c = new Container();
  c.label = "break-room";

  // Base
  const base = new Graphics();
  base.roundRect(0, 0, w, h, 8);
  base.fill({ color: 0x111116, alpha: 0.92 });
  c.addChild(base);

  // Warm tint
  const tint = new Graphics();
  tint.roundRect(0, 0, w, h, 8);
  tint.fill({ color: 0xf59e0b, alpha: 0.04 });
  c.addChild(tint);

  // Border
  const border = new Graphics();
  border.roundRect(0, 0, w, h, 8);
  border.stroke({ color: 0xf59e0b, width: 1.5, alpha: 0.25 });
  c.addChild(border);

  // Top bar
  const topBar = new Graphics();
  topBar.roundRect(0, 0, w, 3, 8);
  topBar.fill({ color: 0xf59e0b, alpha: 0.5 });
  c.addChild(topBar);

  // Label
  const label = new Text({
    text: "Break Room",
    style: new TextStyle({
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 11,
      fontWeight: "600",
      fill: blend(0xf59e0b, 0xffffff, 0.4),
      letterSpacing: 0.5,
    }),
  });
  label.position.set(12, 8);
  c.addChild(label);

  // Coffee machine
  const coffee = drawCoffeeMachine(60, 50);
  c.addChild(coffee);

  // Bookshelf
  const shelf = drawBookshelf(w - 80, 40);
  c.addChild(shelf);

  // Sofas/chairs
  const sofaPositions = [
    { x: w / 2 - 60, y: 100 },
    { x: w / 2, y: 100 },
    { x: w / 2 + 60, y: 100 },
  ];
  for (const pos of sofaPositions) {
    const sofa = drawSofa(pos.x, pos.y);
    c.addChild(sofa);
  }

  // Small coffee table
  const table = new Graphics();
  table.roundRect(w / 2 - 20, 120, 40, 20, 3);
  table.fill(0x2a2520);
  table.stroke({ color: 0x3d342c, width: 0.5 });
  c.addChild(table);

  return c;
}

// === Coffee Machine ===
export function drawCoffeeMachine(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);
  c.label = "coffee-machine";

  const g = new Graphics();
  // Body
  g.roundRect(-15, -30, 30, 50, 4);
  g.fill(0x27272a);
  g.stroke({ color: 0x3f3f46, width: 1 });
  // Top section
  g.roundRect(-13, -28, 26, 18, 2);
  g.fill(0x1c1c1e);
  // Water tank
  g.roundRect(-11, -26, 10, 14, 1);
  g.fill({ color: 0x3b82f6, alpha: 0.15 });
  g.stroke({ color: 0x3b82f6, width: 0.3, alpha: 0.3 });
  // Indicator lights
  g.circle(6, -22, 2);
  g.fill(0x22c55e);
  g.circle(6, -16, 2);
  g.fill({ color: 0xeab308, alpha: 0.5 });
  // Drip tray
  g.roundRect(-10, 14, 20, 4, 1);
  g.fill(0x1a1a1e);
  g.stroke({ color: 0x333336, width: 0.5 });
  // Cup slot
  g.roundRect(-6, 4, 12, 10, 1);
  g.fill(0x1a1a1e);
  // Nozzle
  g.rect(-2, -10, 4, 6);
  g.fill(0x3f3f46);

  // Steam particles spawn point label
  g.label = "coffee-body";
  c.addChild(g);

  // "Coffee" label
  const lbl = new Text({
    text: "☕",
    style: new TextStyle({ fontSize: 10 }),
  });
  lbl.anchor.set(0.5);
  lbl.position.set(0, -36);
  c.addChild(lbl);

  return c;
}

// === Bookshelf ===
export function drawBookshelf(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);

  const g = new Graphics();
  // Frame
  g.roundRect(-25, -20, 50, 60, 3);
  g.fill(0x2a2520);
  g.stroke({ color: 0x3d342c, width: 1 });

  // Shelves
  for (let i = 0; i < 3; i++) {
    const sy = -14 + i * 18;
    g.rect(-23, sy, 46, 1);
    g.fill(0x3d342c);

    // Books on shelf
    const bookColors = [0x3b82f6, 0xef4444, 0x22c55e, 0xf59e0b, 0xa855f7, 0x06b6d4];
    let bx = -21;
    for (let b = 0; b < 5; b++) {
      const bw = 4 + Math.random() * 4;
      const bh = 12 + Math.random() * 4;
      g.roundRect(bx, sy - bh, bw, bh, 0.5);
      g.fill({ color: bookColors[b % bookColors.length], alpha: 0.4 + Math.random() * 0.3 });
      bx += bw + 1;
      if (bx > 20) break;
    }
  }

  // Trophy on top
  g.roundRect(-4, -26, 8, 4, 1);
  g.fill(0xfbbf24);
  g.circle(0, -30, 3);
  g.fill(0xfbbf24);
  g.stroke({ color: 0xf59e0b, width: 0.5 });

  c.addChild(g);
  return c;
}

// === Sofa ===
export function drawSofa(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);

  const g = new Graphics();
  // Base
  g.roundRect(-18, -6, 36, 16, 4);
  g.fill(0x1c1c1e);
  g.stroke({ color: 0x27272a, width: 0.8 });
  // Cushions
  g.roundRect(-15, -4, 14, 10, 2);
  g.fill({ color: 0x3b82f6, alpha: 0.15 });
  g.roundRect(1, -4, 14, 10, 2);
  g.fill({ color: 0x3b82f6, alpha: 0.12 });
  // Back rest
  g.roundRect(-18, -12, 36, 8, 3);
  g.fill(0x1a1a1e);
  g.stroke({ color: 0x27272a, width: 0.5 });

  c.addChild(g);
  return c;
}

// === Bed (for offline agents) ===
export function drawBed(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);
  c.label = "agent-bed";

  const g = new Graphics();
  // Mattress
  g.roundRect(-16, -6, 32, 16, 3);
  g.fill(0x1c1c1e);
  g.stroke({ color: 0x27272a, width: 0.8 });
  // Blanket
  g.roundRect(-14, -2, 28, 12, 2);
  g.fill({ color: 0x3b82f6, alpha: 0.12 });
  // Pillow
  g.ellipse(-8, -2, 6, 4);
  g.fill(0x27272a);
  g.stroke({ color: 0x333336, width: 0.3 });
  // Zzz
  const zzz = new Text({
    text: "zzz",
    style: new TextStyle({
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 7,
      fill: 0x71717a,
      fontStyle: "italic",
    }),
  });
  zzz.position.set(10, -12);
  zzz.label = "zzz-text";
  c.addChild(g);
  c.addChild(zzz);

  return c;
}

export { DESK_W, DESK_H, AGENT_RADIUS, CEO_RADIUS };
