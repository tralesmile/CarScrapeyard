// Paint & Tuning (business 4, P1.2d). Customers order one to three services (respray, rims, vinyl wrap, engine
// tune); the booth works through them in order (taps, or the Painter), then the customer pays and drives off.
// Bigger orders pay a combo bonus; an order the player finishes by hand quickly earns a tip. Pure rules, ticked
// from sim.ts once the shop is open, whichever business is on screen.

import type { CarFamily, PaintService, PaintUpgradeKind } from './config';
import { ECON, MODEL_NAMES, PAINTS, MAX_SAVED_LEVEL } from './config';
import { carlotOpen, ensureLotFocus, findLotCar, lotCarHere, lotCarReady } from './carlot';
import { stationPower, unlockedFamilies } from './formulas';
import { nextRandom, pick, weighted } from './rng';
import type { GameState, LotCar, PaintJob } from './state';
import { incomeMultiplier } from './legacy';
import { cityPrice, cityScale } from './cities';
import { crewPerk, offlineCap, tapPerk, tipSecondsPerService } from './legacyTree';

export type PaintEvent =
  | { type: 'paintArrived'; job: PaintJob }
  /** One service of an order is done (`service`); more may follow. */
  | { type: 'paintStepDone'; job: PaintJob; service: PaintService }
  /** The whole order is done and paid. `tip` is included in `amount`. */
  | { type: 'paintDone'; job: PaintJob; amount: number; tip: number; auto: boolean }
  /** One of your Used Car Lot cars is done (P1.2f) and went back to the lot; its sticker price rose by `value`. */
  | { type: 'paintLotCarDone'; job: PaintJob; carId: number; value: number; auto: boolean };

export interface PaintSink {
  push(e: PaintEvent): void;
}

export const PAINT_SERVICES = Object.keys(ECON.paint.services) as PaintService[];
export const PAINT_UPGRADES = Object.keys(ECON.paint.upgrades) as PaintUpgradeKind[];
const MAX_ORDER = 3;

export function paintOpen(state: GameState): boolean {
  return state.businesses.opened.paint === true;
}

export function paintUpgradeCost(kind: PaintUpgradeKind, level: number, scale: number): number {
  const u = ECON.paint.upgrades[kind];
  return Math.ceil(u.baseCost * Math.pow(u.growth, level - 1) * scale);
}

export function hypeMultiplier(level: number): number {
  return Math.pow(ECON.paint.hypeFeeGrowth, level - 1);
}

/** Spray Booth power: same curve as the yard stations, the Tool Wall and the Valet Bay. */
export function boothPower(state: GameState): number {
  return stationPower(state.paint.levels.booth);
}

export function paintWorkPerTap(state: GameState): number {
  return ECON.paint.workPerTap * boothPower(state) * tapPerk(state);
}

export function painterRate(state: GameState): number {
  return state.paint.painter ? ECON.paint.painter.workPerSec * boothPower(state) * crewPerk(state) : 0;
}

export function boothCost(booths: number, scale: number): number | null {
  const c = ECON.paint.booths.costs[booths - ECON.paint.booths.start];
  return c === undefined ? null : Math.round(c * scale);
}

export function painterCost(state: Pick<GameState, 'legacy'>): number {
  return cityPrice(state, ECON.paint.painter.cost);
}

/** Fee for an order: the services' fees plus the combo bonus for every service beyond the first. */
export function paintFee(family: CarFamily, services: readonly PaintService[], hypeLevel: number): number {
  const p = ECON.paint;
  const fam = ECON.families[family].baseValue / p.feeFamilyRef;
  const sum = services.reduce((s, k) => s + p.services[k].feeMult, 0);
  const combo = 1 + p.comboBonus * Math.max(0, services.length - 1);
  return Math.max(1, Math.round(p.baseFee * sum * combo * fam * hypeMultiplier(hypeLevel)));
}

export function orderWork(services: readonly PaintService[]): number {
  return services.reduce((s, k) => s + ECON.paint.services[k].work, 0);
}

/** Seconds the player has to finish an order by hand for the tip (longer with Quick Tips when `state` is given). */
export function tipDeadline(job: PaintJob, state?: Pick<GameState, 'legacy'>): number {
  return (state ? tipSecondsPerService(state) : ECON.paint.tipSecondsPerService) * job.services.length;
}

export function tipFor(job: PaintJob): number {
  return Math.round(job.fee * ECON.paint.tip);
}

export function findPaintJob(state: GameState, id: number | null): PaintJob | undefined {
  if (id === null) return undefined;
  return state.paint.jobs.find((j) => j.id === id);
}

export function currentService(job: PaintJob): PaintService | null {
  return job.services[job.step] ?? null;
}

function ensureFocus(state: GameState): void {
  const p = state.paint;
  if (findPaintJob(state, p.focusedId)) return;
  p.focusedId = p.jobs[0]?.id ?? null;
}

/** Pick 1-3 different services by weight, in menu order (respray before rims, etc.). */
function pickServices(state: GameState): PaintService[] {
  const sizes = ECON.paint.orderSizes;
  const n = Number(weighted(state, { 1: sizes[1], 2: sizes[2], 3: sizes[3] } as Record<string, number>));
  const left = [...PAINT_SERVICES];
  const out: PaintService[] = [];
  while (out.length < Math.min(n, MAX_ORDER) && left.length > 0) {
    const w = Object.fromEntries(left.map((k) => [k, ECON.paint.services[k].weight])) as Record<PaintService, number>;
    const k = weighted(state, w);
    out.push(k);
    left.splice(left.indexOf(k), 1);
  }
  return PAINT_SERVICES.filter((k) => out.includes(k));
}

export function generatePaintJob(state: GameState): PaintJob {
  const p = state.paint;
  const family = pick(state, unlockedFamilies(state.carsSold));
  const services = pickServices(state);
  const paint = pick(state, PAINTS);
  // The new colour is never the old one.
  const others = PAINTS.filter((c) => c !== paint);
  const newPaint = others[Math.floor(nextRandom(state) * others.length)] ?? paint;
  return {
    id: p.nextJobId++,
    family,
    model: pick(state, MODEL_NAMES[family]),
    paint,
    newPaint,
    services,
    step: 0,
    work: ECON.paint.services[services[0]!].work,
    fee: Math.round(paintFee(family, services, p.levels.hype) * incomeMultiplier(state)),
    age: 0,
  };
}

/** Take `amount` work off the job; finishes steps and the order as needed. Leftover work does not carry over. */
function workOn(state: GameState, job: PaintJob, amount: number, auto: boolean, events: PaintSink): void {
  job.work = Math.max(0, job.work - amount);
  if (job.work >= 0.005) return;
  const service = currentService(job)!;
  job.step += 1;
  events.push({ type: 'paintStepDone', job, service });
  const next = currentService(job);
  if (next) {
    job.work = ECON.paint.services[next].work;
    return;
  }
  job.work = 0;
  finishJob(state, job, auto, events);
}

function finishJob(state: GameState, job: PaintJob, auto: boolean, events: PaintSink): void {
  const p = state.paint;
  if (job.lotCarId !== undefined) return returnLotCar(state, job, auto, events);
  const tip = !auto && job.age <= tipDeadline(job, state) ? tipFor(job) : 0;
  const amount = job.fee + tip;
  state.cash += amount;
  state.lifetimeEarnings += amount;
  p.earned += amount;
  p.jobsDone += 1;
  if (tip > 0) p.tips += 1;
  p.jobs = p.jobs.filter((j) => j.id !== job.id);
  events.push({ type: 'paintDone', job, amount, tip, auto });
  ensureFocus(state);
}

export function tickPaint(state: GameState, dt: number, events: PaintSink): void {
  if (!paintOpen(state)) return;
  const p = state.paint;
  for (const j of p.jobs) j.age += dt;
  if (p.jobs.length < p.booths) {
    p.arrivalTimer += dt;
    if (p.arrivalTimer >= ECON.paint.arrivalInterval) {
      p.arrivalTimer = 0;
      const job = generatePaintJob(state);
      p.jobs.push(job);
      events.push({ type: 'paintArrived', job });
      ensureFocus(state);
    }
  } else p.arrivalTimer = 0;
  // The Painter works on the oldest order.
  const rate = painterRate(state);
  const job = p.jobs[0];
  if (rate > 0 && job) workOn(state, job, rate * dt, true, events);
}

// ---- Lot cars through the shop (P1.2f) --------------------------------------

/** The service the shop does on a lot car (one that suits it). */
export function lotCarService(car: { family: CarFamily }): PaintService {
  return ECON.paint.lotCars.service[car.family];
}

/** What the service adds to the car's sticker price at today's Hype level. */
export function lotTuneValue(state: GameState, car: { family: CarFamily }): number {
  return Math.round(paintFee(car.family, [lotCarService(car)], state.paint.levels.hype) * incomeMultiplier(state) * ECON.paint.lotCars.valueMult);
}

export type LotSendBlock = 'closed' | 'missing' | 'notReady' | 'tuned' | 'away' | 'haggling' | 'boothsFull';

/** Why a lot car can't go to the shop now, or null when it can. */
export function lotSendBlock(state: GameState, carId: number | null): LotSendBlock | null {
  if (!paintOpen(state) || !carlotOpen(state)) return 'closed';
  const car = findLotCar(state, carId);
  if (!car) return 'missing';
  if (!lotCarReady(car)) return 'notReady';
  if (car.tuned !== undefined) return 'tuned';
  if (!lotCarHere(car)) return 'away';
  if (state.carlot.holdId === car.id) return 'haggling';
  if (state.paint.jobs.length >= state.paint.booths) return 'boothsFull';
  return null;
}

/** Drive a refurbished lot car to a free booth for its service. It stays off the market until it comes back. */
export function sendLotCarToShop(state: GameState, carId: number): PaintEvent[] {
  if (lotSendBlock(state, carId) !== null) return [];
  const car = findLotCar(state, carId)!;
  const p = state.paint;
  const service = lotCarService(car);
  const others = PAINTS.filter((c) => c !== car.paint);
  const job: PaintJob = {
    id: p.nextJobId++,
    family: car.family,
    model: car.model,
    paint: car.paint,
    newPaint: others[Math.floor(nextRandom(state) * others.length)] ?? car.paint,
    services: [service],
    step: 0,
    work: ECON.paint.services[service].work,
    fee: lotTuneValue(state, car),
    age: 0,
    lotCarId: car.id,
  };
  car.atShop = true;
  const l = state.carlot;
  // A buyer who was looking at it picks another car (or walks off) on the next tick.
  if (l.buyer?.carId === car.id) {
    const other = l.cars.find((c) => c.id !== car.id && lotCarReady(c) && lotCarHere(c) && c.id !== l.holdId);
    if (other) l.buyer.carId = other.id;
  }
  ensureLotFocus(state);
  p.jobs.push(job);
  ensureFocus(state);
  return [{ type: 'paintArrived', job }];
}

function returnLotCar(state: GameState, job: PaintJob, auto: boolean, events: PaintSink): void {
  const p = state.paint;
  p.jobs = p.jobs.filter((j) => j.id !== job.id);
  const car: LotCar | undefined = findLotCar(state, job.lotCarId ?? null);
  if (car) {
    const service = job.services[0]!;
    delete car.atShop;
    car.tuned = service;
    car.tuneValue = job.fee;
    if (service === 'respray' || service === 'wrap') car.paint = job.newPaint;
    ensureLotFocus(state);
    events.push({ type: 'paintLotCarDone', job, carId: car.id, value: job.fee, auto });
  }
  ensureFocus(state);
}

// ---- Player actions -------------------------------------------------------

/** One tap on a customer's car. */
export function paintTap(state: GameState, id: number): PaintEvent[] {
  const job = findPaintJob(state, id);
  if (!paintOpen(state) || !job || !currentService(job)) return [];
  const events: PaintEvent[] = [];
  workOn(state, job, paintWorkPerTap(state), false, events);
  return events;
}

export function focusPaintJob(state: GameState, id: number): void {
  if (findPaintJob(state, id)) state.paint.focusedId = id;
}

export function buyPaintUpgrade(state: GameState, kind: PaintUpgradeKind): boolean {
  if (!paintOpen(state)) return false;
  const cost = paintUpgradeCost(kind, state.paint.levels[kind], cityScale(state));
  if (cost > state.cash) return false;
  state.cash -= cost;
  state.paint.levels[kind] += 1;
  return true;
}

export function buyBooth(state: GameState): boolean {
  const cost = boothCost(state.paint.booths, cityScale(state));
  if (!paintOpen(state) || cost === null || cost > state.cash) return false;
  state.cash -= cost;
  state.paint.booths += 1;
  return true;
}

export function hirePainter(state: GameState): boolean {
  const cost = painterCost(state);
  if (!paintOpen(state) || state.paint.painter || cost > state.cash) return false;
  state.cash -= cost;
  state.paint.painter = true;
  return true;
}

// ---- Idle / offline -------------------------------------------------------

/**
 * Expected work and fee of the next order, enumerated exactly over the order sizes and the weighted draw of services
 * (the same draw as `pickServices`), averaged over the unlocked families.
 */
export function expectedPaintOrder(state: GameState): { work: number; fee: number } {
  const p = ECON.paint;
  const fams = unlockedFamilies(state.carsSold);
  const famAvg = fams.reduce((s, f) => s + ECON.families[f].baseValue, 0) / fams.length;
  const sizeW = (Object.entries(p.orderSizes) as [string, number][]).map(([n, w]) => ({ n: Number(n), w }));
  const sizeTotal = sizeW.reduce((s, x) => s + x.w, 0);
  let work = 0;
  let feeMult = 0;
  // Enumerate ordered draws without replacement.
  const walk = (left: PaintService[], chosen: PaintService[], prob: number, n: number) => {
    if (chosen.length === n || left.length === 0) {
      work += prob * orderWork(chosen);
      const sum = chosen.reduce((s, k) => s + p.services[k].feeMult, 0);
      feeMult += prob * sum * (1 + p.comboBonus * Math.max(0, chosen.length - 1));
      return;
    }
    const total = left.reduce((s, k) => s + p.services[k].weight, 0);
    for (const k of left) walk(left.filter((x) => x !== k), [...chosen, k], (prob * p.services[k].weight) / total, n);
  };
  for (const { n, w } of sizeW) walk([...PAINT_SERVICES], [], w / sizeTotal, n);
  const fee = p.baseFee * feeMult * (famAvg / p.feeFamilyRef) * hypeMultiplier(state.paint.levels.hype);
  return { work, fee };
}

/**
 * Cash per second the shop makes on its own (Painter hired, no tips). One order at a time; with one booth the next
 * customer only drives in after the last one left, with more booths the arrival overlaps the work.
 */
export function paintIdleIncome(state: GameState): number {
  if (!paintOpen(state) || !state.paint.painter) return 0;
  const o = expectedPaintOrder(state);
  const workTime = o.work / painterRate(state);
  const arrival = ECON.paint.arrivalInterval;
  const cycle = state.paint.booths > 1 ? Math.max(workTime, arrival) : workTime + arrival;
  return (o.fee * incomeMultiplier(state)) / cycle;
}

/** Offline shop earnings for a gap of `seconds`, using the same cap and efficiency as the yard. */
export function paintOfflineEarnings(state: GameState, seconds: number): number {
  const capped = Math.max(0, Math.min(seconds, offlineCap(state)));
  return Math.floor(paintIdleIncome(state) * capped * ECON.offline.efficiency);
}

// ---- Save repair ----------------------------------------------------------

function validJob(j: unknown): j is PaintJob {
  if (!j || typeof j !== 'object') return false;
  const o = j as Record<string, unknown>;
  const nums = ['id', 'paint', 'newPaint', 'step', 'work', 'fee', 'age'].every(
    (k) => typeof o[k] === 'number' && Number.isFinite(o[k] as number) && (o[k] as number) >= 0 && (o[k] as number) <= 1e18,
  );
  if (!nums || typeof o.family !== 'string' || !(o.family in ECON.families) || typeof o.model !== 'string') return false;
  const sv = o.services;
  if (!Array.isArray(sv) || sv.length < 1 || sv.length > MAX_ORDER) return false;
  if (!sv.every((k) => PAINT_SERVICES.includes(k as PaintService)) || new Set(sv).size !== sv.length) return false;
  if (o.lotCarId !== undefined && (typeof o.lotCarId !== 'number' || sv.length !== 1)) return false;
  return Number.isInteger(o.step) && (o.step as number) < sv.length;
}

/**
 * Lot cars and their booth jobs point at each other: drop a lot job whose car is gone (or not marked away) and bring
 * back a car marked away without a job. Run after both businesses were repaired.
 */
export function sanitizeLotShopLinks(state: GameState): void {
  const p = state.paint;
  const away = new Set(state.carlot.cars.filter((c) => c.atShop === true).map((c) => c.id));
  const seen = new Set<number>();
  p.jobs = p.jobs.filter((j) => {
    if (j.lotCarId === undefined) return true;
    if (!away.has(j.lotCarId) || seen.has(j.lotCarId)) return false;
    seen.add(j.lotCarId);
    return true;
  });
  for (const c of state.carlot.cars) if (c.atShop === true && !seen.has(c.id)) delete c.atShop;
  if (!p.jobs.some((j) => j.id === p.focusedId)) p.focusedId = p.jobs[0]?.id ?? null;
  ensureLotFocus(state);
}

/** Repair impossible shop data from a save. */
export function sanitizePaint(p: GameState['paint']): void {
  const c = ECON.paint;
  const maxBooths = c.booths.start + c.booths.costs.length;
  p.booths = Math.min(maxBooths, Math.max(c.booths.start, Math.floor(p.booths)));
  for (const k of PAINT_UPGRADES) p.levels[k] = Math.max(1, Math.min(MAX_SAVED_LEVEL, Math.floor(p.levels[k])));
  p.painter = p.painter === true;
  p.jobs = p.jobs.filter(validJob).slice(0, p.booths);
  // Work left can't be more than the current service needs.
  for (const j of p.jobs) j.work = Math.min(j.work, c.services[j.services[j.step]!].work);
  p.arrivalTimer = Math.max(0, Math.min(Number.isFinite(p.arrivalTimer) ? p.arrivalTimer : 0, c.arrivalInterval));
  p.jobsDone = Math.max(0, Math.floor(p.jobsDone));
  p.tips = Math.max(0, Math.min(p.jobsDone, Math.floor(p.tips)));
  p.earned = Math.max(0, p.earned);
  if (!p.jobs.some((j) => j.id === p.focusedId)) p.focusedId = p.jobs[0]?.id ?? null;
  p.nextJobId = Math.max(Math.floor(p.nextJobId) || 1, ...p.jobs.map((j) => j.id + 1), 1);
}
