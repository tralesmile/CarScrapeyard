# Status

Last updated: 2026-11-12 (run 55; next run is run 56). Runs now start every 3 hours.

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
- [x] P1.3 Prestige "Sell Empire" → Legacy Points + Legacy tree; city 2 Motor City
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
  - [x] P1.3d City 2 Motor City (new map, its own businesses; the plan's "Motor City prestige day 6-8").
    - [x] P1.3d1 Core + city picker (run 23): `ECON.cities` (Rust Valley x1; Motor City x5, from the 2nd sale),
          `src/core/cities.ts`, `state.legacy.city` (kept on a sale; new field with a default and save repair, no
          version bump needed), `sellEmpire(state, now, city)`. A city's scale multiplies every value
          (`incomeMultiplier`) and every price (cost functions take a required `scale`; crew, open costs, unlock goals,
          barn stages, Head Start). Sell preview "Where next?" picker (two cards, Motor City default, fits 320x568),
          a teaser on the first sale, "Next stop" in the celebration, the map titled by city. Sim: the third empire in
          Motor City is offered the sale at 2h28m vs never within 5 h in Rust Valley.
    - [x] P1.3d2 Motor City map (run 24): `motorCityGround()` in cityMap.ts (steel-blue blocks with sidewalks, a highway
          with traffic, rooftops kept off plots and roads, lamps, zebra crossing, harbour) chosen by `legacy.city`
          (`data-city` on the SVG); city business names (`ECON.cities.list.*.names`, `businessName(state, id)`) on the
          map, list, drive wipe, toasts and the garage / lot / paint scene signs; the 🗺 button is labelled with the
          city and wears its icon outside Rust Valley. e2e: map, names, button and the Midtown Garage (e2e-22d).
    - [x] P1.3d3 Motor City art: a city palette (steel blue by day / night-time neon backdrop variants for each scene).
      - [x] P1.3d3a Yard (run 24): `YARD_THEMES` per city in backdropArt.ts; Motor City paints a dusk steel-blue sky, a
            two-row skyline (`skylineTowers`, lit windows, antenna light) instead of hills, asphalt instead of dirt and a
            chain-link fence. Unit-tested on 4 screens; e2e samples the backdrop's ground colour in both cities.
      - [x] P1.3d3b Garage, lot and paint shop in Motor City colours (run 25): `GARAGE_THEMES` (steel-blue wall and
            pegboard, dusk towers with lit windows through the door, `streetBuildings`), `LOT_THEMES` (dusk sky, taller
            hazy towers above the showroom, lit near row, `lotSkyline` capped at 80% of the horizon), `BOOTH_THEMES`
            (steel-blue panels, icy lights, cyan accent stripe); scenes pass `city`. Unit-tested; e2e samples all three
            backdrops in Motor City (e2e-22d/e/f).
      - [x] P1.3d3c Night-time neon variant (run 26): `isCityNight(city, lights, localHour)` in cities.ts (7 pm to
            before 6 am on "auto"; `hasNight` per city, Rust Valley never), `settings.cityLights` (Auto / Day / Night,
            save repair, Settings row only in a city with a night look), `bridge.night()`; each scene repaints its
            backdrop when the flag flips (checked twice a second with the insets). `YARD_NIGHT` (stars, crescent moon,
            dark towers with more lit windows, neon rooftop signs, a floodlight on the bay, piles in shadow),
            `GARAGE_NIGHT` (night street, neon roof line), `LOT_NIGHT` (moon, lit showroom, neon halo behind the sign;
            same skyline layout), `BOOTH_NIGHT` (magenta neon stripe). Signs and lettering keep day colours.
            Unit-tested; e2e switches to Night in Settings and samples all four scenes (e2e-22g..k).
    - [x] P1.3d4 Balance follow-up (run 27): the 2nd empire was offered its sale at 4h47m vs 3h28m for the first. Softer
          point curve `floor((all-time / $28M) ^ 0.8)` (first sale still at ~$500M; no save migration, unit-tested) and
          Motor City x5 -> x3 to keep its points per hour. Sim, selling at each offer: 3h27m, 3h23m, then 1h56m, 1h44m,
          1h35m, 1h27m in Motor City; a balance test asserts every empire is offered its sale no later than the one
          before. Compared in economy.md: exponents 0.5-0.8 and +3-5% per point (barely helps). Revisit the point
          divisor when city 3 is designed (the curve grows faster in the long run).
- [x] P1.3r Layout fixes found with the Sell Empire e2e (run 20): the 🗺 button was visible from the start (no CSS rule
      for `.icon-btn.hidden`); on 320 px phones the panel's tabs and buy modes overflowed and a modal's focus slid the
      whole game sideways (`overflow: clip`, `preventScroll`, compact tabs up to 430 px: four tabs + x1/x10/Max fit at 320 px, scrolling tabs
      as a fallback).
- [x] P1.3s e2e flake (run 23): the 560 px paint-shop check failed once with no ticket, because the Painter finished the
      held 3-unit order during the resize. The order is held again (work 20) right before the resize.
- [x] P1.3v Save hardening (run 52): `tests/save-fuzz.test.ts` corrupts random fields of a normal and a late-game state
      (1500 seeds each, replayable) and plays a minute after loading. It found two crashes: a negative `carsSold` left no
      car family unlocked (`weighted` read an empty list), and an absurd upgrade level or a paint job fee overflowed income
      to Infinity. Fixed in `save.ts` (counters clamped), `MAX_SAVED_LEVEL = 1000` for all upgrade levels, and paint job
      numbers capped at 1e18. Run 53 fuzzed the garage, lot, paint shop and a post-Sell-Empire state: no new crashes. Run 54 fuzzed the collection book,
      daily tasks, `queueOffline` with 11 absurd clocks (NaN, Infinity, negative, 1e300) and corrupted `lastSeen`/`pendingOffline`
      (`tests/save-fuzz2.test.ts`): no crashes, nothing to fix. Run 55 (`tests/save-fuzz3.test.ts`): fuzzed the legacy tree, achievements, wallet and story
      subtrees (800 seeds, then buying every node, respec, medals, shop, a sale) and replayed 60 random players (600 public
      actions each: wash, tap, sell, crush, upgrades, hire, contracts, Sell Empire) with a non-finite walk and a save
      round-trip: no crashes, nothing to fix. Next fuzz ideas: random actions in the garage, lot and paint shop.
- [ ] P1.3t e2e flake (run 38): the first baseline `npm run check` failed at the very end with a page error
      `Cannot read properties of null (reading 'glTexture')` (Phaser WebGL renderer, main page); the identical code
      passed on the immediate re-run. The e2e now tags page errors with the section they happened in plus a short
      stack. If it recurs, read the tag and look for a texture removed/regenerated while a sprite still uses it.
      Recurred in run 46 after "lot cars through the paint shop" (`batchSprite` -> `glTexture`): all scenes now free car
      textures through `removeTexturesSafely` (`src/game/textureSafe.ts`), which repoints images still using them (also in
      containers) to `__WHITE` first. Tick this when a few runs pass without the error.
- [ ] P1.3u e2e flake (run 45): the "scrapper" section's `waitForFunction(carsCrushed > n)` timed out once (20 s) in a run
      that passed on the immediate re-run; code was unrelated (string moves). If it recurs, log whether a wreck was in the
      yard and `scrapperRest` when it times out. Run 46: it recurred; the wait now zeroes `crusherCooldown`, waits 30 s and
      throws the parts, rest, cooldown and yard cars on a timeout (likely cause: the automation cleaned every yard car).
- [ ] P1.3q Quality (run 19): the lot's FOR SALE tag once took > 3 s to appear after the e2e injected a ready car (flake,
      passed on re-run). If it recurs, log `arriving`/`bigId`/texture key in the assertion and look for a stuck drive-in.
- [x] P1.3q2 Quality (run 25, fixed run 26): on a 320x568 phone the paint shop's tap hint pill covered the lower half
      of the car's name/price label. The hint sits 6 px lower (`HINT_BELOW_AREA`) and `carLabelTop` lifts the label of
      the garage, lot and paint shop just enough to clear the pill at the top of its bob; e2e asserts it on an iPhone SE.
      (The yard hides its label while the hint shows; the garage label had ~6 px to spare.) Also found: the Settings
      sheet overflowed an iPhone SE once the City lights row was added (Done unreachable); it scrolls now
      (`max-height: 100%`, tighter rows under 600 px tall), e2e-checked.
- [x] P1.4 Collection book (40 cars, sets, rarity badges), mastery; option to keep a restored barn classic for the book instead of selling (from P0.14f)
  - [x] P1.4a Book core (run 27): `src/core/collection.ts`, `state.collection.models` (48 entries: 32 yard models + 16
        barn classics, pre-filled in `newGame` so old saves get them; save repair). Each sale records the model, its
        best rarity and mastery stars (10 / 50 / 200 sales, +1% value each); sets: 8 family sets (+5% that family),
        4 brand sets (one model of the brand in every family, +5% that brand), Barn Classics (all 16, +25% barn sale
        value). Bonuses multiply yard car values at arrival (RNG stream unchanged) and the yard's idle income; kept on
        a sale. "SET COMPLETE!" banner and a mastery toast (`src/ui/collectionView.ts`). Sim: first run unchanged
        (3h27m), lot-tune test now averaged over 3 seeds (one seed swings it 1.10-1.19).
  - [x] P1.4b Book screen (run 28): 📒 HUD button (`bookUnlocked`: after the 10 quiet sales, or in a later empire),
        `openBook` in ui.ts with three pages (Car types / Brands / Classics; `bookView`/`bookCard` in collectionView.ts,
        unit-tested), set rows with progress and bonus, cards with Canvas 2D thumbnails (`src/game/bookArt.ts`, cached
        data URLs; one silhouette per car type), rarity badge, mastery stars and a bar to the next star. `BookEntry.seen`
        (default false, save repair) drives the NEW badges and the red dots; opening the book marks entries seen.
        e2e on the iPhone 13 flow and on 320x568.
  - [x] P1.4q HUD fix found while adding 📒 (run 28): a late-game top bar overflowed 320-414 px screens (the chip slid
        over the cash). Compact top bar up to 430 px (`.money` column, sound toggle in Settings only, 34 px buttons),
        `.chips` stack under 360 px; e2e asserts a full bar has no overlaps on an iPhone SE.
  - [x] P1.4c Showcase (run 29): the reveal offers "🏆 Keep it" beside "Sell it!" (`keepBarnCar`/`canKeepBarnCar` in
        barn.ts): no cash, the classic goes into `state.collection.showcase` (one per model, kept on a sale, save repair)
        and the book like a sale, and adds +0.5% to every payout (`showcaseMultiplier` in `incomeMultiplier`; +8% max).
        Sim A/B: +1% made keeping never slower (no choice), +0.5% costs ~1 min in the first empire. Book Classics page
        shows the showcase line and kept cards on a gold plinth; Sell Empire preview lists it. e2e keep, repeat, book.
        Follow-up idea (not scheduled): draw the kept classics in the yard (a trophy shelf by the barn).
- [x] P1.5 Daily tasks + 7-day login calendar (UTC reset hour), achievements
  - [x] P1.5a Daily core (run 29): `src/core/daily.ts`, `state.daily` (kept on a sale, save repair). A game day starts
        at 04:00 UTC (`gameDay`, never earlier than `lastSeen`); after 80 sales `refreshDaily` rolls 3 of 8 task kinds
        that are open (sell, haggle, buyers, crush, jobs, garage, lot, paint; hashed by day, game RNG untouched).
        Tasks follow existing counters by their growth (`trackDaily` in `tick`), so a Sell Empire reset loses nothing.
        Rewards are worth N average yard cars at claim time (legacy and city scale); all three claimed add a bonus.
        Login calendar: one claim per day played, a missed day does not reset it, day 7 brings an Epic gift car (the
        next arrival). Unit-tested (16 tests).
  - [x] P1.5b Daily UI (run 29): Jobs tab: the 📅 Daily reward card (7-cell strip, claim, "Next in 5h 12m") and three
        task cards below the orders; Jobs tab dot; "DAILY TASKS!", "ALL DAILIES DONE!", "GIFT CAR!" banners; a toast when
        a new day starts while playing. e2e: unlock, claim, tomorrow wait, all-done bonus, a new day, the gift car.
  - [x] P1.5c Achievements (run 30): `src/core/achievements.ts`, `ECON.achievements` (14 awards x 4 medals: Bronze,
        Silver, Gold, Diamond = 56). Lifetime numbers are read directly (stats, the book, Legacy, calendar claims, yard
        sales per family, all-time earnings); numbers a Sell Empire resets (garage jobs, lot sales, paint orders, barn
        restorations) are followed by growth in `tick` (`state.achievements.tracked`; old saves backfill from the
        current empire; `sellEmpire` tracks once more before the reset). A medal is claimed by hand for cash worth
        3/6/12/24 average yard cars (sim A/B: 12 medals in 30 min, the first sale 1-2% sooner; 5/10/20/40 moved it 3-4%).
        UI: an Awards tab in the 📒 book (`src/ui/awardsView.ts`: claimable first, medal row, progress bar, claim
        button), the book opens on Awards when a medal waits and no car is new, 📒 dot, "🥉 Crusher: Bronze medal!" toast.
        Gems replace part of the cash with P1.7.
  - [x] P1.5d Daily follow-ups (run 30): the welcome-back popup lists what waits (today's calendar reward, finished
        tasks, the all-done bonus, medals; `waitingLines` in dailyView.ts; a new day is rolled before the popup), and a
        daily task finished in the garage, lot or paint shop shows a toast pointing to the scrapyard's Jobs board.
        Gems in the daily rewards moved to P1.7. Also: the popup scrolls on short phones (`cls: 'welcome'`), e2e at 320x568.
  - [ ] P1.5e Idea (not scheduled): a HUD shortcut to the Jobs board from the other businesses, if playtests show the
        toast is missed.
- [x] P1.6 Story chapter 1 + rival Vince Valvano (chapter 1 in run 31; chapter 2 and the story log in run 32)
  - [x] P1.6a Chapter 1, Rust Valley (run 31): `src/core/story.ts` (`state.story`: beats seen, gap, Vince's tally;
        kept on a sale, save repair), five beats in order (`vinceVisit` at 20 sales, `joeGarage`, `vinceAuction` after the
        first lot let go, `vincePaint`, `chapter1End` when the empire can be sold; a skipped business never blocks the
        rest), 20 s of play between scenes, Rust Valley only. Story modal (`openStory`, `src/ui/storyView.ts` lines and
        toasts, `src/game/portraitArt.ts` Canvas 2D busts of Joe and Vince); the chapter's end opens the map before the
        sale banner. Vince as flavour on the events (`lotExpired.rival`: purple VINCE! stamp; `buyerLeft.rival`), no
        economy change (sims untouched). 9 unit tests; e2e at 20 sales, on the auction board and on an iPhone SE.
  - [x] P1.6b Chapter 2, Motor City (run 32): `CHAPTER_2` in story.ts (`vinceCity` after 5 Motor City sales, then
        `vinceMidtown` / `vinceMall` / `vinceNeon` when each business opens, `chapter2End` when the Motor City empire
        can be sold; each chapter plays in its own city, chapter 2 does not need chapter 1), `vinceMet` also from the
        Motor City welcome, Valvano Motors HQ on the Motor City map (`rivalHq` gold tower in place of a rooftop) and a
        `rivalRow` in the list. Flavour only, no sim change. 5 unit tests; e2e scene on an iPhone SE and the HQ.
  - [x] P1.6c Story log (run 32): a Story page in the 📒 book (`storyLog` in storyView.ts, shown once a scene is seen):
        chapters with city and count, seen scenes open inline (`storyLinesHtml`), locked rows for the rest, a teaser
        for the next chapter. Unit-tested; e2e at 320 px (five tabs fit) with a replayed scene.
  - [x] P1.6q Quality (run 33): under 360 px the five book tabs wrap into two rows (`.book-tabs { flex-wrap }`), so no
        label is cut; e2e asserts no tab label overflows on a 320 px phone.
  - [ ] P1.6d Optional (owner question in NEEDS_FROM_YOU): a real rival mechanic (Vince bidding at the auction or a
        monthly sales race). Chapter 3 waits for city 3.
- [x] P1.7 Gems (soft premium) + Auction Tokens (earn-only); shop UI stub; gems in daily and medal rewards (from P1.5c/d)
  - [x] P1.7a Wallet core (run 33): `src/core/wallet.ts` (`state.wallet`: gems, tokens, earned totals; kept on a sale,
        caps, save repair), `ECON.wallet` income table, gems in medals / all-done bonus / calendar, tokens in tasks /
        bonus / calendar, shown on claim buttons, banners, toasts and the book header. 9 unit tests, e2e. No cash change.
  - [x] P1.7b Shop and first sinks (run 34): `src/core/shop.ts` + `ECON.shop`; a Shop page (sixth tab) in the 📒 book:
        Barn rush 1 💎, Parts crate 2 💎, Cash bag 4 💎, Token lot 4 🎟 (a Good car on the Used Car Lot, no cash price);
        locked rows say why; gem packs "coming soon" until P2.3. 6 unit tests, e2e. No sim change.
  - [ ] P1.7c Idea (not scheduled): a cosmetic yard theme as a gem sink, and a 💎 shortcut button outside the book if
        playtests show the Shop is hard to find.
- [x] P1.8 Music layers per business; volume settings (run 35): `src/audio/musicScore.ts` (pure: one 4-bar loop per
      city, Rust Valley major 96 bpm / Motor City minor 108 bpm; six layers; each opened business adds one: scrapyard =
      bass + beat + pluck, garage = ratchet, lot = pad, paint = lead; the business on screen is louder),
      `src/audio/music.ts` (Web Audio scheduler on the shared clock, per-layer gain fades), Settings: Music switch
      (now real), Music volume and Effects volume sliders (`settings.musicVolume` / `sfxVolume`, saved and repaired).
- [x] P1.9 i18n string files, first slice (run 36): `src/i18n/` (`t(key, params)`, `{name}` placeholders, `_one`/`_other`
      plurals via Intl.PluralRules, English fallback, `registerLocale` / `setLocale` / `pickLocale`), catalog in `en.ts`;
      the daily-task texts (`dailyView.ts`) are moved over, 4 unit tests.
  - [ ] P1.9b Move the remaining UI strings (run 37: `awardsView.ts`; run 38: `storyView.ts`; run 39: `collectionView.ts`; run 40: `cityMap.ts` and the Settings sheet in `ui.ts`; run 41: `legacyView.ts`; run 42: the lot, barn, crush, Sell Empire and Welcome back modals in `ui.ts`; run 43: HUD labels, tabs, crew/lot/garage/paint cards and the haggle slider; run 44: contract and barn cards; run 45: aria labels, event banners and toasts in `ui.ts`; run 46: the daily calendar and task cards; run 47: the yard, lot and paint scene texts (`scene.*`); run 48: the garage scene texts and the customer lines (`garage.say.*`); run 50: the last scene literals (`scene.lot.atShop`, `scene.lot.freeSpot`, `scene.paint.freeBooth`); run 49: lot buyer and paint customer lines (`lot.say.*`, `paint.say.*`), game event banners/toasts and the intro in `main.ts` (`event.*`, `intro.*`), the last literals in `ui.ts`; run 51: garage fault names and tap hint (`garage.fault.*`); car model names are proper nouns and stay; the `src/game` grep is clean; left:
        add a language setting once a second language exists.
- [x] P1.10 PWA (run 36): `public/manifest.webmanifest`, icons (192, 512, maskable; source `public/icons/icon.svg`),
      `public/sw.js` (network-first page, cache-first assets, versioned cache), registered in production only and not in
      `?debug` runs; e2e checks manifest, icons, active worker and a reload with the network off.
- [x] P1.11 Analytics adapter (run 35): `src/platform/analytics.ts` (event names, consent-gated `Analytics` with a
      pluggable sink, `MemorySink`, pure `diffEvents` milestones: sales 1/10/25/50/..., business opened, empire sold, city
      changed, new car family, tutorial done; `Tracker` looks once a second). No sink and consent off by default, so
      nothing is sent until accounts and a consent screen exist (P2.4, P2.7).
- [x] P1.12 Portal adapters (run 37): `src/platform/portal.ts` (pure, SDK objects injected): `createPokiSdk`,
      `createCrazyGamesSdk`, `detectPortal` (`?portal=` or a present global), `withPortal` (rewarded ads only after init,
      one at a time, failures never throw), `bindGameplayToVisibility`. Wired in `main.ts`; the SDK `<script>` tag is not
      added yet (portal rules differ; add it in the portal-specific build). 6 unit tests, e2e with a Poki stub.
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
