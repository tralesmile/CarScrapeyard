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
| Paint & Tuning | $50M | $25M | open (P1.2e, run 17); lot cars through the shop (P1.2f, run 18) |

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

## Lot cars through the shop (P1.2f, run 18)

A refurbished Used Car Lot car can take a free paint booth for one service that suits its family (sedan and van:
respray; hatch, pickup and SUV: rims; sports: wrap; muscle and hyper: engine tune). The shop charges nothing and pays
nothing; the car's sticker price goes up by the shop's fee for that service (Hype included, no combo, no tip) x
`valueMult`, fixed when the car drives in. Walk-up buyer bonuses and haggling then apply to the whole sticker; only the
profit counts as earnings. Once per car. The Painter works lot cars like any order; crews never send cars on their own.

Run 18 sim (`sending lot cars through the shop`, 180 minutes, active bot that sends a ready lot car into every free
booth vs the same bot without): valueMult 0.6 -> lifetime -4% (the booth time is worth more on customers), 0.8 -> +3%,
1.0 -> +8% (chosen: $387M vs $357M; 788 lot cars tuned, lot profit $72M -> $172M, paint fees $147M -> $72M). So it is
a real choice between tipped customers and a fatter sticker, not a new economy. Asserted: lifetime +1% to +15%.

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
| Lot cars through the shop (active bot that always sends) | +1% to +15% lifetime at 3 h | +8% | - |

The bots claim every finished contract, crush an unfinished wreck when a crush order is open or the barn needs
parts, and save up for the next barn stage once the crew is hired.
Bot tapping is deterministic (no `Math.random`), so the same code always prints the same timeline.

Bots are faster than first-time humans (no reading, perfect swipes), so bot times sit at the low end on purpose.

## Map tiers (P1.1d, run 13)

Cosmetic only (no income effect): `ECON.businesses.tiers` gives the size for tier 2 and 3. Scrapyard: lot slots 3 / 4
(slot 3 costs $150K, slot 4 $900K, so tier 2 lands around the garage opening and tier 3 later in the first hour).
Garage: repair bays 2 / 3. Shown as stars on the map so buying slots and bays has a visible reward on the map too.

## Prestige (P1.3a)

| Item | Value |
| --- | --- |
| Legacy Points (total) | `floor((all-time earnings / $28M) ^ 0.8)` since run 27 (was `floor(sqrt(all-time / $5M))`); 10 points at ~$498M, 20 at ~$1.19B, 50 at ~$3.7B |
| Sale offered | new points >= 10; glows when new points >= 50% of owned points |
| Income bonus | `1 + 0.02 x points`, applied where values are made: yard car value, Scrapper scrap cash, contract rewards, barn sale value, garage fees, paint fees and lot tune stickers, lot auction **and** list prices (so lot profit scales by the same factor), and every idle/offline rate |
| Kept on a sale | points, settings, tutorial, collection, stats, clock, RNG |

Run 19 sim (`Sell Empire` in balance.test.ts): active bot offered the sale at 3h28m, relaxed at 4h20m (7 h: $2.44B and
$1.75B lifetime). After selling at 12 points (x1.24) the same bot opens the garage 13m02s (13m27s), lot 39m32s
(45m39s) and paint 1h19m (1h35m); its next sale (10 more points, $2B in total) comes at 4h43m. The tree (P1.3c) and
city 2 (P1.3d) should make later runs faster; check the second-run time again then.

## Legacy tree (P1.3c)

Bought with free Legacy Points (points earned minus points spent); the income multiplier always counts points earned.
Nodes are bought in order per branch for 2 / 3 / 5 / 8 points (54 for all twelve). One free respec per empire.
All numbers are in `ECON.legacy.tree`.

| Branch | Node (cost) | Effect |
| --- | --- | --- |
| Mechanic | Quick Hands (2) | tap work x1.25 in every business (yard wash and repair, garage, lot, paint) |
| | Head Start (3) | each new empire starts with $5K (a gift: not counted as earnings) and the Mechanic hired |
| | Parts Hoarder (5) | crusher parts x1.5 (also the Scrapper, online and offline) |
| | Master Crew (8) | Washer, Mechanic, Foreman, Detailer, Painter rates x1.3; Salesperson delay / 1.3 |
| Dealer | Silver Tongue (2) | haggle PERFECT half-width 0.12 -> 0.156 (the slider draws it) |
| | Regulars (3) | yard buyer gap and lot walk-up interval / 1.25 (6 s -> 4.8 s; the 2.5 s look stays) |
| | Insider (5) | auction prices x0.9 (also in the lot's idle profit) |
| | Franchise (8) | business open costs x0.75 |
| Racer | Quick Tips (2) | paint tip window +1 s per service |
| | Rare Finds (3) | Rare/Epic/Legendary weights x1.3 (non-Common share 22% -> 26.8%; expected yard value used by idle income) |
| | Barn Scout (5) | next barn find 300 s -> 150 s; stage times x0.8 |
| | Night Shift (8) | offline cap 2 h -> 4 h in every business |

Run 21 sim (`Legacy tree` in balance.test.ts): the active bot sells at its first offer (10 points, x1.20), buys 10 points of one branch, then plays 4 hours. Lifetime at 4 h: none $1.04B, Mechanic (Quick
Hands, Head Start, Parts Hoarder) $1.10B (+6%), Dealer (Silver Tongue, Regulars, Insider) $1.11B (+7%), Racer (Quick
Tips, Rare Finds, Barn Scout) $1.16B (+12%). Rare Finds was x1.5 in the design draft; at x1.5 Racer was +19%, so it was
cut to x1.3. Every branch opens the paint shop no later than without the tree; the test caps a branch at +60%.


## Cities (P1.3d1, run 23)

| City | Scale | Opens | Notes |
| --- | --- | --- | --- |
| Rust Valley | x1 | the start | the tuned base game |
| Motor City | x3 (x5 until run 27) | can be picked from the 2nd empire sale | every value and every price x3 |

`ECON.cities.list`. A city's `scale` multiplies **every value** (`incomeMultiplier = legacyMultiplier x scale`, used at
all the call sites that used the Legacy multiplier) **and every price**: upgrade, slot, bay, spot and booth costs (a
required `scale` argument, so the compiler finds every caller), crew hires (`managerCost`, `foremanCost`,
`lotCrewCost`, `painterCost`), business open costs and unlock goals (`unlockGoal`), barn stage cash, Head Start cash
(and the save's sanity allowance for it). Pacing inside a run is therefore the tuned one; what changes is that
Legacy Points count real dollars, so a bigger city earns them faster (x5 earnings ~ x2.2 points).

Run 23 sim (`Motor City` in balance.test.ts, active bot): 1st empire offered the sale at 3h28m, 2nd (x1.20) at 4h43m.
Third empire from the same state: in **Rust Valley** paint opens at 1h07m and no sale is offered within 5 h (9 points
waiting; $2.28B); in **Motor City** paint opens at 1h07m too, the sale is offered at **2h28m** and 5 h earn $11.8B
(x5.19) with 32 points waiting. x10 offered it at 1h51m (51 points at 5 h: too generous), x4 at 2h47m, x6 at 2h20m.
Finding: without a new city the 2nd and 3rd empires get *slower* (each sale needs 20P + 100 more points-squared), so the
city is what keeps prestige moving. Tests: Motor City's lifetime is x scale ±15% of Rust Valley's, paint opens within
15 min of it, and its sale comes before the first Rust Valley run's and after 1.5 h.

## Point curve follow-up (P1.3d4, run 27)

Problem: on the square-root curve each sale needs 10 more points, and the earnings for them grow with the points
already owned ((P+10)^2 - P^2), while income grows only 2% per point. The 2nd empire (still in Rust Valley) was offered
its sale at 4h47m, an hour later than the first (3h28m): the first prestige felt like a step back.

Fix: a softer curve, `points = floor((all-time / pointScale) ^ pointExponent)` with exponent 0.8 and pointScale $28M
(the first sale still comes at ~$500M), and Motor City cut from x5 to x3 so its points per hour stay about the same
(x5 at 0.5 gave 5^0.5 = 2.24x points; x3 at 0.8 gives 3^0.8 = 2.41x). No save migration: any save that owned points
had >= $500M all-time, where the new curve is worth at least as many points (unit-tested).

Sim, active bot selling at each offer (Rust Valley, then Motor City from the 2nd sale), sale offered at:

| Curve | 1st | 2nd | 3rd | 4th | 5th | 6th |
| --- | --- | --- | --- | --- | --- | --- |
| sqrt, MC x5 (before) | 3h28m | 4h47m | 2h34m | 2h37m | 2h33m | |
| ^0.667, MC x5 | 3h28m | 3h50m | 1h48m | 1h44m | 1h36m | |
| ^0.75, MC x3 | 3h28m | 3h33m | 2h00m | 1h53m | 1h43m | 1h37m |
| **^0.8, MC x3 (chosen)** | 3h27m | 3h23m | 1h56m | 1h44m | 1h35m | 1h27m |
| sqrt, +3%/+4%/+5% per point | 3h28m | 4h25m / 4h10m / 3h52m | | | | |

A bigger income bonus per point barely moves the 2nd empire (+5% per point still 3h52m) and makes Motor City runs
much shorter, so the curve was the right lever. Test: every empire is offered its sale no later than the one before
(+1 min slack), the 2nd under 3.5 h, the 6th still over an hour. Long-term, points grow faster than on the square
root ($100B all-time: ~695 points on ^0.8 vs 141 on sqrt), so later cities should use bigger scales or a bigger
point divisor; revisit when city 3 is designed.

## Collection book (P1.4a, run 27)

All numbers in `ECON.collection`. Bonuses are permanent (the book is kept on a sale) and multiply a yard car's value
when it arrives (`collectionValueMult`), and the yard's idle income through the average over the family's four models.

| Item | Value |
| --- | --- |
| Entries | 48: 32 yard models (`MODEL_NAMES`, 4 per family) + 16 barn classics (`CLASSIC_NAMES`) |
| Family set (8) | all 4 models of a family sold once: +5% that family's yard value |
| Brand set (4) | the brand's model in every family (8): +5% that brand's yard value |
| Barn Classics (1) | all 16 classics restored and sold: +25% barn sale value |
| Mastery | stars at 10 / 50 / 200 sales of a model, +1% that model's value per star (max +3%) |

Max yard bonus on one model: +5% family +5% brand +3% mastery = +13%. Sim (active bot, first empire): sale offered
3h27m (unchanged), 2nd empire 3h15m (was 3h23m without the book), garage opens 14m16s avg over 12 seeds. The lot-tune
A/B (P1.2f) moved from x1.08 to x1.17 on seed 12345; over seeds 12345/1/2/3 it is 1.10-1.19 with the book vs
1.09-1.11 without, so the test now averages three seeds (x1.13, cap x1.15).

## Daily tasks and calendar (P1.5a, run 29)

All numbers in `ECON.daily`. A reward of N cars = `roundNice(expectedCarValue x N x incomeMultiplier)` at claim time.

| Item | Value |
| --- | --- |
| Unlock | 80 sales (or any later empire) |
| Reset | 04:00 UTC, `gameDay(max(now, lastSeen))` |
| Tasks (target, reward) | sell 40 (12 cars), haggle 6 (10), buyers 8 (10), crush 12 (8 + 15 ⚙), jobs 3 (14), garage 25 (14), lot 8 (16), paint 10 (16) |
| All three claimed | +20 cars |
| Calendar days 1-7 | 5, 8 (+10 ⚙), 10, 12 (+20 ⚙), 15, 20 (+30 ⚙) cars, then an Epic gift car |

A full day (tasks, bonus, calendar) pays roughly 60-75 average cars: a few minutes of active yard income once the crew
is hired, so it is a nudge to come back, not an economy of its own. The bots do not claim dailies, so `npm run sim`
is unchanged.

## Showcase (P1.4c, run 29)

Keep a revealed barn classic instead of selling it: no cash; `ECON.collection.showcaseBonus` (+0.5%) per classic on
every payout (`showcaseMultiplier`, part of `incomeMultiplier`), one per model, kept on a sale; 16 max = +8%.

| Bonus per classic | First empire, sale offered (seed 12345 / 7), sell vs keep | Kept by the offer |
| --- | --- | --- |
| +1% (draft) | 3h27m vs 3h25m / 3h29m vs 3h29m | 11 / 12 (x1.11-1.12) |
| **+0.5%** | 3h27m vs 3h28m / 3h29m vs 3h30m | 10 / 11 (x1.05) |

At +1% keeping was never slower even in the first empire, so it was not a choice. At +0.5% it costs ~1 minute now
($34.7M of barn sales over 16 restorations) for +5% in every later empire. Balance test: keeping moves the first
sale by 0.98-1.05x.


## Achievements (P1.5c, run 30)

All numbers in `ECON.achievements`. 14 awards x 4 medals; a medal pays `carsWorth(rewardCars[tier])` at claim time
(the same "N average yard cars" as the dailies, so it scales with Legacy and the city).

| Award | Bronze / Silver / Gold / Diamond |
| --- | --- |
| Sell yard cars | 25 / 250 / 2,500 / 25,000 |
| Earn in total (all empires) | $100K / $10M / $1B / $100B |
| Crush cars | 10 / 100 / 1,000 / 5,000 |
| Perfect haggles | 5 / 50 / 250 / 1,000 |
| Serve buyers | 10 / 100 / 1,000 / 5,000 |
| Finish orders | 5 / 50 / 250 / 1,000 |
| Find Legendary cars | 1 / 10 / 50 / 200 |
| Restore barn classics | 1 / 5 / 20 / 50 |
| Garage repairs | 50 / 500 / 5,000 / 25,000 |
| Sell lot cars | 10 / 100 / 1,000 / 5,000 |
| Paint shop orders | 25 / 250 / 2,500 / 10,000 |
| Cars in the book | 8 / 16 / 32 / 48 |
| Sell your empire | 1 / 3 / 10 / 25 |
| Daily rewards claimed | 3 / 7 / 30 / 100 |

Reward per medal (cars): A/B with an active bot that claims every medal at once vs one that never claims, first empire,
sale offered at (seed 12345 / 7):

| rewardCars | Without | Claiming | Medals by the offer | Share of earnings | First 30 min |
| --- | --- | --- | --- | --- | --- |
| 5/10/20/40 (draft) | 3h27m / 3h29m | 3h21m / 3h20m | 26 | 0.43% | 12 medals, 4.7% |
| **3/6/12/24** | 3h27m / 3h29m | 3h25m / 3h25m | 26 | 0.24% | 12-13 medals, 3.4-4.8% |
| 2/4/8/16 | 3h27m / 3h29m | 3h23m / 3h29m | 26 | 0.17% | 11-12 medals, 2.4% |

The early medals land when income is small, so they compound: the draft moved the first sale 3-4%. 3/6/12/24 keeps
it at 1-2% while a new player still sees a dozen medals in the first half hour. Balance test: claiming moves the first
sale by 0.97-1.0x, under 2% of earnings in total and under 6% in the first 30 minutes.

## Story and Vince (P1.6a, run 31)

No economy change. Vince Valvano only relabels events that already happen: lots that leave the auction board unsold
(the first one, then every 3rd by lot id) and yard customers who run out of patience (every 3rd). Nothing is taken
from the player and no RNG draw is added (`noteLotLost`/`noteBuyerLost` count with plain counters), so the seeded
sims and the pacing targets are untouched; `npm run sim` was not needed. If Vince becomes a real rival (owner
question), A/B it like the showcase: a bot run with and without, time to the first Sell Empire.
Chapter 2 (P1.6b, run 32) adds scenes and the map HQ only; still no economy change and no sim run needed.

## Wallet (P1.7a, run 33)

Gems and Auction Tokens never change cash income, so `npm run sim` pacing is unchanged. Income per source is in
`ECON.wallet`: medals 0/1/3/8 gems (a full set of 14 awards = 168 gems), all-dailies bonus 3 gems + 2 tokens, task 1
token (so a full day = 5 tokens and 3 gems), a calendar week = 22 gems + 7 tokens (10 of the gems on day 7).
Price points for the shop (P1.7b) must come from these numbers: a daily player earns about 3 gems and 5 tokens a day.
