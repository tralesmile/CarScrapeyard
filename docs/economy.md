# Economy

Source of truth: `src/core/config.ts` (`ECON`). This page explains the numbers; keep both in sync.

## Formulas

- Upgrade cost: `baseCost × growth^(level − 1)`
- Station power (wash, repair): `(1 + 0.15 × (level − 1)) × 2^(milestones reached)`, milestones 10, 25, 50, 100, 200
- Car value: `familyBase × rarityMult × 1.08^(junkSupplierLevel − 1) × (0.9 … 1.1)`
- Idle income: pipeline throughput (slowest stage, limited by slots / full cycle) × expected car value
- Offline: `idle income × min(seconds away, 2 h) × 50%`
- Offline Scrapper (full crew + Scrapper): tops parts up to its target, at most `floor(counted seconds / (8 s rest + 2.5 s arrival))`
  crushes, where counted seconds = `min(away, 2 h) × 50%`; each pays Common parts and 15% of an expected Common car as scrap
  cash (added to the offline cash). Crushed cars are not subtracted from offline sales (at most a handful out of thousands).

## Current numbers

| Item | Value |
| --- | --- |
| Wash Bay | base $150, growth 1.14 |
| Repair Bench | base $200, growth 1.14 |
| Junk Supplier | base $900, growth 1.22, value x1.08 per level |
| Mechanic / Washer / Salesperson | $9,000 / $30,000 / $90,000 |
| Lot slots 2 / 3 / 4 | $20,000 / $150,000 / $900,000 |
| Manual wash | 1/2000 dirt per design pixel swiped (about 2–4 s of swiping) |
| Manual repair | 0.2 damage per tap (about 3–5 taps) |
| Arrival interval | 2.5 s when a slot is free |
| Rarity weights | Common 78, Rare 17 (x2.5), Epic 4.5 (x6), Legendary 0.5 (x20) |

## Crusher and parts

| Item | Value |
| --- | --- |
| Unlock | 25 cars sold |
| Parts per crush | Common 6, Rare 10, Epic 16, Legendary 30 |
| Scrap cash | 15% of the car's value |
| Cooldown | 3 s |
| Spare parts | 2 parts on wash completion halve the remaining damage |
| Hydraulic Press (upgrade) | base $1,500, growth 1.35; cooldown `3 s / (1 + 0.15 × (level − 1))`, floor 1.2 s (the press animation); parts +10% of base per level |
| Scrapper (crew) | $40,000; while parts < max(10, next barn stage's parts) it crushes the newest untouched Common wreck, then rests 8 s |

Run 6 sim: the active bot buys 9 press levels in 15 min (16 in 30) and hires the Scrapper at 22m18s; over 30 minutes
the Scrapper crushes 15 wrecks out of ~560 cars (3%), keeping parts stocked for two barn restorations. First-15-minute
pacing is unchanged (Salesperson 9m01s, barn sold 13m24s, barn share 20%).

## Contracts

| Item | Value |
| --- | --- |
| Unlock | 45 cars sold; 3 orders on the board |
| Timer | 10 min (game time); new order 45 s after claim or expiry |
| Reward | expected car value x target x (sell any 0.4, body type 0.9, Rare+ 2.5, crush 0.7) |
| Sizes | sell any 6-10, body type 2-4, Rare+ 1-2, crush 2-4 (+4 parts per crushed car) |
| Swap | one free swap per order: a different order with a fresh 10-min timer (progress resets); the new order can't be swapped |
| Share of income | must stay under 30% of first-15-minute earnings (sim: 18% active, 25% relaxed) |

## Haggle

| Item | Value |
| --- | --- |
| Range | x0.9 (bar edge) to x1.3 (centre); PERFECT zone = middle 12% of the bar |
| When | manual sales only: the 2nd sale ever (lesson: slow needle, at least x1.2), Rare+ cars, buyer matches |
| Needle | 0.9 sweeps/s (lesson 0.45); closes at x1 after 4 s untouched |

## Car families

| Family | Base value | Arrival weight | Starts arriving after |
| --- | --- | --- | --- |
| Sedan / Hatchback / Pickup / Muscle | $420 / $360 / $520 / $680 | 1 each | first car |
| Van | $460 | 1 | 15 sales (~1 min) |
| SUV | $600 | 1 | 40 sales (~3 min) |
| Sports Car | $950 | 0.5 | 100 sales (~6-8 min) |
| Hypercar | $1,800 | 0.2 | 200 sales (~13 min, active player) |

Expected car value (contract rewards, barn prices, idle income) is the weighted average over the families
unlocked so far, so rewards grow as new families arrive. "Sell N of a family" orders only ask for unlocked
families with weight 1 (no orders for 3 Hypercars). Run 5 sim: active Salesperson 8m07s -> 9m01s, relaxed
12m18s -> 12m45s (bots crush more, and more varied cars), barn share 23% -> 21% after the x55 sale price.

## Customer personalities

| Buyer | Wants | Bonus |
| --- | --- | --- |
| Bargain Hunter | Hatchback | +15% |
| Collector | Rare, Epic or Legendary | +40% |
| Speed Freak | Muscle, Sports Car, Hypercar | +25% |
| Family | Sedan, Van, SUV | +20% |
| Tradie (after 20 sales) | Pickup | +20% |
| Influencer (after 100 sales) | Sports Car, Hypercar | +50% |

Skip haggling (setting) sells at the asking price without the slider (the one-time lesson still plays).
Run 7: a 12-seed sim (`many seeds`) is the real pacing check: active Salesperson avg 9m52s (worst 10m57s), barn share
avg 18% (max 24%) after the barn sale went x55 -> x50; seed 12345 alone read 25.2%.

Unlock after 10 sales. One buyer at a time, waits 75 s, next buyer 8 s after one leaves or is served.
Bonuses apply to crew sales too and stack with haggle. Sim limit: manual haggle + buyer bonus < 15% of
first-15-minute earnings (active 12%, relaxed 8%). The active bot lands x1.2 haggles, the relaxed bot x1.05.

## Barn find

| Item | Value |
| --- | --- |
| Unlock | 60 cars sold |
| Stages (cash = expected car value x) | Tow 2x / 20 s · Engine 4x + 6 parts / 45 s · Body 6x + 12 parts / 60 s · Paint 8x / 90 s |
| Sale | expected car value x 50 at the reveal (2.5x the cash cost; x60 until run 5, x55 in run 6) |
| Growth | +15% cost and value per restoration sold |
| Next find | 5 min after a sale (runs offline) |
| Share of income | sim limit < 25% of first-15-minute earnings (active 21%; relaxed bot reaches stage 3) |

## Businesses (city map)

| Business | Unlock goal (lifetime earnings) | Open cost | Status |
| --- | --- | --- | --- |
| Scrapyard | - | - | open from the start |
| Repair Garage | $200K | $100K | open (P1.1c, run 11) |
| Used Car Lot | $5M | $2.5M | later (P1.2) |
| Paint & Tuning | $50M | $25M | later (P1.2) |

The map button appears after 30 sales (between the crusher at 25 and contracts at 45). Run 10 sim: active bot reaches
the garage goal at 12m35s (seed 12345), 12m12s on average over 12 seeds (worst 13m49s), matching the plan's "second
business within 15 minutes"; the relaxed bot reaches it in its second session. $250K was tried first (13m41s, too close
to 15 min).

Run 11 set the open cost from the sim with the garage loop in the bots: $150K opened it at 16m13s (active), $100K at
14m24s (12-seed average 14m21s, worst 15m18s; the bot finishes a barn restoration already under way first).

## Repair Garage (P1.1c)

Customers drive in one at a time per free bay (every 3 s) with one fault. Tap the car (or let the Foreman work) until
the fault's work is done; the customer pays and leaves. No buying or selling.

| Fault | Work | Fee mult | Yard parts | Weight |
| --- | --- | --- | --- | --- |
| Flat tyre | 3 | 1.0 | 1 | 3 |
| Dead battery | 4 | 1.4 | 1 | 3 |
| Worn brakes | 5 | 1.6 | 2 | 2.5 |
| Rusty exhaust | 6 | 2.0 | 2 | 2 |
| Engine trouble | 10 | 3.5 | 4 | 1 |

- Fee = $2,000 x fault mult x (family base value / 600) x 1.12^(Reputation level - 1), fixed when the car arrives.
- Spare parts from the scrapyard are used when there are enough (and the barn's next stage doesn't need them); without
  them the garage buys parts and a 30% parts bill comes off the fee.
- Work per tap = 1 x Tool Wall power (same curve as the yard stations: +15% per level, x2 at 10/25/50/100/200).
- Tool Wall $15K x1.15^n, Reputation $40K x1.3^n, bays 2 and 3 cost $60K and $600K, Foreman $200K (0.8 work/s x Tool
  Wall power, also offline at the yard's 50% efficiency and 2 h cap; offline the garage always pays the parts bill).

Run 11 sim (40 minutes): the active bot opens at 14m24s, hires the Foreman at 17m10s and the garage makes 35% of all
earnings ($1.90M); the relaxed bot opens at 19m01s (33%). Asserted: open < 18 min, worst seed < 17 min, garage share
between 15% and 60% for the active bot.

## Pacing targets (checked by `npm run sim`)

| Milestone | Target | Active bot | Relaxed bot |
| --- | --- | --- | --- |
| First sale | < 45 s | 3 s | 6 s |
| Mechanic hired | 2-3 min (bot is faster than a human) | 1m 6s | 1m 44s |
| Crusher unlocks | about 3 min | 2m 13s | 3m 21s |
| Contracts unlock | about 5 min | 3m 54s | 5m 56s |
| Washer hired | - | 3m 12s | 6m 14s |
| Barn find opens | after contracts | 5m 15s | 7m 40s |
| Salesperson hired (full automation) | < 15 min for active players | 8m 7s | 12m 18s |
| First barn classic sold | < 15 min for active players | 12m 12s | next session |
| City map opens | between crusher and contracts | 2m 39s | 4m 0s |
| Repair Garage goal ($200K earned) | < 15 min for active players | 12m 35s | next session |
| Repair Garage opened ($100K) | < 17 min for active players (every seed) | 14m 24s | 19m 1s |
| Garage share of earnings at 40 min | 15-60% | 35% | 33% |

The bots claim every finished contract, crush an unfinished wreck when a crush order is open or the barn needs
parts, and save up for the next barn stage once the crew is hired.
Bot tapping is deterministic (no `Math.random`), so the same code always prints the same timeline.

Bots are faster than first-time humans (no reading, perfect swipes), so bot times sit at the low end on purpose.

## Map tiers (P1.1d, run 13)

Cosmetic only (no income effect): `ECON.businesses.tiers` gives the size for tier 2 and 3. Scrapyard: lot slots 3 / 4
(slot 3 costs $150K, slot 4 $900K, so tier 2 lands around the garage opening and tier 3 later in the first hour).
Garage: repair bays 2 / 3. Shown as stars on the map so buying slots and bays has a visible reward on the map too.
