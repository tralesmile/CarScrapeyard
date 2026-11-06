// Used Car Lot (business 3, P1.2a). Buy used cars at the auction board, refurbish them on the forecourt, sell them.
// Every lot shows its condition and price before you buy (no blind boxes). Pure rules, ticked from sim.ts once the
// lot is open, whichever business is on screen.

import type { CarFamily, CarLotCrewKind, CarLotUpgradeKind, Condition, LotBuyerKind } from './config';
import { ECON, MODEL_NAMES, PAINTS } from './config';
import { stationPower, unlockedFamilies } from './formulas';
import { clampHaggle } from './haggle';
import { pick, weighted } from './rng';
import type { AuctionLot, GameState, LotCar } from './state';

export type CarLotEvent =
  | { type: 'lotListed'; lot: AuctionLot; index: number }
  /** A lot left the board unsold (someone else won it). */
  | { type: 'lotExpired'; lot: AuctionLot; index: number }
  | { type: 'lotBought'; car: LotCar; auto: boolean; index: number }
  | { type: 'lotRefurbished'; car: LotCar }
  /** A walk-up buyer stepped up to a car and looks it over; `bonus` is what they will add if they like it. */
  | { type: 'lotBuyerArrived'; kind: LotBuyerKind; car: LotCar; bonus: number }
  /** The buyer's car went (sold by the player) and no other car was ready: they walked off. */
  | { type: 'lotBuyerLeft'; kind: LotBuyerKind }
  /**
   * A car was sold. `auto` = a walk-up buyer (`buyer`) paid the list price plus their `bonus`; otherwise the player
   * sold it with `haggle`.
   */
  | { type: 'lotSold'; car: LotCar; amount: number; profit: number; haggle: number; auto: boolean; buyer: LotBuyerKind | null; bonus: number };

export interface CarLotSink {
  push(e: CarLotEvent): void;
}

export const CONDITIONS = [1, 2, 3, 4, 5] as const satisfies readonly Condition[];
export const CARLOT_UPGRADES = Object.keys(ECON.carlot.upgrades) as CarLotUpgradeKind[];
export const CARLOT_CREW = Object.keys(ECON.carlot.crew) as CarLotCrewKind[];
export const LOT_BUYERS = Object.keys(ECON.carlot.buyers) as LotBuyerKind[];

export function carlotOpen(state: GameState): boolean {
  return state.businesses.opened.carlot === true;
}

export function carlotUpgradeCost(kind: CarLotUpgradeKind, level: number): number {
  const u = ECON.carlot.upgrades[kind];
  return Math.ceil(u.baseCost * Math.pow(u.growth, level - 1));
}

export function showroomMultiplier(level: number): number {
  return Math.pow(ECON.carlot.showroomGrowth, level - 1);
}

/** Valet Bay power: same curve as the yard stations and the Tool Wall. */
export function valetPower(state: GameState): number {
  return stationPower(state.carlot.levels.valet);
}

export function refurbPerTap(state: GameState): number {
  return ECON.carlot.workPerTap * valetPower(state);
}

export function detailerRate(state: GameState): number {
  return state.carlot.crew.detailer ? ECON.carlot.crew.detailer.workPerSec * valetPower(state) : 0;
}

/** Retail value at Showroom level 1 (what a buyer pays before the Showroom multiplier). */
export function baseRetail(family: CarFamily): number {
  const c = ECON.carlot;
  return Math.round(c.retailBase * (ECON.families[family].baseValue / c.feeFamilyRef));
}

/** What a buyer pays for a refurbished car today (list price, before haggling). */
export function listPrice(state: GameState, car: { family: CarFamily }): number {
  return Math.round(baseRetail(car.family) * showroomMultiplier(state.carlot.levels.showroom));
}

export function auctionPrice(family: CarFamily, condition: Condition): number {
  return Math.max(1, Math.round(baseRetail(family) * ECON.carlot.conditions[condition].priceFrac));
}

/** Expected profit of a lot at today's Showroom level (list price minus auction price). */
export function lotProfit(state: GameState, lot: AuctionLot): number {
  return listPrice(state, lot) - lot.price;
}

export function spotCost(spots: number): number | null {
  return ECON.carlot.spots.costs[spots - ECON.carlot.spots.start] ?? null;
}

export function findLotCar(state: GameState, id: number | null): LotCar | undefined {
  if (id === null) return undefined;
  return state.carlot.cars.find((c) => c.id === id);
}

export function lotCarReady(car: LotCar): boolean {
  return car.work <= 0;
}

function ensureFocus(state: GameState): void {
  const l = state.carlot;
  const cur = findLotCar(state, l.focusedId);
  if (cur && !lotCarReady(cur)) return;
  // Prefer a car that still needs work, then any car.
  l.focusedId = (l.cars.find((c) => !lotCarReady(c)) ?? l.cars[0])?.id ?? null;
}

export function generateLot(state: GameState): AuctionLot {
  const l = state.carlot;
  const family = pick(state, unlockedFamilies(state.carsSold));
  const weights = Object.fromEntries(CONDITIONS.map((c) => [String(c), ECON.carlot.conditions[c].weight])) as Record<string, number>;
  const condition = Number(weighted(state, weights)) as Condition;
  return {
    id: l.nextId++,
    family,
    model: pick(state, MODEL_NAMES[family]),
    paint: pick(state, PAINTS),
    condition,
    price: auctionPrice(family, condition),
    timeLeft: ECON.carlot.lotSeconds,
  };
}

export function hasFreeSpot(state: GameState): boolean {
  return state.carlot.cars.length < state.carlot.spots;
}

export function canBuyLot(state: GameState, lotId: number): boolean {
  const lot = state.carlot.board.find((b) => b?.id === lotId);
  return carlotOpen(state) && !!lot && hasFreeSpot(state) && state.cash >= lot.price;
}

// ---- Walk-up buyers (P1.2c) ------------------------------------------------

/** Buyer types that show up at the lot today (some wait for more yard sales, like the yard's buyers). */
export function lotBuyerKinds(state: GameState): LotBuyerKind[] {
  return LOT_BUYERS.filter((k) => state.carsSold >= ECON.carlot.buyers[k].unlockCarsSold);
}

/** Bonus fraction a buyer adds for this car (0 when it is not their kind of car). */
export function lotBuyerBonus(kind: LotBuyerKind, car: { family: CarFamily; condition: Condition }): number {
  const b = ECON.carlot.buyers[kind];
  const famOk = b.families === null || (b.families as readonly CarFamily[]).includes(car.family);
  return famOk && car.condition >= b.minCondition ? b.bonus : 0;
}

/** Refurbished cars a walk-up buyer may take (not the one the player is haggling over). */
function buyableCars(state: GameState): LotCar[] {
  const l = state.carlot;
  return l.cars.filter((c) => lotCarReady(c) && c.id !== l.holdId);
}

/** The car a buyer of this kind picks: the one they like best, the oldest on a tie. */
export function lotBuyerChoice(state: GameState, kind: LotBuyerKind): LotCar | undefined {
  let best: LotCar | undefined;
  let bestBonus = -1;
  for (const c of buyableCars(state)) {
    const b = lotBuyerBonus(kind, c);
    if (b > bestBonus) {
      best = c;
      bestBonus = b;
    }
  }
  return best;
}

/** What the walk-up buyer would pay for this car (list price plus their bonus). */
export function lotBuyerPrice(state: GameState, kind: LotBuyerKind, car: LotCar): number {
  return Math.round(listPrice(state, car) * (1 + lotBuyerBonus(kind, car)));
}

function tickBuyer(state: GameState, dt: number, events: CarLotSink): void {
  const l = state.carlot;
  const c = ECON.carlot;
  if (buyableCars(state).length === 0) {
    if (l.buyer) events.push({ type: 'lotBuyerLeft', kind: l.buyer.kind });
    l.buyer = null;
    l.buyerTimer = 0;
    return;
  }
  l.buyerTimer += dt;
  if (!l.buyer && l.buyerTimer >= c.buyerInterval - c.buyerLookSeconds) {
    const kinds = lotBuyerKinds(state);
    const kind = weighted(state, Object.fromEntries(kinds.map((k) => [k, c.buyers[k].weight])) as Record<LotBuyerKind, number>);
    const car = lotBuyerChoice(state, kind)!;
    l.buyer = { kind, carId: car.id };
    events.push({ type: 'lotBuyerArrived', kind, car, bonus: lotBuyerBonus(kind, car) });
  }
  if (l.buyer && l.buyerTimer >= c.buyerInterval) {
    const { kind } = l.buyer;
    // Their car may have been sold or held since they arrived: they take the best one still there.
    let car = findLotCar(state, l.buyer.carId);
    if (!car || !lotCarReady(car) || car.id === l.holdId) car = lotBuyerChoice(state, kind)!;
    l.buyer = null;
    l.buyerTimer = 0;
    const bonus = lotBuyerBonus(kind, car);
    finishSale(state, car, lotBuyerPrice(state, kind, car), 1, { kind, bonus }, events);
  }
}

function takeLot(state: GameState, index: number, auto: boolean, events: CarLotSink): LotCar {
  const l = state.carlot;
  const lot = l.board[index]!;
  state.cash -= lot.price;
  l.board[index] = null;
  l.refill[index] = ECON.carlot.refillSeconds;
  const car: LotCar = {
    id: lot.id,
    family: lot.family,
    model: lot.model,
    paint: lot.paint,
    condition: lot.condition,
    paid: lot.price,
    work: ECON.carlot.conditions[lot.condition].work,
  };
  l.cars.push(car);
  events.push({ type: 'lotBought', car, auto, index });
  ensureFocus(state);
  return car;
}

function finishSale(
  state: GameState,
  car: LotCar,
  amount: number,
  haggle: number,
  buyer: { kind: LotBuyerKind; bonus: number } | null,
  events: CarLotSink,
): void {
  const l = state.carlot;
  const profit = amount - car.paid;
  state.cash += amount;
  // Only the profit counts as earnings: the auction price was your own cash coming back.
  state.lifetimeEarnings += Math.max(0, profit);
  l.cars = l.cars.filter((c) => c.id !== car.id);
  if (l.holdId === car.id) l.holdId = null;
  l.sold += 1;
  l.earned += amount;
  l.profit += profit;
  events.push({ type: 'lotSold', car, amount, profit, haggle, auto: buyer !== null, buyer: buyer?.kind ?? null, bonus: buyer?.bonus ?? 0 });
  ensureFocus(state);
}

/** Value of a lot for the Auction Agent: profit per unit of work (plus a fixed overhead per car). */
function agentScore(state: GameState, lot: AuctionLot): number {
  return lotProfit(state, lot) / (ECON.carlot.conditions[lot.condition].work + 4);
}

/** The lot the Auction Agent would buy now, or -1. */
export function agentPick(state: GameState): number {
  const l = state.carlot;
  if (!l.crew.agent || !hasFreeSpot(state)) return -1;
  let best = -1;
  let bestScore = -Infinity;
  l.board.forEach((lot, i) => {
    if (!lot || state.cash < lot.price * ECON.carlot.agentReserve) return;
    const sc = agentScore(state, lot);
    if (sc > bestScore) {
      bestScore = sc;
      best = i;
    }
  });
  return best;
}

export function tickCarLot(state: GameState, dt: number, events: CarLotSink): void {
  if (!carlotOpen(state)) return;
  const l = state.carlot;
  // The auction board: lots count down and get replaced.
  for (let i = 0; i < l.board.length; i++) {
    const lot = l.board[i];
    if (lot) {
      lot.timeLeft -= dt;
      if (lot.timeLeft <= 0) {
        l.board[i] = null;
        l.refill[i] = ECON.carlot.refillSeconds;
        events.push({ type: 'lotExpired', lot, index: i });
      }
    } else {
      l.refill[i] = (l.refill[i] ?? 0) - dt;
      if (l.refill[i]! <= 0) {
        l.refill[i] = 0;
        const fresh = generateLot(state);
        l.board[i] = fresh;
        events.push({ type: 'lotListed', lot: fresh, index: i });
      }
    }
  }
  const pickIndex = agentPick(state);
  if (pickIndex >= 0) takeLot(state, pickIndex, true, events);
  // The Detailer refurbishes the oldest car that still needs work.
  const rate = detailerRate(state);
  if (rate > 0) {
    const car = l.cars.find((c) => !lotCarReady(c));
    if (car) {
      car.work = Math.max(0, car.work - rate * dt);
      if (car.work < 0.005) {
        car.work = 0;
        events.push({ type: 'lotRefurbished', car });
        ensureFocus(state);
      }
    }
  }
  // Walk-up buyers look a refurbished car over, then pay the list price plus their bonus.
  tickBuyer(state, dt, events);
}

// ---- Player actions -------------------------------------------------------

export function buyLot(state: GameState, lotId: number): CarLotEvent[] {
  if (!canBuyLot(state, lotId)) return [];
  const events: CarLotEvent[] = [];
  takeLot(state, state.carlot.board.findIndex((b) => b?.id === lotId), false, events);
  return events;
}

/** One tap on a car that still needs refurbishing. */
export function refurbTap(state: GameState, id: number): CarLotEvent[] {
  const car = findLotCar(state, id);
  if (!carlotOpen(state) || !car || lotCarReady(car)) return [];
  car.work = Math.max(0, car.work - refurbPerTap(state));
  if (car.work < 0.005) car.work = 0;
  const events: CarLotEvent[] = [];
  if (car.work === 0) {
    events.push({ type: 'lotRefurbished', car });
    ensureFocus(state);
  }
  return events;
}

/** Sell a refurbished car now, at the list price x the haggle result (0.9..1.3). */
export function sellLotCar(state: GameState, id: number, haggle = 1): CarLotEvent[] {
  const car = findLotCar(state, id);
  if (!carlotOpen(state) || !car || !lotCarReady(car)) return [];
  const h = clampHaggle(haggle);
  const events: CarLotEvent[] = [];
  finishSale(state, car, Math.round(listPrice(state, car) * h), h, null, events);
  return events;
}

/** Keep walk-up buyers away from a car while the player haggles over it (cleared by the sale or `null`). */
export function holdLotCar(state: GameState, id: number | null): void {
  state.carlot.holdId = id !== null && findLotCar(state, id) ? id : null;
}

export function focusLotCar(state: GameState, id: number): void {
  if (findLotCar(state, id)) state.carlot.focusedId = id;
}

export function buyCarLotUpgrade(state: GameState, kind: CarLotUpgradeKind): boolean {
  if (!carlotOpen(state)) return false;
  const cost = carlotUpgradeCost(kind, state.carlot.levels[kind]);
  if (cost > state.cash) return false;
  state.cash -= cost;
  state.carlot.levels[kind] += 1;
  return true;
}

export function buySpot(state: GameState): boolean {
  const cost = spotCost(state.carlot.spots);
  if (!carlotOpen(state) || cost === null || cost > state.cash) return false;
  state.cash -= cost;
  state.carlot.spots += 1;
  return true;
}

export function hireLotCrew(state: GameState, kind: CarLotCrewKind): boolean {
  const cost = ECON.carlot.crew[kind].cost;
  if (!carlotOpen(state) || state.carlot.crew[kind] || cost > state.cash) return false;
  state.cash -= cost;
  state.carlot.crew[kind] = true;
  return true;
}

// ---- Idle / offline -------------------------------------------------------

/** Board-weighted averages over the condition grades: work and auction price fraction. */
function conditionAverages() {
  const cs = CONDITIONS.map((c) => ECON.carlot.conditions[c]);
  const w = cs.reduce((s, c) => s + c.weight, 0);
  return {
    work: cs.reduce((s, c) => s + c.weight * c.work, 0) / w,
    priceFrac: cs.reduce((s, c) => s + c.weight * c.priceFrac, 0) / w,
  };
}

/**
 * Average walk-up price multiplier: every unlocked buyer type (by weight) picking a random car from the board's mix
 * (unlocked families, condition weights). Idle sales use it; with more than one car waiting a buyer can pick, so the
 * real figure is a little higher.
 */
export function averageBuyerMultiplier(state: GameState): number {
  const kinds = lotBuyerKinds(state);
  const fams = unlockedFamilies(state.carsSold);
  const conds = CONDITIONS.map((c) => ({ c, w: ECON.carlot.conditions[c].weight }));
  const cw = conds.reduce((s, x) => s + x.w, 0);
  const kw = kinds.reduce((s, k) => s + ECON.carlot.buyers[k].weight, 0);
  let sum = 0;
  for (const k of kinds)
    for (const family of fams)
      for (const { c, w } of conds) sum += (ECON.carlot.buyers[k].weight / kw) * (w / cw) * (1 / fams.length) * lotBuyerBonus(k, { family, condition: c });
  return 1 + sum;
}

/** Average base retail value over the unlocked families. */
function averageRetail(state: GameState): number {
  const fams = unlockedFamilies(state.carsSold);
  return fams.reduce((s, f) => s + baseRetail(f), 0) / fams.length;
}

/**
 * Profit per second the lot makes on its own (Detailer and Auction Agent hired), averaged over the board's condition
 * mix. With two or more spots the Detailer works on the next car while the last one waits for its buyer, so a car
 * takes the longer of the refurbish time and the buyer interval.
 */
export function carlotIdleIncome(state: GameState): number {
  const l = state.carlot;
  if (!carlotOpen(state) || !l.crew.detailer || !l.crew.agent) return 0;
  const avg = conditionAverages();
  const retail = averageRetail(state);
  const profit = retail * (showroomMultiplier(l.levels.showroom) * averageBuyerMultiplier(state) - avg.priceFrac);
  const workTime = avg.work / detailerRate(state);
  const cycle = l.spots > 1 ? Math.max(workTime, ECON.carlot.buyerInterval) : workTime + ECON.carlot.buyerInterval;
  return Math.max(0, profit) / cycle;
}

/** Offline lot profit for a gap of `seconds`, with the same cap and efficiency as the yard. */
export function carlotOfflineEarnings(state: GameState, seconds: number): number {
  const capped = Math.max(0, Math.min(seconds, ECON.offline.capSeconds));
  return Math.floor(carlotIdleIncome(state) * capped * ECON.offline.efficiency);
}

// ---- Save repair ----------------------------------------------------------

function validCarFields(c: unknown): c is Record<string, unknown> {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  return (
    ['id', 'paint'].every((k) => typeof o[k] === 'number' && Number.isFinite(o[k] as number)) &&
    typeof o.family === 'string' &&
    o.family in ECON.families &&
    typeof o.model === 'string' &&
    CONDITIONS.includes(o.condition as Condition)
  );
}

function validLot(b: unknown): b is AuctionLot {
  if (!validCarFields(b)) return false;
  const o = b as Record<string, unknown>;
  return [o.price, o.timeLeft].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0);
}

function validLotCar(c: unknown): c is LotCar {
  if (!validCarFields(c)) return false;
  const o = c as Record<string, unknown>;
  return [o.paid, o.work].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0);
}

/** Repair impossible lot data from a save. */
export function sanitizeCarLot(l: GameState['carlot']): void {
  const c = ECON.carlot;
  const maxSpots = c.spots.start + c.spots.costs.length;
  l.spots = Math.min(maxSpots, Math.max(c.spots.start, Math.floor(l.spots)));
  for (const k of CARLOT_UPGRADES) l.levels[k] = Math.max(1, Math.min(99_999, Math.floor(l.levels[k])));
  for (const k of CARLOT_CREW) l.crew[k] = l.crew[k] === true;
  const board: (AuctionLot | null)[] = [];
  const refill: number[] = [];
  for (let i = 0; i < c.auctionLots; i++) {
    const b = l.board[i];
    board.push(validLot(b) ? { ...b, timeLeft: Math.min(b.timeLeft, c.lotSeconds) } : null);
    const r = l.refill[i];
    refill.push(typeof r === 'number' && Number.isFinite(r) ? Math.max(0, Math.min(r, c.refillSeconds)) : c.refillSeconds);
  }
  l.board = board;
  l.refill = refill;
  l.cars = l.cars.filter(validLotCar).slice(0, l.spots);
  l.buyerTimer = Math.max(0, Math.min(l.buyerTimer, c.buyerInterval));
  const b = l.buyer as unknown;
  const bo = b && typeof b === 'object' ? (b as Record<string, unknown>) : null;
  l.buyer =
    bo && LOT_BUYERS.includes(bo.kind as LotBuyerKind) && l.cars.some((car) => car.id === bo.carId)
      ? { kind: bo.kind as LotBuyerKind, carId: bo.carId as number }
      : null;
  // A buyer only stands there during the look; without one the wait starts that look again.
  if (!l.buyer) l.buyerTimer = Math.min(l.buyerTimer, c.buyerInterval - c.buyerLookSeconds - 0.01);
  l.sold = Math.max(0, Math.floor(l.sold));
  l.earned = Math.max(0, l.earned);
  if (!Number.isFinite(l.profit)) l.profit = 0;
  // A haggle never survives a reload.
  l.holdId = null;
  if (!l.cars.some((car) => car.id === l.focusedId)) l.focusedId = l.cars[0]?.id ?? null;
  const ids = [...l.cars.map((x) => x.id), ...board.filter((b): b is AuctionLot => !!b).map((b) => b.id)];
  l.nextId = Math.max(Math.floor(l.nextId) || 1, ...ids.map((id) => id + 1), 1);
}
