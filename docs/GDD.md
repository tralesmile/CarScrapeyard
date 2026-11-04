# Game design summary

Full design lives in the master plan: https://claude.ai/artifact/BNiKw18kSChwfuMPPHGJGS
This file records what is actually built and any decisions that differ from the plan.

## Pitch

You inherit Grandpa Joe's rusty scrapyard. Pressure-wash and fix wrecks, sell them, hire a crew
to automate it, open new car businesses, then sell your empire and start again in a new city, stronger.

## Built so far (prototype, Rust Valley scrapyard)

- **Core loop:** a wreck drives in → swipe to pressure-wash (the mud really erases under your finger)
  → tap to repair (rust fades, sparks) → Sell button → coins fly to the cash counter.
- **Upgrades:** Wash Bay (wash power), Repair Bench (repair power), Junk Supplier (car value).
  Buy x1, x10 or Max. Wash/Repair double at levels 10, 25, 50, 100, 200.
- **Crew:** Mechanic (auto-repair), Washer (auto-wash), Salesperson (auto-sell). Each works one car at a time.
- **Lot Space:** up to 4 cars in the yard at once; tap a car in the top row to work on it.
- **Cars:** 4 body families (sedan, hatchback, pickup, muscle), 10 paints, 4 rarities
  (Common, Rare, Epic, Legendary at 0.5% — the "barn find"). Rare+ cars get trim stripes.
- **Offline earnings:** with the full crew hired, the yard earns while you're away
  (50% rate, up to 2 hours). Shown in a "Welcome back" popup; kept in the save until collected.
- **First session:** Grandpa Joe's note, hints for wash → repair → sell → first upgrade → hire a Mechanic.

## Decisions

- First 5 cars are always Common so the tutorial pacing is predictable.
- UI is DOM over the Phaser canvas (crisp text, accessibility, translation).
- Phaser 3.90 for now (stable, well known); Phaser 4 upgrade is a later decision.
