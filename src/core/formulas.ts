import type { CarFamily, ManagerKind, Rarity, UpgradeKind } from './config';
import { ECON } from './config';
import type { GameState } from './state';

/** cost(n) = base * growth^(n-1), where n is the level being bought FROM (level 1 -> 2 costs base). */
export function upgradeCost(kind: UpgradeKind, currentLevel: number): number {
  const u = ECON.upgrades[kind];
  return Math.ceil(u.baseCost * Math.pow(u.growth, currentLevel - 1));
}

/** Total cost and number of levels for buying up to `max` levels with `cash`. */
export function bulkCost(
  kind: UpgradeKind,
  currentLevel: number,
  count: number | 'max',
  cash: number,
): { levels: number; cost: number } {
  let levels = 0;
  let cost = 0;
  const limit = count === 'max' ? 10_000 : count;
  while (levels < limit) {
    const next = upgradeCost(kind, currentLevel + levels);
    if (count === 'max' && cost + next > cash) break;
    cost += next;
    levels++;
  }
  return { levels, cost };
}

/** Number of milestones reached at this level. */
export function milestonesReached(level: number): number {
  return ECON.milestones.filter((m) => level >= m).length;
}

/** The next milestone above this level, or null. */
export function nextMilestone(level: number): number | null {
  return ECON.milestones.find((m) => m > level) ?? null;
}

/** Power multiplier for a station: linear per level, doubled per milestone. */
export function stationPower(level: number): number {
  const linear = 1 + ECON.powerPerLevel * (level - 1);
  return linear * Math.pow(ECON.milestoneMultiplier, milestonesReached(level));
}

export function qualityMultiplier(level: number): number {
  return Math.pow(ECON.qualityValueGrowth, level - 1);
}

export function washPerPixel(state: GameState): number {
  return ECON.manual.washPerPixel * stationPower(state.levels.wash);
}

export function repairPerTap(state: GameState): number {
  return ECON.manual.repairPerTap * stationPower(state.levels.repair);
}

/** Automatic progress per second for each manager. */
export function managerRate(state: GameState, kind: ManagerKind): number {
  if (!state.managers[kind]) return 0;
  if (kind === 'washer') return ECON.managers.washer.ratePerSec * stationPower(state.levels.wash);
  if (kind === 'mechanic') return ECON.managers.mechanic.ratePerSec * stationPower(state.levels.repair);
  return 0;
}

export function slotCost(currentSlots: number): number | null {
  const idx = currentSlots - ECON.slots.start;
  return ECON.slots.costs[idx] ?? null;
}

export function baseCarValue(family: CarFamily, rarity: Rarity, qualityLevel: number): number {
  return ECON.families[family].baseValue * ECON.rarity[rarity].valueMult * qualityMultiplier(qualityLevel);
}

/** Expected value of the next car, averaged over families and rarities. */
export function expectedCarValue(qualityLevel: number): number {
  const fams = Object.values(ECON.families);
  const famAvg = fams.reduce((s, f) => s + f.baseValue, 0) / fams.length;
  const rar = Object.values(ECON.rarity);
  const totalW = rar.reduce((s, r) => s + r.weight, 0);
  const rarAvg = rar.reduce((s, r) => s + r.weight * r.valueMult, 0) / totalW;
  return famAvg * rarAvg * qualityMultiplier(qualityLevel);
}

/**
 * Cash per second when the yard runs with no player input.
 * Zero unless all three managers are hired (otherwise a stage blocks).
 *
 * Each manager handles one car at a time, so the yard is a pipeline:
 * throughput is limited by the slowest stage, and with few lot slots the
 * stages can't overlap, so it is also limited by slots / full cycle time.
 * Average damage is 0.8 (see generateCar), dirt always starts at 1.
 */
export function idleIncomePerSecond(state: GameState): number {
  const { mechanic, washer, seller } = state.managers;
  if (!mechanic || !washer || !seller) return 0;
  const washTime = 1 / managerRate(state, 'washer');
  const repairTime = 0.8 / managerRate(state, 'mechanic');
  const stages = [washTime, repairTime, ECON.sellerDelay, ECON.arrivalInterval];
  const cycle = stages.reduce((s, t) => s + t, 0);
  const carsPerSecond = Math.min(1 / Math.max(...stages), state.slots / cycle);
  return carsPerSecond * expectedCarValue(state.levels.quality);
}

/** Offline earnings for a gap of `seconds`, using the cap and efficiency. */
export function offlineEarnings(state: GameState, seconds: number): number {
  const capped = Math.max(0, Math.min(seconds, ECON.offline.capSeconds));
  return Math.floor(idleIncomePerSecond(state) * capped * ECON.offline.efficiency);
}
