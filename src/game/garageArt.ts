// Repair Garage backdrop painted with the Canvas 2D API (P1.1c): teal back wall, an open roller door
// showing the street, a pegboard with tools, hanging lamps, a concrete floor with hazard stripes and the two-post lift
// the customer's car stands on, its cross beam lettered as the garage sign (P1.1e). Pure apart from the canvas context; layout helpers are unit-tested.

import type { BuyerKind } from '../core/config';

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
  const g = ctx.createLinearGradient(0, 0, 0, L.floorY);
  g.addColorStop(0, '#137a77');
  g.addColorStop(0.55, '#1f9e9a');
  g.addColorStop(1, '#22aaa5');
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
  ctx.fillStyle = '#0f5f5c';
  ctx.fillRect(0, L.floorY - L.s * 8, L.w, L.s * 8);
}

function rollerDoor(ctx: CanvasRenderingContext2D, L: GarageLayout) {
  const d = doorRect(L);
  const s = L.s;
  // The street outside: sky, a far building row and the pavement.
  const sky = ctx.createLinearGradient(0, d.y, 0, d.y + d.h);
  sky.addColorStop(0, '#8fd0ec');
  sky.addColorStop(1, '#f3dcae');
  ctx.fillStyle = sky;
  ctx.fillRect(d.x, d.y, d.w, d.h);
  ctx.fillStyle = '#c9a682';
  const bw = d.w / 4;
  for (let i = 0; i < 4; i++) {
    const bh = d.h * (0.28 + ((i * 37) % 23) / 100);
    ctx.fillRect(d.x + i * bw, d.y + d.h * 0.78 - bh, bw - s * 3, bh);
  }
  ctx.fillStyle = '#9a9fa8';
  ctx.fillRect(d.x, d.y + d.h * 0.78, d.w, d.h * 0.22);
  ctx.fillStyle = '#b5bac2';
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
  ctx.fillStyle = '#c99a62';
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
  g.addColorStop(0, '#7d848f');
  g.addColorStop(1, '#5f6670');
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
