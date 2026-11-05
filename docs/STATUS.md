# Status

Last updated: 2026-11-05 (run 7; next run is run 8). Runs now start every 3 hours.

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
- [x] P0.10 Haggle mini-game on big manual sales (timing slider, 0.9x–1.3x, lesson on the 2nd sale)
- [x] P0.11 Customer personalities (Bargain Hunter, Collector, Speed Freak, Family): buyer-match bonus
- [x] P0.12 Barn find + restoration project: covered car at the back of the yard, multi-stage restore, reveal
- [x] P0.13 Settings sheet: sound, music, reduce motion, number format, reset progress (with confirm), credits
- [x] P0.14 Juice pass: haptics (navigator.vibrate + setting), Canvas 2D car art (rounded, antialiased), 4 new families (van, SUV, sports, hyper) unlocking by sales
- [x] P0.14b Crusher upgrades: Hydraulic Press (faster press, more parts) and the Scrapper crew member who tops up the parts bin (run 6)
- [ ] P0.14j Scrapper polish (found in run 6): offline income ignores the Scrapper; show the press animation for
      auto-crushes of thumbnail cars too, and a small Scrapper character beside the press
- [x] P0.14c Contracts polish: one free swap per order (run 6). Offline contract timers moved to P2.5 (they need push notifications)
- [x] P0.14d Buyers polish: customers drawn as characters that walk in and out; Tradie (pickups) and Influencer (sports/hyper) buyers; "Skip haggling" setting (run 7)
- [x] P0.14e Floating texts overlap when several rewards land at once: they stack now; banners queue (run 5)
- [ ] P0.14f Barn polish: the restored car drives out of the barn into the bay before the reveal; stage art inside the barn (engine hoist, paint booth); keep classics for the Collection book (P1.4) instead of only selling (found in run 4)
- [ ] P0.14g Yard tab now has 4 cards and the barn card sits below the fold on phones: compact cards or a dot on the barn itself (found in run 4)
- [ ] P0.14h Art polish (found in run 5; owner asked for better graphics after the playtest): the big car in the bay still shows slight stair-steps when the 720 px texture
      is scaled down in WebGL (try mipmaps / a texture sized to the bay); hypercar and sports car look alike at thumbnail
      size (give the hyper a distinct silhouette or a rear fin); paint the backdrop hills and barn on Canvas 2D too
- [ ] P0.14i Collection hook for new families (found in run 5): show "first Van!" style toasts and count each family
      for the Collection book (P1.4)
- [x] P0.15 Playtest gate: owner played ~10 minutes (2026-11-05): "works well, held my attention for 10 minutes";
      asks for better graphics (P0.14h) and a city map like other tycoons (P1.1). Owner chose to keep the current task order.

## Phase 1 — Web MVP

- [ ] P1.1 Business framework: multiple businesses per city with a city map (owner asked for a map after the playtest); Business 2 Repair Garage
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
- [ ] P2.5 Push notifications (garage full, offline cap reached); then let contract timers run offline (from P0.14c)
- [ ] P2.6 Store assets: icon, screenshots, preview video script, store text
- [ ] P2.7 Privacy policy, terms, data safety and age-rating answers

## Phase 3+ — Global launch and live ops

See the master plan.
