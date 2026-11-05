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
  door seams, roof rack on SUVs, intakes and wings on sports/hyper). Review sheet: `?debug=1&gallery=1`.
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
  Rare+ cars or a car anyone has started washing; a "♻ Scrapper" text shows each auto-crush.
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
  car under a tarp. Tapping it opens its card in the Yard tab. Four stages — Tow it out, Rebuild the engine,
  Fix the body, Fresh paint — each cost cash (and parts for the engine and body) and take 20 s to 90 s; the
  timer keeps going while the game is closed (one stage at most). While the next stage needs parts, spare parts
  are not spent on repairs. When done, "Reveal!" dims the yard, wiggles and whips off the tarp, light rays spin
  and the car pops out ("LEGENDARY CLASSIC!"); a collector buys it for about 3x what the stages cost.
  Five minutes later Grandpa Joe finds another, 15% bigger each time. Classic names are fictional
  (e.g. Stallion Wildfire '67).
- **Settings** (☰ in the top bar): sound effects, music (stored; music comes in P1.8), reduce motion (also on when
  the OS asks for it), number format (short 1.5M or scientific 1.5e6), reset progress (two-step confirm),
  credits with the version.
- **First session:** Grandpa Joe's note, hints for wash → repair → sell → first upgrade → hire a Mechanic.

## Decisions

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
