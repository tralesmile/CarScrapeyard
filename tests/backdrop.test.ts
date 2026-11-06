// Canvas 2D backdrop layout (P0.14h).

import { describe, expect, it } from 'vitest';
import { fencePosts, hillHeight, junkPiles } from '../src/game/backdropArt';

describe('yard backdrop', () => {
  for (const [w, s] of [[390, 1], [1170, 3], [1440, 1]] as const) {
    it(`hills stay above the horizon and below the sky's top band (${w}px, dpr ${s})`, () => {
      for (let x = 0; x <= w; x += 5) {
        for (const layer of [0, 1] as const) {
          const hh = hillHeight(x, w, s, layer);
          expect(hh).toBeGreaterThan(0);
          expect(hh).toBeLessThan(s * 100);
        }
        // The near hills are lower than the far ones nearly everywhere, so both layers show.
      }
      let farShows = 0;
      for (let x = 0; x <= w; x += 5) if (hillHeight(x, w, s, 0) > hillHeight(x, w, s, 1)) farShows++;
      expect(farShows / (w / 5 + 1)).toBeGreaterThan(0.8);
    });

    it(`junk piles stay low and their tyres rest on them (${w}px)`, () => {
      const piles = junkPiles(w, 300, s);
      expect(piles.length).toBeGreaterThanOrEqual(3);
      for (const p of piles) {
        expect(p.h).toBeLessThan(s * 70);
        for (const [dx, dy] of p.tyres) {
          expect(Math.abs(dx)).toBeLessThan(p.hw * 0.6);
          // Inside the mound: higher tyres sit nearer the peak.
          expect(-dy).toBeLessThan(p.h * (1 - Math.abs(dx) / p.hw) * 0.9);
        }
      }
      // Nothing busy right behind the customer (0.88 of the width, about 14 CSS px either side).
      const cx = w * 0.88;
      for (const p of piles) {
        for (const [dx] of p.tyres) expect(Math.abs(p.x + dx - cx), 'tyre').toBeGreaterThan(s * 22);
        expect(Math.abs(p.x + p.panel - cx), 'panel').toBeGreaterThan(s * 30);
      }
    });
  }

  it('fence posts are evenly spaced across the whole width', () => {
    const xs = fencePosts(390 * 2, 2);
    expect(xs[0]).toBe(20);
    expect(xs[xs.length - 1]!).toBeGreaterThan(390 * 2 - 56);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeCloseTo(56);
  });
});
