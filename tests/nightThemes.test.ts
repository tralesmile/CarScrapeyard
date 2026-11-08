// P1.3d3c: Motor City's night-time neon look for the yard, garage, lot and paint shop.
import { describe, expect, it } from 'vitest';
import { YARD_NIGHT, YARD_THEMES, neonSigns, skylineTowers, starField, yardTheme } from '../src/game/backdropArt';
import { LOT_NIGHT, LOT_THEMES, lotSkyline, lotTheme } from '../src/game/carlotArt';
import { GARAGE_NIGHT, GARAGE_THEMES, garageTheme } from '../src/game/garageArt';
import { BOOTH_NIGHT, BOOTH_THEMES, boothTheme } from '../src/game/paintArt';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};
const SCREENS = [[320, 568, 2], [375, 667, 2], [430, 932, 3], [1440, 900, 1]] as const;

describe('Motor City at night', () => {
  it('only Motor City changes at night; Rust Valley keeps its daylight themes', () => {
    expect(yardTheme('rustValley', true)).toBe(YARD_THEMES.rustValley);
    expect(yardTheme('motorCity', true)).toBe(YARD_NIGHT);
    expect(yardTheme('motorCity', false)).toBe(YARD_THEMES.motorCity);
    expect(garageTheme({ city: 'rustValley', night: true })).toBe(GARAGE_THEMES.rustValley);
    expect(garageTheme({ city: 'motorCity', night: true })).toBe(GARAGE_NIGHT);
    expect(lotTheme({ city: 'rustValley', night: true })).toBe(LOT_THEMES.rustValley);
    expect(lotTheme({ city: 'motorCity', night: true })).toBe(LOT_NIGHT);
    expect(boothTheme({ city: 'rustValley', night: true })).toBe(BOOTH_THEMES.rustValley);
    expect(boothTheme({ city: 'motorCity', night: true })).toBe(BOOTH_NIGHT);
    expect(boothTheme({ city: 'motorCity' })).toBe(BOOTH_THEMES.motorCity);
  });

  it('night skies are darker than the day skies at the top', () => {
    expect(lum(YARD_NIGHT.sky[0])).toBeLessThan(lum(YARD_THEMES.motorCity.sky[0]) * 0.3);
    expect(lum(LOT_NIGHT.sky[0])).toBeLessThan(lum(LOT_THEMES.motorCity.sky[0]) * 0.3);
    expect(lum(GARAGE_NIGHT.street.sky[0])).toBeLessThan(lum(GARAGE_THEMES.motorCity.street.sky[0]) * 0.3);
  });

  it('towers stand out from the night sky, and far towers from near ones', () => {
    for (const c of YARD_NIGHT.towers.far) expect(contrast(c, YARD_NIGHT.sky[0])).toBeGreaterThan(1.4);
    for (const c of YARD_NIGHT.towers.near) expect(lum(c)).toBeLessThan(Math.min(...YARD_NIGHT.towers.far.map(lum)));
    const [far, near] = LOT_NIGHT.rows;
    expect(contrast(far![0], LOT_NIGHT.sky[0])).toBeGreaterThan(1.4);
    expect(lum(near![0])).toBeLessThan(lum(far![0]));
  });

  it('the work bay, signs and lettering keep their daytime colours (readable at night)', () => {
    // The lot's sign band and the booth's sign are drawn from constants, not the theme; the garage wall stays lit.
    expect(contrast(GARAGE_NIGHT.wall[1], '#ffffff')).toBeGreaterThan(4.5);
    expect(BOOTH_NIGHT.light).toBe(BOOTH_THEMES.motorCity.light);
    expect(BOOTH_NIGHT.floor).toEqual(BOOTH_THEMES.motorCity.floor);
  });

  for (const [cw, ch, s] of SCREENS) {
    it(`the lot's skyline has the same layout by day and night (${cw}x${ch})`, () => {
      const L = { w: cw * s, s, floorY: ch * s * 0.35, city: 'motorCity' as const };
      expect(lotSkyline({ ...L, night: true } as typeof L)).toEqual(lotSkyline(L));
    });

    it(`stars stay in the upper sky and across the width (${cw}x${ch})`, () => {
      const w = cw * s;
      const horizon = ch * s * 0.42;
      const stars = starField(w, horizon, s);
      expect(stars.length).toBeGreaterThanOrEqual(18);
      for (const st of stars) {
        expect(st.x).toBeGreaterThanOrEqual(0);
        expect(st.x).toBeLessThanOrEqual(w);
        expect(st.y).toBeLessThan(horizon * 0.6 + s * 4);
      }
      expect(Math.max(...stars.map((t) => t.x)) - Math.min(...stars.map((t) => t.x))).toBeGreaterThan(w * 0.7);
    });

    it(`a few near towers carry a neon sign, in more than one colour (${cw}x${ch})`, () => {
      const towers = skylineTowers(cw * s, ch * s * 0.42, s, YARD_NIGHT.towers);
      const signs = neonSigns(towers, s, YARD_NIGHT.night!.neon);
      expect(signs.length).toBeGreaterThanOrEqual(1);
      expect(signs.length).toBeLessThanOrEqual(Math.ceil(towers.filter((t) => t.layer === 1).length / 2));
      for (const n of signs) expect(n.tower.layer).toBe(1);
      if (signs.length > 1) expect(new Set(signs.map((n) => n.color)).size).toBeGreaterThan(1);
    });
  }

  it('the night skyline has the same shapes as the day skyline (only colours change)', () => {
    const day = skylineTowers(750, 280, 2);
    const night = skylineTowers(750, 280, 2, YARD_NIGHT.towers);
    expect(night.map(({ x, w, h }) => [x, w, h])).toEqual(day.map(({ x, w, h }) => [x, w, h]));
    expect(YARD_NIGHT.towers.litEvery).toBeLessThan(YARD_THEMES.motorCity.towers.litEvery);
  });
});
