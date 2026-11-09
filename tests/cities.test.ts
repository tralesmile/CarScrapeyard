import { describe, expect, it } from 'vitest';
import { ECON, type CityId } from '../src/core/config';
import { CITY_IDS, CITY_LIGHTS, citiesForNextEmpire, isCityNight, cityPrice, cityScale, defaultNextCity, nextCityToUnlock, sanitizeCity } from '../src/core/cities';
import { bulkCost, idleIncomePerSecond, managerCost, slotCost, upgradeCost } from '../src/core/formulas';
import { earningsForTotalPoints, incomeMultiplier, legacyMultiplier, sellEmpire } from '../src/core/legacy';
import { openCost, unlockGoal, businessStatus } from '../src/core/businesses';
import { foremanCost, garageBayCost, garageIdleIncome, garageUpgradeCost, generateJob } from '../src/core/garage';
import { carlotUpgradeCost, generateLot, listPrice, lotCrewCost, spotCost } from '../src/core/carlot';
import { boothCost, generatePaintJob, paintIdleIncome, paintUpgradeCost, painterCost } from '../src/core/paint';
import { barnStageCost, barnValue } from '../src/core/barn';
import { buyUpgrade, hireManager, tick } from '../src/core/sim';
import { checksum, deserialize, serialize } from '../src/core/save';
import { newGame, type GameState } from '../src/core/state';
import { cityChoices, cityTeaser, grandpaLine, sellEmpirePreview } from '../src/ui/legacyView';

const T0 = 1_800_000_000_000;
const K = ECON.cities.list.motorCity.scale;

/** A game ready to sell its `n`-th empire (the sale gives exactly the minimum points). */
function readyToSell(sale: number): GameState {
  const s = newGame(T0, 21);
  let points = 0;
  for (let i = 1; i < sale; i++) {
    points += ECON.legacy.minPoints;
    s.legacy.sold = i;
  }
  s.legacy.points = points;
  s.legacy.allTime = earningsForTotalPoints(points);
  const target = points + ECON.legacy.minPoints;
  s.lifetimeEarnings = earningsForTotalPoints(target) - s.legacy.allTime;
  return s;
}

function inCity(city: CityId, seed = 5): GameState {
  const s = newGame(T0, seed);
  s.legacy.sold = 2;
  s.legacy.city = city;
  return s;
}

describe('cities (P1.3d)', () => {
  it('Rust Valley is the start, scale 1; Motor City is bigger and opens on the 2nd sale', () => {
    expect(CITY_IDS[0]).toBe('rustValley');
    expect(newGame(T0, 1).legacy.city).toBe('rustValley');
    expect(cityScale(newGame(T0, 1))).toBe(1);
    expect(K).toBeGreaterThan(1);
    expect(ECON.cities.list.motorCity.fromSale).toBe(2);
  });

  it('the first sale stays in Rust Valley, and Motor City cannot be picked yet', () => {
    const s = readyToSell(1);
    expect(citiesForNextEmpire(s)).toEqual(['rustValley']);
    expect(sellEmpire(s, T0, 'motorCity')).toBeNull();
    expect(s.legacy.sold).toBe(0);
    const sold = sellEmpire(s, T0)!;
    expect(sold.city).toBe('rustValley');
    expect(s.legacy.city).toBe('rustValley');
  });

  it('from the 2nd sale on the player picks; the default is the biggest open city; the choice is kept', () => {
    const a = readyToSell(2);
    expect(citiesForNextEmpire(a)).toEqual(['rustValley', 'motorCity']);
    expect(defaultNextCity(a)).toBe('motorCity');
    expect(sellEmpire(a, T0)!.city).toBe('motorCity');
    expect(a.legacy.city).toBe('motorCity');
    expect(a.legacy.sold).toBe(2);
    // Staying in Rust Valley is allowed too.
    const b = readyToSell(2);
    expect(sellEmpire(b, T0, 'rustValley')!.city).toBe('rustValley');
    expect(b.legacy.city).toBe('rustValley');
    // A city survives a later sale only if picked again.
    const c = readyToSell(3);
    c.legacy.city = 'motorCity';
    expect(sellEmpire(c, T0, 'rustValley')!.city).toBe('rustValley');
  });

  it('in Motor City every price is x scale', () => {
    const rv = inCity('rustValley');
    const mc = inCity('motorCity');
    expect(cityPrice(mc, 100)).toBe(100 * K);
    expect(upgradeCost('wash', 7, K) / upgradeCost('wash', 7, 1)).toBeCloseTo(K, 1);
    expect(bulkCost('repair', 3, 10, 0, K).cost / bulkCost('repair', 3, 10, 0, 1).cost).toBeCloseTo(K, 1);
    expect(slotCost(2, K)).toBe(slotCost(2, 1)! * K);
    expect(slotCost(99, K)).toBeNull();
    expect(managerCost(mc, 'seller')).toBe(managerCost(rv, 'seller') * K);
    expect(foremanCost(mc)).toBe(foremanCost(rv) * K);
    expect(lotCrewCost(mc, 'agent')).toBe(lotCrewCost(rv, 'agent') * K);
    expect(painterCost(mc)).toBe(painterCost(rv) * K);
    expect(garageUpgradeCost('rep', 4, K) / garageUpgradeCost('rep', 4, 1)).toBeCloseTo(K, 3);
    expect(garageBayCost(1, K)).toBe(garageBayCost(1, 1)! * K);
    expect(carlotUpgradeCost('showroom', 2, K) / carlotUpgradeCost('showroom', 2, 1)).toBeCloseTo(K, 3);
    expect(spotCost(2, K)).toBe(spotCost(2, 1)! * K);
    expect(paintUpgradeCost('hype', 3, K) / paintUpgradeCost('hype', 3, 1)).toBeCloseTo(K, 3);
    expect(boothCost(1, K)).toBe(boothCost(1, 1)! * K);
    for (const id of ['garage', 'carlot', 'paint'] as const) {
      expect(openCost(mc, id)).toBe(openCost(rv, id) * K);
      expect(unlockGoal(mc, id)).toBe(unlockGoal(rv, id) * K);
    }
    // The rules charge the scaled price, not the config one.
    mc.cash = managerCost(rv, 'mechanic');
    expect(hireManager(mc, 'mechanic')).toBe(false);
    mc.cash = managerCost(mc, 'mechanic');
    mc.lifetimeEarnings = mc.cash;
    expect(hireManager(mc, 'mechanic')).toBe(true);
    expect(mc.cash).toBe(0);
    mc.cash = upgradeCost('wash', 1, 1);
    expect(buyUpgrade(mc, 'wash')).toBe(false);
    // A business shows its price only after the scaled goal.
    mc.lifetimeEarnings = unlockGoal(rv, 'garage');
    expect(businessStatus(mc, 'garage')).toBe('locked');
    mc.lifetimeEarnings = unlockGoal(mc, 'garage');
    expect(businessStatus(mc, 'garage')).toBe('forSale');
  });

  it('in Motor City every value is x scale, on top of Legacy Points', () => {
    const rv = inCity('rustValley', 9);
    const mc = inCity('motorCity', 9);
    for (const s of [rv, mc]) {
      s.legacy.points = 15;
      s.legacy.allTime = earningsForTotalPoints(15);
      s.managers.mechanic = s.managers.washer = s.managers.seller = true;
      s.businesses.opened.garage = s.businesses.opened.carlot = s.businesses.opened.paint = true;
      s.garage.foreman = s.carlot.crew.detailer = s.carlot.crew.agent = s.paint.painter = true;
    }
    expect(incomeMultiplier(mc)).toBeCloseTo(legacyMultiplier(mc) * K, 9);
    expect(idleIncomePerSecond(mc) / idleIncomePerSecond(rv)).toBeCloseTo(K, 6);
    expect(garageIdleIncome(mc) / garageIdleIncome(rv)).toBeCloseTo(K, 6);
    expect(paintIdleIncome(mc) / paintIdleIncome(rv)).toBeCloseTo(K, 6);
    // Same RNG seed: the same customer, K times the fee.
    const gr = generateJob(rv);
    const gm = generateJob(mc);
    expect(gm.fault).toBe(gr.fault);
    expect(gm.fee / gr.fee).toBeCloseTo(K, 2);
    const pr = generatePaintJob(rv);
    const pm = generatePaintJob(mc);
    expect(pm.fee / pr.fee).toBeCloseTo(K, 2);
    const lr = generateLot(rv);
    const lm = generateLot(mc);
    expect(lm.price / lr.price).toBeCloseTo(K, 2);
    expect(listPrice(mc, lm) / listPrice(rv, lr)).toBeCloseTo(K, 2);
    // A yard car arriving in Motor City is worth about K times as much (same seed, same car).
    const before = (s: GameState) => s.cars.length;
    const a = inCity('rustValley', 3);
    const b = inCity('motorCity', 3);
    for (let i = 0; i < 40 && before(a) === 0; i++) tick(a, 0.5);
    for (let i = 0; i < 40 && before(b) === 0; i++) tick(b, 0.5);
    expect(Math.abs(b.cars[0]!.value / a.cars[0]!.value - K)).toBeLessThan(0.05);
    // Barn: the stage price and the payout scale together.
    a.barn.status = b.barn.status = 'covered';
    // (Both are rounded to "nice" numbers, so within 10%.)
    for (const r of [barnStageCost(b).cash / barnStageCost(a).cash, barnValue(b) / barnValue(a)]) {
      expect(r).toBeGreaterThan(K * 0.9);
      expect(r).toBeLessThan(K * 1.1);
    }
  });

  it('Head Start gives the new city its scaled cash, and the save accepts it', () => {
    const s = readyToSell(2);
    s.legacy.tree.mechanic = 2; // Quick Hands + Head Start
    expect(sellEmpire(s, T0, 'motorCity')).not.toBeNull();
    expect(s.cash).toBe(ECON.legacy.tree.headStartCash * K);
    const back = deserialize(serialize(s, T0), T0)!.state;
    expect(back.cash).toBe(ECON.legacy.tree.headStartCash * K);
    expect(back.legacy.city).toBe('motorCity');
  });

  it('save repair: unknown cities and cities the sales cannot have reached fall back to Rust Valley', () => {
    const l = newGame(T0, 1).legacy;
    l.city = 'atlantis' as CityId;
    sanitizeCity(l);
    expect(l.city).toBe('rustValley');
    l.city = 'motorCity';
    l.sold = 1;
    sanitizeCity(l);
    expect(l.city).toBe('rustValley');
    l.city = 'motorCity';
    l.sold = 2;
    sanitizeCity(l);
    expect(l.city).toBe('motorCity');
    // An old save without a city loads into Rust Valley.
    const old = JSON.parse(JSON.stringify(newGame(T0, 3))) as { legacy: Record<string, unknown> };
    delete old.legacy.city;
    const env = JSON.parse(serialize(newGame(T0, 3), T0));
    env.data = JSON.stringify(old);
    env.sum = checksum(env.data);
    expect(deserialize(JSON.stringify(env), T0)!.state.legacy.city).toBe('rustValley');
  });

  it('preview: no picker on the first sale (a teaser instead); two cards from the second', () => {
    const one = readyToSell(1);
    expect(cityChoices(one)).toEqual([]);
    expect(cityTeaser(one)).toBe('🏙️ Motor City opens on your 2nd sale');
    expect(nextCityToUnlock(one)).toEqual({ id: 'motorCity', sale: 2 });
    const two = readyToSell(2);
    const p = sellEmpirePreview(two);
    expect(p.cities.map((c) => [c.id, c.picked, c.current])).toEqual([
      ['rustValley', false, true],
      ['motorCity', true, false],
    ]);
    expect(p.cities[1]!.line).toBe(`Prices and payouts x${K}`);
    expect(p.cityTeaser).toBeNull();
    expect(grandpaLine(1, 'motorCity', 'rustValley')).toContain('Motor City');
    expect(grandpaLine(1, 'rustValley', 'rustValley')).not.toContain('Motor City');
  });
});

describe('city lights (P1.3d3c)', () => {
  it('Rust Valley never turns to night', () => {
    for (const lights of CITY_LIGHTS) for (let h = 0; h < 24; h++) expect(isCityNight('rustValley', lights, h)).toBe(false);
  });

  it('Motor City follows the clock on auto: night from 7 pm to before 6 am', () => {
    const night = [...Array(24).keys()].filter((h) => isCityNight('motorCity', 'auto', h));
    expect(night).toEqual([0, 1, 2, 3, 4, 5, 19, 20, 21, 22, 23]);
  });

  it('day and night override the clock', () => {
    for (let h = 0; h < 24; h++) {
      expect(isCityNight('motorCity', 'day', h)).toBe(false);
      expect(isCityNight('motorCity', 'night', h)).toBe(true);
    }
  });
});
