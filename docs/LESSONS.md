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

## 2026-11-05 (run 5)

- **Prove a new e2e check can fail.** The "reward texts don't overlap" check passed with stacking switched off, but only
  because `npm run build >/dev/null` had failed (unreachable code) and e2e ran the old `dist/`. Mutation-test a new
  check by breaking the feature in a way that still compiles, and never hide build output with `>/dev/null`; grep it
  for errors instead (`npm run build 2>&1 | grep -i error`).
- **Phaser copies `navigator.vibrate` onto `navigator` itself** at boot, so stubbing `Navigator.prototype.vibrate` in a
  browser test does nothing. Stub the own property (`navigator.vibrate = ...`) and re-stub after every reload.
- **WebGL Graphics polygons are not antialiased** (the screenshots showed stair-stepped car outlines even with
  `antialias: true`). Paint detailed art with Canvas 2D into `textures.createCanvas()`; it is antialiased everywhere,
  supports gradients and clipping, and keeps the geometry testable without Phaser.
- **New content shifts derived prices.** Pricier families raised the expected car value, which pushed the barn's share
  of earnings from 18% to 23% (limit 25%). Expected value must use only unlocked families, and re-check every share
  metric in the sim, not just the unlock times.
- **`tsc` covers tests too** (tsconfig includes `tests/`): run it after writing tests, it caught a wrong `tick()` call
  and a misused return value before vitest did.

## 2026-11-05 (run 6)

- **A rule that reads well on paper can never fire in play.** The Scrapper was specced to crush "when the lot is
  full"; the 30-minute sim showed 0 crushes because a fast crew empties the lot faster than cars arrive (2.5 s), while
  the bin sat at 1 part. Add a longer sim scenario whenever a feature is meant for later in the game, and assert it
  actually triggers (`> 0`) as well as its upper limit. Rule now: crush while parts are low, then rest 8 s.
- **Bots that "save up" for a new purchase can freeze everything else.** Putting the Scrapper in the bot's must-buy
  list stopped it buying upgrades and the barn (no barn sold in 15 min). Optional purchases go into the bot's
  "cheapest option" list instead.
- **`console.log` in vitest only prints with `--reporter=verbose`** (that is why `npm run sim` uses it); use it for
  throwaway debug tests, then delete the file.
- **Class toggles set in one branch of an `update()` leak into the others.** The "swap" style was only toggled in
  the active-order branch, so a finished order kept the grey swap look on its Claim button; only the screenshot showed
  it. Set every state class at the top of `update()` from the current state, then fill in text per branch. The e2e
  now asserts the Claim button has no swap style.

## 2026-11-05 (run 7)

- **Single-seed balance tests fail by luck.** Adding two buyer kinds changed the RNG stream; seed 12345 then read a
  25.2% barn share (limit 25%) and a minute slower Salesperson, but over 12 seeds the change cost only +23 s and the
  barn share averaged 18%. Before tuning numbers after a failing sim, sweep seeds (the `many seeds` test does it) to
  tell a real shift from noise, then tune for the average with margin.
- **Stashing one file to compare "before" broke the build** (the old config no longer matched the new types), so
  the comparison printed nothing. Compare by switching the new feature off inside the current code (e.g. set its
  unlock to 99999) instead of stashing.
- **Phaser depth is not enough to put a new sprite behind an older one** at the same depth; created-later draws on
  top. Use `children.moveBelow(sprite, bigCar)` for a figure that must stand behind the bay car.
- **`npm run check | grep ... && git commit` pushed a failing run.** grep matched the "Tests" line even though e2e
  printed FAILED, so the `&&` chain went on to commit and push (fixed straight after). Gate commits on the exit code:
  `npm run check > /tmp/check.log 2>&1 && git commit ...`, then grep the log. The flaky step was a cash assertion that
  the Scrapper's scrap cash could disturb; switch off every other income source while measuring one sale.

## 2026-11-05 (run 8)

- **A passing e2e check can test nothing.** The "welcome back after an hour" check passed for runs because it only
  looked at the popup title and "cash went up": the page's own `pagehide` save overwrote the edited save on reload, so the
  popup really showed 0 s and a few dollars. Only adding a new assertion on the popup's content exposed it. When an e2e
  step fakes time or storage, assert the faked value itself shows up (here "for 1h"), and block the page from saving
  over test data (`Storage.prototype.setItem = () => {}` just before the reload).
- **Phaser sorts by depth before display order.** The empty lot slots had `setDepth(-0.5)` and `sendToBack(bg)`, so the
  backdrop (depth 0) always covered them and nobody noticed for six runs. Keep backdrop layers at the same depth and order
  them with `sendToBack`/`moveBelow`, and look for missing pieces in screenshots, not only for overlaps.
- **Pixel checks catch art bugs that eyes miss at thumbnail size.** The first reveal tarp let a van's roof poke out; a
  gallery check that counts car-paint pixels above the tarp's hem (48 → 0) found and proved the fix. For art that must
  cover or avoid something, paint it on a known colour in the debug gallery and count pixels.
- **Mutation-test UI-order checks by flipping the feature off** (`barnFirst = false && ...`) and confirming the e2e fails,
  then restore it and grep the line. A "card is on screen" check first passed even with the card third in the list,
  because it only tested the card's top edge; it now checks the whole button fits on the phone screen.

## 2026-11-06 (run 9)

- **Check the engine's effective config, not the config you wrote.** We set `antialias: true` from run 1, yet every
  texture was nearest-filtered: Phaser 3 defaults `pixelArt` to `zoom !== 1` and pixel-art forces `antialias` off.
  Runs 5-8 fought the resulting stair-steps with art changes (Canvas 2D painting helped, but filtering stayed nearest). Reading `game.renderer.config.antialias` and a
  texture's `glTexture.minFilter` in the browser found it in one minute. When a visual bug survives an art fix, probe
  the renderer state first, and pin the finding with an e2e assertion (now: smooth filtering + mipmaps).
- **Mipmaps only exist for power-of-two textures in Phaser's WebGL1 path, and a POT render texture gets stale mips.**
  The dirt render texture is one texel taller on purpose so it stays non-POT and plain linear.
- **Turn "looks alike" into a number.** "Hyper and sports look alike" became `silhouetteOverlap()` (IoU of outlines above
  the shoulder line on a grid). The first redesign only moved it from ~0.8 to 0.81 for the body alone; adding the fin
  and wing to the silhouette and moving the canopy forward got it to 0.62. The same metric flagged two other close
  pairs (muscle/sports, hatch/SUV) for a follow-up task.
- **Timing checks go before slow steps.** A 3x full-page screenshot can take longer than a 620 ms tween; the check that
  the press is mid-slam failed once the backdrop got heavier. Assert time-sensitive state first, screenshot after.
- **Long `npm run check` runs exceed the 2-minute tool timeout.** Run it in the background with an exit-code marker
  (`(npm run check > log 2>&1; echo EXIT $? >> log) &`) and poll the log, instead of re-running it under `timeout`.

## 2026-11-06 (run 10)

- **Check that a modal fits before styling it.** The first map sheet listed all four businesses and was taller than the
  phone; the Back button's `focus()` then scrolled the sheet and hid the title, which only the screenshot showed. The e2e
  now asserts the title and the Back button sit inside the sheet's box, and the list shows only the open businesses plus
  the next goal. Use `focus({ preventScroll: true })` on buttons at the bottom of tall sheets.
- **A selector by class can silently retarget when a new element shares the class.** The sound check used
  `.hud .icon-btn`; the new map button (also `icon-btn`, placed earlier) would have become the match. Give each control
  its own class (`.sound-btn`) and use that in tests.
- **Layout that reads DOM sizes once goes stale when the DOM changes without a resize.** The yard used the HUD height
  from its first layout; the customer strip later made the HUD taller. Watching the insets (twice a second, cheap) fixed
  it, and flipping the watcher off made the new e2e check fail (mutation-tested as in run 8).
- **Pick unlock goals from the sim, then sweep seeds.** $250K landed at 13m41s on one seed, too close to the 15-minute
  target; $200K gives 12m12s average and 13m49s worst over 12 seeds, now asserted in the many-seeds test.
- **Ship a feature in slices with a `ready` flag.** The map and core business rules shipped before the garage loop;
  `ready: false` in config keeps the garage unbuyable ("SOON") so a half-built business can't sink the player's cash.
