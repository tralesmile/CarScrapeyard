// Yard backdrop painted with the Canvas 2D API (P0.14h): sky, sun, clouds, layered hills, junk piles,
// fence, ground and the work bay. Antialiased and with soft gradients on every renderer, unlike WebGL
// Graphics. Pure apart from the canvas context; the layout helpers are unit-tested. Motor City (P1.3d3) paints the
// same yard in steel blue: a dusk sky, a skyline instead of hills, asphalt instead of dirt and a chain-link fence.

import type { CityId } from '../core/config';

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
  /** City the yard is in (default Rust Valley). */
  city?: CityId;
}

/** The yard's colours per city (P1.3d3). */
export interface YardTheme {
  sky: [string, string, string];
  sun: string;
  sunGlow: string;
  clouds: boolean;
  ground: [string, string, string];
  patch: string;
  stain: string;
  rail: string;
  post: string;
  /** Chain-link mesh between the rails (Motor City), or none (wooden fence). */
  mesh: string | null;
  pileBase: string;
}

export const YARD_THEMES: Record<CityId, YardTheme> = {
  rustValley: {
    sky: ['#6fbfe0', '#bfe0e6', '#f6d8a8'],
    sun: '#ffe9a8',
    sunGlow: '255,236,170',
    clouds: true,
    ground: ['#b08d66', '#a4835f', '#8d6e4d'],
    patch: 'rgba(110,84,58,0.35)',
    stain: 'rgba(40,32,28,0.22)',
    rail: '#5b4636',
    post: '#6e5442',
    mesh: null,
    pileBase: '#5e4e41',
  },
  motorCity: {
    sky: ['#3d5a80', '#8fb3d1', '#f2c38b'],
    sun: '#ffc47a',
    sunGlow: '255,190,120',
    clouds: false,
    ground: ['#7c8796', '#6c7786', '#545e6c'],
    patch: 'rgba(60,68,82,0.35)',
    stain: 'rgba(20,24,32,0.28)',
    rail: '#5d6674',
    post: '#8a94a3',
    mesh: 'rgba(200,210,222,0.35)',
    pileBase: '#4a4f58',
  },
};

export interface Tower {
  /** Left edge, width and height above the horizon, px. */
  x: number;
  w: number;
  h: number;
  /** 0 = far and hazy, 1 = near with lit windows. */
  layer: 0 | 1;
  color: string;
}

/**
 * Motor City's skyline behind the yard fence (P1.3d3): a far hazy row and a near row of towers across the whole width.
 * Heights stay under 80% of the horizon so the sky shows above the tallest tower on every phone.
 */
export function skylineTowers(w: number, horizon: number, s: number): Tower[] {
  const out: Tower[] = [];
  const cap = horizon * 0.8;
  const far = ['#9fb4cb', '#a9bdd2', '#95abc3'];
  const near = ['#4c6a8a', '#3e5a78', '#5b7da0', '#465f7c'];
  for (const layer of [0, 1] as const) {
    let x = layer === 0 ? -s * 6 : -s * 14;
    let i = 0;
    while (x < w) {
      const tw = s * (layer === 0 ? 30 + 12 * Math.abs(Math.sin(i * 2.3 + 0.4)) : 34 + 16 * Math.abs(Math.sin(i * 1.7 + 1.1)));
      const base = layer === 0 ? 96 + 40 * Math.abs(Math.sin(i * 1.3 + 0.2)) : 52 + 46 * Math.abs(Math.sin(i * 2.9 + 0.7));
      const th = Math.min(cap, s * base);
      const pal = layer === 0 ? far : near;
      out.push({ x, w: tw, h: th, layer, color: pal[i % pal.length]! });
      x += tw + s * (layer === 0 ? 2 : 6 + 4 * (i % 3));
      i++;
    }
    // The row's last tower reaches past the right edge (the street gap after it could leave a sliver of sky).
    const last = out[out.length - 1]!;
    last.w = Math.max(last.w, w - last.x + s * 2);
  }
  return out;
}

function skyline(ctx: CanvasRenderingContext2D, L: BackdropLayout) {
  const { horizon, s } = L;
  for (const t of skylineTowers(L.w, horizon, s)) {
    const top = horizon - t.h;
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.roundRect(t.x, top, t.w, t.h + 1, [s * 2, s * 2, 0, 0]);
    ctx.fill();
    if (t.layer === 0) continue;
    // A light edge on the sunny side, an antenna on the tallest, and a grid of windows (some lit).
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(t.x + t.w - s * 3, top + s * 2, s * 2, t.h - s * 2);
    if (t.h > s * 85) {
      ctx.fillStyle = t.color;
      ctx.fillRect(t.x + t.w / 2 - s, top - s * 12, s * 2, s * 12);
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc(t.x + t.w / 2, top - s * 12, s * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    const cols = Math.max(1, Math.floor((t.w - s * 8) / (s * 8)));
    const rows = Math.max(0, Math.floor((t.h - s * 34) / (s * 10)));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const lit = (Math.floor(t.x) + r * 7 + c * 13) % 5 === 0;
        ctx.fillStyle = lit ? 'rgba(255,226,154,0.9)' : 'rgba(20,30,48,0.35)';
        ctx.fillRect(t.x + s * 5 + c * s * 8, top + s * 6 + r * s * 10, s * 4, s * 5);
      }
  }
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
  const city = L.city ?? 'rustValley';
  const T = YARD_THEMES[city];

  // Sky: blue at the top, warm haze at the horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, T.sky[0]);
  sky.addColorStop(0.65, T.sky[1]);
  sky.addColorStop(1, T.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon + 1);

  // Sun with a soft glow.
  const sx = w * 0.8;
  const sy = horizon * (city === 'motorCity' ? 0.55 : 0.42);
  const glow = ctx.createRadialGradient(sx, sy, s * 20, sx, sy, s * 70);
  glow.addColorStop(0, `rgba(${T.sunGlow},0.55)`);
  glow.addColorStop(1, `rgba(${T.sunGlow},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(sx - s * 70, sy - s * 70, s * 140, s * 140);
  ctx.fillStyle = T.sun;
  ctx.beginPath();
  ctx.arc(sx, sy, s * 24, 0, Math.PI * 2);
  ctx.fill();

  if (T.clouds) {
    cloud(ctx, w * 0.24, horizon * 0.3, s);
    cloud(ctx, w * 0.58, horizon * 0.16, s * 0.7);
  }

  if (city === 'motorCity') skyline(ctx, L);
  else {
    // Two hill layers: far and hazy, then near and warm.
    ridge(ctx, L, 0, '#d7b996', '#c9a682');
    ridge(ctx, L, 1, '#c09670', '#b0855e');
  }

  // Junk piles: rounded mounds with a darker base, scrap panels and tyres.
  for (const p of junkPiles(w, horizon, s)) {
    ctx.beginPath();
    ctx.moveTo(p.x - p.hw, horizon + 1);
    ctx.quadraticCurveTo(p.x - p.hw * 0.45, horizon - p.h * 0.9, p.x, horizon - p.h);
    ctx.quadraticCurveTo(p.x + p.hw * 0.45, horizon - p.h * 0.9, p.x + p.hw, horizon + 1);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, horizon - p.h, 0, horizon);
    g.addColorStop(0, p.color);
    g.addColorStop(1, T.pileBase);
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
  ground.addColorStop(0, T.ground[0]);
  ground.addColorStop(0.4, T.ground[1]);
  ground.addColorStop(1, T.ground[2]);
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.fillStyle = T.patch;
  for (let i = 0; i < 18; i++) {
    const x = ((i * 97) % 100) / 100;
    const y = ((i * 61) % 100) / 100;
    ctx.beginPath();
    ctx.ellipse(w * x, horizon + (h - horizon) * y, s * 16, s * 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = T.stain;
  ctx.beginPath();
  ctx.ellipse(w * 0.18, horizon + (h - horizon) * 0.55, s * 26, s * 7, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Fence: two rails and shaded posts (chain-link mesh between them in Motor City).
  if (T.mesh) {
    ctx.strokeStyle = T.mesh;
    ctx.lineWidth = s * 0.8;
    const top = horizon - s * 26;
    const hgt = s * 26;
    ctx.beginPath();
    for (let x = -hgt; x < w + hgt; x += s * 7) {
      ctx.moveTo(x, top);
      ctx.lineTo(x + hgt, top + hgt);
      ctx.moveTo(x + hgt, top);
      ctx.lineTo(x, top + hgt);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = T.rail;
  ctx.lineWidth = s * 2;
  for (const y of [horizon - s * 18, horizon - s * 6]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  for (const x of fencePosts(w, s)) {
    ctx.fillStyle = T.post;
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
