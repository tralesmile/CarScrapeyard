# Changelog

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
