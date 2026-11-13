// Balance simulator: bots play the opening and we check the pacing targets
// from the plan (first manager in 2-3 minutes, etc.). Run `npm run sim` to
// see the timeline printed.

import { describe, expect, it } from 'vitest';
import { ECON, type LegacyNode, type ManagerKind, type UpgradeKind } from '../src/core/config';
import { managerCost, slotCost, upgradeCost } from '../src/core/formulas';
import { cityScale } from '../src/core/cities';
import { mapUnlocked } from '../src/core/businesses';
import { formatCash, formatDuration } from '../src/core/format';
import {
  buySlot,
  buyUpgrade,
  canCrush,
  carStage,
  claimContract,
  crusherUnlocked,
  crushCar,
  hireManager,
  repairTap,
  sellCar,
  tick,
  washCar,
} from '../src/core/sim';
import { contractsUnlocked } from '../src/core/contracts';
import { barnStageCost, barnUnlocked, canKeepBarnCar, keepBarnCar, nextBarnStage, revealBarn, sellBarnCar, startBarnStage } from '../src/core/barn';
import { wantsHaggle } from '../src/core/haggle';
import { buyerMultiplier } from '../src/core/buyers';
import { newGame, type GameState } from '../src/core/state';
import { awardsToClaim, claimAward, medalCount } from '../src/core/achievements';
import { canSellEmpire, legacyMultiplier, showcaseMultiplier, pendingLegacyPoints, sellEmpire } from '../src/core/legacy';
import { buyNode, spentPoints } from '../src/core/legacyTree';
import { canOpenBusiness, openBusiness, switchBusiness, unlockGoal } from '../src/core/businesses';
import {
  buyCarLotUpgrade,
  buyLot,
  buySpot,
  carlotUpgradeCost,
  hireLotCrew,
  lotCrewCost,
  lotProfit,
  refurbTap,
  sellLotCar,
  spotCost,
} from '../src/core/carlot';
import { boothCost, buyBooth, buyPaintUpgrade, hirePainter, painterCost, lotSendBlock, paintTap, paintUpgradeCost, sendLotCarToShop } from '../src/core/paint';
import { buyGarageBay, buyGarageUpgrade, foremanCost, garageBayCost, garageTap, garageUpgradeCost, hireForeman } from '../src/core/garage';

interface BotProfile {
  name: string;
  /** Swipe pixels per second while washing. */
  swipePerSec: number;
  /** Taps per second while repairing. */
  tapsPerSec: number;
  /** Seconds the bot takes to react between actions (selling, buying). */
  reaction: number;
  /** Haggle multiplier the bot lands on big sales. */
  haggle: number;
  /** In the paint shop, send refurbished lot cars into free booths (P1.2f). */
  tuneLotCars?: boolean;
  /** Keep each new barn classic for the showcase instead of selling it (P1.4c); repeats are sold. */
  keepClassics?: boolean;
  /** Claim every reached achievement medal as soon as it is reached (P1.5c). */
  claimAwards?: boolean;
}

const ACTIVE: BotProfile = { name: 'active', swipePerSec: 900, tapsPerSec: 4, reaction: 0.5, haggle: 1.2 };
const RELAXED: BotProfile = { name: 'relaxed', swipePerSec: 450, tapsPerSec: 2, reaction: 2, haggle: 1.05 };

const MANAGER_ORDER: ManagerKind[] = ['mechanic', 'washer', 'seller'];

function spendSmart(s: GameState): void {
  // Managers first, in the order the tutorial teaches.
  for (const m of MANAGER_ORDER) {
    if (!s.managers[m]) {
      if (s.cash >= managerCost(s, m)) hireManager(s, m);
      return; // save up for the next manager before anything else...
    }
  }
  // ...then the barn restoration when the next stage is affordable...
  // (a player saves up for it: upgrades only from cash beyond the stage price).
  let reserve = 0;
  // The Repair Garage is the big goal once its price shows on the map: save for it, then open it.
  const g = ECON.businesses.list.garage;
  // (A barn restoration already under way is finished first.)
  const barnMidway = s.barn.stage > 0 && (s.barn.status === 'covered' || s.barn.status === 'working');
  if (!s.businesses.opened.garage && g.ready && s.lifetimeEarnings >= unlockGoal(s, 'garage') && !barnMidway) {
    if (canOpenBusiness(s, 'garage')) {
      openBusiness(s, 'garage');
      switchBusiness(s, 'garage');
    } else return;
  }
  // Like the yard's crew, the garage's Foreman comes first once the garage is open (it runs while you're away).
  if (s.businesses.opened.garage && !s.garage.foreman) {
    if (s.cash >= foremanCost(s)) hireForeman(s);
    reserve = foremanCost(s);
  }
  // The Used Car Lot is the next big goal: save for it, open it, then its crew (Detailer, then Auction Agent).
  const lot = ECON.businesses.list.carlot;
  if (s.garage.foreman && !s.businesses.opened.carlot && lot.ready && s.lifetimeEarnings >= unlockGoal(s, 'carlot') && !barnMidway) {
    if (canOpenBusiness(s, 'carlot')) {
      openBusiness(s, 'carlot');
      switchBusiness(s, 'carlot');
    } else return;
  }
  if (s.businesses.opened.carlot) {
    for (const k of ['detailer', 'agent'] as const) {
      if (!s.carlot.crew[k]) {
        if (s.cash >= lotCrewCost(s, k)) hireLotCrew(s, k);
        reserve = Math.max(reserve, lotCrewCost(s, k));
        break;
      }
    }
  }
  // Paint & Tuning is the fourth goal once the lot runs on its own: save for it, open it, then hire the Painter.
  const pt = ECON.businesses.list.paint;
  if (s.carlot.crew.agent && !s.businesses.opened.paint && pt.ready && s.lifetimeEarnings >= unlockGoal(s, 'paint') && !barnMidway) {
    if (canOpenBusiness(s, 'paint')) {
      openBusiness(s, 'paint');
      switchBusiness(s, 'paint');
    } else return;
  }
  if (s.businesses.opened.paint && !s.paint.painter) {
    if (s.cash >= painterCost(s)) hirePainter(s);
    reserve = Math.max(reserve, painterCost(s));
  }
  if (nextBarnStage(s)) {
    const c = barnStageCost(s);
    if (s.cash - reserve >= c.cash && s.parts >= c.parts) startBarnStage(s);
    else reserve += c.cash;
  }
  // ...then the cheapest of slot / upgrades.
  const kinds: UpgradeKind[] = crusherUnlocked(s) ? ['wash', 'repair', 'quality', 'press'] : ['wash', 'repair', 'quality'];
  const options: { cost: number; buy: () => boolean }[] = kinds.map(
    (k) => ({ cost: upgradeCost(k, s.levels[k], cityScale(s)), buy: () => buyUpgrade(s, k) }),
  );
  // The Scrapper competes with upgrades once the barn is open (it keeps the parts bin stocked).
  if (barnUnlocked(s) && !s.managers.scrapper) options.push({ cost: managerCost(s, 'scrapper'), buy: () => hireManager(s, 'scrapper') });
  const sc = slotCost(s.slots, cityScale(s));
  if (sc !== null) options.push({ cost: sc, buy: () => buySlot(s) });
  if (s.businesses.opened.garage) {
    for (const k of ['tools', 'rep'] as const) options.push({ cost: garageUpgradeCost(k, s.garage.levels[k], cityScale(s)), buy: () => buyGarageUpgrade(s, k) });
    const bc = garageBayCost(s.garage.bays, cityScale(s));
    if (bc !== null) options.push({ cost: bc, buy: () => buyGarageBay(s) });
  }
  if (s.businesses.opened.carlot) {
    for (const k of ['valet', 'showroom'] as const) options.push({ cost: carlotUpgradeCost(k, s.carlot.levels[k], cityScale(s)), buy: () => buyCarLotUpgrade(s, k) });
    const sp = spotCost(s.carlot.spots, cityScale(s));
    if (sp !== null) options.push({ cost: sp, buy: () => buySpot(s) });
  }
  if (s.businesses.opened.paint) {
    for (const k of ['booth', 'hype'] as const) options.push({ cost: paintUpgradeCost(k, s.paint.levels[k], cityScale(s)), buy: () => buyPaintUpgrade(s, k) });
    const bo = boothCost(s.paint.booths, cityScale(s));
    if (bo !== null) options.push({ cost: bo, buy: () => buyBooth(s) });
  }
  options.sort((a, b) => a.cost - b.cost);
  const best = options[0];
  if (best && best.cost <= s.cash - reserve) best.buy();
}

function earlyUpgrades(s: GameState): void {
  // Before the first manager, a real player buys a couple of cheap upgrades.
  if (!s.managers.mechanic && s.levels.wash < 3 && s.cash >= upgradeCost('wash', s.levels.wash, cityScale(s))) {
    if (s.cash - upgradeCost('wash', s.levels.wash, cityScale(s)) > managerCost(s, 'mechanic') * 0.3) buyUpgrade(s, 'wash');
  }
}

function run(profile: BotProfile, seconds: number, seed = 12345, start?: GameState, stopAtOffer = false) {
  const s = start ?? newGame(0, seed);
  const marks: Record<string, number> = {};
  const dt = 0.1;
  let cooldown = 0;
  let contractCash = 0;
  let tapBudget = 0;
  let contractsClaimed = 0;
  let extraCash = 0;
  let barnCash = 0;
  let scrapperCrushes = 0;
  let lotTunes = 0;
  let awardCash = 0;
  for (let t = 0; t < seconds; t += dt) {
    for (const e of tick(s, dt)) if (e.type === 'crushed' && e.auto) scrapperCrushes++;
    // In the garage (once the yard runs on its own) the bot taps customer cars instead of working the yard.
    const inGarage = s.businesses.active === 'garage' && s.managers.seller;
    if (s.lifetimeEarnings >= unlockGoal(s, 'carlot') && marks.lotGoal === undefined) marks.lotGoal = t;
    if (s.businesses.opened.carlot && marks.lotOpen === undefined) marks.lotOpen = t;
    if (s.carlot.crew.detailer && marks.detailer === undefined) marks.detailer = t;
    if (s.carlot.crew.agent && marks.agent === undefined) marks.agent = t;
    if (s.carlot.spots >= 3 && marks.spot3 === undefined) marks.spot3 = t;
    if (s.lifetimeEarnings >= unlockGoal(s, 'paint') && marks.paintGoal === undefined) marks.paintGoal = t;
    if (s.businesses.opened.paint && marks.paintOpen === undefined) marks.paintOpen = t;
    if (s.paint.painter && marks.painter === undefined) marks.painter = t;
    if (s.paint.booths >= 2 && marks.booth2 === undefined) marks.booth2 = t;
    // In the paint shop the bot taps the oldest order.
    const inPaint = s.businesses.active === 'paint' && s.managers.seller;
    if (inPaint) {
      // P1.2f: a free booth takes a refurbished lot car that hasn't been tuned yet.
      if (profile.tuneLotCars) {
        const lotCar = s.carlot.cars.find((c) => lotSendBlock(s, c.id) === null);
        if (lotCar) {
          sendLotCarToShop(s, lotCar.id);
          lotTunes += 1;
        }
      }
      const job = s.paint.jobs[0];
      if (job) {
        tapBudget += profile.tapsPerSec * dt;
        if (tapBudget >= 1) {
          tapBudget -= 1;
          paintTap(s, job.id);
        }
      }
    }
    if (inGarage) {
      const job = s.garage.jobs[0];
      if (job) {
        tapBudget += profile.tapsPerSec * dt;
        if (tapBudget >= 1) {
          tapBudget -= 1;
          garageTap(s, job.id);
        }
      }
    }
    // On the Used Car Lot the bot bids on the best lot it can afford, refurbishes by tapping and haggles each sale.
    const inLot = s.businesses.active === 'carlot' && s.managers.seller;
    if (inLot) {
      const l = s.carlot;
      const todo = l.cars.find((c) => c.work > 0);
      if (todo) {
        tapBudget += profile.tapsPerSec * dt;
        if (tapBudget >= 1) {
          tapBudget -= 1;
          refurbTap(s, todo.id);
        }
      }
      if (cooldown <= 0) {
        const ready = l.cars.find((c) => c.work === 0);
        if (ready) {
          sellLotCar(s, ready.id, profile.haggle);
          cooldown = profile.reaction + 1;
        } else if (l.cars.length < l.spots) {
          const lots = l.board.filter((b): b is NonNullable<typeof b> => !!b && b.price <= s.cash);
          lots.sort((a, b) => lotProfit(s, b) / (ECON.carlot.conditions[b.condition].work + 4) - lotProfit(s, a) / (ECON.carlot.conditions[a.condition].work + 4));
          if (lots[0]) {
            buyLot(s, lots[0].id);
            cooldown = profile.reaction;
          }
        }
      }
    }
    const car = inGarage || inLot || inPaint ? undefined : (s.cars.find((c) => c.id === s.focusedId) ?? s.cars[0]);
    // Crush a fresh wreck when a crush order is open (what a player chasing contracts does).
    const barnNeedsParts = (nextBarnStage(s)?.parts ?? 0) > s.parts;
    const wantsCrush = barnNeedsParts || s.contracts.some((c) => c.status === 'active' && c.kind === 'crush');
    if (car && wantsCrush && cooldown <= 0 && canCrush(s, car) && car.dirt > 0) {
      crushCar(s, car.id);
      cooldown = profile.reaction;
    } else if (car) {
      const stage = carStage(car);
      if (stage === 'dirty') washCar(s, car.id, profile.swipePerSec * dt);
      else if (stage === 'damaged') {
        // Deterministic tapping: the same run always gives the same timeline.
        tapBudget += profile.tapsPerSec * dt;
        if (tapBudget >= 1) {
          tapBudget -= 1;
          repairTap(s, car.id);
        }
      }
      else if (stage === 'ready' && cooldown <= 0) {
        const haggle = wantsHaggle(s, car) ? profile.haggle : 1;
        const bm = buyerMultiplier(s, car);
        const before = s.cash;
        sellCar(s, car.id, haggle);
        extraCash += (s.cash - before) * (1 - 1 / (bm * haggle));
        cooldown = profile.reaction + (haggle !== 1 ? 1 : 0);
      }
    }
    cooldown -= dt;
    if (cooldown <= 0) {
      for (const c of s.contracts) if (c.status === 'done') {
        contractCash += claimContract(s, c.id).cash;
        contractsClaimed++;
      }
      if (revealBarn(s)) {
        if (profile.keepClassics && canKeepBarnCar(s)) keepBarnCar(s);
        else barnCash += sellBarnCar(s);
      }
      if (profile.claimAwards) for (const id of awardsToClaim(s)) awardCash += claimAward(s, id)?.cash ?? 0;
      earlyUpgrades(s);
      spendSmart(s);
    }
    for (const m of [...MANAGER_ORDER, 'scrapper' as const]) if (s.managers[m] && marks[m] === undefined) marks[m] = t;
    if (s.carsSold >= 1 && marks.firstSale === undefined) marks.firstSale = t;
    if (s.slots >= 2 && marks.slot2 === undefined) marks.slot2 = t;
    if (crusherUnlocked(s) && marks.crusher === undefined) marks.crusher = t;
    if (contractsUnlocked(s) && marks.contracts === undefined) marks.contracts = t;
    if (barnUnlocked(s) && marks.barn === undefined) marks.barn = t;
    if (s.barn.restored > 0 && marks.barnSold === undefined) marks.barnSold = t;
    if (mapUnlocked(s) && marks.map === undefined) marks.map = t;
    if (s.lifetimeEarnings >= unlockGoal(s, 'garage') && marks.garage === undefined) marks.garage = t;
    if (s.businesses.opened.garage && marks.garageOpen === undefined) marks.garageOpen = t;
    if (s.garage.foreman && marks.foreman === undefined) marks.foreman = t;
    if (s.garage.bays >= 2 && marks.bay2 === undefined) marks.bay2 = t;
    if (canSellEmpire(s) && marks.legacy === undefined) {
      marks.legacy = t;
      if (stopAtOffer) break;
    }
  }
  return { s, marks, contractCash, contractsClaimed, extraCash, barnCash, scrapperCrushes, lotTunes, awardCash };
}

describe('opening pacing', () => {
  for (const profile of [ACTIVE, RELAXED]) {
    it(`${profile.name} player hits the first-session targets`, () => {
      const { s, marks, contractCash, contractsClaimed, extraCash, barnCash, scrapperCrushes } = run(profile, 15 * 60);
      const line = (k: string) => `${k.padEnd(10)} ${marks[k] === undefined ? 'never' : formatDuration(marks[k]!)}`;
      console.log(
        [`--- ${profile.name} bot, 15 minutes ---`, ...['firstSale', 'mechanic', 'crusher', 'contracts', 'barn', 'washer', 'seller', 'scrapper', 'barnSold', 'slot2', 'map', 'garage'].map(line),
          `crushed by the Scrapper ${scrapperCrushes}`,
          `cash ${formatCash(s.cash)}, sold ${s.carsSold}, levels ${JSON.stringify(s.levels)}, slots ${s.slots}`,
          `contracts claimed ${contractsClaimed} for ${formatCash(contractCash)} (${((contractCash / Math.max(1, s.lifetimeEarnings)) * 100).toFixed(0)}% of earnings), crushed ${s.stats.carsCrushed}, parts left ${s.parts}`,
          `haggles ${s.stats.haggles}, buyers served ${s.stats.buyersServed}, manual haggle+buyer bonus ${formatCash(extraCash)} (${((extraCash / Math.max(1, s.lifetimeEarnings)) * 100).toFixed(0)}% of earnings)`,
          `barn restored ${s.barn.restored} for ${formatCash(barnCash)} (${((barnCash / Math.max(1, s.lifetimeEarnings)) * 100).toFixed(0)}% of earnings), barn now ${s.barn.status} stage ${s.barn.stage}`].join('\n'),
      );
      // Plan target: first sale within ~30 s, first manager within 2-3 minutes.
      expect(marks.firstSale).toBeLessThan(45);
      expect(marks.mechanic).toBeLessThan(profile === ACTIVE ? 180 : 300);
      // Plan: crusher around minute 3, contracts around minute 5 (bots run ahead of humans).
      expect(marks.crusher).toBeGreaterThan(60);
      expect(marks.crusher).toBeLessThan(300);
      expect(marks.contracts).toBeGreaterThan(marks.crusher!);
      expect(marks.contracts).toBeLessThan(480);
      // Contracts are a bonus, not the main income.
      expect(contractCash / s.lifetimeEarnings).toBeLessThan(0.3);
      // Haggle and buyer bonuses reward attention but must not carry the economy.
      expect(extraCash / s.lifetimeEarnings).toBeLessThan(0.15);
      expect(s.stats.buyersServed).toBeGreaterThan(0);
      // Plan: the barn find opens after contracts; one restoration fits in the first session for an active player
      // but it is a big bonus, not the main income.
      expect(marks.barn).toBeGreaterThan(marks.contracts!);
      expect(barnCash / s.lifetimeEarnings).toBeLessThan(0.25);
      if (profile === ACTIVE) expect(marks.barnSold).toBeLessThan(15 * 60);
      // City map (P1.1): the map opens between the crusher and contracts; an active player reaches the Repair
      // Garage's goal inside the first session (plan: second business within 15 minutes), a relaxed one later.
      expect(marks.map).toBeGreaterThan(marks.crusher!);
      expect(marks.map).toBeLessThan(marks.contracts!);
      if (profile === ACTIVE) expect(marks.garage).toBeGreaterThan(8 * 60);
      if (profile === ACTIVE) expect(marks.garage).toBeLessThan(15 * 60);
      // Full automation inside the first session for an active player.
      if (profile === ACTIVE) expect(marks.seller).toBeLessThan(15 * 60);
    });
  }
});

describe('second quarter hour', () => {
  it('the Scrapper and the Hydraulic Press join in, and the Scrapper keeps parts stocked without eating the yard', () => {
    const { s, marks, scrapperCrushes } = run(ACTIVE, 30 * 60);
    console.log(
      `--- active bot, 30 minutes ---\nscrapper hired ${marks.scrapper === undefined ? 'never' : formatDuration(marks.scrapper)}, ` +
        `press Lv ${s.levels.press}, Scrapper crushed ${scrapperCrushes}, sold ${s.carsSold}, barns ${s.barn.restored}, parts ${s.parts}`,
    );
    expect(marks.scrapper).toBeGreaterThan(15 * 60);
    expect(marks.scrapper).toBeLessThan(30 * 60);
    expect(s.levels.press).toBeGreaterThan(5);
    // Whether it has to crush at all depends on how many parts the player made (seed luck); that it does crush
    // when the bin runs low is covered over many seeds in press-scrapper.test.ts.
    // The Scrapper only tops up the bin: far fewer crushes than sales.
    expect(scrapperCrushes).toBeLessThan(s.carsSold * 0.25);
  });
});

describe('many seeds', () => {
  // One fixed seed can pass or fail by luck (run 7: the barn share read 25.2% on seed 12345 but averaged 18%).
  // Averages over seeds are what the pacing targets mean; single-seed tests above stay as the readable timeline.
  it('active player: full crew and barn share hold on average over 12 seeds', () => {
    const sellers: number[] = [];
    const shares: number[] = [];
    const garages: number[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      const r = run(ACTIVE, 15 * 60, seed);
      sellers.push(r.marks.seller ?? 15 * 60);
      garages.push(r.marks.garage ?? 15 * 60);
      shares.push(r.barnCash / r.s.lifetimeEarnings);
    }
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    console.log(
      `--- active bot, 12 seeds ---\nSalesperson avg ${formatDuration(avg(sellers))} (worst ${formatDuration(Math.max(...sellers))}), ` +
        `barn share avg ${(avg(shares) * 100).toFixed(0)}% (max ${(Math.max(...shares) * 100).toFixed(0)}%), ` +
        `Repair Garage goal avg ${formatDuration(avg(garages))} (worst ${formatDuration(Math.max(...garages))})`,
    );
    // Plan: the second business within 15 minutes (the garage's open cost lands in P1.1c and is tuned then).
    expect(avg(garages)).toBeLessThan(13 * 60);
    expect(Math.max(...garages)).toBeLessThan(15 * 60);
    expect(avg(sellers)).toBeLessThan(12 * 60);
    expect(avg(shares)).toBeLessThan(0.22);
    expect(Math.max(...shares)).toBeLessThan(0.3);
  });
});

describe('Repair Garage (P1.1c)', () => {
  /** Run with the garage buyable even while its UI is still behind `ready: false`. */
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

  it('opens in the first half hour, pays back, and becomes a real second income', () => {
    const rows: string[] = [];
    const opens: number[] = [];
    const shares: number[] = [];
    for (const profile of [ACTIVE, RELAXED]) {
      const { s, marks } = withReadyGarage(() => run(profile, 40 * 60));
      const fmt = (k: string) => (marks[k] === undefined ? 'never' : formatDuration(marks[k]!));
      const share = s.garage.earned / s.lifetimeEarnings;
      rows.push(
        `${profile.name}: goal ${fmt('garage')}, opened ${fmt('garageOpen')}, bay 2 ${fmt('bay2')}, Foreman ${fmt('foreman')}, ` +
          `jobs ${s.garage.jobsDone}, garage earned ${formatCash(s.garage.earned)} (${(share * 100).toFixed(0)}% of all), ` +
          `levels ${JSON.stringify(s.garage.levels)}, bays ${s.garage.bays}`,
      );
      if (profile === ACTIVE) {
        opens.push(marks.garageOpen ?? Infinity);
        shares.push(share);
      }
    }
    console.log(['--- Repair Garage, 40 minutes ---', ...rows].join('\n'));
    // Plan: the second business early in the session; the bot opens it a few minutes after the goal.
    expect(opens[0]).toBeLessThan(18 * 60);
    // The garage matters (a real second income) without replacing the yard.
    expect(shares[0]).toBeGreaterThan(0.15);
    expect(shares[0]).toBeLessThan(0.6);
  });

  it('active player opens the garage before minute 17 on every seed', () => {
    const opens: number[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      const { marks } = withReadyGarage(() => run(ACTIVE, 20 * 60, seed));
      opens.push(marks.garageOpen ?? 20 * 60);
    }
    const avg = opens.reduce((a, b) => a + b, 0) / opens.length;
    console.log(`--- garage opened, 12 seeds --- avg ${formatDuration(avg)}, worst ${formatDuration(Math.max(...opens))}`);
    expect(Math.max(...opens)).toBeLessThan(17 * 60);
  });
});

describe('Used Car Lot (P1.2a)', () => {
  function withReadyLot<T>(fn: () => T): T {
    const list = ECON.businesses.list as unknown as Record<string, { ready: boolean }>;
    const was = list.carlot!.ready;
    list.carlot!.ready = true;
    try {
      return fn();
    } finally {
      list.carlot!.ready = was;
    }
  }

  it('opens within the first hour and a half and becomes a third income', () => {
    const rows: string[] = [];
    const res: Record<string, { open: number; share: number; garageShare: number }> = {};
    for (const profile of [ACTIVE, RELAXED]) {
      const { s, marks } = withReadyLot(() => run(profile, 120 * 60));
      const fmt = (k: string) => (marks[k] === undefined ? 'never' : formatDuration(marks[k]!));
      const share = s.carlot.profit / s.lifetimeEarnings;
      const garageShare = s.garage.earned / s.lifetimeEarnings;
      rows.push(
        `${profile.name}: goal ${fmt('lotGoal')}, opened ${fmt('lotOpen')}, Detailer ${fmt('detailer')}, Agent ${fmt('agent')}, ` +
          `spot 3 ${fmt('spot3')}, Paint & Tuning goal ${fmt('paintGoal')}, sold ${s.carlot.sold}, lot profit ${formatCash(s.carlot.profit)} (${(share * 100).toFixed(0)}% of all), ` +
          `garage ${(garageShare * 100).toFixed(0)}%, lifetime ${formatCash(s.lifetimeEarnings)}, levels ${JSON.stringify(s.carlot.levels)}`,
      );
      res[profile.name] = { open: marks.lotOpen ?? Infinity, share, garageShare };
    }
    console.log(['--- Used Car Lot, 120 minutes ---', ...rows].join('\n'));
    const a = res.active!;
    expect(a.open).toBeGreaterThan(30 * 60);
    expect(a.open).toBeLessThan(75 * 60);
    expect(a.share).toBeGreaterThan(0.15);
    expect(a.share).toBeLessThan(0.65);
    // The garage still matters after the lot opens.
    expect(a.garageShare).toBeGreaterThan(0.05);
  });
});

describe('Paint & Tuning (P1.2d)', () => {
  function withReadyPaint<T>(fn: () => T): T {
    const list = ECON.businesses.list as unknown as Record<string, { ready: boolean }>;
    const was = list.paint!.ready;
    list.paint!.ready = true;
    try {
      return fn();
    } finally {
      list.paint!.ready = was;
    }
  }

  it('opens within the first three hours and becomes a fourth income', () => {
    const rows: string[] = [];
    const res: Record<string, { open: number; share: number; lotShare: number; tips: number; jobs: number }> = {};
    for (const profile of [ACTIVE, RELAXED]) {
      const { s, marks } = withReadyPaint(() => run(profile, 180 * 60));
      const fmt = (k: string) => (marks[k] === undefined ? 'never' : formatDuration(marks[k]!));
      const share = s.paint.earned / s.lifetimeEarnings;
      const lotShare = s.carlot.profit / s.lifetimeEarnings;
      rows.push(
        `${profile.name}: lot open ${fmt('lotOpen')}, Agent ${fmt('agent')}, paint goal ${fmt('paintGoal')}, opened ${fmt('paintOpen')}, ` +
          `Painter ${fmt('painter')}, booth 2 ${fmt('booth2')}, orders ${s.paint.jobsDone} (tips ${s.paint.tips}), ` +
          `paint earned ${formatCash(s.paint.earned)} (${(share * 100).toFixed(0)}% of all), lot ${(lotShare * 100).toFixed(0)}%, ` +
          `lifetime ${formatCash(s.lifetimeEarnings)}, levels ${JSON.stringify(s.paint.levels)}`,
      );
      res[profile.name] = { open: marks.paintOpen ?? Infinity, share, lotShare, tips: s.paint.tips, jobs: s.paint.jobsDone };
    }
    console.log(['--- Paint & Tuning, 180 minutes ---', ...rows].join('\n'));
    const a = res.active!;
    expect(a.open).toBeGreaterThan(70 * 60);
    expect(a.open).toBeLessThan(140 * 60);
    expect(a.share).toBeGreaterThan(0.12);
    expect(a.share).toBeLessThan(0.6);
    // The lot still matters after the shop opens, and an active player earns tips on some orders.
    expect(a.lotShare).toBeGreaterThan(0.1);
    expect(a.tips).toBeGreaterThan(0);
    expect(a.tips).toBeLessThan(a.jobs);
  });

  it('sending lot cars through the shop (P1.2f) is worth it but does not run away', () => {
    // Averaged over three seeds: one seed swings the ratio by +-5% (run 27: 1.10 to 1.19 with the Collection book).
    const rows: string[] = [];
    const ratios: number[] = [];
    for (const seed of [12345, 1, 2]) {
      const out: Record<string, { life: number; lot: number; tunes: number }> = {};
      for (const profile of [ACTIVE, { ...ACTIVE, name: 'active+tune', tuneLotCars: true }]) {
        const { s, lotTunes } = withReadyPaint(() => run(profile, 180 * 60, seed));
        out[profile.name] = { life: s.lifetimeEarnings, lot: s.carlot.profit, tunes: lotTunes };
        rows.push(
          `seed ${seed} ${profile.name}: lot cars tuned ${lotTunes}, lot profit ${formatCash(s.carlot.profit)}, paint ${formatCash(s.paint.earned)}, ` +
            `lifetime ${formatCash(s.lifetimeEarnings)}`,
        );
      }
      const base = out.active!;
      const tuned = out['active+tune']!;
      expect(tuned.tunes).toBeGreaterThan(20);
      expect(tuned.lot).toBeGreaterThan(base.lot);
      ratios.push(tuned.life / base.life);
    }
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    console.log(['--- Lot cars through the shop, 180 minutes ---', ...rows, `lifetime with tunes: x${avg.toFixed(3)} on average (${ratios.map((r) => r.toFixed(3)).join(', ')})`].join('\n'));
    // A bonus for playing both businesses, not a new economy: within +15% lifetime at 3 hours on average.
    expect(Math.min(...ratios)).toBeGreaterThan(1.01);
    expect(avg).toBeLessThan(1.15);
  }, 120_000);
});

describe('Showcase (P1.4c)', () => {
  it('keeping barn classics costs a little now and pays back in the next empire', () => {
    const list = ECON.businesses.list as unknown as Record<string, { ready: boolean }>;
    const was = list.paint!.ready;
    list.paint!.ready = true;
    try {
      const rows: string[] = [];
      for (const seed of [12345, 7]) {
        const sell = run(ACTIVE, 6 * 3600, seed, undefined, true);
        const keep = run({ ...ACTIVE, name: 'active+keep', keepClassics: true }, 6 * 3600, seed, undefined, true);
        const a = sell.marks.legacy!;
        const b = keep.marks.legacy!;
        const kept = keep.s.collection.showcase.length;
        rows.push(
          `seed ${seed}: sale offered ${formatDuration(a)} selling classics (barn ${formatCash(sell.barnCash)}, ${sell.s.barn.restored} restored) vs ` +
            `${formatDuration(b)} keeping (${kept} kept, x${showcaseMultiplier(keep.s).toFixed(2)}, ${keep.s.barn.restored} restored)`,
        );
        expect(kept).toBeGreaterThan(3);
        // A real trade-off: keeping costs a little time in this empire (run 29: +1 min of 3h28m) for +0.5% per
        // classic in every empire after it. Never a trap: the sale moves by less than 5%.
        expect(b / a).toBeLessThan(1.05);
        expect(b / a).toBeGreaterThan(0.98);
      }
      console.log(['--- Showcase: keep vs sell barn classics (first empire) ---', ...rows].join('\n'));
    } finally {
      list.paint!.ready = was;
    }
  }, 180_000);
});

describe('Achievements (P1.5c)', () => {
  it('medal rewards are a small thank-you, not a new income', () => {
    const list = ECON.businesses.list as unknown as Record<string, { ready: boolean }>;
    const was = list.paint!.ready;
    list.paint!.ready = true;
    try {
      const rows: string[] = [];
      for (const seed of [12345, 7]) {
        const base = run(ACTIVE, 6 * 3600, seed, undefined, true);
        const claim = run({ ...ACTIVE, name: 'active+awards', claimAwards: true }, 6 * 3600, seed, undefined, true);
        const a = base.marks.legacy!;
        const b = claim.marks.legacy!;
        const share = claim.awardCash / claim.s.lifetimeEarnings;
        const early = run({ ...ACTIVE, claimAwards: true }, 1800, seed);
        rows.push(
          `seed ${seed}: sale offered ${formatDuration(a)} without claims vs ${formatDuration(b)} claiming ` +
            `(${medalCount(claim.s).have} medals, ${formatCash(claim.awardCash)} = ${(share * 100).toFixed(2)}% of earnings; ` +
            `first 30 min: ${medalCount(early.s).have} medals, ${((early.awardCash / early.s.lifetimeEarnings) * 100).toFixed(1)}%)`,
        );
        // A handful of medals land in the first half hour (something to claim early on)...
        expect(medalCount(early.s).have).toBeGreaterThanOrEqual(4);
        // ...but they stay a bonus: under 6% of early earnings and the first sale moves by less than 3% (run 30: 5/10/20/40
        // cars per medal moved it by 3-4%, now 3/6/12/24: 1-2%).
        expect(early.awardCash / early.s.lifetimeEarnings).toBeLessThan(0.06);
        expect(share).toBeLessThan(0.02);
        expect(b / a).toBeGreaterThan(0.97);
        expect(b / a).toBeLessThanOrEqual(1);
      }
      console.log(['--- Achievements: claiming medals vs not (first empire) ---', ...rows].join('\n'));
    } finally {
      list.paint!.ready = was;
    }
  }, 180_000);
});

describe('Sell Empire (P1.3a)', () => {
  function withReadyPaint<T>(fn: () => T): T {
    const list = ECON.businesses.list as unknown as Record<string, { ready: boolean }>;
    const was = list.paint!.ready;
    list.paint!.ready = true;
    try {
      return fn();
    } finally {
      list.paint!.ready = was;
    }
  }

  it('the first sale comes after all four businesses, and the second empire grows faster', () => {
    const rows: string[] = [];
    const first: Record<string, number> = {};
    for (const profile of [ACTIVE, RELAXED]) {
      const { s, marks } = withReadyPaint(() => run(profile, 7 * 3600));
      first[profile.name] = marks.legacy ?? Infinity;
      const fmt = (k: string) => (marks[k] === undefined ? 'never' : formatDuration(marks[k]!));
      rows.push(
        `${profile.name}: paint open ${fmt('paintOpen')}, Sell Empire offered ${fmt('legacy')} ` +
          `(7 h: lifetime ${formatCash(s.lifetimeEarnings)}, ${pendingLegacyPoints(s)} points waiting)`,
      );
    }
    // Second empire: sell as soon as it's offered, play the same bot again.
    const one = withReadyPaint(() => run(ACTIVE, Math.min(first.active!, 7 * 3600) + 1));
    const sold = sellEmpire(one.s, 0);
    expect(sold?.points).toBeGreaterThanOrEqual(ECON.legacy.minPoints);
    const two = withReadyPaint(() => run(ACTIVE, 7 * 3600, 999, one.s));
    const base = withReadyPaint(() => run(ACTIVE, 7 * 3600, 999));
    const fmt2 = (m: Record<string, number>, k: string) => (m[k] === undefined ? 'never' : formatDuration(m[k]!));
    rows.push(
      `active, 2nd empire (x${legacyMultiplier(one.s).toFixed(2)}): garage ${fmt2(two.marks, 'garageOpen')} vs ${fmt2(base.marks, 'garageOpen')}, ` +
        `lot ${fmt2(two.marks, 'lotOpen')} vs ${fmt2(base.marks, 'lotOpen')}, paint ${fmt2(two.marks, 'paintOpen')} vs ${fmt2(base.marks, 'paintOpen')}, ` +
        `next sale ${fmt2(two.marks, 'legacy')} (${pendingLegacyPoints(two.s)} points waiting at 7 h)`,
    );
    console.log(['--- Sell Empire ---', ...rows].join('\n'));
    // Pacing: the plan wants the first prestige on day 2-3 for a casual player; for the always-tapping bot that is
    // after the fourth business is running, between 3 and 5 hours of play.
    expect(first.active!).toBeGreaterThan(3 * 3600);
    expect(first.active!).toBeLessThan(5 * 3600);
    expect(first.relaxed!).toBeGreaterThan(first.active!);
    // The second empire opens every business sooner, and (P1.3d4) is offered its own sale no later than the first.
    expect(two.marks.legacy!).toBeLessThanOrEqual(first.active! + 60);
    expect(two.marks.paintOpen!).toBeLessThan(base.marks.paintOpen!);
    expect(two.marks.lotOpen!).toBeLessThan(base.marks.lotOpen!);
  }, 60_000);
});

describe('Legacy tree (P1.3c)', () => {
  function withReadyPaint<T>(fn: () => T): T {
    const list = ECON.businesses.list as unknown as Record<string, { ready: boolean }>;
    const was = list.paint!.ready;
    list.paint!.ready = true;
    try {
      return fn();
    } finally {
      list.paint!.ready = was;
    }
  }

  it('each branch speeds up the second empire without running away', () => {
    const first = withReadyPaint(() => run(ACTIVE, 7 * 3600));
    const offered = first.marks.legacy!;
    const plans: Record<string, LegacyNode[]> = {
      none: [],
      mechanic: ['quickHands', 'headStart', 'partsHoarder'],
      dealer: ['silverTongue', 'regulars', 'insider'],
      racer: ['quickTips', 'rareFinds', 'barnScout'],
    };
    const hours = 4;
    const rows: string[] = [];
    const out: Record<string, { paint: number; lifetime: number }> = {};
    for (const [name, nodes] of Object.entries(plans)) {
      const one = withReadyPaint(() => run(ACTIVE, offered + 1));
      // Points bank on the sale, so the tree is bought at the start of the new empire (Head Start pays from the next one).
      expect(sellEmpire(one.s, 0)).not.toBeNull();
      for (const n of nodes) expect(buyNode(one.s, n)).toBe(true);
      const two = withReadyPaint(() => run(ACTIVE, hours * 3600, 999, one.s));
      out[name] = { paint: two.marks.paintOpen ?? Infinity, lifetime: two.s.lifetimeEarnings };
      rows.push(
        `${name.padEnd(8)} (${spentPoints(one.s.legacy)}/${one.s.legacy.points} pts): garage ${formatDuration(two.marks.garageOpen ?? 0)}, ` +
          `lot ${formatDuration(two.marks.lotOpen ?? 0)}, paint ${two.marks.paintOpen === undefined ? 'never' : formatDuration(two.marks.paintOpen)}, ` +
          `${hours} h lifetime ${formatCash(two.s.lifetimeEarnings)}`,
      );
    }
    console.log(['--- Legacy tree, 2nd empire (active bot, first 10 points) ---', ...rows].join('\n'));
    for (const name of ['mechanic', 'dealer', 'racer']) {
      // Every branch helps...
      expect(out[name]!.lifetime).toBeGreaterThan(out.none!.lifetime);
      expect(out[name]!.paint).toBeLessThanOrEqual(out.none!.paint);
      // ...but ten points never more than +60% at 4 hours (the +2% per point already gives x1.24).
      expect(out[name]!.lifetime).toBeLessThan(out.none!.lifetime * 1.6);
    }
  }, 180_000);
});


describe('Motor City (P1.3d)', () => {
  function withReadyPaint<T>(fn: () => T): T {
    const list = ECON.businesses.list as unknown as Record<string, { ready: boolean }>;
    const was = list.paint!.ready;
    list.paint!.ready = true;
    try {
      return fn();
    } finally {
      list.paint!.ready = was;
    }
  }

  it('a third empire in Motor City sells sooner than the first Rust Valley run and earns x scale', () => {
    const K = ECON.cities.list.motorCity.scale;
    const one = withReadyPaint(() => run(ACTIVE, 7 * 3600));
    const firstOffer = one.marks.legacy!;
    // Replay the first empire up to its offer, sell (Rust Valley is the only choice), play the second one to its offer.
    const a = withReadyPaint(() => run(ACTIVE, firstOffer + 1));
    expect(sellEmpire(a.s, 0)!.city).toBe('rustValley');
    const clone = (x: GameState) => JSON.parse(JSON.stringify(x)) as GameState;
    const two = withReadyPaint(() => run(ACTIVE, 7 * 3600, 999, clone(a.s)));
    const secondOffer = two.marks.legacy!;
    expect(secondOffer).toBeDefined();
    const b = withReadyPaint(() => run(ACTIVE, secondOffer + 1, 999, clone(a.s)));
    const third: Record<string, ReturnType<typeof run>> = {};
    for (const city of ['rustValley', 'motorCity'] as const) {
      const s = clone(b.s);
      expect(sellEmpire(s, 0, city)?.city).toBe(city);
      third[city] = withReadyPaint(() => run(ACTIVE, 5 * 3600, 999, s));
    }
    const rv = third.rustValley!;
    const mc = third.motorCity!;
    const f = (m: Record<string, number>, k: string) => (m[k] === undefined ? 'never' : formatDuration(m[k]!));
    console.log(
      [
        '--- Motor City, 3rd empire (active bot) ---',
        `1st empire (Rust Valley): sale offered ${formatDuration(firstOffer)}; 2nd: ${formatDuration(secondOffer)} (x${legacyMultiplier(b.s).toFixed(2)})`,
        `3rd in Rust Valley: paint ${f(rv.marks, 'paintOpen')}, sale offered ${f(rv.marks, 'legacy')}, 5 h lifetime ${formatCash(rv.s.lifetimeEarnings)}`,
        `3rd in Motor City:  paint ${f(mc.marks, 'paintOpen')}, sale offered ${f(mc.marks, 'legacy')}, 5 h lifetime ${formatCash(mc.s.lifetimeEarnings)} ` +
          `(x${(mc.s.lifetimeEarnings / rv.s.lifetimeEarnings).toFixed(2)}), ${pendingLegacyPoints(mc.s)} vs ${pendingLegacyPoints(rv.s)} points waiting`,
      ].join('\n'),
    );
    // Same pacing inside the run (every price and value x K)...
    expect(mc.s.lifetimeEarnings / rv.s.lifetimeEarnings).toBeGreaterThan(K * 0.85);
    expect(mc.s.lifetimeEarnings / rv.s.lifetimeEarnings).toBeLessThan(K * 1.15);
    expect(Math.abs(mc.marks.paintOpen! - rv.marks.paintOpen!)).toBeLessThan(15 * 60);
    // ...but Legacy comes faster: the Motor City run is offered the sale before Rust Valley's first run and its own.
    expect(mc.marks.legacy!).toBeLessThan(firstOffer);
    // Not a runaway: still a session or two of play (x3: offered at about 1h55m for the always-tapping bot).
    expect(mc.marks.legacy!).toBeGreaterThan(1.5 * 3600);
    expect(mc.marks.legacy!).toBeLessThan(rv.marks.legacy ?? Infinity);
    expect(pendingLegacyPoints(mc.s)).toBeGreaterThan(pendingLegacyPoints(rv.s) * 1.5);
  }, 240_000);

  it('every empire is offered its sale no later than the one before, without running away (P1.3d4)', () => {
    // The active bot sells at each offer: two empires in Rust Valley, then Motor City from the 2nd sale on.
    const cities = ['rustValley', 'motorCity', 'motorCity', 'motorCity', 'motorCity'] as const;
    let s: GameState | undefined;
    const offers: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = withReadyPaint(() => run(ACTIVE, 6 * 3600, 12345, s, true));
      expect(r.marks.legacy).toBeDefined();
      offers.push(r.marks.legacy!);
      if (i < cities.length) expect(sellEmpire(r.s, 0, cities[i])).not.toBeNull();
      s = r.s;
    }
    console.log(['--- Sale offers, empires 1-6 (active bot, sells at each offer) ---', offers.map((t, i) => `${i + 1}: ${formatDuration(t)}`).join(' | ')].join('\n'));
    // A minute of slack for the bot's own noise.
    for (let i = 1; i < offers.length; i++) expect(offers[i]!).toBeLessThanOrEqual(offers[i - 1]! + 60);
    // The 2nd empire, still in Rust Valley, is no slower than the first (it was 4h47m on the square-root curve).
    expect(offers[1]!).toBeLessThan(3.5 * 3600);
    // Six empires in, a run is still more than an hour for the always-tapping bot.
    expect(offers[5]!).toBeGreaterThan(3600);
  }, 300_000);
});

