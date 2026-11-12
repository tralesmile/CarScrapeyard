// Repair Garage (business 2, P1.1c). Customers bring cars with one fault; the player taps the car (or the Foreman
// works) until it is fixed, then the customer pays and drives off. Pure rules, ticked from sim.ts once the garage
// is open, whichever business is on screen.

import type { CarFamily, GarageFault, GarageUpgradeKind } from './config';
import { ECON, MODEL_NAMES, PAINTS, MAX_SAVED_LEVEL } from './config';
import { barnReservesParts } from './barn';
import { stationPower, unlockedFamilies } from './formulas';
import { pick, weighted } from './rng';
import type { GameState, GarageJob } from './state';
import { incomeMultiplier } from './legacy';
import { cityPrice, cityScale } from './cities';
import { crewPerk, offlineCap, tapPerk } from './legacyTree';

export type GarageEvent =
  | { type: 'garageArrived'; job: GarageJob }
  /** A car was fixed and paid for. `parts` = scrapyard parts used (0 means a parts bill came off the fee). */
  | { type: 'garageFixed'; job: GarageJob; amount: number; parts: number; auto: boolean };

export interface GarageSink {
  push(e: GarageEvent): void;
}

export const GARAGE_FAULTS = Object.keys(ECON.garage.faults) as GarageFault[];
export const GARAGE_UPGRADES = Object.keys(ECON.garage.upgrades) as GarageUpgradeKind[];

export function garageOpen(state: GameState): boolean {
  return state.businesses.opened.garage === true;
}

export function garageUpgradeCost(kind: GarageUpgradeKind, level: number, scale: number): number {
  const u = ECON.garage.upgrades[kind];
  return Math.ceil(u.baseCost * Math.pow(u.growth, level - 1) * scale);
}

/** Tool Wall power: linear per level, doubled at the station milestones (same curve as the yard stations). */
export function toolPower(state: GameState): number {
  return stationPower(state.garage.levels.tools);
}

export function repMultiplier(level: number): number {
  return Math.pow(ECON.garage.repFeeGrowth, level - 1);
}

export function garageWorkPerTap(state: GameState): number {
  return ECON.garage.workPerTap * toolPower(state) * tapPerk(state);
}

export function foremanRate(state: GameState): number {
  return state.garage.foreman ? ECON.garage.foreman.workPerSec * toolPower(state) * crewPerk(state) : 0;
}

export function garageFee(family: CarFamily, fault: GarageFault, repLevel: number): number {
  const g = ECON.garage;
  const fam = ECON.families[family].baseValue / g.feeFamilyRef;
  return Math.max(1, Math.round(g.baseFee * g.faults[fault].feeMult * fam * repMultiplier(repLevel)));
}

export function garageBayCost(bays: number, scale: number): number | null {
  const c = ECON.garage.bays.costs[bays - ECON.garage.bays.start];
  return c === undefined ? null : Math.round(c * scale);
}

export function foremanCost(state: Pick<GameState, 'legacy'>): number {
  return cityPrice(state, ECON.garage.foreman.cost);
}

export function findJob(state: GameState, id: number | null): GarageJob | undefined {
  if (id === null) return undefined;
  return state.garage.jobs.find((j) => j.id === id);
}

function ensureFocus(state: GameState): void {
  const g = state.garage;
  if (findJob(state, g.focusedId)) return;
  g.focusedId = g.jobs[0]?.id ?? null;
}

export function generateJob(state: GameState): GarageJob {
  const g = state.garage;
  const family = pick(state, unlockedFamilies(state.carsSold));
  const weights = Object.fromEntries(GARAGE_FAULTS.map((f) => [f, ECON.garage.faults[f].weight])) as Record<GarageFault, number>;
  const fault = weighted(state, weights);
  return {
    id: g.nextJobId++,
    family,
    model: pick(state, MODEL_NAMES[family]),
    paint: pick(state, PAINTS),
    fault,
    work: ECON.garage.faults[fault].work,
    fee: Math.round(garageFee(family, fault, g.levels.rep) * incomeMultiplier(state)),
  };
}

/** What a finished job pays and the parts it takes from the scrapyard's bin. */
export function jobPayout(state: GameState, job: GarageJob): { amount: number; parts: number } {
  const need = ECON.garage.faults[job.fault].parts;
  if (state.parts >= need && !barnReservesParts(state)) return { amount: job.fee, parts: need };
  return { amount: Math.round(job.fee * (1 - ECON.garage.partsBill)), parts: 0 };
}

function finishJob(state: GameState, job: GarageJob, auto: boolean, events: GarageSink): void {
  const { amount, parts } = jobPayout(state, job);
  state.parts -= parts;
  state.cash += amount;
  state.lifetimeEarnings += amount;
  const g = state.garage;
  g.earned += amount;
  g.jobsDone += 1;
  g.jobs = g.jobs.filter((j) => j.id !== job.id);
  events.push({ type: 'garageFixed', job, amount, parts, auto });
  ensureFocus(state);
}

export function tickGarage(state: GameState, dt: number, events: GarageSink): void {
  if (!garageOpen(state)) return;
  const g = state.garage;
  if (g.jobs.length < g.bays) {
    g.arrivalTimer += dt;
    if (g.arrivalTimer >= ECON.garage.arrivalInterval) {
      g.arrivalTimer = 0;
      const job = generateJob(state);
      g.jobs.push(job);
      events.push({ type: 'garageArrived', job });
      ensureFocus(state);
    }
  } else g.arrivalTimer = 0;
  // The Foreman works on the oldest car (the player's taps add to it when it is the same one).
  const rate = foremanRate(state);
  if (rate > 0) {
    const job = g.jobs[0];
    if (job) {
      job.work = Math.max(0, job.work - rate * dt);
      if (job.work === 0) finishJob(state, job, true, events);
    }
  }
}

// ---- Player actions -------------------------------------------------------

/** One tap on a customer's car. */
export function garageTap(state: GameState, id: number): GarageEvent[] {
  const job = findJob(state, id);
  if (!garageOpen(state) || !job || job.work <= 0) return [];
  job.work = Math.max(0, job.work - garageWorkPerTap(state));
  if (job.work < 0.005) job.work = 0;
  const events: GarageEvent[] = [];
  if (job.work === 0) finishJob(state, job, false, events);
  return events;
}

export function focusJob(state: GameState, id: number): void {
  if (findJob(state, id)) state.garage.focusedId = id;
}

export function buyGarageUpgrade(state: GameState, kind: GarageUpgradeKind): boolean {
  if (!garageOpen(state)) return false;
  const cost = garageUpgradeCost(kind, state.garage.levels[kind], cityScale(state));
  if (cost > state.cash) return false;
  state.cash -= cost;
  state.garage.levels[kind] += 1;
  return true;
}

export function buyGarageBay(state: GameState): boolean {
  const cost = garageBayCost(state.garage.bays, cityScale(state));
  if (!garageOpen(state) || cost === null || cost > state.cash) return false;
  state.cash -= cost;
  state.garage.bays += 1;
  return true;
}

export function hireForeman(state: GameState): boolean {
  const cost = foremanCost(state);
  if (!garageOpen(state) || state.garage.foreman || cost > state.cash) return false;
  state.cash -= cost;
  state.garage.foreman = true;
  return true;
}

// ---- Idle / offline -------------------------------------------------------

/** Average work, fee multiplier and parts bill over the fault mix (by weight). */
function faultAverages() {
  const fs = Object.values(ECON.garage.faults);
  const w = fs.reduce((s, f) => s + f.weight, 0);
  return {
    work: fs.reduce((s, f) => s + f.weight * f.work, 0) / w,
    feeMult: fs.reduce((s, f) => s + f.weight * f.feeMult, 0) / w,
  };
}

/** Expected fee of the next customer, averaged over unlocked families and faults. */
export function expectedGarageFee(state: GameState): number {
  const fams = unlockedFamilies(state.carsSold);
  const famAvg = fams.reduce((s, f) => s + ECON.families[f].baseValue, 0) / fams.length;
  const g = ECON.garage;
  return g.baseFee * faultAverages().feeMult * (famAvg / g.feeFamilyRef) * repMultiplier(state.garage.levels.rep);
}

/**
 * Cash per second the garage makes on its own (Foreman hired). One car at a time; with one bay the next customer only
 * drives in after the last one left, with more bays the arrival overlaps the work. Counts the parts bill (offline the
 * garage buys its parts, so the scrapyard's bin is never emptied while you're away).
 */
export function garageIdleIncome(state: GameState): number {
  if (!garageOpen(state) || !state.garage.foreman) return 0;
  const workTime = faultAverages().work / foremanRate(state);
  const arrival = ECON.garage.arrivalInterval;
  const cycle = state.garage.bays > 1 ? Math.max(workTime, arrival) : workTime + arrival;
  return (expectedGarageFee(state) * incomeMultiplier(state) * (1 - ECON.garage.partsBill)) / cycle;
}

/** Offline garage earnings for a gap of `seconds`, using the same cap and efficiency as the yard. */
export function garageOfflineEarnings(state: GameState, seconds: number): number {
  const capped = Math.max(0, Math.min(seconds, offlineCap(state)));
  return Math.floor(garageIdleIncome(state) * capped * ECON.offline.efficiency);
}

/** Repair impossible garage data from a save. */
export function sanitizeGarage(g: GameState['garage']): void {
  const maxBays = ECON.garage.bays.start + ECON.garage.bays.costs.length;
  g.bays = Math.min(maxBays, Math.max(ECON.garage.bays.start, Math.floor(g.bays)));
  for (const k of GARAGE_UPGRADES) g.levels[k] = Math.max(1, Math.min(MAX_SAVED_LEVEL, Math.floor(g.levels[k])));
  g.jobs = g.jobs.filter(
    (j) =>
      !!j &&
      typeof j === 'object' &&
      [j.id, j.paint, j.work, j.fee].every((n) => typeof n === 'number' && Number.isFinite(n)) &&
      typeof j.family === 'string' &&
      j.family in ECON.families &&
      typeof j.fault === 'string' &&
      j.fault in ECON.garage.faults &&
      typeof j.model === 'string' &&
      j.work >= 0 &&
      j.fee >= 0,
  ).slice(0, g.bays);
  g.jobsDone = Math.max(0, Math.floor(g.jobsDone));
  g.earned = Math.max(0, g.earned);
  if (!g.jobs.some((j) => j.id === g.focusedId)) g.focusedId = g.jobs[0]?.id ?? null;
  g.nextJobId = Math.max(g.nextJobId, ...g.jobs.map((j) => j.id + 1), 1);
}
