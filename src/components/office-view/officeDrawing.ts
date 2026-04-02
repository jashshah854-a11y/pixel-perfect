import { Graphics, Text, TextStyle, Container } from "pixi.js";

// === Constants ===
const DESK_W = 72;
const DESK_H = 38;
const AGENT_RADIUS = 20;
const CEO_RADIUS = 28;
const SPRITE_H = 52;

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

const HAIR_PALETTE = [0x2c1810, 0x1a1a2e, 0x8b4513, 0xd4a574, 0x654321, 0x3d2b1f, 0x4a3728, 0x191919];
const SKIN_TONE = 0xf5d0a9;
const SKIN_SHADOW = 0xe0b890;

export function getAgentColor(name: string): number {
  return AGENT_COLORS[name.toLowerCase()] || 0x71717a;
}

function blend(from: number, to: number, t: number): number {
  const c = Math.max(0, Math.min(1, t));
  const fr = (from >> 16) & 0xff, fg = (from >> 8) & 0xff, fb = from & 0xff;
  const tr = (to >> 16) & 0xff, tg = (to >> 8) & 0xff, tb = to & 0xff;
  return (Math.round(fr + (tr - fr) * c) << 16) |
    (Math.round(fg + (tg - fg) * c) << 8) |
    Math.round(fb + (tb - fb) * c);
}

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

// =============================================
// Smooth procedural humanoid face + body system
// =============================================

function drawHumanoidFace(g: Graphics, status: string, hairColor: number, headY: number) {
  // Head circle — warm skin
  g.circle(0, headY, 10);
  g.fill(SKIN_TONE);

  // Subtle ear bumps
  g.circle(-9.5, headY + 1, 2.5);
  g.fill(SKIN_SHADOW);
  g.circle(9.5, headY + 1, 2.5);
  g.fill(SKIN_SHADOW);

  // Hair — short cap style
  g.arc(0, headY, 10.5, -Math.PI * 0.9, -Math.PI * 0.1);
  g.fill(hairColor);
  // Fringe/bangs
  g.roundRect(-8, headY - 11, 16, 4, 2);
  g.fill(hairColor);

  // Eyes — simple, friendly, centered vertically on face
  const eyeY = headY - 1;
  // Eye whites
  g.ellipse(-3.5, eyeY, 2.2, 1.8);
  g.fill(0xffffff);
  g.ellipse(3.5, eyeY, 2.2, 1.8);
  g.fill(0xffffff);
  // Pupils
  g.circle(-3.2, eyeY, 1.2);
  g.fill(0x2d2d2d);
  g.circle(3.8, eyeY, 1.2);
  g.fill(0x2d2d2d);
  // Eye shine
  g.circle(-2.8, eyeY - 0.5, 0.5);
  g.fill({ color: 0xffffff, alpha: 0.85 });
  g.circle(4.2, eyeY - 0.5, 0.5);
  g.fill({ color: 0xffffff, alpha: 0.85 });

  // Eyebrows — subtle arcs
  g.moveTo(-5.5, eyeY - 3.5);
  g.quadraticCurveTo(-3.5, eyeY - 5, -1.5, eyeY - 3.8);
  g.stroke({ width: 0.8, color: blend(hairColor, 0x000000, 0.3) });
  g.moveTo(1.5, eyeY - 3.8);
  g.quadraticCurveTo(3.5, eyeY - 5, 5.5, eyeY - 3.5);
  g.stroke({ width: 0.8, color: blend(hairColor, 0x000000, 0.3) });

  // Tiny nose — just a small dot, NO protrusion
  g.circle(0, headY + 2, 0.6);
  g.fill({ color: SKIN_SHADOW, alpha: 0.5 });

  // Mouth — expression based on status
  const mouthY = headY + 5;
  if (status === "working") {
    // Happy smile
    g.arc(0, mouthY - 1.5, 3, 0.2, Math.PI - 0.2);
    g.stroke({ width: 0.9, color: 0x8b6b52 });
  } else if (status === "idle") {
    // Neutral — straight line
    g.moveTo(-2.5, mouthY);
    g.lineTo(2.5, mouthY);
    g.stroke({ width: 0.8, color: 0x8b6b52 });
  } else if (status === "paused") {
    // Slight frown
    g.arc(0, mouthY + 2, 3, -Math.PI + 0.4, -0.4);
    g.stroke({ width: 0.8, color: 0x8b6b52 });
  }
  // offline: no mouth (sleeping)

  // Blush — subtle warmth
  g.ellipse(-6, headY + 3, 2, 1.2);
  g.fill({ color: 0xe8a0a0, alpha: 0.15 });
  g.ellipse(6, headY + 3, 2, 1.2);
  g.fill({ color: 0xe8a0a0, alpha: 0.15 });
}

function drawHumanoidBody(
  g: Graphics,
  torsoColor: number,
  headY: number,
) {
  const neckY = headY + 10;

  // Neck
  g.roundRect(-3, neckY - 2, 6, 6, 2);
  g.fill(SKIN_TONE);

  // Torso
  const torsoY = neckY + 3;
  g.roundRect(-8, torsoY, 16, 18, 4);
  g.fill(torsoColor);
  // Collar highlight
  g.roundRect(-6, torsoY, 12, 4, 2);
  g.fill({ color: 0xffffff, alpha: 0.08 });
  // Collar line
  g.moveTo(-4, torsoY + 1);
  g.lineTo(0, torsoY + 4);
  g.lineTo(4, torsoY + 1);
  g.stroke({ width: 0.5, color: 0xffffff, alpha: 0.15 });

  // Arms
  const armY = torsoY + 2;
  // Left arm
  g.roundRect(-12, armY, 5, 14, 2.5);
  g.fill(blend(torsoColor, 0x000000, 0.12));
  // Left hand
  g.circle(-9.5, armY + 15, 2.5);
  g.fill(SKIN_TONE);
  // Right arm
  g.roundRect(7, armY, 5, 14, 2.5);
  g.fill(blend(torsoColor, 0x000000, 0.12));
  // Right hand
  g.circle(9.5, armY + 15, 2.5);
  g.fill(SKIN_TONE);

  // Legs
  const legY = torsoY + 17;
  g.roundRect(-6, legY, 5, 12, 2);
  g.fill(0x1e293b);
  g.roundRect(1, legY, 5, 12, 2);
  g.fill(0x1e293b);

  // Shoes
  const shoeY = legY + 11;
  g.roundRect(-7, shoeY, 7, 3, 1.5);
  g.fill(0x1a1a2e);
  g.roundRect(0, shoeY, 7, 3, 1.5);
  g.fill(0x1a1a2e);
}

// === Agent Avatar (Smooth Procedural Humanoid) ===
export function drawAgent(
  name: string,
  status: string,
  x: number,
  y: number,
  _spriteNum: number = 1,
  department: string = "",
): Container {
  const c = new Container();
  c.position.set(x, y);
  c.label = `agent-${name}`;

  const color = getAgentColor(name);
  const hairColor = HAIR_PALETTE[hashName(name) % HAIR_PALETTE.length];

  // Ground shadow
  const shadow = new Graphics();
  shadow.ellipse(0, SPRITE_H + 2, 14, 4);
  shadow.fill({ color: 0x000000, alpha: 0.2 });
  c.addChild(shadow);

  // Working aura
  if (status === "working") {
    const aura = new Graphics();
    aura.roundRect(-16, -14, 32, SPRITE_H + 16, 8);
    aura.fill({ color: 0x22c55e, alpha: 0.06 });
    aura.roundRect(-14, -12, 28, SPRITE_H + 12, 6);
    aura.stroke({ color: 0x22c55e, width: 1, alpha: 0.2 });
    aura.label = "agent-aura";
    c.addChild(aura);
  }

  // Paused glow
  if (status === "paused") {
    const pauseGlow = new Graphics();
    pauseGlow.roundRect(-14, -12, 28, SPRITE_H + 12, 6);
    pauseGlow.stroke({ color: 0xeab308, width: 1, alpha: 0.25 });
    pauseGlow.label = "agent-pause-glow";
    c.addChild(pauseGlow);
  }

  // The humanoid figure
  const body = new Graphics();
  const headY = -6; // Head center Y position

  drawHumanoidBody(body, color, headY);
  drawHumanoidFace(body, status, hairColor, headY);

  if (status === "offline") body.alpha = 0.35;
  body.label = "sprite-body";
  c.addChild(body);

  // Department accessories
  const acc = new Graphics();
  const deptLower = department.toLowerCase();
  if (deptLower === "orchestration") {
    // Headphones
    acc.arc(0, headY - 2, 11.5, -Math.PI * 0.85, -Math.PI * 0.15);
    acc.stroke({ width: 2, color: 0x27272a });
    acc.circle(-10, headY + 2, 3.5);
    acc.fill(0x3b82f6);
    acc.stroke({ color: 0x1e3a5f, width: 0.8 });
    acc.circle(10, headY + 2, 3.5);
    acc.fill(0x3b82f6);
    acc.stroke({ color: 0x1e3a5f, width: 0.8 });
  } else if (deptLower === "architecture") {
    // Glasses
    acc.roundRect(-6, headY - 2.5, 5, 4, 1);
    acc.stroke({ color: 0xd4d4d8, width: 1 });
    acc.roundRect(1, headY - 2.5, 5, 4, 1);
    acc.stroke({ color: 0xd4d4d8, width: 1 });
    acc.moveTo(-1, headY - 0.5);
    acc.lineTo(1, headY - 0.5);
    acc.stroke({ color: 0xd4d4d8, width: 0.8 });
  } else if (deptLower === "ui/ux") {
    // Beret
    acc.ellipse(2, headY - 12, 9, 4);
    acc.fill(0xf59e0b);
    acc.circle(2, headY - 15, 1.5);
    acc.fill(0xf59e0b);
  } else if (deptLower === "research") {
    // Lab coat collar
    acc.moveTo(-8, headY + 14);
    acc.lineTo(0, headY + 19);
    acc.lineTo(8, headY + 14);
    acc.lineTo(6, headY + 16);
    acc.lineTo(0, headY + 21);
    acc.lineTo(-6, headY + 16);
    acc.closePath();
    acc.fill({ color: 0xfafafa, alpha: 0.8 });
    acc.stroke({ color: 0xd4d4d8, width: 0.4 });
  } else if (deptLower === "review") {
    // Shield badge
    acc.moveTo(6, headY + 16);
    acc.lineTo(11, headY + 14);
    acc.lineTo(11, headY + 20);
    acc.lineTo(8.5, headY + 23);
    acc.lineTo(6, headY + 20);
    acc.closePath();
    acc.fill(0x06b6d4);
    acc.stroke({ color: 0x0e7490, width: 0.6 });
    acc.circle(8.5, headY + 18, 1.2);
    acc.fill({ color: 0xffffff, alpha: 0.7 });
  } else if (deptLower === "devops") {
    // Hard hat
    acc.roundRect(-9, headY - 14, 18, 6, 3);
    acc.fill(0xfbbf24);
    acc.stroke({ color: 0xd97706, width: 0.6 });
    acc.roundRect(-12, headY - 9, 24, 3, 1);
    acc.fill(0xf59e0b);
  }
  if (acc.geometry) {
    acc.label = "accessory";
    c.addChild(acc);
  }

  // Status dot
  const dot = new Graphics();
  dot.circle(12, headY - 8, 4);
  dot.fill(STATUS_COLORS[status] || 0x71717a);
  dot.stroke({ color: 0x0d0d12, width: 1.5 });
  dot.label = "status-dot";
  c.addChild(dot);

  // Name label
  const label = new Text({
    text: name,
    style: new TextStyle({
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 9,
      fill: status === "offline" ? 0x52525b : blend(color, 0xffffff, 0.35),
      fontWeight: "600",
      letterSpacing: 0.3,
    }),
  });
  label.anchor.set(0.5, 0);
  label.position.set(0, SPRITE_H + 6);
  if (status === "offline") label.alpha = 0.4;
  c.addChild(label);

  c.eventMode = "static";
  c.cursor = "pointer";
  c.hitArea = {
    contains: (px: number, py: number) =>
      px >= -16 && px <= 16 && py >= -14 && py <= SPRITE_H + 10,
  };

  return c;
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

  // Desk body
  g.roundRect(0, 0, DESK_W, DESK_H, 3);
  g.fill(0x2a2520);
  g.roundRect(1, 1, DESK_W - 2, DESK_H - 2, 2);
  g.fill(0x3d342c);
  g.roundRect(2, 2, DESK_W - 4, DESK_H - 4, 1.5);
  g.fill(0x4a3f35);

  // Top highlight
  g.roundRect(2, 2, DESK_W - 4, 5, 1);
  g.fill({ color: 0x5c4f42, alpha: 0.3 });

  // Wood grain
  for (let i = 0; i < 4; i++) {
    g.moveTo(4, 5 + i * 7);
    g.lineTo(DESK_W - 4, 5 + i * 7);
    g.stroke({ width: 0.3, color: 0x5a4d40, alpha: 0.25 });
  }

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

// === CEO Avatar (Smooth Procedural Humanoid) ===
export function drawCEO(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);
  c.label = "ceo-avatar";

  const ceoColor = 0xf59e0b;

  // Ground shadow
  const shadow = new Graphics();
  shadow.ellipse(0, 30, 16, 5);
  shadow.fill({ color: 0x000000, alpha: 0.22 });
  c.addChild(shadow);

  // Golden aura
  const aura = new Graphics();
  aura.ellipse(0, 5, 24, 32);
  aura.fill({ color: 0xf59e0b, alpha: 0.06 });
  aura.label = "ceo-aura";
  c.addChild(aura);

  // Body — using the shared humanoid system
  const body = new Graphics();
  const headY = -14;

  // --- Legs ---
  const legY = headY + 32;
  body.roundRect(-7, legY, 5.5, 14, 2);
  body.fill(0x1e293b);
  body.roundRect(1.5, legY, 5.5, 14, 2);
  body.fill(0x1e293b);
  body.roundRect(-8, legY + 12, 8, 3, 1.5);
  body.fill(0x1a1a2e);
  body.roundRect(0, legY + 12, 8, 3, 1.5);
  body.fill(0x1a1a2e);

  // --- Torso (suit) ---
  const torsoY = headY + 13;
  body.roundRect(-10, torsoY, 20, 20, 5);
  body.fill(ceoColor);
  // Suit lapels
  body.roundRect(-8, torsoY, 16, 8, 3);
  body.fill({ color: 0xffffff, alpha: 0.08 });
  // Tie
  body.moveTo(0, torsoY + 2);
  body.lineTo(-2, torsoY + 8);
  body.lineTo(0, torsoY + 12);
  body.lineTo(2, torsoY + 8);
  body.closePath();
  body.fill(0xef4444);

  // --- Arms ---
  body.roundRect(-14, torsoY + 2, 5, 16, 2.5);
  body.fill(blend(ceoColor, 0x000000, 0.15));
  body.circle(-11.5, torsoY + 19, 3);
  body.fill(SKIN_TONE);
  body.roundRect(9, torsoY + 2, 5, 16, 2.5);
  body.fill(blend(ceoColor, 0x000000, 0.15));
  body.circle(11.5, torsoY + 19, 3);
  body.fill(SKIN_TONE);

  // --- Neck ---
  body.roundRect(-3, headY + 9, 6, 6, 2);
  body.fill(SKIN_TONE);

  // --- Face (using shared system) ---
  drawHumanoidFace(body, "working", 0x1a1a2e, headY);

  c.addChild(body);

  // Crown
  const crown = drawCrown();
  crown.position.set(0, headY - 12);
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
  label.position.set(0, 34);
  c.addChild(label);

  c.eventMode = "static";
  c.cursor = "pointer";

  return c;
}

// === Crown ===
export function drawCrown(): Container {
  const c = new Container();
  const g = new Graphics();

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
  g.ellipse(0, 6, 80, 10);
  g.fill({ color: 0x000000, alpha: 0.08 });
  g.roundRect(-70, -18, 140, 36, 6);
  g.fill(0x2a2520);
  g.roundRect(-68, -16, 136, 32, 5);
  g.fill(0x3d342c);
  g.stroke({ color: 0x4a3f35, width: 0.5 });
  for (let i = 0; i < 5; i++) {
    g.moveTo(-60, -12 + i * 7);
    g.lineTo(60, -12 + i * 7);
    g.stroke({ width: 0.2, color: 0x5a4d40, alpha: 0.2 });
  }
  c.addChild(g);

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

  const tileW = 32;
  for (let tx = 0; tx < w; tx += tileW) {
    const isEven = (Math.floor(tx / tileW) % 2) === 0;
    g.rect(tx, 0, Math.min(tileW, w - tx), h);
    g.fill({ color: isEven ? 0x141418 : 0x111115, alpha: 1 });
  }

  g.moveTo(0, 0);
  g.lineTo(w, 0);
  g.stroke({ width: 1, color: 0x262626, alpha: 0.5 });
  g.moveTo(0, h);
  g.lineTo(w, h);
  g.stroke({ width: 1, color: 0x262626, alpha: 0.5 });
  c.addChild(g);

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
  g.roundRect(-6, 0, 12, 10, 2);
  g.fill(0x78350f);
  g.stroke({ color: 0x92400e, width: 0.5 });
  g.ellipse(0, 1, 5, 2);
  g.fill(0x44403c);
  g.ellipse(-4, -4, 5, 3);
  g.fill({ color: 0x22c55e, alpha: 0.7 });
  g.ellipse(3, -6, 4, 3);
  g.fill({ color: 0x16a34a, alpha: 0.7 });
  g.ellipse(0, -8, 3, 4);
  g.fill({ color: 0x15803d, alpha: 0.6 });
  c.addChild(g);

  return c;
}

// === Whiteboard ===
export function drawWhiteboard(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);

  const g = new Graphics();
  // Board frame
  g.roundRect(-20, -15, 40, 28, 2);
  g.fill(0x27272a);
  g.stroke({ color: 0x3f3f46, width: 1 });
  // White surface
  g.roundRect(-18, -13, 36, 22, 1);
  g.fill({ color: 0xf5f5f5, alpha: 0.85 });
  // Faint marker lines (like notes)
  g.moveTo(-14, -8);
  g.lineTo(8, -8);
  g.stroke({ width: 0.6, color: 0x3b82f6, alpha: 0.3 });
  g.moveTo(-14, -3);
  g.lineTo(12, -3);
  g.stroke({ width: 0.6, color: 0x3b82f6, alpha: 0.25 });
  g.moveTo(-14, 2);
  g.lineTo(4, 2);
  g.stroke({ width: 0.6, color: 0xef4444, alpha: 0.2 });
  // Marker tray
  g.roundRect(-16, 11, 32, 3, 1);
  g.fill(0x3f3f46);
  // Markers
  g.roundRect(-12, 10, 6, 2, 0.5);
  g.fill({ color: 0x3b82f6, alpha: 0.7 });
  g.roundRect(-4, 10, 6, 2, 0.5);
  g.fill({ color: 0xef4444, alpha: 0.7 });
  g.roundRect(4, 10, 6, 2, 0.5);
  g.fill({ color: 0x22c55e, alpha: 0.7 });
  c.addChild(g);

  return c;
}

// === Water Cooler ===
export function drawWaterCooler(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);

  const g = new Graphics();
  // Base/stand
  g.roundRect(-8, 10, 16, 20, 2);
  g.fill(0x27272a);
  g.stroke({ color: 0x3f3f46, width: 0.8 });
  // Bottle (blue tinted)
  g.roundRect(-6, -18, 12, 28, 3);
  g.fill({ color: 0x60a5fa, alpha: 0.15 });
  g.stroke({ color: 0x3b82f6, width: 0.5, alpha: 0.3 });
  // Bottle cap
  g.roundRect(-4, -20, 8, 4, 2);
  g.fill({ color: 0x3b82f6, alpha: 0.4 });
  // Water level lines
  g.moveTo(-4, -8);
  g.lineTo(4, -8);
  g.stroke({ width: 0.3, color: 0x60a5fa, alpha: 0.3 });
  g.moveTo(-4, -2);
  g.lineTo(4, -2);
  g.stroke({ width: 0.3, color: 0x60a5fa, alpha: 0.2 });
  // Spout
  g.roundRect(6, 12, 6, 3, 1);
  g.fill(0x3f3f46);
  // Cup dispenser
  g.roundRect(-14, 8, 5, 8, 1);
  g.fill(0x1c1c1e);
  g.stroke({ color: 0x333336, width: 0.3 });
  // Tiny cups
  g.roundRect(-13, 9, 3, 3, 0.5);
  g.fill({ color: 0xfafafa, alpha: 0.3 });
  g.roundRect(-13, 12, 3, 3, 0.5);
  g.fill({ color: 0xfafafa, alpha: 0.25 });
  c.addChild(g);

  return c;
}

// === Filing Cabinet ===
export function drawFilingCabinet(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);

  const g = new Graphics();
  // Cabinet body
  g.roundRect(-10, -20, 20, 40, 2);
  g.fill(0x27272a);
  g.stroke({ color: 0x3f3f46, width: 0.8 });
  // Drawer 1
  g.roundRect(-8, -18, 16, 11, 1);
  g.fill(0x1c1c1e);
  g.stroke({ color: 0x333336, width: 0.4 });
  g.circle(0, -12, 1.2);
  g.fill(0x52525b);
  // Drawer 2
  g.roundRect(-8, -5, 16, 11, 1);
  g.fill(0x1c1c1e);
  g.stroke({ color: 0x333336, width: 0.4 });
  g.circle(0, 1, 1.2);
  g.fill(0x52525b);
  // Drawer 3
  g.roundRect(-8, 8, 16, 11, 1);
  g.fill(0x1c1c1e);
  g.stroke({ color: 0x333336, width: 0.4 });
  g.circle(0, 14, 1.2);
  g.fill(0x52525b);
  c.addChild(g);

  return c;
}

// === Desk Lamp ===
export function drawDeskLamp(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);

  const g = new Graphics();
  // Warm glow underneath
  g.ellipse(0, 4, 8, 3);
  g.fill({ color: 0xfbbf24, alpha: 0.08 });
  // Base
  g.ellipse(0, 3, 5, 2);
  g.fill(0x27272a);
  // Arm
  g.moveTo(0, 2);
  g.lineTo(-3, -10);
  g.stroke({ width: 1.2, color: 0x3f3f46 });
  // Shade (cone)
  g.moveTo(-8, -10);
  g.lineTo(-3, -14);
  g.lineTo(2, -10);
  g.closePath();
  g.fill(0x27272a);
  g.stroke({ color: 0x3f3f46, width: 0.5 });
  // Bulb glow
  g.circle(-3, -10, 1.5);
  g.fill({ color: 0xfbbf24, alpha: 0.5 });
  c.addChild(g);

  return c;
}

// === Rug ===
export function drawRug(x: number, y: number, w: number, h: number, color: number): Container {
  const c = new Container();
  c.position.set(x, y);

  const g = new Graphics();
  // Outer rug shape
  g.ellipse(0, 0, w, h);
  g.fill({ color: color, alpha: 0.06 });
  // Inner pattern
  g.ellipse(0, 0, w * 0.7, h * 0.7);
  g.fill({ color: color, alpha: 0.04 });
  // Border detail
  g.ellipse(0, 0, w, h);
  g.stroke({ color: color, width: 0.5, alpha: 0.1 });
  c.addChild(g);

  return c;
}

// === Break Room ===
export function drawBreakRoom(w: number): Container {
  const h = 160;
  const c = new Container();
  c.label = "break-room";

  const base = new Graphics();
  base.roundRect(0, 0, w, h, 8);
  base.fill({ color: 0x111116, alpha: 0.92 });
  c.addChild(base);

  const tint = new Graphics();
  tint.roundRect(0, 0, w, h, 8);
  tint.fill({ color: 0xf59e0b, alpha: 0.04 });
  c.addChild(tint);

  const border = new Graphics();
  border.roundRect(0, 0, w, h, 8);
  border.stroke({ color: 0xf59e0b, width: 1.5, alpha: 0.25 });
  c.addChild(border);

  const topBar = new Graphics();
  topBar.roundRect(0, 0, w, 3, 8);
  topBar.fill({ color: 0xf59e0b, alpha: 0.5 });
  c.addChild(topBar);

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

  // Water cooler
  const cooler = drawWaterCooler(w - 50, 60);
  c.addChild(cooler);

  // Bookshelf
  const shelf = drawBookshelf(w - 120, 40);
  c.addChild(shelf);

  // Sofas
  const sofaPositions = [
    { x: w / 2 - 60, y: 100 },
    { x: w / 2, y: 100 },
    { x: w / 2 + 60, y: 100 },
  ];
  for (const pos of sofaPositions) {
    const sofa = drawSofa(pos.x, pos.y);
    c.addChild(sofa);
  }

  // Coffee table
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
  g.roundRect(-15, -30, 30, 50, 4);
  g.fill(0x27272a);
  g.stroke({ color: 0x3f3f46, width: 1 });
  g.roundRect(-13, -28, 26, 18, 2);
  g.fill(0x1c1c1e);
  g.roundRect(-11, -26, 10, 14, 1);
  g.fill({ color: 0x3b82f6, alpha: 0.15 });
  g.stroke({ color: 0x3b82f6, width: 0.3, alpha: 0.3 });
  g.circle(6, -22, 2);
  g.fill(0x22c55e);
  g.circle(6, -16, 2);
  g.fill({ color: 0xeab308, alpha: 0.5 });
  g.roundRect(-10, 14, 20, 4, 1);
  g.fill(0x1a1a1e);
  g.stroke({ color: 0x333336, width: 0.5 });
  g.roundRect(-6, 4, 12, 10, 1);
  g.fill(0x1a1a1e);
  g.rect(-2, -10, 4, 6);
  g.fill(0x3f3f46);

  g.label = "coffee-body";
  c.addChild(g);

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
  g.roundRect(-25, -20, 50, 60, 3);
  g.fill(0x2a2520);
  g.stroke({ color: 0x3d342c, width: 1 });

  for (let i = 0; i < 3; i++) {
    const sy = -14 + i * 18;
    g.rect(-23, sy, 46, 1);
    g.fill(0x3d342c);

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
  g.roundRect(-18, -6, 36, 16, 4);
  g.fill(0x1c1c1e);
  g.stroke({ color: 0x27272a, width: 0.8 });
  g.roundRect(-15, -4, 14, 10, 2);
  g.fill({ color: 0x3b82f6, alpha: 0.15 });
  g.roundRect(1, -4, 14, 10, 2);
  g.fill({ color: 0x3b82f6, alpha: 0.12 });
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
  g.roundRect(-16, -6, 32, 16, 3);
  g.fill(0x1c1c1e);
  g.stroke({ color: 0x27272a, width: 0.8 });
  g.roundRect(-14, -2, 28, 12, 2);
  g.fill({ color: 0x3b82f6, alpha: 0.12 });
  g.ellipse(-8, -2, 6, 4);
  g.fill(0x27272a);
  g.stroke({ color: 0x333336, width: 0.3 });
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
