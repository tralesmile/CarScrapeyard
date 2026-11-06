// Yard backdrop painted with the Canvas 2D API (P0.14h): sky, sun, clouds, layered hills, junk piles,
// fence, ground and the work bay. Antialiased and with soft gradients on every renderer, unlike WebGL
// Graphics. Pure apart from the canvas context; the layout helpers are unit-tested.

export interface BayRect {
  /** Centre x, centre y, width, height and corner radius, in canvas px. */
  cx: number;
  cy: number;
  w: number;
  h: number;
  r: number;
}

export interface BackdropLayout {
  /** Canvas size in px. */
  w: number;
  h: number;
  /** y of the horizon (where the ground starts), px. */
  horizon: number;
  /** Canvas px per CSS px (device pixel ratio). */
  s: number;
  bay: BayRect;
}

export interface JunkPile {
  x: number;
  /** Half width and height in px. */
  hw: number;
  h: number;
  color: string;
  /** Tyres resting on the pile: x, y offsets from the pile's base centre, px. */
  tyres: [number, number][];
  /** x offset of the flat scrap panel from the pile's centre, px. */
  panel: number;
}

/**
 * Junk piles behind the fence: big ones at both edges and a small one between. The right pile sits left of the
 * customer's spot (mirror of the barn, about 0.88 of the width) and keeps its tyres and panel away from it, so the
 * customer reads clearly against plain hillside.
 */
export function junkPiles(w: number, horizon: number, s: number): JunkPile[] {
  void horizon;
  return [
    { x: w * 0.12, hw: s * 80, h: s * 58, color: '#7d6a5a', tyres: [[-s * 22, -s * 18], [s * 12, -s * 32]], panel: s * 20 },
    { x: w * 0.32, hw: s * 56, h: s * 36, color: '#8e7967', tyres: [[s * 8, -s * 14]], panel: -s * 18 },
    { x: w * 0.88 - s * 70, hw: s * 86, h: s * 62, color: '#7a6656', tyres: [[-s * 30, -s * 22], [-s * 8, -s * 36]], panel: -s * 48 },
  ];
}

/** Hill ridge height above the horizon at x (px) for a layer: a sum of soft waves, always > 0. */
export function hillHeight(x: number, w: number, s: number, layer: 0 | 1): number {
  const t = x / w;
  if (layer === 0) return s * (70 + 22 * Math.sin(t * 5.1 + 0.6) + 12 * Math.sin(t * 11.3 + 2.1));
  return s * (32 + 14 * Math.sin(t * 7.4 + 1.9) + 8 * Math.sin(t * 15.7 + 0.3));
}

/** Fence posts' x positions (px). */
export function fencePosts(w: number, s: number): number[] {
  const xs: number[] = [];
  for (let x = s * 10; x < w; x += s * 28) xs.push(x);
  return xs;
}

function ridge(ctx: CanvasRenderingContext2D, L: BackdropLayout, layer: 0 | 1, top: string, bottom: string) {
  const { w, horizon, s } = L;
  ctx.beginPath();
  ctx.moveTo(0, horizon + 1);
  const step = Math.max(2, s * 4);
  for (let x = 0; x <= w + step; x += step) ctx.lineTo(x, horizon - hillHeight(x, w, s, layer));
  ctx.lineTo(w, horizon + 1);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, horizon - s * 90, 0, horizon);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fill();
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, k: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(x, y, k * 34, k * 11, 0, 0, Math.PI * 2);
  ctx.ellipse(x - k * 14, y - k * 7, k * 15, k * 12, 0, 0, Math.PI * 2);
  ctx.ellipse(x + k * 10, y - k * 10, k * 18, k * 14, 0, 0, Math.PI * 2);
  ctx.fill();
}

function tyre(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = '#23262d';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a5f69';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = r * 0.18;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.75, Math.PI * 1.1, Math.PI * 1.6);
  ctx.stroke();
}

export function paintBackdrop(ctx: CanvasRenderingContext2D, L: BackdropLayout): void {
  const { w, h, horizon, s } = L;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Sky: blue at the top, warm haze at the horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#6fbfe0');
  sky.addColorStop(0.65, '#bfe0e6');
  sky.addColorStop(1, '#f6d8a8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon + 1);

  // Sun with a soft glow.
  const sx = w * 0.8;
  const sy = horizon * 0.42;
  const glow = ctx.createRadialGradient(sx, sy, s * 20, sx, sy, s * 70);
  glow.addColorStop(0, 'rgba(255,236,170,0.55)');
  glow.addColorStop(1, 'rgba(255,236,170,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - s * 70, sy - s * 70, s * 140, s * 140);
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(sx, sy, s * 24, 0, Math.PI * 2);
  ctx.fill();

  cloud(ctx, w * 0.24, horizon * 0.3, s);
  cloud(ctx, w * 0.58, horizon * 0.16, s * 0.7);

  // Two hill layers: far and hazy, then near and warm.
  ridge(ctx, L, 0, '#d7b996', '#c9a682');
  ridge(ctx, L, 1, '#c09670', '#b0855e');

  // Junk piles: rounded mounds with a darker base, scrap panels and tyres.
  for (const p of junkPiles(w, horizon, s)) {
    ctx.beginPath();
    ctx.moveTo(p.x - p.hw, horizon + 1);
    ctx.quadraticCurveTo(p.x - p.hw * 0.45, horizon - p.h * 0.9, p.x, horizon - p.h);
    ctx.quadraticCurveTo(p.x + p.hw * 0.45, horizon - p.h * 0.9, p.x + p.hw, horizon + 1);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, horizon - p.h, 0, horizon);
    g.addColorStop(0, p.color);
    g.addColorStop(1, '#5e4e41');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,36,48,0.35)';
    ctx.lineWidth = s * 1.5;
    ctx.stroke();
    // A couple of flat scrap panels.
    ctx.fillStyle = 'rgba(160,170,182,0.55)';
    ctx.save();
    ctx.translate(p.x + p.panel, horizon - p.h * 0.45);
    ctx.rotate(-0.35);
    ctx.fillRect(-s * 14, -s * 4, s * 28, s * 8);
    ctx.restore();
    for (const [dx, dy] of p.tyres) tyre(ctx, p.x + dx, horizon + dy, s * 7.5);
  }

  // Ground: warm dirt, darker towards the bottom, with gravel patches and an oil stain.
  const ground = ctx.createLinearGradient(0, horizon, 0, h);
  ground.addColorStop(0, '#b08d66');
  ground.addColorStop(0.4, '#a4835f');
  ground.addColorStop(1, '#8d6e4d');
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.fillStyle = 'rgba(110,84,58,0.35)';
  for (let i = 0; i < 18; i++) {
    const x = ((i * 97) % 100) / 100;
    const y = ((i * 61) % 100) / 100;
    ctx.beginPath();
    ctx.ellipse(w * x, horizon + (h - horizon) * y, s * 16, s * 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(40,32,28,0.22)';
  ctx.beginPath();
  ctx.ellipse(w * 0.18, horizon + (h - horizon) * 0.55, s * 26, s * 7, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Fence: two rails and shaded posts.
  ctx.strokeStyle = '#5b4636';
  ctx.lineWidth = s * 2;
  for (const y of [horizon - s * 18, horizon - s * 6]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  for (const x of fencePosts(w, s)) {
    ctx.fillStyle = '#6e5442';
    ctx.beginPath();
    ctx.roundRect(x, horizon - s * 29, s * 5, s * 29, [s * 2, s * 2, 0, 0]);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(x + s * 0.8, horizon - s * 27, s * 1.2, s * 25);
  }

  // Work bay: concrete pad with a yellow safety line and a soft drop shadow.
  const b = L.bay;
  const x0 = b.cx - b.w / 2;
  const y0 = b.cy - b.h / 2;
  ctx.fillStyle = 'rgba(40,30,20,0.25)';
  ctx.beginPath();
  ctx.roundRect(x0 + s * 2, y0 + s * 4, b.w, b.h, b.r);
  ctx.fill();
  const pad = ctx.createLinearGradient(0, y0, 0, y0 + b.h);
  pad.addColorStop(0, '#cfd4db');
  pad.addColorStop(1, '#b3b9c2');
  ctx.fillStyle = pad;
  ctx.beginPath();
  ctx.roundRect(x0, y0, b.w, b.h, b.r);
  ctx.fill();
  ctx.strokeStyle = '#f5b700';
  ctx.lineWidth = s * 3;
  ctx.beginPath();
  ctx.roundRect(x0 + s * 6, y0 + s * 6, b.w - s * 12, b.h - s * 12, Math.max(0, b.r - s * 4));
  ctx.stroke();
}
