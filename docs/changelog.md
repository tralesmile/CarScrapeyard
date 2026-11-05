# Changelog

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
