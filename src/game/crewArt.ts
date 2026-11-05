// Crew drawn in code (Canvas 2D): the Scrapper and the little hydraulic press it runs.
// Same 64 x 128 box as the customers (feet at the bottom centre); the press has its own box.

import { BUYER_H, BUYER_W, OUTLINE, person } from './buyerArt';

export const SCRAPPER_W = BUYER_W;
export const SCRAPPER_H = BUYER_H;

/** Press frame box (posts, top beam, base with a cube of scrap). The plate is a separate texture. */
export const PRESS_W = 80;
export const PRESS_H = 96;
export const PLATE_W = 64;
export const PLATE_H = 14;

/** The Scrapper: grey overalls, orange hard hat with goggles, a big wrench. */
export function paintScrapper(ctx: CanvasRenderingContext2D): void {
  const cx = SCRAPPER_W / 2 - 4;
  const { headY, headR } = person(ctx, cx, 1, { shirt: '#6b7280', pants: '#4b5563', skin: '#e0ac85', hair: '#4a3222' });
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = OUTLINE;
  // Overall bib and straps.
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(cx - 8, headY + 20, 16, 12);
  ctx.fillStyle = '#f5b700';
  ctx.fillRect(cx - 3, headY + 24, 6, 4);
  // Hard hat (Rust Orange) with a brim.
  ctx.fillStyle = '#e8762b';
  ctx.beginPath();
  ctx.arc(cx, headY - 3, headR + 1, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(cx - headR - 4, headY - 4, (headR + 4) * 2, 3.5);
  // Goggles pushed up on the hat.
  ctx.fillStyle = '#60a5fa';
  ctx.strokeStyle = '#1e2430';
  ctx.lineWidth = 1.5;
  for (const dx of [-4.5, 4.5]) {
    ctx.beginPath();
    ctx.arc(cx + dx, headY - 8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Big wrench in the right hand, resting on the shoulder.
  const hx = cx + 16;
  const hy = headY + 39;
  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx + 8, hy - 30);
  ctx.stroke();
  ctx.fillStyle = '#9ca3af';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(hx + 8.5, hy - 33, 5.5, Math.PI * 0.85, Math.PI * 2.15);
  ctx.fill();
  ctx.stroke();
  // Glove over the handle.
  ctx.fillStyle = '#f5b700';
  ctx.beginPath();
  ctx.arc(hx, hy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** The press frame: two posts, a top beam with a piston housing, a base plate, and a crushed cube beside it. */
export function paintPress(ctx: CanvasRenderingContext2D): void {
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = OUTLINE;
  const base = PRESS_H - 6;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(PRESS_W / 2, base + 3, 38, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Posts.
  ctx.fillStyle = '#4a5263';
  for (const x of [8, PRESS_W - 18]) {
    ctx.beginPath();
    ctx.roundRect(x, 14, 10, base - 14, 2);
    ctx.fill();
    ctx.stroke();
  }
  // Top beam with hazard stripes.
  ctx.fillStyle = '#2b2f36';
  ctx.beginPath();
  ctx.roundRect(2, 6, PRESS_W - 4, 14, 3);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(4, 8, PRESS_W - 8, 10);
  ctx.clip();
  ctx.fillStyle = '#f5b700';
  for (let x = -6; x < PRESS_W; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, 18);
    ctx.lineTo(x + 6, 18);
    ctx.lineTo(x + 12, 8);
    ctx.lineTo(x + 6, 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Piston rod (the plate hangs from it).
  ctx.fillStyle = '#d1d5db';
  ctx.fillRect(PRESS_W / 2 - 3, 20, 6, 14);
  // Base plate.
  ctx.fillStyle = '#374151';
  ctx.beginPath();
  ctx.roundRect(0, base - 8, PRESS_W, 8, 2);
  ctx.fill();
  ctx.stroke();
}

/** The press plate (moves down when the Scrapper crushes). */
export function paintPlate(ctx: CanvasRenderingContext2D): void {
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUTLINE;
  ctx.fillStyle = '#6b7280';
  ctx.beginPath();
  ctx.roundRect(1, 1, PLATE_W - 2, PLATE_H - 2, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f5b700';
  ctx.fillRect(4, PLATE_H - 5, PLATE_W - 8, 2);
}
