import type { BusinessId, BuyerKind, CityId, CityLights, CarFamily, CarLotCrewKind, CarLotUpgradeKind, Condition, GarageFault, GarageUpgradeKind, LegacyBranch, LotBuyerKind, ManagerKind, PaintService, PaintUpgradeKind, Rarity, UpgradeKind } from './config';
import { ECON } from './config';
import type { NumberFormat } from './format';
import { newBook, type BookEntry } from './collection';
import type { Daily } from './daily';

/** v2 (run 10): `businesses` (city map, P1.1). */
export const SAVE_VERSION = 2;

export interface Car {
  id: number;
  family: CarFamily;
  model: string;
  paint: number;
  rarity: Rarity;
  /** Sale price in cash. */
  value: number;
  /** 1 = filthy, 0 = clean. */
  dirt: number;
  /** 1 = wrecked, 0 = fixed. */
  damage: number;
  /** Seconds the salesperson has spent on this car. */
  sellProgress: number;
}

/** A customer car in the Repair Garage (P1.1c). */
export interface GarageJob {
  id: number;
  family: CarFamily;
  model: string;
  paint: number;
  fault: GarageFault;
  /** Work units left (the fault's `work` when it arrives, 0 = fixed). */
  work: number;
  /** Full fee, fixed when the car arrives. */
  fee: number;
}

export interface Garage {
  bays: number;
  levels: Record<GarageUpgradeKind, number>;
  foreman: boolean;
  /** Cars in the bays, oldest first. */
  jobs: GarageJob[];
  arrivalTimer: number;
  nextJobId: number;
  focusedId: number | null;
  jobsDone: number;
  /** Cash the garage has earned in total (for the map and stats). */
  earned: number;
}

/** A car on the Used Car Lot's auction board (P1.2a). Everything about it is shown before you buy. */
export interface AuctionLot {
  id: number;
  family: CarFamily;
  model: string;
  paint: number;
  condition: Condition;
  /** Auction price, fixed when the lot appears. */
  price: number;
  /** Seconds left before someone else wins it. */
  timeLeft: number;
}

/** A car the player owns on the forecourt: refurbished (work 0), then sold. */
export interface LotCar {
  id: number;
  family: CarFamily;
  model: string;
  paint: number;
  condition: Condition;
  /** What it cost at the auction (for the profit shown on sale). */
  paid: number;
  /** Refurbish work units left (0 = ready to sell). */
  work: number;
  /** In a Paint & Tuning booth right now (P1.2f): it can't be sold or looked at until it comes back. */
  atShop?: boolean;
  /** The service the paint shop did on it (it can only go once). */
  tuned?: PaintService;
  /** What the service added to its sticker price. */
  tuneValue?: number;
}

/** A walk-up buyer looking over one of your refurbished cars before paying for it (P1.2c). */
export interface LotBuyer {
  kind: LotBuyerKind;
  carId: number;
}

export interface CarLot {
  spots: number;
  levels: Record<CarLotUpgradeKind, number>;
  crew: Record<CarLotCrewKind, boolean>;
  /** The auction board; `null` is an empty slot waiting for `refill[i]` seconds. */
  board: (AuctionLot | null)[];
  refill: number[];
  /** Owned cars, oldest first. */
  cars: LotCar[];
  /** Seconds a buyer has been on the way (runs while a refurbished car waits). */
  buyerTimer: number;
  /** The buyer on the forecourt looking a car over (the last `buyerLookSeconds` of the wait), or null. */
  buyer: LotBuyer | null;
  nextId: number;
  focusedId: number | null;
  /** Car being haggled over: walk-up buyers leave it alone until the slider stops. */
  holdId: number | null;
  sold: number;
  /** Profit the lot has made in total (sale price minus auction price). */
  profit: number;
  /** Cash the lot has taken in from sales in total. */
  earned: number;
}

/** A customer order in the Paint & Tuning shop (P1.2d): services done one after another. */
export interface PaintJob {
  id: number;
  family: CarFamily;
  model: string;
  /** Colour the car arrives in. */
  paint: number;
  /** Colour the customer asked for (shown once a respray or wrap is done). */
  newPaint: number;
  /** Ordered services, 1-3, no repeats. */
  services: PaintService[];
  /** Index of the service being worked on (services.length = done). */
  step: number;
  /** Work units left on the current service. */
  work: number;
  /** Full fee (combo bonus included), fixed when the car arrives. */
  fee: number;
  /** Seconds since the car arrived (for the quick-finish tip). */
  age: number;
  /**
   * Set when this is one of your own Used Car Lot cars (P1.2f): no fee and no tip; `fee` is what the service adds to
   * the car's sticker price when it goes back to the lot.
   */
  lotCarId?: number;
}

export interface PaintShop {
  booths: number;
  levels: Record<PaintUpgradeKind, number>;
  painter: boolean;
  /** Cars in the booths, oldest first. */
  jobs: PaintJob[];
  arrivalTimer: number;
  nextJobId: number;
  focusedId: number | null;
  jobsDone: number;
  tips: number;
  /** Cash the shop has earned in total. */
  earned: number;
}

export type ContractKind = 'sellAny' | 'sellFamily' | 'sellRare' | 'crush';

export interface Contract {
  id: number;
  /** 'active' counts progress, 'done' waits to be claimed, 'empty' waits for a new order. */
  status: 'active' | 'done' | 'empty';
  kind: ContractKind;
  /** Only for sellFamily. */
  family: CarFamily | null;
  target: number;
  progress: number;
  /** Seconds left: time to finish when active, time to the next order when empty. */
  timeLeft: number;
  rewardCash: number;
  rewardParts: number;
  /** True once this slot's order was swapped with the free reroll (one per order). */
  rerolled: boolean;
}

export interface Buyer {
  kind: BuyerKind;
  /** Seconds before this buyer gives up and leaves. */
  timeLeft: number;
}

export interface Barn {
  /**
   * locked: not unlocked yet · covered: waiting for the next stage to start · working: a stage timer runs ·
   * finished: all stages done, waiting for the reveal · revealed: shown, waiting to be sold · away: next find on its way
   */
  status: 'locked' | 'covered' | 'working' | 'finished' | 'revealed' | 'away';
  /** Stages finished so far. */
  stage: number;
  /** Seconds left: on the stage when working, until the next find when away. */
  timeLeft: number;
  family: CarFamily;
  model: string;
  paint: number;
  /** Sale price, fixed at the reveal. */
  value: number;
  /** Restorations sold so far (makes the next one bigger). */
  restored: number;
}

export interface GameState {
  version: number;
  createdAt: number;
  /** Last trusted timestamp (ms) the game was running. Never moves backwards. */
  lastSeen: number;
  cash: number;
  lifetimeEarnings: number;
  carsSold: number;
  levels: Record<UpgradeKind, number>;
  slots: number;
  managers: Record<ManagerKind, boolean>;
  /** Seconds until the Scrapper may crush again. */
  scrapperRest: number;
  /** Parts from the crusher; spent automatically to speed up repairs. */
  parts: number;
  /** Seconds until the crusher can be used again. */
  crusherCooldown: number;
  contracts: Contract[];
  nextContractId: number;
  cars: Car[];
  barn: Barn;
  /** City map (P1.1): which businesses are open and which one is on screen. The scrapyard keeps running in the background. */
  businesses: {
    active: BusinessId;
    opened: Record<BusinessId, boolean>;
  };
  /** Repair Garage (business 2). Ticks only once opened. */
  garage: Garage;
  /** Used Car Lot (business 3). Ticks only once opened. */
  carlot: CarLot;
  /** Paint & Tuning (business 4). Ticks only once opened. */
  paint: PaintShop;
  /** The customer waiting in the yard (null between buyers or before unlock). */
  buyer: Buyer | null;
  /** Seconds until the next buyer arrives when there is none. */
  buyerTimer: number;
  focusedId: number | null;
  /** Offline earnings waiting to be collected (kept in the save so a crash never loses them). */
  pendingOffline: number;
  arrivalTimer: number;
  rng: number;
  nextCarId: number;
  tutorial: {
    introSeen: boolean;
    firstSale: boolean;
    firstUpgrade: boolean;
    crusherSeen: boolean;
    contractsSeen: boolean;
    barnSeen: boolean;
    /** The city map was opened at least once (its button shows a dot until then). */
    mapSeen: boolean;
    /** The "lot cars can go to Paint & Tuning" toast was shown (P1.2f). */
    lotTuneSeen: boolean;
    /** The Sell Empire preview was opened (the map dot and banner stop) (P1.3b). */
    legacyOffered: boolean;
    /** The "DAILY TASKS!" banner was shown (P1.5b). */
    dailySeen: boolean;
  };
  settings: {
    sound: boolean;
    /** Saved now; music arrives with P1.8. */
    music: boolean;
    /** No camera shake or flashes, fewer CSS animations. */
    reduceMotion: boolean;
    numberFormat: NumberFormat;
    /** Vibrate on taps, sales and crushes (phones that support it). */
    vibration: boolean;
    /** Sell at the asking price without the haggle slider. */
    skipHaggle: boolean;
    /** Night-time neon look in cities that have one: by the device clock, or always day / night (P1.3d3c). */
    cityLights: CityLights;
  };
  /**
   * Collection book counts (P0.14i, the book itself is P1.4): cars sold per family. Saves from before run 9 start
   * at 0, so a veteran sees each "first of a family" toast once as their collection begins.
   */
  collection: {
    sold: Record<CarFamily, number>;
    /** Collection book (P1.4a): one entry per yard model and barn classic (see collection.ts). */
    models: Record<string, BookEntry>;
    /** Barn classics kept for the showcase instead of sold (P1.4c), one per model, in the order kept. */
    showcase: string[];
  };
  stats: {
    legendaryFound: number;
    playSeconds: number;
    carsCrushed: number;
    contractsDone: number;
    haggles: number;
    perfectHaggles: number;
    buyersServed: number;
  };
  /** Prestige (P1.3a): Legacy Points and what's left of the empires sold before this one. Kept on a sale. */
  legacy: Legacy;
  /** Daily tasks and the login calendar (P1.5a, see daily.ts). Kept on a sale. */
  daily: Daily;
}

export interface Legacy {
  /** Legacy Points earned so far (never lost). */
  points: number;
  /** Earnings of every empire sold before this one. */
  allTime: number;
  /** Empires sold. */
  sold: number;
  /** Seconds played in the empire that was sold last, and the fastest sale so far (0 = none yet). */
  lastRunSeconds: number;
  bestRunSeconds: number;
  /** Seconds played in this empire (playSeconds is lifetime). */
  runSeconds: number;
  /** Legacy tree (P1.3c): nodes owned per branch (0-4, bought in order). */
  tree: Record<LegacyBranch, number>;
  /** The free respec of this empire is used (reset on every sale). */
  respecUsed: boolean;
  /** City this empire is built in (P1.3d), picked on the sale before it. */
  city: CityId;
}

export function newLegacy(): Legacy {
  return { points: 0, allTime: 0, sold: 0, lastRunSeconds: 0, bestRunSeconds: 0, runSeconds: 0, tree: { mechanic: 0, dealer: 0, racer: 0 }, respecUsed: false, city: 'rustValley' };
}

export function emptyFamilyCounts(): Record<CarFamily, number> {
  const out = {} as Record<CarFamily, number>;
  for (const f of Object.keys(ECON.families) as CarFamily[]) out[f] = 0;
  return out;
}

export function newBusinesses(): GameState['businesses'] {
  const opened = {} as Record<BusinessId, boolean>;
  for (const id of Object.keys(ECON.businesses.list) as BusinessId[]) opened[id] = id === 'scrapyard';
  return { active: 'scrapyard', opened };
}

export function newGarage(): Garage {
  return {
    bays: ECON.garage.bays.start,
    levels: { tools: 1, rep: 1 },
    foreman: false,
    jobs: [],
    // The first customer drives in soon after opening.
    arrivalTimer: ECON.garage.arrivalInterval - 0.5,
    nextJobId: 1,
    focusedId: null,
    jobsDone: 0,
    earned: 0,
  };
}

export function newCarLot(): CarLot {
  const n = ECON.carlot.auctionLots;
  return {
    spots: ECON.carlot.spots.start,
    levels: { valet: 1, showroom: 1 },
    crew: { detailer: false, agent: false },
    board: Array.from({ length: n }, () => null),
    // The board fills one lot after another when the lot opens.
    refill: Array.from({ length: n }, (_, i) => 0.3 + i * 0.4),
    cars: [],
    buyerTimer: 0,
    buyer: null,
    nextId: 1,
    focusedId: null,
    holdId: null,
    sold: 0,
    profit: 0,
    earned: 0,
  };
}

export function newPaintShop(): PaintShop {
  return {
    booths: ECON.paint.booths.start,
    levels: { booth: 1, hype: 1 },
    painter: false,
    jobs: [],
    arrivalTimer: ECON.paint.arrivalInterval - 0.5,
    nextJobId: 1,
    focusedId: null,
    jobsDone: 0,
    tips: 0,
    earned: 0,
  };
}

export function newGame(now: number, seed = Math.floor(Math.random() * 2 ** 31)): GameState {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSeen: now,
    cash: 0,
    lifetimeEarnings: 0,
    carsSold: 0,
    levels: { wash: 1, repair: 1, quality: 1, press: 1 },
    slots: ECON.slots.start,
    managers: { mechanic: false, washer: false, seller: false, scrapper: false },
    scrapperRest: 0,
    parts: 0,
    crusherCooldown: 0,
    contracts: [],
    nextContractId: 1,
    cars: [],
    barn: { status: 'locked', stage: 0, timeLeft: 0, family: 'muscle', model: '', paint: 0, value: 0, restored: 0 },
    businesses: newBusinesses(),
    garage: newGarage(),
    carlot: newCarLot(),
    paint: newPaintShop(),
    buyer: null,
    buyerTimer: 0,
    focusedId: null,
    pendingOffline: 0,
    // First car appears almost immediately.
    arrivalTimer: ECON.arrivalInterval - 0.2,
    rng: seed >>> 0 || 1,
    nextCarId: 1,
    tutorial: { introSeen: false, firstSale: false, firstUpgrade: false, crusherSeen: false, contractsSeen: false, barnSeen: false, mapSeen: false, lotTuneSeen: false, legacyOffered: false, dailySeen: false },
    settings: { sound: true, music: true, reduceMotion: false, numberFormat: 'short', vibration: true, skipHaggle: false, cityLights: 'auto' },
    collection: { sold: emptyFamilyCounts(), models: newBook(), showcase: [] },
    stats: { legendaryFound: 0, playSeconds: 0, carsCrushed: 0, contractsDone: 0, haggles: 0, perfectHaggles: 0, buyersServed: 0 },
    legacy: newLegacy(),
    daily: { day: -1, tasks: [], bonusClaimed: false, claims: 0, claimedDay: -1, giftCars: 0 },
  };
}
