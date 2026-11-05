// Balance simulator: bots play the opening and we check the pacing targets
// from the plan (first manager in 2-3 minutes, etc.). Run `npm run sim` to
// see the timeline printed.

import { describe, expect, it } from 'vitest';
import { ECON, type ManagerKind, type UpgradeKind } from '../src/core/config';
import { slotCost, upgradeCost } from '../src/core/formulas';
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
import { barnStageCost, barnUnlocked, nextBarnStage, revealBarn, sellBarnCar, startBarnStage } from '../src/core/barn';
import { wantsHaggle } from '../src/core/haggle';
import { buyerMultiplier } from '../src/core/buyers';
import { newGame, type GameState } from '../src/core/state';

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
}

const ACTIVE: BotProfile = { name: 'active', swipePerSec: 900, tapsPerSec: 4, reaction: 0.5, haggle: 1.2 };
const RELAXED: BotProfile = { name: 'relaxed', swipePerSec: 450, tapsPerSec: 2, reaction: 2, haggle: 1.05 };

const MANAGER_ORDER: ManagerKind[] = ['mechanic', 'washer', 'seller'];

function spendSmart(s: GameState): void {
  // Managers first, in the order the tutorial teaches.
  for (const m of MANAGER_ORDER) {
    if (!s.managers[m]) {
      if (s.cash >= ECON.managers[m].cost) hireManager(s, m);
      return; // save up for the next manager before anything else...
    }
  }
  // ...then the barn restoration when the next stage is affordable...
  // (a player saves up for it: upgrades only from cash beyond the stage price).
  let reserve = 0;
  if (nextBarnStage(s)) {
    const c = barnStageCost(s);
    if (s.cash >= c.cash && s.parts >= c.parts) startBarnStage(s);
    else reserve = c.cash;
  }
  // ...then the cheapest of slot / upgrades.
  const kinds: UpgradeKind[] = crusherUnlocked(s) ? ['wash', 'repair', 'quality', 'press'] : ['wash', 'repair', 'quality'];
  const options: { cost: number; buy: () => boolean }[] = kinds.map(
    (k) => ({ cost: upgradeCost(k, s.levels[k]), buy: () => buyUpgrade(s, k) }),
  );
  // The Scrapper competes with upgrades once the barn is open (it keeps the parts bin stocked).
  if (barnUnlocked(s) && !s.managers.scrapper) options.push({ cost: ECON.managers.scrapper.cost, buy: () => hireManager(s, 'scrapper') });
  const sc = slotCost(s.slots);
  if (sc !== null) options.push({ cost: sc, buy: () => buySlot(s) });
  options.sort((a, b) => a.cost - b.cost);
  const best = options[0];
  if (best && best.cost <= s.cash - reserve) best.buy();
}

function earlyUpgrades(s: GameState): void {
  // Before the first manager, a real player buys a couple of cheap upgrades.
  if (!s.managers.mechanic && s.levels.wash < 3 && s.cash >= upgradeCost('wash', s.levels.wash) + 0) {
    if (s.cash - upgradeCost('wash', s.levels.wash) > ECON.managers.mechanic.cost * 0.3) buyUpgrade(s, 'wash');
  }
}

function run(profile: BotProfile, seconds: number) {
  const s = newGame(0, 12345);
  const marks: Record<string, number> = {};
  const dt = 0.1;
  let cooldown = 0;
  let contractCash = 0;
  let tapBudget = 0;
  let contractsClaimed = 0;
  let extraCash = 0;
  let barnCash = 0;
  let scrapperCrushes = 0;
  for (let t = 0; t < seconds; t += dt) {
    for (const e of tick(s, dt)) if (e.type === 'crushed' && e.auto) scrapperCrushes++;
    const car = s.cars.find((c) => c.id === s.focusedId) ?? s.cars[0];
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
      if (revealBarn(s)) barnCash += sellBarnCar(s);
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
  }
  return { s, marks, contractCash, contractsClaimed, extraCash, barnCash, scrapperCrushes };
}

describe('opening pacing', () => {
  for (const profile of [ACTIVE, RELAXED]) {
    it(`${profile.name} player hits the first-session targets`, () => {
      const { s, marks, contractCash, contractsClaimed, extraCash, barnCash, scrapperCrushes } = run(profile, 15 * 60);
      const line = (k: string) => `${k.padEnd(10)} ${marks[k] === undefined ? 'never' : formatDuration(marks[k]!)}`;
      console.log(
        [`--- ${profile.name} bot, 15 minutes ---`, ...['firstSale', 'mechanic', 'crusher', 'contracts', 'barn', 'washer', 'seller', 'scrapper', 'barnSold', 'slot2'].map(line),
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
    expect(scrapperCrushes).toBeGreaterThan(0);
    // The Scrapper only tops up the bin: far fewer crushes than sales.
    expect(scrapperCrushes).toBeLessThan(s.carsSold * 0.25);
  });
});
