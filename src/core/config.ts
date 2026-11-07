// All tunable numbers for the economy live here (mirrored in docs/economy.md).
// Rule: game code never hard-codes a balance number; it reads ECON.

export type UpgradeKind = 'wash' | 'repair' | 'quality' | 'press';
export type ManagerKind = 'mechanic' | 'washer' | 'seller' | 'scrapper';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type CarFamily = 'sedan' | 'hatch' | 'pickup' | 'muscle' | 'van' | 'suv' | 'sports' | 'hyper';
/** Businesses on the city map, in unlock order (P1.1). */
export type BusinessId = 'scrapyard' | 'garage' | 'carlot' | 'paint';
export type GarageFault = 'tyre' | 'battery' | 'brakes' | 'exhaust' | 'engine';
export type GarageUpgradeKind = 'tools' | 'rep';
export type CarLotUpgradeKind = 'valet' | 'showroom';
export type CarLotCrewKind = 'detailer' | 'agent';
/** Walk-up buyer types on the Used Car Lot (P1.2c); they share the yard buyers' looks. */
export type LotBuyerKind = 'family' | 'collector' | 'speed' | 'tradie' | 'influencer';
/** Services on the Paint & Tuning menu (P1.2d). */
export type PaintService = 'respray' | 'rims' | 'wrap' | 'tune';
export type PaintUpgradeKind = 'booth' | 'hype';
/** Auction condition grade of a used car, 1 (rough) to 5 (nearly mint). */
export type Condition = 1 | 2 | 3 | 4 | 5;
export type BuyerKind = 'bargain' | 'collector' | 'speed' | 'family' | 'tradie' | 'influencer';

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
    /** Crusher upgrade (shown once the crusher unlocks): faster press, more parts per crush. */
    press: { name: 'Hydraulic Press', baseCost: 1500, growth: 1.35 },
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
    /** Crushes a fresh Common wreck now and then while the parts bin is low (shown once the crusher unlocks). */
    scrapper: { name: 'Scrapper', cost: 40_000, ratePerSec: 0 },
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

  /**
   * Car families. `weight` is how often one arrives (relative), `unlockCarsSold` when it starts arriving.
   * Rarer, pricier families unlock later so every few minutes something new rolls in.
   */
  families: {
    sedan: { name: 'Sedan', baseValue: 420, weight: 1, unlockCarsSold: 0 },
    hatch: { name: 'Hatchback', baseValue: 360, weight: 1, unlockCarsSold: 0 },
    pickup: { name: 'Pickup', baseValue: 520, weight: 1, unlockCarsSold: 0 },
    muscle: { name: 'Muscle', baseValue: 680, weight: 1, unlockCarsSold: 0 },
    van: { name: 'Van', baseValue: 460, weight: 1, unlockCarsSold: 15 },
    suv: { name: 'SUV', baseValue: 600, weight: 1, unlockCarsSold: 40 },
    sports: { name: 'Sports Car', baseValue: 950, weight: 0.5, unlockCarsSold: 100 },
    hyper: { name: 'Hypercar', baseValue: 1800, weight: 0.2, unlockCarsSold: 200 },
  } satisfies Record<CarFamily, { name: string; baseValue: number; weight: number; unlockCarsSold: number }>,

  /** The first N cars are always Common, so the tutorial pacing is predictable. */
  tutorialCommonCars: 5,

  /** Random spread on car value, +/- this fraction. */
  valueSpread: 0.1,

  /** Collection book counts (P0.14i). */
  collection: {
    /** First sales of the starter families during the first N sales get no toast (tutorial time). */
    quietSales: 10,
  },

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
    /** Hydraulic Press levels: cooldown = cooldown / (1 + this x (level - 1)), never below minCooldown (the press animation is ~1.3 s). */
    pressSpeedPerLevel: 0.15,
    minCooldown: 1.2,
    /** Each Hydraulic Press level adds this fraction of the base parts per crush. */
    pressPartsPerLevel: 0.1,
    /** The Scrapper keeps at least this many parts in the bin (more if the barn's next stage needs more). */
    scrapperKeepParts: 10,
    /** Seconds the Scrapper rests after each crush, so it only tops up the bin (arrivals come every 2.5 s). */
    scrapperRest: 8,
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
      bargain: { name: 'Bargain Hunter', icon: '🤑', wants: 'a Hatchback', families: ['hatch'], minRarity: null, bonus: 0.15, unlockCarsSold: 0 },
      collector: { name: 'Collector', icon: '🧐', wants: 'a Rare+ car', families: null, minRarity: 'rare', bonus: 0.4, unlockCarsSold: 0 },
      speed: { name: 'Speed Freak', icon: '😎', wants: 'a fast car', families: ['muscle', 'sports', 'hyper'], minRarity: null, bonus: 0.25, unlockCarsSold: 0 },
      family: { name: 'Family', icon: '👪', wants: 'a family car', families: ['sedan', 'van', 'suv'], minRarity: null, bonus: 0.2, unlockCarsSold: 0 },
      tradie: { name: 'Tradie', icon: '👷', wants: 'a Pickup', families: ['pickup'], minRarity: null, bonus: 0.2, unlockCarsSold: 20 },
      /** Arrives once sports cars do; pays big for a show-off car. */
      influencer: { name: 'Influencer', icon: '🤳', wants: 'a Sports Car or Hypercar', families: ['sports', 'hyper'], minRarity: null, bonus: 0.5, unlockCarsSold: 100 },
    } satisfies Record<
      BuyerKind,
      {
        name: string;
        icon: string;
        wants: string;
        families: readonly CarFamily[] | null;
        minRarity: Rarity | null;
        bonus: number;
        /** This buyer starts showing up after this many sales. */
        unlockCarsSold: number;
      }
    >,
  },

  /** Barn find: a covered classic at the back of the yard, restored in stages for a big payout. */
  /**
   * Businesses on the Rust Valley city map (P1.1). The scrapyard is always open. A business unlocks (shows its price on
   * the map) once lifetime earnings reach `unlockLifetime`, then opens for `openCost` cash. `ready: false` means its
   * loop is not built yet: the map shows it as "coming soon" and it cannot be opened.
   */
  businesses: {
    /** The map button appears after this many cars sold. */
    mapUnlockCarsSold: 30,
    list: {
      scrapyard: { name: 'Scrapyard', icon: '🚗', unlockLifetime: 0, openCost: 0, ready: true },
      garage: { name: 'Repair Garage', icon: '🔧', unlockLifetime: 200_000, openCost: 100_000, ready: true },
      carlot: { name: 'Used Car Lot', icon: '🏷️', unlockLifetime: 5_000_000, openCost: 2_500_000, ready: true },
      paint: { name: 'Paint & Tuning', icon: '🎨', unlockLifetime: 50_000_000, openCost: 25_000_000, ready: true },
    } satisfies Record<BusinessId, { name: string; icon: string; unlockLifetime: number; openCost: number; ready: boolean }>,
    /**
     * Map tiers (P1.1d): each open business grows on the map in three tiers. The number is the size needed for tier 2
     * and tier 3: lot slots for the scrapyard, repair bays for the garage. Businesses without an entry stay tier 1.
     */
    tiers: { scrapyard: [3, 4], garage: [2, 3], carlot: [3, 4], paint: [2, 3] } satisfies Partial<Record<BusinessId, readonly [number, number]>>,
  },

  /**
   * Repair Garage (business 2, P1.1c): customers bring cars with one fault each; tap the car (or let the Foreman work)
   * until it is fixed, and the customer pays the fee and drives off. No buying or selling. Fixing uses spare parts from
   * the scrapyard when there are any; without them the garage buys parts and a parts bill comes off the fee.
   */
  garage: {
    /** Seconds until the next customer drives in while a bay is free. */
    arrivalInterval: 3,
    bays: {
      start: 1,
      /** Cost of bay 2 and 3. */
      costs: [60_000, 600_000] as const,
    },
    /** Fee = baseFee x fault feeMult x (family base value / feeFamilyRef) x Reputation multiplier. */
    baseFee: 2_000,
    feeFamilyRef: 600,
    /** Fraction of the fee paid for bought parts when the scrapyard has none to give. */
    partsBill: 0.3,
    /** Work removed per tap at Tool Wall level 1 (a fault needs `work` units). */
    workPerTap: 1,
    faults: {
      tyre: { name: 'Flat tyre', icon: '🛞', work: 3, feeMult: 1, parts: 1, weight: 3 },
      battery: { name: 'Dead battery', icon: '🔋', work: 4, feeMult: 1.4, parts: 1, weight: 3 },
      brakes: { name: 'Worn brakes', icon: '🛑', work: 5, feeMult: 1.6, parts: 2, weight: 2.5 },
      exhaust: { name: 'Rusty exhaust', icon: '💨', work: 6, feeMult: 2, parts: 2, weight: 2 },
      engine: { name: 'Engine trouble', icon: '🔥', work: 10, feeMult: 3.5, parts: 4, weight: 1 },
    } satisfies Record<GarageFault, { name: string; icon: string; work: number; feeMult: number; parts: number; weight: number }>,
    upgrades: {
      /** Faster repairs (taps and the Foreman), doubled at the station milestones like the yard. */
      tools: { name: 'Tool Wall', baseCost: 15_000, growth: 1.15 },
      /** Higher fees. */
      rep: { name: 'Reputation', baseCost: 40_000, growth: 1.3 },
    } satisfies Record<GarageUpgradeKind, { name: string; baseCost: number; growth: number }>,
    /** Each Reputation level multiplies fees by this. */
    repFeeGrowth: 1.12,
    /** The Foreman fixes cars on its own (work units per second at Tool Wall level 1), also offline. */
    foreman: { name: 'Foreman', cost: 200_000, workPerSec: 0.8 },
  },

  /**
   * Used Car Lot (business 3, P1.2a): buy used cars at the auction board (condition shown before you bid, so it is
   * never a blind box), refurbish them on the forecourt (tap, or the Detailer), then sell to the buyers who walk up
   * (or sell now with the haggle slider). The Auction Agent buys on its own. Rough cars are cheap but take more work.
   */
  carlot: {
    /** Auction lots on the board at once. */
    auctionLots: 3,
    /** Seconds a lot stays on the board before someone else wins it (a new one replaces it). */
    lotSeconds: 45,
    /** Seconds before an empty board slot gets a new lot (after you bought one). */
    refillSeconds: 4,
    /** The last seconds of a lot: the card says "Going…" and its timer turns red (P1.2c). */
    auctionClosingSeconds: 8,
    /** How long the "SOLD!" / "YOURS!" stamp stays on an auction card, seconds. */
    stampSeconds: 1.6,
    spots: {
      start: 2,
      /** Cost of forecourt spot 3 and 4. */
      costs: [2_500_000, 20_000_000] as const,
    },
    /** Retail value = retailBase x (family base value / feeFamilyRef) x Showroom multiplier. */
    retailBase: 35_000,
    feeFamilyRef: 600,
    /** Per condition grade: auction price as a fraction of retail, refurbish work units, weight on the board. */
    conditions: {
      1: { name: 'Rough', priceFrac: 0.3, work: 36, weight: 2 },
      2: { name: 'Tired', priceFrac: 0.42, work: 26, weight: 3 },
      3: { name: 'Fair', priceFrac: 0.54, work: 18, weight: 3 },
      4: { name: 'Good', priceFrac: 0.66, work: 11, weight: 2 },
      5: { name: 'Mint', priceFrac: 0.78, work: 5, weight: 1 },
    } satisfies Record<Condition, { name: string; priceFrac: number; work: number; weight: number }>,
    /** Work removed per tap at Valet Bay level 1. */
    workPerTap: 1,
    /** Seconds until a buyer walks up while a refurbished car waits (they pay the full price). */
    buyerInterval: 6,
    /** The last seconds of `buyerInterval`: the buyer stands by the car and looks it over before paying. */
    buyerLookSeconds: 2.5,
    /**
     * Walk-up buyer types (P1.2c). Each pays a bonus for the cars they like: some by family, the Collector for cars you
     * bought in Good or Mint condition ("all original"). A buyer picks the waiting car they like best. `weight` is how
     * often they show up; they show up once that many cars have been sold in the yard.
     */
    buyers: {
      family: { name: 'Family', likes: 'family cars', families: ['sedan', 'van', 'suv'], minCondition: 0, bonus: 0.15, weight: 3, unlockCarsSold: 0 },
      collector: { name: 'Collector', likes: 'all-original cars (bought Good or Mint)', families: null, minCondition: 4, bonus: 0.3, weight: 2, unlockCarsSold: 0 },
      speed: { name: 'Speed Freak', likes: 'fast cars', families: ['muscle', 'sports', 'hyper'], minCondition: 0, bonus: 0.2, weight: 2, unlockCarsSold: 0 },
      tradie: { name: 'Tradie', likes: 'pickups and vans', families: ['pickup', 'van'], minCondition: 0, bonus: 0.2, weight: 2, unlockCarsSold: 20 },
      influencer: { name: 'Influencer', likes: 'show-off cars', families: ['sports', 'hyper'], minCondition: 0, bonus: 0.4, weight: 1, unlockCarsSold: 100 },
    } satisfies Record<
      LotBuyerKind,
      { name: string; likes: string; families: readonly CarFamily[] | null; minCondition: number; bonus: number; weight: number; unlockCarsSold: number }
    >,
    upgrades: {
      /** Faster refurbishing (taps and the Detailer), doubled at the station milestones. */
      valet: { name: 'Valet Bay', baseCost: 250_000, growth: 1.17 },
      /** Higher sale prices. */
      showroom: { name: 'Showroom', baseCost: 1_200_000, growth: 1.35 },
    } satisfies Record<CarLotUpgradeKind, { name: string; baseCost: number; growth: number }>,
    /** Each Showroom level multiplies sale prices by this. */
    showroomGrowth: 1.08,
    crew: {
      /** Refurbishes the oldest car on its own (work units per second at Valet Bay level 1), also offline. */
      detailer: { name: 'Detailer', cost: 3_000_000, workPerSec: 1.5 },
      /** Buys the best-value lot when a spot is free and the cash is there (keeps `agentReserve` x price). */
      agent: { name: 'Auction Agent', cost: 6_000_000, workPerSec: 0 },
    } satisfies Record<CarLotCrewKind, { name: string; cost: number; workPerSec: number }>,
    /** The agent only bids when cash covers this many times the lot price, so it never empties your wallet. */
    agentReserve: 2,
  },

  /**
   * Paint & Tuning (business 4, P1.2d): customers order one to three services for their car (respray, rims, vinyl
   * wrap, engine tune). The booth works through them in order (tap, or the Painter); bigger orders pay a combo bonus,
   * and an order you finish yourself quickly earns a tip. Refurbished lot cars can come in for one service (P1.2f).
   */
  paint: {
    /** Seconds until the next customer drives in while a booth is free. */
    arrivalInterval: 4,
    booths: {
      start: 1,
      /** Cost of booth 2 and 3. */
      costs: [25_000_000, 200_000_000] as const,
    },
    /** Fee per service = baseFee x service feeMult x (family base value / feeFamilyRef) x Hype multiplier. */
    baseFee: 55_000,
    feeFamilyRef: 600,
    /** Each service beyond the first adds this fraction to the whole order's fee. */
    comboBonus: 0.15,
    /** Order sizes (number of services) by weight. */
    orderSizes: { 1: 3, 2: 3, 3: 1 } satisfies Record<1 | 2 | 3, number>,
    /** Tip on orders the player finishes by hand within tipSecondsPerService x services of the car arriving. */
    tip: 0.25,
    tipSecondsPerService: 3,
    services: {
      respray: { name: 'Respray', icon: '🎨', work: 8, feeMult: 1, weight: 3 },
      rims: { name: 'Custom rims', icon: '🛞', work: 6, feeMult: 0.8, weight: 3 },
      wrap: { name: 'Vinyl wrap', icon: '🌀', work: 12, feeMult: 1.5, weight: 2 },
      tune: { name: 'Engine tune', icon: '⚙️', work: 16, feeMult: 2.2, weight: 1.5 },
    } satisfies Record<PaintService, { name: string; icon: string; work: number; feeMult: number; weight: number }>,
    /** Work removed per tap at Spray Booth level 1. */
    workPerTap: 1,
    upgrades: {
      /** Faster work (taps and the Painter), doubled at the station milestones. */
      booth: { name: 'Spray Booth', baseCost: 3_000_000, growth: 1.17 },
      /** Higher fees. */
      hype: { name: 'Hype', baseCost: 6_000_000, growth: 1.35 },
    } satisfies Record<PaintUpgradeKind, { name: string; baseCost: number; growth: number }>,
    /** Each Hype level multiplies fees by this. */
    hypeFeeGrowth: 1.1,
    /** The Painter works on the oldest order on its own (work units per second at Spray Booth level 1), also offline. */
    painter: { name: 'Painter', cost: 60_000_000, workPerSec: 1.2 },
    /**
     * Lot cars through the shop (P1.2f): a refurbished Used Car Lot car can take a free booth for one service. It pays
     * nothing at the shop; its sticker price on the lot goes up by the shop's fee for that service x `valueMult`
     * (walk-up buyers then add their bonus on top). The service suits the car.
     */
    lotCars: {
      valueMult: 1,
      service: {
        sedan: 'respray',
        hatch: 'rims',
        pickup: 'rims',
        muscle: 'tune',
        van: 'respray',
        suv: 'rims',
        sports: 'wrap',
        hyper: 'tune',
      },
    } satisfies { valueMult: number; service: Record<CarFamily, PaintService> },
  },

  barn: {
    /** Unlocks after this many cars sold (after contracts). */
    unlockCarsSold: 60,
    /** Restoration stages, in order. Cash cost = expected car value x cashMult (at the time you start). */
    stages: [
      { name: 'Tow it out', cashMult: 2, parts: 0, seconds: 20 },
      { name: 'Rebuild the engine', cashMult: 4, parts: 6, seconds: 45 },
      { name: 'Fix the body', cashMult: 6, parts: 12, seconds: 60 },
      { name: 'Fresh paint', cashMult: 8, parts: 0, seconds: 90 },
    ],
    /** Sale value = expected car value x this, at the reveal. */
    saleMult: 50,
    /** Each finished restoration makes the next one cost and pay this much more. */
    growthPerRestore: 0.15,
    /** Seconds until the next barn find after one is sold (runs offline too). */
    nextFindSeconds: 300,
  },
} as const;

export const PAINTS = [
  0xe5484d, 0x3b82f6, 0x1f9e9a, 0xe8762b, 0xf5b700, 0x3bc45a, 0xeadbc8, 0x2b2f36, 0xf2f4f7, 0x8b5cf6,
] as const;

/** Fictional classics for barn finds (fictional brands only). */
export const CLASSIC_NAMES: Record<CarFamily, readonly string[]> = {
  sedan: ["Regalia Duchess '58", "Vortex Starlight '61"],
  hatch: ["Kaze Kitsune '71", "Regalia Pebble '66"],
  pickup: ["Stallion Prospector '54", "Vortex Mule '59"],
  muscle: ["Stallion Wildfire '67", "Vortex Nightjar '69"],
  van: ["Kaze Wanderer '63", "Regalia Picnic '68"],
  suv: ["Stallion Scout '72", "Vortex Bighorn '70"],
  sports: ["Kaze Hayabusa '74", "Regalia Spyder '65"],
  hyper: ["Vortex Apex '89", "Stallion Mirage '92"],
};

/** Fictional brands only. Never use real car makers' names or logos. */
export const MODEL_NAMES: Record<CarFamily, readonly string[]> = {
  sedan: ['Vortex Cruiser', 'Regalia Civica', 'Stallion Comet', 'Kaze Aurora'],
  hatch: ['Kaze Pip', 'Vortex Hopper', 'Regalia Mini', 'Stallion Spark'],
  pickup: ['Stallion Ranger', 'Vortex Hauler', 'Kaze Trail', 'Regalia Ox'],
  muscle: ['Stallion Thunder', 'Vortex Fury', 'Regalia Brute', 'Kaze Ronin'],
  van: ['Kaze Caravan', 'Vortex Shuttle', 'Regalia Nomad', 'Stallion Courier'],
  suv: ['Stallion Ridge', 'Kaze Summit', 'Vortex Grizzly', 'Regalia Atlas'],
  sports: ['Kaze Raiden', 'Regalia Vento', 'Vortex Arrow', 'Stallion Blaze'],
  hyper: ['Vortex Zenith', 'Stallion Phantom', 'Kaze Tempest', 'Regalia Halo'],
};
