// All tunable numbers for the economy live here (mirrored in docs/economy.md).
// Rule: game code never hard-codes a balance number; it reads ECON.

export type UpgradeKind = 'wash' | 'repair' | 'quality' | 'press';
export type ManagerKind = 'mechanic' | 'washer' | 'seller' | 'scrapper';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type CarFamily = 'sedan' | 'hatch' | 'pickup' | 'muscle' | 'van' | 'suv' | 'sports' | 'hyper';
/** Businesses on the city map, in unlock order (P1.1). */
export type BusinessId = 'scrapyard' | 'garage' | 'carlot' | 'paint';
export type CityId = 'rustValley' | 'motorCity';
/** \"City lights\" setting (P1.3d3c): follow the device clock, or always day / always night. */
export type CityLights = 'auto' | 'day' | 'night';
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
/** Legacy tree (P1.3c): three branches of four nodes, bought in order within a branch. */
export type LegacyBranch = 'mechanic' | 'dealer' | 'racer';
export type LegacyNode =
  | 'quickHands' | 'headStart' | 'partsHoarder' | 'masterCrew'
  | 'silverTongue' | 'regulars' | 'insider' | 'franchise'
  | 'quickTips' | 'rareFinds' | 'barnScout' | 'nightShift';

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
    /**
     * Collection book (P1.4a). Every yard model (`MODEL_NAMES`) and barn classic (`CLASSIC_NAMES`) is an entry. Bonuses
     * are permanent (the book is kept when the empire is sold) and multiply the value of yard cars when they arrive.
     */
    /** Sell every model of a family once: that family's yard cars are worth this much more. */
    familySetBonus: 0.05,
    /** Sell one model of a brand in every family: that brand's yard cars are worth this much more. */
    brandSetBonus: 0.05,
    /** Restore every barn classic (sold or kept for the showcase): barn sale values x(1 + this). */
    classicsSetBonus: 0.25,
    /** Mastery stars per model at these sales counts; each star adds `masteryBonus` to that model's value. */
    masteryTiers: [10, 50, 200] as const,
    masteryBonus: 0.01,
    /**
     * Showcase (P1.4c): a restored barn classic can be kept instead of sold. Each classic in the showcase (one per
     * model, kept when the empire is sold) adds this much to every payout, like a small Legacy Point.
     */
    showcaseBonus: 0.005,
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

  /**
   * Daily tasks and the 7-day login calendar (P1.5a). A day starts at `resetHourUtc` (a fixed UTC hour, so time zone or
   * daylight saving changes never give a double or a missed day). Rewards are worth a number of average yard cars
   * (expected car value x the legacy and city multipliers) at the moment they are claimed.
   */
  daily: {
    /** Daily tasks and the calendar appear after this many sales (plan: around minute 15). */
    unlockCarsSold: 80,
    resetHourUtc: 4,
    tasksPerDay: 3,
    /** Task kinds: the counter they follow and the day's target. A kind is only rolled once it is unlocked. */
    tasks: {
      sell: { target: 40, rewardCars: 12, parts: 0 },
      haggle: { target: 6, rewardCars: 10, parts: 0 },
      buyer: { target: 8, rewardCars: 10, parts: 0 },
      crush: { target: 12, rewardCars: 8, parts: 15 },
      contract: { target: 3, rewardCars: 14, parts: 0 },
      garage: { target: 25, rewardCars: 14, parts: 0 },
      lot: { target: 8, rewardCars: 16, parts: 0 },
      paint: { target: 10, rewardCars: 16, parts: 0 },
    },
    /** Claiming all of the day's tasks adds this bonus (in cars). */
    allDoneBonusCars: 20,
    /**
     * Login calendar: one reward per day you play (a missed day does not reset it), then it starts again. The 7th day
     * brings a gift car of `giftRarity` to the yard.
     */
    calendar: [
      { cars: 5, parts: 0 },
      { cars: 8, parts: 10 },
      { cars: 10, parts: 0 },
      { cars: 12, parts: 20 },
      { cars: 15, parts: 0 },
      { cars: 20, parts: 30 },
      { cars: 0, parts: 0, gift: true },
    ],
    giftRarity: 'epic' as Rarity,
  },

  /**
   * Wallet (P1.7a): two small currencies on top of cash and parts. Gems are the soft premium currency: they are
   * earned here (medals, daily rewards) and bought with real money later (P2.3). Auction Tokens are earn-only, never
   * sold: they are the only price of an auction lot (no paid random rewards, see CLAUDE.md). Neither changes cash
   * income, so the economy sim is unaffected.
   */
  wallet: {
    /** Gems for claiming a medal tier (Bronze, Silver, Gold, Diamond). */
    medalGems: [0, 1, 3, 8],
    /** Tokens for a finished daily task, and for the all-done bonus. */
    taskTokens: 1,
    allDoneGems: 3,
    allDoneTokens: 2,
    /** Calendar days 1-7. */
    calendarGems: [1, 1, 2, 2, 3, 3, 10],
    calendarTokens: [0, 1, 0, 1, 0, 2, 3],
    /** Hard caps keep a tampered save from showing absurd numbers. */
    maxGems: 1_000_000,
    maxTokens: 100_000,
  },

  /**
   * Shop (P1.7b): what Gems and Auction Tokens buy. Gems arrive at ~3 a day (economy.md), so prices are small and
   * every item is a convenience, never a new income stream: the cash bag is worth `cashBagCars` average yard cars.
   */
  shop: {
    /** Finish the running barn stage now. */
    barnRushGems: 1,
    /** A crate of spare parts for the crusher bin and the barn. */
    partsCrate: { gems: 2, parts: 60 },
    /** Cash worth this many average yard cars (see carsWorth). */
    cashBag: { gems: 4, cars: 12 },
    /** A token lot: a car for the Used Car Lot with no cash price. Needs a free spot. */
    tokenLot: { tokens: 4, condition: 4 as const },
  },

  /**
   * Story (P1.6): chapter 1 in Rust Valley. Beats are short scenes with Grandpa Joe and the rival Vince Valvano,
   * shown in order when their moment comes, at least `gapSeconds` of play apart. Vince is flavour only: he takes
   * every `rivalEvery`-th lot that leaves the auction board unsold (and the first one) and every `rivalEvery`-th yard
   * customer who runs out of patience; the economy is unchanged.
   */
  story: {
    vinceVisitSales: 20,
    /** Chapter 2: Vince greets you in Motor City after this many sales there. */
    cityArrivalSales: 5,
    gapSeconds: 20,
    rivalEvery: 3,
  },

  /**
   * Achievements (P1.5c): lifetime goals with four medal tiers each, kept across Sell Empire. Every tier pays cash
   * worth `rewardCars[tier]` average yard cars at claim time (gems replace part of it with P1.7).
   */
  achievements: {
    medals: ['Bronze', 'Silver', 'Gold', 'Diamond'],
    medalIcons: ['🥉', '🥈', '🥇', '💎'],
    rewardCars: [3, 6, 12, 24],
    list: {
      sold: { name: 'Wheeler Dealer', icon: '🚗', goal: 'Sell yard cars', tiers: [25, 250, 2500, 25_000] },
      earned: { name: 'Money Maker', icon: '💰', goal: 'Earn in total', tiers: [100_000, 10_000_000, 1e9, 1e11] },
      crush: { name: 'Crusher', icon: '🔨', goal: 'Crush cars', tiers: [10, 100, 1000, 5000] },
      haggle: { name: 'Silver Tongue', icon: '🎯', goal: 'Perfect haggles', tiers: [5, 50, 250, 1000] },
      buyer: { name: 'People Person', icon: '🤝', goal: 'Serve buyers', tiers: [10, 100, 1000, 5000] },
      contract: { name: 'Order Up', icon: '📋', goal: 'Finish orders', tiers: [5, 50, 250, 1000] },
      legendary: { name: 'Lucky Find', icon: '✨', goal: 'Find Legendary cars', tiers: [1, 10, 50, 200] },
      barn: { name: 'Barn Stormer', icon: '🏚', goal: 'Restore barn classics', tiers: [1, 5, 20, 50] },
      garage: { name: 'Grease Monkey', icon: '🔧', goal: 'Garage repairs', tiers: [50, 500, 5000, 25_000] },
      lot: { name: 'Lot Boss', icon: '🏷', goal: 'Sell lot cars', tiers: [10, 100, 1000, 5000] },
      paint: { name: 'Spray King', icon: '🎨', goal: 'Paint shop orders', tiers: [25, 250, 2500, 10_000] },
      book: { name: 'Collector', icon: '📒', goal: 'Cars in the book', tiers: [8, 16, 32, 48] },
      empire: { name: 'Tycoon', icon: '🏛', goal: 'Sell your empire', tiers: [1, 3, 10, 25] },
      days: { name: 'Regular', icon: '📅', goal: 'Daily rewards claimed', tiers: [3, 7, 30, 100] },
    },
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

  /**
   * Cities (P1.3d). An empire is built in one city; a new city is chosen when the empire is sold. The same four
   * businesses run in every city, scaled: every value (car prices, fees, rewards, idle income) AND every price (upgrades,
   * crew, slots, opening costs, unlock goals, Head Start cash) is x `scale`, so the pacing inside a run stays the one the
   * sim tunes. The bigger earnings count in full for Legacy Points, so a run in a bigger city sells sooner and for more.
   * `fromSale`: the city can be chosen on that empire sale and later ones (2 = from the second sale; 0 = the start).
   */
  cities: {
    list: {
      rustValley: { name: 'Rust Valley', icon: '🏜️', scale: 1, fromSale: 0, tagline: 'Dusty little town where it all began', names: {}, hasNight: false },
      motorCity: {
        name: 'Motor City',
        icon: '🏙️',
        scale: 3,
        fromSale: 2,
        tagline: 'The big city: bigger prices, bigger payouts',
        // City names for the businesses (P1.3d2), shown on the map, in the list and on the scenes' signs. Keep each at
        // most as long as the longest default name ("Paint & Tuning"), so the signs keep their lettering.
        names: { scrapyard: 'Salvage Yard', garage: 'Midtown Garage', carlot: 'Auto Mall', paint: 'Neon Customs' },
        // Neon night-time look for every scene (P1.3d3c), by the device clock or the "City lights" setting.
        hasNight: true,
      },
    } satisfies Record<CityId, { name: string; icon: string; scale: number; fromSale: number; tagline: string; names: Partial<Record<BusinessId, string>>; hasNight: boolean }>,
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
  /** Prestige "Sell Empire" (P1.3a). Points = floor(sqrt(all-time earnings / pointScale)). */
  legacy: {
    /**
     * Points = floor((all-time earnings / pointScale) ^ pointExponent): 10 points at ~$500M. The exponent was 0.5
     * (a square root) until run 27; 0.8 keeps the second empire from being slower than the first (P1.3d4).
     */
    pointScale: 28_000_000,
    pointExponent: 0.8,
    /** The sale is offered once it would give at least this many points. */
    minPoints: 10,
    /** Income bonus per Legacy Point (+2%). */
    incomePerPoint: 0.02,
    /** The button glows when new points >= this share of the points already owned. */
    glowFrac: 0.5,
    /**
     * Legacy tree (P1.3c). Nodes are bought in order within a branch for `costs[i]` points. Spent points keep their
     * +2% income (the multiplier counts points earned). One free respec per empire.
     */
    tree: {
      costs: [2, 3, 5, 8] as const,
      branches: {
        mechanic: { name: 'Mechanic', icon: '🔧', nodes: ['quickHands', 'headStart', 'partsHoarder', 'masterCrew'] },
        dealer: { name: 'Dealer', icon: '🤝', nodes: ['silverTongue', 'regulars', 'insider', 'franchise'] },
        racer: { name: 'Racer', icon: '🏁', nodes: ['quickTips', 'rareFinds', 'barnScout', 'nightShift'] },
      } satisfies Record<LegacyBranch, { name: string; icon: string; nodes: readonly [LegacyNode, LegacyNode, LegacyNode, LegacyNode] }>,
      nodes: {
        quickHands: { name: 'Quick Hands', icon: '👐', desc: '+25% tap work in every business' },
        headStart: { name: 'Head Start', icon: '🚀', desc: 'New empires start with $5K and the Mechanic' },
        partsHoarder: { name: 'Parts Hoarder', icon: '⚙️', desc: '+50% parts from the crusher' },
        masterCrew: { name: 'Master Crew', icon: '👷', desc: 'All crew work 30% faster' },
        silverTongue: { name: 'Silver Tongue', icon: '🗣️', desc: 'Haggle PERFECT zone 30% wider' },
        regulars: { name: 'Regulars', icon: '🔔', desc: 'Buyers come 25% more often' },
        insider: { name: 'Insider', icon: '🔨', desc: 'Auction prices -10%' },
        franchise: { name: 'Franchise', icon: '🏢', desc: 'Opening a business costs 25% less' },
        quickTips: { name: 'Quick Tips', icon: '⚡', desc: '+1s per service on the paint tip timer' },
        rareFinds: { name: 'Rare Finds', icon: '💎', desc: 'Rare, Epic and Legendary cars x1.3 as often' },
        barnScout: { name: 'Barn Scout', icon: '🏚️', desc: 'Barn finds twice as often, stages 20% faster' },
        nightShift: { name: 'Night Shift', icon: '🌙', desc: 'Offline earnings cap +2 hours' },
      } satisfies Record<LegacyNode, { name: string; icon: string; desc: string }>,
      /** Tap work in every business x (1 + this). */
      quickHandsTap: 0.25,
      headStartCash: 5_000,
      /** Crusher parts x (1 + this). */
      partsHoarderBonus: 0.5,
      /** Crew work rates x (1 + this); the Salesperson's delay / (1 + this). */
      masterCrewSpeed: 0.3,
      /** Haggle perfect zone x (1 + this). */
      silverTongueZone: 0.3,
      /** Buyer gaps (yard) and walk-up intervals (lot) / (1 + this). */
      regularsRate: 0.25,
      /** Auction prices x (1 - this). */
      insiderDiscount: 0.1,
      /** Business open costs x (1 - this). */
      franchiseDiscount: 0.25,
      quickTipsSeconds: 1,
      /** Rare, Epic and Legendary arrival weights x this. */
      rareFindsMult: 1.3,
      /** Barn: time to the next find / this; stage times x (1 - barnScoutStage). */
      barnScoutFind: 2,
      barnScoutStage: 0.2,
      nightShiftSeconds: 2 * 60 * 60,
    },
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
