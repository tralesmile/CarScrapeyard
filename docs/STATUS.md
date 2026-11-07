# Status

Last updated: 2026-11-07 (run 22; next run is run 23). Runs now start every 3 hours.

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

- [x] P1.1 Business framework (done in run 13; a garage mini-game waits on owner feedback, see P1.1f): multiple businesses per city with a city map (owner asked for a map after the playtest); Business 2 Repair Garage.
  - [x] P1.1a Core (run 10): `state.businesses` (active + opened), `src/core/businesses.ts` (status locked/soon/forSale/open,
        unlock progress, open, switch), save v2 with the first real migration (v1 -> v2) and repair of impossible blocks.
        Garage goal: $200K lifetime earnings (active bot 12m12s avg over 12 seeds), open cost $150K (tune in P1.1c).
  - [x] P1.1b City map (run 10): 🗺 button after 30 sales (red dot until first visit, "CITY MAP!" banner), Rust Valley
        drawn as inline SVG (scrapyard with "you are here" pin, Repair Garage with a padlock progress ring, Used Car Lot and
        Paint & Tuning greyed out), a list with the open businesses and the next goal, live progress while open.
  - [x] P1.1c Repair Garage loop (run 11): `src/core/garage.ts` (customers with one of five faults, tap or Foreman
        work, fee on arrival, yard parts used or a 30% parts bill, Tool Wall / Reputation / bays 2-3 / Foreman, idle and
        offline income, save repair), `GarageScene` with a Canvas 2D workshop (roller door, pegboard, lift), fault bubble
        with progress, bay thumbnails, drive in/out, coins; DOM panel swaps to Garage/Crew tabs; map "Go" swaps scenes
        (only the shown scene runs; its tick advances every business). Open cost tuned to $100K (opens 14m24s, 35% of
        earnings at 40 min). `ready: true`.
  - [x] P1.1e Garage art (run 12): the waiting customer (buyer looks) and the Foreman drawn in the garage, the lift's
        cross beam as the "REPAIR GARAGE" sign (clear of the HUD, bay row and raised car; unit-tested on 4 phone sizes),
        the lift raises the car 10 px while it is worked on, fault animation (flat tyre tilt + bulge, battery sparks,
        brake glow), light rust on customer cars.
  - [x] P1.1f Garage feel (run 13): the customer says what's wrong in a speech bubble as they step out (3 lines per
        fault, once per job), then the fault bubble pops up; a flat-tyre fix rolls a new tyre onto the front wheel;
        slimmer, more solid bay row (96x60) so the door and sign read on short phones; yard-only announcements (LEGENDARY!
        banner, buyer bell) stay quiet in the garage. Still open: owner feedback on a garage mini-game (NEEDS_FROM_YOU)
        may replace tapping; that becomes its own task if the owner wants it.
  - [x] P1.1d Map polish (run 13): three tiers per business (stars on the plot and the list, more art per tier; yard by
        lot slots 3/4, garage by bays 2/3), a road-wipe transition on "Go". The barn note story beat was dropped: the
        barn restores in the yard already, so "Restore it when you open the Garage" no longer fits.
- [x] P1.1x Art follow-ups (run 10): muscle car redrawn boxy with a hood scoop (overlap with sports 0.83 -> 0.69), hatch
      lower and rounder with a steep hatch (overlap with SUV 0.86 -> 0.64); every family pair now under 0.82. The yard lays
      out again (backdrop, slots, bay) when the HUD changes height, e.g. when the customer strip appears.
- [x] P1.1y SUV redrawn (run 12): high ground clearance, raked D-pillar, tailgate spare wheel; van/SUV 0.81 -> 0.74,
      every family pair under 0.75 (asserted in families-art.test.ts).
- [x] P1.2 Business 3 Used Car Lot (buy at auction, refurbish, sell) and Business 4 Paint & Tuning
  - [x] P1.2a Used Car Lot core (run 14): `src/core/carlot.ts` (auction board of 3 lots with condition shown up front,
        45 s per lot, refurbish by tap or Detailer, walk-up buyers at list price, haggled manual sales with a hold,
        Valet Bay / Showroom / spots 2-4, Auction Agent with a 2x cash reserve, idle and offline income, save repair),
        profit-only lifetime earnings. Tuned with a 120-minute bot run (retailBase $35K; lot 55% of earnings at 2 h).
  - [x] P1.2b Used Car Lot scene and UI (run 14): `CarLotScene` + `carlotArt.ts` (forecourt backdrop, showroom sign,
        bunting, platform, condition rust, FOR SALE tag, spot thumbnails, Detailer, buyer drives the car away),
        Auction / Lot / Crew tabs, Sell with haggle, hints, map tiers and back button, welcome-back line. `ready: true`.
  - [x] P1.2c Used Car Lot polish (run 15): bid countdown with "Going…" and a red timer in the last 8 s, SOLD! / YOURS!
        stamps, gavel and "missed it" sounds; five walk-up buyer types (Family, Collector for Good/Mint cars, Speed
        Freak, Tradie, Influencer) with bonuses; the buyer walks up, looks the car over with a speech bubble, then pays
        (`buyer` in the lot state, saved). Still open (owner question): a real bidding mini-game instead of fixed prices.
  - [x] P1.2d Paint & Tuning core (run 16): `src/core/paint.ts` (customer orders of 1-3 services: respray, rims, vinyl
        wrap, engine tune, worked in order; combo bonus +15% per extra service; +25% tip for a hand-finished order within
        3 s per service; Spray Booth / Hype / booths 2-3 / Painter; idle and offline income from an exactly enumerated
        expected order; save repair; map tiers by booths). Tuned with a 180-minute bot run (baseFee $55K: opens 1h35m,
        41% of earnings at 3 h). `ready: false` until the scene ships.
  - [x] P1.2e Paint & Tuning scene and UI (run 17): `PaintScene` + `paintArt.ts` (spray booth backdrop with the sign laid
        out above the order ticket, layered car: old paint, new colour cropped as it is sprayed, wrap stripes, rims and
        tune overlays), order ticket on the roof (service slots, order progress, tip timer), spray mist / rim glints /
        exhaust flames, Painter, booth thumbnails, Shop / Crew tabs, hints, first-tip toast, map tier art, welcome-back
        line, e2e. `ready: true`.
  - [x] P1.2f Lot cars through the shop (run 18): a Tune button beside Sell sends a refurbished lot car to a free
        booth for the one service that suits its family; no fee, its sticker rises by the shop's fee for that service
        (walk-up bonuses and haggling apply on top), once per car; away cars can't be sold or picked by buyers; save
        links repaired; tuned with a with/without bot run (+8% lifetime at 3 h).
  - [x] P1.2g Paint shop polish (run 19): the customer says what they want as they step out (by the first service,
        "The full works, please!" for three); the bubble is laid out clear of the ticket (above the head, right of the
        ticket, or beside the customer under it; unit-tested on 7 screens x 1-3 services x 2 line widths). Short phones:
        `boothStage` moves the car down, lets the ticket cover a little more roof and on a 560 px phone draws the car
        smaller, so the sign keeps its lettering and the ticket clears the booth row (e2e at 375x560 with 2 booths).
- [ ] P1.3 Prestige "Sell Empire" → Legacy Points + Legacy tree; city 2 Motor City
  - [x] P1.3a Prestige core (run 19): `src/core/legacy.ts`: Legacy Points = floor(sqrt(all-time earnings / $5M)), the
        sale is offered at 10 new points and glows at >= half the points owned, +2% income per point on every payout
        and idle/offline income (yard cars, scrap, contracts, barn, garage fees, paint fees and lot tune stickers, lot
        auction and list prices so lot profit scales too), `sellEmpire` resets the run and keeps settings, tutorial,
        collection, stats, clock and RNG; run timer; save repair. Sim: offered at 3h28m (active) / 4h20m (relaxed);
        a second empire with x1.24 opens the paint shop at 1h19m instead of 1h35m.
  - [x] P1.3b Sell Empire UI (run 20): `src/ui/legacyView.ts` (row, preview, badge and next-sale texts, unit-tested);
        a one-time "EMPIRE FOR SALE!" banner and map dot (`tutorial.legacyOffered`), a gold glowing map row, a preview
        modal (+points, x now -> x next, keeps / starts over, run time) with "Not yet", the sale (scenes paused, saved),
        a confetti celebration with Grandpa Joe's line, then a reload into the new empire (every scene and texture is
        rebuilt from the save, since car ids restart). HUD Legacy chip with the multiplier, tap for info. e2e on an
        iPhone SE.
  - [x] P1.3c Legacy tree (run 21): `src/core/legacyTree.ts` (`state.legacy.tree` levels per branch, buy in order for
        2/3/5/8, free points = earned - spent, one free respec per empire reset on a sale, save repair), all 12 effects
        wired into the rules (tap work, Head Start in `sellEmpire`, crusher parts, crew rates and seller delay, haggle
        zone, buyer gaps, auction prices, open costs, tip window, rarity weights, barn find/stage times, offline cap in
        every business), sim A/B per branch (Rare Finds cut to x1.3). Tree screen from the Legacy chip (`legacyTreeView`
        in legacyView.ts; branch tabs, node rows, respec), dots on the chip and tabs, e2e on a 320 px phone.
  - [x] P1.3e Legacy tree polish (run 22): owned perks show as gold chips where they act (`tabPerks`/`perkChip`/
        `perkLabel` in legacyView.ts: a chip row above the cards per tab, the haggle badge, the map's open line, the
        welcome-back popup), a node-bought animation (pop, glow, stamp, "−3 🏛", header pulse; reduce-motion safe), and
        the welcome-back popup tells the real time worked (capped) plus a line when you were away longer than the cap.
  - [ ] P1.3d City 2 Motor City (new map, its own businesses; the plan's "Motor City prestige day 6-8").
        Suggested split (run 22): P1.3d1 core: `state.city` + a city list in config, Motor City unlocks after the 2nd
        empire sale (or a Legacy Points goal), choosing the city on a sale; its businesses reuse the four business rules
        with city multipliers (bigger values, higher costs) so no new mini-games are needed at first; save v3 migration.
        P1.3d2 map: a second SVG map (downtown blocks, a highway) with a city switcher on the map sheet. P1.3d3 art: a
        city palette (night-time neon backdrop variants for each scene). Sim: Motor City's second run must still feel
        faster than Rust Valley's first.
- [x] P1.3r Layout fixes found with the Sell Empire e2e (run 20): the 🗺 button was visible from the start (no CSS rule
      for `.icon-btn.hidden`); on 320 px phones the panel's tabs and buy modes overflowed and a modal's focus slid the
      whole game sideways (`overflow: clip`, `preventScroll`, compact tabs up to 430 px: four tabs + x1/x10/Max fit at 320 px, scrolling tabs
      as a fallback).
- [ ] P1.3q Quality (run 19): the lot's FOR SALE tag once took > 3 s to appear after the e2e injected a ready car (flake,
      passed on re-run). If it recurs, log `arriving`/`bigId`/texture key in the assertion and look for a stuck drive-in.
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
