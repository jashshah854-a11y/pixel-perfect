import { Graphics, Text, TextStyle, Container } from "pixi.js";

// === Constants ===
const DESK_W = 80;
const DESK_H = 42;
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
// Smooth procedural humanoid face + body
// =============================================

function drawHumanoidFace(g: Graphics, status: string, hairColor: number, headY: number, seed: number = 0) {
  // Per-face variation from seed (0-1 range helpers)
  const v1 = ((seed * 7 + 3) % 10) / 10;       // 0-1
  const v2 = ((seed * 13 + 5) % 10) / 10;
  const v3 = ((seed * 19 + 7) % 10) / 10;
  const asymm = (v1 - 0.5) * 0.4;               // slight L/R asymmetry

  // Head — rounder, more human proportions
  const headW = 9.5 + v1 * 1;                    // 9.5-10.5
  const headH = 10 + v2 * 1;                     // 10-11
  g.ellipse(0, headY, headW, headH);
  g.fill(SKIN_TONE);

  // Forehead to jaw gradient shading
  g.ellipse(0, headY + headH * 0.35, headW * 0.85, headH * 0.45);
  g.fill({ color: SKIN_SHADOW, alpha: 0.12 });

  // Cheekbone structure — subtle lateral shadows
  g.ellipse(-headW * 0.65, headY + 2, 3, headH * 0.35);
  g.fill({ color: SKIN_SHADOW, alpha: 0.07 });
  g.ellipse(headW * 0.65, headY + 2, 3, headH * 0.35);
  g.fill({ color: SKIN_SHADOW, alpha: 0.07 });

  // Jaw definition
  g.ellipse(0, headY + headH * 0.55, headW * 0.7, 3);
  g.fill({ color: SKIN_SHADOW, alpha: 0.15 });

  // Ears — proportional, with asymmetry
  const earY = headY + 0.5 + asymm;
  g.ellipse(-headW - 1, earY, 2.2, 3);
  g.fill(SKIN_SHADOW);
  g.ellipse(-headW - 1, earY, 1.2, 1.8);
  g.fill({ color: SKIN_TONE, alpha: 0.5 });
  g.ellipse(headW + 1, earY + asymm * 0.5, 2.2, 3);
  g.fill(SKIN_SHADOW);
  g.ellipse(headW + 1, earY + asymm * 0.5, 1.2, 1.8);
  g.fill({ color: SKIN_TONE, alpha: 0.5 });

  // Hair — natural, with variation
  const hairTop = headY - headH + 1;
  g.arc(0, headY - 1, headW + 1.5, -Math.PI * 0.92, -Math.PI * 0.08);
  g.fill(hairColor);
  g.roundRect(-headW + 1, hairTop - 1, headW * 2 - 2, 4 + v3 * 2, 3);
  g.fill(hairColor);
  // Side volume — slight asymmetry
  g.ellipse(-headW + 1, headY - 3, 2.5 + v1 * 0.5, 4.5);
  g.fill({ color: hairColor, alpha: 0.65 });
  g.ellipse(headW - 1, headY - 3, 2.5 + v2 * 0.5, 4.5);
  g.fill({ color: hairColor, alpha: 0.65 });
  // Highlight
  g.arc(v1 - 0.5, headY - 2, headW - 2, -Math.PI * 0.65, -Math.PI * 0.35);
  g.fill({ color: blend(hairColor, 0xffffff, 0.12), alpha: 0.25 });

  // === Eyes — smaller, natural spacing, with variation ===
  const eyeY = headY - 0.8 + v2 * 0.6;
  const eyeSpacing = 3.2 + v1 * 0.6;            // 3.2-3.8 apart from center
  const eyeW = 1.8 + v3 * 0.3;                  // 1.8-2.1 (reduced from 2.5)
  const eyeH = 1.4 + v2 * 0.2;                  // 1.4-1.6 (reduced from 2.0)

  // Eye sockets — subtle depth
  g.ellipse(-eyeSpacing, eyeY - 0.3, eyeW + 0.8, eyeH + 0.6);
  g.fill({ color: SKIN_SHADOW, alpha: 0.08 });
  g.ellipse(eyeSpacing + asymm * 0.3, eyeY - 0.3, eyeW + 0.8, eyeH + 0.6);
  g.fill({ color: SKIN_SHADOW, alpha: 0.08 });

  // Eye whites
  g.ellipse(-eyeSpacing, eyeY, eyeW, eyeH);
  g.fill(0xf5f5f0);
  g.ellipse(eyeSpacing + asymm * 0.3, eyeY, eyeW, eyeH);
  g.fill(0xf5f5f0);

  // Upper lid crease
  g.arc(-eyeSpacing, eyeY - 0.2, eyeW, -Math.PI * 0.85, -Math.PI * 0.15);
  g.stroke({ width: 0.4, color: SKIN_SHADOW, alpha: 0.2 });
  g.arc(eyeSpacing + asymm * 0.3, eyeY - 0.2, eyeW, -Math.PI * 0.85, -Math.PI * 0.15);
  g.stroke({ width: 0.4, color: SKIN_SHADOW, alpha: 0.2 });

  // Iris
  const irisR = 0.9 + v1 * 0.15;
  const irisColors = [0x3d2b1f, 0x2d5a3d, 0x4a3520, 0x2b3d5a, 0x3a2d1f];
  const irisColor = irisColors[seed % irisColors.length];
  g.circle(-eyeSpacing + 0.15, eyeY + 0.15, irisR);
  g.fill(irisColor);
  g.circle(eyeSpacing + asymm * 0.3 + 0.15, eyeY + 0.15, irisR);
  g.fill(irisColor);

  // Pupil
  g.circle(-eyeSpacing + 0.15, eyeY + 0.15, irisR * 0.5);
  g.fill(0x0a0a0a);
  g.circle(eyeSpacing + asymm * 0.3 + 0.15, eyeY + 0.15, irisR * 0.5);
  g.fill(0x0a0a0a);

  // Single highlight per eye
  g.circle(-eyeSpacing + 0.6, eyeY - 0.3, 0.4);
  g.fill({ color: 0xffffff, alpha: 0.85 });
  g.circle(eyeSpacing + asymm * 0.3 + 0.6, eyeY - 0.3, 0.4);
  g.fill({ color: 0xffffff, alpha: 0.85 });

  // === Eyebrows — thinner, more natural ===
  const browColor = blend(hairColor, 0x000000, 0.3);
  const browW = eyeSpacing + eyeW + 0.5;
  g.moveTo(-browW, eyeY - 2.8 + v3 * 0.3);
  g.quadraticCurveTo(-eyeSpacing, eyeY - 4 - v2 * 0.5, -eyeSpacing + eyeW, eyeY - 2.8);
  g.stroke({ width: 0.7 + v1 * 0.2, color: browColor });
  g.moveTo(eyeSpacing - eyeW + asymm * 0.2, eyeY - 2.8);
  g.quadraticCurveTo(eyeSpacing + asymm * 0.2, eyeY - 4 - v3 * 0.5, browW + asymm * 0.2, eyeY - 2.8 + v1 * 0.3);
  g.stroke({ width: 0.7 + v2 * 0.2, color: browColor });

  // === Nose — defined bridge with dimensional tip ===
  const noseTop = headY + 0.5;
  const noseBottom = headY + 3.5 + v2 * 0.5;
  // Bridge — light shadow line
  g.moveTo(asymm * 0.3, noseTop);
  g.quadraticCurveTo(-0.3 + asymm * 0.2, (noseTop + noseBottom) / 2, 0, noseBottom - 1);
  g.stroke({ width: 0.5, color: SKIN_SHADOW, alpha: 0.2 });
  // Nose tip — soft rounded shape
  g.ellipse(0, noseBottom - 0.5, 1.8 + v1 * 0.4, 1.2);
  g.fill({ color: SKIN_SHADOW, alpha: 0.12 });
  // Nostril wings
  g.ellipse(-1.5 - v3 * 0.2, noseBottom, 0.8, 0.5);
  g.fill({ color: SKIN_SHADOW, alpha: 0.15 });
  g.ellipse(1.5 + v1 * 0.2, noseBottom, 0.8, 0.5);
  g.fill({ color: SKIN_SHADOW, alpha: 0.15 });
  // Bridge highlight
  g.moveTo(0.3, noseTop + 1);
  g.lineTo(0.3, noseBottom - 1.5);
  g.stroke({ width: 0.3, color: 0xffffff, alpha: 0.06 });

  // === Mouth — natural, expressive ===
  const mouthY = headY + 6 + v2 * 0.3;
  const mouthW = 2 + v1 * 0.5;                  // width variation
  const lipColor = 0xb07060;
  const lipShadow = 0x8a5545;

  if (status === "working") {
    // Gentle asymmetric smile
    g.moveTo(-mouthW, mouthY);
    g.quadraticCurveTo(-mouthW * 0.3, mouthY + 1.2, mouthW + asymm * 0.3, mouthY - 0.3);
    g.stroke({ width: 0.8, color: lipColor });
    // Lower lip volume
    g.arc(asymm * 0.2, mouthY + 0.6, mouthW * 0.7, 0.2, Math.PI - 0.2);
    g.fill({ color: lipShadow, alpha: 0.1 });
  } else if (status === "idle") {
    // Relaxed, slightly parted
    g.moveTo(-mouthW, mouthY + asymm * 0.2);
    g.quadraticCurveTo(0, mouthY + 0.5 + v3 * 0.3, mouthW, mouthY);
    g.stroke({ width: 0.7, color: lipColor });
    // Philtrum shadow
    g.ellipse(0, mouthY - 1, 0.6, 0.8);
    g.fill({ color: SKIN_SHADOW, alpha: 0.06 });
  } else if (status === "paused") {
    // Pensive — slight downturn on one side
    g.moveTo(-mouthW, mouthY + 0.3);
    g.quadraticCurveTo(0, mouthY - 0.3, mouthW, mouthY + 0.5);
    g.stroke({ width: 0.7, color: lipColor });
  } else {
    // Offline — closed, relaxed
    g.moveTo(-mouthW * 0.7, mouthY);
    g.lineTo(mouthW * 0.7, mouthY + asymm * 0.3);
    g.stroke({ width: 0.5, color: lipColor, alpha: 0.4 });
  }

  // Cheek warmth — soft, placed near cheekbones
  g.ellipse(-headW * 0.55, headY + 3, 2, 1.2);
  g.fill({ color: 0xd49a8a, alpha: 0.08 });
  g.ellipse(headW * 0.55, headY + 3, 2, 1.2);
  g.fill({ color: 0xd49a8a, alpha: 0.08 });

  // Chin
  g.ellipse(0, headY + headH - 1, 4, 1.2);
  g.fill({ color: SKIN_SHADOW, alpha: 0.08 });
}

function drawHumanoidBody(g: Graphics, torsoColor: number, headY: number) {
  const neckY = headY + 10;
  g.roundRect(-3, neckY - 2, 6, 6, 2);
  g.fill(SKIN_TONE);

  const torsoY = neckY + 3;
  g.roundRect(-8, torsoY, 16, 18, 4);
  g.fill(torsoColor);
  // Collar/lapel subtle shading
  g.roundRect(-6, torsoY, 12, 4, 2);
  g.fill({ color: 0xffffff, alpha: 0.08 });

  const armY = torsoY + 2;
  g.roundRect(-12, armY, 5, 14, 2.5);
  g.fill(blend(torsoColor, 0x000000, 0.12));
  g.circle(-9.5, armY + 15, 2.5);
  g.fill(SKIN_TONE);
  g.roundRect(7, armY, 5, 14, 2.5);
  g.fill(blend(torsoColor, 0x000000, 0.12));
  g.circle(9.5, armY + 15, 2.5);
  g.fill(SKIN_TONE);

  const legY = torsoY + 17;
  g.roundRect(-6, legY, 5, 12, 2);
  g.fill(0x1e293b);
  g.roundRect(1, legY, 5, 12, 2);
  g.fill(0x1e293b);
  const shoeY = legY + 11;
  g.roundRect(-7, shoeY, 7, 3, 1.5);
  g.fill(0x1a1a2e);
  g.roundRect(0, shoeY, 7, 3, 1.5);
  g.fill(0x1a1a2e);
}

// === Agent Avatar ===
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
  shadow.fill({ color: 0x000000, alpha: 0.25 });
  c.addChild(shadow);

  // Status ring (replaces dot — glowing ring)
  if (status === "working") {
    const ring = new Graphics();
    ring.circle(0, -8, 18);
    ring.stroke({ color: 0x22c55e, width: 1.5, alpha: 0.3 });
    ring.circle(0, -8, 20);
    ring.stroke({ color: 0x22c55e, width: 0.5, alpha: 0.15 });
    ring.label = "agent-aura";
    c.addChild(ring);
  }
  if (status === "paused") {
    const ring = new Graphics();
    ring.circle(0, -8, 18);
    ring.stroke({ color: 0xeab308, width: 1.5, alpha: 0.25 });
    ring.label = "agent-pause-glow";
    c.addChild(ring);
  }

  // Body
  const body = new Graphics();
  const headY = -6;
  drawHumanoidBody(body, color, headY);
  drawHumanoidFace(body, status, hairColor, headY, hashName(name));
  if (status === "offline") body.alpha = 0.3;
  body.label = "sprite-body";
  c.addChild(body);

  // Department accessories
  const acc = new Graphics();
  const dl = department.toLowerCase();
  if (dl === "orchestration") {
    acc.arc(0, headY - 2, 11.5, -Math.PI * 0.85, -Math.PI * 0.15);
    acc.stroke({ width: 2, color: 0x27272a });
    acc.circle(-10, headY + 2, 3.5);
    acc.fill(0x3b82f6);
    acc.circle(10, headY + 2, 3.5);
    acc.fill(0x3b82f6);
  } else if (dl === "architecture") {
    acc.roundRect(-6, headY - 2.5, 5, 4, 1);
    acc.stroke({ color: 0xd4d4d8, width: 1 });
    acc.roundRect(1, headY - 2.5, 5, 4, 1);
    acc.stroke({ color: 0xd4d4d8, width: 1 });
    acc.moveTo(-1, headY - 0.5);
    acc.lineTo(1, headY - 0.5);
    acc.stroke({ color: 0xd4d4d8, width: 0.8 });
  } else if (dl === "ui/ux") {
    acc.ellipse(2, headY - 12, 9, 4);
    acc.fill(0xf59e0b);
    acc.circle(2, headY - 15, 1.5);
    acc.fill(0xf59e0b);
  } else if (dl === "research") {
    // Small magnifying glass accessory
    acc.circle(8, headY + 16, 4);
    acc.stroke({ color: 0x10b981, width: 1.2, alpha: 0.6 });
    acc.moveTo(11, headY + 19);
    acc.lineTo(14, headY + 22);
    acc.stroke({ color: 0x10b981, width: 1.5, alpha: 0.5 });
    acc.circle(8, headY + 16, 1.5);
    acc.fill({ color: 0x10b981, alpha: 0.15 });
  } else if (dl === "review") {
    acc.moveTo(6, headY + 16);
    acc.lineTo(11, headY + 14);
    acc.lineTo(11, headY + 20);
    acc.lineTo(8.5, headY + 23);
    acc.lineTo(6, headY + 20);
    acc.closePath();
    acc.fill(0x06b6d4);
    acc.circle(8.5, headY + 18, 1.2);
    acc.fill({ color: 0xffffff, alpha: 0.7 });
  } else if (dl === "devops") {
    acc.roundRect(-9, headY - 14, 18, 6, 3);
    acc.fill(0xfbbf24);
    acc.roundRect(-12, headY - 9, 24, 3, 1);
    acc.fill(0xf59e0b);
  }
  acc.label = "accessory";
  c.addChild(acc);

  // Glowing status indicator (replaces flat dot)
  const dot = new Graphics();
  const sc = STATUS_COLORS[status] || 0x71717a;
  dot.circle(13, headY - 8, 5);
  dot.fill({ color: sc, alpha: 0.2 });
  dot.circle(13, headY - 8, 3.5);
  dot.fill(sc);
  dot.circle(13, headY - 8, 1.5);
  dot.fill({ color: 0xffffff, alpha: 0.5 });
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
      letterSpacing: 0.5,
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

// === Premium Desk ===
export function drawDesk(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);

  const g = new Graphics();

  // Multi-layer shadow
  g.ellipse(DESK_W / 2, DESK_H + 4, DESK_W / 2 + 8, 7);
  g.fill({ color: 0x000000, alpha: 0.08 });
  g.ellipse(DESK_W / 2, DESK_H + 3, DESK_W / 2 + 4, 5);
  g.fill({ color: 0x000000, alpha: 0.12 });

  // LED underglow
  g.ellipse(DESK_W / 2, DESK_H + 1, DESK_W / 2 - 4, 3);
  g.fill({ color: 0x3b82f6, alpha: 0.06 });
  g.label = "desk-underglow";

  // Desk legs — metallic
  g.roundRect(4, DESK_H - 2, 3, 6, 1);
  g.fill(0x52525b);
  g.roundRect(DESK_W - 7, DESK_H - 2, 3, 6, 1);
  g.fill(0x52525b);

  // Desk surface — dark premium
  g.roundRect(0, 0, DESK_W, DESK_H, 4);
  g.fill(0x18181b);
  g.roundRect(1, 1, DESK_W - 2, DESK_H - 2, 3);
  g.fill(0x1e1e22);
  // Edge highlight
  g.roundRect(2, 2, DESK_W - 4, 3, 1.5);
  g.fill({ color: 0x3b82f6, alpha: 0.04 });
  // Subtle surface sheen
  g.roundRect(4, 3, DESK_W - 8, 1, 0.5);
  g.fill({ color: 0xffffff, alpha: 0.02 });

  c.addChild(g);

  // === Dual Monitor Setup ===
  const monBase = new Graphics();
  monBase.rect(DESK_W / 2 - 3, 4, 6, 3);
  monBase.fill(0x27272a);
  monBase.rect(DESK_W / 2 - 12, 2, 24, 3);
  monBase.fill(0x27272a);
  c.addChild(monBase);

  // Left monitor
  const monL = new Graphics();
  monL.roundRect(DESK_W / 2 - 26, -20, 22, 18, 2);
  monL.fill(0x0a0a0e);
  monL.stroke({ color: 0x27272a, width: 1 });
  monL.roundRect(DESK_W / 2 - 24, -18, 18, 14, 1);
  monL.fill({ color: 0x0d1b2a, alpha: 0.95 });
  monL.label = "monitor-screen-l";
  c.addChild(monL);

  // Right monitor
  const monR = new Graphics();
  monR.roundRect(DESK_W / 2 + 4, -20, 22, 18, 2);
  monR.fill(0x0a0a0e);
  monR.stroke({ color: 0x27272a, width: 1 });
  monR.roundRect(DESK_W / 2 + 6, -18, 18, 14, 1);
  monR.fill({ color: 0x0d1b2a, alpha: 0.95 });
  monR.label = "monitor-screen-r";
  c.addChild(monR);

  // Monitor glow
  const glow = new Graphics();
  glow.ellipse(DESK_W / 2, 2, 28, 6);
  glow.fill({ color: 0x3b82f6, alpha: 0.03 });
  glow.label = "monitor-glow";
  c.addChild(glow);

  // Keyboard — mechanical style
  const kb = new Graphics();
  kb.roundRect(DESK_W / 2 - 18, 9, 36, 12, 2);
  kb.fill(0x18181b);
  kb.stroke({ color: 0x27272a, width: 0.5 });
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 9; col++) {
      kb.roundRect(DESK_W / 2 - 16 + col * 3.8, 10.5 + row * 3, 3, 2.2, 0.4);
      kb.fill({ color: 0x27272a, alpha: 0.7 });
    }
  }
  // RGB accent on spacebar
  kb.roundRect(DESK_W / 2 - 8, 10.5 + 3 * 3, 16, 2.2, 0.5);
  kb.fill({ color: 0x3b82f6, alpha: 0.15 });
  c.addChild(kb);

  // Coffee mug — premium
  const mug = new Graphics();
  const mx = DESK_W - 14, my = DESK_H - 16;
  mug.roundRect(mx - 5, my - 6, 10, 10, 2);
  mug.fill(0x27272a);
  mug.stroke({ color: 0x3f3f46, width: 0.8 });
  mug.arc(mx + 5, my - 1, 4, -1.2, 1.2);
  mug.stroke({ width: 1, color: 0x3f3f46 });
  mug.ellipse(mx, my - 4, 3.5, 1.5);
  mug.fill({ color: 0x7c5a3a, alpha: 0.7 });
  mug.label = "coffee-mug";
  c.addChild(mug);

  // Notepad
  const pad = new Graphics();
  pad.roundRect(4, DESK_H - 18, 12, 14, 1);
  pad.fill(0x1c1c20);
  pad.stroke({ color: 0x27272a, width: 0.4 });
  for (let l = 0; l < 4; l++) {
    pad.moveTo(6, DESK_H - 15 + l * 3);
    pad.lineTo(14, DESK_H - 15 + l * 3);
    pad.stroke({ width: 0.3, color: 0x3f3f46, alpha: 0.3 });
  }
  c.addChild(pad);

  return c;
}

// === Premium Chair ===
export function drawChair(x: number, y: number, accentColor: number): Container {
  const c = new Container();
  c.position.set(x, y);

  const g = new Graphics();
  // Wheels shadow
  g.ellipse(0, 10, 12, 3);
  g.fill({ color: 0x000000, alpha: 0.1 });
  // Seat
  g.ellipse(0, 0, 11, 5);
  g.fill(blend(accentColor, 0x000000, 0.35));
  // Back
  g.roundRect(-9, -14, 18, 12, 4);
  g.fill(blend(accentColor, 0x000000, 0.25));
  g.stroke({ color: blend(accentColor, 0xffffff, 0.1), width: 0.4 });
  // Highlight
  g.roundRect(-5, -12, 10, 4, 2);
  g.fill({ color: blend(accentColor, 0xffffff, 0.2), alpha: 0.12 });
  c.addChild(g);

  return c;
}

// === Premium Room ===
export function drawRoom(
  name: string,
  w: number,
  h: number,
  tint: number
): Container {
  const c = new Container();
  c.label = "department-room";

  // Base
  const base = new Graphics();
  base.roundRect(0, 0, w, h, 10);
  base.fill({ color: 0x0c0c10, alpha: 0.95 });
  c.addChild(base);

  // Floor grid — premium tech feel
  const grid = new Graphics();
  const gridSize = 20;
  for (let gy = 40; gy < h - 4; gy += gridSize) {
    grid.moveTo(4, gy);
    grid.lineTo(w - 4, gy);
    grid.stroke({ width: 0.3, color: tint, alpha: 0.04 });
  }
  for (let gx = 4; gx < w - 4; gx += gridSize) {
    grid.moveTo(gx, 40);
    grid.lineTo(gx, h - 4);
    grid.stroke({ width: 0.3, color: tint, alpha: 0.04 });
  }
  c.addChild(grid);

  // Floor tint
  const floor = new Graphics();
  floor.roundRect(0, 0, w, h, 10);
  floor.fill({ color: tint, alpha: 0.04 });
  c.addChild(floor);

  // Glass partition border (frosted glass effect)
  const border = new Graphics();
  border.roundRect(0, 0, w, h, 10);
  border.stroke({ color: tint, width: 1, alpha: 0.2 });
  // Inner glow
  border.roundRect(1, 1, w - 2, h - 2, 9);
  border.stroke({ color: tint, width: 0.5, alpha: 0.08 });
  border.label = "room-border";
  c.addChild(border);

  // LED strip accent (top)
  const led = new Graphics();
  led.roundRect(0, 0, w, 2, 10);
  led.fill({ color: tint, alpha: 0.8 });
  // LED glow
  led.roundRect(0, 2, w, 6, 0);
  led.fill({ color: tint, alpha: 0.06 });
  led.label = "led-strip";
  c.addChild(led);

  // Wall header — gradient
  const wallH = 36;
  const wall = new Graphics();
  for (let i = 0; i < 12; i++) {
    const alpha = 0.15 - (i / 12) * 0.12;
    wall.rect(0, 2 + i * (wallH / 12), w, wallH / 12 + 0.5);
    wall.fill({ color: tint, alpha });
  }
  c.addChild(wall);

  // Department insignia (holographic circle)
  const insignia = new Graphics();
  const ix = w - 28, iy = 18;
  insignia.circle(ix, iy, 10);
  insignia.stroke({ color: tint, width: 1, alpha: 0.3 });
  insignia.circle(ix, iy, 7);
  insignia.stroke({ color: tint, width: 0.5, alpha: 0.2 });
  insignia.circle(ix, iy, 4);
  insignia.fill({ color: tint, alpha: 0.15 });
  insignia.label = "dept-insignia";
  c.addChild(insignia);

  // Room name — premium typography
  const label = new Text({
    text: name.toUpperCase(),
    style: new TextStyle({
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 11,
      fontWeight: "700",
      fill: blend(tint, 0xffffff, 0.5),
      letterSpacing: 2,
    }),
  });
  label.position.set(14, 10);
  c.addChild(label);

  return c;
}

// === Wall Clock ===
export function drawWallClock(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);
  c.label = "wall-clock";

  const g = new Graphics();
  g.circle(0, 0, 8);
  g.fill({ color: 0x0c0c10, alpha: 0.9 });
  g.stroke({ color: 0x3b82f6, width: 0.5, alpha: 0.3 });
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI * 2) / 12 - Math.PI / 2;
    const len = i % 3 === 0 ? 5 : 5.5;
    g.moveTo(Math.cos(angle) * len, Math.sin(angle) * len);
    g.lineTo(Math.cos(angle) * 7, Math.sin(angle) * 7);
    g.stroke({ width: i % 3 === 0 ? 0.8 : 0.3, color: 0x3b82f6, alpha: 0.4 });
  }
  c.addChild(g);

  const hands = new Graphics();
  hands.label = "clock-hands";
  c.addChild(hands);

  return c;
}

// === CEO Avatar ===
export function drawCEO(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);
  c.label = "ceo-avatar";

  const ceoColor = 0xf59e0b;

  // Shadow
  const shadow = new Graphics();
  shadow.ellipse(0, 30, 16, 5);
  shadow.fill({ color: 0x000000, alpha: 0.25 });
  c.addChild(shadow);

  // Golden aura
  const aura = new Graphics();
  aura.ellipse(0, 5, 24, 32);
  aura.fill({ color: 0xf59e0b, alpha: 0.05 });
  aura.ellipse(0, 5, 28, 36);
  aura.stroke({ color: 0xf59e0b, width: 0.5, alpha: 0.1 });
  aura.label = "ceo-aura";
  c.addChild(aura);

  const body = new Graphics();
  const headY = -14;

  // Legs
  const legY = headY + 32;
  body.roundRect(-7, legY, 5.5, 14, 2);
  body.fill(0x1e293b);
  body.roundRect(1.5, legY, 5.5, 14, 2);
  body.fill(0x1e293b);
  body.roundRect(-8, legY + 12, 8, 3, 1.5);
  body.fill(0x1a1a2e);
  body.roundRect(0, legY + 12, 8, 3, 1.5);
  body.fill(0x1a1a2e);

  // Torso (suit)
  const torsoY = headY + 13;
  body.roundRect(-10, torsoY, 20, 20, 5);
  body.fill(ceoColor);
  body.roundRect(-8, torsoY, 16, 8, 3);
  body.fill({ color: 0xffffff, alpha: 0.08 });
  // Tie
  body.moveTo(0, torsoY + 2);
  body.lineTo(-2, torsoY + 8);
  body.lineTo(0, torsoY + 12);
  body.lineTo(2, torsoY + 8);
  body.closePath();
  body.fill(0xef4444);

  // Arms
  body.roundRect(-14, torsoY + 2, 5, 16, 2.5);
  body.fill(blend(ceoColor, 0x000000, 0.15));
  body.circle(-11.5, torsoY + 19, 3);
  body.fill(SKIN_TONE);
  body.roundRect(9, torsoY + 2, 5, 16, 2.5);
  body.fill(blend(ceoColor, 0x000000, 0.15));
  body.circle(11.5, torsoY + 19, 3);
  body.fill(SKIN_TONE);

  // Neck
  body.roundRect(-3, headY + 9, 6, 6, 2);
  body.fill(SKIN_TONE);

  drawHumanoidFace(body, "working", 0x1a1a2e, headY);
  c.addChild(body);

  // Crown
  const crown = drawCrown();
  crown.position.set(0, headY - 12);
  crown.label = "ceo-crown";
  c.addChild(crown);

  const label = new Text({
    text: "JASH — CEO",
    style: new TextStyle({
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 10,
      fill: 0xfbbf24,
      fontWeight: "700",
      letterSpacing: 1.5,
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
  g.fill(0x18181b);
  g.roundRect(-68, -16, 136, 32, 5);
  g.fill(0x1e1e22);
  g.stroke({ color: 0x27272a, width: 0.5 });
  // Surface lines
  for (let i = 0; i < 5; i++) {
    g.moveTo(-60, -12 + i * 7);
    g.lineTo(60, -12 + i * 7);
    g.stroke({ width: 0.15, color: 0x3b82f6, alpha: 0.06 });
  }
  c.addChild(g);

  // Premium chairs around table
  const positions = [
    { x: -50, y: -30 }, { x: 0, y: -30 }, { x: 50, y: -30 },
    { x: -50, y: 30 }, { x: 0, y: 30 }, { x: 50, y: 30 },
  ];
  for (const pos of positions) {
    const ch = new Graphics();
    ch.ellipse(pos.x, pos.y, 8, 4);
    ch.fill({ color: 0x1e1e22, alpha: 0.8 });
    ch.stroke({ color: 0x27272a, width: 0.4 });
    c.addChild(ch);
  }

  return c;
}

// === Hallway ===
export function drawHallway(w: number): Container {
  const c = new Container();
  c.label = "hallway";
  const h = 36;

  const g = new Graphics();
  g.rect(0, 0, w, h);
  g.fill(0x08080c);

  // Floor tiles with LED accents
  const tileW = 36;
  for (let tx = 0; tx < w; tx += tileW) {
    const isEven = (Math.floor(tx / tileW) % 2) === 0;
    g.rect(tx, 0, Math.min(tileW, w - tx), h);
    g.fill({ color: isEven ? 0x0e0e12 : 0x0c0c10, alpha: 1 });
  }

  // LED floor strips
  g.rect(0, h - 1, w, 1);
  g.fill({ color: 0x3b82f6, alpha: 0.15 });
  g.rect(0, 0, w, 1);
  g.fill({ color: 0x3b82f6, alpha: 0.15 });
  c.addChild(g);

  const plant1 = drawPlant(20, h / 2);
  const plant2 = drawPlant(w - 20, h / 2);
  c.addChild(plant1);
  c.addChild(plant2);

  // Data flow arrows (holographic)
  for (let ax = 80; ax < w - 80; ax += 60) {
    const arrow = new Graphics();
    arrow.moveTo(ax, h / 2 - 2);
    arrow.lineTo(ax + 8, h / 2);
    arrow.lineTo(ax, h / 2 + 2);
    arrow.stroke({ color: 0x3b82f6, width: 0.5, alpha: 0.2 });
    c.addChild(arrow);
  }

  return c;
}

// === Plant ===
export function drawPlant(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);

  const g = new Graphics();
  g.roundRect(-6, 0, 12, 10, 2);
  g.fill(0x1c1c20);
  g.stroke({ color: 0x27272a, width: 0.5 });
  g.ellipse(0, 1, 5, 2);
  g.fill(0x27272a);
  g.ellipse(-4, -4, 5, 3);
  g.fill({ color: 0x22c55e, alpha: 0.6 });
  g.ellipse(3, -6, 4, 3);
  g.fill({ color: 0x16a34a, alpha: 0.6 });
  g.ellipse(0, -8, 3, 4);
  g.fill({ color: 0x15803d, alpha: 0.5 });
  c.addChild(g);
  return c;
}

// === Server Rack (for DevOps room) ===
export function drawServerRack(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);
  c.label = "server-rack";

  const g = new Graphics();
  // Rack body
  g.roundRect(-12, -30, 24, 55, 3);
  g.fill(0x18181b);
  g.stroke({ color: 0x27272a, width: 1 });

  // Server units (5 stacked)
  for (let i = 0; i < 5; i++) {
    const sy = -26 + i * 10;
    g.roundRect(-10, sy, 20, 8, 1);
    g.fill(0x0c0c10);
    g.stroke({ color: 0x27272a, width: 0.4 });
    // LED indicators (will be animated)
    g.circle(-6, sy + 4, 1.2);
    g.fill({ color: 0x22c55e, alpha: 0.6 });
    g.circle(-2, sy + 4, 1.2);
    g.fill({ color: 0x3b82f6, alpha: 0.4 });
    // Vent lines
    for (let v = 0; v < 3; v++) {
      g.moveTo(2 + v * 3, sy + 2);
      g.lineTo(2 + v * 3, sy + 6);
      g.stroke({ width: 0.3, color: 0x3f3f46, alpha: 0.3 });
    }
  }
  c.addChild(g);
  return c;
}

// === Research Globe (wireframe sphere) ===
export function drawResearchGlobe(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);
  c.label = "research-globe";

  const g = new Graphics();
  const r = 14;
  // Outer circle
  g.circle(0, 0, r);
  g.stroke({ color: 0x10b981, width: 0.8, alpha: 0.3 });
  // Latitude lines
  for (let i = -2; i <= 2; i++) {
    const ry = r * Math.cos(Math.asin(i / 3));
    g.ellipse(0, (i / 3) * r, ry, 2);
    g.stroke({ color: 0x10b981, width: 0.4, alpha: 0.2 });
  }
  // Longitude lines
  g.ellipse(0, 0, r * 0.3, r);
  g.stroke({ color: 0x10b981, width: 0.4, alpha: 0.2 });
  g.ellipse(0, 0, r * 0.7, r);
  g.stroke({ color: 0x10b981, width: 0.4, alpha: 0.15 });
  // Center glow
  g.circle(0, 0, 3);
  g.fill({ color: 0x10b981, alpha: 0.1 });
  c.addChild(g);

  return c;
}

// === Whiteboard ===
export function drawWhiteboard(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);

  const g = new Graphics();
  g.roundRect(-22, -16, 44, 30, 2);
  g.fill(0x18181b);
  g.stroke({ color: 0x27272a, width: 1 });
  g.roundRect(-20, -14, 40, 24, 1);
  g.fill({ color: 0xf5f5f5, alpha: 0.8 });
  // Diagram — circles and lines
  g.circle(-8, -4, 4);
  g.stroke({ color: 0x3b82f6, width: 0.6, alpha: 0.3 });
  g.circle(8, -4, 3);
  g.stroke({ color: 0xef4444, width: 0.6, alpha: 0.3 });
  g.moveTo(-4, -4);
  g.lineTo(5, -4);
  g.stroke({ width: 0.5, color: 0x52525b, alpha: 0.3 });
  g.circle(0, 5, 5);
  g.stroke({ color: 0x22c55e, width: 0.6, alpha: 0.25 });
  g.moveTo(-8, 0);
  g.lineTo(0, 5);
  g.stroke({ width: 0.4, color: 0x52525b, alpha: 0.2 });
  // Marker tray
  g.roundRect(-16, 12, 32, 3, 1);
  g.fill(0x27272a);
  g.roundRect(-12, 11, 6, 2, 0.5);
  g.fill({ color: 0x3b82f6, alpha: 0.6 });
  g.roundRect(-4, 11, 6, 2, 0.5);
  g.fill({ color: 0xef4444, alpha: 0.6 });
  g.roundRect(4, 11, 6, 2, 0.5);
  g.fill({ color: 0x22c55e, alpha: 0.6 });
  c.addChild(g);
  return c;
}

// === Water Cooler ===
export function drawWaterCooler(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);

  const g = new Graphics();
  g.roundRect(-8, 10, 16, 20, 2);
  g.fill(0x18181b);
  g.stroke({ color: 0x27272a, width: 0.8 });
  g.roundRect(-6, -18, 12, 28, 3);
  g.fill({ color: 0x60a5fa, alpha: 0.12 });
  g.stroke({ color: 0x3b82f6, width: 0.5, alpha: 0.2 });
  g.roundRect(-4, -20, 8, 4, 2);
  g.fill({ color: 0x3b82f6, alpha: 0.3 });
  g.roundRect(6, 12, 6, 3, 1);
  g.fill(0x27272a);
  c.addChild(g);
  return c;
}

// === Filing Cabinet ===
export function drawFilingCabinet(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);

  const g = new Graphics();
  g.roundRect(-10, -20, 20, 40, 2);
  g.fill(0x18181b);
  g.stroke({ color: 0x27272a, width: 0.8 });
  for (let i = 0; i < 3; i++) {
    const dy = -18 + i * 13;
    g.roundRect(-8, dy, 16, 11, 1);
    g.fill(0x0c0c10);
    g.stroke({ color: 0x1e1e22, width: 0.4 });
    g.circle(0, dy + 5.5, 1.2);
    g.fill(0x3f3f46);
  }
  c.addChild(g);
  return c;
}

// === Desk Lamp ===
export function drawDeskLamp(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);

  const g = new Graphics();
  // Warm glow
  g.ellipse(0, 4, 10, 4);
  g.fill({ color: 0xfbbf24, alpha: 0.06 });
  g.ellipse(0, 3, 5, 2);
  g.fill(0x1e1e22);
  g.moveTo(0, 2);
  g.lineTo(-3, -10);
  g.stroke({ width: 1.2, color: 0x27272a });
  g.moveTo(-8, -10);
  g.lineTo(-3, -14);
  g.lineTo(2, -10);
  g.closePath();
  g.fill(0x1e1e22);
  g.circle(-3, -10, 1.5);
  g.fill({ color: 0xfbbf24, alpha: 0.4 });
  c.addChild(g);
  return c;
}

// === Rug ===
export function drawRug(x: number, y: number, w: number, h: number, color: number): Container {
  const c = new Container();
  c.position.set(x, y);

  const g = new Graphics();
  g.ellipse(0, 0, w, h);
  g.fill({ color: color, alpha: 0.05 });
  // Geometric pattern
  g.ellipse(0, 0, w * 0.7, h * 0.7);
  g.stroke({ color: color, width: 0.5, alpha: 0.08 });
  g.ellipse(0, 0, w * 0.4, h * 0.4);
  g.stroke({ color: color, width: 0.3, alpha: 0.06 });
  g.ellipse(0, 0, w, h);
  g.stroke({ color: color, width: 0.5, alpha: 0.08 });
  c.addChild(g);
  return c;
}

// === Neural Lounge (Break Room) ===
export function drawBreakRoom(w: number): Container {
  const h = 180;
  const c = new Container();
  c.label = "break-room";

  const base = new Graphics();
  base.roundRect(0, 0, w, h, 10);
  base.fill({ color: 0x0c0c10, alpha: 0.95 });
  c.addChild(base);

  // Warm ambient patches
  const amb = new Graphics();
  amb.ellipse(w * 0.3, h * 0.5, 60, 40);
  amb.fill({ color: 0xf59e0b, alpha: 0.02 });
  amb.ellipse(w * 0.7, h * 0.4, 50, 35);
  amb.fill({ color: 0x3b82f6, alpha: 0.015 });
  c.addChild(amb);

  const tint = new Graphics();
  tint.roundRect(0, 0, w, h, 10);
  tint.fill({ color: 0xf59e0b, alpha: 0.03 });
  c.addChild(tint);

  const border = new Graphics();
  border.roundRect(0, 0, w, h, 10);
  border.stroke({ color: 0xf59e0b, width: 1, alpha: 0.2 });
  border.roundRect(1, 1, w - 2, h - 2, 9);
  border.stroke({ color: 0xf59e0b, width: 0.5, alpha: 0.06 });
  c.addChild(border);

  // LED strip
  const led = new Graphics();
  led.roundRect(0, 0, w, 2, 10);
  led.fill({ color: 0xf59e0b, alpha: 0.6 });
  led.roundRect(0, 2, w, 4, 0);
  led.fill({ color: 0xf59e0b, alpha: 0.04 });
  c.addChild(led);

  const label = new Text({
    text: "NEURAL LOUNGE",
    style: new TextStyle({
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 11,
      fontWeight: "700",
      fill: blend(0xf59e0b, 0xffffff, 0.5),
      letterSpacing: 2,
    }),
  });
  label.position.set(14, 10);
  c.addChild(label);

  // Coffee machine
  const coffee = drawCoffeeMachine(60, 55);
  c.addChild(coffee);

  // Water cooler
  const cooler = drawWaterCooler(w - 50, 60);
  c.addChild(cooler);

  // Bookshelf
  const shelf = drawBookshelf(w - 120, 45);
  c.addChild(shelf);

  // Sofas
  const sofaPositions = [
    { x: w / 2 - 70, y: 110 },
    { x: w / 2, y: 110 },
    { x: w / 2 + 70, y: 110 },
  ];
  for (const pos of sofaPositions) {
    const sofa = drawSofa(pos.x, pos.y);
    c.addChild(sofa);
  }

  // Coffee table
  const table = new Graphics();
  table.roundRect(w / 2 - 22, 128, 44, 22, 4);
  table.fill(0x18181b);
  table.stroke({ color: 0x27272a, width: 0.5 });
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
  g.fill(0x18181b);
  g.stroke({ color: 0x27272a, width: 1 });
  g.roundRect(-13, -28, 26, 18, 2);
  g.fill(0x0c0c10);
  g.roundRect(-11, -26, 10, 14, 1);
  g.fill({ color: 0x3b82f6, alpha: 0.12 });
  g.circle(6, -22, 2);
  g.fill(0x22c55e);
  g.circle(6, -16, 2);
  g.fill({ color: 0xeab308, alpha: 0.4 });
  g.roundRect(-10, 14, 20, 4, 1);
  g.fill(0x0c0c10);
  g.roundRect(-6, 4, 12, 10, 1);
  g.fill(0x0c0c10);
  g.rect(-2, -10, 4, 6);
  g.fill(0x27272a);
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
  g.fill(0x18181b);
  g.stroke({ color: 0x27272a, width: 1 });

  for (let i = 0; i < 3; i++) {
    const sy = -14 + i * 18;
    g.rect(-23, sy, 46, 1);
    g.fill(0x27272a);

    const bookColors = [0x3b82f6, 0xef4444, 0x22c55e, 0xf59e0b, 0xa855f7, 0x06b6d4];
    let bx = -21;
    for (let b = 0; b < 5; b++) {
      const bw = 4 + Math.random() * 4;
      const bh = 12 + Math.random() * 4;
      g.roundRect(bx, sy - bh, bw, bh, 0.5);
      g.fill({ color: bookColors[b % bookColors.length], alpha: 0.35 + Math.random() * 0.25 });
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
  g.roundRect(-20, -6, 40, 18, 5);
  g.fill(0x18181b);
  g.stroke({ color: 0x27272a, width: 0.8 });
  g.roundRect(-17, -4, 16, 12, 2);
  g.fill({ color: 0x3b82f6, alpha: 0.1 });
  g.roundRect(1, -4, 16, 12, 2);
  g.fill({ color: 0x3b82f6, alpha: 0.08 });
  g.roundRect(-20, -14, 40, 10, 4);
  g.fill(0x141418);
  g.stroke({ color: 0x1e1e22, width: 0.5 });
  c.addChild(g);
  return c;
}

// === Bed ===
export function drawBed(x: number, y: number): Container {
  const c = new Container();
  c.position.set(x, y);
  c.label = "agent-bed";

  const g = new Graphics();
  g.roundRect(-16, -6, 32, 16, 3);
  g.fill(0x18181b);
  g.stroke({ color: 0x27272a, width: 0.8 });
  g.roundRect(-14, -2, 28, 12, 2);
  g.fill({ color: 0x3b82f6, alpha: 0.1 });
  g.ellipse(-8, -2, 6, 4);
  g.fill(0x1e1e22);
  const zzz = new Text({
    text: "zzz",
    style: new TextStyle({
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 7,
      fill: 0x52525b,
      fontStyle: "italic",
    }),
  });
  zzz.position.set(10, -12);
  zzz.label = "zzz-text";
  c.addChild(g);
  c.addChild(zzz);
  return c;
}

// === Ceiling Light ===
export function drawCeilingLight(x: number, y: number, tint: number): Container {
  const c = new Container();
  c.position.set(x, y);
  c.label = "ceiling-light";

  const g = new Graphics();
  // Light cone (soft glow)
  g.moveTo(-16, 0);
  g.lineTo(-30, 40);
  g.lineTo(30, 40);
  g.lineTo(16, 0);
  g.closePath();
  g.fill({ color: tint, alpha: 0.015 });
  // Fixture
  g.roundRect(-8, -2, 16, 4, 2);
  g.fill(0x27272a);
  c.addChild(g);
  return c;
}

export { DESK_W, DESK_H, AGENT_RADIUS, CEO_RADIUS };
