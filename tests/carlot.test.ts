import { describe, expect, it } from 'vitest';
import { ECON } from '../src/core/config';
import {
  agentPick,
  auctionPrice,
  baseRetail,
  buyCarLotUpgrade,
  buyLot,
  buySpot,
  canBuyLot,
  carlotIdleIncome,
  carlotOfflineEarnings,
  carlotUpgradeCost,
  CONDITIONS,
  hireLotCrew,
  listPrice,
  lotProfit,
  refurbPerTap,
  refurbTap,
  sanitizeCarLot,
  sellLotCar,
  spotCost,
  tickCarLot,
} from '../src/core/carlot';
import { businessTier, nextTierGoal } from '../src/core/businesses';
import { checksum, deserialize, serialize } from '../src/core/save';
import { applyElapsed, tick } from '../src/core/sim';
import { newGame, SAVE_VERSION, type GameState } from '../src/core/state';

const T0 = 1_800_000_000_000;

function openLot(seed = 7, cash = 50_000_000): GameState {
  const s = newGame(T0, seed);
  s.businesses.opened.carlot = true;
  s.cash = s.lifetimeEarnings = cash;
  return s;
}

/** Tick only the lot until the board is full. */
function fillBoard(s: GameState) {
  for (let i = 0; i < 100 && s.carlot.board.some((b) => !b); i++) tickCarLot(s, 0.1, []);
  return s.carlot.board.map((b) => b!);
}

function refurbish(s: GameState, id: number) {
  for (let i = 0; i < 500; i++) {
    const car = s.carlot.cars.find((c) => c.id === id);
    if (!car || car.work === 0) return;
    refurbTap(s, id);
  }
}

describe('used car lot', () => {
  it('does nothing until the lot is open', () => {
    const s = newGame(T0, 1);
    tick(s, 30);
    expect(s.carlot.board.every((b) => b === null)).toBe(true);
    expect(s.carlot.cars).toHaveLength(0);
  });

  it('fills the auction board with lots whose condition and price are shown up front', () => {
    const s = openLot();
    const board = fillBoard(s);
    expect(board).toHaveLength(ECON.carlot.auctionLots);
    for (const lot of board) {
      expect(CONDITIONS).toContain(lot.condition);
      expect(lot.price).toBe(auctionPrice(lot.family, lot.condition));
      expect(lotProfit(s, lot)).toBeGreaterThan(0);
    }
  });

  it('rough cars are cheaper and need more work than mint ones', () => {
    expect(auctionPrice('sedan', 1)).toBeLessThan(auctionPrice('sedan', 5));
    expect(ECON.carlot.conditions[1].work).toBeGreaterThan(ECON.carlot.conditions[5].work);
    // ...and make more profit per car.
    const retail = baseRetail('sedan');
    expect(retail - auctionPrice('sedan', 1)).toBeGreaterThan(retail - auctionPrice('sedan', 5));
  });

  it('buy, refurbish by tapping, sell with haggling: profit counts as earnings, the price does not', () => {
    const s = openLot();
    const lot = fillBoard(s)[0]!;
    const cash0 = s.cash;
    const life0 = s.lifetimeEarnings;
    const ev = buyLot(s, lot.id);
    expect(ev[0]).toMatchObject({ type: 'lotBought', auto: false });
    expect(s.cash).toBe(cash0 - lot.price);
    expect(s.carlot.board[0]).toBeNull();
    const car = s.carlot.cars[0]!;
    expect(car.work).toBe(ECON.carlot.conditions[lot.condition].work);
    expect(sellLotCar(s, car.id)).toEqual([]); // not refurbished yet
    refurbTap(s, car.id);
    expect(car.work).toBeCloseTo(ECON.carlot.conditions[lot.condition].work - refurbPerTap(s));
    refurbish(s, car.id);
    expect(car.work).toBe(0);
    const sold = sellLotCar(s, car.id, 1.2);
    const amount = Math.round(listPrice(s, car) * 1.2);
    expect(sold[0]).toMatchObject({ type: 'lotSold', amount, profit: amount - lot.price, auto: false });
    expect(s.cash).toBe(cash0 - lot.price + amount);
    expect(s.lifetimeEarnings).toBe(life0 + amount - lot.price);
    expect(s.carlot.sold).toBe(1);
    expect(s.carlot.cars).toHaveLength(0);
  });

  it('haggling is clamped to the legal range', () => {
    const s = openLot();
    buyLot(s, fillBoard(s)[0]!.id);
    const car = s.carlot.cars[0]!;
    refurbish(s, car.id);
    const ev = sellLotCar(s, car.id, 9);
    expect(ev[0]).toMatchObject({ haggle: ECON.haggle.max });
  });

  it('refuses to buy without a free spot or the cash', () => {
    const s = openLot(7, 1_000);
    const board = fillBoard(s);
    expect(canBuyLot(s, board[0]!.id)).toBe(false);
    s.cash = s.lifetimeEarnings = 50_000_000;
    buyLot(s, board[0]!.id);
    buyLot(s, board[1]!.id);
    expect(s.carlot.cars).toHaveLength(ECON.carlot.spots.start);
    expect(buyLot(s, board[2]!.id)).toEqual([]);
  });

  it('an empty board slot refills, and lots that wait too long go to someone else', () => {
    const s = openLot();
    const lot = fillBoard(s)[0]!;
    buyLot(s, lot.id);
    tickCarLot(s, ECON.carlot.refillSeconds + 0.1, []);
    expect(s.carlot.board[0]).not.toBeNull();
    const events: { type: string }[] = [];
    tickCarLot(s, ECON.carlot.lotSeconds + 0.1, events);
    expect(events.some((e) => e.type === 'lotExpired')).toBe(true);
  });

  it('walk-up buyers pay the list price for a refurbished car', () => {
    const s = openLot();
    buyLot(s, fillBoard(s)[0]!.id);
    const car = s.carlot.cars[0]!;
    refurbish(s, car.id);
    const events: { type: string; auto?: boolean }[] = [];
    for (let t = 0; t < ECON.carlot.buyerInterval + 0.5; t += 0.1) tickCarLot(s, 0.1, events);
    expect(events.find((e) => e.type === 'lotSold')).toMatchObject({ auto: true });
    expect(s.carlot.cars).toHaveLength(0);
  });

  it('upgrades: Valet Bay speeds refurbishing, Showroom raises prices, spots hold more cars', () => {
    const s = openLot();
    const tap1 = refurbPerTap(s);
    const price1 = listPrice(s, { family: 'sedan' });
    const cost = carlotUpgradeCost('valet', 1);
    expect(buyCarLotUpgrade(s, 'valet')).toBe(true);
    expect(refurbPerTap(s)).toBeGreaterThan(tap1);
    expect(buyCarLotUpgrade(s, 'showroom')).toBe(true);
    expect(listPrice(s, { family: 'sedan' })).toBeGreaterThan(price1);
    expect(carlotUpgradeCost('valet', 2)).toBeGreaterThan(cost);
    const sc = spotCost(s.carlot.spots)!;
    s.cash += sc;
    expect(buySpot(s)).toBe(true);
    expect(s.carlot.spots).toBe(ECON.carlot.spots.start + 1);
    s.cash = 0;
    expect(buyCarLotUpgrade(s, 'valet')).toBe(false);
    expect(buySpot(s)).toBe(false);
  });

  it('map tiers grow with forecourt spots', () => {
    const s = openLot(7, 100_000_000);
    expect(businessTier(s, 'carlot')).toBe(1);
    expect(nextTierGoal(s, 'carlot')).toBe('3 forecourt spots');
    buySpot(s);
    expect(businessTier(s, 'carlot')).toBe(2);
    buySpot(s);
    expect(businessTier(s, 'carlot')).toBe(3);
    expect(spotCost(s.carlot.spots)).toBeNull();
  });

  it('the Auction Agent buys the best lot and keeps a cash reserve; the Detailer refurbishes', () => {
    const s = openLot();
    fillBoard(s);
    expect(hireLotCrew(s, 'agent')).toBe(true);
    expect(hireLotCrew(s, 'agent')).toBe(false);
    const i = agentPick(s);
    expect(i).toBeGreaterThanOrEqual(0);
    const events: { type: string; auto?: boolean }[] = [];
    tickCarLot(s, 0.1, events);
    expect(events.find((e) => e.type === 'lotBought')).toMatchObject({ auto: true });
    // No reserve, no bid.
    const poor = openLot(8, 0);
    fillBoard(poor);
    poor.carlot.crew.agent = true;
    poor.cash = Math.min(...poor.carlot.board.map((b) => b!.price)) * ECON.carlot.agentReserve - 1;
    expect(agentPick(poor)).toBe(-1);
    hireLotCrew(s, 'detailer');
    const car = s.carlot.cars[0]!;
    for (let t = 0; t < 120 && car.work > 0; t += 0.1) tickCarLot(s, 0.1, []);
    expect(car.work).toBe(0);
  });

  it('idle income matches what the crew really makes (within 25%)', () => {
    for (const spots of [2, 4]) {
      const s = openLot(3, 1e12);
      s.carlot.crew.detailer = s.carlot.crew.agent = true;
      s.carlot.levels.valet = 12;
      s.carlot.spots = spots;
      const seconds = 3000;
      for (let t = 0; t < seconds; t += 0.25) tickCarLot(s, 0.25, []);
      const real = s.carlot.profit / seconds;
      expect(real / carlotIdleIncome(s)).toBeGreaterThan(0.75);
      expect(real / carlotIdleIncome(s)).toBeLessThan(1.25);
    }
  });

  it('pays offline with the full crew (capped like the yard) and nothing without it', () => {
    const s = openLot();
    s.carlot.crew.detailer = true;
    expect(carlotOfflineEarnings(s, 3600)).toBe(0);
    s.carlot.crew.agent = true;
    const cap = carlotOfflineEarnings(s, ECON.offline.capSeconds);
    expect(cap).toBeGreaterThan(0);
    expect(carlotOfflineEarnings(s, ECON.offline.capSeconds * 5)).toBe(cap);
    const r = applyElapsed(s, T0 + 3600_000);
    expect(r.carlot).toBe(carlotOfflineEarnings(s, 3600));
    expect(r.earned).toBeGreaterThanOrEqual(r.carlot + r.garage);
  });
});

describe('car lot saves', () => {
  it('round-trips the lot', () => {
    const s = openLot();
    buyLot(s, fillBoard(s)[1]!.id);
    hireLotCrew(s, 'detailer');
    const back = deserialize(serialize(s, T0), T0)!.state;
    expect(back.carlot).toEqual(s.carlot);
  });

  it('old saves without a lot get a fresh one', () => {
    const s = newGame(T0, 2) as unknown as Record<string, unknown>;
    delete s.carlot;
    const data = JSON.stringify(s);
    const text = JSON.stringify({ v: SAVE_VERSION, savedAt: T0, sum: checksum(data), data });
    expect(deserialize(text, T0)!.state.carlot).toEqual(newGame(T0).carlot);
  });

  it('repairs impossible lot data', () => {
    const l = openLot().carlot;
    l.spots = 99;
    l.levels.valet = -3;
    l.crew.agent = 'yes' as never;
    l.board = [
      { id: 9, family: 'sedan', model: 'x', paint: 0, condition: 3, price: 10, timeLeft: 9999 },
      { id: 10, family: 'sedan', model: 'x', paint: 0, condition: 7 as never, price: 10, timeLeft: 1 },
    ];
    l.refill = [Number.NaN];
    l.cars = [
      { id: 4, family: 'van', model: 'x', paint: 0, condition: 1, paid: 5, work: 3 },
      { id: 5, family: 'nope' as never, model: 'x', paint: 0, condition: 1, paid: 5, work: 3 },
      { id: 6, family: 'van', model: 'x', paint: 0, condition: 2, paid: Number.NaN, work: 3 },
    ];
    l.focusedId = 99;
    l.nextId = 1;
    sanitizeCarLot(l);
    expect(l.spots).toBe(ECON.carlot.spots.start + ECON.carlot.spots.costs.length);
    expect(l.levels.valet).toBe(1);
    expect(l.crew.agent).toBe(false);
    expect(l.board).toHaveLength(ECON.carlot.auctionLots);
    expect(l.board[0]!.timeLeft).toBe(ECON.carlot.lotSeconds);
    expect(l.board[1]).toBeNull();
    expect(l.refill.every((r) => Number.isFinite(r))).toBe(true);
    expect(l.cars.map((c) => c.id)).toEqual([4]);
    expect(l.focusedId).toBe(4);
    expect(l.nextId).toBe(10);
  });
});

describe('haggle hold', () => {
  it('walk-up buyers leave a car alone while the player haggles over it', async () => {
    const { holdLotCar } = await import('../src/core/carlot');
    const s = openLot();
    buyLot(s, fillBoard(s)[0]!.id);
    const car = s.carlot.cars[0]!;
    refurbish(s, car.id);
    holdLotCar(s, car.id);
    for (let t = 0; t < ECON.carlot.buyerInterval * 3; t += 0.1) tickCarLot(s, 0.1, []);
    expect(s.carlot.cars).toHaveLength(1);
    sellLotCar(s, car.id, 1.1);
    expect(s.carlot.holdId).toBeNull();
    expect(s.carlot.cars).toHaveLength(0);
  });
});
