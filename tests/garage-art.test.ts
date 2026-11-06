import { describe, expect, it } from 'vitest';
import { doorRect, liftPosts, pegboardRect, type GarageLayout } from '../src/game/garageArt';

function layout(w: number, h: number, s: number): GarageLayout {
  const carW = Math.min(w * 0.8, 400 * s);
  return { w, h, floorY: h * 0.42, s, lift: { cx: w / 2, groundY: h * 0.55, carW }, sign: '' };
}

describe('garage backdrop layout', () => {
  for (const [w, h, s] of [
    [390 * 3, 664 * 3, 3],
    [360 * 2, 640 * 2, 2],
    [1280, 800, 1],
  ] as const) {
    it(`door and pegboard sit on the wall without overlapping (${w}x${h})`, () => {
      const L = layout(w, h, s);
      const d = doorRect(L);
      const p = pegboardRect(L);
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.y + d.h).toBeCloseTo(L.floorY, 5);
      expect(d.y).toBeGreaterThan(0);
      expect(p.x + p.w).toBeLessThanOrEqual(w);
      expect(p.y + p.h).toBeLessThan(L.floorY);
      expect(d.x + d.w).toBeLessThan(p.x);
    });

    it(`lift posts stand just outside the car (${w}x${h})`, () => {
      const L = layout(w, h, s);
      const [l, r] = liftPosts(L);
      expect(l).toBeLessThan(L.lift.cx - L.lift.carW / 2);
      expect(r).toBeGreaterThan(L.lift.cx + L.lift.carW / 2);
      expect(l).toBeGreaterThan(0);
      expect(r).toBeLessThan(w);
    });
  }
});
