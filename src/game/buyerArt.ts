// Customers drawn in code (Canvas 2D): one little figure per buyer personality.
// Coordinates are in a 64 x 128 box, feet at the bottom centre; the caller scales the context.

import type { BuyerKind } from '../core/config';

export const BUYER_W = 64;
export const BUYER_H = 128;

interface Look {
  shirt: string;
  pants: string;
  skin: string;
  hair: string;
}

const LOOKS: Record<BuyerKind, Look> = {
  bargain: { shirt: '#3bc45a', pants: '#4b5563', skin: '#f1c7a1', hair: '#6b4423' },
  collector: { shirt: '#2b2f36', pants: '#1e2430', skin: '#e8b894', hair: '#d1d5db' },
  speed: { shirt: '#e5484d', pants: '#1f2937', skin: '#c68863', hair: '#111827' },
  family: { shirt: '#3b82f6', pants: '#374151', skin: '#f3d2b3', hair: '#a16207' },
  tradie: { shirt: '#e8762b', pants: '#1e3a5f', skin: '#d9a07a', hair: '#3f2a1d' },
  influencer: { shirt: '#ec4899', pants: '#f2f4f7', skin: '#f0c8a8', hair: '#f5b700' },
};

const OUTLINE = '#1e2430';

function person(ctx: CanvasRenderingContext2D, x: number, scale: number, look: Look): { headY: number; headR: number } {
  const s = scale;
  const foot = BUYER_H - 4;
  const legH = 30 * s;
  const bodyH = 34 * s;
  const bodyW = 26 * s;
  const headR = 11 * s;
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = OUTLINE;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, foot + 1, 15 * s, 3.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs.
  ctx.fillStyle = look.pants;
  for (const dx of [-6 * s, 6 * s]) {
    ctx.beginPath();
    ctx.roundRect(x + dx - 4.5 * s, foot - legH, 9 * s, legH, 3 * s);
    ctx.fill();
    ctx.stroke();
  }
  // Body.
  const bodyTop = foot - legH - bodyH + 4 * s;
  ctx.fillStyle = look.shirt;
  ctx.beginPath();
  ctx.roundRect(x - bodyW / 2, bodyTop, bodyW, bodyH, 9 * s);
  ctx.fill();
  ctx.stroke();
  // Arms.
  ctx.strokeStyle = look.shirt;
  ctx.lineWidth = 7 * s;
  ctx.beginPath();
  ctx.moveTo(x - bodyW / 2 + 2 * s, bodyTop + 8 * s);
  ctx.lineTo(x - bodyW / 2 - 3 * s, bodyTop + 26 * s);
  ctx.moveTo(x + bodyW / 2 - 2 * s, bodyTop + 8 * s);
  ctx.lineTo(x + bodyW / 2 + 3 * s, bodyTop + 26 * s);
  ctx.stroke();
  ctx.fillStyle = look.skin;
  for (const dx of [-bodyW / 2 - 3 * s, bodyW / 2 + 3 * s]) {
    ctx.beginPath();
    ctx.arc(x + dx, bodyTop + 27 * s, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // Head.
  const headY = bodyTop - headR + 2 * s;
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = OUTLINE;
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(x, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Hair.
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  ctx.arc(x, headY - 2 * s, headR, Math.PI * 1.05, Math.PI * 1.95);
  ctx.closePath();
  ctx.fill();
  // Eyes and smile.
  ctx.fillStyle = OUTLINE;
  for (const dx of [-4 * s, 4 * s]) {
    ctx.beginPath();
    ctx.arc(x + dx, headY + 1 * s, 1.4 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x, headY + 3.5 * s, 4 * s, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  return { headY, headR };
}

/** Paint one buyer (the Family is an adult with a kid). */
export function paintBuyer(ctx: CanvasRenderingContext2D, kind: BuyerKind): void {
  const look = LOOKS[kind];
  const cx = kind === 'family' ? 26 : BUYER_W / 2;
  const { headY, headR } = person(ctx, cx, 1, look);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = OUTLINE;
  switch (kind) {
    case 'bargain': {
      // Cap and a coupon in hand.
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(cx, headY - 3, headR, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(cx, headY - 5, headR + 7, 4);
      ctx.fillStyle = '#fff3c4';
      ctx.fillRect(cx + 15, headY + 36, 11, 7);
      ctx.strokeRect(cx + 15, headY + 36, 11, 7);
      break;
    }
    case 'collector': {
      // Top hat and monocle.
      ctx.fillStyle = '#111827';
      ctx.fillRect(cx - 15, headY - headR + 1, 30, 4);
      ctx.fillRect(cx - 9, headY - headR - 15, 18, 17);
      ctx.fillStyle = '#e8762b';
      ctx.fillRect(cx - 9, headY - headR - 2, 18, 3);
      ctx.strokeStyle = '#f5b700';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx + 4, headY + 1, 3.5, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'speed': {
      // Sunglasses.
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.roundRect(cx - 9, headY - 2, 8, 5, 2);
      ctx.roundRect(cx + 1, headY - 2, 8, 5, 2);
      ctx.fill();
      ctx.fillRect(cx - 2, headY - 1, 4, 1.5);
      break;
    }
    case 'family': {
      // A kid holding hands.
      const kid = person(ctx, 50, 0.62, { ...look, shirt: '#f5b700', pants: '#3b82f6' });
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(50 + kid.headR, kid.headY - kid.headR * 0.6, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'tradie': {
      // Hard hat and hi-vis stripe.
      ctx.fillStyle = '#f5b700';
      ctx.beginPath();
      ctx.arc(cx, headY - 3, headR + 1, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(cx - headR - 4, headY - 4, (headR + 4) * 2, 3);
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(cx - 13, headY + 26, 26, 3);
      break;
    }
    case 'influencer': {
      // Phone held up for a selfie, and a sparkle.
      ctx.fillStyle = '#1e2430';
      ctx.beginPath();
      ctx.roundRect(cx + 15, headY - 6, 8, 13, 2);
      ctx.fill();
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(cx + 16.5, headY - 4, 5, 9);
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? 6 : 2;
        const a = (i / 8) * Math.PI * 2;
        ctx.lineTo(cx - 20 + Math.cos(a) * r, headY - 14 + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}
