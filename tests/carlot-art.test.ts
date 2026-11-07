import { describe, expect, it } from 'vitest';
import { ECON } from '../src/core/config';
import { SHAPES } from '../src/game/carArt';
import {
  CONDITION_RUST,
  LOT_AREA_TOP,
  PENNANTS,
  SPOT_ROW,
  buntingFlags,
  conditionStars,
  platformEllipse,
  showroomRect,
  signBand,
  type LotLayout,
} from '../src/game/carlotArt';
import { cityMapSvg } from '../src/ui/cityMap';
import { newGame } from '../src/core/state';

const ROOF = Math.min(...Object.values(SHAPES).map((sh) => Math.min(...sh.body.map((p) => p[1]))));

/** Same geometry as CarLotScene.focusArea/drawBackground: HUD 62 CSS px tall, panel + sell gap 264 CSS px. */
function layout(w: number, h: number, s: number, hudTop = 62): LotLayout {
  const cssW = w / s;
  const cssH = h / s;
  const top = hudTop + LOT_AREA_TOP;
  const bottom = cssH - 264;
  const carWc = Math.min(cssW * 0.8, 400);
  const cy = top + (bottom - top) * 0.55;
  return {
    w,
    h,
    floorY: s * (top + (cy - top) * 0.62),
    s,
    stage: { cx: w / 2, groundY: s * (cy + carWc * 0.13), carW: carWc * s },
    sign: 'USED CAR LOT',
    reservedTop: s * (hudTop + SPOT_ROW.y + SPOT_ROW.h / 2 + 4),
    roofY: s * (cy - carWc / 4 + ROOF * (carWc / 2)),
  };
}

describe('car lot backdrop layout', () => {
  for (const [w, h, s] of [
    [390 * 3, 664 * 3, 3],
    [360 * 2, 640 * 2, 2],
    [375 * 2, 560 * 2, 2],
    [1280, 800, 1],
  ] as const) {
    it(`sign sits between the spot row and the car roof (${w}x${h})`, () => {
      const L = layout(w, h, s);
      const b = signBand(L);
      expect(b.y).toBeGreaterThanOrEqual(L.reservedTop);
      expect(b.y + b.h).toBeLessThanOrEqual(L.roofY);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(w);
      if (h / s >= 640) expect(b.sign).toBe(true);
      const r = showroomRect(L);
      expect(r.y).toBeCloseTo(b.y + b.h, 5);
      expect(r.y + r.h).toBeCloseTo(L.floorY, 5);
    });

    it(`bunting stays on screen and the platform sits under the car (${w}x${h})`, () => {
      const L = layout(w, h, s);
      const flags = buntingFlags(L);
      expect(flags.length).toBeGreaterThan(5);
      for (const f of flags) {
        expect(f.x).toBeGreaterThan(0);
        expect(f.x).toBeLessThan(w);
        expect(f.y).toBeGreaterThanOrEqual(L.reservedTop);
      }
      const p = platformEllipse(L);
      expect(p.cx).toBe(w / 2);
      expect(p.rx).toBeGreaterThan(L.stage.carW / 2);
      expect(p.cy).toBeGreaterThan(L.floorY);
      expect(p.cy + p.ry).toBeLessThan(h);
    });
  }

  it('condition art: stars and rust go with the grade', () => {
    expect(conditionStars(1)).toBe('★☆☆☆☆');
    expect(conditionStars(5)).toBe('★★★★★');
    const grades = [1, 2, 3, 4, 5] as const;
    for (let i = 1; i < grades.length; i++) {
      expect(CONDITION_RUST[grades[i]!].patches).toBeLessThan(CONDITION_RUST[grades[i - 1]!].patches);
    }
    expect(new Set(PENNANTS).size).toBe(PENNANTS.length);
    expect(Object.keys(ECON.carlot.conditions)).toHaveLength(5);
  });
});

describe('car lot on the city map', () => {
  it('grows with forecourt spots: one row of cars, then two, then the gold balloon', () => {
    const s = newGame(0, 1);
    s.businesses.opened.carlot = true;
    const plot = (svg: string) => svg.slice(svg.indexOf('data-biz="carlot"'), svg.indexOf('data-biz="paint"'));
    const cars = (svg: string) => (plot(svg).match(/width="28" height="16"/g) ?? []).length;
    expect(cars(cityMapSvg(s))).toBe(3);
    s.carlot.spots = 3;
    expect(cars(cityMapSvg(s))).toBe(6);
    expect(plot(cityMapSvg(s))).not.toContain('class="t3"');
    s.carlot.spots = 4;
    expect(plot(cityMapSvg(s))).toContain('class="t3"');
  });
});

describe('walk-up buyer lines (P1.2c)', () => {
  it('every buyer type has short happy and plain lines, picked stably per car', async () => {
    const { LOT_BUYER_LINES, lotBuyerLine } = await import('../src/game/carlotArt');
    for (const kind of Object.keys(ECON.carlot.buyers) as (keyof typeof LOT_BUYER_LINES)[]) {
      const set = LOT_BUYER_LINES[kind];
      expect(set.likes.length).toBeGreaterThan(0);
      expect(set.plain.length).toBeGreaterThan(0);
      // Short enough for a speech bubble on a 360 px phone.
      for (const line of [...set.likes, ...set.plain]) expect(line.length).toBeLessThanOrEqual(30);
      expect(set.likes).toContain(lotBuyerLine(kind, 0.2, 3));
      expect(set.plain).toContain(lotBuyerLine(kind, 0, 3));
      expect(lotBuyerLine(kind, 0.2, 3)).toBe(lotBuyerLine(kind, 0.2, 3));
    }
  });
});
