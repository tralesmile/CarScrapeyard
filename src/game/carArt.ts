// Modular car generator (side view). Every car is drawn from code: a body
// family + paint + rarity trim, painted with the Canvas 2D API so edges are
// antialiased and corners rounded on every renderer (WebGL polygons are not).
// Pure apart from the canvas context: the geometry is unit-tested.

import type { CarFamily, Rarity } from '../core/config';

export type Pt = [number, number];

export interface FamilyShape {
  /** Body outline, front faces right. Fractions of the texture's width and height. */
  body: Pt[];
  windows: Pt[][];
  /** Wheel centres (x fractions). */
  wheels: [number, number];
  /** Wheel radius as a fraction of the height. */
  wheelR: number;
  /** Corner rounding as a fraction of the height. */
  round: number;
  spoiler?: 'small' | 'big';
  /** x of the door seam, if the car has one. */
  door?: number;
  roofRack?: boolean;
  /** Raised hood scoop over the engine (muscle). */
  scoop?: boolean;
  /** Side air intake behind the door (sports and hyper). */
  intake?: boolean;
  /** Shark fin along the engine deck, from the canopy back towards the wing (hyper). */
  fin?: boolean;
  /** Dark front splitter and rear diffuser under the bumpers (hyper). */
  splitter?: boolean;
  /** Thin LED strip lights instead of round headlights (hyper). */
  slimLights?: boolean;
  /** Height (y fraction) of the head and tail lights. */
  lightY: number;
}

export const WHEEL_Y = 0.76;

/**
 * Car texture size for a bay car shown `displayPx` device pixels wide. Always a power of two (2:1) so WebGL builds
 * mipmaps and the lot thumbnails scale down without stair-steps; 1024 is the cap (a 3x phone upscales a little,
 * which stays smooth).
 */
export function carTextureSize(displayPx: number): { w: number; h: number } {
  const w = displayPx > 600 ? 1024 : 512;
  return { w, h: w / 2 };
}

export const SHAPES: Record<CarFamily, FamilyShape> = {
  sedan: {
    body: [[0.03, 0.62], [0.05, 0.46], [0.24, 0.42], [0.35, 0.22], [0.66, 0.22], [0.79, 0.42], [0.96, 0.47], [0.98, 0.63], [0.95, 0.76], [0.05, 0.76]],
    windows: [
      [[0.38, 0.27], [0.5, 0.27], [0.5, 0.42], [0.3, 0.42]],
      [[0.53, 0.27], [0.64, 0.27], [0.74, 0.42], [0.53, 0.42]],
    ],
    wheels: [0.22, 0.78],
    wheelR: 0.15,
    round: 0.06,
    door: 0.515,
    lightY: 0.53,
  },
  hatch: {
    // Small and round: a lower roof than the SUV, a steep hatch right behind the rear wheel, a short bonnet (P1.1x).
    body: [[0.07, 0.64], [0.08, 0.37], [0.19, 0.26], [0.53, 0.26], [0.71, 0.44], [0.92, 0.49], [0.94, 0.65], [0.9, 0.76], [0.09, 0.76]],
    windows: [
      [[0.15, 0.32], [0.32, 0.32], [0.32, 0.44], [0.12, 0.44]],
      [[0.35, 0.32], [0.52, 0.32], [0.66, 0.44], [0.35, 0.44]],
    ],
    wheels: [0.23, 0.76],
    wheelR: 0.14,
    round: 0.1,
    door: 0.335,
    lightY: 0.54,
  },
  pickup: {
    body: [[0.02, 0.42], [0.46, 0.42], [0.49, 0.17], [0.7, 0.17], [0.8, 0.41], [0.97, 0.45], [0.99, 0.65], [0.95, 0.77], [0.04, 0.77], [0.02, 0.65]],
    windows: [[[0.52, 0.23], [0.68, 0.23], [0.76, 0.41], [0.52, 0.41]]],
    wheels: [0.2, 0.8],
    wheelR: 0.16,
    round: 0.04,
    door: 0.5,
    lightY: 0.52,
  },
  muscle: {
    // Boxy and tall-shouldered: flat high deck and hood, a cabin set back with a steep rear window, hood scoop (P1.1x).
    body: [[0.02, 0.56], [0.03, 0.41], [0.26, 0.39], [0.36, 0.25], [0.58, 0.25], [0.69, 0.4], [0.98, 0.43], [0.99, 0.62], [0.95, 0.73], [0.04, 0.73]],
    windows: [[[0.38, 0.29], [0.56, 0.29], [0.64, 0.4], [0.32, 0.4]]],
    wheels: [0.2, 0.8],
    wheelR: 0.16,
    round: 0.04,
    spoiler: 'small',
    scoop: true,
    door: 0.5,
    lightY: 0.53,
  },
  van: {
    body: [[0.03, 0.7], [0.03, 0.2], [0.07, 0.13], [0.7, 0.13], [0.84, 0.38], [0.97, 0.45], [0.98, 0.66], [0.95, 0.77], [0.05, 0.77]],
    windows: [
      [[0.08, 0.2], [0.3, 0.2], [0.3, 0.37], [0.08, 0.37]],
      [[0.33, 0.2], [0.55, 0.2], [0.55, 0.37], [0.33, 0.37]],
      [[0.58, 0.2], [0.69, 0.2], [0.8, 0.37], [0.58, 0.37]],
    ],
    wheels: [0.18, 0.8],
    wheelR: 0.14,
    round: 0.07,
    door: 0.565,
    lightY: 0.55,
  },
  suv: {
    body: [[0.03, 0.66], [0.04, 0.25], [0.1, 0.18], [0.62, 0.18], [0.76, 0.39], [0.95, 0.44], [0.98, 0.64], [0.95, 0.78], [0.05, 0.78]],
    windows: [
      [[0.1, 0.24], [0.3, 0.24], [0.3, 0.39], [0.08, 0.39]],
      [[0.33, 0.24], [0.49, 0.24], [0.49, 0.39], [0.33, 0.39]],
      [[0.52, 0.24], [0.61, 0.24], [0.71, 0.39], [0.52, 0.39]],
    ],
    wheels: [0.2, 0.8],
    wheelR: 0.17,
    round: 0.06,
    door: 0.505,
    roofRack: true,
    lightY: 0.5,
  },
  sports: {
    body: [[0.02, 0.6], [0.04, 0.48], [0.3, 0.43], [0.45, 0.3], [0.6, 0.29], [0.74, 0.44], [0.97, 0.52], [0.99, 0.64], [0.96, 0.74], [0.04, 0.74]],
    windows: [[[0.47, 0.34], [0.59, 0.33], [0.68, 0.44], [0.39, 0.44]]],
    wheels: [0.2, 0.8],
    wheelR: 0.15,
    round: 0.06,
    spoiler: 'small',
    door: 0.56,
    intake: true,
    lightY: 0.56,
  },
  // Hypercar: very low, cab-forward bubble canopy, long engine deck with a shark fin, tall wing, splitter and
  // slim LED lights, so it reads apart from the sports car even at thumbnail size (P0.14h).
  hyper: {
    body: [[0.02, 0.64], [0.02, 0.53], [0.06, 0.5], [0.4, 0.47], [0.52, 0.36], [0.63, 0.35], [0.73, 0.46], [0.84, 0.55], [0.98, 0.63], [0.99, 0.68], [0.96, 0.74], [0.04, 0.74]],
    windows: [[[0.54, 0.395], [0.62, 0.385], [0.7, 0.47], [0.47, 0.47]]],
    wheels: [0.21, 0.8],
    wheelR: 0.16,
    round: 0.06,
    spoiler: 'big',
    intake: true,
    fin: true,
    splitter: true,
    slimLights: true,
    lightY: 0.6,
  },
};

/** Shark fin outline (fractions), used by families with `fin`. */
export const FIN: Pt[] = [[0.54, 0.37], [0.32, 0.385], [0.2, 0.4], [0.17, 0.5], [0.5, 0.5]];

/** Hood scoop outline (fractions), used by families with `scoop`: a raised box on the hood, open at the front. */
export const SCOOP: Pt[] = [[0.78, 0.425], [0.8, 0.35], [0.89, 0.35], [0.91, 0.43]];

/** Wing blade and stalk (x, y, w, h fractions) for a spoiler size. */
export function spoilerParts(size: 'small' | 'big'): { wing: Pt[]; stalk: [number, number, number, number] } {
  const big = size === 'big';
  const sy = big ? 0.31 : 0.38;
  const x2 = big ? 0.17 : 0.14;
  return {
    wing: [[0.01, sy - 0.02], [x2, sy - (big ? 0.04 : 0.02)], [x2, sy + 0.03], [0.01, sy + 0.03]],
    stalk: [0.07, sy, 0.025, big ? 0.2 : 0.08],
  };
}

/** Everything that makes a family's outline: body, plus fin and wing. Fractions; used to test silhouettes. */
export function silhouette(family: CarFamily): Pt[][] {
  const shape = SHAPES[family];
  const polys: Pt[][] = [shape.body];
  if (shape.fin) polys.push(FIN);
  if (shape.scoop) polys.push(SCOOP);
  if (shape.spoiler) {
    const { wing, stalk } = spoilerParts(shape.spoiler);
    const [x, y, sw, sh] = stalk;
    polys.push(wing, [[x, y], [x + sw, y], [x + sw, y + sh], [x, y + sh]]);
  }
  return polys;
}

/**
 * Intersection over union of two families' silhouettes above `maxY` (the roofline, where families differ),
 * sampled on a grid. 1 = identical outlines.
 */
export function silhouetteOverlap(a: CarFamily, b: CarFamily, maxY = 0.55, step = 0.005): number {
  const pa = silhouette(a);
  const pb = silhouette(b);
  const inside = (polys: Pt[][], x: number, y: number) => polys.some((p) => pointInPolygon(p, x, y));
  let both = 0;
  let either = 0;
  for (let x = 0; x < 1; x += step) {
    for (let y = 0; y < maxY; y += step) {
      const ia = inside(pa, x, y);
      const ib = inside(pb, x, y);
      if (ia && ib) both++;
      if (ia || ib) either++;
    }
  }
  return either === 0 ? 1 : both / either;
}

const OUTLINE = '#1e2430';
const TIRE = '#1b1d22';

function hex(color: number): string {
  return '#' + (color & 0xffffff).toString(16).padStart(6, '0');
}

/** Lighten (amount > 0) or darken (amount < 0) a 0xRRGGBB colour. */
export function shade(color: number, amount: number): string {
  const ch = [(color >> 16) & 255, (color >> 8) & 255, color & 255].map((v) => {
    const out = amount < 0 ? v * (1 + amount) : v + (255 - v) * amount;
    return Math.max(0, Math.min(255, Math.round(out)));
  });
  return hex((ch[0]! << 16) | (ch[1]! << 8) | ch[2]!);
}

export function scaled(points: Pt[], w: number, h: number): Pt[] {
  return points.map(([x, y]) => [x * w, y * h]);
}

/** Even-odd ray cast. */
export function pointInPolygon(poly: Pt[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInBody(family: CarFamily, w: number, h: number, x: number, y: number): boolean {
  return pointInPolygon(scaled(SHAPES[family].body, w, h), x, y);
}

/** Leftmost and rightmost x where a horizontal line at `y` crosses the polygon. */
export function spanAt(poly: Pt[], y: number): [number, number] | null {
  const xs: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
  }
  if (xs.length < 2) return null;
  return [Math.min(...xs), Math.max(...xs)];
}

/** Small seeded RNG (mulberry32) so rust and mud look the same every time for a car. */
export function seeded(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Trace a polygon with rounded corners (radius clamped to half of each edge). */
function roundedPath(ctx: CanvasRenderingContext2D, pts: Pt[], r: number): void {
  const n = pts.length;
  const len = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  ctx.beginPath();
  const last = pts[n - 1]!;
  const first = pts[0]!;
  ctx.moveTo((last[0] + first[0]) / 2, (last[1] + first[1]) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const prev = pts[(i - 1 + n) % n]!;
    const next = pts[(i + 1) % n]!;
    const rr = Math.min(r, len(prev, p) / 2, len(p, next) / 2);
    ctx.arcTo(p[0], p[1], next[0], next[1], rr);
  }
  ctx.closePath();
}

export interface CarLook {
  family: CarFamily;
  paint: number;
  rarity: Rarity;
}

const TRIM: Record<Rarity, string | null> = { common: null, rare: '#c9d1d9', epic: '#a855f7', legendary: '#f5b700' };

export function paintCar(ctx: CanvasRenderingContext2D, look: CarLook, w: number, h: number): void {
  const shape = SHAPES[look.family];
  const body = scaled(shape.body, w, h);
  const line = Math.max(2, w / 80);
  const wheelR = h * shape.wheelR;
  const wheelY = h * WHEEL_Y;
  const radius = h * shape.round;
  const top = Math.min(...body.map((p) => p[1]));
  const bottom = Math.max(...body.map((p) => p[1]));
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Ground shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.92, w * 0.44, h * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();

  // Spoiler behind the body.
  if (shape.spoiler) {
    const parts = spoilerParts(shape.spoiler);
    ctx.fillStyle = shade(look.paint, -0.35);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = line;
    const [sx, sy, sw, sh] = parts.stalk;
    ctx.fillRect(w * sx, h * sy, w * sw, h * sh);
    roundedPath(ctx, scaled(parts.wing, w, h), h * 0.015);
    ctx.fill();
    ctx.stroke();
  }

  // Shark fin behind the canopy (drawn before the body so the deck covers its foot).
  if (shape.fin) {
    ctx.fillStyle = shade(look.paint, -0.25);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = line;
    roundedPath(ctx, scaled(FIN, w, h), h * 0.02);
    ctx.fill();
    ctx.stroke();
  }

  // Roof rack.
  if (shape.roofRack) {
    ctx.strokeStyle = '#3a4250';
    ctx.lineWidth = line * 1.2;
    ctx.beginPath();
    ctx.moveTo(w * 0.12, top - h * 0.03);
    ctx.lineTo(w * 0.58, top - h * 0.03);
    for (const x of [0.16, 0.36, 0.54]) {
      ctx.moveTo(w * x, top - h * 0.03);
      ctx.lineTo(w * x, top + 1);
    }
    ctx.stroke();
  }

  // Body with a vertical gradient (light roof, darker skirt).
  roundedPath(ctx, body, radius);
  const grad = ctx.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0, shade(look.paint, 0.28));
  grad.addColorStop(0.45, hex(look.paint));
  grad.addColorStop(0.72, hex(look.paint));
  grad.addColorStop(0.73, shade(look.paint, -0.2));
  grad.addColorStop(1, shade(look.paint, -0.35));
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.save();
  roundedPath(ctx, body, radius);
  ctx.clip();
  // Glossy highlight along the flank.
  const gloss = ctx.createLinearGradient(0, h * 0.44, 0, h * 0.56);
  gloss.addColorStop(0, 'rgba(255,255,255,0)');
  gloss.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(0, h * 0.44, w, h * 0.12);
  // Shoulder crease.
  const shoulder = spanAt(body, h * 0.5);
  if (shoulder) {
    ctx.strokeStyle = shade(look.paint, 0.4);
    ctx.lineWidth = line * 0.7;
    ctx.beginPath();
    ctx.moveTo(shoulder[0] + line * 2, h * 0.5);
    ctx.lineTo(shoulder[1] - line * 2, h * 0.5);
    ctx.stroke();
  }
  // Rarity trim stripe.
  const trim = TRIM[look.rarity];
  if (trim) {
    ctx.strokeStyle = trim;
    ctx.lineWidth = line * (look.rarity === 'legendary' ? 1.1 : 0.8);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.58);
    ctx.lineTo(w, h * 0.58);
    ctx.stroke();
  }
  // Door seam and handle.
  if (shape.door !== undefined) {
    const dx = w * shape.door;
    ctx.strokeStyle = shade(look.paint, -0.45);
    ctx.lineWidth = line * 0.5;
    ctx.beginPath();
    ctx.moveTo(dx, h * 0.44);
    ctx.lineTo(dx, h * 0.71);
    ctx.stroke();
    ctx.fillStyle = shade(look.paint, -0.4);
    ctx.fillRect(dx + w * 0.03, h * 0.47, w * 0.04, h * 0.018);
  }
  // Side intake.
  if (shape.intake) {
    ctx.fillStyle = 'rgba(15,18,25,0.75)';
    roundedPath(ctx, scaled([[0.3, 0.52], [0.38, 0.5], [0.38, 0.62], [0.32, 0.62]], w, h), h * 0.02);
    ctx.fill();
  }
  // Wheel arches: dark cut-outs behind the tyres.
  ctx.fillStyle = '#12151b';
  for (const fx of shape.wheels) {
    ctx.beginPath();
    ctx.arc(fx * w, wheelY, wheelR * 1.16, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Hood scoop: painted box on the bonnet with a dark mouth facing forward.
  if (shape.scoop) {
    const pts = scaled(SCOOP, w, h);
    roundedPath(ctx, pts, h * 0.02);
    ctx.fillStyle = shade(look.paint, 0.12);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = line * 0.8;
    ctx.stroke();
    ctx.fillStyle = 'rgba(15,18,25,0.85)';
    roundedPath(ctx, scaled([[0.865, 0.37], [0.89, 0.37], [0.902, 0.415], [0.87, 0.415]], w, h), h * 0.01);
    ctx.fill();
  }

  // Windows: glass gradient and a reflection streak.
  for (const win of shape.windows) {
    const pts = scaled(win, w, h);
    const minX = Math.min(...pts.map((p) => p[0]));
    const minY = Math.min(...pts.map((p) => p[1]));
    const maxY = Math.max(...pts.map((p) => p[1]));
    roundedPath(ctx, pts, h * 0.02);
    const glass = ctx.createLinearGradient(0, minY, 0, maxY);
    glass.addColorStop(0, '#4b6584');
    glass.addColorStop(1, '#22324a');
    ctx.fillStyle = glass;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = line * 1.3;
    ctx.beginPath();
    ctx.moveTo(minX + w * 0.025, maxY);
    ctx.lineTo(minX + w * 0.07, minY);
    ctx.stroke();
    ctx.restore();
    roundedPath(ctx, pts, h * 0.02);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = line * 0.8;
    ctx.stroke();
  }

  // Lights: headlight at the front, tail light at the back.
  const front = spanAt(body, h * shape.lightY);
  if (front) {
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    if (shape.slimLights) ctx.ellipse(front[1] - w * 0.04, h * shape.lightY - h * 0.005, w * 0.035, h * 0.012, -0.25, 0, Math.PI * 2);
    else ctx.ellipse(front[1] - w * 0.022, h * shape.lightY, w * 0.02, h * 0.032, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e5484d';
    roundedPath(ctx, [[front[0] + 1, h * (shape.lightY - 0.035)], [front[0] + w * 0.03, h * (shape.lightY - 0.035)], [front[0] + w * 0.03, h * (shape.lightY + 0.035)], [front[0] + 1, h * (shape.lightY + 0.035)]], h * 0.01);
    ctx.fill();
  }

  // Body outline on top.
  roundedPath(ctx, body, radius);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = line;
  ctx.stroke();

  // Front splitter and rear diffuser: dark blades just under the bumpers.
  if (shape.splitter) {
    ctx.fillStyle = '#12151b';
    roundedPath(ctx, scaled([[0.84, 0.73], [0.985, 0.715], [0.985, 0.75], [0.84, 0.765]], w, h), h * 0.008);
    ctx.fill();
    roundedPath(ctx, scaled([[0.015, 0.71], [0.1, 0.72], [0.1, 0.76], [0.03, 0.76]], w, h), h * 0.008);
    ctx.fill();
  }

  // Wheels.
  const rim = look.rarity === 'legendary' ? ['#fff1b8', '#d39e00'] : ['#eef2f6', '#9aa4b2'];
  for (const fx of shape.wheels) {
    const cx = fx * w;
    ctx.fillStyle = TIRE;
    ctx.beginPath();
    ctx.arc(cx, wheelY, wheelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2b2f37';
    ctx.lineWidth = line * 0.6;
    ctx.beginPath();
    ctx.arc(cx, wheelY, wheelR * 0.82, 0, Math.PI * 2);
    ctx.stroke();
    const rg = ctx.createRadialGradient(cx - wheelR * 0.2, wheelY - wheelR * 0.2, wheelR * 0.05, cx, wheelY, wheelR * 0.6);
    rg.addColorStop(0, rim[0]!);
    rg.addColorStop(1, rim[1]!);
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, wheelY, wheelR * 0.58, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,68,80,0.75)';
    ctx.lineWidth = line * 0.7;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.moveTo(cx + Math.cos(a) * wheelR * 0.14, wheelY + Math.sin(a) * wheelR * 0.14);
      ctx.lineTo(cx + Math.cos(a) * wheelR * 0.52, wheelY + Math.sin(a) * wheelR * 0.52);
    }
    ctx.stroke();
    ctx.fillStyle = '#4b5563';
    ctx.beginPath();
    ctx.arc(cx, wheelY, wheelR * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = line;
    ctx.beginPath();
    ctx.arc(cx, wheelY, wheelR, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Rust patches and dents, shown over the car while it is damaged. Clipped to the body. */
export function paintRust(ctx: CanvasRenderingContext2D, family: CarFamily, w: number, h: number, seed: number): void {
  const shape = SHAPES[family];
  const body = scaled(shape.body, w, h);
  const rnd = seeded(seed);
  const between = (a: number, b: number) => a + (b - a) * rnd();
  ctx.save();
  roundedPath(ctx, body, h * shape.round);
  ctx.clip();
  let placed = 0;
  for (let i = 0; i < 80 && placed < 14; i++) {
    const x = between(w * 0.06, w * 0.94);
    const y = between(h * 0.28, h * 0.72);
    if (!pointInPolygon(body, x, y)) continue;
    // A patch is a cluster of overlapping blobs: dark core, orange edge, crisp outline.
    const r = between(h * 0.03, h * 0.06);
    const blobs = 3 + Math.floor(rnd() * 3);
    for (let k = 0; k < blobs; k++) {
      const bx = x + (rnd() - 0.5) * r * 1.6;
      const by = y + (rnd() - 0.5) * r * 1.1;
      const br = r * (0.5 + 0.5 * rnd());
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, 'rgba(84,42,18,0.95)');
      g.addColorStop(0.7, 'rgba(150,80,34,0.92)');
      g.addColorStop(0.9, 'rgba(176,98,42,0.85)');
      g.addColorStop(1, 'rgba(176,98,42,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
    placed++;
  }
  // Dents.
  ctx.strokeStyle = 'rgba(30,36,48,0.5)';
  ctx.lineWidth = Math.max(2, w / 90);
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const x = between(w * 0.2, w * 0.8);
    const y = between(h * 0.5, h * 0.66);
    if (!pointInPolygon(body, x, y)) continue;
    ctx.beginPath();
    ctx.arc(x, y, h * 0.05, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  ctx.restore();
}

/** Mud splotches that sit inside the body outline. */
export function mudSpots(family: CarFamily, w: number, h: number, seed: number): { x: number; y: number; r: number }[] {
  const rnd = seeded(seed * 7 + 3);
  const body = scaled(SHAPES[family].body, w, h);
  const spots: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < 200 && spots.length < 40; i++) {
    const x = rnd() * w;
    const y = h * (0.2 + 0.58 * rnd());
    if (pointInPolygon(body, x, y)) spots.push({ x, y, r: h * (0.02 + 0.04 * rnd()) });
  }
  return spots;
}
