import { describe, expect, it } from 'vitest';
import { ECON } from '../src/core/config';
import {
  buyGarageBay,
  buyGarageUpgrade,
  expectedGarageFee,
  garageBayCost,
  garageFee,
  garageIdleIncome,
  garageOfflineEarnings,
  garageTap,
  garageUpgradeCost,
  garageWorkPerTap,
  hireForeman,
  jobPayout,
  sanitizeGarage,
  tickGarage,
} from '../src/core/garage';
import { checksum, deserialize, serialize } from '../src/core/save';
import { applyElapsed, tick } from '../src/core/sim';
import { newGame, SAVE_VERSION, type GameState } from '../src/core/state';

const T0 = 1_800_000_000_000;

function openGarage(seed = 7): GameState {
  const s = newGame(T0, seed);
  s.businesses.opened.garage = true;
  return s;
}

/** Tick only the garage until a customer drives in. */
function waitForCar(s: GameState) {
  for (let i = 0; i < 100 && s.garage.jobs.length === 0; i++) tickGarage(s, 0.1, []);
  return s.garage.jobs[0]!;
}

describe('repair garage', () => {
  it('does nothing until the garage is open', () => {
    const s = newGame(T0, 1);
    tick(s, 30);
    expect(s.garage.jobs).toEqual([]);
    expect(hireForeman(s)).toBe(false);
    expect(buyGarageUpgrade(s, 'tools')).toBe(false);
  });

  it('a customer drives in with one fault and a fee fixed on arrival', () => {
    const s = openGarage();
    const job = waitForCar(s);
    expect(job.fault in ECON.garage.faults).toBe(true);
    expect(job.work).toBe(ECON.garage.faults[job.fault].work);
    expect(job.fee).toBe(garageFee(job.family, job.fault, 1));
    expect(s.garage.focusedId).toBe(job.id);
    // One bay: no second car while the first waits.
    tickGarage(s, 30, []);
    expect(s.garage.jobs).toHaveLength(1);
  });

  it('tapping fixes the car; the customer pays the full fee and spare parts are used', () => {
    const s = openGarage();
    s.parts = 20;
    const job = waitForCar(s);
    const need = ECON.garage.faults[job.fault].parts;
    let events: ReturnType<typeof garageTap> = [];
    let taps = 0;
    while (s.garage.jobs.length && taps < 50) {
      events = garageTap(s, job.id);
      taps++;
    }
    expect(taps).toBe(Math.ceil(ECON.garage.faults[job.fault].work / garageWorkPerTap(s)));
    expect(events[0]).toMatchObject({ type: 'garageFixed', amount: job.fee, parts: need, auto: false });
    expect(s.cash).toBe(job.fee);
    expect(s.lifetimeEarnings).toBe(job.fee);
    expect(s.parts).toBe(20 - need);
    expect(s.garage.jobsDone).toBe(1);
    expect(s.garage.earned).toBe(job.fee);
    expect(s.garage.focusedId).toBeNull();
  });

  it('without spare parts a parts bill comes off the fee', () => {
    const s = openGarage();
    const job = waitForCar(s);
    expect(jobPayout(s, job)).toEqual({ amount: Math.round(job.fee * (1 - ECON.garage.partsBill)), parts: 0 });
  });

  it('the barn keeps its parts when its next stage needs them', () => {
    const s = openGarage();
    const job = waitForCar(s);
    s.parts = 50;
    s.barn.status = 'covered';
    s.barn.stage = 1; // "Rebuild the engine" needs parts
    expect(jobPayout(s, job).parts).toBe(0);
  });

  it('upgrades: Tool Wall speeds taps, Reputation raises new fees, bays let more cars in', () => {
    const s = openGarage();
    s.cash = s.lifetimeEarnings = 10_000_000;
    const tap1 = garageWorkPerTap(s);
    const cost = garageUpgradeCost('tools', 1);
    expect(buyGarageUpgrade(s, 'tools')).toBe(true);
    expect(s.cash).toBe(10_000_000 - cost);
    expect(garageWorkPerTap(s)).toBeGreaterThan(tap1);
    const fee1 = expectedGarageFee(s);
    buyGarageUpgrade(s, 'rep');
    expect(expectedGarageFee(s)).toBeCloseTo(fee1 * ECON.garage.repFeeGrowth, 5);
    expect(garageBayCost(1)).toBe(ECON.garage.bays.costs[0]);
    expect(buyGarageBay(s)).toBe(true);
    expect(buyGarageBay(s)).toBe(true);
    expect(garageBayCost(s.garage.bays)).toBeNull();
    expect(buyGarageBay(s)).toBe(false);
    tickGarage(s, 20, []);
    for (let i = 0; i < 100; i++) tickGarage(s, 0.1, []);
    expect(s.garage.jobs).toHaveLength(3);
  });

  it('upgrades refuse when cash is short', () => {
    const s = openGarage();
    expect(buyGarageUpgrade(s, 'rep')).toBe(false);
    expect(hireForeman(s)).toBe(false);
    expect(buyGarageBay(s)).toBe(false);
    expect(s.garage.levels).toEqual({ tools: 1, rep: 1 });
  });

  it('the Foreman fixes cars on his own while the scrapyard is on screen', () => {
    const s = openGarage();
    s.cash = s.lifetimeEarnings = ECON.garage.foreman.cost;
    expect(hireForeman(s)).toBe(true);
    expect(hireForeman(s)).toBe(false);
    expect(s.businesses.active).toBe('scrapyard');
    const events = tick(s, 120);
    const fixed = events.filter((e) => e.type === 'garageFixed');
    expect(fixed.length).toBeGreaterThan(3);
    expect(fixed.every((e) => e.type === 'garageFixed' && e.auto)).toBe(true);
    expect(s.garage.earned).toBeGreaterThan(0);
  });

  it('idle income matches what the Foreman really earns (within 25%)', () => {
    const s = openGarage(3);
    s.garage.foreman = true;
    s.garage.levels.tools = 12;
    for (const bays of [1, 3]) {
      s.garage.bays = bays;
      s.garage.earned = 0;
      const seconds = 3000;
      for (let t = 0; t < seconds; t += 0.25) tickGarage(s, 0.25, []);
      const real = s.garage.earned / seconds;
      expect(real / garageIdleIncome(s)).toBeGreaterThan(0.75);
      expect(real / garageIdleIncome(s)).toBeLessThan(1.25);
    }
  });

  it('pays offline with the Foreman (capped like the yard) and nothing without him', () => {
    const s = openGarage();
    expect(garageOfflineEarnings(s, 3600)).toBe(0);
    s.garage.foreman = true;
    const cap = garageOfflineEarnings(s, ECON.offline.capSeconds);
    expect(cap).toBeGreaterThan(0);
    expect(garageOfflineEarnings(s, ECON.offline.capSeconds * 5)).toBe(cap);
    const r = applyElapsed(s, T0 + 3600_000);
    expect(r.garage).toBe(garageOfflineEarnings(s, 3600));
    expect(r.earned).toBeGreaterThanOrEqual(r.garage);
  });

  it('fees scale with the car family', () => {
    expect(garageFee('hyper', 'tyre', 1)).toBeGreaterThan(garageFee('hatch', 'tyre', 1));
    expect(garageFee('sedan', 'engine', 1)).toBeGreaterThan(garageFee('sedan', 'tyre', 1));
  });
});

describe('garage saves', () => {
  it('round-trips the garage', () => {
    const s = openGarage();
    s.cash = s.lifetimeEarnings = 1_000_000;
    hireForeman(s);
    buyGarageBay(s);
    waitForCar(s);
    const back = deserialize(serialize(s, T0), T0)!.state;
    expect(back.garage).toEqual(s.garage);
  });

  it('old saves without a garage get a fresh one', () => {
    const s = newGame(T0, 2) as unknown as Record<string, unknown>;
    delete s.garage;
    const data = JSON.stringify(s);
    const text = JSON.stringify({ v: SAVE_VERSION, savedAt: T0, sum: checksum(data), data });
    const back = deserialize(text, T0)!.state;
    expect(back.garage).toEqual(newGame(T0).garage);
  });

  it('repairs impossible garage data', () => {
    const g = openGarage().garage;
    g.bays = 99;
    g.levels.tools = -3;
    g.jobs = [
      { id: 4, family: 'sedan', model: 'x', paint: 0, fault: 'tyre', work: 1, fee: 10 },
      { id: 5, family: 'nope' as never, model: 'x', paint: 0, fault: 'tyre', work: 1, fee: 10 },
      { id: 6, family: 'van', model: 'x', paint: 0, fault: 'warp' as never, work: 1, fee: 10 },
      { id: 7, family: 'van', model: 'x', paint: 0, fault: 'engine', work: Number.NaN, fee: 10 },
    ];
    g.focusedId = 99;
    g.nextJobId = 1;
    sanitizeGarage(g);
    expect(g.bays).toBe(ECON.garage.bays.start + ECON.garage.bays.costs.length);
    expect(g.levels.tools).toBe(1);
    expect(g.jobs.map((j) => j.id)).toEqual([4]);
    expect(g.focusedId).toBe(4);
    expect(g.nextJobId).toBe(5);
  });
});
