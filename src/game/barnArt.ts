// The barn find, painted with Canvas 2D (antialiased). What shows inside the doorway follows the
// restoration: a tarp-covered wreck, a tow chain, an engine hoist, a welder, paint-booth sheets,
// a fresh tarp before the reveal, and the shiny classic after it.
// `barnScene()` is the pure part (tested); `paintBarn()` draws it.

import type { CarFamily } from '../core/config';
import { paintCar, shade } from './carArt';

/** Texture box in design units; the barn body is BODY_W wide with its bottom centre at (BOX_W / 2, GROUND). */
export const BARN_BOX_W = 180;
export const BARN_BOX_H = 140;
export const BARN_BODY_W = 140;
export const BARN_GROUND = 128;

export type BarnStatus = 'locked' | 'covered' | 'working' | 'finished' | 'revealed' | 'away';

export interface BarnLook {
  status: BarnStatus;
  /** Stages finished so far (while working, the stage in progress has this index). */
  stage: number;
  family: CarFamily;
  paint: number;
  /** Hide the car (it is out in the reveal). */
  empty?: boolean;
}

export type BarnProp = 'chain' | 'hoist' | 'welder' | 'sheets' | 'lamp';

export interface BarnScene {
  car: boolean;
  /** How much of the car the tarp covers. */
  tarp: 'full' | 'rear' | 'none';
  /** Old dusty tarp, or the clean one waiting for the reveal. */
  tarpClean: boolean;
  /** rusty: before the body work; primer: body fixed, not painted; paint: restored. */
  finish: 'rusty' | 'primer' | 'paint';
  props: BarnProp[];
}

/** What the doorway shows for this barn state. Stage indices follow ECON.barn.stages (tow, engine, body, paint). */
export function barnScene(look: BarnLook): BarnScene {
  const { status, stage } = look;
  const car = !look.empty && status !== 'away' && status !== 'locked';
  const working = status === 'working';
  const props: BarnProp[] = [];
  if (working) {
    props.push('lamp');
    props.push((['chain', 'hoist', 'welder', 'sheets'] as const)[Math.min(stage, 3)]!);
  }
  let tarp: BarnScene['tarp'] = 'full';
  if (status === 'revealed') tarp = 'none';
  else if (status === 'finished') tarp = 'full';
  else if (stage >= 2) tarp = 'none';
  else if (working && stage === 1) tarp = 'rear';
  const finish: BarnScene['finish'] = status === 'revealed' || status === 'finished' ? 'paint' : stage >= 3 ? 'primer' : 'rusty';
  return { car, tarp, tarpClean: status === 'finished', finish, props };
}

const OUTLINE = '#1e2430';
const RUST = 0x8a5a3c;
const PRIMER = 0x9aa0a8;

/** Paint the barn into a BARN_BOX_W x BARN_BOX_H design box (scale the context first). */
export function paintBarn(ctx: CanvasRenderingContext2D, look: BarnLook): void {
  const sc = barnScene(look);
  const cx = BARN_BOX_W / 2;
  const w = BARN_BODY_W;
  const h = w * 0.8;
  const bottom = BARN_GROUND;
  const top = bottom - h;
  const wall = h * 0.62;
  const dw = w * 0.74;
  const dh = wall * 0.82;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Ground shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, bottom + 1, w * 0.62, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Walls with planks.
  const wallGrad = ctx.createLinearGradient(0, bottom - wall, 0, bottom);
  wallGrad.addColorStop(0, '#b23c2a');
  wallGrad.addColorStop(1, '#8e2f21');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(cx - w / 2, bottom - wall, w, wall);
  ctx.strokeStyle = 'rgba(80,20,12,0.55)';
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 8; i++) {
    const x = cx - w / 2 + (w * i) / 8;
    ctx.beginPath();
    ctx.moveTo(x, bottom - wall);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }

  // Roof.
  ctx.fillStyle = '#6e2318';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.62, bottom - wall + 3);
  ctx.lineTo(cx, top);
  ctx.lineTo(cx + w * 0.62, bottom - wall + 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // White gable trim.
  ctx.strokeStyle = '#f2e6d0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.5, bottom - wall - 2);
  ctx.lineTo(cx, top + 7);
  ctx.lineTo(cx + w * 0.5, bottom - wall - 2);
  ctx.stroke();
  // Hay-loft window (lit while someone works inside).
  const lit = sc.props.includes('lamp');
  ctx.fillStyle = lit ? '#ffe7a3' : '#f2e6d0';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cx - w * 0.08, top + h * 0.22, w * 0.16, h * 0.13, 2);
  ctx.fill();
  ctx.stroke();

  // Doorway interior.
  const dx = cx - dw / 2;
  const dy = bottom - dh;
  const inside = ctx.createLinearGradient(0, dy, 0, bottom);
  inside.addColorStop(0, lit ? '#4a3420' : '#24170f');
  inside.addColorStop(1, lit ? '#2e2014' : '#140c07');
  ctx.fillStyle = inside;
  ctx.fillRect(dx, dy, dw, dh);
  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, dw, dh);
  ctx.clip();
  if (lit) {
    // Work lamp glow from the ceiling.
    const glow = ctx.createRadialGradient(cx, dy + 4, 2, cx, dy + 4, dh * 1.1);
    glow.addColorStop(0, 'rgba(255,220,140,0.55)');
    glow.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(dx, dy, dw, dh);
    ctx.fillStyle = '#ffe7a3';
    ctx.beginPath();
    ctx.arc(cx, dy + 4, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (sc.car) paintBarnCar(ctx, look, sc, cx, bottom, dw * 0.86);
  for (const p of sc.props) paintProp(ctx, p, cx, bottom, dw, dh);
  ctx.restore();

  // Door frame and open doors.
  ctx.strokeStyle = '#f2e6d0';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(dx, dy, dw, dh);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - w / 2, bottom - wall, w, wall);
}

function paintBarnCar(ctx: CanvasRenderingContext2D, look: BarnLook, sc: BarnScene, cx: number, bottom: number, carW: number): void {
  const carH = carW / 2;
  const color = sc.finish === 'paint' ? look.paint : sc.finish === 'primer' ? PRIMER : RUST;
  ctx.save();
  ctx.translate(cx - carW / 2, bottom - carH * 0.95);
  paintCar(ctx, { family: look.family, paint: color, rarity: sc.finish === 'paint' ? 'legendary' : 'common' }, carW, carH);
  ctx.restore();
  if (sc.tarp === 'none') return;
  // Tarp over the car (all of it, or the rear half while the engine is out).
  const left = cx - carW * 0.48;
  const right = sc.tarp === 'full' ? cx + carW * 0.48 : cx + carW * 0.02;
  paintTarp(ctx, left, right, bottom, carH, sc.tarpClean);
}

/**
 * A lumpy tarp from `left` to `right` over a car of height `carH` standing on `bottom`.
 * Line widths scale with the car, so it works for the little barn car and the big reveal texture.
 */
export function paintTarp(ctx: CanvasRenderingContext2D, left: number, right: number, bottom: number, carH: number, clean: boolean): void {
  const lw = carH / 38;
  const topY = bottom - carH * 0.8;
  const base = clean ? 0x7d8a5c : 0x6f6a52;
  const g = ctx.createLinearGradient(0, topY, 0, bottom);
  g.addColorStop(0, shade(base, 0.15));
  g.addColorStop(1, shade(base, -0.25));
  ctx.fillStyle = g;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.8 * lw;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(left, bottom - carH * 0.12);
  ctx.quadraticCurveTo(left - carH * 0.1, topY - carH * 0.1, left + (right - left) * 0.25, topY);
  ctx.quadraticCurveTo(left + (right - left) * 0.55, topY - carH * 0.08, right - (right - left) * 0.12, topY + carH * 0.12);
  ctx.quadraticCurveTo(right + carH * 0.08, topY + carH * 0.3, right, bottom - carH * 0.12);
  // Ragged hem.
  const n = 7;
  for (let i = 1; i <= n; i++) {
    const x = right - ((right - left) * i) / n;
    ctx.lineTo(x + (right - left) / n / 2, bottom - carH * (i % 2 ? 0.06 : 0.14));
    ctx.lineTo(x, bottom - carH * 0.12);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Folds.
  ctx.strokeStyle = 'rgba(30,36,48,0.35)';
  ctx.lineWidth = 1.2 * lw;
  for (const f of [0.3, 0.6]) {
    ctx.beginPath();
    ctx.moveTo(left + (right - left) * f, topY + carH * 0.05);
    ctx.quadraticCurveTo(left + (right - left) * (f + 0.05), topY + carH * 0.3, left + (right - left) * (f - 0.03), bottom - carH * 0.14);
    ctx.stroke();
  }
  if (!clean) {
    // Dust specks on the old tarp.
    ctx.fillStyle = 'rgba(230,215,180,0.35)';
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.arc(left + (((i * 37) % 100) / 100) * (right - left), topY + carH * (0.12 + ((i * 53) % 40) / 100), 1.3 * lw, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function paintProp(ctx: CanvasRenderingContext2D, prop: BarnProp, cx: number, bottom: number, dw: number, dh: number): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (prop) {
    case 'chain': {
      // Tow chain from the front bumper out of the door.
      ctx.strokeStyle = '#c7ccd4';
      ctx.lineWidth = 1.6;
      const y = bottom - dh * 0.25;
      for (let x = cx + dw * 0.36; x < cx + dw * 0.52; x += 5) {
        ctx.beginPath();
        ctx.ellipse(x, y + Math.sin(x) * 0.6, 2.6, 1.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case 'hoist': {
      // A-frame engine hoist over the front of the car, with the engine block hanging.
      const hx = cx + dw * 0.26;
      ctx.strokeStyle = '#e8762b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hx - 14, bottom - 2);
      ctx.lineTo(hx, bottom - dh * 0.92);
      ctx.lineTo(hx + 14, bottom - 2);
      ctx.moveTo(hx - 18, bottom - dh * 0.88);
      ctx.lineTo(hx + 6, bottom - dh * 0.92);
      ctx.stroke();
      ctx.strokeStyle = '#c7ccd4';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(hx - 14, bottom - dh * 0.88);
      ctx.lineTo(hx - 14, bottom - dh * 0.62);
      ctx.stroke();
      ctx.fillStyle = '#4b5563';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(hx - 22, bottom - dh * 0.62, 16, 11, 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'welder': {
      // Welding glow on the body and a red toolbox.
      const wx = cx - dw * 0.08;
      const wy = bottom - dh * 0.4;
      const glow = ctx.createRadialGradient(wx, wy, 0, wx, wy, 14);
      glow.addColorStop(0, 'rgba(200,235,255,0.95)');
      glow.addColorStop(0.3, 'rgba(120,190,255,0.6)');
      glow.addColorStop(1, 'rgba(120,190,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(wx - 14, wy - 14, 28, 28);
      ctx.fillStyle = '#e5484d';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(cx - dw * 0.47, bottom - 10, 14, 9, 1.5);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'sheets': {
      // Paint booth: translucent plastic sheets hanging at both sides, and a haze of paint mist.
      ctx.fillStyle = 'rgba(235,240,245,0.45)';
      for (const side of [-1, 1]) {
        const x0 = cx + side * dw * 0.5;
        ctx.beginPath();
        ctx.moveTo(x0, bottom - dh);
        ctx.lineTo(x0 - side * dw * 0.16, bottom - dh);
        ctx.quadraticCurveTo(x0 - side * dw * 0.1, bottom - dh * 0.5, x0 - side * dw * 0.14, bottom);
        ctx.lineTo(x0, bottom);
        ctx.closePath();
        ctx.fill();
      }
      const mist = ctx.createRadialGradient(cx, bottom - dh * 0.45, 2, cx, bottom - dh * 0.45, dw * 0.4);
      mist.addColorStop(0, 'rgba(255,255,255,0.35)');
      mist.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = mist;
      ctx.fillRect(cx - dw / 2, bottom - dh, dw, dh);
      break;
    }
    case 'lamp':
      break;
  }
}
