// Game rules. Pure TypeScript, no Phaser or DOM, so it runs in tests,
// the balance simulator and (later) on the server for validation.
//
// The UI never edits state directly: it calls these actions.

import type { ManagerKind, UpgradeKind } from './config';
import { ECON, MODEL_NAMES, PAINTS } from './config';
import {
  baseCarValue,
  bulkCost,
  idleIncomePerSecond,
  managerRate,
  offlineEarnings,
  repairPerTap,
  slotCost,
  washPerPixel,
} from './formulas';
import { nextRandom, pick, weighted } from './rng';
import { claimContract as claimContractRule, onCarCrushed, onCarSold, tickContracts, type ContractEvent } from './contracts';
import type { Car, GameState } from './state';
import { serveBuyer, tickBuyers, type BuyerEvent } from './buyers';
import { clampHaggle, haggleGrade } from './haggle';
import type { BuyerKind } from './config';

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
  | { type: 'crushed'; car: Car; parts: number; cash: number }
  | { type: 'partsUsed'; carId: number; parts: number }
  | ContractEvent
  | BuyerEvent;

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
  const family = pick(state, Object.keys(ECON.families) as (keyof typeof ECON.families)[]);
  const weights = Object.fromEntries(
    Object.entries(ECON.rarity).map(([k, v]) => [k, v.weight]),
  ) as Record<keyof typeof ECON.rarity, number>;
  const rolled = weighted(state, weights);
  const rarity = state.nextCarId <= ECON.tutorialCommonCars ? 'common' : rolled;
  const spread = 1 + ECON.valueSpread * (2 * nextRandom(state) - 1);
  const value = Math.max(1, Math.round(baseCarValue(family, rarity, state.levels.quality) * spread));
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
  ensureFocus(state);
}

/** A car just finished washing: spare parts (if any) take a chunk off its damage. */
function onWashed(state: GameState, car: Car, events: GameEvent[]): void {
  events.push({ type: 'washed', carId: car.id });
  const cost = ECON.crusher.partsPerFix;
  if (car.damage > 0 && state.parts >= cost) {
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
  if (state.crusherCooldown > 0) state.crusherCooldown = Math.max(0, state.crusherCooldown - dt);
  tickContracts(state, dt, events);
  tickBuyers(state, dt, events);

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
      if (car.sellProgress >= ECON.sellerDelay) sellInternal(state, car, true, events);
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

/** Crush an unfinished wreck: Parts plus a little scrap cash. */
export function crushCar(state: GameState, id: number): GameEvent[] {
  const car = findCar(state, id);
  if (!canCrush(state, car)) return [];
  const parts = ECON.crusher.parts[car.rarity];
  const cash = Math.floor(car.value * ECON.crusher.scrapFraction);
  state.cars = state.cars.filter((c) => c.id !== car.id);
  state.parts += parts;
  addCash(state, cash);
  state.crusherCooldown = ECON.crusher.cooldown;
  state.stats.carsCrushed += 1;
  const events: GameEvent[] = [{ type: 'crushed', car, parts, cash }];
  onCarCrushed(state, events);
  ensureFocus(state);
  return events;
}

export function claimContract(state: GameState, id: number): { cash: number; parts: number } {
  return claimContractRule(state, id);
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
export function applyElapsed(state: GameState, now: number): { seconds: number; earned: number } {
  if (!Number.isFinite(now) || now <= state.lastSeen) return { seconds: 0, earned: 0 };
  const seconds = (now - state.lastSeen) / 1000;
  state.lastSeen = now;
  const earned = offlineEarnings(state, seconds);
  return { seconds, earned };
}

/** Mark the game as running at `now`. Never moves lastSeen backwards. */
export function touch(state: GameState, now: number): void {
  if (Number.isFinite(now) && now > state.lastSeen) state.lastSeen = now;
}

/** Queue offline earnings; they stay in the save until collected. */
export function queueOffline(state: GameState, now: number): { seconds: number; earned: number } {
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
