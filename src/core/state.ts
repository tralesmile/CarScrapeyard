import type { BuyerKind, CarFamily, ManagerKind, Rarity, UpgradeKind } from './config';
import { ECON } from './config';
import type { NumberFormat } from './format';

export const SAVE_VERSION = 1;

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
  /** Parts from the crusher; spent automatically to speed up repairs. */
  parts: number;
  /** Seconds until the crusher can be used again. */
  crusherCooldown: number;
  contracts: Contract[];
  nextContractId: number;
  cars: Car[];
  barn: Barn;
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
}

export function newGame(now: number, seed = Math.floor(Math.random() * 2 ** 31)): GameState {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSeen: now,
    cash: 0,
    lifetimeEarnings: 0,
    carsSold: 0,
    levels: { wash: 1, repair: 1, quality: 1 },
    slots: ECON.slots.start,
    managers: { mechanic: false, washer: false, seller: false },
    parts: 0,
    crusherCooldown: 0,
    contracts: [],
    nextContractId: 1,
    cars: [],
    barn: { status: 'locked', stage: 0, timeLeft: 0, family: 'muscle', model: '', paint: 0, value: 0, restored: 0 },
    buyer: null,
    buyerTimer: 0,
    focusedId: null,
    pendingOffline: 0,
    // First car appears almost immediately.
    arrivalTimer: ECON.arrivalInterval - 0.2,
    rng: seed >>> 0 || 1,
    nextCarId: 1,
    tutorial: { introSeen: false, firstSale: false, firstUpgrade: false, crusherSeen: false, contractsSeen: false, barnSeen: false },
    settings: { sound: true, music: true, reduceMotion: false, numberFormat: 'short', vibration: true },
    stats: { legendaryFound: 0, playSeconds: 0, carsCrushed: 0, contractsDone: 0, haggles: 0, perfectHaggles: 0, buyersServed: 0 },
  };
}
