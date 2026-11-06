import { describe, expect, it } from 'vitest';
import {
  BUSINESS_IDS,
  businessStatus,
  canOpenBusiness,
  mapUnlocked,
  nextBusiness,
  openBusiness,
  switchBusiness,
  unlockProgress,
} from '../src/core/businesses';
import { ECON } from '../src/core/config';
import { checksum, deserialize, serialize } from '../src/core/save';
import { tick } from '../src/core/sim';
import { newGame, SAVE_VERSION } from '../src/core/state';

const T0 = 1_800_000_000_000;
const garage = ECON.businesses.list.garage;

/** Pretend the garage's loop is built (P1.1c) for the open/switch rules. */
function withReadyGarage<T>(fn: () => T): T {
  const list = ECON.businesses.list as unknown as Record<string, { ready: boolean }>;
  const was = list.garage!.ready;
  list.garage!.ready = true;
  try {
    return fn();
  } finally {
    list.garage!.ready = was;
  }
}

describe('businesses (city map)', () => {
  it('a new game owns only the scrapyard and has it on screen', () => {
    const s = newGame(T0, 1);
    expect(s.businesses.active).toBe('scrapyard');
    expect(BUSINESS_IDS.filter((id) => s.businesses.opened[id])).toEqual(['scrapyard']);
    expect(businessStatus(s, 'scrapyard')).toBe('open');
    expect(businessStatus(s, 'garage')).toBe('locked');
    expect(nextBusiness(s)).toBe('garage');
  });

  it('the map button appears after the configured number of sales', () => {
    const s = newGame(T0, 1);
    s.carsSold = ECON.businesses.mapUnlockCarsSold - 1;
    expect(mapUnlocked(s)).toBe(false);
    s.carsSold++;
    expect(mapUnlocked(s)).toBe(true);
  });

  it('unlock progress follows lifetime earnings, capped at 1', () => {
    const s = newGame(T0, 1);
    s.lifetimeEarnings = garage.unlockLifetime / 4;
    expect(unlockProgress(s, 'garage')).toBeCloseTo(0.25);
    s.lifetimeEarnings = garage.unlockLifetime * 3;
    expect(unlockProgress(s, 'garage')).toBe(1);
    expect(unlockProgress(s, 'scrapyard')).toBe(1);
  });

  it('a business whose loop is not built yet shows "soon" and cannot be opened', () => {
    const s = newGame(T0, 1);
    const paint = ECON.businesses.list.paint;
    s.lifetimeEarnings = paint.unlockLifetime;
    s.cash = paint.openCost * 2;
    expect(paint.ready).toBe(false); // flips in P1.2 with the Paint & Tuning loop
    expect(garage.ready).toBe(true); // the Repair Garage loop arrived in P1.1c
    expect(ECON.businesses.list.carlot.ready).toBe(true); // the Used Car Lot loop arrived in P1.2b
    expect(businessStatus(s, 'paint')).toBe('soon');
    expect(openBusiness(s, 'paint')).toBe(false);
    expect(s.cash).toBe(paint.openCost * 2);
    expect(businessStatus(s, 'carlot')).toBe('forSale');
  });

  it('opening costs cash, needs the unlock goal, and does not switch on its own', () =>
    withReadyGarage(() => {
      const s = newGame(T0, 1);
      s.cash = garage.openCost;
      s.lifetimeEarnings = garage.unlockLifetime - 1;
      expect(canOpenBusiness(s, 'garage')).toBe(false);
      s.lifetimeEarnings = garage.unlockLifetime;
      s.cash = garage.openCost - 1;
      expect(canOpenBusiness(s, 'garage')).toBe(false);
      s.cash = garage.openCost;
      expect(businessStatus(s, 'garage')).toBe('forSale');
      expect(openBusiness(s, 'garage')).toBe(true);
      expect(s.cash).toBe(0);
      expect(businessStatus(s, 'garage')).toBe('open');
      expect(s.businesses.active).toBe('scrapyard');
      expect(openBusiness(s, 'garage')).toBe(false); // only once
      expect(nextBusiness(s)).toBe('carlot');
    }));

  it('switching only goes to open businesses, and the scrapyard keeps working in the background', () =>
    withReadyGarage(() => {
      const s = newGame(T0, 7);
      s.managers = { mechanic: true, washer: true, seller: true, scrapper: false };
      expect(switchBusiness(s, 'garage')).toBe(false);
      s.lifetimeEarnings = garage.unlockLifetime;
      s.cash = garage.openCost;
      openBusiness(s, 'garage');
      expect(switchBusiness(s, 'garage')).toBe(true);
      expect(s.businesses.active).toBe('garage');
      const sold = s.carsSold;
      tick(s, 120);
      expect(s.carsSold).toBeGreaterThan(sold);
      expect(switchBusiness(s, 'scrapyard')).toBe(true);
    }));
});

describe('save v1 -> v2 migration (businesses)', () => {
  function v1Save(mutate?: (d: Record<string, unknown>) => void): string {
    const s = newGame(T0, 3) as unknown as Record<string, unknown>;
    delete s.businesses;
    s.version = 1;
    s.cash = 500;
    s.lifetimeEarnings = 300_000;
    mutate?.(s);
    const data = JSON.stringify(s);
    return JSON.stringify({ v: 1, savedAt: T0, sum: checksum(data), data });
  }

  it('the save version is 2', () => {
    expect(SAVE_VERSION).toBe(2);
  });

  it('a v1 save loads with just the scrapyard open and on screen, keeping its progress', () => {
    const back = deserialize(v1Save(), T0)!;
    expect(back).not.toBeNull();
    expect(back.state.version).toBe(2);
    expect(back.state.cash).toBe(500);
    expect(back.state.businesses.active).toBe('scrapyard');
    expect(back.state.businesses.opened).toEqual({ scrapyard: true, garage: false, carlot: false, paint: false });
    expect(back.state.tutorial.mapSeen).toBe(false);
    // A veteran past the unlock goal sees the garage unlocked at once.
    expect(businessStatus(back.state, 'garage')).not.toBe('locked');
  });

  it('repairs impossible business blocks: closed scrapyard, unknown or unopened active business', () => {
    const s = newGame(T0, 3);
    s.businesses.opened.scrapyard = false;
    (s.businesses as { active: string }).active = 'moonbase';
    const back = deserialize(serialize(s, T0), T0)!;
    expect(back.state.businesses.opened.scrapyard).toBe(true);
    expect(back.state.businesses.active).toBe('scrapyard');
    const s2 = newGame(T0, 3);
    s2.businesses.active = 'garage';
    expect(deserialize(serialize(s2, T0), T0)!.state.businesses.active).toBe('scrapyard');
  });

  it('round-trips an opened garage', () => {
    const s = newGame(T0, 3);
    s.businesses.opened.garage = true;
    s.businesses.active = 'garage';
    const back = deserialize(serialize(s, T0), T0)!;
    expect(back.state.businesses).toEqual(s.businesses);
  });
});
