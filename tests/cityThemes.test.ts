// P1.3d3b: the garage, the lot and the paint shop wear Motor City's colours (steel blue, a skyline outside).
import { describe, expect, it } from 'vitest';
import { ECON, type CityId } from '../src/core/config';
import { LOT_THEMES, lotSkyline } from '../src/game/carlotArt';
import { GARAGE_THEMES, doorRect, streetBuildings, type GarageLayout } from '../src/game/garageArt';
import { BOOTH_THEMES } from '../src/game/paintArt';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const cities = Object.keys(ECON.cities.list) as CityId[];

describe('city themes for the businesses', () => {
  it('every city has a garage, lot and booth theme', () => {
    for (const id of cities) {
      expect(GARAGE_THEMES[id]).toBeTruthy();
      expect(LOT_THEMES[id]).toBeTruthy();
      expect(BOOTH_THEMES[id]).toBeTruthy();
    }
  });

  it('the Motor City garage wall is steel blue, the Rust Valley wall teal', () => {
    for (const c of GARAGE_THEMES.motorCity.wall) {
      const [r, g, b] = rgb(c);
      expect(b).toBeGreaterThan(g);
      expect(b).toBeGreaterThan(r);
    }
    for (const c of GARAGE_THEMES.rustValley.wall) {
      const [, g, b] = rgb(c);
      expect(g).toBeGreaterThanOrEqual(b);
    }
  });

  it('Motor City towers outside the garage door are taller, lit and stay inside the door', () => {
    const L: GarageLayout = { w: 780, h: 1400, floorY: 600, s: 2, lift: { cx: 390, groundY: 860, carW: 600 }, sign: 'X', reservedTop: 300, roofY: 500 };
    const d = doorRect(L);
    const rv = streetBuildings(d, GARAGE_THEMES.rustValley, 2);
    const mc = streetBuildings(d, GARAGE_THEMES.motorCity, 2);
    expect(GARAGE_THEMES.motorCity.windows).not.toBeNull();
    expect(GARAGE_THEMES.rustValley.windows).toBeNull();
    expect(Math.max(...mc.map((b) => b.h))).toBeGreaterThan(Math.max(...rv.map((b) => b.h)));
    for (const b of [...rv, ...mc]) {
      expect(b.x).toBeGreaterThanOrEqual(d.x);
      expect(b.x + b.w).toBeLessThanOrEqual(d.x + d.w);
      // Below the rolled-up slats (3 x 6 px x s) and above the pavement line at 78%.
      expect(b.h).toBeLessThan(d.h * 0.78 - 18 * 2);
    }
  });

  it('the lot skyline covers the width, varies in height and leaves sky above it', () => {
    for (const city of cities)
      for (const [w, s, floorY] of [
        [640, 2, 520],
        [1170, 3, 900],
        [1440, 1, 300],
      ] as const) {
        const towers = lotSkyline({ w, s, floorY, city });
        const rows = LOT_THEMES[city].rows.length;
        for (let r = 0; r < rows; r++) {
          const row = towers.filter((t) => t.row === r);
          expect(row[0]!.x).toBeLessThanOrEqual(0);
          const last = row[row.length - 1]!;
          expect(last.x + last.w + 2 * s).toBeGreaterThanOrEqual(w);
          const hs = row.map((t) => t.h);
          // Not one flat wall: at least 25% spread between the shortest and the tallest (unless capped).
          if (Math.max(...hs) < floorY * 0.8) expect(Math.max(...hs) / Math.min(...hs)).toBeGreaterThan(1.25);
          for (const h of hs) expect(h).toBeLessThanOrEqual(floorY * 0.8);
        }
      }
    // Motor City's far towers rise higher than Rust Valley's.
    const tallest = (city: CityId) => Math.max(...lotSkyline({ w: 780, s: 2, floorY: 1000, city }).map((t) => t.h));
    expect(tallest('motorCity')).toBeGreaterThan(tallest('rustValley'));
  });

  it('the Motor City booth is cooler (bluer) and has an accent stripe', () => {
    for (const c of BOOTH_THEMES.motorCity.wall) {
      const [r, , b] = rgb(c);
      expect(b - r).toBeGreaterThan(50);
    }
    const [r, , b] = rgb(BOOTH_THEMES.rustValley.wall[0]);
    expect(b - r).toBeLessThan(50);
    expect(BOOTH_THEMES.motorCity.stripe).not.toBeNull();
    expect(BOOTH_THEMES.rustValley.stripe).toBeNull();
  });
});
