// All tunable numbers for the economy live here (mirrored in docs/economy.md).
// Rule: game code never hard-codes a balance number; it reads ECON.

export type UpgradeKind = 'wash' | 'repair' | 'quality';
export type ManagerKind = 'mechanic' | 'washer' | 'seller';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type CarFamily = 'sedan' | 'hatch' | 'pickup' | 'muscle';
export type BuyerKind = 'bargain' | 'collector' | 'speed' | 'family';

export const ECON = {
  /** Seconds between new wrecks arriving while a lot slot is free. */
  arrivalInterval: 2.5,

  /** Lot slots: how many cars can sit in the yard at once. */
  slots: {
    start: 1,
    /** Cost of slot 2, 3, 4. */
    costs: [20_000, 150_000, 900_000] as const,
  },

  upgrades: {
    wash: { name: 'Wash Bay', baseCost: 150, growth: 1.14 },
    repair: { name: 'Repair Bench', baseCost: 200, growth: 1.14 },
    quality: { name: 'Junk Supplier', baseCost: 900, growth: 1.22 },
  } satisfies Record<UpgradeKind, { name: string; baseCost: number; growth: number }>,

  /** Each level adds this fraction of base power (wash and repair). */
  powerPerLevel: 0.15,
  /** Each Junk Supplier level multiplies car value by this. */
  qualityValueGrowth: 1.08,

  /** Station levels that double that station's power. */
  milestones: [10, 25, 50, 100, 200] as const,
  milestoneMultiplier: 2,

  /** Manual play. */
  manual: {
    /** Dirt removed per pixel of swipe (design pixels, 390-wide layout) at level 1. */
    washPerPixel: 1 / 2000,
    /** Damage removed per tap at level 1. */
    repairPerTap: 0.2,
  },

  managers: {
    mechanic: { name: 'Mechanic', cost: 9_000, ratePerSec: 0.12 },
    washer: { name: 'Washer', cost: 30_000, ratePerSec: 0.15 },
    seller: { name: 'Salesperson', cost: 90_000, ratePerSec: 0 },
  } satisfies Record<ManagerKind, { name: string; cost: number; ratePerSec: number }>,

  /** Seconds a salesperson needs to close a sale once a car is ready. */
  sellerDelay: 3,

  offline: {
    capSeconds: 2 * 60 * 60,
    efficiency: 0.5,
    /** Below this, no welcome-back popup (seconds). */
    minSecondsForPopup: 30,
  },

  rarity: {
    common: { weight: 78, valueMult: 1, label: 'Common' },
    rare: { weight: 17, valueMult: 2.5, label: 'Rare' },
    epic: { weight: 4.5, valueMult: 6, label: 'Epic' },
    legendary: { weight: 0.5, valueMult: 20, label: 'Legendary' },
  } satisfies Record<Rarity, { weight: number; valueMult: number; label: string }>,

  families: {
    sedan: { name: 'Sedan', baseValue: 420 },
    hatch: { name: 'Hatchback', baseValue: 360 },
    pickup: { name: 'Pickup', baseValue: 520 },
    muscle: { name: 'Muscle', baseValue: 680 },
  } satisfies Record<CarFamily, { name: string; baseValue: number }>,

  /** The first N cars are always Common, so the tutorial pacing is predictable. */
  tutorialCommonCars: 5,

  /** Random spread on car value, +/- this fraction. */
  valueSpread: 0.1,

  /** Car crusher: turn an unfinished wreck into Parts (and a little scrap cash). */
  crusher: {
    /** Unlocks after this many cars sold (plan: around minute 3). */
    unlockCarsSold: 25,
    /** Seconds the press needs before it can crush again. */
    cooldown: 3,
    /** Parts per crushed car, by rarity. */
    parts: { common: 6, rare: 10, epic: 16, legendary: 30 } satisfies Record<Rarity, number>,
    /** Scrap cash paid as a fraction of the car's sale value. */
    scrapFraction: 0.15,
    /** Parts spent automatically when a washed car still needs repair. */
    partsPerFix: 2,
    /** Fraction of the remaining damage that spare parts remove at once. */
    fixFraction: 0.5,
  },

  /** Contracts board: three timed orders with rewards. */
  contracts: {
    /** Unlocks after this many cars sold (plan: around minute 5). */
    unlockCarsSold: 45,
    board: 3,
    /** Seconds to finish an order (game time; paused while away). */
    duration: 600,
    /** Seconds before an empty board slot gets a new order. */
    refresh: 45,
    /** Cash reward = expected car value x target x this (per kind). */
    rewardMult: { sellAny: 0.4, sellFamily: 0.9, sellRare: 2.5, crush: 0.7 },
    /** Order sizes [min, max]. */
    targets: { sellAny: [6, 10], sellFamily: [2, 4], sellRare: [1, 2], crush: [2, 4] },
    /** Extra parts on crush orders, per car. */
    crushPartsPerTarget: 4,
  },

  /** Haggle: timing slider on big manual sales. A needle sweeps the bar; the centre pays most. */
  haggle: {
    min: 0.9,
    max: 1.3,
    /** Half-width of the PERFECT zone around the centre, as a fraction of half the bar. */
    perfectZone: 0.12,
    /** Full left-right-left sweeps per second. */
    sweepsPerSec: 0.9,
    /** The lesson haggle (second sale ever) is slower and pays at least this. */
    lessonSweepsPerSec: 0.45,
    lessonMin: 1.2,
    /** Seconds before an untouched haggle closes at x1. The salesperson waits this long. */
    timeout: 4,
  },

  /** Customer personalities: one buyer waits in the yard and pays a bonus for the car they want. */
  buyers: {
    unlockCarsSold: 10,
    /** Seconds a buyer waits before leaving. */
    patience: 75,
    /** Seconds until the next buyer after one leaves or is served. */
    gap: 8,
    kinds: {
      bargain: { name: 'Bargain Hunter', icon: '🤑', wants: 'a Hatchback', families: ['hatch'], minRarity: null, bonus: 0.15 },
      collector: { name: 'Collector', icon: '🧐', wants: 'a Rare+ car', families: null, minRarity: 'rare', bonus: 0.4 },
      speed: { name: 'Speed Freak', icon: '😎', wants: 'a Muscle car', families: ['muscle'], minRarity: null, bonus: 0.25 },
      family: { name: 'Family', icon: '👪', wants: 'a Sedan', families: ['sedan'], minRarity: null, bonus: 0.2 },
    } satisfies Record<
      BuyerKind,
      { name: string; icon: string; wants: string; families: readonly CarFamily[] | null; minRarity: Rarity | null; bonus: number }
    >,
  },
} as const;

export const PAINTS = [
  0xe5484d, 0x3b82f6, 0x1f9e9a, 0xe8762b, 0xf5b700, 0x3bc45a, 0xeadbc8, 0x2b2f36, 0xf2f4f7, 0x8b5cf6,
] as const;

/** Fictional brands only. Never use real car makers' names or logos. */
export const MODEL_NAMES: Record<CarFamily, readonly string[]> = {
  sedan: ['Vortex Cruiser', 'Regalia Civica', 'Stallion Comet', 'Kaze Aurora'],
  hatch: ['Kaze Pip', 'Vortex Hopper', 'Regalia Mini', 'Stallion Spark'],
  pickup: ['Stallion Ranger', 'Vortex Hauler', 'Kaze Trail', 'Regalia Ox'],
  muscle: ['Stallion Thunder', 'Vortex Fury', 'Regalia Brute', 'Kaze Ronin'],
};
