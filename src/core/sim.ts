// Game rules. Pure TypeScript, no Phaser or DOM, so it runs in tests,
// the balance simulator and (later) on the server for validation.
//
// The UI never edits state directly: it calls these actions.

import type { CarFamily, ManagerKind, UpgradeKind } from './config';
import { ECON, MODEL_NAMES, PAINTS } from './config';
import {
  baseCarValue,
  crusherCooldown,
  crushParts,
  expectedCommonValue,
  familyUnlockedAt,
  familyWeights,
  bulkCost,
  idleIncomePerSecond,
  managerRate,
  offlineEarnings,
  repairPerTap,
  rarityWeights,
  slotCost,
  washPerPixel,
} from './formulas';
import { nextRandom, pick, weighted } from './rng';
import {
  claimContract as claimContractRule,
  onCarCrushed,
  onCarSold,
  rerollContract as rerollContractRule,
  tickContracts,
  type ContractEvent,
} from './contracts';
import type { Car, GameState } from './state';
import { serveBuyer, tickBuyers, type BuyerEvent } from './buyers';
import { clampHaggle, haggleGrade } from './haggle';
import type { BuyerKind } from './config';
import { barnReservesParts, nextBarnStage, tickBarn, type BarnEvent } from './barn';
import { garageOfflineEarnings, tickGarage, type GarageEvent } from './garage';
import { carlotOfflineEarnings, tickCarLot, type CarLotEvent } from './carlot';
import { paintOfflineEarnings, tickPaint, type PaintEvent } from './paint';
import { legacyMultiplier } from './legacy';
import { offlineCap, partsPerk, rarePerk, sellerDelay } from './legacyTree';

export type GameEvent =
  | { type: 'arrived'; car: Car }
  | { type: 'washed'; carId: number }
  | { type: 'repaired'; carId: number }
  | {
      type: 'sold';
      carId: number;
      amount: number;
      auto: boolean;
      /** Haggle multiplier (1 when there was no haggle). */
      haggle: number;
      /** Buyer who paid a bonus for this car, if any. */
      buyer: BuyerKind | null;
      buyerMult: number;
    }
  | { type: 'legendary'; car: Car }
  /** A new car family starts arriving at the yard. */
  | { type: 'familyUnlocked'; family: CarFamily }
  /** The first car of a family was sold: it starts its page in the Collection book. `families` = families collected so far. */
  | { type: 'firstOfFamily'; family: CarFamily; families: number }
  | { type: 'crushed'; car: Car; parts: number; cash: number; auto: boolean }
  | { type: 'partsUsed'; carId: number; parts: number }
  | ContractEvent
  | BuyerEvent
  | BarnEvent
  | GarageEvent
  | CarLotEvent
  | PaintEvent;

/** Largest step the simulation takes at once; longer gaps are split. */
const MAX_STEP = 0.25;

export function findCar(state: GameState, id: number | null): Car | undefined {
  if (id === null) return undefined;
  return state.cars.find((c) => c.id === id);
}

export function carStage(car: Car): 'dirty' | 'damaged' | 'ready' {
  if (car.dirt > 0) return 'dirty';
  if (car.damage > 0) return 'damaged';
  return 'ready';
}

export function generateCar(state: GameState): Car {
  const family = weighted(state, familyWeights(state.carsSold));
  const rolled = weighted(state, rarityWeights(rarePerk(state)));
  const rarity = state.nextCarId <= ECON.tutorialCommonCars ? 'common' : rolled;
  const spread = 1 + ECON.valueSpread * (2 * nextRandom(state) - 1);
  const value = Math.max(1, Math.round(baseCarValue(family, rarity, state.levels.quality) * spread * legacyMultiplier(state)));
  const car: Car = {
    id: state.nextCarId++,
    family,
    model: pick(state, MODEL_NAMES[family]),
    paint: pick(state, PAINTS),
    rarity,
    value,
    dirt: 1,
    damage: 0.6 + 0.4 * nextRandom(state),
    sellProgress: 0,
  };
  return car;
}

function ensureFocus(state: GameState): void {
  if (findCar(state, state.focusedId)) return;
  state.focusedId = state.cars[0]?.id ?? null;
}

function sellInternal(state: GameState, car: Car, auto: boolean, events: GameEvent[], haggle = 1): void {
  const buyer = state.buyer?.kind ?? null;
  const buyerMult = serveBuyer(state, car);
  const amount = Math.round(car.value * buyerMult * haggle);
  state.cash += amount;
  state.lifetimeEarnings += amount;
  state.carsSold += 1;
  state.cars = state.cars.filter((c) => c.id !== car.id);
  state.tutorial.firstSale = true;
  events.push({ type: 'sold', carId: car.id, amount, auto, haggle, buyer: buyerMult > 1 ? buyer : null, buyerMult });
  onCarSold(state, car, events);
  recordCollection(state, car.family, events);
  const fam = familyUnlockedAt(state.carsSold);
  if (fam) events.push({ type: 'familyUnlocked', family: fam });
  ensureFocus(state);
}

/** Count a sold car for the Collection book; the first of a family announces itself. */
export function recordCollection(state: GameState, family: CarFamily, events: { push(e: GameEvent): void }): void {
  const sold = state.collection.sold;
  sold[family] = (sold[family] ?? 0) + 1;
  if (sold[family] === 1) {
    const families = Object.values(sold).filter((n) => n > 0).length;
    events.push({ type: 'firstOfFamily', family, families });
  }
}

/** A car just finished washing: spare parts (if any) take a chunk off its damage. */
function onWashed(state: GameState, car: Car, events: GameEvent[]): void {
  events.push({ type: 'washed', carId: car.id });
  const cost = ECON.crusher.partsPerFix;
  if (car.damage > 0 && state.parts >= cost && !barnReservesParts(state)) {
    state.parts -= cost;
    car.damage *= 1 - ECON.crusher.fixFraction;
    if (car.damage < 0.005) car.damage = 0;
    events.push({ type: 'partsUsed', carId: car.id, parts: cost });
    if (car.damage === 0) events.push({ type: 'repaired', carId: car.id });
  }
}

export function crusherUnlocked(state: GameState): boolean {
  return state.stats.carsCrushed > 0 || state.carsSold >= ECON.crusher.unlockCarsSold;
}

/** Can this car go in the crusher right now? Finished cars should be sold instead. */
export function canCrush(state: GameState, car: Car | undefined): car is Car {
  return !!car && crusherUnlocked(state) && state.crusherCooldown <= 0 && carStage(car) !== 'ready';
}

function step(state: GameState, dt: number, events: GameEvent[]): void {
  state.stats.playSeconds += dt;
  state.legacy.runSeconds += dt;
  if (state.crusherCooldown > 0) state.crusherCooldown = Math.max(0, state.crusherCooldown - dt);
  tickContracts(state, dt, events);
  tickBuyers(state, dt, events);
  tickBarn(state, dt, events);
  tickGarage(state, dt, events);
  tickCarLot(state, dt, events);
  tickPaint(state, dt, events);

  // Arrivals.
  if (state.cars.length < state.slots) {
    state.arrivalTimer += dt;
    if (state.arrivalTimer >= ECON.arrivalInterval) {
      state.arrivalTimer = 0;
      const car = generateCar(state);
      state.cars.push(car);
      events.push({ type: 'arrived', car });
      if (car.rarity === 'legendary') {
        state.stats.legendaryFound += 1;
        events.push({ type: 'legendary', car });
      }
      ensureFocus(state);
    }
  } else {
    state.arrivalTimer = 0;
  }

  // The Scrapper runs the press now and then while the parts bin is low.
  if (state.scrapperRest > 0) state.scrapperRest = Math.max(0, state.scrapperRest - dt);
  const scrap = scrapperPick(state);
  if (scrap) {
    crushInternal(state, scrap, true, events);
    state.scrapperRest = ECON.crusher.scrapperRest;
  }

  // Each manager works on one car at a time, oldest first.
  const washRate = managerRate(state, 'washer');
  if (washRate > 0) {
    const car = state.cars.find((c) => c.dirt > 0);
    if (car) {
      car.dirt = Math.max(0, car.dirt - washRate * dt);
      if (car.dirt === 0) onWashed(state, car, events);
    }
  }
  const repairRate = managerRate(state, 'mechanic');
  if (repairRate > 0) {
    const car = state.cars.find((c) => c.dirt === 0 && c.damage > 0);
    if (car) {
      car.damage = Math.max(0, car.damage - repairRate * dt);
      if (car.damage === 0) events.push({ type: 'repaired', carId: car.id });
    }
  }
  if (state.managers.seller) {
    const car = state.cars.find((c) => carStage(c) === 'ready');
    if (car) {
      car.sellProgress += dt;
      if (car.sellProgress >= sellerDelay(state)) sellInternal(state, car, true, events);
    }
  }
}

/** Advance the simulation by `dt` seconds. */
export function tick(state: GameState, dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (!(dt > 0) || !Number.isFinite(dt)) return events;
  let remaining = dt;
  while (remaining > 0) {
    const s = Math.min(MAX_STEP, remaining);
    step(state, s, events);
    remaining -= s;
  }
  return events;
}

// ---- Player actions -------------------------------------------------------

export function focusCar(state: GameState, id: number): void {
  if (findCar(state, id)) state.focusedId = id;
}

/** Swiping over a dirty car. `pixels` is swipe distance in design pixels. */
export function washCar(state: GameState, id: number, pixels: number): GameEvent[] {
  const car = findCar(state, id);
  if (!car || car.dirt <= 0 || !(pixels > 0)) return [];
  car.dirt = Math.max(0, car.dirt - washPerPixel(state) * pixels);
  const events: GameEvent[] = [];
  if (car.dirt === 0) onWashed(state, car, events);
  return events;
}

/** One tap on a clean, damaged car. */
export function repairTap(state: GameState, id: number): GameEvent[] {
  const car = findCar(state, id);
  if (!car || car.dirt > 0 || car.damage <= 0) return [];
  car.damage = Math.max(0, car.damage - repairPerTap(state));
  // Avoid a tiny leftover sliver that needs one extra tap.
  if (car.damage < 0.005) car.damage = 0;
  return car.damage === 0 ? [{ type: 'repaired', carId: car.id }] : [];
}

/** Manual sale. `haggle` is the haggle result (clamped to the legal range); 1 when there was no haggle. */
export function sellCar(state: GameState, id: number, haggle = 1): GameEvent[] {
  const car = findCar(state, id);
  if (!car || carStage(car) !== 'ready') return [];
  const mult = clampHaggle(haggle);
  if (mult !== 1) {
    state.stats.haggles += 1;
    if (haggleGrade(mult) === 'perfect') state.stats.perfectHaggles += 1;
  }
  const events: GameEvent[] = [];
  sellInternal(state, car, false, events, mult);
  return events;
}

/** A haggle is starting on this car: the salesperson waits so the sale isn't taken away mid-haggle. */
export function holdForHaggle(state: GameState, id: number): void {
  const car = findCar(state, id);
  if (car) car.sellProgress = Math.min(car.sellProgress, -ECON.haggle.timeout);
}

function crushInternal(state: GameState, car: Car, auto: boolean, events: GameEvent[]): void {
  const parts = crushParts(car.rarity, state.levels.press, partsPerk(state));
  const cash = Math.floor(car.value * ECON.crusher.scrapFraction);
  state.cars = state.cars.filter((c) => c.id !== car.id);
  state.parts += parts;
  addCash(state, cash);
  state.crusherCooldown = crusherCooldown(state.levels.press);
  state.stats.carsCrushed += 1;
  events.push({ type: 'crushed', car, parts, cash, auto });
  onCarCrushed(state, events);
  ensureFocus(state);
}

/** Parts the Scrapper tries to keep in the bin: a floor, or what the barn's next stage needs. */
export function scrapperTarget(state: GameState): number {
  return Math.max(ECON.crusher.scrapperKeepParts, nextBarnStage(state)?.parts ?? 0);
}

/**
 * The car the Scrapper would crush now, if any: only while parts are low and the Scrapper is rested,
 * and only a fresh Common wreck nobody has started on (the newest one).
 */
export function scrapperPick(state: GameState): Car | undefined {
  if (!state.managers.scrapper || !crusherUnlocked(state) || state.crusherCooldown > 0) return undefined;
  if (state.scrapperRest > 0 || state.parts >= scrapperTarget(state)) return undefined;
  for (let i = state.cars.length - 1; i >= 0; i--) {
    const c = state.cars[i]!;
    if (c.rarity === 'common' && c.dirt >= 1 && c.damage > 0) return c;
  }
  return undefined;
}

/** Crush an unfinished wreck: Parts plus a little scrap cash. */
export function crushCar(state: GameState, id: number): GameEvent[] {
  const car = findCar(state, id);
  if (!canCrush(state, car)) return [];
  const events: GameEvent[] = [];
  crushInternal(state, car, false, events);
  return events;
}

export function claimContract(state: GameState, id: number): { cash: number; parts: number } {
  return claimContractRule(state, id);
}

/** Swap an active order for a different one (free, once per order). */
export function rerollContract(state: GameState, id: number): GameEvent[] {
  const events: GameEvent[] = [];
  rerollContractRule(state, id, events);
  return events;
}

export function buyUpgrade(state: GameState, kind: UpgradeKind, count: number | 'max' = 1): boolean {
  const { levels, cost } = bulkCost(kind, state.levels[kind], count, state.cash);
  if (levels === 0 || cost > state.cash) return false;
  state.cash -= cost;
  state.levels[kind] += levels;
  state.tutorial.firstUpgrade = true;
  return true;
}

export function buySlot(state: GameState): boolean {
  const cost = slotCost(state.slots);
  if (cost === null || cost > state.cash) return false;
  state.cash -= cost;
  state.slots += 1;
  return true;
}

export function hireManager(state: GameState, kind: ManagerKind): boolean {
  const cost = ECON.managers[kind].cost;
  if (state.managers[kind] || cost > state.cash) return false;
  state.cash -= cost;
  state.managers[kind] = true;
  return true;
}

// ---- Time -----------------------------------------------------------------

/**
 * Called on load and on returning to the app. Awards offline earnings for
 * the time since `lastSeen`. If the clock went backwards, nothing is awarded
 * and `lastSeen` stays put, so moving the clock back then forward gains nothing.
 */
export interface ElapsedResult {
  seconds: number;
  /** Cash earned while away (sales plus the Scrapper's scrap cash). */
  earned: number;
  /** Parts the Scrapper added to the bin while away. */
  parts: number;
  /** Part of `earned` that came from the Repair Garage's Foreman. */
  garage: number;
  /** Part of `earned` that came from the Used Car Lot's crew. */
  carlot: number;
  /** Part of `earned` that came from the Paint & Tuning shop's Painter. */
  paint: number;
}

/**
 * The Scrapper while you're away: it tops the parts bin up to its target (no further, as in play),
 * crushing at most one Common wreck per rest period of the time that counts offline.
 * Only while the yard runs on its own (full crew), so wrecks keep arriving.
 */
export function offlineScrapper(state: GameState, seconds: number): { crushes: number; parts: number; cash: number } {
  const none = { crushes: 0, parts: 0, cash: 0 };
  if (!state.managers.scrapper || !crusherUnlocked(state) || idleIncomePerSecond(state) <= 0) return none;
  const counted = Math.max(0, Math.min(seconds, offlineCap(state))) * ECON.offline.efficiency;
  const c = ECON.crusher;
  const maxCrushes = Math.floor(counted / (c.scrapperRest + ECON.arrivalInterval));
  const per = crushParts('common', state.levels.press, partsPerk(state));
  const need = Math.max(0, scrapperTarget(state) - state.parts);
  const crushes = Math.min(maxCrushes, Math.ceil(need / per));
  if (crushes <= 0) return none;
  const cash = crushes * Math.floor(expectedCommonValue(state.levels.quality, state.carsSold) * legacyMultiplier(state) * c.scrapFraction);
  return { crushes, parts: crushes * per, cash };
}

export function applyElapsed(state: GameState, now: number): ElapsedResult {
  if (!Number.isFinite(now) || now <= state.lastSeen) return { seconds: 0, earned: 0, parts: 0, garage: 0, carlot: 0, paint: 0 };
  const seconds = (now - state.lastSeen) / 1000;
  state.lastSeen = now;
  const scrap = offlineScrapper(state, seconds);
  state.parts += scrap.parts;
  state.stats.carsCrushed += scrap.crushes;
  const garage = garageOfflineEarnings(state, seconds);
  const carlot = carlotOfflineEarnings(state, seconds);
  const paint = paintOfflineEarnings(state, seconds);
  const earned = offlineEarnings(state, seconds) + scrap.cash + garage + carlot + paint;
  // The barn restoration keeps going while you're away (one stage at most).
  tickBarn(state, Math.min(seconds, offlineCap(state)), []);
  return { seconds, earned, parts: scrap.parts, garage, carlot, paint };
}

/** Mark the game as running at `now`. Never moves lastSeen backwards. */
export function touch(state: GameState, now: number): void {
  if (Number.isFinite(now) && now > state.lastSeen) state.lastSeen = now;
}

/** Queue offline earnings; they stay in the save until collected. */
export function queueOffline(state: GameState, now: number): ElapsedResult {
  const r = applyElapsed(state, now);
  if (r.earned > 0) state.pendingOffline += r.earned;
  return r;
}

export function collectOffline(state: GameState, multiplier = 1): number {
  const amount = Math.floor(state.pendingOffline * Math.max(1, multiplier));
  state.pendingOffline = 0;
  addCash(state, amount);
  return amount;
}

export function addCash(state: GameState, amount: number): void {
  if (!(amount > 0)) return;
  state.cash += amount;
  state.lifetimeEarnings += amount;
}

export { idleIncomePerSecond };
