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
import { newGame, type GameState } from '../src/core/state';

interface BotProfile {
  name: string;
  /** Swipe pixels per second while washing. */
  swipePerSec: number;
  /** Taps per second while repairing. */
  tapsPerSec: number;
  /** Seconds the bot takes to react between actions (selling, buying). */
  reaction: number;
}

const ACTIVE: BotProfile = { name: 'active', swipePerSec: 900, tapsPerSec: 4, reaction: 0.5 };
const RELAXED: BotProfile = { name: 'relaxed', swipePerSec: 450, tapsPerSec: 2, reaction: 2 };

const MANAGER_ORDER: ManagerKind[] = ['mechanic', 'washer', 'seller'];

function spendSmart(s: GameState): void {
  // Managers first, in the order the tutorial teaches.
  for (const m of MANAGER_ORDER) {
    if (!s.managers[m]) {
      if (s.cash >= ECON.managers[m].cost) hireManager(s, m);
      return; // save up for the next manager before anything else...
    }
  }
  // ...then the cheapest of slot / upgrades.
  const options: { cost: number; buy: () => boolean }[] = (['wash', 'repair', 'quality'] as UpgradeKind[]).map(
    (k) => ({ cost: upgradeCost(k, s.levels[k]), buy: () => buyUpgrade(s, k) }),
  );
  const sc = slotCost(s.slots);
  if (sc !== null) options.push({ cost: sc, buy: () => buySlot(s) });
  options.sort((a, b) => a.cost - b.cost);
  const best = options[0];
  if (best && best.cost <= s.cash) best.buy();
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
  for (let t = 0; t < seconds; t += dt) {
    tick(s, dt);
    const car = s.cars.find((c) => c.id === s.focusedId) ?? s.cars[0];
    // Crush a fresh wreck when a crush order is open (what a player chasing contracts does).
    const wantsCrush = s.contracts.some((c) => c.status === 'active' && c.kind === 'crush');
    if (car && wantsCrush && cooldown <= 0 && canCrush(s, car) && car.dirt === 1) {
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
        sellCar(s, car.id);
        cooldown = profile.reaction;
      }
    }
    cooldown -= dt;
    if (cooldown <= 0) {
      for (const c of s.contracts) if (c.status === 'done') {
        contractCash += claimContract(s, c.id).cash;
        contractsClaimed++;
      }
      earlyUpgrades(s);
      spendSmart(s);
    }
    for (const m of MANAGER_ORDER) if (s.managers[m] && marks[m] === undefined) marks[m] = t;
    if (s.carsSold >= 1 && marks.firstSale === undefined) marks.firstSale = t;
    if (s.slots >= 2 && marks.slot2 === undefined) marks.slot2 = t;
    if (crusherUnlocked(s) && marks.crusher === undefined) marks.crusher = t;
    if (contractsUnlocked(s) && marks.contracts === undefined) marks.contracts = t;
  }
  return { s, marks, contractCash, contractsClaimed };
}

describe('opening pacing', () => {
  for (const profile of [ACTIVE, RELAXED]) {
    it(`${profile.name} player hits the first-session targets`, () => {
      const { s, marks, contractCash, contractsClaimed } = run(profile, 15 * 60);
      const line = (k: string) => `${k.padEnd(10)} ${marks[k] === undefined ? 'never' : formatDuration(marks[k]!)}`;
      console.log(
        [`--- ${profile.name} bot, 15 minutes ---`, ...['firstSale', 'mechanic', 'crusher', 'contracts', 'washer', 'seller', 'slot2'].map(line),
          `cash ${formatCash(s.cash)}, sold ${s.carsSold}, levels ${JSON.stringify(s.levels)}, slots ${s.slots}`,
          `contracts claimed ${contractsClaimed} for ${formatCash(contractCash)} (${((contractCash / Math.max(1, s.lifetimeEarnings)) * 100).toFixed(0)}% of earnings), crushed ${s.stats.carsCrushed}, parts left ${s.parts}`].join('\n'),
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
      // Full automation inside the first session for an active player.
      if (profile === ACTIVE) expect(marks.seller).toBeLessThan(15 * 60);
    });
  }
});
