# Changelog

## 0.41.0 - 2026-11-10 (run 41)

- **Translation layer:** the Sell Empire row and preview, Grandpa Joe's lines, city teaser and ordinals, the Legacy tree
  texts, perk chips and the welcome-back away lines moved to `en.ts` (plurals via `_one/_other`); nothing changes for
  players.

## 0.40.0 - 2026-11-10 (run 40)

- **Translation layer:** the city map texts (business rows, FOR SALE / SOON signs, Vince's HQ line, map label) and the
  whole Settings sheet (switches, sliders, City lights, reset confirmation, credits) moved to `en.ts`; nothing changes
  for players.

## 0.39.0 - 2026-11-10 (run 39)

- **Translation layer:** the collection book texts (set names and bonuses, set-complete banner, mastery toast,
  showcase line, card lines, page names, header) moved to `en.ts`; nothing changes for players.

## 0.38.0 - 2026-11-10 (run 38)

- **Translation layer:** all story texts (ten scenes, speaker names, chapter titles, Vince's toasts, the log teaser)
  moved to `en.ts`; nothing changes for players.
- **Test tooling:** browser-test page errors now say which section of the run they happened in, with a short stack.

## 0.37.0 - 2026-11-10 (run 37)

- **Portal adapters (P1.12):** the game can run on Poki and CrazyGames. Rewarded ads, "loading finished" and
  gameplay start/stop (paused when the tab is hidden) go through one small adapter; if a portal SDK fails, the game
  just carries on without ads. Nothing changes for the normal web build.
- **Translation layer:** the medals page texts (header, progress lines, claim buttons, medal toast) moved to `en.ts`.

## 0.36.0 - 2026-11-10 (run 36)

- **Install and play offline (P1.10):** the web build has a manifest and icons, so phones can "Add to home screen" and
  it opens full screen. A service worker caches the game after the first visit; with the network off it still loads
  and runs from the saved game.
- **Translation layer (P1.9, first slice):** a small `t()` function with plurals and English fallback; the daily-task
  texts use it. More views move over in later runs.

## 0.35.0 - 2026-11-10 (run 35)

- **Music (P1.8):** the game has a soundtrack, synthesised like the effects (no files). A four-bar groove loops per city
  (Rust Valley: major, 96 bpm; Motor City: minor, lower and faster at 108 bpm). It starts with three layers (bass,
  soft kick and hat, a plucked arpeggio) and every business you open brings one more in: the garage a ratcheting
  tick, the lot a slow pad, the paint shop a lead melody. The business you are looking at is louder; layers fade over
  about a second. Music starts after the first tap and pauses with the app.
- **Volume settings:** the Settings sheet has a real Music switch plus Music volume and Effects volume sliders (saved
  in the game, old saves get 60% / 100%, junk values are repaired).
- **Analytics adapter (P1.11):** a consent-gated event layer with no network sink yet. Events: first sale and sales
  milestones, business opened, empire sold, city changed, new car family, tutorial done. Off by default; nothing is
  sent.
- Tests: 16 new unit tests (layer logic, score ranges and looping, volume repair, analytics consent and milestones);
  e2e: sliders save and fit, music plays and gains the garage layer, analytics silent without consent.

## 0.34.0 - 2026-11-10 (run 34)

- **Shop (P1.7b):** a Shop page in the 📒 book (a sixth tab with the gem balance) with the first Gem and Auction Token
  sinks. 🏚️ Barn rush (1 💎) finishes the running restoration stage; 📦 Parts crate (2 💎) gives 60 ⚙ once the
  crusher is open; 💰 Cash bag (4 💎) pays cash worth 12 average yard cars; 🎟 Token lot (4 🎟) puts a Good-condition car
  on your Used Car Lot with no cash price (needs a free spot). Rows that cannot be used say why; a row you can afford
  glows. Gem packs for real money are a "coming soon" line until P2.3. No cash-income change: gems arrive at about 3 a
  day, so the shop is a convenience (`npm run sim` pacing unchanged).
- Tests: 6 shop unit tests (no currency takes nothing, each item, locks, the barn tick); e2e: open the Shop page, prices
  and lock reasons, buy a cash bag, fits the screen.

## 0.33.0 - 2026-11-09 (run 33)

- **Gems and Auction Tokens (P1.7a):** a small wallet. 💎 Gems (the soft premium currency, bought with real money
  only after P2.3) come from medals (Silver 1, Gold 3, Diamond 8), the all-dailies bonus (3) and the login calendar
  (1 to 3 a day, 10 on day 7). 🎟 Auction Tokens (earn-only, never sold) come from finished daily tasks (1 each), the
  all-done bonus (2) and some calendar days. Neither touches cash income, so pacing is unchanged. Claim buttons, task
  cards, banners and toasts name them; the 📒 book header shows the balance once you own any. Both are kept when you
  sell your empire. Nothing spends them yet: the shop and the auction-token lots are P1.7b.
- **Fix (P1.6q):** on 320-359 px phones the five book tabs wrap into two rows, so "Bran…", "Clas…" and "Awar…" are
  whole words again.
- Tests: 9 wallet tests (caps, spending, every income source, kept on a sale, save round trip and junk repair);
  e2e: daily rewards pay gems and tokens and the banner names them, no book tab label is cut on a 320 px phone.

## 0.32.0 - 2026-11-09 (run 32)

- **Story chapter 2, Motor City (P1.6b):** "The Big City". Vince greets you after your first 5 sales in Motor City and
  points at his gold tower by the harbour; he grumbles when the Midtown Garage, the Auto Mall and Neon Customs open;
  and when your Motor City empire can be sold he gives up and puts his tower up for sale (chapter 2 complete, "On to
  the map"). Valvano Motors HQ now stands on the Motor City map (a gold tower with a purple V) with its own row in the
  list counting how often Vince has beaten you. Flavour only: no price, odds or pacing change.
- **Story log (P1.6c):** a new Story page in the 📒 book lists every chapter you have started and its scenes; tap a
  scene to read it again. Scenes still to come are locked, and the next chapter's city is teased.
- **Fix: the book could be wider than a small phone** once it had five tabs; the book's column now never grows past
  the screen and the first tab is called "Cars".
- Tests: 6 new story tests (chapter 2 order, no need for chapter 1, Rust Valley never plays it, a skipped business,
  the HQ on the map and its row, save repair, the story log). e2e: Vince's Motor City scene on an iPhone SE
  (e2e-22b3), the HQ on the Motor City map, five book tabs on a 320 px phone, the story log with a replayed scene
  (e2e-24d).

## 0.31.0 - 2026-11-09 (run 31)

- **Story chapter 1 and the rival Vince Valvano (P1.6):** Rust Valley now has a story. Five short scenes with painted
  portraits of Grandpa Joe and Vince Valvano (slick quiff, sunglasses, purple jacket, gold chain): Vince pulls up at 20
  sales and offers one dollar for the yard; Joe remembers his first garage when you open yours; Vince grabs the first
  auction lot you let go ("Sold, to the man in the gold jacket!"); he starts to worry when the paint shop opens; and
  when the empire can be sold he leaves for Motor City, closing chapter 1 and leading into the map and the sale. Lots
  Vince takes get a purple VINCE! stamp, and now and then he lures a yard customer away (flavour only: prices, odds
  and pacing are unchanged).
- **Fix: toasts printed over each other and over modals.** Two toasts at once (e.g. Vince and a new medal) now stack
  in a column (three at most), and a toast sits under an open modal instead of covering its title.
- Tests: 9 story tests (`story.test.ts`: order and gap, skipped businesses, Rust Valley only, Vince's lots and
  customers on the events, kept on a sale, save round-trip, old saves, repair, scene texts and toast pacing). e2e:
  Vince's scene at 20 sales with portraits (e2e-07s), the VINCE! stamp and toast on the auction board, chapter 1's end
  on an iPhone SE before the sale banner, opening the map (e2e-21s).

## 0.30.0 - 2026-11-09 (run 30)

- **Achievements (P1.5c):** 14 lifetime awards with four medals each (🥉 Bronze, 🥈 Silver, 🥇 Gold, 💎 Diamond): sell
  yard cars, earn in total, crush cars, perfect haggles, serve buyers, finish orders, find Legendary cars, restore barn
  classics, garage repairs, lot sales, paint orders, cars in the book, empires sold and daily rewards claimed. They
  count across every empire you build. A new medal shows a toast and a dot on 📒; the book has a new Awards tab
  (claimable awards first, a medal row and a progress bar to the next medal each) where you claim it for cash worth
  3-24 average yard cars. The book opens on Awards when a medal waits and no car is new.
- **Dailies outside the scrapyard (P1.5d):** the welcome-back popup now says what waits for you (today's calendar
  reward, finished daily tasks, the all-done bonus, medals to claim), and a daily task you finish in the garage, the
  lot or the paint shop shows a toast pointing to the scrapyard's Jobs board.
- **Fix: a long welcome-back popup on short phones.** With every business, a perk and the new waiting lines the popup
  could grow past an iPhone SE's screen and push Collect off it; it now scrolls inside (tighter lines under 600 px).
- Tests: 14 achievement tests (`achievements.test.ts`: definitions, direct and followed numbers through a reset, claim
  order and rewards, Legacy scaling, kept on a sale including the last moments, save round-trip, old-save backfill,
  repair, page view and toast texts), 1 daily test (popup lines and the toast) and a balance A/B (claiming every medal
  moves the first sale by 0.97-1.0x). e2e: medal toast, 📒 dot, Awards page, claim, dot clears, saved (e2e-03d); the
  welcome-back popup's waiting lines (e2e-04); the daily toast in the garage.

## 0.29.0 - 2026-11-09 (run 29)

- **Showcase (P1.4c):** a restored barn classic no longer has to be sold. The reveal now offers "🏆 Keep it (+0.5%
  income)" between "Sell it!" and "Later": no cash, but the classic stands in your showcase for good and every payout
  is 0.5% bigger, even after you sell your empire. You can keep one of each of the 16 classics (+8% at most); a repeat
  find can only be sold. Kept classics count for the Collection book like a sale. The book's Classics page shows
  "🏆 Showcase 3/16 · +1.5% all income" and kept cards on a gold plinth; the Sell Empire preview lists the showcase
  under what you keep. Tuned with a keep-vs-sell bot: +1% made keeping free even in the first empire, so it is +0.5%.
- **Daily tasks and a 7-day login calendar (P1.5a/b):** after 80 sales the Jobs board gets a 📅 Daily reward card and
  three daily tasks (from: sell cars, haggle, serve customers, crush wrecks, finish jobs, fix garage cars, sell lot cars,
  finish paint orders; only what you have unlocked). A new day starts at 04:00 UTC everywhere, so travelling or a
  clock change never gives a double or missed day, and winding the clock back does nothing. Rewards grow with your
  game (worth a number of average yard cars); finishing all three pays a bonus. The calendar pays once per day you
  play, a missed day does not reset it, and day 7 sends an Epic gift car to the yard. Kept when you sell your empire.
- Tests: 7 new unit tests (`showcase.test.ts`: keep pays nothing and records the classic, one per model, not before the
  reveal, the +8% cap, kept on a sale, save round-trip / old saves / repair, book and preview texts) and a balance A/B
  (keeping moves the first sale by 0.98-1.05x). e2e: keep a second classic (banner, no cash, book shows it), a repeat
  classic offers only Sell (e2e-12b/12c). 16 daily tests (`daily.test.ts`: reset hour, unlock and rolls, only open kinds,
  RNG untouched, picks per day, counter tracking through a reset, claims and bonus, new day, rewards scale, calendar
  steps / missed day / clock rewind / gift car, kept on a sale, save repair, texts). e2e: the daily flow (e2e-12d).

## 0.28.0 - 2026-11-09 (run 28)

- **Collection book screen (P1.4b):** a 📒 button in the top bar opens the book. Three pages (Car types, Brands, Classics)
  list every set with its progress and bonus, gold once complete. Every car has a card: a painted side view (a dark
  silhouette and "???" until you find it), its best rarity badge, three mastery stars and a bar to the next star. Cars
  found since your last visit wear a red NEW badge, and the 📒 button shows a red dot until you look.
- **Fix: crowded top bar on phones.** Late in the game (cash, rate, Legacy chip, parts and the buttons) the top bar ran
  off the right edge of 320-414 px screens and the chip slid over the cash. Up to 430 px the rate now sits under the
  cash, the sound toggle lives in Settings only and the buttons are a little smaller; under 360 px the Legacy chip and
  the parts counter stack.
- Tests: 6 new unit tests (`book-screen.test.ts`: NEW flags and marking seen, when the button shows, old saves and save
  repair of the flag, each entry's car type, card texts and star progress, shared silhouette thumbnails, page totals).
  e2e: the 📒 button waits for the quiet sales, shows its dot, opens on the car types page with the complete Van set,
  a NEW Rare entry, silhouettes and thumbnails, the Classics page has 16 cards, the dot clears; on an iPhone SE a full
  late-game top bar fits without overlaps and the book fits with two cards a row (e2e-24a..c). The garage road-wipe
  check records the wipe with a MutationObserver (it missed the 0.9 s wipe once on a busy machine).

## 0.27.0 - 2026-11-09 (run 27)

- **Prestige pacing (P1.3d4):** your second empire no longer takes longer than the first. Legacy Points now follow a
  softer curve (`floor((all-time earnings / $28M) ^ 0.8)`; the first sale still comes at about $500M), so the sale
  after a restart comes at ~3h23m for the always-tapping bot instead of 4h47m. Motor City is x3 instead of x5 (prices
  and payouts), which keeps its Legacy Points per hour about the same; each empire there is offered its sale a little
  sooner than the last (1h56m down to 1h27m). Existing saves keep all their points.
- **Collection book, rules (P1.4a):** every yard model (32) and barn classic (16) is an entry in the book. Selling a car
  records its model, the best rarity you sold it in, and mastery stars at 10, 50 and 200 sales (+1% value for that
  model each). Complete a set for a permanent bonus: every model of a family (+5% that family's value), one model of a
  brand in every family (+5% that brand's value), or all 16 barn classics (+25% barn sale value). A "SET COMPLETE!"
  banner and mastery toasts announce them. The book is kept when you sell your empire. The book screen comes next.
- Tests: 10 new unit tests (`collection-book.test.ts`: entries and sets, records and stars, family and brand sets, car value
  and idle income bonus with the same RNG stream, barn classics, kept on a sale, save round trip / old saves / repair,
  texts; the old square-root saves stay valid on the new curve). Balance: a 6-empire chain asserts each sale comes no
  later than the one before; the lot-tune check is averaged over 3 seeds. e2e: selling the 4th Van model completes the
  Van set (banner, book entry with its rarity); Motor City prices checked at x3.

## 0.26.0 - 2026-11-08 (run 26)

- **Neon nights in Motor City (P1.3d3c):** from 7 pm to 6 am on your device's clock, Motor City turns to night: a navy
  sky with stars and a crescent moon over the Salvage Yard, dark towers full of lit windows with glowing neon rooftop
  signs, and a floodlight over the work bay; a night street with a pink neon roof line outside the Midtown Garage; a
  warmly lit Auto Mall showroom with a glowing sign; a magenta neon tube in the Neon Customs booth. New **Settings →
  City lights: Auto / Day / Night** (shown in Motor City). Signs and lettering keep their daytime colours. Rust Valley
  stays sunny.
- **Fix (P1.3q2):** on small phones (320x568) the tap hint pill covered the lower half of the car's name and price in
  the paint shop. The hint sits 6 px lower and the label rises just enough to clear the pill's bob (garage, lot and
  paint shop share `carLabelTop`).
- **Fix:** on an iPhone SE the Settings sheet was taller than the screen in Motor City (the new City lights row pushed
  Done and Reset progress off the bottom, with no way to scroll). The sheet now scrolls and its rows are tighter on
  short screens; e2e asserts it fits or scrolls.
- Tests: 17 new unit tests (`nightThemes.test.ts`: only Motor City changes, night skies darker, towers visible against
  the sky, the lot's skyline and yard towers keep their shapes, stars and neon signs on 4 screens; the night rule by the
  hour and the setting; save repair of the setting; the label clamp). e2e: Settings → City lights → Night fits an
  iPhone SE on one line, then the paint shop, lot, garage and yard are sampled at night (e2e-22g to e2e-22k), and the
  paint shop's hint is checked to clear the car label. The day checks now pin City lights to Day, so they no longer
  depend on the test machine's clock.

## 0.25.0 - 2026-11-08 (run 25)

- **Motor City businesses (P1.3d3b):** the Midtown Garage has a steel-blue wall and pegboard, with dusk towers and lit
  windows outside the roller door; the Auto Mall stands under a dusk sky with tall hazy towers rising behind the
  showroom; Neon Customs has cooler steel-blue booth panels, icy light strips and a cyan accent stripe. Rust Valley looks
  exactly as before.
- Tests: 5 new unit tests (`cityThemes.test.ts`: a theme per city, the garage wall and booth panels are bluer in Motor
  City, the towers stay inside the door, the lot skyline covers the width, varies in height and leaves sky above it);
  e2e opens all three Motor City businesses and samples their backdrops (e2e-22e lot, e2e-22f paint shop).

## 0.24.0 - 2026-11-07 (run 24)

- **Motor City map (P1.3d2):** Motor City has its own map: steel-blue city blocks with pale sidewalks, a highway with
  traffic along the top, rooftops between the plots, street lamps, a zebra crossing and a harbour corner. Its
  businesses have city names on the map, in the list, in the drive wipe, in toasts and on the scene signs: **Salvage
  Yard, Midtown Garage, Auto Mall, Neon Customs**. The 🗺 button is labelled with the city and wears a small 🏙️ outside
  Rust Valley.
- **Motor City yard (P1.3d3a):** in Motor City the scrapyard sits under a dusk steel-blue sky with a two-row skyline
  (lit windows, a red antenna light) where Rust Valley has hills, on asphalt instead of dirt, behind a chain-link fence.
- Tests: 4 new unit tests (Motor City ground and plots, rooftops kept off plots and roads, city names everywhere and
  back to the defaults after a save repair, every name short enough for the signs and map labels); e2e checks the
  Motor City map, its list names, the map button and the drive to the Midtown Garage (e2e-22d). 5 more for the
  skyline (covers the width in two layered rows, leaves sky above, on 4 screens) and the yard themes; e2e samples the
  yard's ground colour in both cities (e2e-22b2).

## 0.23.0 - 2026-11-07 (run 23)

- **Motor City (P1.3d1):** the second city. From your **second** Sell Empire on, the preview asks "Where next?": stay in
  Rust Valley or move to Motor City. Motor City runs the same four businesses with every price and every payout x5 (a
  Wash Bay level costs $750 instead of $150, the Repair Garage unlocks at $1M, a wreck sells for five times as much),
  so a run feels the same but the bigger dollars bring Legacy Points much faster. The first sale shows
  "🏙️ Motor City opens on your 2nd sale"; the celebration says "Next stop: Motor City" and Grandpa Joe has a new line;
  the city map is titled with your city. Motor City's own map and art come next (P1.3d2/3).
- Balance: in the sim the third empire is offered the next sale at 2h28m in Motor City, against more than 5 hours in
  Rust Valley (x10 was tried: 1h51m and 51 points waiting, too generous).
- Fix (e2e flake): the short-phone paint shop check could lose its order ticket when the Painter finished the order
  during the resize.
- Tests: 8 new unit tests (`cities.test.ts`: unlock and picking rules, every price and every value x scale, Head Start
  and the save allowance, save repair, preview texts), a Motor City balance run, and e2e: the picker on an iPhone SE,
  picking both cities, the celebration line, the reload into Motor City, x5 prices and the map title (e2e-22a to 22c).

## 0.22.0 - 2026-11-07 (run 22)

- **Legacy perks show where they act (P1.3e):** owned Legacy tree upgrades appear as small gold chips on the screens
  they change: "👐 +25% taps" and "💎 rares x1.3" above the Upgrades cards, "👷 crew +30%" on the Crew tabs,
  "🔨 auctions −10%" on the auction board, a "🗣️ zone +30%" badge on the haggle slider, "🏢 opening −25%" on the city
  map's open line and "🌙 4h cap" in the welcome-back popup.
- **Node-bought animation:** buying a Legacy node pops its row with a gold glow, stamps "✓ Owned", floats "−3 🏛" up and
  pulses the free-points header (a static highlight with Reduce motion).
- **Fix:** the welcome-back popup said "Your crew kept working for 5h" even though crews stop at the offline cap (2 h,
  4 h with Night Shift). It now shows the time actually worked and adds "You were away 5h 0m; crews work up to 2h 0m
  while you're gone."
- Tests: 7 new unit tests (labels from the config, chips per tab, every perk named on some screen, the Franchise map
  line, the away-time lines with and without Night Shift); e2e buys a node and checks the animation, the Upgrades chip
  row on an iPhone SE, the Night Shift welcome-back after 3 hours away and the Silver Tongue haggle badge
  (screenshots e2e-21g to e2e-21j).

## 0.21.0 - 2026-11-07 (run 21)

- **Legacy tree (P1.3c):** tap the gold 🏛 Legacy chip to spend Legacy Points on three branches of four upgrades,
  bought in order. **Mechanic:** Quick Hands (+25% tap work everywhere), Head Start (new empires start with $5K and the
  Mechanic), Parts Hoarder (+50% crusher parts), Master Crew (all crew 30% faster). **Dealer:** Silver Tongue (wider
  PERFECT haggle zone, drawn on the slider), Regulars (buyers 25% more often), Insider (auctions 10% cheaper),
  Franchise (businesses 25% cheaper to open). **Racer:** Quick Tips (+1 s per service on the paint tip), Rare Finds
  (rarer cars x1.3 as often), Barn Scout (barn finds twice as often, stages 20% faster), Night Shift (offline cap
  +2 h). Costs 2/3/5/8 points per branch. Spending never lowers your income bonus: spent points keep their +2%.
  One free respec per empire. A red dot on the chip and the branch tabs shows when something is affordable.
- Balance: every branch makes the second empire faster (+6% to +12% earnings at 4 hours with the first 10 points);
  Rare Finds was cut from x1.5 to x1.3 so the Racer branch doesn't dominate.
- Tests: 17 unit tests for the tree (buying in order, costs, respec once per empire, save repair and round trip, each
  of the 12 effects in the rules that use it, Head Start saves loading), 3 for the tree screen texts, a branch A/B in
  the balance sim; e2e opens the tree on a 320 px iPhone SE, checks it fits, buys nodes, respecs and reloads
  (screenshots e2e-21e/f).

## 0.20.0 - 2026-11-07 (run 20)

- **Sell Empire (P1.3b):** once selling would give 10 or more Legacy Points, an "EMPIRE FOR SALE!" banner shows and
  the city map gets a gold, glowing "🏛 Sell Empire" row ("+12 Legacy Points · income x1.00 → x1.24"). Its preview
  shows the points, the new income multiplier, what you keep (Legacy Points, the Collection book, stats and settings),
  what starts over (cash, upgrades, crew, every business and car, parts, jobs, the barn) and how long this empire took.
  Confirming plays a confetti celebration with a line from Grandpa Joe, then a fresh scrapyard starts.
- A gold **Legacy chip** ("🏛 x1.24") sits in the top bar once you own points; tap it for your points, the fastest
  empire and how much more you need to earn for the next sale. After a sale the map shows that goal too.
- **Fixes:** the 🗺 map button no longer shows before 30 sales (it was always drawn; only its dot was hidden). On
  320 px-wide phones the panel's tabs and x1/x10/Max buttons fit again, and opening a popup no longer slides the whole
  game sideways.
- Tests: 10 unit tests for the Sell Empire texts (row threshold, offline cash counts, glow, preview, badge, next-sale
  line, save round trip, old saves); e2e plays a full sale on an iPhone SE (banner, map dot, map row, preview fits the
  screen, "Not yet", the sale, celebration, reload into the new empire, HUD chip fits, chip info), screenshots e2e-21a-d.

## 0.19.0 - 2026-11-07 (run 19)

- **Paint shop customers speak (P1.2g):** as the customer steps out of their car they say what they want in a speech
  bubble ("Make it pop!", "Bling it up!", "Stripes! Lots of stripes!", "Make it roar!", or "The full works, please!"
  for a three-service order). The tip clock is already running, so the bubble is laid out beside the order ticket,
  never on top of it.
- **Short phones:** on screens about 560 px tall the car stands lower and is drawn a little smaller, so the purple
  "PAINT & TUNING" sign keeps its lettering and the ticket no longer touches the booth row with two or more booths.
- **Prestige core (P1.3a, no button yet):** Legacy Points from the square root of everything you have ever earned,
  +2% to all income per point, and the rules for selling the empire (what resets, what you keep). The button and the
  preview screen come next (P1.3b). Old saves start with no points.
- Tests: 13 prestige unit tests (points, offer and glow rules, the sale, a second sale, the multiplier in every
  business, saves and repair) and a 7-hour sim of a first and second empire.
- Tests: speech-bubble and stage geometry unit-tested on 7 screen sizes (bubble never covers the ticket, stays on
  screen, tail at the head; ticket clears the booth row with room for the sign; the customer stands above the panel);
  e2e checks the bubble on the iPhone and on a 375x560 phone with two booths (new screenshot e2e-20f).

## 0.18.0 - 2026-11-07 (run 18)

- **Lot cars through the paint shop (P1.2f):** once Paint & Tuning is open, a refurbished car on the Used Car Lot shows
  a purple Tune button beside Sell ("⚙️ Tune +$151K"). It drives to a free booth for one service that suits it (respray
  for sedans and vans, rims for hatches, pickups and SUVs, a wrap for sports cars, an engine tune for muscle cars and
  hypercars). In the shop it has no customer and its ticket reads "🏷️ +$151K sticker"; tap it or let the Painter.
  It comes back with the service on its FOR SALE tag and a higher price (a respray or wrap in the new colour). While
  it's away its thumbnail fades ("At the shop"), walk-up buyers pick another car and it can't be sold. Once per car.
- Balance: the sticker bonus is the shop's fee for that service (with Hype) x 1.0. An active bot that sends a lot car
  into every free booth ends 3 hours with +8% lifetime earnings (0.8 gave +3%, 0.6 lost money), so it's a choice
  between tipped customers and a fatter sticker.
- Saves: lot cars and booth jobs that point at each other are repaired on load (a car marked away without its job
  comes back; a lot job without its car goes).
- Tests: 8 new unit tests (when a car can go, the booth it takes, the sticker it gets back, respray colour, the Painter,
  walk-up buyers leaving it alone, save round-trip and repair, old saves), a 180-minute sim comparing bots with and
  without tuning, and an e2e section (Tune button beside Sell, send, the shop's lot ticket with no customer, back on
  the lot with the higher tag, no shop charge).

## 0.17.0 - 2026-11-07 (run 17)

- **Paint & Tuning is open for business (P1.2e), business 4:** earn $50M in total, open it on the map for $25M and
  tap "Go". A spray booth with a purple sign, fans, paint cans and a floor grate. Customers drive in with an order
  ticket on the roof: an icon per service, the current one ringed, a progress bar and a "⚡ +$30K tip · 8s" timer.
  Tap the car: a respray or wrap sweeps the new colour across the car with coloured mist, custom rims (black and
  gold, red calipers) fade in, an engine tune adds a flame decal and shoots fire from a chrome exhaust. "✓ Respray"
  floats up after each service; the finished car drives off with coins and a gold "Quick tip" when you were fast.
- Shop and Crew tabs (Spray Booth, Hype, Extra Booth; the Painter in white overalls with a spray gun, who works on his
  own and offline), booth thumbnails for 2-3 booths, tap hints for the first orders, a first-tip toast, a welcome-back
  line ("🎨 The Painter finished paint and tuning orders"), "Back to the paint shop" on the map, and map art that grows
  with booths (a second door with a fresh car at 2, a neon spray can on the roof at 3).
- Sound: a spray-gun hiss and an engine rev.
- Tests: 10 new unit tests (booth layout on 4 screen sizes with the sign above the ticket, service reveal per layer,
  reveal never goes backwards over a real order, wrap stripe contrast, exhaust spot on every car, map tier art), and an
  e2e section (open and go, tabs, a three-service order tapped through with every layer checked, the tip paid,
  upgrades, booth 2, the Painter finishing an order alone, reload, map tier, offline line).

## 0.16.0 - 2026-11-06 (run 16)

- **Paint & Tuning rules (P1.2d), business 4:** customers bring an order of one to three services (Respray, Custom
  rims, Vinyl wrap, Engine tune) that the booth works through in order. Bigger orders pay a combo bonus (+15% per extra
  service), and finishing an order yourself quickly (3 s per service) earns a +25% tip. Upgrades: Spray Booth (speed),
  Hype (fees), up to 3 paint booths; the Painter works on his own and while you're away. The shop stays "coming soon"
  on the map until its scene arrives in the next update.
- CI: GitHub Actions runs only on pull requests into `main` and on `main`, cancelling superseded runs (saves free
  minutes; every change is still fully checked locally before each push).
- Balance: fees tuned with a new 3-hour bot run (an active player opens the shop at about 1h35m; it makes 41% of all
  earnings by 3 h, the lot still 20%).
- Tests: 18 new unit tests (orders, combo fee, step-by-step work, tips only for quick hand-finished orders, upgrades,
  booths, Painter, exact expected order vs 4,000 real ones, idle vs real income, offline, map tiers, saves and repair),
  and a 180-minute pacing check in the balance simulator.

## 0.15.0 - 2026-11-06 (run 15)

- **Auction feel (P1.2c):** every auction card counts down its bid ("⏱ 32s"), says "🔨 Going… 5s" with a red,
  pulsing timer in the last 8 seconds, and gets a rubber stamp when it goes: a red "SOLD!" when another bidder wins it,
  a green "YOURS!" (or "AGENT WON!") with a gavel knock when you buy it. A soft "aww" plays when you miss a lot.
- **Walk-up buyers with personalities:** Family, Collector, Speed Freak, Tradie and Influencer buyers now visit the lot.
  Each walks up to a car, leans in to look it over, says what they think ("All original? Marvellous!", "Plenty of room
  for tools!") and pays a bonus for the cars they like: the Collector +30% for cars you bought in Good or Mint
  condition, the Influencer +40% for sports cars and hypercars. A "Collector paid +30%" note and a ding show the bonus.
  The buyer's icon shows on a spot thumbnail when they look at a car that isn't on the platform.
- Fix: the auction cards no longer clip their Buy button.
- Balance: idle lot income includes the average buyer bonus (about +6-9%); pacing unchanged (sim run 15).
- Tests: 8 new unit tests (buyer bonuses, unlocks, arrive-look-pay timing, best-car choice, buyer leaves when the car
  is sold, idle bonus, save repair, buyer lines). E2e: bid countdown, "Going…", SOLD! and YOURS! stamps, auction
  cards hold their button, a buyer looks a car over with a speech bubble and then buys it.

## 0.14.0 - 2026-11-06 (run 14)

- **Used Car Lot (P1.2a/b), business 3:** earn $5M in total, open it on the map for $2.5M and tap "Go". Buy used cars
  at the auction board (three lots, each showing its condition in stars, price, sale price and profit before you bid),
  refurbish them on the display platform by tapping (the rust fades, a FOR SALE tag swings from the windscreen), then
  sell with the haggle slider or let a walk-up buyer pay the list price. Rough cars are cheap and take work; mint ones
  are quick flips. Lot tab: Valet Bay, Showroom, Forecourt Spots (up to 4 cars, thumbnails above the platform). Crew:
  the Detailer refurbishes on his own and the Auction Agent bids for you; with both the lot earns while you're away
  (shown in the welcome-back popup).
- New forecourt scene drawn in code: sky and skyline, a glass showroom whose roof band is the "USED CAR LOT" sign,
  pennant bunting, angled bay lines and a turntable platform; the Detailer (green polo, backwards cap, spray bottle).
- The lot grows on the city map: one row of cars, a second row at 3 spots, a gold balloon and price tags at 4.
- Balance: tuned with the 2-hour sim (the lot started at 81% of all earnings; now 55% for an active player, 34%
  relaxed); Paint & Tuning's goal now arrives around 1h20m-1h45m.
- Tests: 28 new unit tests (auction, refurbish, haggled and walk-up sales, upgrades, spots and tiers, Auction Agent,
  Detailer, idle vs real income, offline, save round-trip and repair, haggle hold, backdrop layout on four screen
  sizes, condition art, map tiers) and a 120-minute bot run. E2e: open the lot, its tabs, the auction board, buy a
  rough car, refurbish it by tapping, the FOR SALE tag and Sell button, haggled sale, upgrades, crew working on their
  own, reload into the lot, the map tier and back button, the lot's line in the welcome-back popup.

## 0.13.0 - 2026-11-06 (run 13)

- **Garage feel (P1.1f):** customers now say what's wrong when they step out ("Ran over a nail!", "It won't start!",
  "Smoke from the bonnet!"; three lines per fault) in a speech bubble above their head; the fault bubble pops up
  after it. Fixing a flat tyre rolls a fresh tyre onto the front wheel, and the car drives off on it.
- **Slimmer bay row:** the garage's bay thumbnails are shorter and more solid, with the fault icon in the corner, so the
  roller door and the sign read better on short phones and the car sits 12 px higher.
- **Map tiers (P1.1d):** your businesses grow on the Rust Valley map. Each has three stars: the scrapyard gets a second
  car and the crusher at 3 lot slots, then a site office and a gold flag at 4; the garage rolls up a door with a car
  inside at 2 bays and lights its roof at 3. The map list shows the stars and what the next one needs.
- **Drive between businesses:** "Go" on the map now sweeps a road across the screen with the destination's sign while
  the scene changes (instant with Reduce motion).
- Fix: the yard's "LEGENDARY!" banner (and the buyer's bell) no longer pop up over the garage; they belonged to a car
  in the yard you couldn't see.
- Fix: the map list's Go / Open buttons were full width and squeezed the row's text into one word per line; they
  keep their own size now. Fix: the fault bubble no longer flashes for a moment before the customer speaks.
- Tests: 6 new unit tests (bay row size, customer lines, tyre painting, yard-only announcements, map tiers, tier art on
  the map). E2e: the road wipe on "Go", the garage at tier 2 on the map with stars and the next goal, the customer
  talks before the fault bubble, the speech bubble stays on screen above the head, no Legendary banner in the garage,
  the tyre swap fits the new tyre on the front wheel and it leaves with the car.

## 0.12.0 - 2026-11-06 (run 12)

- **Garage art pass (P1.1e):** the lift's cross beam now carries a "REPAIR GARAGE" sign that stays clear of the top
  bar, the bay thumbnails and the car. Each customer car drives in, the lift raises it a little (arms under the sills,
  the floor shadow fades) and the customer steps out to wait beside it, then hops and walks off when it is fixed. The
  Foreman is drawn in the workshop (navy overalls, red cap, clipboard, spanner) and bobs while he works.
- **Faults you can see:** a flat tyre makes the car lean with the tyre bulging flat, a dead battery throws blue sparks
  at the front, hot brakes glow through the rear wheel; engine and exhaust jobs keep their smoke. Customer cars have
  light rust now (they are daily drivers, not wrecks). The fault bubble waits until the car has parked.
- **SUV redraw (P1.1y):** higher ground clearance, a raked rear pillar and a spare wheel on the tailgate. Every pair of
  car types now shares under 75% of its outline (van/SUV 0.81 -> 0.74).
- Fix: a car texture freed after a drive-off could be read by the next frame ("sourceSize" of null), which stopped
  the game loop; the images now point at a stock texture first. The e2e prints page errors when it fails.
- Tests: 5 new unit tests (sign placement on four phone sizes and a short screen, customer looks, lighter rust, SUV
  features, every family pair < 0.75). E2e: lift raised and customer waiting, light rust, flat tyre tilt and bulge,
  brake glow, battery sparks, the Foreman beside the car, the Foreman in the art gallery.

## 0.11.0 - 2026-11-06 (run 11)

- **The Repair Garage opens (P1.1c):** once you have earned $200K in total, the city map offers the garage for $100K.
  "Go" drives you there: a teal workshop with a roller door, a pegboard of tools and a two-post lift. Customers drive
  in with one fault (flat tyre, dead battery, worn brakes, rusty exhaust or engine trouble) shown in a bubble with a
  progress bar; tap the car to fix it and the customer pays and drives off. Engine and exhaust jobs smoke.
- **Yard parts help the garage:** a fix uses the scrapyard's spare parts when there are any; without them the garage
  buys parts and a 30% parts bill comes off the fee.
- **Garage upgrades and crew:** Tool Wall (faster repairs, x2 at the usual milestones), Reputation (+12% fees per
  level), Repair Bays 2 and 3 (more customers waiting, shown as thumbnails above the lift) and the Foreman, who fixes
  cars on his own, also while you're away (the welcome-back popup shows what he earned).
- The scrapyard keeps running while you are in the garage; the map takes you back ("Back to the garage" closes it).
  The game remembers which business you were in.
- 22 new unit tests (171 total): garage rules, fees, parts, upgrades, Foreman, idle/offline income vs the real
  simulation, save repair, backdrop layout. The balance sim plays the garage (opens at 14m24s, 35% of earnings at
  40 min). E2e: open and enter the garage, tap a car to fix it (with and without yard parts), the yard selling in the
  background, upgrades, a second bay, the Foreman, reload into the garage, back to the yard, offline garage earnings.

## 0.10.0 - 2026-11-06 (run 10)

- **City map (first slice of P1.1):** after 30 sales a 🗺 button appears in the top bar (with a red dot and a
  "CITY MAP!" banner until you open it). The map shows Rust Valley: your scrapyard with a "you are here" pin, the
  Repair Garage with a padlock whose ring fills as you earn, and the Used Car Lot and Paint & Tuning shop greyed out
  further up the road. The list under the map shows the goal ("Earn $200K in total to unlock") and a live progress bar.
  The garage itself opens in the next slice (P1.1c); until then it shows "SOON" once its goal is reached.
- **Businesses in the save:** the save format is now version 2 (`businesses`: which are open, which is on screen);
  older saves upgrade automatically through the first real save migration, and impossible values are repaired.
- **Car art:** the muscle car is boxier with a flat high hood, a set-back cabin and a hood scoop; the hatchback is lower
  and rounder with a steep hatch. Neither looks like the sports car or SUV any more (outline overlap 0.83 -> 0.69 and
  0.86 -> 0.64).
- Fix: the yard did not re-lay itself out when the customer strip appeared under the top bar (the horizon, slot row
  and bay kept their first positions). It now checks twice a second and lays out again when the HUD changes height.
- 17 new unit tests (149 total): business rules, the v1 -> v2 migration, map SVG and rows, family silhouettes. The
  balance sim prints when the map opens and when the garage goal is reached (12 seeds). E2e covers the map button,
  dot, map contents, progress, the "soon" state, fitting the phone screen, and the re-layout under the customer strip.

## 0.9.0 - 2026-11-06 (run 9)

- **Sharper cars everywhere:** the stair-steps on car outlines are gone. Root cause: Phaser switches on pixel-art mode
  (nearest-neighbour filtering) by itself whenever the game is zoomed, and we zoom by 1/devicePixelRatio. Smooth
  filtering is now forced on, car textures are powers of two sized to the bay (1024x512, or 512x256 on 1x screens)
  and WebGL builds trilinear mipmaps, so lot thumbnails scale down cleanly too.
- **New hypercar look:** very low, with a cab-forward bubble canopy, a shark fin along the engine deck, a taller wing,
  a front splitter and rear diffuser and slim LED headlights. It no longer looks like the sports car at thumbnail size.
- **Painted yard:** the backdrop is now one smooth Canvas 2D painting: sky gradient, glowing sun, clouds, two hill
  layers, rounded junk piles with tyres and scrap panels, shaded fence posts, a dirt ground with an oil stain and a
  concrete work bay with a soft shadow. The pile behind the customer moved aside so customers read clearly.
- **Collection counts:** every sale counts its car type for the upcoming Collection book; the first sale of a type
  shows a toast ("📒 First Van sold! Collection: 4/8 car types"). The starter types count quietly in the first 10 sales.
- 14 new unit tests (132 total): hypercar silhouette overlap with every other family, power-of-two texture sizes,
  backdrop layout, collection counts and their save handling. E2e checks smooth filtering, mipmapped car textures,
  the backdrop texture, the per-family counts and the first-Van toast.
- Fix (test): the "press slams" e2e check ran after a 3x screenshot that could outlast the 620 ms slam; it checks first now.

## 0.8.0 - 2026-11-05 (run 8)

- **Scrapper while you're away:** with the full crew and the Scrapper hired, the parts bin is topped up to the
  Scrapper's target while you're away (plus a little scrap cash); the welcome-back popup says "+N ⚙".
- **The Scrapper on screen:** a worker in an orange hard hat stands beside a small hydraulic press next to the barn and
  pulls the lever on every auto-crush; crushing a lot thumbnail now shows a mini press slamming the car flat.
- **Barn restorations you can watch:** the barn is repainted in smooth Canvas 2D art, and the doorway shows each stage:
  a tow chain on the tarp-covered wreck, an engine hoist with the tarp folded back, a welder's glow on the rusty body,
  plastic paint-booth sheets around the primer-grey car, a clean tarp when it's done and the shiny classic after the
  reveal. A work lamp lights the barn while a stage runs, with sparks or dust at the door.
- **Drive-out reveal:** tapping Reveal rolls the covered classic out of the barn door and up to the front before the
  tarp comes off (skipped with reduce motion). The new tarp is antialiased and covers every body shape; banners such as
  "RESTORED!" no longer cover the reveal.
- **Barn card up front:** once the barn opens, its card leads the Yard tab (it used to sit below the fold on phones);
  tapping the barn scrolls to the card and flashes it, and a red dot on the barn sign shows when there is something to
  do (an affordable stage, a reveal or a sale).
- Fix: empty lot slots were drawn behind the backdrop (invisible); they show as faint outlines now.
- 8 new unit tests (118 total); e2e checks the Scrapper station and its press, the offline parts line, the barn art for
  every stage, the drive-out, the barn card position and dot, and that the reveal tarp covers vans, SUVs and pickups.
- Fix (test): the e2e "hour away" check never really simulated an hour (the page saved over the edited save on reload);
  it now blocks saves before the reload and asserts the popup says 1h.

## 0.7.0 - 2026-11-05 (run 7)

- **Customers you can see:** every buyer is a little character drawn in code who walks into the yard, waits beside
  the bay and walks off when served or tired of waiting (no walking with reduce motion).
- **Two new buyers:** the Tradie (after 20 sales) pays +20% for a Pickup, so every car type now has a buyer; the
  Influencer (after 100 sales) pays +50% for a Sports Car or Hypercar.
- **Skip haggling** setting: sell at the asking price without the slider.
- Balance: the barn sale goes x55 -> x50 of the expected car value, and a new 12-seed balance check replaces luck of a
  single seed (Salesperson avg 9m52s, barn share avg 18%, max 24%).
- 4 new unit tests (110 total); e2e checks the customer standing in the yard, the skip-haggling sale and all six
  customers in the art gallery.

## 0.6.0 - 2026-11-05 (run 6)

- **Hydraulic Press upgrade** (Upgrades tab once the crusher unlocks): each level makes the press faster (down to
  1.2 s) and adds 10% more parts per crush. The Crush button and the Epic/Legendary prompt show the upgraded parts.
- **Scrapper** crew member ($40K, Crew tab once the crusher unlocks): while the parts bin is low (under 10, or
  under what the next barn stage needs) it crushes a fresh Common wreck, then rests 8 s. Never Rare+ cars, never
  a car anyone has started on.
- The Crew tab's "something to buy" dot ignores the Scrapper while it is locked.
- Balance bots buy press levels and hire the Scrapper; a new 30-minute sim checks the Scrapper only tops up the
  bin (under 25% of sales; it crushes about 3%).
- **Free order swap** on the Jobs board: each active order can be swapped once for a different one with a fresh
  timer ("🔄 Swap order (free)"); the swapped-in order can't be swapped again.
- 12 new unit tests (106 total); e2e buys a press level, hires the Scrapper, waits for an auto-crush and swaps an order.

## 0.5.0 - 2026-11-05 (run 5)

- **Four new car families:** Vans (after 15 sales), SUVs (40), Sports Cars (100, rarer) and Hypercars (200, rarest),
  each with its own body, fictional models and barn classics, announced with a "NEW CARS!" banner. Family buyers now
  want any family car (sedan, van, SUV), Speed Freaks any fast car (muscle, sports, hyper).
- **New car art:** cars are painted with Canvas 2D: smooth antialiased edges, rounded corners, paint gradient and
  gloss, wheel arches, door handles, roof racks, wings and intakes; legendary cars get gold rims; rust is clipped to
  the body and drawn as patchy clusters. Debug art sheet at `?debug=1&gallery=1`.
- **Haptics:** subtle vibrations on taps, repairs, sales, purchases, crushes and celebrations; new Vibration switch
  in Settings (off = no buzz; sound has its own switch).
- Floating reward texts stack instead of overlapping; big banners queue instead of cutting each other off.
- Contract rewards, barn prices and idle income use the expected value of the unlocked families; barn sale x60 -> x55.
- Saves with an unknown car family or rarity drop that car instead of crashing.
- 18 new unit tests (94 total); e2e covers the van unlock banner, haptics, the Vibration setting, stacked crush
  rewards and an art check (all 8 families drawn, antialiased edges) with a gallery screenshot.

## 0.4.0 - 2026-11-05 (run 4)

- **Barn find** (after 60 sales): a little red barn at the back of the yard hides a covered classic. Restore it in
  four timed stages (tow, engine, body, paint) paid with cash and parts; timers keep running while you're away.
  Pull off the tarp for a slow-motion reveal with light rays and sell the Legendary classic to a collector.
  The next, bigger find arrives 5 minutes later. Spare parts are saved for a stage that needs them.
- **Settings sheet** (☰ in the top bar): sound, music (saved for later), reduce motion (no shake or flashes),
  number format (1.5M or 1.5e6), reset progress with a confirm step, credits.
- A random Legendary arrival now says "LEGENDARY!" (the barn has the "BARN FIND!" banner).
- Balance bots restore the barn (saving up for stages, crushing for parts); the sim checks the barn stays a
  bonus (< 25% of first-15-minute earnings) and that an active player sells one in the first session.
- 14 new unit tests (76 total); e2e covers the barn (tap, all stages, reveal, sale) and every setting, including reset.

## 0.3.0 - 2026-11-05 (run 3)

- **Haggle:** timing slider on big manual sales (lesson on the 2nd sale, Rare+ cars, buyer matches),
  0.9x-1.3x with a PERFECT zone; the Salesperson waits while you haggle.
- **Customer personalities:** Bargain Hunter, Collector, Speed Freak and Family wait in the yard one at a time
  and pay a bonus for the car they want; gold Sell button and buyer strip when the car matches; doorbell sound.
- Balance: Washer $25K -> $30K, Salesperson $75K -> $90K to keep full automation near the old pacing.
- Balance bots haggle on big sales; the sim checks haggle+buyer bonus stays under 15% of earnings.
- 19 new unit tests (62 total); e2e covers the lesson haggle, the buyer strip and a buyer-match sale.

## 0.2.0 - 2026-11-05 (run 2)

- **Car crusher:** crush unfinished wrecks under a hydraulic press for Parts and scrap cash;
  Epic/Legendary cars ask first. Parts show in the top bar and are spent automatically to halve repairs.
- **Contracts board:** new Jobs tab with three timed orders (sell, body type, Rare+, crush) and rewards.
- Unlock banners for both; the tutorial hint moves aside when the Crush button shows.
- Modals support a separate secondary action.
- Balance simulator is deterministic and checks crusher/contract unlock times and contract income share.
- 15 new unit tests (43 total); e2e covers crushing, the Epic confirm, spare parts and claiming a contract.

## 0.1.0 — 2026-11-05

First playable prototype: Grandpa Joe's scrapyard.

- Wash (swipe), repair (tap) and sell wrecks; coin burst and sounds.
- Upgrades with x1/x10/Max buying and milestones; crew of three; up to 4 lot slots.
- Offline earnings with a welcome-back popup.
- Save system with two slots, checksum, versioning and sanity checks.
- 28 unit tests, a balance simulator and a browser end-to-end test.

- Run 42: lot, barn, crush, Sell Empire and Welcome back texts in `ui.ts` moved to the i18n catalog (P1.9b).
