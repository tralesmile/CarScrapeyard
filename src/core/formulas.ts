import type { CarFamily, ManagerKind, Rarity, UpgradeKind } from './config';
import { ECON } from './config';
import type { GameState } from './state';
import { legacyMultiplier } from './legacy';
import { crewPerk, offlineCap, rarePerk, sellerDelay, tapPerk } from './legacyTree';

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
  return ECON.manual.washPerPixel * stationPower(state.levels.wash) * tapPerk(state);
}

export function repairPerTap(state: GameState): number {
  return ECON.manual.repairPerTap * stationPower(state.levels.repair) * tapPerk(state);
}

/** Automatic progress per second for each manager. */
export function managerRate(state: GameState, kind: ManagerKind): number {
  if (!state.managers[kind]) return 0;
  if (kind === 'washer') return ECON.managers.washer.ratePerSec * stationPower(state.levels.wash) * crewPerk(state);
  if (kind === 'mechanic') return ECON.managers.mechanic.ratePerSec * stationPower(state.levels.repair) * crewPerk(state);
  return 0;
}

/** Seconds the crusher needs between crushes at this Hydraulic Press level. */
export function crusherCooldown(pressLevel: number): number {
  const c = ECON.crusher;
  return Math.max(c.minCooldown, c.cooldown / (1 + c.pressSpeedPerLevel * (pressLevel - 1)));
}

/** Parts from crushing a car of this rarity at this Hydraulic Press level (`bonus`: Parts Hoarder's extra fraction). */
export function crushParts(rarity: Rarity, pressLevel: number, bonus = 0): number {
  return Math.round(ECON.crusher.parts[rarity] * (1 + ECON.crusher.pressPartsPerLevel * (pressLevel - 1)) * (1 + bonus));
}

export function slotCost(currentSlots: number): number | null {
  const idx = currentSlots - ECON.slots.start;
  return ECON.slots.costs[idx] ?? null;
}

export function baseCarValue(family: CarFamily, rarity: Rarity, qualityLevel: number): number {
  return ECON.families[family].baseValue * ECON.rarity[rarity].valueMult * qualityMultiplier(qualityLevel);
}

/** Families that arrive at the yard after this many sales, in config order. */
export function unlockedFamilies(carsSold: number): CarFamily[] {
  return (Object.keys(ECON.families) as CarFamily[]).filter((f) => carsSold >= ECON.families[f].unlockCarsSold);
}

/** The family that starts arriving at exactly this many sales, if any. */
export function familyUnlockedAt(carsSold: number): CarFamily | null {
  const hit = (Object.keys(ECON.families) as CarFamily[]).find((f) => ECON.families[f].unlockCarsSold === carsSold && carsSold > 0);
  return hit ?? null;
}

/** Arrival weights of the unlocked families (locked ones are left out). */
export function familyWeights(carsSold: number): Record<CarFamily, number> {
  return Object.fromEntries(unlockedFamilies(carsSold).map((f) => [f, ECON.families[f].weight])) as Record<CarFamily, number>;
}

/** Rarity arrival weights; `rareMult` (Rare Finds) scales every rarity above Common. */
export function rarityWeights(rareMult = 1): Record<Rarity, number> {
  return Object.fromEntries(
    (Object.keys(ECON.rarity) as Rarity[]).map((r) => [r, ECON.rarity[r].weight * (r === 'common' ? 1 : rareMult)]),
  ) as Record<Rarity, number>;
}

/** Expected value of the next car, averaged over the unlocked families (by weight) and rarities. */
export function expectedCarValue(qualityLevel: number, carsSold: number, rareMult = 1): number {
  const fams = unlockedFamilies(carsSold).map((f) => ECON.families[f]);
  const famW = fams.reduce((s, f) => s + f.weight, 0);
  const famAvg = fams.reduce((s, f) => s + f.weight * f.baseValue, 0) / famW;
  const w = rarityWeights(rareMult);
  const rs = Object.keys(w) as Rarity[];
  const totalW = rs.reduce((s, r) => s + w[r], 0);
  const rarAvg = rs.reduce((s, r) => s + w[r] * ECON.rarity[r].valueMult, 0) / totalW;
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
  const stages = [washTime, repairTime, sellerDelay(state), ECON.arrivalInterval];
  const cycle = stages.reduce((s, t) => s + t, 0);
  const carsPerSecond = Math.min(1 / Math.max(...stages), state.slots / cycle);
  return carsPerSecond * expectedCarValue(state.levels.quality, state.carsSold, rarePerk(state)) * legacyMultiplier(state);
}

/** Offline earnings for a gap of `seconds`, using the cap and efficiency. */
export function offlineEarnings(state: GameState, seconds: number): number {
  const capped = Math.max(0, Math.min(seconds, offlineCap(state)));
  return Math.floor(idleIncomePerSecond(state) * capped * ECON.offline.efficiency);
}

/** Expected value of the next Common car (what the Scrapper crushes). */
export function expectedCommonValue(qualityLevel: number, carsSold: number): number {
  const fams = unlockedFamilies(carsSold).map((f) => ECON.families[f]);
  const famW = fams.reduce((s, f) => s + f.weight, 0);
  const famAvg = fams.reduce((s, f) => s + f.weight * f.baseValue, 0) / famW;
  return famAvg * ECON.rarity.common.valueMult * qualityMultiplier(qualityLevel);
}

/** Round a price or reward to two significant digits ($1,234 -> $1,200), at least $10. */
export function roundNice(x: number): number {
  if (x < 100) return Math.max(10, Math.round(x / 5) * 5);
  const mag = Math.pow(10, Math.floor(Math.log10(x)) - 1);
  return Math.round(x / mag) * mag;
}
