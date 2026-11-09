// Story portraits (P1.6): head-and-shoulders busts of Grandpa Joe and Vince Valvano, painted with Canvas 2D in the
// same chunky outlined style as the customers. Drawn once at 2x and cached as data URLs for the DOM story modal.

import type { Speaker } from '../ui/storyView';
import { OUTLINE } from './buyerArt';

/** Portrait size in CSS px (drawn at 2x). */
export const PORTRAIT = 64;

/** Backdrop colour behind each speaker (Joe warm rust, Vince rival purple). */
export const PORTRAIT_BG: Record<Speaker, string> = { joe: '#e8762b', vince: '#7c3aed' };

const cache = new Map<Speaker, string>();

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, stroke = true): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) ctx.stroke();
}

/** Shoulders and neck: a rounded trapezoid in `shirt` below the head. */
function shoulders(ctx: CanvasRenderingContext2D, shirt: string, skin: string): void {
  ctx.fillStyle = skin;
  ctx.fillRect(27, 40, 10, 9);
  ctx.strokeRect(27, 40, 10, 9);
  ctx.beginPath();
  ctx.moveTo(6, 66);
  ctx.quadraticCurveTo(8, 48, 24, 46);
  ctx.lineTo(40, 46);
  ctx.quadraticCurveTo(56, 48, 58, 66);
  ctx.closePath();
  ctx.fillStyle = shirt;
  ctx.fill();
  ctx.stroke();
}

function eyes(ctx: CanvasRenderingContext2D, y: number): void {
  ctx.fillStyle = OUTLINE;
  for (const x of [27, 37]) {
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Grandpa Joe: white hair, bushy moustache, red trucker cap, blue overalls over a plaid shirt, a friendly smile. */
export function paintJoe(ctx: CanvasRenderingContext2D): void {
  const skin = '#e9b48f';
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUTLINE;
  ctx.lineJoin = 'round';
  shoulders(ctx, '#b91c1c', skin);
  // Overall bib with straps and a pocket.
  ctx.fillStyle = '#2f5d9e';
  ctx.beginPath();
  ctx.moveTo(22, 66);
  ctx.lineTo(23, 52);
  ctx.lineTo(41, 52);
  ctx.lineTo(42, 66);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(15, 47, 4, 19);
  ctx.fillRect(45, 47, 4, 19);
  ctx.fillStyle = '#f5b700';
  for (const x of [24.5, 39.5]) {
    ctx.beginPath();
    ctx.arc(x, 54, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Head, ears, white side hair.
  ellipse(ctx, 18, 31, 3, 4, skin);
  ellipse(ctx, 46, 31, 3, 4, skin);
  ellipse(ctx, 32, 29, 13, 14, skin);
  ctx.fillStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.ellipse(20.5, 27, 3.5, 6, -0.2, 0, Math.PI * 2);
  ctx.ellipse(43.5, 27, 3.5, 6, 0.2, 0, Math.PI * 2);
  ctx.fill();
  // Cap: crown and a brim to the right.
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(18, 22);
  ctx.quadraticCurveTo(19, 8, 32, 8);
  ctx.quadraticCurveTo(45, 8, 46, 22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(30, 21);
  ctx.quadraticCurveTo(46, 18, 56, 23);
  ctx.quadraticCurveTo(46, 25, 30, 23);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(28, 12, 8, 6);
  // Bushy eyebrows, eyes, nose, moustache and a smile.
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(23.5, 24.5, 7, 2.5);
  ctx.fillRect(33.5, 24.5, 7, 2.5);
  eyes(ctx, 29);
  ellipse(ctx, 32, 33, 2.6, 2.2, '#d99574', false);
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(23, 38);
  ctx.quadraticCurveTo(27, 34, 32, 36);
  ctx.quadraticCurveTo(37, 34, 41, 38);
  ctx.quadraticCurveTo(32, 41, 23, 38);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(32, 38.5, 4, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
}

/** Vince Valvano: slick black quiff, dark sunglasses, purple jacket with a gold chain, a smug grin. */
export function paintVince(ctx: CanvasRenderingContext2D): void {
  const skin = '#d7a17c';
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUTLINE;
  ctx.lineJoin = 'round';
  shoulders(ctx, '#4c1d95', skin);
  // Open collar (white shirt) and lapels.
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(25, 46);
  ctx.lineTo(32, 58);
  ctx.lineTo(39, 46);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#6d28d9';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(32 + side * 7, 46);
    ctx.lineTo(32 + side * 2, 62);
    ctx.lineTo(32 + side * 13, 52);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // Gold chain.
  ctx.strokeStyle = '#f5b700';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(32, 47, 6, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = OUTLINE;
  // Head and ears.
  ellipse(ctx, 18.5, 31, 3, 4, skin);
  ellipse(ctx, 45.5, 31, 3, 4, skin);
  ctx.beginPath();
  ctx.moveTo(19, 26);
  ctx.quadraticCurveTo(19, 44, 32, 44);
  ctx.quadraticCurveTo(45, 44, 45, 26);
  ctx.quadraticCurveTo(45, 15, 32, 15);
  ctx.quadraticCurveTo(19, 15, 19, 26);
  ctx.fillStyle = skin;
  ctx.fill();
  ctx.stroke();
  // Slick black quiff swept up and to the side, with a shine.
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.moveTo(18, 27);
  ctx.quadraticCurveTo(15, 12, 28, 8);
  ctx.quadraticCurveTo(44, 3, 49, 14);
  ctx.quadraticCurveTo(44, 13, 46, 26);
  ctx.quadraticCurveTo(40, 18, 30, 19);
  ctx.quadraticCurveTo(22, 20, 18, 27);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(26, 12);
  ctx.quadraticCurveTo(34, 8, 42, 10);
  ctx.stroke();
  ctx.strokeStyle = OUTLINE;
  // Sunglasses with a glint.
  ctx.lineWidth = 2;
  ctx.fillStyle = '#0f172a';
  for (const x of [26, 38]) {
    ctx.beginPath();
    ctx.ellipse(x, 28, 5.5, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(31.5, 27.5);
  ctx.lineTo(32.5, 27.5);
  ctx.stroke();
  ctx.strokeStyle = '#e0e7ff';
  ctx.lineWidth = 1.2;
  for (const x of [24, 36]) {
    ctx.beginPath();
    ctx.moveTo(x - 1.5, 27);
    ctx.lineTo(x + 1, 25.8);
    ctx.stroke();
  }
  // Thin moustache and a one-sided smug grin.
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(27, 36.5);
  ctx.quadraticCurveTo(32, 35, 37, 36.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(28, 39.5);
  ctx.quadraticCurveTo(34, 41.5, 38.5, 37.5);
  ctx.stroke();
}

/** Paint a speaker's portrait (round coloured backdrop, then the bust) into a 64x64 box scaled by `scale`. */
export function paintPortrait(ctx: CanvasRenderingContext2D, who: Speaker, scale = 1): void {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.arc(32, 32, 32, 0, Math.PI * 2);
  ctx.fillStyle = PORTRAIT_BG[who];
  ctx.fill();
  ctx.clip();
  // A lighter halo behind the head so the outline reads on the backdrop.
  ctx.beginPath();
  ctx.arc(32, 28, 22, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fill();
  if (who === 'joe') paintJoe(ctx);
  else paintVince(ctx);
  ctx.restore();
}

/** Data URL of a speaker's portrait (empty string where no canvas is available, e.g. unit tests). */
export function portraitUrl(who: Speaker): string {
  const hit = cache.get(who);
  if (hit !== undefined) return hit;
  let url = '';
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = PORTRAIT * 2;
    c.height = PORTRAIT * 2;
    const ctx = c.getContext('2d');
    if (ctx) {
      paintPortrait(ctx, who, 2);
      url = c.toDataURL('image/png');
    }
  }
  cache.set(who, url);
  return url;
}
