import { describe, expect, it } from 'vitest';
import { checksum, deserialize, serialize } from '../src/core/save';
import { tick, addCash } from '../src/core/sim';
import { garageTap, buyGarageUpgrade, buyGarageBay, hireForeman, focusJob } from '../src/core/garage';
import { buyLot, refurbTap, sellLotCar, holdLotCar, focusLotCar, buyCarLotUpgrade, buySpot, hireLotCrew } from '../src/core/carlot';
import { paintTap, focusPaintJob, buyPaintUpgrade, buyBooth, hirePainter, sendLotCarToShop } from '../src/core/paint';
import { newGame, type GameState } from '../src/core/state';

const T0 = 1_800_000_000_000;

function lcg(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

function walk(node: unknown, path: string, bad: string[]): void {
  if (typeof node === 'number' && !Number.isFinite(node)) bad.push(path);
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`, bad);
}

describe('fuzz: random actions in the garage, car lot and paint shop', () => {
  it('random business actions never throw or produce non-finite numbers', () => {
    let jobs = 0;
    let lotSold = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const rnd = lcg(seed * 104729);
      const s: GameState = newGame(T0, seed);
      s.cash = 1e12;
      s.lifetimeEarnings = 1e12;
      s.carsSold = 300;
      for (const id of Object.keys(s.businesses.opened) as (keyof typeof s.businesses.opened)[]) s.businesses.opened[id] = true;
      tick(s, 30);
      const pickOf = <T extends { id: number }>(list: T[]): T | undefined => list[Math.floor(rnd() * list.length)];
      for (let step = 0; step < 500; step++) {
        const pick = Math.floor(rnd() * 20);
        const j = pickOf(s.garage.jobs);
        const lc = pickOf(s.carlot.cars);
        const pj = pickOf(s.paint.jobs);
        try {
          switch (pick) {
            case 0: tick(s, rnd() * 30); break;
            case 1: if (j) garageTap(s, j.id); break;
            case 2: if (j) focusJob(s, j.id); break;
            case 3: buyGarageUpgrade(s, rnd() < 0.5 ? 'tools' : 'rep'); break;
            case 4: buyGarageBay(s); break;
            case 5: hireForeman(s); break;
            case 6: { const lot = s.carlot.board[Math.floor(rnd() * s.carlot.board.length)]; if (lot) buyLot(s, lot.id); break; }
            case 7: if (lc) refurbTap(s, lc.id); break;
            case 8: if (lc) sellLotCar(s, lc.id, 0.9 + rnd() * 0.4); break;
            case 9: holdLotCar(s, lc && rnd() < 0.7 ? lc.id : null); break;
            case 10: if (lc) focusLotCar(s, lc.id); break;
            case 11: buyCarLotUpgrade(s, rnd() < 0.5 ? 'valet' : 'showroom'); break;
            case 12: buySpot(s); break;
            case 13: hireLotCrew(s, rnd() < 0.5 ? 'detailer' : 'agent'); break;
            case 14: if (pj) paintTap(s, pj.id); break;
            case 15: if (pj) focusPaintJob(s, pj.id); break;
            case 16: buyPaintUpgrade(s, rnd() < 0.5 ? 'booth' : 'hype'); break;
            case 17: buyBooth(s); break;
            case 18: if (lc) sendLotCarToShop(s, lc.id); else hirePainter(s); break;
            default: addCash(s, 1e6 * rnd()); tick(s, 1);
          }
        } catch (e) {
          throw new Error(`seed ${seed} step ${step} action ${pick}: ${(e as Error).stack}`);
        }
        if (step % 100 === 99) {
          const back = deserialize(serialize(s, T0), T0);
          expect(back, `seed ${seed} step ${step} round-trip`).not.toBeNull();
        }
      }
      jobs += s.garage.jobsDone + s.paint.jobsDone;
      lotSold += s.carlot.sold;
      const bad: string[] = [];
      walk(s, 'state', bad);
      expect(bad, `seed ${seed}`).toEqual([]);
    }
    expect(jobs, 'garage and paint shop actually finished jobs').toBeGreaterThan(100);
    expect(lotSold, 'the lot actually sold cars').toBeGreaterThan(20);
  });

  it('corrupted garage / car lot / paint subtrees load and keep playing', () => {
    const base = newGame(T0, 9);
    base.cash = 1e12;
    base.lifetimeEarnings = 1e12;
    base.carsSold = 300;
    for (const id of Object.keys(base.businesses.opened) as (keyof typeof base.businesses.opened)[]) base.businesses.opened[id] = true;
    tick(base, 600);
    const v = (JSON.parse(serialize(base, T0)) as { v: number }).v;
    const BAD: unknown[] = [null, 'x', -1, 0, 1e300, 0.5, [], {}, true, NaN, 99];
    const corrupt = (node: unknown, rnd: () => number, rate: number): unknown => {
      if (Array.isArray(node)) return node.map((x) => (rnd() < rate ? BAD[Math.floor(rnd() * BAD.length)] : corrupt(x, rnd, rate)));
      if (node && typeof node === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, x] of Object.entries(node)) out[k] = rnd() < rate ? BAD[Math.floor(rnd() * BAD.length)] : corrupt(x, rnd, rate);
        return out;
      }
      return node;
    };
    let loaded = 0;
    for (let seed = 1; seed <= 600; seed++) {
      const rnd = lcg(seed);
      const tree = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
      for (const k of ['garage', 'carlot', 'paint']) tree[k] = corrupt(tree[k], rnd, 0.08 + (seed % 4) * 0.05);
      const data = JSON.stringify(tree);
      const r = deserialize(JSON.stringify({ v, savedAt: T0, sum: checksum(data), data }), T0);
      if (!r) continue;
      loaded++;
      const s = r.state;
      try {
        tick(s, 120);
        for (const j of [...s.garage.jobs]) garageTap(s, j.id);
        for (const c of [...s.carlot.cars]) { refurbTap(s, c.id); sellLotCar(s, c.id, 1); }
        for (const j of [...s.paint.jobs]) paintTap(s, j.id);
        for (const lot of [...s.carlot.board]) if (lot) buyLot(s, lot.id);
        tick(s, 120);
      } catch (e) {
        throw new Error(`seed ${seed}: ${(e as Error).stack}`);
      }
      const bad: string[] = [];
      walk(s, 'state', bad);
      expect(bad, `seed ${seed} non-finite`).toEqual([]);
    }
    expect(loaded).toBeGreaterThan(50);
  });
});
