// Crusher upgrades (Hydraulic Press) and the Scrapper crew member.

import { describe, expect, it } from 'vitest';
import { ECON } from '../src/core/config';
import { crushParts, crusherCooldown, offlineEarnings, upgradeCost } from '../src/core/formulas';
import {
  applyElapsed,
  buyUpgrade,
  crushCar,
  hireManager,
  offlineScrapper,
  scrapperPick,
  scrapperTarget,
  tick,
  type GameEvent,
} from '../src/core/sim';
import { deserialize, serialize } from '../src/core/save';
import { newGame, type GameState } from '../src/core/state';

const T0 = 1_800_000_000_000;

function yard(seed = 4): GameState {
  const s = newGame(T0, seed);
  s.carsSold = ECON.crusher.unlockCarsSold;
  s.nextCarId = 10; // past the forced-Common tutorial cars
  return s;
}

describe('Hydraulic Press', () => {
  it('each level shortens the cooldown (down to a floor) and adds parts', () => {
    expect(crusherCooldown(1)).toBe(ECON.crusher.cooldown);
    expect(crusherCooldown(2)).toBeLessThan(crusherCooldown(1));
    expect(crusherCooldown(1000)).toBe(ECON.crusher.minCooldown);
    expect(crushParts('common', 1)).toBe(ECON.crusher.parts.common);
    expect(crushParts('common', 11)).toBe(Math.round(ECON.crusher.parts.common * (1 + 10 * ECON.crusher.pressPartsPerLevel)));
    for (let l = 1; l < 50; l++) expect(crushParts('rare', l + 1)).toBeGreaterThanOrEqual(crushParts('rare', l));
  });

  it('is bought like any upgrade and the crusher uses its level', () => {
    const s = yard();
    s.cash = s.lifetimeEarnings = 1e6;
    expect(buyUpgrade(s, 'press', 5)).toBe(true);
    expect(s.levels.press).toBe(6);
    tick(s, 3);
    const car = s.cars[0]!;
    crushCar(s, car.id);
    expect(s.parts).toBe(crushParts(car.rarity, 6));
    expect(s.crusherCooldown).toBeCloseTo(crusherCooldown(6));
    expect(upgradeCost('press', 1)).toBe(ECON.upgrades.press.baseCost);
  });

  it('old saves without the press get level 1 and no Scrapper', () => {
    const s = newGame(T0, 2);
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    raw.levels = { wash: 3, repair: 2, quality: 1 };
    raw.managers = { mechanic: true, washer: false, seller: false };
    delete raw.scrapperRest;
    const loaded = deserialize(serialize(raw as unknown as GameState, T0), T0)!.state;
    expect(loaded.levels).toEqual({ wash: 3, repair: 2, quality: 1, press: 1 });
    expect(loaded.managers.scrapper).toBe(false);
    expect(loaded.scrapperRest).toBe(0);
  });
});

describe('Scrapper', () => {
  it('does nothing until hired', () => {
    const s = yard();
    tick(s, 3);
    expect(scrapperPick(s)).toBeUndefined();
  });

  it('crushes a fresh Common wreck while parts are low, then rests', () => {
    const s = yard();
    s.cash = s.lifetimeEarnings = ECON.managers.scrapper.cost;
    expect(hireManager(s, 'scrapper')).toBe(true);
    s.parts = 0;
    let crushed: GameEvent[] = [];
    for (let i = 0; i < 400 && crushed.length === 0; i++) crushed = tick(s, 0.1).filter((e) => e.type === 'crushed');
    expect(crushed.length).toBe(1);
    const e = crushed[0]!;
    expect(e.type === 'crushed' && e.auto && e.car.rarity === 'common').toBe(true);
    expect(s.scrapperRest).toBeCloseTo(ECON.crusher.scrapperRest, 5);
    // Rests: no second crush right away even though a new wreck arrives and parts are still low.
    s.parts = 0;
    const soon = tick(s, ECON.crusher.scrapperRest - 0.5).filter((x) => x.type === 'crushed');
    expect(soon).toEqual([]);
  });

  it('never touches Rare+ cars or cars someone has started washing, and stops once the bin is full', () => {
    const s = yard();
    tick(s, 3);
    s.managers.scrapper = true;
    const car = s.cars[0]!;
    car.rarity = 'rare';
    expect(scrapperPick(s)).toBeUndefined();
    car.rarity = 'common';
    car.dirt = 0.9;
    expect(scrapperPick(s)).toBeUndefined();
    car.dirt = 1;
    expect(scrapperPick(s)).toBe(car);
    s.parts = scrapperTarget(s);
    expect(scrapperPick(s)).toBeUndefined();
  });

  it('keeps enough parts for the next barn stage', () => {
    const s = yard();
    s.barn.status = 'covered';
    s.barn.stage = 2; // next: "Fix the body" needs 12 parts
    expect(scrapperTarget(s)).toBe(Math.max(ECON.crusher.scrapperKeepParts, ECON.barn.stages[2]!.parts));
  });

  it('a Scrapper run over many seeds only tops up: far fewer crushes than arrivals', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = yard(seed);
      s.managers = { mechanic: true, washer: true, seller: true, scrapper: true };
      let crushed = 0;
      for (let i = 0; i < 3000; i++) crushed += tick(s, 0.1).filter((e) => e.type === 'crushed').length;
      expect(crushed).toBeLessThan(s.carsSold * 0.5);
      expect(crushed).toBeLessThanOrEqual(300 / ECON.crusher.scrapperRest + 1);
    }
  });
});

describe('Scrapper while away', () => {
  function crewYard(seed = 4): GameState {
    const s = yard(seed);
    s.managers = { mechanic: true, washer: true, seller: true, scrapper: true };
    s.parts = 0;
    return s;
  }

  it('tops the parts bin up to its target, no further, and pays scrap cash on top of sales', () => {
    const s = crewYard();
    const sales = offlineEarnings(s, 3600);
    const r = applyElapsed(s, T0 + 3600_000);
    const per = crushParts('common', s.levels.press);
    const crushes = Math.ceil(scrapperTarget(s) / per);
    expect(r.parts).toBe(crushes * per);
    expect(s.parts).toBe(crushes * per);
    expect(s.parts).toBeGreaterThanOrEqual(scrapperTarget(s));
    expect(s.parts).toBeLessThan(scrapperTarget(s) + per);
    expect(s.stats.carsCrushed).toBe(crushes);
    expect(r.earned).toBeGreaterThan(sales);
    // Scrap cash is small next to an hour of sales.
    expect(r.earned - sales).toBeLessThan(sales * 0.01);
  });

  it('adds nothing when the bin is already full, the Scrapper is not hired, or the crew is incomplete', () => {
    const full = crewYard();
    full.parts = scrapperTarget(full);
    expect(applyElapsed(full, T0 + 3600_000).parts).toBe(0);
    const noScrapper = crewYard();
    noScrapper.managers.scrapper = false;
    expect(offlineScrapper(noScrapper, 3600).crushes).toBe(0);
    const noSeller = crewYard();
    noSeller.managers.seller = false;
    expect(offlineScrapper(noSeller, 3600).crushes).toBe(0);
  });

  it('a short absence allows only a few crushes (one per rest period of counted time)', () => {
    const s = crewYard();
    s.barn.status = 'covered';
    s.barn.stage = 2; // next stage wants 12 parts
    const seconds = 30;
    const max = Math.floor((seconds * ECON.offline.efficiency) / (ECON.crusher.scrapperRest + ECON.arrivalInterval));
    expect(offlineScrapper(s, seconds).crushes).toBe(max);
    expect(offlineScrapper(s, 0).crushes).toBe(0);
  });

  it('gives nothing when the clock goes backwards', () => {
    const s = crewYard();
    expect(applyElapsed(s, T0 - 3600_000)).toEqual({ seconds: 0, earned: 0, parts: 0 });
    expect(s.parts).toBe(0);
  });
});
