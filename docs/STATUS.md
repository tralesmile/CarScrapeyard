# Status

Last updated: 2026-11-05 (run 2; next run is run 3)

Current phase: **Phase 0 — Prototype** (plan: prototype → web MVP → mobile soft launch → global launch → live ops).

Work rules: take the next unchecked tasks in order. Each run should finish 1–3 tasks completely
(code + tests + e2e + docs) rather than start many. Keep the build green.

## Phase 0 — Prototype (scrapyard)

- [x] P0.1 Project scaffold: Vite + TypeScript + Phaser 3, docs, CLAUDE.md
- [x] P0.2 Core engine: state, actions, formulas, seeded RNG, fixed-step simulation, offline earnings, clock-safety
- [x] P0.3 Save system: two rotating slots, checksum, versioning + migrations, defaults for missing fields, sanity checks
- [x] P0.4 Playable loop: pressure-wash reveal (real erase), tap to repair (sparks, rust), sell with coin burst
- [x] P0.5 Upgrades (x1/x10/Max), milestones, crew (mechanic, washer, salesperson), lot slots, welcome-back popup
- [x] P0.6 Tutorial hints, Grandpa Joe intro, synthesised sound, browser e2e test, balance simulator
- [x] P0.7 CI: GitHub Actions runs typecheck + tests + build on every push (first run green). PR #1 dev → main is open.
- [x] P0.8 Car crusher: crush a wreck for Parts (new currency) with heavy animation; parts reduce repair time
- [x] P0.9 Contracts board: 3 timed orders ("sell 3 pickups in 10 min") with cash/parts rewards
- [ ] P0.10 Haggle mini-game on manual sales (timing slider, 0.9x–1.3x)
- [ ] P0.11 Customer personalities (Bargain Hunter, Collector, Speed Freak, Family): buyer-match bonus
- [ ] P0.12 Barn find + restoration project: covered car at the back of the yard, multi-stage restore, reveal
- [ ] P0.13 Settings sheet: sound, music, reduce motion, number format, reset progress (with confirm), credits
- [ ] P0.14 Juice pass: haptics (navigator.vibrate), better car art (rounded bodies, antialiasing), more car families (SUV, van, sports, hyper)
- [ ] P0.14b Crusher upgrades: faster press / more parts per crush; a "Scrapper" crew member who auto-crushes when the lot is full (found in run 2)
- [ ] P0.14c Contracts polish: one free reroll per order; let timers run offline once push notifications exist (found in run 2)
- [ ] P0.15 Playtest gate: owner plays 15+ minutes; collect feedback in NEEDS_FROM_YOU

## Phase 1 — Web MVP

- [ ] P1.1 Business framework: multiple businesses per city with a switcher/map; Business 2 Repair Garage
- [ ] P1.2 Business 3 Used Car Lot (buy at auction, refurbish, sell) and Business 4 Paint & Tuning
- [ ] P1.3 Prestige "Sell Empire" → Legacy Points + Legacy tree; city 2 Motor City
- [ ] P1.4 Collection book (40 cars, sets, rarity badges), mastery
- [ ] P1.5 Daily tasks + 7-day login calendar (UTC reset hour), achievements
- [ ] P1.6 Story chapter 1 + rival Vince Valvano
- [ ] P1.7 Gems (soft premium) + Auction Tokens (earn-only); shop UI stub
- [ ] P1.8 Music layers per business; volume settings
- [ ] P1.9 i18n string files (English first)
- [ ] P1.10 PWA: manifest, icons, service worker, offline play
- [ ] P1.11 Analytics adapter (event taxonomy from the plan; no-op until accounts exist)
- [ ] P1.12 Portal adapters: Poki and CrazyGames SDK wrappers behind the platform interface
- [ ] P1.13 Deploy web build (Cloudflare Pages) — needs owner account
- [ ] P1.14 Gate: D1 ≥ 35%, session ≥ 8 min

## Phase 2 — Mobile soft launch

- [ ] P2.1 Capacitor Android + iOS projects; safe areas; back button; haptics plugin
- [ ] P2.2 AdMob rewarded ads adapter (double offline, 2x boost)
- [ ] P2.3 RevenueCat purchases: starter pack, remove ads, gem packs, VIP
- [ ] P2.4 Firebase: anonymous auth, cloud save + conflict screen, server time, purchase validation
- [ ] P2.5 Push notifications (garage full, offline cap reached)
- [ ] P2.6 Store assets: icon, screenshots, preview video script, store text
- [ ] P2.7 Privacy policy, terms, data safety and age-rating answers

## Phase 3+ — Global launch and live ops

See the master plan.
