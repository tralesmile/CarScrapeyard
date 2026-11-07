# Game design summary

Full design lives in the master plan: https://claude.ai/artifact/BNiKw18kSChwfuMPPHGJGS
This file records what is actually built and any decisions that differ from the plan.

## Pitch

You inherit Grandpa Joe's rusty scrapyard. Pressure-wash and fix wrecks, sell them, hire a crew
to automate it, open new car businesses, then sell your empire and start again in a new city, stronger.

## Built so far (prototype, Rust Valley scrapyard)

- **Core loop:** a wreck drives in → swipe to pressure-wash (the mud really erases under your finger)
  → tap to repair (rust fades, sparks) → Sell button → coins fly to the cash counter.
- **Upgrades:** Wash Bay (wash power), Repair Bench (repair power), Junk Supplier (car value).
  Buy x1, x10 or Max. Wash/Repair double at levels 10, 25, 50, 100, 200.
- **Crew:** Mechanic (auto-repair), Washer (auto-wash), Salesperson (auto-sell). Each works one car at a time.
- **Lot Space:** up to 4 cars in the yard at once; tap a car in the top row to work on it.
- **Cars:** 8 body families, 10 paints, 4 rarities (Common, Rare, Epic, Legendary at 0.5%). Sedan, hatchback,
  pickup and muscle from the start; vans (15 sales), SUVs (40), sports cars (100) and hypercars (200) roll in later
  with a "NEW CARS!" banner, each worth more and the last two rarer. Rare+ cars get trim stripes, Legendary gold rims.
- **Car art:** painted with the Canvas 2D API (antialiased, rounded corners, body gradient, gloss, wheel arches,
  door seams, roof rack on SUVs, intakes and wings on sports/hyper). The hypercar has its own silhouette: very low,
  cab-forward bubble canopy, shark fin on the engine deck, tall wing, splitter and slim LED lights. Car textures are
  1024x512 (512x256 on 1x screens) with trilinear mipmaps, so the bay car and the lot thumbnails stay smooth.
  Review sheet: `?debug=1&gallery=1`.
- **Yard backdrop:** one Canvas 2D painting per screen size: sky gradient, sun glow, clouds, two hill layers, junk
  piles with tyres and scrap panels (kept clear of the customer's spot), fence, ground and the concrete work bay.
- **Collection counts:** every sale counts its car type for the Collection book (P1.4). The first sale of a type shows
  "📒 First Van sold! Collection: 5/8 car types" (the four starter types are counted quietly in the first 10 sales).
- **Haptics:** short vibrations on taps, sales, crushes, purchases and celebrations (navigator.vibrate on the web;
  the Capacitor Haptics plugin later). Own on/off switch in Settings, independent of sound.
- **Reward texts** that land together (crush: "+6 Parts" and "+$110") stack upwards; banners queue instead of
  replacing each other.
- **Offline earnings:** with the full crew hired, the yard earns while you're away
  (50% rate, up to 2 hours). Shown in a "Welcome back" popup; kept in the save until collected.
- **Car crusher** (unlocks after 25 sales, about minute 3): a Crush button beside the bay squashes the
  current unfinished wreck under a hydraulic press (shake, sparks, dust) for Parts (6/10/16/30 by rarity)
  plus 15% of its value as scrap cash. 3-second cooldown. Epic and Legendary cars ask first.
  **Hydraulic Press** (Upgrades tab, after the crusher unlocks): faster press and more parts per crush.
  **Scrapper** (Crew tab, after the crusher unlocks, $40K): keeps the parts bin topped up by crushing a fresh
  Common wreck every 8 s or so while parts are low (more if the barn's next stage needs them). It never touches
  Rare+ cars or a car anyone has started washing; a "♻ Scrapper" text shows each auto-crush. Once hired, the Scrapper
  stands beside a little press next to the barn and pulls the lever on each auto-crush; lot thumbnails get a mini press too.
  While you're away it keeps working: the welcome-back popup says how many parts it added (it only fills the bin to its target).
  Finished cars can't be crushed (sell them). **Parts** show in the top bar: when a car finishes washing
  and you have 2+ parts, 2 are spent automatically to halve its damage ("Spare parts!").
- **Contracts board** (Jobs tab, unlocks after 45 sales, about minute 5): three orders at a time —
  sell N cars, sell N of a body type, sell Rare+ cars, crush N wrecks — each with a 10-minute timer and a
  cash reward (crush orders also pay parts). Finished orders wait to be claimed; a new order arrives
  45 s after one is claimed or expires. The same order never sits on the board twice. Each order can be swapped
  once for free ("🔄 Swap order"): a different order with a fresh timer. The swapped-in order can't be swapped again.
- **Haggle** (from the 2nd sale): a timing slider on big manual sales. A needle sweeps a red-gold-green bar;
  tapping stops it and the price is multiplied by 0.9 (edge) to 1.3 (PERFECT, centre zone). Only big sales
  haggle — the lesson on the 2nd sale ever (slow needle, always at least x1.2), Rare+ cars, and cars the waiting
  buyer wants — so the plain loop stays quick. Untouched, it closes at x1 after 4 s; the Salesperson waits meanwhile.
- **Customer personalities** (after 10 sales): one buyer at a time waits in the yard (strip under the top bar,
  patience bar 75 s). Bargain Hunter wants a Hatchback (+15%), Collector a Rare+ car (+40%), Speed Freak a
  fast car (muscle/sports/hyper, +25%), Family a family car (sedan/van/SUV, +20%); the Tradie (after 20 sales)
  wants a Pickup (+20%) and the Influencer (after 100 sales) a Sports Car or Hypercar (+50%). Selling a matching car
  pays the bonus (also for crew sales) and the next buyer arrives 8 s later; the Sell button turns gold and names the
  buyer when the car matches. Each customer is drawn as a little character (cap and coupon, top hat and monocle,
  sunglasses, parent with a kid, hard hat, selfie phone) who walks into the yard, idles, and walks off.
  **Skip haggling** in Settings sells at the asking price without the slider.
- **Barn find** (after 60 sales, about minute 5–8): a little red barn appears at the back of the yard with a
  car under a tarp. Tapping it opens its card, which leads the Yard tab; a red dot on the barn sign means there is
  something to do. Four stages — Tow it out, Rebuild the engine,
  Fix the body, Fresh paint — each cost cash (and parts for the engine and body) and take 20 s to 90 s; the
  timer keeps going while the game is closed (one stage at most). While the next stage needs parts, spare parts
  are not spent on repairs. The barn doorway shows the work in progress (tow chain, engine hoist, welder, paint-booth
  sheets; the car goes from rusty to primer grey to painted). When done, "Reveal!" rolls the covered car out of the
  barn to the front, dims the yard, wiggles and whips off the tarp, light rays spin
  and the car pops out ("LEGENDARY CLASSIC!"); a collector buys it for about 3x what the stages cost.
  Five minutes later Grandpa Joe finds another, 15% bigger each time. Classic names are fictional
  (e.g. Stallion Wildfire '67).
- **Settings** (☰ in the top bar): sound effects, music (stored; music comes in P1.8), reduce motion (also on when
  the OS asks for it), number format (short 1.5M or scientific 1.5e6), reset progress (two-step confirm),
  credits with the version.
- **City map** (🗺 in the top bar after 30 sales): Rust Valley drawn in code: scrapyard, Repair Garage (goal: $200K
  earned in total, then $100K to open), Used Car Lot ($5M goal) and Paint & Tuning ($50M goal). Locked plots are grey
  with a padlock whose ring shows progress; the list shows open businesses and the next goal. "Go" puts that business
  on screen; the others keep running in the background.
  Map tiers (P1.1d): each open business has three tiers, shown as stars on its plot and in the list with what the next
  one needs ("Next ★ with 3 repair bays"). Scrapyard: tier 2 at 3 lot slots (second car, crusher block), tier 3 at 4
  (site office, gold flag on the crane). Garage: tier 2 at 2 bays (a door rolled up with a car inside), tier 3 at 3
  bays (both doors, lit roof strip). Thresholds in `ECON.businesses.tiers`. "Go" drives there behind a road wipe with
  the destination's sign (skipped with reduce motion).
- **Repair Garage** (business 2): a teal workshop with a roller door, pegboard, tool chest and a two-post lift.
  Customers drive in with one fault (flat tyre, dead battery, worn brakes, rusty exhaust, engine trouble) shown in a
  bubble with a progress bar; tap the car to fix it, the customer pays and drives off. Fixes use the scrapyard's spare
  parts ("Yard parts −2 ⚙"), otherwise a parts bill comes off the fee, so the two businesses feed each other. Garage
  tab: Tool Wall (repair speed), Reputation (fees), Repair Bay (up to 3 cars, shown as thumbnails above the lift);
  Crew tab: the Foreman fixes cars on his own, also while you're away (shown in the welcome-back popup).
  Garage scene (P1.1e): the lift's cross beam is the "REPAIR GARAGE" sign (kept clear of the HUD, the bay row and the
  tallest raised car); the car drives in, the lift raises it 10 px and the customer (one of the six buyer looks) steps
  out to wait on the right; the Foreman (navy overalls, red cap, clipboard) stands on the left and bobs while he works.
  Faults show on the car: a flat tyre tilts it and bulges, a dead battery sparks blue at the front, hot brakes glow
  through the rear wheel, engine and exhaust smoke. Customer cars carry light rust (5 patches, 1 dent), not wreck rust.
  Garage feel (P1.1f): as the customer steps out they say what's wrong in a speech bubble (three short lines per
  fault, stable per job, said once per job; 1.8 s), then the fault bubble pops up. A flat-tyre fix rolls a new tyre in
  from the right onto the front wheel, and it leaves with the car. The bay row is slimmer (96x60 CSS px, more opaque)
  so the door and the sign read on short phones; the car area starts 12 px higher.
- **Used Car Lot** (business 3, P1.2a/b): goal $5M earned in total, then $2.5M to open. A sunny forecourt with a glass
  showroom (its orange roof band is the "USED CAR LOT" sign), pennant bunting and a round display platform.
  Auction tab: three lots, each showing the car, its condition (1-5 stars: Rough, Tired, Fair, Good, Mint), price, list
  price and profit before you bid, so it is never a blind box; a lot stays 45 s, then someone else wins it, and an
  emptied slot refills after 4 s. Rough cars are cheap and need lots of refurbishing; mint ones cost more and are quick
  flips. The bought car drives onto the platform as rusty as its grade; tap it to refurbish (suds, the rust fades, a
  progress bar under the name) until a swinging "FOR SALE" tag shows the list price. Sell: the Sell button always
  haggles (0.9x-1.3x, "Skip haggling" sells at the list price) and holds the car while the needle runs; otherwise a
  walk-up buyer comes every 6 s and pays the list price. Only the profit counts towards lifetime earnings (the price
  was your own cash). Lot tab: Valet Bay (refurbish speed, x2 at milestones), Showroom (+8% sale price per level),
  Forecourt Spot (2 -> 4 cars, shown as thumbnails above the platform with 🧽 / 🏷️). Crew tab: the Detailer (green polo,
  backwards cap, spray bottle) refurbishes on his own; the Auction Agent bids on the best-value lot when cash covers 2x
  its price. With both, the lot earns while you're away. Map tiers: 3 / 4 forecourt spots (a second row of cars, then a
  gold balloon and price tags).
- **Used Car Lot polish** (P1.2c): each auction card counts down ("⏱ 32s"); in the last 8 s it says "🔨 Going… 5s" and
  the timer bar turns red and pulses. A lot that runs out gets a red "SOLD!" rubber stamp (another bidder won it); one you
  buy gets a green "YOURS!" (or "AGENT WON!") stamp and a two-knock gavel sound. Walk-up buyers come in five types
  that share the yard buyers' looks: Family (sedan/van/SUV +15%), Collector (cars bought Good or Mint, "all original",
  +30%), Speed Freak (muscle/sports/hyper +20%), Tradie (pickup/van +20%, after 20 yard sales) and Influencer
  (sports/hyper +40%, after 100 yard sales). 3.5 s after a car is ready a buyer walks up, picks the waiting car they
  like best, stands by it leaning in to look it over and says a line ("All original? Marvellous!" when they like it,
  "Bit slow for me…" when not); 2.5 s later they pay the list price plus their bonus ("Collector paid +30%") and drive
  it away. A buyer looking at a car in the spot row shows as their icon on its thumbnail. If you sell that car first,
  they pick another ready car or walk off.
- **Paint & Tuning** (business 4, P1.2d core, P1.2e scene): goal $50M earned in total, then $25M to open.
  Customers drive in with an order of one to three services from the menu: Respray, Custom rims, Vinyl wrap, Engine
  tune. The booth works through them in order (tap the car, or hire the Painter) and each finished service shows on the
  car (new colour, new rims, a wrap pattern, a tune). Orders with more services pay a combo bonus (+15% per extra
  service). Finish an order yourself within 3 s per service of the car arriving and the customer tips +25%, so active
  play pays and the Painter (idle and offline) never tips. Upgrades: Spray Booth (speed, x2 at milestones), Hype
  (+10% fees per level), Paint Booths 1 -> 3 (map tiers at 2 and 3 booths).
  **Customer speech (P1.2g):** as the customer steps out they say what they want in a speech bubble, by the first
  service ordered ("Make it pop!", "Bling it up!", "Stripes! Lots of stripes!", "Make it roar!") or "The full works,
  please!" for three services. The tip clock is already running, so the bubble never covers the order ticket: above
  the customer's head when there is room, else right of the ticket, else beside the customer under the ticket with
  the tail pointing at them. On short phones the car stands lower (and on a 560 px phone it is drawn a little smaller)
  so the sign keeps its lettering between the booth row and the ticket.
  **Lot cars through the shop (P1.2f):** on the lot, a refurbished car shows a purple Tune button beside Sell (e.g.
  "⚙️ Tune +$180K"), once Paint & Tuning is open. It takes a free booth (greyed "Booths busy" otherwise) for one service
  that suits it: respray for sedans and vans, rims for hatches, pickups and SUVs, a wrap for sports cars, an engine
  tune for muscle cars and hypercars. While away it is off the market: its thumbnail fades with "At the shop", walk-up
  buyers pick another car, and the platform says "Your car is at Paint & Tuning 🎨". In the shop it drives in with no
  customer and the ticket's tip column reads "🏷️ +$180K sticker". Tap it (or let the Painter) and it goes back with
  "🏷️ Back to the lot" (a toast when you're elsewhere). Its FOR SALE tag shows the service icon and the higher price;
  a respray or wrap brings it back in the new colour. Once per car; the shop charges and pays nothing.
  The scene (P1.2e) is a spray booth: slate wall panels, ceiling light strips, two extraction fans, a shelf of paint
  cans, a colour-swatch fan, a floor grate with overspray and a purple "PAINT & TUNING" band with paint drips. The car
  drives in from the left and the customer waits on the right. An order ticket sits on the car's roof: one slot per
  service (ticked green when done, ringed orange while worked on), a progress bar for the whole order and a tip column
  ("⚡ +$30K, tip · 8s") with a draining gold bar. Each tap shows the work: a respray or wrap sweeps the new colour
  from the back of the car to the front with mist in the new colour, custom rims (black spokes, gold lip, red caliper)
  fade in with glints, a tune brings a flame decal and spits fire from a new chrome exhaust tip. A finished service
  floats "✓ Respray"; the paid order drives away with coins and a gold "⚡ Quick tip" note. The Painter (white overalls,
  goggles, respirator, spray gun) stands left of the car and sprays the oldest order. With 2-3 booths a thumbnail row
  shows each car and its current service. Tabs: Shop (Spray Booth, Hype, Extra Booth) and Crew (Painter).
- **First session:** Grandpa Joe's note, hints for wash → repair → sell → first upgrade → hire a Mechanic.

## Decisions

- Only the business on screen runs a Phaser scene; the core tick inside it advances every business, so the yard keeps
  selling while the garage is shown (and the yard redraws from the state when you come back).
- The garage has no buying or selling (plan: "fix customer cars for fees"); it ties into the yard through spare parts.
- Yard-only announcements (the LEGENDARY! banner for a new yard car, the buyer's bell) stay quiet while another
  business is on screen; the car and the buyer are still in the yard when the player goes back (`src/ui/announce.ts`).

- Businesses unlock by lifetime earnings (one number the player already watches), then cost cash to open, so the
  goal is visible long before it can be bought. The map lists only the open businesses and the next goal; later ones
  are visible on the map but not spelled out, to keep the screen short on a phone.

- Barn timers run offline (unlike contracts): a restoration is a "come back later" hook, and only one stage can
  finish while away, so it never skips the fun of starting the next one.
- The barn sale price is fixed at the reveal, so "Later" never loses money.

- Contract timers run in game time (paused while the game is closed), so orders never expire
  while the player sleeps. Revisit when push notifications exist.
- Haggle and buyer bonuses stack (price = value x buyer match x haggle), matching the plan's price formula.
- Buyer bonuses apply to crew sales too (the buyer is in the yard either way); offline income ignores them (conservative).
- Pickups have no buyer yet (a Tradie buyer comes with P0.14d); vans and SUVs go to Family, sports cars and hypercars
  to Speed Freak; Influencer comes later.
- Parts are spent automatically (no extra button) so the crew and offline play use them too.

- First 5 cars are always Common so the tutorial pacing is predictable.
- UI is DOM over the Phaser canvas (crisp text, accessibility, translation).
- Phaser 3.90 for now (stable, well known); Phaser 4 upgrade is a later decision.

## Prestige: Sell Empire (P1.3)

- **Legacy Points** come from everything you have ever earned, sold empires included: `floor(sqrt(all-time / $5M))`.
  Selling adds the difference to what you already own, so each restart rewards more play with diminishing returns.
  Each point adds **+2% to all income forever** (every car value, fee, price, reward and idle/offline rate). Points
  spent in the Legacy tree (P1.3c) keep their +2%.
- The **Sell Empire** button appears once a sale would give at least 10 points and glows when the new points are at
  least half of the points you own.
- **Resets:** cash, upgrades, crew, lot slots, cars, parts, contracts, the barn, every business (back to the scrapyard).
  **Kept:** Legacy Points, settings, tutorial progress, the collection book, lifetime stats. Offline cash still
  waiting is paid in first and counts toward the points.
- Pacing (sim, P1.3a): the always-tapping bot is offered the first sale at 3h28m (after Paint & Tuning opens at
  1h35m), the relaxed bot at 4h20m; the plan's target for a casual player is day 2-3. With x1.24 the second empire opens
  the Used Car Lot at 39m (was 45m) and Paint & Tuning at 1h19m (was 1h35m).
- **UI (P1.3b):** an "EMPIRE FOR SALE!" banner and a dot on the map button the first time the sale is offered; a gold
  "Sell Empire" row at the bottom of the city map's list (glows per the rule above); a preview (points, income
  multiplier now and next, what you keep and what starts over, this empire's earnings and time) with "Not yet"; a
  confetti celebration with Grandpa Joe; then the game reloads into the fresh scrapyard (no intro). A gold chip in the
  top bar shows the multiplier ("🏛 x1.24"); tapping it shows the points, the fastest empire and the next sale goal.
- **Legacy tree (P1.3c, design draft run 20):** three branches of four nodes, bought in order within a branch with
  Legacy Points. Spending a point does **not** remove its +2% income (the multiplier counts points earned, not points
  held), so the tree is pure upside and the choice is only *which* node first. Costs 2 / 3 / 5 / 8 per branch (54 for
  everything; the first sale gives ~12, so 2-4 nodes per empire early on). Every effect is a number in `ECON.legacy.tree`.
  - **Mechanic** (work faster): Quick Hands (2) +25% tap work in every business · Head Start (3) each new empire starts
    with $5K and the Mechanic hired · Parts Hoarder (5) +50% parts from the crusher · Master Crew (8) every crew member
    and the Foreman/Detailer/Painter work +30% faster.
  - **Dealer** (sell better): Silver Tongue (2) haggle "perfect" zone 30% wider · Regulars (3) buyers arrive 25% more
    often in the yard and the lot · Insider (5) auction prices -10% · Franchise (8) opening a business costs 25% less.
  - **Racer** (luck and time): Quick Tips (2) +1 s per service on the paint shop tip timer · Rare Finds (3) Rare, Epic and
    Legendary chances x1.5 · Barn Scout (5) barn finds come twice as often and stages take 20% less time · Night Shift
    (8) the offline earnings cap is 2 hours longer.
  - Respec: free once per empire (refund all spent points), so an early wrong pick never hurts. No paid respec.

