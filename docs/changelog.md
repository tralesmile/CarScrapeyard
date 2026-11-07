# Changelog

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
