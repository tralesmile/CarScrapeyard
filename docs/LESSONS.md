# Lessons learned

Each run adds what went wrong or what worked, so the next run does better. Read before starting.

## 2026-11-05 (run 1)

- **Always run the balance simulator after touching numbers.** The first economy draft let a bot hire
  the first manager in 10 seconds instead of 2–3 minutes (10x too generous). `npm run sim` caught it.
- **Big upgrade spending compounds.** Quality (car value) cost growth must outpace its value growth,
  or bots buy 40 levels in 15 minutes. Current: cost x1.22 per level vs value x1.08.
- **Make the first cars predictable.** A random Legendary as car #1 broke pacing; the first 5 cars are forced Common.
- **Verify visuals in a real browser.** Screenshots showed the tutorial hint covering the car;
  the hint now sits where the sell button goes (they never show together).
- **Canvas DPI:** Phaser 3 runs in `Scale.NONE` at `size × devicePixelRatio` with `zoom = 1/dpr`
  for sharp rendering. Convert CSS px to canvas px with `px()` in the scene.
- **Use `?debug=1`** to expose `window.__jye` (state, saveNow, game) for browser tests.
- **Don't run `npx playwright install`** in the cloud workspace; Playwright and Chromium are preinstalled globally.

## 2026-11-05 (run 2)

- **Randomness in tests hides regressions.** The balance bot used `Math.random()` for taps, so the timeline
  changed on every run and a pacing change could pass or fail by luck. Bots now tap from a deterministic
  budget; any randomness in tests must come from the seeded RNG.
- **"Re-roll a few times" is not "never".** Contract de-duplication with 4 re-rolls still put the same
  order on the board twice in 2% of games (the e2e screenshot showed it). Pick from the list of free
  options instead, and test an invariant over hundreds of seeds, not one.
- **Check overlaps whenever a new floating control is added.** The new Crush button covered the
  tutorial hint; only the screenshot showed it. The hint now moves left beside the button.
- **Rewards compound fast.** The first contract draft paid 32% of a relaxed player's early income;
  the sim now asserts contracts stay under 30%.
- **Event unions:** helper modules that push a subset of events take a small `{ push(e) }` sink,
  not `SubEvent[]`, so the sim's wider `GameEvent[]` can be passed straight in.
- **Writing docs with one big Python heredoc full of triple-quoted strings failed on a syntax error
  and changed nothing.** Use the Edit tool or one small script per file.

## 2026-11-05 (run 3)

- **New income sources shift every unlock that is priced in cash.** Haggle + buyer bonuses only added ~12% to
  earnings, but full automation came 2 minutes earlier (10m38s → 6m32s) because earlier hires compound.
  Re-price the next big purchases (here Washer/Salesperson) instead of nerfing the fun new feature, and sweep a
  few prices in one shell loop (`for c in ...; do sed ...; npm run sim; done`) to find the value quickly.
- **Tests that hard-code tuned numbers break on the next tweak.** A buyer test expected `1000 * 1.5 * 1.2` and
  failed after the Collector bonus moved to 40%. Read balance numbers from `ECON` in tests.
- **Put new HUD elements inside the scene's insets.** The buyer strip is counted in `ui.insets().top`, so the
  car queue and big car move down instead of being covered. Check the 4-slot case: thumbnails span the full width.
- **Mini-games and automation can race.** The Salesperson could sell a car mid-haggle; `holdForHaggle()` pauses
  the seller for that car. Any future UI flow that spans time over a car needs the same kind of core-level hold.

## 2026-11-05 (run 4)

- **A regex sweep over config.ts clobbered unrelated numbers.** Sweeping `valueMult: \d+` to tune the barn also
  rewrote the rarity multipliers (Common became x45) and the sim printed "Salesperson at 24 s"; only that absurd
  timeline gave it away. Sweep scripts must edit only inside the block they tune (slice from `barn: {` to its
  closing brace), and keys in ECON should be unique (`saleMult`, not a second `valueMult`). Check `git diff` after a sweep.
- **Bots must play a new feature the way a player would, or the numbers lie.** The first sim showed the barn stuck:
  the bot only crushed wrecks with `dirt === 1` (never true once the Washer is hired) and spent every dollar on cheap
  upgrades, so it never had a stage's price. Make the bot save up and crush for parts first, then tune prices.
- **One big payout near the end of the 15-minute window swings the share metric.** A $210K reveal at 14m56s read as
  34% of earnings; at 12m it read as 18%. Look at when the payout lands, not only the share.
- **Reloads in e2e can open the welcome-back popup** (any offline earnings > 0), which blocks other modals.
  After a reload, close any open modal before testing the next screen.
- **Reset needs a save guard.** Wiping storage then reloading would let `pagehide` save the old game back; a
  `resetting` flag in `saveNow()` prevents it, and the e2e reset test proves it.
- **Chained shell commands hide skipped steps.** A `grep && python3 ...` doc update silently did nothing because the
  grep found no match. Run doc edits as their own command and check `git status` afterwards.
