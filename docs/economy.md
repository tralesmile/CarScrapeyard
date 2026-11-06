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
| Used Car Lot | $5M | $2.5M | open (P1.2b, run 14) |
| Paint & Tuning | $50M | $25M | core rules done (P1.2d, run 16); scene next (P1.2e), still "soon" on the map |

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

## Used Car Lot (P1.2a, run 14)

Buy at the auction board, refurbish, sell. Retail = $35,000 x (family base value / 600) x Showroom (1.08^(level-1)).

| Condition | Auction price (x retail) | Refurbish work | Board weight |
| --- | --- | --- | --- |
| 1 Rough | 0.30 | 36 | 2 |
| 2 Tired | 0.42 | 26 | 3 |
| 3 Fair | 0.54 | 18 | 3 |
| 4 Good | 0.66 | 11 | 2 |
| 5 Mint | 0.78 | 5 | 1 |

- 3 lots on the board, 45 s each, an empty slot refills in 4 s. Forecourt spots 2 -> 4 ($2.5M, $20M).
- Work per tap = 1 x Valet Bay power (station curve). Walk-up buyer every 6 s while a car is ready (list price);
  a manual sale always haggles (0.9x-1.3x).
- Lifetime earnings count the profit only (sale minus auction price).
- Valet Bay $250K x1.17^n, Showroom $1.2M x1.35^n. Detailer $3M (1.5 work/s x Valet power, offline), Auction Agent $6M
  (bids on the best profit per work when cash >= 2x the price). Offline needs both: profit per car over
  max(refurbish time, buyer interval), with the yard's 50% efficiency and 2 h cap.

Walk-up buyer types (P1.2c): a buyer arrives 3.5 s into the 6 s wait and looks the car over for 2.5 s, then pays
list x (1 + bonus) for a car they like. They choose the waiting car with the biggest bonus.

| Buyer | Likes | Bonus | Weight | Shows up after |
| --- | --- | --- | --- | --- |
| Family | sedan, van, SUV | +15% | 3 | 0 yard sales |
| Collector | bought Good or Mint (condition >= 4) | +30% | 2 | 0 |
| Speed Freak | muscle, sports, hyper | +20% | 2 | 0 |
| Tradie | pickup, van | +20% | 2 | 20 |
| Influencer | sports, hyper | +40% | 1 | 100 |

Idle and offline income use the average multiplier (every buyer type by weight x every unlocked family x the board's
condition mix), about x1.06-1.09. Run 15 sim: lot profit by 2 h $83.6M -> $84.8M active (55%), $25.0M -> $25.7M relaxed
(35%): active bots haggle most sales by hand, so the bonus mostly helps idle play. No other milestone moved.

Run 14 sim (120 minutes, `Used Car Lot (P1.2a)`): retailBase $90K first gave the lot 81% of all earnings ($434M by 2 h),
far too strong; $45K 61%, $35K 55% (chosen), $28K 48%. With $35K the active bot reaches the goal at 39m30s, opens at
45m30s, hires the Detailer at 50m and the Agent at 58m, the lot makes 55% of earnings by 2 h and Paint & Tuning's $50M
goal arrives at 1h22m (relaxed: opens 52m43s, 34%, goal 1h45m). The garage keeps 17% (relaxed 25%). Asserted: opens
between 30 and 75 min, lot share 15-65%, garage share > 5%.

## Paint & Tuning (P1.2d, run 16)

Customers order 1-3 different services (sizes by weight 3 / 3 / 1), worked one after another in menu order.
Fee = $55,000 x sum of the services' fee multipliers x (1 + 15% per service beyond the first) x (family base value / 600)
x Hype (1.10^(level-1)), fixed on arrival. Leftover tap work does not carry into the next service.

| Service | Work | Fee mult | Weight |
| --- | --- | --- | --- |
| Respray | 8 | 1.0 | 3 |
| Custom rims | 6 | 0.8 | 3 |
| Vinyl wrap | 12 | 1.5 | 2 |
| Engine tune | 16 | 2.2 | 1.5 |

- A new customer every 4 s while a booth is free. Booths 1 -> 3 ($25M, $200M).
- Tip: +25% of the fee when the player finishes the order by hand within 3 s per service of the car arriving
  (the Painter never earns tips). Active bot: 538 of 708 orders tipped; relaxed bot (2 taps/s): 84 of 288.
- Spray Booth $3M x1.17^n (work per tap and Painter speed, station curve), Hype $6M x1.35^n.
  Painter $60M (1.2 work/s x booth power), works offline with the yard's 50% efficiency and 2 h cap; no tips idle.
- Idle income = expected fee / cycle, where the expected order is enumerated exactly over the weighted draw
  (unit test: within 4% of 4,000 generated orders).

Run 16 sim (180 minutes, `Paint & Tuning (P1.2d)`, shop forced `ready`): baseFee $90K gave the shop 52% of all earnings
by 3 h, $70K 46%, $55K 41% (chosen; relaxed 29%). The active bot reaches the $50M goal at 1h22m, opens at 1h35m and
hires the Painter at 2h0m; the lot keeps 20% (relaxed 21%). Asserted: opens between 70 and 140 min, shop share 12-60%,
lot share > 10%, some but not all orders tipped. The bot buys only the cheapest upgrade each time, so it rarely buys Hype
or a second booth in this window; that is a bot habit, not a price problem.

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
| Used Car Lot opened ($2.5M) | 30-75 min | 45m 30s | 52m 43s |
| Lot share of earnings at 2 h | 15-65% | 55% | 35% |
| Paint & Tuning goal ($50M) | - | 1h 22m | 1h 45m |
| Paint & Tuning opened ($25M) | 70-140 min | 1h 35m | 2h 7m |
| Paint share of earnings at 3 h | 12-60% | 41% | 29% |

The bots claim every finished contract, crush an unfinished wreck when a crush order is open or the barn needs
parts, and save up for the next barn stage once the crew is hired.
Bot tapping is deterministic (no `Math.random`), so the same code always prints the same timeline.

Bots are faster than first-time humans (no reading, perfect swipes), so bot times sit at the low end on purpose.

## Map tiers (P1.1d, run 13)

Cosmetic only (no income effect): `ECON.businesses.tiers` gives the size for tier 2 and 3. Scrapyard: lot slots 3 / 4
(slot 3 costs $150K, slot 4 $900K, so tier 2 lands around the garage opening and tier 3 later in the first hour).
Garage: repair bays 2 / 3. Shown as stars on the map so buying slots and bays has a visible reward on the map too.
