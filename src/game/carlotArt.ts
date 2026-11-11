// Used Car Lot backdrop painted with the Canvas 2D API (P1.2b): a sunny sky over a far skyline, a glass showroom with
// an orange roof band lettered as the lot sign, strings of pennant flags, a palm-free forecourt of warm asphalt with
// white bay lines, and a round display platform the car being refurbished stands on. Pure apart from the canvas
// context; the layout helpers are unit-tested. Motor City (P1.3d3b): a dusk sky over taller towers with lit windows.

import type { CityId, Condition, LotBuyerKind } from '../core/config';
import { t, type BaseKey } from '../i18n';
import { BUYER_W, OUTLINE, person } from './buyerArt';

export interface LotLayout {
  /** Canvas size in px. */
  w: number;
  h: number;
  /** y where the buildings meet the forecourt, px. */
  floorY: number;
  /** Canvas px per CSS px. */
  s: number;
  /** The car on the display platform: centre x, y of the wheels' contact line, car width (px). */
  stage: { cx: number; groundY: number; carW: number };
  /** Lettering on the showroom's roof band (kept short; drawn with the display font). */
  sign: string;
  /** Lowest y the HUD and the spot thumbnails reach, px: the sign stays below it. */
  reservedTop: number;
  /** Highest y the tallest car's roof reaches, px: the sign stays above it. */
  roofY: number;
  /** City the business is in (default Rust Valley). */
  city?: CityId;
  /** Night-time look (P1.3d3c; only cities with one change). */
  night?: boolean;
}

/** A skyline row: colour, min height, height variation and min width (CSS px). */
export type SkylineRow = readonly [color: string, hMin: number, hVar: number, wMin: number];

/** The lot's colours per city (P1.3d3b). */
export interface LotTheme {
  sky: [string, string, string];
  sunGlow: string;
  rows: readonly SkylineRow[];
  /** Lit windows on the near row (Motor City at dusk), or none. */
  windows: string | null;
  forecourt: [string, string];
  kerb: string;
  showroomKerb: string;
  /** Showroom glass, top to bottom (lit warm from inside at night). */
  glass: [string, string];
  /** Night (P1.3d3c): a moon instead of the sun, and a neon glow around the sign; null by day. */
  night: { moon: string; signGlow: string } | null;
}

export const LOT_THEMES: Record<CityId, LotTheme> = {
  rustValley: {
    sky: ['#5fb4e0', '#a9dcf0', '#f6e2b8'],
    sunGlow: '255,236,180',
    rows: [
      ['#b9cfdc', 34, 50, 26],
      ['#93aec0', 18, 34, 34],
    ],
    windows: null,
    forecourt: ['#6b6f78', '#4a4e57'],
    kerb: '#d9d4c7',
    showroomKerb: '#c4b7a3',
    glass: ['#2c4a63', '#4f7894'],
    night: null,
  },
  motorCity: {
    sky: ['#3d5a80', '#8fb3d1', '#f2c38b'],
    sunGlow: '255,190,120',
    rows: [
      ['#5e7a9c', 120, 75, 28],
      ['#3e5a78', 44, 60, 34],
    ],
    windows: 'rgba(255,214,140,0.85)',
    forecourt: ['#5a6475', '#3c4452'],
    kerb: '#b8c2ce',
    showroomKerb: '#8a94a3',
    glass: ['#2c4a63', '#4f7894'],
    night: null,
  },
};

/** Motor City after dark (P1.3d3c): navy sky, dark towers with lit windows, a lit showroom and a glowing sign.
 * Row sizes are the day's, so the skyline's layout is the same by day and night. */
export const LOT_NIGHT: LotTheme = {
  ...LOT_THEMES.motorCity,
  sky: ['#0a1230', '#1c2856', '#4b3a72'],
  sunGlow: '190,205,255',
  rows: LOT_THEMES.motorCity.rows.map(([, ...rest], i) => [i === 0 ? '#2b3762' : '#18213e', ...rest] as const),
  windows: 'rgba(255,212,128,0.95)',
  forecourt: ['#3e4656', '#262c37'],
  kerb: '#8a94a3',
  showroomKerb: '#5d6676',
  glass: ['#7a5a3a', '#e2b27a'],
  night: { moon: '#f1f4ff', signGlow: '#ff9a4f' },
};

export function lotTheme(L: Pick<LotLayout, 'city' | 'night'>): LotTheme {
  const city = L.city ?? 'rustValley';
  return L.night && city === 'motorCity' ? LOT_NIGHT : LOT_THEMES[city];
}

/**
 * The skyline's buildings (left x, width, height, px) for each row, covering the whole width. Heights stay under 80% of
 * the horizon so some sky shows above the tallest tower.
 */
export function lotSkyline(L: Pick<LotLayout, 'w' | 's' | 'city' | 'floorY'>): { x: number; w: number; h: number; row: number }[] {
  const s = L.s;
  const out: { x: number; w: number; h: number; row: number }[] = [];
  lotTheme(L).rows.forEach(([, hMin, hVar, wMin], row) => {
    let x = -10 * s;
    let i = 0;
    while (x < L.w) {
      const bw = (wMin + ((i * 53) % 29)) * s;
      out.push({ x, w: bw - 2 * s, h: Math.min(L.floorY * 0.8, (hMin + ((i * 71) % hVar)) * s), row });
      x += bw;
      i++;
    }
  });
  return out;
}

/** Spot thumbnails above the forecourt (same size as the garage's bay row). */
export { BAY_ROW as SPOT_ROW, BAY_ROW_BOTTOM as SPOT_ROW_BOTTOM, GARAGE_AREA_TOP as LOT_AREA_TOP } from './garageArt';

/** Pennant colours along the bunting (brand palette). */
export const PENNANTS = ['#e8762b', '#f5b700', '#3b82f6', '#3bc45a', '#e5484d', '#fbf3e4'] as const;

/** Rust patches and dents per condition grade: rough cars look rough, mint ones nearly clean. */
export const CONDITION_RUST: Record<Condition, { patches: number; dents: number }> = {
  1: { patches: 12, dents: 3 },
  2: { patches: 9, dents: 2 },
  3: { patches: 6, dents: 1 },
  4: { patches: 3, dents: 1 },
  5: { patches: 1, dents: 0 },
};

/** What a walk-up buyer says while looking a car over (P1.2c): a happy line when it is their kind of car. */
export const LOT_BUYER_LINES: Record<LotBuyerKind, { likes: readonly BaseKey[]; plain: readonly BaseKey[] }> = {
  family: { likes: ['lot.say.family.likes.0', 'lot.say.family.likes.1'], plain: ['lot.say.family.plain.0', 'lot.say.family.plain.1'] },
  collector: { likes: ['lot.say.collector.likes.0', 'lot.say.collector.likes.1'], plain: ['lot.say.collector.plain.0', 'lot.say.collector.plain.1'] },
  speed: { likes: ['lot.say.speed.likes.0', 'lot.say.speed.likes.1'], plain: ['lot.say.speed.plain.0', 'lot.say.speed.plain.1'] },
  tradie: { likes: ['lot.say.tradie.likes.0', 'lot.say.tradie.likes.1'], plain: ['lot.say.tradie.plain.0', 'lot.say.tradie.plain.1'] },
  influencer: { likes: ['lot.say.influencer.likes.0', 'lot.say.influencer.likes.1'], plain: ['lot.say.influencer.plain.0', 'lot.say.influencer.plain.1'] },
};

/** The buyer's line for this car; `bonus > 0` means they like it. Stable per car so it doesn't flicker. */
export function lotBuyerLine(kind: LotBuyerKind, bonus: number, carId: number): string {
  const set = bonus > 0 ? LOT_BUYER_LINES[kind].likes : LOT_BUYER_LINES[kind].plain;
  return t(set[Math.abs(carId * 7) % set.length] ?? set[0]!);
}

/** "★★★☆☆" for a condition grade. */
export function conditionStars(c: Condition): string {
  return '★'.repeat(c) + '☆'.repeat(5 - c);
}

/**
 * The showroom's roof band, which carries the lot sign: below the HUD and the spot row, above the tallest car's roof.
 * `sign` is false when the gap is too small for lettering (the band is then a thin strip).
 */
export function signBand(L: LotLayout): { x: number; y: number; w: number; h: number; sign: boolean } {
  const s = L.s;
  const gap = L.roofY - L.reservedTop;
  const want = 28 * s;
  const sign = gap >= 20 * s;
  const h = sign ? Math.min(want, gap - 4 * s) : Math.max(4 * s, Math.min(8 * s, gap - 2 * s));
  const y = Math.max(L.reservedTop + 2 * s, L.roofY - h - 2 * s - Math.max(0, gap - h - 4 * s) * 0.5);
  const w = Math.min(L.w * 0.86, 360 * s);
  return { x: (L.w - w) / 2, y, w, h, sign };
}

/** Showroom box: from the sign band down to the forecourt, centred behind the platform. */
export function showroomRect(L: LotLayout): { x: number; y: number; w: number; h: number } {
  const b = signBand(L);
  const y = b.y + b.h;
  return { x: b.x + 6 * L.s, y, w: b.w - 12 * L.s, h: Math.max(0, L.floorY - y) };
}

/** Display platform under the car: an ellipse on the forecourt. */
export function platformEllipse(L: LotLayout): { cx: number; cy: number; rx: number; ry: number } {
  return { cx: L.stage.cx, cy: L.stage.groundY + 4 * L.s, rx: L.stage.carW * 0.56, ry: L.stage.carW * 0.075 };
}

/** Points where the bunting hangs: a sagging string between the two poles, flags every `step` px. */
export function buntingFlags(L: LotLayout): { x: number; y: number }[] {
  const s = L.s;
  // Strung above the sign band (painted before it, so the sign covers any flag that hangs low on a short screen).
  const sag = 8 * s;
  const y0 = Math.max(L.reservedTop + 2 * s, signBand(L).y - 17 * s - sag);
  const step = 22 * s;
  const out: { x: number; y: number }[] = [];
  for (let x = step / 2; x < L.w; x += step) {
    const t = x / L.w;
    out.push({ x, y: y0 + sag * 4 * t * (1 - t) });
  }
  return out;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function sky(ctx: CanvasRenderingContext2D, L: LotLayout) {
  const T = lotTheme(L);
  const g = ctx.createLinearGradient(0, 0, 0, L.floorY);
  g.addColorStop(0, T.sky[0]);
  g.addColorStop(0.7, T.sky[1]);
  g.addColorStop(1, T.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L.w, L.floorY + 1);
  // Sun glow on the right.
  const sx = L.w * 0.84;
  const sy = L.reservedTop + (L.floorY - L.reservedTop) * 0.25;
  if (T.night) {
    // Moonlight: a soft halo and a small moon (no blinding sun-white centre behind the towers).
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, 60 * L.s);
    halo.addColorStop(0, `rgba(${T.sunGlow},0.4)`);
    halo.addColorStop(1, `rgba(${T.sunGlow},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, L.w, L.floorY);
    ctx.fillStyle = T.night.moon;
    ctx.beginPath();
    ctx.arc(sx, sy, 11 * L.s, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, 90 * L.s);
  sun.addColorStop(0, 'rgba(255,246,214,0.95)');
  sun.addColorStop(0.25, `rgba(${T.sunGlow},0.6)`);
  sun.addColorStop(1, `rgba(${T.sunGlow},0)`);
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, L.w, L.floorY);
}

/** Two rows of city blocks on the horizon: pale and far, then darker and nearer (Motor City: towers with lit windows). */
function skyline(ctx: CanvasRenderingContext2D, L: LotLayout) {
  const s = L.s;
  const T = lotTheme(L);
  const rows = T.rows.length;
  for (const b of lotSkyline(L)) {
    ctx.fillStyle = T.rows[b.row]![0];
    const top = L.floorY - b.h;
    ctx.fillRect(b.x, top, b.w, b.h);
    if (!T.windows || b.row !== rows - 1) continue;
    ctx.fillStyle = T.windows;
    const cols = Math.max(1, Math.floor((b.w - 4 * s) / (7 * s)));
    for (let r = 0, y = top + 5 * s; y < L.floorY - 10 * s; r++, y += 8 * s)
      for (let c = 0; c < cols; c++) if ((r * 3 + c * 5 + Math.round(b.x / s)) % 4 !== 0) ctx.fillRect(b.x + 3 * s + c * 7 * s, y, 3 * s, 4 * s);
  }
}

function showroom(ctx: CanvasRenderingContext2D, L: LotLayout) {
  const s = L.s;
  const r = showroomRect(L);
  if (r.h <= 2 * s) return;
  // Glass front with mullions and a soft reflection.
  const T = lotTheme(L);
  const glass = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  glass.addColorStop(0, T.glass[0]);
  glass.addColorStop(1, T.glass[1]);
  ctx.fillStyle = glass;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.moveTo(r.x + r.w * 0.12, r.y);
  ctx.lineTo(r.x + r.w * 0.26, r.y);
  ctx.lineTo(r.x + r.w * 0.16, r.y + r.h);
  ctx.lineTo(r.x + r.w * 0.02, r.y + r.h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d7dde4';
  const panes = 6;
  for (let i = 0; i <= panes; i++) ctx.fillRect(r.x + (r.w / panes) * i - 2 * s, r.y, 4 * s, r.h);
  // Base kerb of the building.
  ctx.fillStyle = T.showroomKerb;
  ctx.fillRect(r.x - 4 * s, L.floorY - 6 * s, r.w + 8 * s, 6 * s);
}

function sign(ctx: CanvasRenderingContext2D, L: LotLayout) {
  const s = L.s;
  const b = signBand(L);
  const glow = lotTheme(L).night?.signGlow;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  roundRect(ctx, b.x + 2 * s, b.y + 3 * s, b.w, b.h, 6 * s);
  ctx.fill();
  if (glow) {
    // Neon halo behind the band at night (the band and its lettering stay the same, so they read as by day).
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 16 * s;
    ctx.fillStyle = glow;
    roundRect(ctx, b.x, b.y, b.w, b.h, 6 * s);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#e8762b';
  roundRect(ctx, b.x, b.y, b.w, b.h, 6 * s);
  ctx.fill();
  ctx.strokeStyle = '#1e2430';
  ctx.lineWidth = 2.5 * s;
  ctx.stroke();
  if (!b.sign) return;
  ctx.fillStyle = '#fbf3e4';
  ctx.strokeStyle = '#1e2430';
  ctx.lineWidth = 4 * s;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(Math.min(b.h * 0.7, 20 * s))}px "Lilita One", sans-serif`;
  const tx = L.w / 2;
  const ty = b.y + b.h / 2 + s;
  ctx.strokeText(L.sign, tx, ty);
  ctx.fillText(L.sign, tx, ty);
  // Price-tag icons at both ends of the band.
  for (const x of [b.x + 16 * s, b.x + b.w - 16 * s]) {
    ctx.fillStyle = '#f5b700';
    ctx.beginPath();
    ctx.arc(x, ty - s, Math.min(6 * s, b.h * 0.22), 0, Math.PI * 2);
    ctx.fill();
  }
}

function bunting(ctx: CanvasRenderingContext2D, L: LotLayout) {
  const s = L.s;
  const flags = buntingFlags(L);
  if (flags.length < 2) return;
  ctx.strokeStyle = 'rgba(30,36,48,0.7)';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(0, flags[0]!.y - 2 * s);
  for (const f of flags) ctx.lineTo(f.x, f.y);
  ctx.lineTo(L.w, flags[flags.length - 1]!.y - 2 * s);
  ctx.stroke();
  flags.forEach((f, i) => {
    ctx.fillStyle = PENNANTS[i % PENNANTS.length]!;
    ctx.beginPath();
    ctx.moveTo(f.x - 7 * s, f.y);
    ctx.lineTo(f.x + 7 * s, f.y);
    ctx.lineTo(f.x, f.y + 15 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,36,48,0.55)';
    ctx.lineWidth = 1 * s;
    ctx.stroke();
  });
}

function forecourt(ctx: CanvasRenderingContext2D, L: LotLayout) {
  const s = L.s;
  const T = lotTheme(L);
  const g = ctx.createLinearGradient(0, L.floorY, 0, L.h);
  g.addColorStop(0, T.forecourt[0]);
  g.addColorStop(1, T.forecourt[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, L.floorY, L.w, L.h - L.floorY);
  // Kerb along the back.
  ctx.fillStyle = T.kerb;
  ctx.fillRect(0, L.floorY, L.w, 4 * s);
  // Angled white bay lines on both sides of the platform, in perspective.
  ctx.strokeStyle = 'rgba(251,243,228,0.75)';
  ctx.lineWidth = 3 * s;
  const top = L.floorY + 8 * s;
  const bottom = Math.min(L.h, L.stage.groundY + 70 * s);
  for (let i = -4; i <= 4; i++) {
    if (i === 0) continue;
    const xTop = L.w / 2 + i * 46 * s;
    const xBottom = L.w / 2 + i * 92 * s;
    ctx.beginPath();
    ctx.moveTo(xTop, top);
    ctx.lineTo(xBottom, bottom);
    ctx.stroke();
  }
  // Oil-stain speckles for texture.
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let i = 0; i < 26; i++) {
    const x = ((i * 137) % 997) / 997;
    const y = ((i * 211) % 991) / 991;
    ctx.beginPath();
    ctx.ellipse(x * L.w, L.floorY + 20 * s + y * (L.h - L.floorY), (6 + (i % 5) * 3) * s, (2 + (i % 3)) * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function platform(ctx: CanvasRenderingContext2D, L: LotLayout) {
  const s = L.s;
  const p = platformEllipse(L);
  // Side of the disc, then the top with a ring.
  ctx.fillStyle = '#2b2f36';
  ctx.beginPath();
  ctx.ellipse(p.cx, p.cy + 6 * s, p.rx, p.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  const top = ctx.createLinearGradient(p.cx - p.rx, 0, p.cx + p.rx, 0);
  top.addColorStop(0, '#9aa3ae');
  top.addColorStop(0.5, '#d4dae1');
  top.addColorStop(1, '#9aa3ae');
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.ellipse(p.cx, p.cy, p.rx, p.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8762b';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.ellipse(p.cx, p.cy, p.rx * 0.9, p.ry * 0.78, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#1e2430';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.ellipse(p.cx, p.cy, p.rx, p.ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** Flag poles at both edges holding the bunting. */
function poles(ctx: CanvasRenderingContext2D, L: LotLayout) {
  const s = L.s;
  const flags = buntingFlags(L);
  const y = (flags[0]?.y ?? L.floorY) - 6 * s;
  ctx.fillStyle = '#d7dde4';
  ctx.strokeStyle = '#1e2430';
  ctx.lineWidth = 1.5 * s;
  for (const x of [4 * s, L.w - 10 * s]) {
    ctx.fillRect(x, y, 6 * s, L.floorY + 10 * s - y);
    ctx.strokeRect(x, y, 6 * s, L.floorY + 10 * s - y);
  }
}

export function paintLotBackdrop(ctx: CanvasRenderingContext2D, L: LotLayout): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  sky(ctx, L);
  skyline(ctx, L);
  showroom(ctx, L);
  forecourt(ctx, L);
  poles(ctx, L);
  bunting(ctx, L);
  sign(ctx, L);
  platform(ctx, L);
}

/** The Detailer (P1.2b): a green polo, a cap worn backwards, a spray bottle and a polishing cloth. */
export function paintDetailer(ctx: CanvasRenderingContext2D): void {
  const cx = BUYER_W / 2;
  const { headY, headR } = person(ctx, cx, 1, { shirt: '#3bc45a', pants: '#374151', skin: '#e0ac85', hair: '#3f2a1d' });
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUTLINE;
  // Cap worn backwards (peak to the left).
  ctx.fillStyle = '#1f9e9a';
  ctx.beginPath();
  ctx.arc(cx, headY - 3, headR, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(cx - headR - 7, headY - 5, headR + 2, 3.5);
  // Spray bottle in the right hand.
  ctx.fillStyle = '#8fd3ff';
  ctx.beginPath();
  ctx.roundRect(cx + 16, headY + 30, 8, 13, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e5484d';
  ctx.fillRect(cx + 17, headY + 25, 6, 5);
  // Yellow polishing cloth in the left hand.
  ctx.fillStyle = '#f5b700';
  ctx.beginPath();
  ctx.moveTo(cx - 27, headY + 34);
  ctx.lineTo(cx - 15, headY + 32);
  ctx.lineTo(cx - 17, headY + 46);
  ctx.lineTo(cx - 26, headY + 44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
