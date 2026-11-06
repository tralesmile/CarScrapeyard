# Status

Last updated: 2026-11-06 (run 10; next run is run 11). Runs now start every 3 hours.

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
- [x] P0.14j Scrapper polish: tops up parts while away (shown in the welcome-back popup), mini press on lot thumbnails,
      Scrapper character and press beside the barn (run 8)
- [x] P0.14c Contracts polish: one free swap per order (run 6). Offline contract timers moved to P2.5 (they need push notifications)
- [x] P0.14d Buyers polish: customers drawn as characters that walk in and out; Tradie (pickups) and Influencer (sports/hyper) buyers; "Skip haggling" setting (run 7)
- [x] P0.14e Floating texts overlap when several rewards land at once: they stack now; banners queue (run 5)
- [x] P0.14f Barn polish: the covered classic drives out of the barn before the reveal; stage art inside the barn (tow chain,
      engine hoist, welder, paint booth, clean tarp) with work sparks/dust; banners hide during the reveal (run 8).
      "Keep classics for the Collection book" moved to P1.4.
- [x] P0.14g Barn card below the fold: the barn card now leads the Yard tab once the barn opens, tapping the barn scrolls to
      and flashes it, and a red dot on the barn sign shows when a stage is affordable or the classic is ready (run 8)
- [x] P0.14h Art polish (run 9): stair-steps fixed at the root (Phaser's automatic pixel-art mode when zoomed was on;
      forced off), power-of-two car textures sized to the bay with trilinear mipmaps, a distinct hypercar silhouette
      (cab-forward canopy, shark fin, tall wing, splitter, slim lights), and the backdrop painted on Canvas 2D
- [x] P0.14i Collection hook (run 9): sales counted per family in `state.collection.sold`, "📒 First Van sold!" toast
      with the families collected so far (starter families quiet in the first 10 sales). The book UI is P1.4.
- [x] P0.15 Playtest gate: owner played ~10 minutes (2026-11-05): "works well, held my attention for 10 minutes";
      asks for better graphics (P0.14h) and a city map like other tycoons (P1.1). Owner chose to keep the current task order.

## Phase 1 — Web MVP

- [ ] P1.1 Business framework: multiple businesses per city with a city map (owner asked for a map after the playtest); Business 2 Repair Garage.
  - [x] P1.1a Core (run 10): `state.businesses` (active + opened), `src/core/businesses.ts` (status locked/soon/forSale/open,
        unlock progress, open, switch), save v2 with the first real migration (v1 -> v2) and repair of impossible blocks.
        Garage goal: $200K lifetime earnings (active bot 12m12s avg over 12 seeds), open cost $150K (tune in P1.1c).
  - [x] P1.1b City map (run 10): 🗺 button after 30 sales (red dot until first visit, "CITY MAP!" banner), Rust Valley
        drawn as inline SVG (scrapyard with "you are here" pin, Repair Garage with a padlock progress ring, Used Car Lot and
        Paint & Tuning greyed out), a list with the open businesses and the next goal, live progress while open.
  - [ ] P1.1c Repair Garage loop: customer cars arrive with a fault, you fix them for a fee (no buying/selling), garage
        upgrades + a garage manager, its own scene/backdrop. Then set `ready: true` for the garage, make "Go" switch the
        Phaser scene (scrapyard keeps ticking in the background, already true in core), tune the open cost with
        `npm run sim` (add the garage to the bots), and add it to the e2e. Scrapyard parts should cut garage repair costs (plan).
  - [ ] P1.1d Map polish: the map's visual tiers per business (plan: three tiers per station visible on the map), a
        drive-between transition, the barn note "Restore it when you open the Garage" (plan story beat) if it still fits.
- [x] P1.1x Art follow-ups (run 10): muscle car redrawn boxy with a hood scoop (overlap with sports 0.83 -> 0.69), hatch
      lower and rounder with a steep hatch (overlap with SUV 0.86 -> 0.64); every family pair now under 0.82. The yard lays
      out again (backdrop, slots, bay) when the HUD changes height, e.g. when the customer strip appears.
- [ ] P1.1y Van and SUV are now the closest pair (0.81); give the SUV a distinct feature (taller ground clearance,
      spare wheel on the tailgate) and bring every pair under 0.75.
- [ ] P1.2 Business 3 Used Car Lot (buy at auction, refurbish, sell) and Business 4 Paint & Tuning
- [ ] P1.3 Prestige "Sell Empire" → Legacy Points + Legacy tree; city 2 Motor City
- [ ] P1.4 Collection book (40 cars, sets, rarity badges), mastery; option to keep a restored barn classic for the book instead of selling (from P0.14f)
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
