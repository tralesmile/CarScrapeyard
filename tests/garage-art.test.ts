import { describe, expect, it } from 'vitest';
import { SHAPES } from '../src/game/carArt';
import { LIFT_RISE, customerKind, doorRect, liftBeam, liftPosts, pegboardRect, type GarageLayout } from '../src/game/garageArt';

const ROOF = Math.min(...Object.values(SHAPES).map((sh) => Math.min(...sh.body.map((p) => p[1]))));

/** Same geometry as GarageScene.focusArea/drawBackground: HUD 62 CSS px tall, panel + sell gap 264 CSS px. */
function layout(w: number, h: number, s: number, hudTop = 62): GarageLayout {
  const cssW = w / s;
  const cssH = h / s;
  const top = hudTop + 96;
  const bottom = cssH - 264;
  const carWc = Math.min(cssW * 0.8, 400);
  const cy = top + (bottom - top) * 0.55;
  return {
    w,
    h,
    floorY: s * (top + (cy - top) * 0.62),
    s,
    lift: { cx: w / 2, groundY: s * (cy + carWc * 0.13), carW: carWc * s },
    sign: 'REPAIR GARAGE',
    reservedTop: s * (hudTop + 86),
    roofY: s * (cy - carWc / 4 + ROOF * (carWc / 2) - LIFT_RISE),
  };
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

  it('the lift beam carries the sign between the bay row and the tallest raised car on common phones', () => {
    for (const [cw, ch] of [
      [390, 664],
      [390, 844],
      [414, 896],
      [360, 740],
    ] as const) {
      const L = layout(cw * 3, ch * 3, 3);
      const b = liftBeam(L);
      expect(b.sign, `${cw}x${ch}`).toBe(true);
      expect(b.y).toBeGreaterThanOrEqual(L.reservedTop);
      expect(b.y + b.h).toBeLessThan(L.roofY);
    }
  });

  it('a screen too short for lettering keeps a thin beam that still clears the car', () => {
    const L = layout(360 * 2, 560 * 2, 2);
    const b = liftBeam(L);
    expect(b.y + b.h).toBeLessThan(L.roofY);
    if (!b.sign) expect(b.h).toBeLessThan(L.s * 10);
  });

  it('customers cycle through every buyer look and stay the same for a job', () => {
    const kinds = new Set(Array.from({ length: 12 }, (_, i) => customerKind(i)));
    expect(kinds.size).toBe(6);
    expect(customerKind(7)).toBe(customerKind(7));
    expect(customerKind(-1)).toBeTruthy();
  });
});

describe('customer car rust', () => {
  /** A canvas context that accepts every call and draws nothing. */
  const stub = new Proxy({} as Record<string, unknown>, {
    get: (_t, key) => (key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => undefined),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;

  it('is lighter than a scrapyard wreck', async () => {
    const { paintRust } = await import('../src/game/carArt');
    const { CUSTOMER_RUST } = await import('../src/game/garageArt');
    for (const fam of Object.keys(SHAPES) as (keyof typeof SHAPES)[]) {
      const wreck = paintRust(stub, fam, 512, 256, 11);
      const customer = paintRust(stub, fam, 512, 256, 11, CUSTOMER_RUST);
      expect(customer).toBeLessThanOrEqual(CUSTOMER_RUST.patches);
      expect(customer).toBeLessThan(wreck);
    }
  });
});
