// Car families (unlock order, arrival weights, expected value), car art geometry and haptics.

import { describe, expect, it } from 'vitest';
import { ECON, CLASSIC_NAMES, MODEL_NAMES, type CarFamily } from '../src/core/config';
import { expectedCarValue, familyUnlockedAt, familyWeights, unlockedFamilies } from '../src/core/formulas';
import { contractFamilies, generateContract } from '../src/core/contracts';
import { generateCar, sellCar, tick, type GameEvent } from '../src/core/sim';
import { deserialize, serialize } from '../src/core/save';
import { newGame, type Contract } from '../src/core/state';
import { SHAPES, WHEEL_Y, carTextureSize, mudSpots, pointInBody, pointInPolygon, scaled, seeded, shade, silhouetteOverlap, spoilerParts, SCOOP } from '../src/game/carArt';
import { HAPTIC_PATTERNS, Haptics } from '../src/platform/haptics';

const T0 = 1_800_000_000_000;
const FAMILIES = Object.keys(ECON.families) as CarFamily[];

describe('car families', () => {
  it('the four starter families are open from the first car; the rest unlock later in order of value', () => {
    expect(unlockedFamilies(0)).toEqual(['sedan', 'hatch', 'pickup', 'muscle']);
    const late = FAMILIES.filter((f) => ECON.families[f].unlockCarsSold > 0).sort(
      (a, b) => ECON.families[a].unlockCarsSold - ECON.families[b].unlockCarsSold,
    );
    expect(late).toEqual(['van', 'suv', 'sports', 'hyper']);
    for (let i = 1; i < late.length; i++) {
      expect(ECON.families[late[i]!].baseValue).toBeGreaterThan(ECON.families[late[i - 1]!].baseValue);
    }
    expect(unlockedFamilies(10_000)).toEqual(FAMILIES);
  });

  it('every family has art, model names and classic names', () => {
    for (const f of FAMILIES) {
      expect(SHAPES[f].body.length).toBeGreaterThanOrEqual(6);
      expect(MODEL_NAMES[f].length).toBeGreaterThan(0);
      expect(CLASSIC_NAMES[f].length).toBeGreaterThan(0);
    }
  });

  it('familyUnlockedAt names the family exactly at its threshold', () => {
    expect(familyUnlockedAt(0)).toBeNull();
    for (const f of FAMILIES) {
      const n = ECON.families[f].unlockCarsSold;
      if (n === 0) continue;
      expect(familyUnlockedAt(n)).toBe(f);
      expect(familyUnlockedAt(n + 1)).not.toBe(f);
    }
  });

  it('only unlocked families arrive, and rare families arrive at roughly their weight', () => {
    const s = newGame(T0, 5);
    s.nextCarId = 100;
    const early = new Set(Array.from({ length: 400 }, () => generateCar(s).family));
    expect([...early].sort()).toEqual(['hatch', 'muscle', 'pickup', 'sedan']);
    s.carsSold = 10_000;
    const counts: Record<string, number> = {};
    const N = 20_000;
    for (let i = 0; i < N; i++) {
      const f = generateCar(s).family;
      counts[f] = (counts[f] ?? 0) + 1;
    }
    const w = familyWeights(s.carsSold);
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    for (const f of FAMILIES) expect(counts[f]! / N).toBeCloseTo(w[f] / total, 1);
  });

  it('expected car value rises as pricier families unlock', () => {
    expect(expectedCarValue(1, 200)).toBeGreaterThan(expectedCarValue(1, 100));
    expect(expectedCarValue(1, 100)).toBeGreaterThan(expectedCarValue(1, 0));
  });

  it('selling the car that crosses a threshold announces the new family', () => {
    const s = newGame(T0, 3);
    s.carsSold = ECON.families.van.unlockCarsSold - 1;
    tick(s, 3);
    const car = s.cars[0]!;
    car.dirt = 0;
    car.damage = 0;
    const events: GameEvent[] = sellCar(s, car.id);
    expect(events).toContainEqual({ type: 'familyUnlocked', family: 'van' });
  });

  it('family orders only ask for unlocked, common families', () => {
    const s = newGame(T0, 9);
    expect(contractFamilies(s)).toEqual(['sedan', 'hatch', 'pickup', 'muscle']);
    s.carsSold = 10_000;
    expect(contractFamilies(s)).toEqual(['sedan', 'hatch', 'pickup', 'muscle', 'van', 'suv']);
    for (let seed = 1; seed < 300; seed++) {
      const g = newGame(T0, seed);
      g.carsSold = 50;
      const slot = { status: 'empty' } as Contract;
      g.contracts = [slot];
      generateContract(g, slot);
      if (slot.kind === 'sellFamily') expect(contractFamilies(g)).toContain(slot.family);
    }
  });

  it('saves with an unknown family or rarity drop that car instead of crashing the scene', () => {
    const s = newGame(T0, 2);
    tick(s, 3);
    expect(s.cars.length).toBe(1);
    (s.cars[0] as { family: string }).family = 'spaceship';
    expect(deserialize(serialize(s, T0), T0)!.state.cars).toEqual([]);
  });
});

describe('car art geometry', () => {
  const W = 720;
  const H = 360;

  it('wheels sit under the body and inside the texture', () => {
    for (const f of FAMILIES) {
      const sh = SHAPES[f];
      for (const fx of sh.wheels) {
        // The top of each tyre is inside the body (arches), the bottom inside the texture.
        expect(pointInBody(f, W, H, fx * W, (WHEEL_Y - sh.wheelR * 0.9) * H)).toBe(true);
        expect((WHEEL_Y + sh.wheelR) * H).toBeLessThan(H);
        expect(fx - sh.wheelR / 2).toBeGreaterThan(0);
      }
    }
  });

  it('windows sit inside the body', () => {
    for (const f of FAMILIES) {
      for (const win of SHAPES[f].windows) {
        const pts = scaled(win, W, H);
        const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
        const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        expect(pointInBody(f, W, H, cx, cy)).toBe(true);
      }
    }
  });

  it('point-in-polygon and shading work', () => {
    const sq: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    expect(pointInPolygon(sq, 5, 5)).toBe(true);
    expect(pointInPolygon(sq, 15, 5)).toBe(false);
    expect(shade(0x808080, -1)).toBe('#000000');
    expect(shade(0x808080, 1)).toBe('#ffffff');
    expect(shade(0x123456, 0)).toBe('#123456');
  });

  it('mud spots are deterministic per car and inside the body', () => {
    const a = mudSpots('van', W, H, 42);
    expect(a).toEqual(mudSpots('van', W, H, 42));
    expect(a.length).toBeGreaterThan(20);
    for (const p of a) expect(pointInBody('van', W, H, p.x, p.y)).toBe(true);
    const r = seeded(1);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('haptics', () => {
  it('vibrates with the pattern for each kind, throttles rapid repeats and respects the setting', () => {
    let t = 0;
    const calls: (number | number[])[] = [];
    const h = new Haptics((p) => (calls.push(p), true), () => t);
    expect(h.supported).toBe(true);
    expect(h.play('heavy')).toBe(true);
    expect(calls).toEqual([HAPTIC_PATTERNS.heavy]);
    t = 10;
    expect(h.play('heavy')).toBe(false); // too soon
    expect(h.play('tap')).toBe(true); // other kinds are independent
    t = 1000;
    h.enabled = false;
    expect(h.play('heavy')).toBe(false);
    expect(calls.length).toBe(2);
  });

  it('does nothing on devices without vibration, and survives a throwing backend', () => {
    const none = new Haptics(null);
    expect(none.supported).toBe(false);
    expect(none.play('tap')).toBe(false);
    const bad = new Haptics(() => {
      throw new Error('blocked');
    });
    expect(bad.play('tap')).toBe(false);
  });

  it('patterns stay short (subtle, not a buzz)', () => {
    for (const p of Object.values(HAPTIC_PATTERNS)) {
      const total = Array.isArray(p) ? p.reduce((a, b) => a + b, 0) : p;
      expect(total).toBeLessThanOrEqual(200);
    }
  });
});

describe('hypercar silhouette (P0.14h)', () => {
  it('reads apart from every other family above the shoulder line, the sports car included', () => {
    for (const f of FAMILIES) {
      if (f === 'hyper') continue;
      expect(silhouetteOverlap('hyper', f), f).toBeLessThan(0.66);
    }
  });

  it('is the lowest car, with a cab-forward canopy, a shark fin and a taller wing than the sports car', () => {
    const top = (f: CarFamily) => Math.min(...SHAPES[f].body.map((p) => p[1]));
    const roofX = (f: CarFamily) => {
      const t = top(f);
      const xs = SHAPES[f].body.filter((p) => p[1] <= t + 0.02).map((p) => p[0]);
      return (Math.min(...xs) + Math.max(...xs)) / 2;
    };
    for (const f of FAMILIES) if (f !== 'hyper') expect(top('hyper'), f).toBeGreaterThan(top(f));
    expect(roofX('hyper')).toBeGreaterThan(roofX('sports') + 0.02);
    expect(SHAPES.hyper.fin).toBe(true);
    expect(SHAPES.sports.fin).toBeFalsy();
    expect(spoilerParts('big').wing[0]![1]).toBeLessThan(spoilerParts('small').wing[0]![1]);
  });

  it('car textures are powers of two (for mipmaps) and follow the bay size', () => {
    const pot = (n: number) => (n & (n - 1)) === 0;
    for (const px of [300, 430, 760, 1290]) {
      const t = carTextureSize(px);
      expect(pot(t.w) && pot(t.h)).toBe(true);
      expect(t.w).toBe(t.h * 2);
    }
    expect(carTextureSize(430).w).toBe(512);
    expect(carTextureSize(1290).w).toBe(1024);
  });
});

describe('family silhouettes (P1.1x)', () => {
  it('muscle vs sports and hatch vs SUV read apart (were 0.83 and 0.86)', () => {
    expect(silhouetteOverlap('muscle', 'sports')).toBeLessThan(0.72);
    expect(silhouetteOverlap('hatch', 'suv')).toBeLessThan(0.72);
  });

  it('no two families share more than 82% of their outline above the shoulder line', () => {
    for (let i = 0; i < FAMILIES.length; i++)
      for (let j = i + 1; j < FAMILIES.length; j++) {
        const a = FAMILIES[i]!;
        const b = FAMILIES[j]!;
        expect(silhouetteOverlap(a, b), `${a}/${b}`).toBeLessThan(0.82);
      }
  });

  it('the muscle car has a hood scoop on its bonnet, ahead of the windscreen', () => {
    expect(SHAPES.muscle.scoop).toBe(true);
    const screenFoot = Math.max(...SHAPES.muscle.windows[0]!.map((p) => p[0]));
    for (const [x] of SCOOP) expect(x).toBeGreaterThan(screenFoot + 0.05);
  });
});
