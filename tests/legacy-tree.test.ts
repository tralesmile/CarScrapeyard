import { describe, expect, it } from 'vitest';
import { ECON, type LegacyNode } from '../src/core/config';
import { carlotIdleIncome, detailerRate, generateLot, lotBuyerInterval, refurbPerTap } from '../src/core/carlot';
import { openBusiness, openCost } from '../src/core/businesses';
import { crushParts, expectedCarValue, idleIncomePerSecond, managerRate, offlineEarnings, repairPerTap, washPerPixel } from '../src/core/formulas';
import { foremanRate, garageOfflineEarnings, garageWorkPerTap } from '../src/core/garage';
import { haggleMultiplier } from '../src/core/haggle';
import { sellEmpire } from '../src/core/legacy';
import {
  barnFindSeconds,
  barnStageSeconds,
  buyNode,
  canBuyNode,
  canRespec,
  freePoints,
  hasNode,
  nodeStatus,
  offlineCap,
  perfectZone,
  respecTree,
  sanitizeTree,
  spentPoints,
} from '../src/core/legacyTree';
import { paintWorkPerTap, painterRate, tipDeadline, generatePaintJob } from '../src/core/paint';
import { deserialize, serialize } from '../src/core/save';
import { crushCar, tick } from '../src/core/sim';
import { tickBuyers } from '../src/core/buyers';
import { newGame, type GameState } from '../src/core/state';

const T0 = 1_800_000_000_000;
const T = ECON.legacy.tree;

function withPoints(points: number): GameState {
  const s = newGame(T0, 9);
  s.legacy.points = points;
  s.legacy.allTime = points * points * ECON.legacy.pointScale;
  return s;
}

/** A state that runs every business on its own, for the A/B checks. */
function empire(nodes: LegacyNode[] = []): GameState {
  const s = withPoints(60);
  s.carsSold = 300;
  s.managers = { mechanic: true, washer: true, seller: true, scrapper: false };
  s.businesses.opened = { scrapyard: true, garage: true, carlot: true, paint: true };
  s.garage.foreman = true;
  s.carlot.crew = { detailer: true, agent: true };
  s.paint.painter = true;
  for (const n of nodes) {
    // Buy every earlier node of the branch too.
    const branch = (Object.keys(T.branches) as (keyof typeof T.branches)[]).find((b) => (T.branches[b].nodes as readonly string[]).includes(n))!;
    while (!hasNode(s, n)) expect(buyNode(s, T.branches[branch].nodes[s.legacy.tree[branch]]!)).toBe(true);
  }
  return s;
}

describe('buying nodes', () => {
  it('in order within a branch, for 2/3/5/8 points, without lowering the income multiplier', () => {
    const s = withPoints(12);
    expect(nodeStatus(s, 'quickHands')).toBe('next');
    expect(nodeStatus(s, 'headStart')).toBe('locked');
    expect(canBuyNode(s, 'headStart')).toBe(false);
    expect(buyNode(s, 'headStart')).toBe(false);
    expect(buyNode(s, 'quickHands')).toBe(true);
    expect(buyNode(s, 'quickHands')).toBe(false); // owned
    expect(nodeStatus(s, 'quickHands')).toBe('owned');
    expect(buyNode(s, 'headStart')).toBe(true);
    expect(buyNode(s, 'silverTongue')).toBe(true);
    expect(spentPoints(s.legacy)).toBe(7);
    expect(freePoints(s)).toBe(5);
    expect(buyNode(s, 'partsHoarder')).toBe(true); // exactly 5
    expect(freePoints(s)).toBe(0);
    expect(canBuyNode(s, 'quickTips')).toBe(false);
    // Points are never consumed from the multiplier.
    expect(s.legacy.points).toBe(12);
  });

  it('the whole tree costs 54 points', () => {
    const s = withPoints(54);
    for (const b of Object.values(T.branches)) for (const n of b.nodes) expect(buyNode(s, n)).toBe(true);
    expect(freePoints(s)).toBe(0);
    expect(spentPoints(s.legacy)).toBe(54);
  });

  it('respec refunds everything once per empire; a sale gives a new one and keeps the nodes', () => {
    const s = withPoints(10);
    expect(canRespec(s)).toBe(false); // nothing to refund
    buyNode(s, 'quickTips');
    buyNode(s, 'rareFinds');
    expect(respecTree(s)).toBe(5);
    expect(freePoints(s)).toBe(10);
    buyNode(s, 'silverTongue');
    expect(canRespec(s)).toBe(false);
    expect(respecTree(s)).toBe(0);
    expect(hasNode(s, 'silverTongue')).toBe(true);
    s.lifetimeEarnings = 100 * ECON.legacy.pointScale * 10;
    expect(sellEmpire(s, T0)).not.toBeNull();
    expect(hasNode(s, 'silverTongue')).toBe(true);
    expect(s.legacy.respecUsed).toBe(false);
    expect(canRespec(s)).toBe(true);
  });

  it('save repair: whole levels 0-4, never more spent than owned', () => {
    const l = withPoints(6).legacy;
    l.tree = { mechanic: 9, dealer: -1, racer: 1.7 } as typeof l.tree;
    (l as { respecUsed: unknown }).respecUsed = 'yes';
    sanitizeTree(l);
    // mechanic 4 (18) + racer 1 (2) = 20 > 6: drop from the top until it fits (mechanic 2 + racer 1 = 7 > 6 -> mechanic 1).
    expect(spentPoints(l)).toBeLessThanOrEqual(6);
    expect(l.tree.dealer).toBe(0);
    expect(l.tree.racer).toBe(1);
    expect(l.tree.mechanic).toBe(1);
    expect(l.respecUsed).toBe(false);
    const missing = withPoints(3).legacy as unknown as Record<string, unknown>;
    delete missing.tree;
    sanitizeTree(missing as unknown as GameState['legacy']);
    expect((missing as unknown as GameState['legacy']).tree).toEqual({ mechanic: 0, dealer: 0, racer: 0 });
  });

  it('round-trips through a save, and older saves get an empty tree', () => {
    const s = withPoints(12);
    buyNode(s, 'quickHands');
    buyNode(s, 'quickTips');
    const back = deserialize(serialize(s, T0), T0)!.state;
    expect(back.legacy.tree).toEqual({ mechanic: 1, dealer: 0, racer: 1 });
    const old = JSON.parse(JSON.stringify(newGame(T0, 3)));
    delete old.legacy.tree;
    delete old.legacy.respecUsed;
    const rebuilt = serialize(old as GameState, T0);
    expect(deserialize(rebuilt, T0)!.state.legacy.tree).toEqual({ mechanic: 0, dealer: 0, racer: 0 });
  });
});

describe('Mechanic branch', () => {
  it('Quick Hands: +25% tap work in every business', () => {
    const a = empire();
    const b = empire(['quickHands']);
    const k = 1 + T.quickHandsTap;
    expect(washPerPixel(b) / washPerPixel(a)).toBeCloseTo(k, 9);
    expect(repairPerTap(b) / repairPerTap(a)).toBeCloseTo(k, 9);
    expect(garageWorkPerTap(b) / garageWorkPerTap(a)).toBeCloseTo(k, 9);
    expect(refurbPerTap(b) / refurbPerTap(a)).toBeCloseTo(k, 9);
    expect(paintWorkPerTap(b) / paintWorkPerTap(a)).toBeCloseTo(k, 9);
    // Crew are not taps.
    expect(managerRate(b, 'mechanic')).toBe(managerRate(a, 'mechanic'));
  });

  it('Head Start: the next empire starts with cash and the Mechanic, and its save loads', () => {
    const s = withPoints(12);
    buyNode(s, 'quickHands');
    buyNode(s, 'headStart');
    s.lifetimeEarnings = 600 * ECON.legacy.pointScale;
    sellEmpire(s, T0);
    expect(s.cash).toBe(T.headStartCash);
    expect(s.managers.mechanic).toBe(true);
    expect(s.lifetimeEarnings).toBe(0); // a gift, not earnings: it doesn't count for points
    respecTree(s); // even after a respec the gifted cash is a legal save
    expect(deserialize(serialize(s, T0), T0)?.state.cash).toBe(T.headStartCash);
    // Without the node a sale starts with nothing.
    const plain = withPoints(12);
    plain.lifetimeEarnings = 600 * ECON.legacy.pointScale;
    sellEmpire(plain, T0);
    expect(plain.cash).toBe(0);
    expect(plain.managers.mechanic).toBe(false);
  });

  it('Parts Hoarder: +50% parts per crush', () => {
    const a = empire();
    const b = empire(['partsHoarder']);
    for (const s of [a, b]) {
      s.cars = [];
      s.arrivalTimer = 100;
      tick(s, 0.05);
      crushCar(s, s.cars[0]!.id);
    }
    expect(b.parts / a.parts).toBeCloseTo(1 + T.partsHoarderBonus, 1);
    expect(crushParts('common', 1, 0.5)).toBe(Math.round(ECON.crusher.parts.common * 1.5));
    expect(crushParts('legendary', 3, 0.5)).toBeGreaterThan(crushParts('legendary', 3));
  });

  it('Master Crew: every crew member works 30% faster, and idle income rises', () => {
    const a = empire();
    const b = empire(['masterCrew']);
    const k = 1 + T.masterCrewSpeed;
    expect(managerRate(b, 'washer') / managerRate(a, 'washer')).toBeCloseTo(k, 9);
    expect(managerRate(b, 'mechanic') / managerRate(a, 'mechanic')).toBeCloseTo(k, 9);
    expect(foremanRate(b) / foremanRate(a)).toBeCloseTo(k, 9);
    expect(detailerRate(b) / detailerRate(a)).toBeCloseTo(k, 9);
    expect(painterRate(b) / painterRate(a)).toBeCloseTo(k, 9);
    expect(idleIncomePerSecond(b)).toBeGreaterThan(idleIncomePerSecond(a));
    expect(carlotIdleIncome(b)).toBeGreaterThanOrEqual(carlotIdleIncome(a));
  });
});

describe('Dealer branch', () => {
  it('Silver Tongue: a wider PERFECT zone that pays the max', () => {
    const a = empire();
    const b = empire(['silverTongue']);
    expect(perfectZone(b) / perfectZone(a)).toBeCloseTo(1 + T.silverTongueZone, 9);
    // Just outside the normal zone: not perfect without the node, perfect with it.
    const pos = 0.5 + (perfectZone(a) * 1.1) / 2;
    expect(haggleMultiplier(pos, false, perfectZone(a))).toBeLessThan(ECON.haggle.max);
    expect(haggleMultiplier(pos, false, perfectZone(b))).toBe(ECON.haggle.max);
    expect(haggleMultiplier(0, false, perfectZone(b))).toBe(ECON.haggle.min);
  });

  it('Regulars: yard buyers and lot walk-ups come 25% more often', () => {
    const a = empire();
    const b = empire(['silverTongue', 'regulars']);
    expect(lotBuyerInterval(a) / lotBuyerInterval(b)).toBeCloseTo(1 + T.regularsRate, 9);
    expect(lotBuyerInterval(b)).toBeGreaterThan(ECON.carlot.buyerLookSeconds);
    for (const s of [a, b]) {
      s.buyer = { kind: 'collector', timeLeft: 0.01 };
      tickBuyers(s, 0.02, []);
    }
    expect(a.buyerTimer / b.buyerTimer).toBeCloseTo(1 + T.regularsRate, 9);
  });

  it('Insider: auction prices 10% lower, so the lot earns more on its own', () => {
    const a = empire();
    const b = empire(['silverTongue', 'regulars', 'insider']);
    b.rng = a.rng;
    const la = generateLot(a);
    const lb = generateLot(b);
    expect(lb.family).toBe(la.family);
    expect(lb.price / la.price).toBeCloseTo(1 - T.insiderDiscount, 2);
    const c = empire(['silverTongue', 'regulars']);
    expect(carlotIdleIncome(b)).toBeGreaterThan(carlotIdleIncome(c));
  });

  it('Franchise: opening a business costs 25% less', () => {
    const s = withPoints(18);
    for (const n of T.branches.dealer.nodes) buyNode(s, n);
    s.lifetimeEarnings = ECON.businesses.list.garage.unlockLifetime;
    expect(openCost(s, 'garage')).toBe(ECON.businesses.list.garage.openCost * (1 - T.franchiseDiscount));
    s.cash = openCost(s, 'garage');
    expect(openBusiness(s, 'garage')).toBe(true);
    expect(s.cash).toBe(0);
  });
});

describe('Racer branch', () => {
  it('Quick Tips: +1 s per service on the tip timer', () => {
    const s = empire(['quickTips']);
    const job = generatePaintJob(s);
    expect(tipDeadline(job, s) - tipDeadline(job)).toBeCloseTo(T.quickTipsSeconds * job.services.length, 9);
    expect(tipDeadline(job, empire())).toBe(tipDeadline(job));
  });

  it('Rare Finds: rarer cars come more often, worth more on average', () => {
    const a = empire();
    const b = empire(['quickTips', 'rareFinds']);
    expect(expectedCarValue(1, 300, T.rareFindsMult)).toBeGreaterThan(expectedCarValue(1, 300));
    expect(idleIncomePerSecond(b)).toBeGreaterThan(idleIncomePerSecond(a));
    // Over many arrivals the share of non-Common cars rises from 22% to ~27%.
    const share = (s: GameState) => {
      let rare = 0;
      const n = 3000;
      for (let i = 0; i < n; i++) {
        s.cars = [];
        s.arrivalTimer = 100;
        tick(s, 0.01);
        if (s.cars[0]!.rarity !== 'common') rare++;
      }
      return rare / n;
    };
    const w = ECON.rarity;
    const rest = w.rare.weight + w.epic.weight + w.legendary.weight;
    const expectA = rest / (w.common.weight + rest);
    const expectB = (rest * T.rareFindsMult) / (w.common.weight + rest * T.rareFindsMult);
    const ra = share(a);
    const rb = share(b);
    expect(Math.abs(ra - expectA)).toBeLessThan(0.025);
    expect(Math.abs(rb - expectB)).toBeLessThan(0.025);
    expect(rb).toBeGreaterThan(ra);
  });

  it('Barn Scout: finds twice as often and 20% shorter stages', () => {
    const a = empire();
    const b = empire(['quickTips', 'rareFinds', 'barnScout']);
    expect(barnFindSeconds(a) / barnFindSeconds(b)).toBeCloseTo(T.barnScoutFind, 9);
    for (let i = 0; i < ECON.barn.stages.length; i++) expect(barnStageSeconds(b, i) / barnStageSeconds(a, i)).toBeCloseTo(1 - T.barnScoutStage, 9);
    expect(barnStageSeconds(a, 99)).toBe(0);
  });

  it('Night Shift: the offline cap is 2 hours longer in every business', () => {
    const a = empire();
    const b = empire(T.branches.racer.nodes.slice() as LegacyNode[]);
    expect(offlineCap(b) - offlineCap(a)).toBe(T.nightShiftSeconds);
    const long = 10 * 3600;
    // Rare Finds changes the rate too, so compare each state with its own rate: only the cap differs.
    expect(offlineEarnings(b, long) / offlineEarnings(b, ECON.offline.capSeconds)).toBeCloseTo(offlineCap(b) / ECON.offline.capSeconds, 2);
    expect(offlineEarnings(a, long)).toBe(offlineEarnings(a, ECON.offline.capSeconds));
    expect(garageOfflineEarnings(b, long)).toBeGreaterThan(garageOfflineEarnings(a, long));
  });
});
