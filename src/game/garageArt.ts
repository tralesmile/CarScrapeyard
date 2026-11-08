// Repair Garage backdrop painted with the Canvas 2D API (P1.1c): teal back wall, an open roller door
// showing the street (Motor City: a steel-blue wall and lit towers outside, P1.3d3b), a pegboard with tools, hanging lamps, a concrete floor with hazard stripes and the two-post lift
// the customer's car stands on, its cross beam lettered as the garage sign (P1.1e). Pure apart from the canvas context; layout helpers are unit-tested.

import type { BuyerKind, CityId, GarageFault } from '../core/config';

export interface GarageLayout {
  /** Canvas size in px. */
  w: number;
  h: number;
  /** y where the wall meets the floor, px. */
  floorY: number;
  /** Canvas px per CSS px. */
  s: number;
  /** The car on the lift: centre x, y of the wheels' contact line, car width (px). */
  lift: { cx: number; groundY: number; carW: number };
  /** Sign text painted on the lift's cross beam (kept short; drawn with the display font). */
  sign: string;
  /** Lowest y the HUD and the bay thumbnails can reach, px: the beam stays below it. */
  reservedTop: number;
  /** Highest y the tallest car's roof reaches with the lift raised, px: the beam stays above it. */
  roofY: number;
  /** City the garage is in (default Rust Valley). */
  city?: CityId;
  /** Night-time look (P1.3d3c; only cities with one change). */
  night?: boolean;
}

/** The garage's colours per city (P1.3d3b). */
export interface GarageTheme {
  wall: [string, string, string];
  skirting: string;
  /** The street through the roller door: sky top and bottom, building colours, pavement and kerb. */
  street: { sky: [string, string]; buildings: string[]; pavement: string; kerb: string };
  /** Lit windows on the buildings outside (Motor City's towers at dusk). */
  windows: string | null;
  /** Building height range outside, as fractions of the door's height. */
  towerH: [number, number];
  floor: [string, string];
  pegboard: string;
  /** Night (P1.3d3c): a neon tube along the top of one building outside, or none. */
  neon: string | null;
}

export const GARAGE_THEMES: Record<CityId, GarageTheme> = {
  rustValley: {
    wall: ['#137a77', '#1f9e9a', '#22aaa5'],
    skirting: '#0f5f5c',
    street: { sky: ['#8fd0ec', '#f3dcae'], buildings: ['#c9a682'], pavement: '#9a9fa8', kerb: '#b5bac2' },
    windows: null,
    towerH: [0.28, 0.5],
    floor: ['#7d848f', '#5f6670'],
    pegboard: '#c99a62',
    neon: null,
  },
  motorCity: {
    wall: ['#2c4766', '#3b5c82', '#44678f'],
    skirting: '#22364f',
    street: { sky: ['#3d5a80', '#f2c38b'], buildings: ['#4c6a8a', '#3e5a78', '#5b7da0', '#465f7c'], pavement: '#545e6c', kerb: '#8a94a3' },
    windows: 'rgba(255,214,140,0.85)',
    towerH: [0.42, 0.62],
    floor: ['#7a8597', '#586374'],
    pegboard: '#8796aa',
    neon: null,
  },
};

/** Motor City after dark (P1.3d3c): the workshop stays lit; through the door, a night street with neon. */
export const GARAGE_NIGHT: GarageTheme = {
  ...GARAGE_THEMES.motorCity,
  wall: ['#25405e', '#33557a', '#3c6088'],
  street: { sky: ['#0a1230', '#3d3270'], buildings: ['#1b2443', '#151c36', '#222c4e', '#18213e'], pavement: '#3b4250', kerb: '#6c7586' },
  windows: 'rgba(255,212,128,0.95)',
  neon: '#ff4fd8',
};

export function garageTheme(L: Pick<GarageLayout, 'city' | 'night'>): GarageTheme {
  const city = L.city ?? 'rustValley';
  return L.night && city === 'motorCity' ? GARAGE_NIGHT : GARAGE_THEMES[city];
}

/** The buildings seen through the roller door (left x, width, height in px), four across, within the door. */
export function streetBuildings(d: { x: number; y: number; w: number; h: number }, T: GarageTheme, s: number): { x: number; w: number; h: number; color: string }[] {
  const bw = d.w / 4;
  const [lo, hi] = T.towerH;
  return [0, 1, 2, 3].map((i) => ({
    x: d.x + i * bw,
    w: bw - s * 3,
    h: d.h * (lo + (((i * 37) % 23) / 22) * (hi - lo)),
    color: T.street.buildings[i % T.street.buildings.length]!,
  }));
}

/**
 * The lift's cross beam, which doubles as the garage sign (P1.1e): it hangs below the HUD and the bay row and above the
 * tallest raised car. `sign` is false when the gap is too small for lettering (the beam is then a thin bar).
 */
export function liftBeam(L: GarageLayout): { y: number; h: number; sign: boolean } {
  const s = L.s;
  const h = s * 24;
  const natural = L.lift.groundY - L.lift.carW * 0.55;
  const y = Math.min(Math.max(natural, L.reservedTop), L.roofY - h - s * 2);
  if (L.sign && y >= L.reservedTop) return { y, h, sign: true };
  const thin = s * 5;
  return { y: Math.min(Math.max(natural, L.reservedTop), L.roofY - thin - s * 2), h: thin, sign: false };
}

/** How far the lift raises a customer's car while it is worked on, CSS px. */
export const LIFT_RISE = 10;

/**
 * The bay thumbnail row under the HUD (P1.1f: slimmer than the yard's so short phones keep the door and the sign
 * readable). CSS px; `y` is the row's centre below the HUD's bottom edge.
 */
export const BAY_ROW = { w: 96, h: 60, gap: 10, y: 40, alpha: 0.78 } as const;
/** Lowest point of the bay row below the HUD, plus a small gap: the lift's sign hangs below it (CSS px). */
export const BAY_ROW_BOTTOM = BAY_ROW.y + BAY_ROW.h / 2 + 4;
/** Top of the area the car on the lift is laid out in, below the HUD (CSS px). */
export const GARAGE_AREA_TOP = BAY_ROW_BOTTOM + 10;

/** The tap hint pill's top sits this far below the scene's area (CSS px; the area ends where the sell strip starts). */
export const HINT_BELOW_AREA = 16;
/** How far the hint bobs up (the `bob` keyframes in style.css), CSS px. */
export const HINT_BOB = 5;
/** Height of the car's name/price label (18 px Lilita One with its 4 px stroke), CSS px. */
export const CAR_LABEL_H = 24;

/**
 * Top of the car's name/price label under the car (P1.3q2): just below the body, but never so low that the tap hint
 * pill covers its lettering (a 320x568 phone put the label's lower half under the pill). CSS px.
 */
export function carLabelTop(cy: number, carW: number, areaBottom: number): number {
  return Math.min(cy + carW * 0.16, areaBottom + HINT_BELOW_AREA - HINT_BOB - 1 - CAR_LABEL_H);
}

/** What the customer says about their car when they step out (P1.1f). Short, so one line fits a phone. */
export const CUSTOMER_LINES: Record<GarageFault, readonly string[]> = {
  tyre: ['My tyre went flat!', 'Ran over a nail!', 'It pulls to one side!'],
  battery: ["It won't start!", 'Battery died again!', 'Needed a jump start!'],
  brakes: ['The brakes squeal!', 'It takes ages to stop!', 'Grinding noise!'],
  exhaust: ["It's sooo loud now!", 'Something rattles!', 'Smells like fumes!'],
  engine: ['Smoke from the bonnet!', 'The engine coughs!', 'Warning light on!'],
};

/** The customer's line for a job: stable for a job (by id) so a re-shown car repeats the same words. */
export function customerLine(job: { id: number; fault: GarageFault }): string {
  const lines = CUSTOMER_LINES[job.fault];
  return lines[(((job.id * 7) % lines.length) + lines.length) % lines.length] ?? lines[0]!;
}

/** How long the customer's speech bubble stays up, seconds (the fault bubble waits for it). */
export const SPEECH_TIME = 1.8;

/** A fresh tyre on a shiny rim (the flat-tyre swap), centred in a square of side 2r. */
export function paintTyre(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.save();
  ctx.translate(r, r);
  ctx.fillStyle = '#1f2228';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2);
  ctx.fill();
  // Tread blocks around the edge.
  ctx.strokeStyle = '#34383f';
  ctx.lineWidth = r * 0.08;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
    ctx.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95);
    ctx.stroke();
  }
  const rim = ctx.createRadialGradient(-r * 0.15, -r * 0.15, r * 0.05, 0, 0, r * 0.6);
  rim.addColorStop(0, '#ffffff');
  rim.addColorStop(1, '#a9b2bd');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
  ctx.fill();
  // Five spokes so the roll-in reads as turning.
  ctx.strokeStyle = '#6b7480';
  ctx.lineWidth = r * 0.1;
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.12, Math.sin(a) * r * 0.12);
    ctx.lineTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
    ctx.stroke();
  }
  ctx.fillStyle = '#e8762b';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Rust on customer cars: they are daily drivers with a fault, not scrapyard wrecks. */
export const CUSTOMER_RUST = { patches: 5, dents: 1 } as const;

const CUSTOMER_KINDS: readonly BuyerKind[] = ['family', 'tradie', 'bargain', 'speed', 'collector', 'influencer'];

/** Which character brings a garage job in: stable for a job (by id) and cycling through every buyer look. */
export function customerKind(jobId: number): BuyerKind {
  const n = CUSTOMER_KINDS.length;
  return CUSTOMER_KINDS[((jobId % n) + n) % n] ?? 'family';
}

/** The roller door opening on the back wall (left side), px. */
export function doorRect(L: GarageLayout): { x: number; y: number; w: number; h: number } {
  const w = Math.min(L.w * 0.34, L.s * 150);
  const h = Math.min(L.floorY * 0.62, L.s * 150);
  return { x: L.w * 0.04, y: L.floorY - h, w, h };
}

/** The pegboard with tools (right side), px. */
export function pegboardRect(L: GarageLayout): { x: number; y: number; w: number; h: number } {
  const w = Math.min(L.w * 0.3, L.s * 130);
  const h = Math.min(L.floorY * 0.38, L.s * 90);
  return { x: L.w * 0.96 - w, y: L.floorY - h - L.s * 46, w, h };
}

/** Lift posts: x of the left and right post centres, px (just outside the car). */
export function liftPosts(L: Pick<GarageLayout, 'lift'>): [number, number] {
  const half = L.lift.carW * 0.56;
  return [L.lift.cx - half, L.lift.cx + half];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wall(ctx: CanvasRenderingContext2D, L: GarageLayout) {
  const T = garageTheme(L);
  const g = ctx.createLinearGradient(0, 0, 0, L.floorY);
  g.addColorStop(0, T.wall[0]);
  g.addColorStop(0.55, T.wall[1]);
  g.addColorStop(1, T.wall[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L.w, L.floorY + 1);
  // Brick-ish panel lines.
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = L.s;
  const row = L.s * 22;
  for (let y = L.floorY - row, i = 0; y > 0; y -= row, i++) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(L.w, y);
    ctx.stroke();
    const off = i % 2 === 0 ? 0 : L.s * 30;
    for (let x = off; x < L.w; x += L.s * 60) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + row);
      ctx.stroke();
    }
  }
  // Skirting board where the wall meets the floor.
  ctx.fillStyle = T.skirting;
  ctx.fillRect(0, L.floorY - L.s * 8, L.w, L.s * 8);
}

function rollerDoor(ctx: CanvasRenderingContext2D, L: GarageLayout) {
  const d = doorRect(L);
  const s = L.s;
  const T = garageTheme(L);
  // The street outside: sky, a far building row and the pavement.
  const sky = ctx.createLinearGradient(0, d.y, 0, d.y + d.h);
  sky.addColorStop(0, T.street.sky[0]);
  sky.addColorStop(1, T.street.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(d.x, d.y, d.w, d.h);
  const street = d.y + d.h * 0.78;
  for (const b of streetBuildings(d, T, s)) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, street - b.h, b.w, b.h);
    if (!T.windows) continue;
    // Lit windows in a grid, some dark (stable pattern).
    ctx.fillStyle = T.windows;
    const ww = s * 3;
    const cols = Math.max(1, Math.floor((b.w - s * 4) / (s * 7)));
    for (let r = 0, y = street - b.h + s * 5; y < street - s * 8; r++, y += s * 8)
      for (let c = 0; c < cols; c++) if ((r * 3 + c * 5 + Math.round(b.x)) % 4 !== 0) ctx.fillRect(b.x + s * 3 + c * s * 7, y, ww, s * 4);
  }
  if (T.neon) {
    // A neon tube along the roof of the tallest building outside, glowing into the night sky.
    const tall = streetBuildings(d, T, s).reduce((a, b) => (b.h > a.h ? b : a));
    ctx.save();
    ctx.shadowColor = T.neon;
    ctx.shadowBlur = s * 8;
    ctx.strokeStyle = T.neon;
    ctx.lineWidth = s * 2;
    ctx.beginPath();
    ctx.moveTo(tall.x + s * 2, street - tall.h + s * 1.5);
    ctx.lineTo(tall.x + tall.w - s * 2, street - tall.h + s * 1.5);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = T.street.pavement;
  ctx.fillRect(d.x, street, d.w, d.h * 0.22);
  ctx.fillStyle = T.street.kerb;
  ctx.fillRect(d.x, d.y + d.h * 0.78, d.w, s * 3);
  // Rolled-up door slats at the top and the frame.
  const slat = s * 6;
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#c7ccd4' : '#aab0ba';
    ctx.fillRect(d.x, d.y + i * slat, d.w, slat);
  }
  ctx.strokeStyle = '#2b2f36';
  ctx.lineWidth = s * 5;
  ctx.strokeRect(d.x, d.y, d.w, d.h + s * 2);
  // Yellow-black edge on the door posts.
  hazard(ctx, d.x - s * 7, d.y, s * 7, d.h, s);
  hazard(ctx, d.x + d.w, d.y, s * 7, d.h, s);
}

/** Diagonal yellow and black stripes inside a rectangle. */
function hazard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#f5b700';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#2b2f36';
  ctx.lineWidth = s * 4;
  const step = s * 12;
  for (let t = -h - w; t < w + h; t += step) {
    ctx.beginPath();
    ctx.moveTo(x + t, y + h);
    ctx.lineTo(x + t + h, y);
    ctx.stroke();
  }
  ctx.restore();
}

function pegboard(ctx: CanvasRenderingContext2D, L: GarageLayout) {
  const p = pegboardRect(L);
  const s = L.s;
  ctx.fillStyle = garageTheme(L).pegboard;
  roundRect(ctx, p.x, p.y, p.w, p.h, s * 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(70,40,15,0.35)';
  for (let y = p.y + s * 8; y < p.y + p.h - s * 4; y += s * 10)
    for (let x = p.x + s * 8; x < p.x + p.w - s * 4; x += s * 10) {
      ctx.beginPath();
      ctx.arc(x, y, s * 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  // Tools: two spanners, a hammer and a screwdriver, as simple silhouettes.
  ctx.lineCap = 'round';
  const tool = (x: number, len: number, color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, p.y + s * 14);
    ctx.lineTo(x, p.y + s * 14 + len);
    ctx.stroke();
  };
  const step = p.w / 5;
  tool(p.x + step, p.h * 0.6, '#8a94a3', s * 5);
  ctx.strokeStyle = '#8a94a3';
  ctx.lineWidth = s * 4;
  ctx.beginPath();
  ctx.arc(p.x + step, p.y + s * 12, s * 6, Math.PI * 0.15, Math.PI * 0.85, true);
  ctx.stroke();
  tool(p.x + step * 2, p.h * 0.45, '#5d6674', s * 4);
  ctx.beginPath();
  ctx.arc(p.x + step * 2, p.y + s * 12, s * 5, Math.PI * 0.15, Math.PI * 0.85, true);
  ctx.stroke();
  tool(p.x + step * 3, p.h * 0.55, '#7a4b25', s * 4);
  ctx.fillStyle = '#5d6674';
  ctx.fillRect(p.x + step * 3 - s * 9, p.y + s * 8, s * 18, s * 8);
  tool(p.x + step * 4, p.h * 0.3, '#e5484d', s * 6);
  tool(p.x + step * 4, p.h * 0.62, '#c7ccd4', s * 2);
}

function lamps(ctx: CanvasRenderingContext2D, L: GarageLayout) {
  const s = L.s;
  for (const fx of [0.3, 0.72]) {
    const x = L.w * fx;
    const y = L.floorY * 0.06 + s * 16;
    ctx.strokeStyle = '#2b2f36';
    ctx.lineWidth = s * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, y);
    ctx.stroke();
    // Soft light pool.
    const glow = ctx.createRadialGradient(x, y, s * 4, x, y + s * 60, s * 140);
    glow.addColorStop(0, 'rgba(255,240,190,0.35)');
    glow.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - s * 150, y, s * 300, s * 220);
    ctx.fillStyle = '#2b2f36';
    ctx.beginPath();
    ctx.moveTo(x - s * 16, y + s * 10);
    ctx.lineTo(x - s * 6, y);
    ctx.lineTo(x + s * 6, y);
    ctx.lineTo(x + s * 16, y + s * 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.ellipse(x, y + s * 10, s * 9, s * 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function floor(ctx: CanvasRenderingContext2D, L: GarageLayout) {
  const s = L.s;
  const g = ctx.createLinearGradient(0, L.floorY, 0, L.h);
  const T = garageTheme(L);
  g.addColorStop(0, T.floor[0]);
  g.addColorStop(1, T.floor[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, L.floorY, L.w, L.h - L.floorY);
  // Expansion joints in perspective.
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = s;
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(L.w / 2 + i * L.w * 0.12, L.floorY);
    ctx.lineTo(L.w / 2 + i * L.w * 0.3, L.h);
    ctx.stroke();
  }
  // Oil stains.
  ctx.fillStyle = 'rgba(30,25,20,0.18)';
  for (const [fx, fy, rx] of [
    [0.18, 0.35, 26],
    [0.84, 0.6, 18],
    [0.5, 0.85, 34],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(L.w * fx, L.floorY + (L.h - L.floorY) * fy, s * rx, s * rx * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Painted bay box around the lift.
  const { cx, groundY, carW } = L.lift;
  const bw = carW * 1.3;
  ctx.strokeStyle = '#f5d76e';
  ctx.lineWidth = s * 3;
  ctx.setLineDash([s * 12, s * 8]);
  ctx.strokeRect(cx - bw / 2, groundY - carW * 0.1, bw, carW * 0.3);
  ctx.setLineDash([]);
}

/** Tyre stack by the door and a red tool chest under the pegboard: the garage's clutter. */
function props(ctx: CanvasRenderingContext2D, L: GarageLayout) {
  const s = L.s;
  const d = doorRect(L);
  const tx = d.x + d.w + s * 26;
  for (let i = 0; i < 3; i++) {
    const y = L.floorY - s * 8 - i * s * 11;
    ctx.fillStyle = '#23262c';
    ctx.beginPath();
    ctx.ellipse(tx, y, s * 18, s * 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a3f49';
    ctx.beginPath();
    ctx.ellipse(tx, y - s * 2, s * 8, s * 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const p = pegboardRect(L);
  const cw = p.w * 0.7;
  const ch = s * 40;
  const cx = p.x + (p.w - cw) / 2;
  const cy = L.floorY - ch;
  ctx.fillStyle = '#c03a3e';
  roundRect(ctx, cx, cy, cw, ch, s * 4);
  ctx.fill();
  ctx.fillStyle = '#e5484d';
  for (let i = 0; i < 3; i++) roundRect(ctx, cx + s * 4, cy + s * 4 + i * s * 12, cw - s * 8, s * 9, s * 2), ctx.fill();
  ctx.fillStyle = '#d6dbe2';
  for (let i = 0; i < 3; i++) ctx.fillRect(cx + cw / 2 - s * 8, cy + s * 7 + i * s * 12, s * 16, s * 2.5);
}

/** The two-post lift: posts behind the car and the cross beam on top, lettered with the garage's name. */
function lift(ctx: CanvasRenderingContext2D, L: GarageLayout) {
  const s = L.s;
  const [l, r] = liftPosts(L);
  const beam = liftBeam(L);
  const top = beam.y;
  const pw = s * 12;
  for (const x of [l, r]) {
    const g = ctx.createLinearGradient(x - pw / 2, 0, x + pw / 2, 0);
    g.addColorStop(0, '#b9561a');
    g.addColorStop(0.5, '#e8762b');
    g.addColorStop(1, '#b9561a');
    ctx.fillStyle = g;
    ctx.fillRect(x - pw / 2, top, pw, L.lift.groundY - top + s * 6);
    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(x - pw, L.lift.groundY + s * 2, pw * 2, s * 6);
  }
  const bx = l - pw / 2 - s * 2;
  const bw = r - l + pw + s * 4;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  roundRect(ctx, bx + s * 2, top + s * 3, bw, beam.h, Math.min(s * 6, beam.h / 2));
  ctx.fill();
  ctx.fillStyle = beam.sign ? '#2b2f36' : '#5d6674';
  roundRect(ctx, bx, top, bw, beam.h, Math.min(s * 6, beam.h / 2));
  ctx.fill();
  if (!beam.sign) return;
  ctx.strokeStyle = '#e8762b';
  ctx.lineWidth = s * 2;
  ctx.stroke();
  // Bolts at both ends and the lettering.
  ctx.fillStyle = '#9ca3af';
  for (const x of [bx + s * 9, bx + bw - s * 9]) {
    ctx.beginPath();
    ctx.arc(x, top + beam.h / 2, s * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fbf3e4';
  ctx.font = `${Math.round(s * 16)}px "Lilita One", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(L.sign, bx + bw / 2, top + beam.h / 2 + s);
}

export function paintGarageBackdrop(ctx: CanvasRenderingContext2D, L: GarageLayout): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  wall(ctx, L);
  rollerDoor(ctx, L);
  pegboard(ctx, L);
  lamps(ctx, L);
  floor(ctx, L);
  props(ctx, L);
  lift(ctx, L);
}
