// Canvas 2D backdrop layout (P0.14h).

import { describe, expect, it } from 'vitest';
import { YARD_THEMES, fencePosts, hillHeight, junkPiles, skylineTowers } from '../src/game/backdropArt';
import { ECON } from '../src/core/config';

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

  describe('Motor City yard (P1.3d3)', () => {
    for (const [w, horizon, s] of [[320, 150, 1], [390, 260, 1], [1170, 780, 3], [1440, 300, 1]] as const) {
      it(`the skyline covers the width in two rows and leaves sky above the tallest tower (${w}x${horizon}, dpr ${s})`, () => {
        const towers = skylineTowers(w, horizon, s);
        for (const layer of [0, 1] as const) {
          const row = towers.filter((t) => t.layer === layer).sort((a, b) => a.x - b.x);
          expect(row[0]!.x).toBeLessThanOrEqual(0);
          const last = row[row.length - 1]!;
          expect(last.x + last.w).toBeGreaterThanOrEqual(w);
          // No gaps wider than a street between neighbours.
          for (let i = 1; i < row.length; i++) expect(row[i]!.x - (row[i - 1]!.x + row[i - 1]!.w)).toBeLessThanOrEqual(s * 14);
        }
        for (const t of towers) {
          expect(t.h).toBeGreaterThan(0);
          expect(t.h).toBeLessThanOrEqual(horizon * 0.8);
          expect(t.w).toBeGreaterThan(s * 20);
        }
        // The far row mostly peeks out above the near one, so the skyline reads as layered.
        const near = towers.filter((t) => t.layer === 1);
        const far = towers.filter((t) => t.layer === 0);
        let peeks = 0;
        for (const f of far) {
          const cx = f.x + f.w / 2;
          const n = near.find((t) => cx >= t.x && cx <= t.x + t.w);
          if (!n || f.h > n.h) peeks++;
        }
        expect(peeks / far.length).toBeGreaterThan(0.5);
      });
    }

    it('every city has a yard theme and Motor City is steel blue, not the dusty town', () => {
      for (const id of Object.keys(ECON.cities.list)) expect(YARD_THEMES[id as keyof typeof YARD_THEMES]).toBeTruthy();
      const mc = YARD_THEMES.motorCity;
      const rv = YARD_THEMES.rustValley;
      const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      // Asphalt: blue above red, unlike the warm dirt.
      for (const g of mc.ground) {
        const [r, , b] = rgb(g);
        expect(b!).toBeGreaterThan(r!);
      }
      for (const g of rv.ground) {
        const [r, , b] = rgb(g);
        expect(r!).toBeGreaterThan(b!);
      }
      expect(mc.mesh).not.toBeNull();
      expect(rv.mesh).toBeNull();
    });
  });
});
