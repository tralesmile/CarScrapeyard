# Changelog

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
