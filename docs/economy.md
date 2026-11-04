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

## Pacing targets (checked by `npm run sim`)

| Milestone | Target | Active bot | Relaxed bot |
| --- | --- | --- | --- |
| First sale | < 45 s | 3 s | 5 s |
| Mechanic hired | 2–3 min (bot is faster than a human) | 1m 16s | 1m 49s |
| Washer hired | — | 4m 10s | 6m 7s |
| Salesperson hired (full automation) | < 15 min for active players | 11m 22s | after 15 min |

Bots are faster than first-time humans (no reading, perfect swipes), so bot times sit at the low end on purpose.
