import { describe, expect, it } from 'vitest';
import { ECON, PAINTS } from '../src/core/config';
import { buyBooth, generatePaintJob, paintTap } from '../src/core/paint';
import { newGame } from '../src/core/state';
import { SHAPES } from '../src/game/carArt';
import {
  BOOTH_AREA_TOP,
  BOOTH_ROW,
  boothSign,
  exhaustSpot,
  fanSpots,
  grateRect,
  serviceLevel,
  serviceReveal,
  stepProgress,
  TICKET,
  ticketTop,
  ticketWidth,
  wrapAccent,
  type BoothLayout,
} from '../src/game/paintArt';
import { cityMapSvg } from '../src/ui/cityMap';

const ROOF = Math.min(...Object.values(SHAPES).map((sh) => Math.min(...sh.body.map((p) => p[1]))));

/** Same geometry as PaintScene.focusArea/drawBackground: HUD 62 CSS px tall, panel 264 CSS px. */
function layout(w: number, h: number, s: number, hudTop = 62): BoothLayout {
  const cssW = w / s;
  const cssH = h / s;
  const top = hudTop + BOOTH_AREA_TOP;
  const bottom = cssH - 264;
  const carWc = Math.min(cssW * 0.8, 400);
  const cy = top + (bottom - top) * 0.55;
  return {
    w,
    h,
    floorY: s * (top + (cy - top) * 0.62),
    s,
    stage: { cx: w / 2, groundY: s * (cy + carWc * 0.13), carW: carWc * s },
    sign: 'PAINT & TUNING',
    reservedTop: s * (hudTop + BOOTH_ROW.y + BOOTH_ROW.h / 2 + 4),
    // As in the scene: the sign is laid out above the order ticket, which sits on the roof.
    roofY: s * (ticketTop(cy - carWc / 4 + ROOF * (carWc / 2)) - 4),
  };
}

function carRoof(w: number, h: number, s: number, hudTop = 62): number {
  const top = hudTop + BOOTH_AREA_TOP;
  const bottom = h / s - 264;
  const carWc = Math.min((w / s) * 0.8, 400);
  const cy = top + (bottom - top) * 0.55;
  return cy - carWc / 4 + ROOF * (carWc / 2);
}

const T0 = 1_700_000_000_000;

function openShop() {
  const s = newGame(T0, 7);
  s.businesses.opened.paint = true;
  return s;
}

describe('paint booth backdrop layout', () => {
  for (const [w, h, s] of [
    [390 * 3, 664 * 3, 3],
    [360 * 2, 640 * 2, 2],
    [375 * 2, 560 * 2, 2],
    [1280, 800, 1],
  ] as const) {
    it(`sign, fans and grate fit (${w}x${h})`, () => {
      const L = layout(w, h, s);
      const b = boothSign(L);
      expect(b.y).toBeGreaterThanOrEqual(L.reservedTop);
      // A very short phone (560 CSS px) has no room between the booth row and the ticket: the sign becomes a thin strip
      // and the ticket may cover it. Every taller screen keeps them apart.
      const roomy = h / s >= 600;
      if (roomy) expect(b.y + b.h).toBeLessThanOrEqual(L.roofY);
      if (h / s >= 640) expect(b.sign).toBe(true);
      // The ticket stays clear of the sign, overlaps the roof only a little, and fits across the screen.
      const roof = carRoof(w, h, s);
      if (roomy) expect(b.y + b.h).toBeLessThanOrEqual(s * ticketTop(roof));
      else expect(b.sign).toBe(false);
      expect(roof - ticketTop(roof) - TICKET.h).toBeLessThanOrEqual(TICKET.overlap);
      expect(ticketWidth(3)).toBeLessThanOrEqual(w / s - 16);
      for (const f of fanSpots(L)) {
        expect(f.x - f.r).toBeGreaterThanOrEqual(0);
        expect(f.x + f.r).toBeLessThanOrEqual(w);
        expect(f.y + f.r).toBeLessThanOrEqual(L.floorY);
        expect(f.y - f.r).toBeGreaterThanOrEqual(b.y + b.h - 1);
      }
      // The fans sit beside the car, not behind it (on a phone the car covers the middle of the wall).
      const [l, r] = fanSpots(L);
      expect(l!.x).toBeLessThan(L.stage.cx - L.stage.carW * 0.3);
      expect(r!.x).toBeGreaterThan(L.stage.cx + L.stage.carW * 0.3);
      const g = grateRect(L);
      expect(g.x + g.w / 2).toBeCloseTo(L.stage.cx, 5);
      expect(g.y).toBeLessThan(L.stage.groundY);
      expect(g.y + g.h).toBeGreaterThan(L.stage.groundY);
    });
  }
});

describe('service reveal (what the car shows while it is worked on)', () => {
  it('each layer grows with its own service and stays once done', () => {
    const job = { services: ['respray', 'rims', 'tune'] as const, step: 0, work: ECON.paint.services.respray.work };
    const j = { ...job, services: [...job.services] };
    expect(serviceReveal(j)).toEqual({ colour: 0, stripes: 0, rims: 0, tune: 0 });
    j.work = ECON.paint.services.respray.work / 2;
    expect(serviceReveal(j).colour).toBeCloseTo(0.5, 5);
    expect(serviceReveal(j).rims).toBe(0);
    j.step = 1;
    j.work = ECON.paint.services.rims.work * 0.25;
    expect(serviceReveal(j)).toMatchObject({ colour: 1, rims: 0.75, tune: 0, stripes: 0 });
    j.step = 3;
    j.work = 0;
    expect(serviceReveal(j)).toEqual({ colour: 1, stripes: 0, rims: 1, tune: 1 });
  });

  it('a wrap brings the new colour too; services not ordered never show', () => {
    const j = { services: ['wrap'], step: 0, work: ECON.paint.services.wrap.work * 0.4 } as const;
    const r = serviceReveal({ ...j, services: [...j.services] });
    expect(r.colour).toBeCloseTo(0.6, 5);
    expect(r.stripes).toBeCloseTo(0.6, 5);
    expect(r.rims).toBe(0);
    expect(serviceLevel({ services: ['rims'], step: 0, work: 1 }, 'tune')).toBe(0);
    expect(stepProgress({ services: ['rims'], step: 1, work: 0 })).toBe(1);
  });

  it('follows the real rules: tapping an order through moves every ordered layer to 1', () => {
    const s = openShop();
    s.paint.levels.booth = 1;
    const job = generatePaintJob(s);
    s.paint.jobs.push(job);
    s.paint.focusedId = job.id;
    let last = -1;
    const seen = { ...serviceReveal(job) };
    for (let i = 0; i < 200 && s.paint.jobs.length > 0; i++) {
      const r = serviceReveal(job);
      const total = r.colour + r.stripes + r.rims + r.tune;
      expect(total).toBeGreaterThanOrEqual(last - 1e-9); // never goes backwards
      last = total;
      Object.assign(seen, r);
      paintTap(s, job.id);
    }
    expect(s.paint.jobs.length).toBe(0);
    const final = serviceReveal({ ...job, step: job.services.length, work: 0 });
    for (const k of job.services) {
      if (k === 'respray') expect(final.colour).toBe(1);
      if (k === 'wrap') expect(final.stripes).toBe(1);
      if (k === 'rims') expect(final.rims).toBe(1);
      if (k === 'tune') expect(final.tune).toBe(1);
    }
  });
});

describe('paint art helpers', () => {
  it('wrap stripes contrast with the new paint', () => {
    expect(wrapAccent(0xf2f4f7)).toBe('#1e2430');
    expect(wrapAccent(0xf5b700)).toBe('#1e2430');
    expect(wrapAccent(0x2b2f36)).toBe('#fbf3e4');
    expect(wrapAccent(0x3b82f6)).toBe('#fbf3e4');
    for (const p of PAINTS) expect(['#1e2430', '#fbf3e4']).toContain(wrapAccent(p));
  });

  it('the exhaust flame comes out behind every car', () => {
    for (const f of Object.keys(SHAPES) as (keyof typeof SHAPES)[]) {
      const [x, y] = exhaustSpot(f);
      const back = Math.min(...SHAPES[f].body.map((p) => p[0]));
      expect(x).toBeLessThan(back);
      expect(x).toBeGreaterThan(-0.05);
      expect(y).toBeGreaterThan(0.6);
    }
  });

  it('the map shop grows with booths: a second door at 2, a roof sign at 3', () => {
    const s = openShop();
    s.cash = 1e12;
    const plot = () => {
      const svg = cityMapSvg(s);
      return svg.slice(svg.indexOf('data-biz="paint"'));
    };
    expect(plot()).not.toContain('class="t2"');
    expect(buyBooth(s)).toBe(true);
    expect(plot()).toContain('class="t2"');
    expect(plot()).not.toContain('class="t3"');
    expect(buyBooth(s)).toBe(true);
    expect(plot()).toContain('class="t3"');
  });
});
