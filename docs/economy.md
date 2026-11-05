# Economy

Source of truth: `src/core/config.ts` (`ECON`). This page explains the numbers; keep both in sync.

## Formulas

- Upgrade cost: `baseCost × growth^(level − 1)`
- Station power (wash, repair): `(1 + 0.15 × (level − 1)) × 2^(milestones reached)`, milestones 10, 25, 50, 100, 200
- Car value: `familyBase × rarityMult × 1.08^(junkSupplierLevel − 1) × (0.9 … 1.1)`
- Idle income: pipeline throughput (slowest stage, limited by slots / full cycle) × expected car value
- Offline: `idle income × min(seconds away, 2 h) × 50%`

## Current numbers

| Item | Value |
| --- | --- |
| Wash Bay | base $150, growth 1.14 |
| Repair Bench | base $200, growth 1.14 |
| Junk Supplier | base $900, growth 1.22, value x1.08 per level |
| Mechanic / Washer / Salesperson | $9,000 / $25,000 / $75,000 |
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

## Contracts

| Item | Value |
| --- | --- |
| Unlock | 45 cars sold; 3 orders on the board |
| Timer | 10 min (game time); new order 45 s after claim or expiry |
| Reward | expected car value x target x (sell any 0.4, body type 0.9, Rare+ 2.5, crush 0.7) |
| Sizes | sell any 6-10, body type 2-4, Rare+ 1-2, crush 2-4 (+4 parts per crushed car) |
| Share of income | must stay under 30% of first-15-minute earnings (sim: 17% active, 26% relaxed) |

## Pacing targets (checked by `npm run sim`)

| Milestone | Target | Active bot | Relaxed bot |
| --- | --- | --- | --- |
| First sale | < 45 s | 3 s | 6 s |
| Mechanic hired | 2-3 min (bot is faster than a human) | 1m 15s | 1m 58s |
| Crusher unlocks | about 3 min | 2m 13s | 3m 21s |
| Contracts unlock | about 5 min | 3m 58s | 5m 57s |
| Washer hired | - | 4m 20s | 6m 26s |
| Salesperson hired (full automation) | < 15 min for active players | 10m 38s | 14m 1s |

The bots claim every finished contract and crush a fresh wreck when a crush order is open.
Bot tapping is deterministic (no `Math.random`), so the same code always prints the same timeline.

Bots are faster than first-time humans (no reading, perfect swipes), so bot times sit at the low end on purpose.
