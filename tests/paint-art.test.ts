import { describe, expect, it } from 'vitest';
import { ECON, PAINTS } from '../src/core/config';
import { t } from '../src/i18n';
import { buyBooth, generatePaintJob, paintTap } from '../src/core/paint';
import { newGame } from '../src/core/state';
import { SHAPES } from '../src/game/carArt';
import {
  BOOTH_ROW,
  BOOTH_ROW_BOTTOM,
  boothSign,
  boothStage,
  customerFeet,
  MAX_OVERLAP,
  MIN_CAR_W,
  PAINT_LINES,
  paintLine,
  speechBox,
  exhaustSpot,
  fanSpots,
  grateRect,
  serviceLevel,
  serviceReveal,
  stepProgress,
  TICKET,
  ticketWidth,
  wrapAccent,
  type BoothLayout,
} from '../src/game/paintArt';
import { cityMapSvg } from '../src/ui/cityMap';

/** Same geometry as PaintScene.focusArea/drawBackground: HUD 62 CSS px tall, panel 264 CSS px. */
function stage(w: number, h: number, s: number, hudTop = 62) {
  return boothStage(w / s, hudTop, h / s - 264);
}

function layout(w: number, h: number, s: number, hudTop = 62): BoothLayout {
  const st = stage(w, h, s, hudTop);
  return {
    w,
    h,
    floorY: s * (st.top + (st.cy - st.top) * 0.62),
    s,
    stage: { cx: w / 2, groundY: s * (st.cy + st.carW * 0.13), carW: st.carW * s },
    sign: 'PAINT & TUNING',
    reservedTop: s * (hudTop + BOOTH_ROW.y + BOOTH_ROW.h / 2 + 4),
    // As in the scene: the sign is laid out above the order ticket, which sits on the roof.
    roofY: s * (st.ticketY - 4),
  };
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
      // Every screen, even a 560 CSS px phone (P1.2g), keeps the lettered sign between the booth row and the ticket.
      expect(b.y + b.h).toBeLessThanOrEqual(L.roofY);
      expect(b.sign).toBe(true);
      // The ticket stays clear of the sign, overlaps the roof only a little, and fits across the screen.
      const st = stage(w, h, s);
      expect(b.y + b.h).toBeLessThanOrEqual(s * st.ticketY);
      expect(st.ticketY + TICKET.h - st.roofY).toBeLessThanOrEqual(MAX_OVERLAP);
      if (h / s >= 640) expect(st.overlap).toBe(TICKET.overlap);
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

const PHONES = [
  [390, 664],
  [360, 640],
  [375, 560],
  [375, 540],
  [320, 568],
  [390, 844],
  [1280, 800],
] as const;

describe('booth stage on short phones (P1.2g)', () => {
  it('a 375x560 phone with the real panel (223 px + 64 px hint room) keeps the sign, a smaller car', () => {
    const st = boothStage(375, 60, 560 - 287);
    expect(st.ticketY).toBeGreaterThanOrEqual(60 + BOOTH_ROW_BOTTOM + 20);
    expect(st.carW).toBeLessThan(300);
    expect(st.carW).toBeGreaterThanOrEqual(MIN_CAR_W);
    expect(customerFeet(st, 375, 30).y).toBeLessThanOrEqual(st.bottom);
  });

  for (const [w, h] of PHONES) {
    it(`the ticket clears the booth row with room for the sign, the customer stands above the panel (${w}x${h})`, () => {
      const st = stage(w, h, 1);
      expect(st.ticketY).toBeGreaterThanOrEqual(62 + BOOTH_ROW_BOTTOM + 20);
      const feet = customerFeet(st, w, 30);
      expect(feet.y).toBeLessThanOrEqual(st.bottom);
      expect(st.cy - st.carW / 4).toBeGreaterThan(st.top - 30);
      expect(st.overlap).toBeLessThanOrEqual(MAX_OVERLAP);
    });
  }

  it('tall screens keep the old layout (car at 55%, normal overlap)', () => {
    const st = stage(390, 844, 1);
    expect(st.cy).toBeCloseTo(st.top + (st.bottom - st.top) * 0.55, 6);
    expect(st.overlap).toBe(TICKET.overlap);
  });
});

describe('customer speech bubble (P1.2g)', () => {
  const PERSON_H = 82;
  const PERSON_W = 30;
  const clear = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
    a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
  for (const [w, h] of PHONES)
    for (const services of [1, 2, 3])
      for (const text of [90, 160]) {
        it(`never covers the ticket and stays on screen (${w}x${h}, ${services} services, ${text} px line)`, () => {
          const st = stage(w, h, 1);
          const tw = ticketWidth(services);
          const ticket = { x: st.cx - tw / 2, y: Math.max(62 + TICKET.h / 2 + 4, st.ticketY + TICKET.h / 2) - TICKET.h / 2, w: tw, h: TICKET.h };
          const feet = customerFeet(st, w, PERSON_W);
          const head = { x: feet.x, y: feet.y - PERSON_H - 2 };
          for (const minTop of [66, 62 + BOOTH_ROW_BOTTOM]) {
            const b = speechBox({ w: text, h: 30, head, personW: PERSON_W, ticket, screenW: w, minTop });
            expect(clear(b, ticket)).toBe(true);
            expect(b.x).toBeGreaterThanOrEqual(0);
            expect(b.x + b.w).toBeLessThanOrEqual(w);
            expect(b.y).toBeGreaterThanOrEqual(Math.min(minTop, ticket.y + ticket.h));
            expect(b.y + b.h).toBeLessThanOrEqual(st.bottom);
            // The tail tip is near the customer's head.
            expect(Math.abs(b.tipX - head.x)).toBeLessThanOrEqual(PERSON_W / 2 + 10);
            expect(Math.abs(b.tipY - head.y)).toBeLessThanOrEqual(16);
          }
        });
      }

  it('says what the order is about, stable per order, the full works for three services', () => {
    expect(PAINT_LINES.respray.map((x) => t(x))).toContain(paintLine({ id: 4, services: ['respray'] }));
    expect(PAINT_LINES.tune.map((x) => t(x))).toContain(paintLine({ id: 4, services: ['tune', 'rims'] }));
    expect(PAINT_LINES.combo.map((x) => t(x))).toContain(paintLine({ id: 9, services: ['wrap', 'rims', 'tune'] }));
    expect(paintLine({ id: 12, services: ['rims'] })).toBe(paintLine({ id: 12, services: ['rims'] }));
    const seen = new Set([0, 1, 2, 3, 4, 5].map((id) => paintLine({ id, services: ['wrap'] })));
    expect(seen.size).toBe(PAINT_LINES.wrap.length);
    for (const lines of Object.values(PAINT_LINES)) for (const l of lines) expect(t(l).length).toBeLessThanOrEqual(26);
  });
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
