// Modular car generator (side view). Every car is drawn from code: a body
// family + paint + rarity trim. Later this grows into the SVG parts pipeline
// from the plan; the interface (drawCar) stays the same.

import Phaser from 'phaser';
import type { CarFamily, Rarity } from '../core/config';

type Pt = [number, number];

interface FamilyShape {
  body: Pt[];
  windows: Pt[][];
  wheels: [number, number];
  spoiler?: boolean;
}

// Coordinates are fractions of the texture's width and height. Front faces right.
const SHAPES: Record<CarFamily, FamilyShape> = {
  sedan: {
    body: [[0.03, 0.62], [0.05, 0.46], [0.24, 0.42], [0.35, 0.22], [0.66, 0.22], [0.79, 0.42], [0.96, 0.47], [0.98, 0.63], [0.95, 0.76], [0.05, 0.76]],
    windows: [
      [[0.38, 0.27], [0.5, 0.27], [0.5, 0.42], [0.3, 0.42]],
      [[0.53, 0.27], [0.64, 0.27], [0.74, 0.42], [0.53, 0.42]],
    ],
    wheels: [0.22, 0.78],
  },
  hatch: {
    body: [[0.05, 0.62], [0.06, 0.3], [0.18, 0.2], [0.58, 0.2], [0.75, 0.42], [0.95, 0.48], [0.97, 0.64], [0.93, 0.76], [0.07, 0.76]],
    windows: [
      [[0.12, 0.27], [0.32, 0.27], [0.32, 0.42], [0.1, 0.42]],
      [[0.35, 0.27], [0.56, 0.27], [0.7, 0.42], [0.35, 0.42]],
    ],
    wheels: [0.22, 0.77],
  },
  pickup: {
    body: [[0.02, 0.42], [0.46, 0.42], [0.49, 0.17], [0.7, 0.17], [0.8, 0.41], [0.97, 0.45], [0.99, 0.65], [0.95, 0.77], [0.04, 0.77], [0.02, 0.65]],
    windows: [[[0.52, 0.23], [0.68, 0.23], [0.76, 0.41], [0.52, 0.41]]],
    wheels: [0.2, 0.8],
  },
  muscle: {
    body: [[0.02, 0.56], [0.04, 0.45], [0.3, 0.42], [0.42, 0.27], [0.63, 0.27], [0.75, 0.43], [0.98, 0.47], [0.99, 0.63], [0.95, 0.73], [0.04, 0.73]],
    windows: [[[0.44, 0.31], [0.61, 0.31], [0.7, 0.43], [0.38, 0.43]]],
    wheels: [0.2, 0.8],
    spoiler: true,
  },
};

const OUTLINE = 0x1e2430;
const GLASS = 0x2c3e55;
const TIRE = 0x1b1d22;
const RIM = 0xc9d1d9;

function shade(color: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const f = (v: number) => Phaser.Math.Clamp(Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount), 0, 255);
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
}

function scale(points: Pt[], w: number, h: number): Phaser.Math.Vector2[] {
  return points.map(([x, y]) => new Phaser.Math.Vector2(x * w, y * h));
}

/** Leftmost and rightmost x where a horizontal line at `y` crosses the polygon. */
function spanAt(poly: Phaser.Math.Vector2[], y: number): [number, number] | null {
  const xs: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
      xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
  }
  if (xs.length < 2) return null;
  return [Math.min(...xs), Math.max(...xs)];
}

export function pointInBody(family: CarFamily, w: number, h: number, x: number, y: number): boolean {
  const poly = new Phaser.Geom.Polygon(scale(SHAPES[family].body, w, h));
  return poly.contains(x, y);
}

export interface CarLook {
  family: CarFamily;
  paint: number;
  rarity: Rarity;
}

export function drawCar(g: Phaser.GameObjects.Graphics, look: CarLook, w: number, h: number): void {
  const shape = SHAPES[look.family];
  const body = scale(shape.body, w, h);
  const line = Math.max(2, w / 70);
  const wheelR = h * 0.15;
  const wheelY = h * 0.76;

  // Ground shadow.
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(w / 2, h * 0.93, w * 0.9, h * 0.1);

  // Spoiler behind the body.
  if (shape.spoiler) {
    g.fillStyle(shade(look.paint, -0.35), 1);
    g.lineStyle(line, OUTLINE, 1);
    g.fillRect(w * 0.02, h * 0.33, w * 0.12, h * 0.05);
    g.strokeRect(w * 0.02, h * 0.33, w * 0.12, h * 0.05);
    g.fillRect(w * 0.07, h * 0.37, w * 0.025, h * 0.08);
  }

  // Body.
  g.fillStyle(look.paint, 1);
  g.fillPoints(body, true);

  // Lower skirt (darker) and shoulder highlight, clipped to the body by scanline spans.
  const skirtTop = h * 0.64;
  for (let y = skirtTop; y < h * 0.76; y += 1) {
    const span = spanAt(body, y);
    if (span) {
      g.fillStyle(shade(look.paint, -0.22), 1);
      g.fillRect(span[0], y, span[1] - span[0], 1);
    }
  }
  const shoulder = spanAt(body, h * 0.5);
  if (shoulder) {
    g.lineStyle(line * 0.8, shade(look.paint, 0.35), 1);
    g.lineBetween(shoulder[0] + line, h * 0.5, shoulder[1] - line, h * 0.5);
  }

  // Rarity trim.
  if (look.rarity !== 'common' && shoulder) {
    const trim = look.rarity === 'legendary' ? 0xf5b700 : look.rarity === 'epic' ? 0xa855f7 : RIM;
    g.lineStyle(line * 0.7, trim, 1);
    g.lineBetween(shoulder[0] + line * 2, h * 0.56, shoulder[1] - line * 2, h * 0.56);
  }

  // Windows with a reflection streak.
  for (const win of shape.windows) {
    const pts = scale(win, w, h);
    g.fillStyle(GLASS, 1);
    g.fillPoints(pts, true);
    g.lineStyle(line * 0.8, OUTLINE, 1);
    g.strokePoints(pts, true);
    const minX = Math.min(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxY = Math.max(...pts.map((p) => p.y));
    g.lineStyle(line * 0.9, 0xffffff, 0.35);
    g.lineBetween(minX + w * 0.03, maxY - 2, minX + w * 0.07, minY + 2);
  }

  // Door line.
  g.lineStyle(line * 0.6, shade(look.paint, -0.4), 0.8);
  g.lineBetween(w * 0.52, h * 0.44, w * 0.52, h * 0.72);

  // Lights.
  g.fillStyle(0xfff3c4, 1);
  g.fillEllipse(w * 0.955, h * 0.53, w * 0.035, h * 0.06);
  g.fillStyle(0xe5484d, 1);
  g.fillRect(w * 0.035, h * 0.5, w * 0.025, h * 0.07);

  // Body outline on top.
  g.lineStyle(line, OUTLINE, 1);
  g.strokePoints(body, true);

  // Wheels.
  for (const fx of shape.wheels) {
    const cx = fx * w;
    g.fillStyle(TIRE, 1);
    g.fillCircle(cx, wheelY, wheelR);
    g.fillStyle(RIM, 1);
    g.fillCircle(cx, wheelY, wheelR * 0.55);
    g.lineStyle(line * 0.5, 0x8a94a3, 1);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.lineBetween(cx, wheelY, cx + Math.cos(a) * wheelR * 0.5, wheelY + Math.sin(a) * wheelR * 0.5);
    }
    g.fillStyle(0x4b5563, 1);
    g.fillCircle(cx, wheelY, wheelR * 0.15);
    g.lineStyle(line, OUTLINE, 1);
    g.strokeCircle(cx, wheelY, wheelR);
  }
}

/** Rust patches and dents, shown over the car while it is damaged. */
export function drawRust(g: Phaser.GameObjects.Graphics, family: CarFamily, w: number, h: number, seed: number): void {
  const rnd = new Phaser.Math.RandomDataGenerator([String(seed)]);
  let placed = 0;
  for (let i = 0; i < 80 && placed < 14; i++) {
    const x = rnd.between(w * 0.08, w * 0.92);
    const y = rnd.between(h * 0.3, h * 0.7);
    if (!pointInBody(family, w, h, x, y)) continue;
    const r = rnd.between(h * 0.03, h * 0.07);
    g.fillStyle(0x8a4b22, 0.85);
    g.fillCircle(x, y, r);
    g.fillStyle(0x5e3115, 0.8);
    g.fillCircle(x + r * 0.3, y + r * 0.2, r * 0.5);
    placed++;
  }
  // Dents.
  g.lineStyle(Math.max(2, w / 90), 0x1e2430, 0.5);
  for (let i = 0; i < 3; i++) {
    const x = rnd.between(w * 0.2, w * 0.8);
    const y = rnd.between(h * 0.5, h * 0.66);
    if (pointInBody(family, w, h, x, y)) g.beginPath(), g.arc(x, y, h * 0.05, Math.PI * 1.1, Math.PI * 1.9), g.strokePath();
  }
}

/** Mud splotches that sit inside the body outline. */
export function mudSpots(family: CarFamily, w: number, h: number, seed: number): { x: number; y: number; r: number }[] {
  const rnd = new Phaser.Math.RandomDataGenerator([String(seed * 7 + 3)]);
  const spots: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < 200 && spots.length < 40; i++) {
    const x = rnd.between(0, w);
    const y = rnd.between(h * 0.2, h * 0.78);
    if (pointInBody(family, w, h, x, y)) spots.push({ x, y, r: rnd.between(h * 0.02, h * 0.06) });
  }
  return spots;
}
