// P1.2f: refurbished Used Car Lot cars can go through Paint & Tuning for one service and come back with a higher
// sticker price.
import { describe, expect, it } from 'vitest';
import { ECON } from '../src/core/config';
import { findLotCar, holdLotCar, listPrice, lotBuyerChoice, sellLotCar, tickCarLot } from '../src/core/carlot';
import { hirePainter, lotCarService, lotSendBlock, lotTuneValue, paintFee, paintTap, sendLotCarToShop, tickPaint } from '../src/core/paint';
import { checksum, deserialize, serialize } from '../src/core/save';
import type { GameEvent } from '../src/core/sim';
import { newGame, SAVE_VERSION, type GameState, type LotCar } from '../src/core/state';

const T0 = 1_800_000_000_000;

function bothOpen(): GameState {
  const s = newGame(T0, 5);
  s.businesses.opened.carlot = true;
  s.businesses.opened.paint = true;
  s.cash = 1e12;
  s.lifetimeEarnings = 1e12;
  return s;
}

function addCar(s: GameState, over: Partial<LotCar> = {}): LotCar {
  const car: LotCar = { id: s.carlot.nextId++, family: 'muscle', model: 'Stallion Thunder', paint: 0xe5484d, condition: 3, paid: 10_000, work: 0, ...over };
  s.carlot.cars.push(car);
  s.carlot.focusedId ??= car.id;
  return car;
}

function finish(s: GameState, jobId: number): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < 200 && s.paint.jobs.some((j) => j.id === jobId); i++) out.push(...paintTap(s, jobId));
  return out;
}

describe('lot cars through the paint shop', () => {
  it('needs both businesses, a refurbished car and a free booth', () => {
    const s = newGame(T0, 1);
    s.businesses.opened.carlot = true;
    const car = addCar(s);
    expect(lotSendBlock(s, car.id)).toBe('closed');
    s.businesses.opened.paint = true;
    const dirty = addCar(s, { work: 5 });
    expect(lotSendBlock(s, dirty.id)).toBe('notReady');
    expect(lotSendBlock(s, 999)).toBe('missing');
    expect(lotSendBlock(s, car.id)).toBeNull();
    holdLotCar(s, car.id);
    expect(lotSendBlock(s, car.id)).toBe('haggling');
    holdLotCar(s, null);
    // One booth, taken by a customer.
    for (let i = 0; i < 100 && s.paint.jobs.length === 0; i++) tickPaint(s, 0.1, []);
    expect(lotSendBlock(s, car.id)).toBe('boothsFull');
    expect(sendLotCarToShop(s, car.id)).toEqual([]);
    expect(car.atShop).toBeUndefined();
  });

  it('takes a booth for the service that suits the car, with no customer fee', () => {
    const s = bothOpen();
    const car = addCar(s);
    const cash = s.cash;
    const events = sendLotCarToShop(s, car.id);
    expect(events.map((e) => e.type)).toEqual(['paintArrived']);
    const job = s.paint.jobs[0]!;
    expect(job.lotCarId).toBe(car.id);
    expect(job.services).toEqual([ECON.paint.lotCars.service.muscle]);
    expect(job.services).toEqual(['tune']);
    expect(job.fee).toBe(Math.round(paintFee('muscle', ['tune'], 1) * ECON.paint.lotCars.valueMult));
    expect(car.atShop).toBe(true);
    expect(s.cash).toBe(cash);
    // While away it can't be sold, focused, held or sent again; customers can't use that booth.
    expect(sellLotCar(s, car.id)).toEqual([]);
    expect(s.carlot.focusedId).toBeNull();
    expect(lotSendBlock(s, car.id)).toBe('away');
    tickPaint(s, 30, []);
    expect(s.paint.jobs.length).toBe(1);
  });

  it('comes back with a higher sticker and pays nothing at the shop', () => {
    const s = bothOpen();
    const car = addCar(s);
    const before = listPrice(s, car);
    const value = lotTuneValue(s, car);
    sendLotCarToShop(s, car.id);
    const job = s.paint.jobs[0]!;
    const cash = s.cash;
    const life = s.lifetimeEarnings;
    const events = finish(s, job.id);
    expect(events.some((e) => e.type === 'paintDone')).toBe(false);
    const done = events.find((e) => e.type === 'paintLotCarDone');
    expect(done).toMatchObject({ carId: car.id, value, auto: false });
    expect(s.cash).toBe(cash);
    expect(s.lifetimeEarnings).toBe(life);
    expect(s.paint.jobsDone).toBe(0);
    expect(car.atShop).toBeUndefined();
    expect(car.tuned).toBe('tune');
    expect(listPrice(s, car)).toBe(before + value);
    expect(s.carlot.focusedId).toBe(car.id);
    // Only once per car.
    expect(lotSendBlock(s, car.id)).toBe('tuned');
    // The sale pays the higher sticker; only the profit counts as earnings.
    sellLotCar(s, car.id, 1);
    expect(s.cash).toBe(cash + before + value);
    expect(s.lifetimeEarnings).toBe(life + before + value - car.paid);
  });

  it('a respray or wrap brings it back in the new colour', () => {
    const s = bothOpen();
    const car = addCar(s, { family: 'sedan' });
    expect(lotCarService(car)).toBe('respray');
    sendLotCarToShop(s, car.id);
    const job = s.paint.jobs[0]!;
    expect(job.newPaint).not.toBe(car.paint);
    finish(s, job.id);
    expect(car.paint).toBe(job.newPaint);
    const rims = addCar(s, { family: 'hatch', paint: 0x3b82f6 });
    sendLotCarToShop(s, rims.id);
    finish(s, s.paint.jobs[0]!.id);
    expect(rims.paint).toBe(0x3b82f6);
  });

  it('the Painter works lot cars too, and never tips them', () => {
    const s = bothOpen();
    hirePainter(s);
    const car = addCar(s);
    sendLotCarToShop(s, car.id);
    const events: GameEvent[] = [];
    for (let i = 0; i < 400 && car.atShop; i++) tickPaint(s, 0.1, events);
    expect(car.tuned).toBe('tune');
    expect(events.find((e) => e.type === 'paintLotCarDone')).toMatchObject({ auto: true });
  });

  it('walk-up buyers leave a car at the shop alone', () => {
    const s = bothOpen();
    const away = addCar(s);
    sendLotCarToShop(s, away.id);
    expect(lotBuyerChoice(s, 'speed')).toBeUndefined();
    const events: GameEvent[] = [];
    for (let i = 0; i < 200; i++) tickCarLot(s, 0.1, events);
    expect(events.some((e) => e.type === 'lotSold')).toBe(false);
    expect(findLotCar(s, away.id)).toBeDefined();
    // A buyer who was looking at it moves on to another car.
    const s2 = bothOpen();
    const a = addCar(s2);
    const b = addCar(s2, { family: 'sedan' });
    s2.carlot.buyer = { kind: 'speed', carId: a.id };
    s2.carlot.buyerTimer = ECON.carlot.buyerInterval - 1;
    sendLotCarToShop(s2, a.id);
    expect(s2.carlot.buyer?.carId).toBe(b.id);
    const ev2: GameEvent[] = [];
    tickCarLot(s2, 1.1, ev2);
    expect(ev2.find((e) => e.type === 'lotSold')).toMatchObject({ car: { id: b.id } });
    expect(a.atShop).toBe(true);
  });

  it('round-trips a car at the shop and repairs broken links', () => {
    const s = bothOpen();
    const car = addCar(s);
    const other = addCar(s, { family: 'sedan', tuned: 'respray', tuneValue: 5000 });
    sendLotCarToShop(s, car.id);
    const back = deserialize(serialize(s, T0), T0)!.state;
    expect(back.carlot.cars).toEqual(s.carlot.cars);
    expect(back.paint.jobs).toEqual(s.paint.jobs);
    // A car marked away without its job comes back; a lot job without its car goes.
    const raw = JSON.parse(JSON.stringify(s)) as GameState;
    raw.paint.jobs = [];
    raw.carlot.cars[1]!.tuneValue = Number.NaN as unknown as number;
    const orphan = JSON.parse(JSON.stringify(s)) as GameState;
    orphan.carlot.cars = orphan.carlot.cars.filter((c) => c.id !== car.id);
    for (const [st, check] of [
      [raw, (g: GameState) => {
        expect(g.carlot.cars[0]!.atShop).toBeUndefined();
        expect(g.carlot.focusedId).not.toBeNull();
        expect(g.carlot.cars[1]!.tuned).toBeUndefined();
        expect(g.carlot.cars[1]!.tuneValue).toBeUndefined();
      }],
      [orphan, (g: GameState) => expect(g.paint.jobs).toEqual([])],
    ] as const) {
      const data = JSON.stringify(st);
      const text = JSON.stringify({ v: SAVE_VERSION, savedAt: T0, sum: checksum(data), data });
      check(deserialize(text, T0)!.state);
    }
    expect(other.tuned).toBe('respray');
  });

  it('old lot cars without the new fields load as untuned', () => {
    const s = bothOpen();
    addCar(s);
    const back = deserialize(serialize(s, T0), T0)!.state;
    expect(back.carlot.cars[0]!.tuned).toBeUndefined();
    expect(back.tutorial.lotTuneSeen).toBe(false);
    expect(lotSendBlock(back, back.carlot.cars[0]!.id)).toBeNull();
  });
});
