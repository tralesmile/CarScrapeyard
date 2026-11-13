// Paint & Tuning art painted with the Canvas 2D API (P1.2e): a spray booth (slate wall panels, ceiling light strips,
// extraction fans, a shelf of paint cans, a purple sign band with drips, a floor grate with overspray), the overlays
// that show each finished service on the customer's car (custom rims, vinyl wrap stripes, a tune flame decal and a
// chrome exhaust tip) and the Painter. Pure apart from the canvas context; layout and reveal helpers are unit-tested.

import { t, type BaseKey } from '../i18n';
import type { CarFamily, CityId, PaintService } from '../core/config';
import { ECON } from '../core/config';
import type { PaintJob } from '../core/state';
import { BUYER_W, OUTLINE, person } from './buyerArt';
import { SHAPES, WHEEL_Y, roundedPath, scaled } from './carArt';
import { signBand, type LotLayout } from './carlotArt';
import { BAY_ROW_BOTTOM, GARAGE_AREA_TOP as BOOTH_AREA_TOP } from './garageArt';

/** Same fields as the lot's layout: the car stands on the booth's floor grate instead of a platform. */
export type BoothLayout = LotLayout;

/** Booth thumbnails above the car (same row as the garage bays and the lot spots). */
export { BAY_ROW as BOOTH_ROW, BAY_ROW_BOTTOM as BOOTH_ROW_BOTTOM, GARAGE_AREA_TOP as BOOTH_AREA_TOP } from './garageArt';

/** The booth's colours per city (P1.3d3b): Motor City has cooler steel-blue panels and an icy accent stripe. */
export interface BoothTheme {
  wall: [string, string];
  seam: string;
  light: string;
  lightGlow: string;
  /** A horizontal accent stripe along the wall (fraction of the wall's height), or none. */
  stripe: { color: string; at: number; neon?: boolean } | null;
  floor: [string, string];
  skirting: string;
}

export const BOOTH_THEMES: Record<CityId, BoothTheme> = {
  rustValley: {
    wall: ['#26303f', '#3c4a5e'],
    seam: 'rgba(15,20,28,0.45)',
    light: '#eef6ff',
    lightGlow: '225,240,255',
    stripe: null,
    floor: ['#aab3bf', '#808a97'],
    skirting: '#1b222d',
  },
  motorCity: {
    wall: ['#1d3a5c', '#2f5a86'],
    seam: 'rgba(8,20,36,0.5)',
    light: '#dff6ff',
    lightGlow: '170,225,255',
    stripe: { color: '#4fd1e8', at: 0.8 },
    floor: ['#9cb0c6', '#6f8299'],
    skirting: '#0f2238',
  },
};

/** Motor City after dark (P1.3d3c): a deeper blue booth with the accent stripe as a glowing magenta neon tube. */
export const BOOTH_NIGHT: BoothTheme = {
  ...BOOTH_THEMES.motorCity,
  wall: ['#141f3d', '#263f6b'],
  stripe: { color: '#ff4fd8', at: 0.8, neon: true },
};

export function boothTheme(L: Pick<BoothLayout, 'city' | 'night'>): BoothTheme {
  const city = L.city ?? 'rustValley';
  return L.night && city === 'motorCity' ? BOOTH_NIGHT : BOOTH_THEMES[city];
}

/** The booth's sign band (same rule as the lot's: below the HUD and the booth row, above the tallest roof). */
export const boothSign = signBand;

/**
 * The order ticket over the car (CSS px): one slot per service, then a column with the quick-finish tip. It overlaps
 * the car's roof by `overlap`; the booth sign is laid out above it.
 */
export const TICKET = { h: 40, slot: 34, pad: 10, tipW: 86, overlap: 10 } as const;

export function ticketWidth(services: number): number {
  return TICKET.pad + services * TICKET.slot + 8 + TICKET.tipW;
}

/** Top of the ticket for a car whose tallest roof is at `roofY` (CSS px); `overlap` grows on short phones. */
export function ticketTop(roofY: number, overlap: number = TICKET.overlap): number {
  return roofY - TICKET.h + overlap;
}

/** Height of the tallest roof above the car's centre, as a fraction of the car's width. */
export const ROOF_FRAC = Math.min(...Object.values(SHAPES).map((sh) => Math.min(...sh.body.map((p) => p[1]))));

/** Room the sign band needs between the booth row and the ticket (CSS px): enough for its lettering. */
export const SIGN_ROOM = 26;
/** The most the ticket may cover the tallest roof on a short phone (CSS px). */
export const MAX_OVERLAP = 22;
/** The car never shrinks below this on a short phone (CSS px). */
export const MIN_CAR_W = 220;
/** Distance from the car's centre down to the waiting customer's feet, as a fraction of car width plus px. */
const FEET = { frac: 0.13, px: 14 } as const;

export interface BoothStage {
  cx: number;
  cy: number;
  carW: number;
  /** Top and bottom of the area the car is laid out in. */
  top: number;
  bottom: number;
  /** How much the ticket overlaps the tallest roof. */
  overlap: number;
  /** Tallest roof and the ticket's top edge. */
  roofY: number;
  ticketY: number;
}

/**
 * Where the car, its roof and the order ticket sit (P1.2g, CSS px). The car stands at 55% down the free area; on a
 * short phone that leaves no room for the sign between the booth row and the ticket, so the car first moves down
 * (its customer's feet stay above the panel) and then the ticket covers a little more of the roof.
 * `hudTop` is the HUD's bottom edge, `bottom` the panel's top edge.
 */
export function boothStage(cssW: number, hudTop: number, bottom: number): BoothStage {
  const top = hudTop + BOOTH_AREA_TOP;
  let carW = Math.min(cssW * 0.8, 400);
  const rise = 0.25 - ROOF_FRAC / 2; // roof height above the car's centre, per px of car width
  const roofOf = (cy: number) => cy - rise * carW;
  const need = hudTop + BAY_ROW_BOTTOM + SIGN_ROOM; // the ticket's top should not rise above this
  const floor = bottom - 2 - FEET.px; // the customer's feet stay above this
  const cy0 = top + (bottom - top) * 0.55;
  let cy = cy0;
  let overlap: number = TICKET.overlap;
  const gap = () => ticketTop(roofOf(cy), overlap) - need;
  if (gap() < 0) cy = Math.max(cy0, Math.min(floor - carW * FEET.frac, cy - gap()));
  if (gap() < 0) overlap = Math.min(MAX_OVERLAP, overlap - gap());
  if (gap() < 0) {
    // Still no room (a very short phone): a smaller car, standing as low as its customer allows.
    carW = Math.max(MIN_CAR_W, Math.min(carW, (floor - TICKET.h + overlap - need) / (FEET.frac + rise)));
    cy = Math.max(cy0, floor - carW * FEET.frac);
  }
  const roofY = roofOf(cy);
  return { cx: cssW / 2, cy, carW, top, bottom, overlap, roofY, ticketY: ticketTop(roofY, overlap) };
}

/** Feet of the waiting customer (right of the car), CSS px. `personW` is the drawn customer's width. */
export function customerFeet(st: BoothStage, cssW: number, personW: number): { x: number; y: number } {
  const x = Math.min(st.cx + st.carW / 2 + 8, cssW - personW / 2 - 2);
  return { x, y: st.cy + st.carW * FEET.frac + FEET.px };
}

/** What a paint customer says as they step out (P1.2g), by the first service they ordered; the full works for 3. */
export const PAINT_LINES: Record<PaintService | 'combo', readonly BaseKey[]> = {
  respray: ['paint.say.respray.0', 'paint.say.respray.1', 'paint.say.respray.2'],
  rims: ['paint.say.rims.0', 'paint.say.rims.1', 'paint.say.rims.2'],
  wrap: ['paint.say.wrap.0', 'paint.say.wrap.1', 'paint.say.wrap.2'],
  tune: ['paint.say.tune.0', 'paint.say.tune.1', 'paint.say.tune.2'],
  combo: ['paint.say.combo.0', 'paint.say.combo.1', 'paint.say.combo.2'],
};

/** The customer's line for an order: stable by id, like the garage's. */
export function paintLine(job: Pick<PaintJob, 'id' | 'services'>): string {
  const key = job.services.length >= 3 ? 'combo' : (job.services[0] ?? 'respray');
  const lines = PAINT_LINES[key];
  return t(lines[(((job.id * 7) % lines.length) + lines.length) % lines.length] ?? lines[0]!);
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function overlaps(a: Rect, b: Rect, margin = 0): boolean {
  return a.x < b.x + b.w + margin && b.x < a.x + a.w + margin && a.y < b.y + b.h + margin && b.y < a.y + a.h + margin;
}

/** The speech bubble's box and where its tail points: down at the head, or right at the customer's side. */
export interface SpeechBox extends Rect {
  tail: 'down' | 'right';
  /** Tail tip (CSS px). */
  tipX: number;
  tipY: number;
}

/**
 * Where the paint customer's speech bubble goes (P1.2g, CSS px). The tip clock runs from the car's arrival, so the
 * bubble never covers the order ticket: above the customer's head when there is room, else shifted right of the
 * ticket, else beside the customer below the ticket with the tail pointing right at them.
 * `head` is the top of the customer's head, `personW` their width, `minTop` the lowest the bubble may rise to.
 */
export function speechBox(o: { w: number; h: number; head: { x: number; y: number }; personW: number; ticket: Rect; screenW: number; minTop: number }): SpeechBox {
  const { w, h, head, ticket, screenW } = o;
  const edge = 4;
  const clampX = (x: number) => Math.max(edge, Math.min(screenW - edge - w, x));
  const tipY = head.y - 2;
  const y = head.y - 10 - h;
  if (y >= o.minTop) {
    const above = { x: clampX(head.x - w * 0.75), y, w, h };
    if (!overlaps(above, ticket, 4)) return { ...above, tail: 'down', tipX: head.x, tipY };
    const right = { x: ticket.x + ticket.w + 6, y, w, h };
    if (right.x + w <= screenW - edge && !overlaps(right, ticket, 4)) return { ...right, tail: 'down', tipX: Math.max(right.x + h / 2, Math.min(right.x + w - h / 2, head.x)), tipY };
  }
  // Beside the customer, under the ticket: the tail points right at their face.
  const side = head.x - o.personW / 2 - 8;
  const by = Math.max(ticket.y + ticket.h + 6, head.y + 4);
  const box = { x: clampX(side - w), y: by, w, h };
  return { ...box, tail: 'right', tipX: Math.max(box.x + w, side + 6), tipY: Math.min(by + h / 2, head.y + 14) };
}

/** How much of each finished-service layer shows on the car, 0..1 (the current service grows with its work). */
export interface ServiceReveal {
  /** New colour (respray, or the wrap's film). */
  colour: number;
  stripes: number;
  rims: number;
  tune: number;
}

/** Fraction of the current service that is done, 0..1. */
export function stepProgress(job: Pick<PaintJob, 'services' | 'step' | 'work'>): number {
  const k = job.services[job.step];
  if (!k) return 1;
  const max = ECON.paint.services[k].work;
  return Math.max(0, Math.min(1, 1 - job.work / max));
}

/** Done = 1, being worked on = its progress, not reached (or not ordered) = 0. */
export function serviceLevel(job: Pick<PaintJob, 'services' | 'step' | 'work'>, k: PaintService): number {
  const i = job.services.indexOf(k);
  if (i < 0 || i > job.step) return 0;
  if (i < job.step) return 1;
  return stepProgress(job);
}

export function serviceReveal(job: Pick<PaintJob, 'services' | 'step' | 'work'>): ServiceReveal {
  const wrap = serviceLevel(job, 'wrap');
  return {
    colour: Math.max(serviceLevel(job, 'respray'), wrap),
    stripes: wrap,
    rims: serviceLevel(job, 'rims'),
    tune: serviceLevel(job, 'tune'),
  };
}

/** Stripe colour on a wrap: white on dark paint, ink on light paint. */
export function wrapAccent(paint: number): string {
  const r = (paint >> 16) & 255;
  const g = (paint >> 8) & 255;
  const b = paint & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#1e2430' : '#fbf3e4';
}

/** Paint-can colours on the shelf (brand palette). */
export const CAN_COLOURS = ['#e5484d', '#f5b700', '#3b82f6', '#3bc45a', '#8b5cf6', '#e8762b', '#fbf3e4'] as const;

/** Extraction fan centres on the back wall (left and right of the car), px. */
export function fanSpots(L: BoothLayout): { x: number; y: number; r: number }[] {
  const s = L.s;
  const top = boothSign(L).y + boothSign(L).h;
  const r = Math.max(8 * s, Math.min(22 * s, (L.floorY - top) * 0.28));
  const y = top + (L.floorY - top) * 0.42;
  return [
    { x: Math.max(r + 8 * s, L.w * 0.1), y, r },
    { x: Math.min(L.w - r - 8 * s, L.w * 0.9), y, r },
  ];
}

/** Floor grate under the car: the booth's downdraft extraction, px. */
export function grateRect(L: BoothLayout): { x: number; y: number; w: number; h: number } {
  const w = L.stage.carW * 1.08;
  const h = 10 * L.s;
  return { x: L.stage.cx - w / 2, y: L.stage.groundY - h / 2 + 2 * L.s, w, h };
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

function wall(ctx: CanvasRenderingContext2D, L: BoothLayout) {
  const s = L.s;
  const T = boothTheme(L);
  const g = ctx.createLinearGradient(0, 0, 0, L.floorY);
  g.addColorStop(0, T.wall[0]);
  g.addColorStop(1, T.wall[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L.w, L.floorY + 1);
  if (T.stripe) {
    // An accent stripe with a soft glow, low on the wall (below the sign and the shelf).
    const y = L.floorY * T.stripe.at;
    ctx.fillStyle = T.stripe.color;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(0, y - 5 * s, L.w, 13 * s);
    ctx.globalAlpha = 0.85;
    if (T.stripe.neon) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.shadowColor = T.stripe.color;
      ctx.shadowBlur = 12 * s;
      ctx.fillRect(0, y, L.w, 3 * s);
      ctx.fillStyle = 'rgba(255,230,250,0.9)';
      ctx.fillRect(0, y + s, L.w, s);
      ctx.restore();
    } else ctx.fillRect(0, y, L.w, 3 * s);
    ctx.globalAlpha = 1;
  }
  // Wall panels with seams and rivets.
  const panel = 64 * s;
  ctx.strokeStyle = T.seam;
  ctx.lineWidth = 2 * s;
  for (let x = panel / 2; x < L.w; x += panel) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, L.floorY);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let x = panel / 2; x < L.w; x += panel)
    for (let y = L.reservedTop + 10 * s; y < L.floorY - 6 * s; y += 26 * s) {
      ctx.beginPath();
      ctx.arc(x - 6 * s, y, 1.5 * s, 0, Math.PI * 2);
      ctx.arc(x + 6 * s, y, 1.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  // Ceiling light strips with a soft glow (the booth is bright inside).
  const ly = Math.max(L.reservedTop - 18 * s, 4 * s);
  for (const [x0, x1] of [
    [0.06, 0.44],
    [0.56, 0.94],
  ] as const) {
    const glow = ctx.createLinearGradient(0, ly, 0, ly + 70 * s);
    glow.addColorStop(0, `rgba(${T.lightGlow},0.32)`);
    glow.addColorStop(1, `rgba(${T.lightGlow},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(L.w * x0 - 10 * s, ly, L.w * (x1 - x0) + 20 * s, 70 * s);
    ctx.fillStyle = T.light;
    roundRect(ctx, L.w * x0, ly, L.w * (x1 - x0), 6 * s, 3 * s);
    ctx.fill();
  }
}

function fans(ctx: CanvasRenderingContext2D, L: BoothLayout) {
  const s = L.s;
  for (const f of fanSpots(L)) {
    ctx.fillStyle = '#1b222d';
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r + 4 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5d6674';
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b3340';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.ellipse(f.x + Math.cos(a) * f.r * 0.45, f.y + Math.sin(a) * f.r * 0.45, f.r * 0.5, f.r * 0.2, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#c3cad4';
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    // Grille bars across the front.
    ctx.strokeStyle = 'rgba(200,210,222,0.55)';
    ctx.lineWidth = 1.2 * s;
    for (let k = -2; k <= 2; k++) {
      const dy = (k / 3) * f.r;
      const half = Math.sqrt(Math.max(0, f.r * f.r - dy * dy));
      ctx.beginPath();
      ctx.moveTo(f.x - half, f.y + dy);
      ctx.lineTo(f.x + half, f.y + dy);
      ctx.stroke();
    }
  }
}

/** A shelf of paint cans on the right of the wall, just above the floor. */
function shelf(ctx: CanvasRenderingContext2D, L: BoothLayout) {
  const s = L.s;
  const w = Math.min(L.w * 0.26, 110 * s);
  const x = L.w * 0.97 - w;
  const y = L.floorY - 22 * s;
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(x, y, w, 5 * s);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x, y + 5 * s, w, 2 * s);
  const can = 13 * s;
  const n = Math.max(1, Math.floor(w / (can + 4 * s)));
  for (let i = 0; i < n; i++) {
    const cx = x + 4 * s + i * (can + 4 * s);
    const h = (i % 2 ? 15 : 18) * s;
    ctx.fillStyle = '#c3cad4';
    ctx.fillRect(cx, y - h, can, h);
    ctx.fillStyle = CAN_COLOURS[i % CAN_COLOURS.length]!;
    ctx.fillRect(cx, y - h * 0.72, can, h * 0.5);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.2 * s;
    ctx.strokeRect(cx, y - h, can, h);
  }
  // A colour-swatch fan leaning on the left of the wall.
  const fx = 30 * s;
  const fy = L.floorY - 6 * s;
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(-1.2 + i * 0.28);
    ctx.fillStyle = CAN_COLOURS[i]!;
    roundRect(ctx, -3 * s, -34 * s, 7 * s, 34 * s, 2 * s);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1 * s;
    ctx.stroke();
    ctx.restore();
  }
}

function sign(ctx: CanvasRenderingContext2D, L: BoothLayout) {
  const s = L.s;
  const b = boothSign(L);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, b.x + 2 * s, b.y + 3 * s, b.w, b.h, 6 * s);
  ctx.fill();
  ctx.fillStyle = '#8b5cf6';
  roundRect(ctx, b.x, b.y, b.w, b.h, 6 * s);
  ctx.fill();
  // Paint drips under the band.
  const drips = ['#e5484d', '#f5b700', '#3b82f6', '#3bc45a', '#e8762b'];
  for (let i = 0; i < 7; i++) {
    const x = b.x + b.w * (0.1 + i * 0.13);
    const len = (b.sign ? 6 + ((i * 5) % 9) : 3) * s;
    ctx.fillStyle = drips[i % drips.length]!;
    roundRect(ctx, x - 2.5 * s, b.y + b.h - 3 * s, 5 * s, len + 3 * s, 2.5 * s);
    ctx.fill();
  }
  roundRect(ctx, b.x, b.y, b.w, b.h, 6 * s);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5 * s;
  ctx.stroke();
  if (!b.sign) return;
  ctx.fillStyle = '#fbf3e4';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 4 * s;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(Math.min(b.h * 0.7, 20 * s))}px "Lilita One", sans-serif`;
  const ty = b.y + b.h / 2 + s;
  ctx.strokeText(L.sign, L.w / 2, ty);
  ctx.fillText(L.sign, L.w / 2, ty);
  // Spray-gun dots at both ends.
  for (const [x, c] of [
    [b.x + 16 * s, '#f5b700'],
    [b.x + b.w - 16 * s, '#3bc45a'],
  ] as const) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, ty - s, Math.min(6 * s, b.h * 0.22), 0, Math.PI * 2);
    ctx.fill();
  }
}

function floor(ctx: CanvasRenderingContext2D, L: BoothLayout) {
  const s = L.s;
  const T = boothTheme(L);
  const g = ctx.createLinearGradient(0, L.floorY, 0, L.h);
  g.addColorStop(0, T.floor[0]);
  g.addColorStop(1, T.floor[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, L.floorY, L.w, L.h - L.floorY);
  // Skirting where the wall meets the floor.
  ctx.fillStyle = T.skirting;
  ctx.fillRect(0, L.floorY - 3 * s, L.w, 5 * s);
  // Overspray splats (stable positions).
  for (let i = 0; i < 9; i++) {
    const x = ((i * 137 + 41) % 100) / 100;
    const y = L.floorY + 14 * s + (((i * 61) % 100) / 100) * Math.max(0, L.h - L.floorY - 30 * s);
    ctx.fillStyle = CAN_COLOURS[i % CAN_COLOURS.length]!;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.ellipse(L.w * x, y, (8 + (i % 3) * 5) * s, (3 + (i % 2) * 2) * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Grate under the car.
  const r = grateRect(L);
  ctx.fillStyle = '#3c4552';
  roundRect(ctx, r.x, r.y, r.w, r.h, 3 * s);
  ctx.fill();
  ctx.strokeStyle = '#6b7480';
  ctx.lineWidth = 1.5 * s;
  for (let x = r.x + 6 * s; x < r.x + r.w - 3 * s; x += 7 * s) {
    ctx.beginPath();
    ctx.moveTo(x, r.y + 2 * s);
    ctx.lineTo(x, r.y + r.h - 2 * s);
    ctx.stroke();
  }
}

export function paintBoothBackdrop(ctx: CanvasRenderingContext2D, L: BoothLayout): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  wall(ctx, L);
  fans(ctx, L);
  shelf(ctx, L);
  floor(ctx, L);
  sign(ctx, L);
}

// ---- service overlays (car-sized transparent textures, laid over the car) ----

function clipBody(ctx: CanvasRenderingContext2D, family: CarFamily, w: number, h: number) {
  const shape = SHAPES[family];
  roundedPath(ctx, scaled(shape.body, w, h), h * shape.round);
  ctx.clip();
}

/** Custom rims: black spokes with a gold lip and a red brake caliper, over the stock rims. */
export function paintRimsOverlay(ctx: CanvasRenderingContext2D, family: CarFamily, w: number, h: number): void {
  const shape = SHAPES[family];
  const r = shape.wheelR * h;
  const y = WHEEL_Y * h;
  const line = Math.max(2, w / 80);
  for (const fx of shape.wheels) {
    const x = fx * w;
    ctx.fillStyle = '#16181d';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f5b700';
    ctx.lineWidth = line * 0.9;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.66, 0, Math.PI * 2);
    ctx.stroke();
    // Caliper peeking through the spokes.
    ctx.fillStyle = '#e5484d';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, -2.4, -1.4);
    ctx.arc(x, y, r * 0.3, -1.4, -2.4, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#d7dde4';
    ctx.lineWidth = line * 0.55;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.moveTo(x + Math.cos(a) * r * 0.14, y + Math.sin(a) * r * 0.14);
      ctx.lineTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6);
    }
    ctx.stroke();
    ctx.fillStyle = '#f5b700';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Vinyl wrap: two racing stripes along the flank, swept up at the front, clipped to the body. */
export function paintWrapStripes(ctx: CanvasRenderingContext2D, family: CarFamily, w: number, h: number, paint: number): void {
  ctx.save();
  clipBody(ctx, family, w, h);
  ctx.fillStyle = wrapAccent(paint);
  for (const [y0, t] of [
    [0.5, 0.055],
    [0.59, 0.03],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(0, h * y0);
    ctx.lineTo(w * 0.7, h * y0);
    ctx.lineTo(w * 0.86, h * (y0 - 0.12));
    ctx.lineTo(w * 0.86 + h * t * 1.4, h * (y0 - 0.12));
    ctx.lineTo(w * 0.7 + h * t * 1.4, h * (y0 + t));
    ctx.lineTo(0, h * (y0 + t));
    ctx.closePath();
    ctx.fill();
  }
  // A thin dark edge so the film reads as a wrap, not paint.
  ctx.strokeStyle = 'rgba(30,36,48,0.35)';
  ctx.lineWidth = Math.max(1, w / 260);
  ctx.beginPath();
  ctx.moveTo(0, h * 0.5);
  ctx.lineTo(w * 0.7, h * 0.5);
  ctx.stroke();
  ctx.restore();
}

/** Engine tune: a flame decal licking back from the front wheel arch, and a chrome exhaust tip at the rear. */
export function paintTuneOverlay(ctx: CanvasRenderingContext2D, family: CarFamily, w: number, h: number): void {
  const shape = SHAPES[family];
  ctx.save();
  clipBody(ctx, family, w, h);
  const fx = shape.wheels[1] * w;
  const g = ctx.createLinearGradient(fx + w * 0.12, 0, fx - w * 0.28, 0);
  g.addColorStop(0, '#fff1b8');
  g.addColorStop(0.35, '#f5b700');
  g.addColorStop(0.7, '#e8762b');
  g.addColorStop(1, '#e5484d');
  ctx.fillStyle = g;
  ctx.beginPath();
  const base = h * 0.66;
  ctx.moveTo(fx + w * 0.14, base);
  // Five tongues, longest in the middle.
  const tips = [0.12, 0.22, 0.28, 0.2, 0.1];
  tips.forEach((len, i) => {
    const y = h * (0.47 + i * 0.045);
    ctx.quadraticCurveTo(fx, y - h * 0.03, fx - w * len, y);
    ctx.quadraticCurveTo(fx - w * len * 0.4, y + h * 0.02, fx + w * 0.02, y + h * 0.03);
  });
  ctx.lineTo(fx + w * 0.14, base);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,36,48,0.5)';
  ctx.lineWidth = Math.max(1, w / 300);
  ctx.stroke();
  ctx.restore();
  // Exhaust tip under the rear bumper.
  const ex = shape.body.reduce((m, p) => Math.min(m, p[0]), 1) * w;
  const ey = h * 0.73;
  ctx.fillStyle = '#d7dde4';
  roundRect(ctx, ex - w * 0.02, ey - h * 0.02, w * 0.07, h * 0.04, h * 0.02);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = Math.max(1.5, w / 160);
  ctx.stroke();
  ctx.fillStyle = '#1b1d22';
  ctx.beginPath();
  ctx.ellipse(ex - w * 0.018, ey, w * 0.008, h * 0.015, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Where the exhaust flame shoots out (fractions of the car texture), for the tune's flame burst. */
export function exhaustSpot(family: CarFamily): [number, number] {
  const back = SHAPES[family].body.reduce((m, p) => Math.min(m, p[0]), 1);
  return [back - 0.04, 0.73];
}

/** The Painter (P1.2e): white overalls, a respirator mask and goggles, a spray gun. */
export function paintPainter(ctx: CanvasRenderingContext2D): void {
  const cx = BUYER_W / 2;
  const { headY, headR } = person(ctx, cx, 1, { shirt: '#f2f4f7', pants: '#e3e7ec', skin: '#d9a07a', hair: '#2b2118' });
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUTLINE;
  // Overspray speckles on the overalls.
  for (const [dx, dy, c] of [
    [-6, 24, '#e5484d'],
    [5, 30, '#3b82f6'],
    [-2, 40, '#f5b700'],
    [8, 46, '#8b5cf6'],
  ] as const) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(cx + dx, headY + dy, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // Hood.
  ctx.fillStyle = '#f2f4f7';
  ctx.beginPath();
  ctx.arc(cx, headY - 2, headR + 1.5, Math.PI * 0.95, Math.PI * 2.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Goggles.
  ctx.fillStyle = '#8fd3ff';
  ctx.beginPath();
  ctx.roundRect(cx - headR + 1, headY - 4, headR * 2 - 2, 5, 2);
  ctx.fill();
  ctx.stroke();
  // Respirator.
  ctx.fillStyle = '#4b5563';
  ctx.beginPath();
  ctx.ellipse(cx + 2, headY + 5, 5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Spray gun in the right hand, pointing right.
  ctx.fillStyle = '#9ca3af';
  ctx.beginPath();
  ctx.roundRect(cx + 14, headY + 28, 14, 6, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e8762b';
  ctx.beginPath();
  ctx.roundRect(cx + 16, headY + 18, 7, 10, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1e2430';
  ctx.fillRect(cx + 17, headY + 34, 3, 7);
}
