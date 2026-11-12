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

## 2026-11-06 (run 11)

- **A Phaser scene cannot be put to sleep from inside its own `create()`.** The SceneManager marks the scene RUNNING
  after `create()` returns, which undid `sleep('yard')` called from the yard's ready hook, so a reload into the garage
  ran both scenes. Defer scene switches out of `create()` (`setTimeout(…, 0)`); the e2e reload check caught it.
- **Playwright's `isVisible` treats `opacity: 0` as visible.** The Sell and Crush buttons hide with opacity (so they
  can fade), which made "yard controls are hidden" fail although nothing showed. Assert on the class that hides them
  (`.hidden`), and print which element failed in the message so one run tells you why.
- **When a new business competes for the same cash, rerun every old pacing check.** Saving up for the garage made the
  bot skip the barn and broke "first classic sold < 15 min". Finishing a restoration already under way first is both
  what a player does and what kept the old target; the change was in the bot, not the economy.
- **Background jobs started with `&` die with the 2-minute tool timeout.** Start long e2e runs with
  `setsid nohup bash -c '…; echo EXIT $? >> log' &` and poll the log in separate calls.
- **Make new numbers pass the existing curve.** Reusing `stationPower` (milestones x2) for the Tool Wall and the yard's
  offline cap/efficiency for the Foreman kept the garage consistent and testable with the same idle-vs-real check.

## 2026-11-06 (run 12)

- **Never free a texture an image still points at, even a hidden one.** The garage released a car's texture after the
  drive-off while the hidden image kept it; the new per-frame pose code read `displayHeight` and threw "sourceSize of
  null", which stopped the whole game loop. The e2e only reported "waitForFunction timeout" twenty seconds later. Point
  the image at `'__WHITE'` before `textures.remove`, and take sizes from the layout, not from images that may be hidden.
- **Print the page errors when the e2e fails.** The errors list was only checked at the very end, so a failure in the
  middle hid the cause. `tools/e2e-smoke.cjs` now prints the first page errors next to the failure message.
- **Don't run vitest while the e2e runs.** Two e2e failures in the yard's floating-text check were CPU contention from a
  parallel vitest run; alone the same build passed. Run the e2e (or `npm run check`) on its own and do docs meanwhile.
- **`cat > file` without a heredoc waits on stdin forever** and eats the whole 2-minute tool timeout. Use the Write tool
  for scratch files.
- **Tween a value, not the sprite, when several systems move the same sprite.** The lift height, the tap dip and the
  flat-tyre tilt each tween a small `{ v }` object and `poseCar()` combines them every frame, so they never fight over
  `y` (the old tap tween on `y` would have undone the lift).
- **A "ready for the screenshot" predicate must exclude transitions.** "Car visible, lift up, customer shown" was also
  true on the first frame of the drive-off, so the Foreman screenshot showed an empty lift. Check the scene's own
  transition flags (`carLeaving`, `arriving`) and the focused id, then hold the state (more work left) for the capture.
- **Kill the dev server's process group, not just npx.** `server.kill()` stopped `npx` and left `vite preview` running
  on the e2e port for the rest of the session; the e2e now spawns it `detached` and kills `-pid`.

## 2026-11-06 (run 13)

- **Look at every screenshot, even of a feature you didn't touch.** The garage screenshot showed the yard's
  "LEGENDARY!" banner covering the workshop: an event from the business in the background. Events from a business
  that is not on screen need a rule (`src/ui/announce.ts`) instead of always announcing.
- **Hold short-lived states for screenshots.** The speech bubble lasts 1.8 s; the assertion saw it, but the 3x
  screenshot came after it ended. Freeze the state for the capture (`speechUntil = clock + 99`, or
  `tweens.pauseAll()` for the tyre roll), screenshot, then release it.
- **Render SVG art in isolation before wiring it in.** A throwaway vitest that writes the map SVG for tiers 1-3 into
  an HTML page, plus one Playwright screenshot, showed in a minute that the tier cars hid behind the plot labels.
  That loop is much faster than a full e2e run per tweak.
- **Share layout constants between the scene and its tests.** The garage test copied 86/96 px from the scene; making
  the bay row slimmer would have silently broken that mirror. `BAY_ROW`, `BAY_ROW_BOTTOM` and `GARAGE_AREA_TOP` now
  live in `garageArt.ts` and both use them.

- **Gate a UI element on a time window, not on another element's visibility.** "Hide the fault bubble while the speech
  bubble is visible" left a 380 ms gap before the speech appeared (the fault bubble flashed, then hid), and the e2e
  caught both bubbles up together on a slower run. One `speechUntil` deadline, set when the customer arrives and
  reset when the car changes, covers the whole sequence.
- **Never find a short animation with a fixed wait.** Adding the 0.46 s road wipe in front of the garage shifted the
  timeline, and the e2e's "wait 1300 ms, then look for the speech bubble" missed the 1.8 s window on a slower run.
  The predicate that finds the state now also holds it (`speechUntil = clock + 99`, polling every frame).

## 2026-11-06 (run 14)

- **Tune a new business with a long bot run before building its scene.** The first Used Car Lot numbers looked sane
  per car but gave the lot 81% of all earnings by 2 hours ($434M vs $5M before it opened): a manual haggled sale is
  instant, so an active player flips a car every ~2 s. Writing the core plus a 120-minute bot run first found it in
  one minute; a sweep of one knob (retailBase 45K/35K/28K) picked the value. Do the sweep in one shell loop.
- **Decide what counts as "earnings" when a business spends cash to earn it.** The lot buys cars, so counting the full
  sale price as lifetime earnings would have inflated every unlock goal; only the profit counts now (and the save's
  `cash <= lifetime` sanity check still holds).
- **A debug edit to test data must keep its invariants.** The e2e turned an auction lot into a Rough car without
  changing its price, so the "profit" was negative and the haggled-sale check failed. Recompute derived fields
  (price from condition) whenever a test mutates the inputs.
- **A new business changes old screens.** The map row check "text not squeezed by the Go button" failed because the
  lot now shows a wider "Open $2.50M" button. Layout assertions should name the state they check (rows with Go vs rows
  for sale) instead of taking the minimum over everything.
- **Never rebuild `dist` while an e2e run is using it.** Kill the running e2e (and `vite preview`) first, rebuild,
  then start one clean run.
- **Paint decorations before the sign they could cover.** The bunting hung over the "USED CAR LOT" lettering in the
  first screenshot; drawing the flags first and stringing them above the band keeps the sign readable on any height.

## 2026-11-06 (run 15)

- **`overflow: hidden` on a grid or flex item changes its size, not just its painting.** It drops the item's
  automatic minimum size to 0, so the auction cards shrank to their grid row and clipped their Buy button. I only
  wanted a stamp to stay inside the card; it didn't need clipping at all. The screenshot showed it at once, and the
  e2e now asserts that each auction card holds its text and button. Check a screenshot after any CSS change to a card.
- **Every cash check in the e2e must silence all businesses.** The "skip haggling pays the asking price" check
  switched off the yard's Salesperson, the Scrapper and the garage Foreman, but not the lot's crew, so a walk-up sale
  landed in the 200 ms window. When a new business earns on its own, search the e2e for `cash -` checks and quiet it there.
- **Give a timed state its own field instead of reading it off a timer.** The walk-up buyer is `carlot.buyer`
  (kind + car), set when they arrive and cleared when they pay or leave. The scene, the spot icons, the save and the
  tests all read that one field; deriving "a buyer is looking" from `buyerTimer > 3.5` in four places would drift.
- **Expose the UI object on the debug hook** (`__jye.ui`) so the e2e can hold a short-lived UI state (the 1.6 s
  stamp) for its screenshot, the same "find it and hold it" rule as for scene states.
- **Check CI on `main` before blaming the code.** PR #6 went red, but the job ended in 2 s with `runner_id 0` and no
  logs, and the main-branch run before this run's commit had failed the same way. A job that never gets a runner is
  an account or billing problem: re-run once to confirm, then hand it to the owner instead of changing code.


## 2026-11-06 (run 16)

- **A block-sliced sweep still clobbered another block because the anchor wasn't unique.** I sliced from `'  paint: {'`
  to `'  barn: {'`, but that string also matched `      paint: { name: 'Paint & Tuning'` in the businesses list, so the
  slice covered the garage and its `baseFee` became $55K (the sim's garage share jumped and the timeline went silly).
  `git diff ... | grep '^-'` showed it at once. Anchor block slices with the newline and exact indent
  (`'\n  paint: {\n'`), and always grep the removed lines after a sweep, before reading the sim output.
- **Mutation-test each rule against the test meant for it.** Letting the Painter earn tips only broke the idle-income
  test, not the tip test: the Painter was too slow to beat the deadline, so the "no tip" check passed for the wrong
  reason. A fast Painter (booth level 200) plus an assertion that it did beat the deadline makes the tip test catch it.
- **Compute expected values exactly when the draw is small.** The idle formula enumerates every ordered draw of 1-3
  services by weight (a few dozen paths) instead of guessing an average; a test compares it with 4,000 generated orders.
- **`git pull --rebase` flattens a merge of `origin/main` into `dev`.** Step 1 merged main into dev, but the rebase
  before the push replayed only my commit and dropped the merge, so main was no longer an ancestor of dev. Check with
  `git merge-base --is-ancestor origin/main origin/dev` after pushing; if it fails, merge main again and push without
  rebasing (or use `git pull --rebase=merges`).
- **Public repos get free Actions minutes.** The runner block was the private-repo minute quota; making the repo public
  fixed it at once (the re-run went green in 25 s). Keep secrets out of the repo: it is public now.


## 2026-11-07 (run 17)

- **A green e2e can still hide the business's name.** The first Paint & Tuning run passed every assertion, but the
  screenshot showed the order ticket sitting right on top of the "PAINT & TUNING" sign. A new overlay must be part of
  the backdrop's layout, not drawn over it: `ticketTop()` now lives in `paintArt.ts`, the scene passes it to the
  backdrop as the lowest point the sign may reach, and a unit test checks sign bottom <= ticket top on four screens.
- **Then check the fix on the phone the e2e uses, not just the maths.** Moving the ticket above the sign's space left
  only 12 px on an iPhone 13, so the band dropped its lettering (the "too small" rule). A 6 px slimmer ticket that
  overlaps the roof 4 px more gave the sign room; only the screenshot showed the lettering had gone.
- **Layered images + `setCrop` make a cheap "spray it on" effect.** The old car, the new-colour car cropped to the
  service's progress, and transparent overlays (stripes, rims, flames) cost three textures per car and no per-frame
  canvas work. A pure `serviceReveal(job)` drives all layers, so the reveal is unit-tested without Phaser, and the
  scene exposes what it last applied (`debugView().shown`) for the e2e.
- **Flip a "coming soon" test, don't delete it.** Making the last business `ready: true` broke the only test of the
  "soon" rule; switching the flag off inside that test (and back in `finally`) keeps the rule covered.
- **Old fixed waits keep flaking.** "Wait 1200 ms, then the yard shows the focused car" failed once this run: the
  Salesperson sold a car and the drive-off (0.5 s, `bigCarId = null`) overlapped the check. Replaced with a predicate
  wait. When a check flakes, grep the e2e for other `waitForTimeout` + assert pairs on animated state.


## 2026-11-07 (run 18)

- **Compare a bot with and without a new choice, not just "does pacing still pass".** The first valueMult (1.2) passed
  every old pacing check because the old bots never used the feature; only an A/B run (same bot, `tuneLotCars` on vs
  off, 180 min) showed +18% lifetime and the paint shop's own fees halved. A sweep of 0.6/0.8/1.0 in one loop then
  showed where it stops being a free win (0.8 ~ break-even, 1.0 +8%). Bake the A/B into `npm run sim` with bounds.
- **When two businesses share an object, repair the links after both are repaired.** A lot car marked "at the shop"
  and the booth job pointing at it are saved in different blocks; `sanitizeLotShopLinks` runs after `sanitizeCarLot`
  and `sanitizePaint` and fixes either side missing. A one-sided repair would strand a car off the market forever.
- **Put mutable looks into texture keys.** The lot keyed car textures by id; a respray changes the colour, so the old
  key would have shown the old paint forever. `lcar-<id>-<paint>` plus a prefix release on sale fixes it without
  freeing a texture an image still uses.
- **The e2e runs ~8 minutes; the tool call limit is 2.** Start it in the background with `&` and an EXIT marker in the
  log, then do docs while it runs (and never rebuild meanwhile). A foreground run just times out and wastes the call.
- **Assert UI text with the exact label you mean to ship.** "⚙️ tune" (from stripping "Engine " off the name) passed
  typecheck and unit tests; only the e2e regex for "Tune" caught the lowercase label.

- **`page.isHidden` is false for our `.hidden` buttons.** They fade with `opacity: 0` (for the transition), which
  Playwright still counts as visible. Check `classList.contains('hidden')` for those. Also read a value shown only
  after an animation (the FOR SALE tag after the drive-in) with a wait on its visibility, not a fixed 300 ms.


## 2026-11-07 (run 19)

- **A unit test's "screen" must use the scene's real insets, not a guess.** The paint-art tests assumed the space below
  the car ends 264 px above the bottom; the scene's `insets().bottom` is the panel's height **plus 64 px of hint room**,
  and on the e2e's 375x560 phone the panel was 223 px, so the real space was 23 px shorter. The geometry passed in
  Vitest while the screenshot showed the sign gone. Fix: test the layout function with the inset the e2e logs
  (`boothStage(375, 60, 560 - 287)`), and expose layout facts (`sign`, `carW`, ticket box) in `debugView` so the e2e
  asserts them instead of me squinting at a screenshot.
- **Pull a layout rule out of the scene before fixing it.** `boothStage` (where the car, roof and ticket sit) and
  `speechBox` (where the bubble goes) are pure functions used by both the scene and the tests; a mutation run (bubble
  always above the head, no extra overlap) broke 23 and 2 tests, so the tests really guard the rules.
- **Assert the set of lines, not one line.** A line picked by job id changes when the e2e's job ids shift; the first
  run failed only because I expected "The full works, please!" and got "Make it a show car!".
- **Apply a global multiplier where values are made, not where cash is paid.** Prestige's +2%/point goes into car
  values, fees, prices and the idle formulas (12 call sites), so every price the UI shows is already right and the
  lot's profit (sale minus auction price) scales with both. Paying it at credit time would have left the tickets,
  stickers and offline estimates wrong. A test with 50 points checks every business doubles; a mutation (auction
  price without it) fails it.
- **Avoid import cycles by putting the type with the state.** `legacy.ts` needs `newGame`, and `state.ts` needs the
  Legacy default; the type and `newLegacy` live in `state.ts` and `legacy.ts` re-exports them.
- **One e2e flake this run: the lot's FOR SALE tag took over 3 s to show after a car was injected** (passed on the
  re-run with the same build). Waits on animated scene state get 6 s now; if it flakes again, log `arriving`, `bigId`
  and the texture key in the failure message instead of re-running blind.


## 2026-11-07 (run 20)

- **A `.hidden` class needs a CSS rule for every element that uses it.** The 🗺 map button had `hidden` toggled since
  run 10, but only `.hint.hidden`, `.sell.hidden`, ... had `display: none`; `.icon-btn` had none, so the map button
  showed from the first second. The e2e waited for `.map-btn:not(.hidden)` (the class), so it passed. Checking
  `getComputedStyle(e).display` in the e2e caught it at once. Assert what the player sees, not the class we set.
- **`overflow: hidden` boxes can still be scrolled by `focus()`.** A modal's button focus slid the whole #app 83 px
  left (it is wider than a 320 px phone because the panel head overflowed), flakily. Fixes: `overflow: clip` on #app,
  `focus({ preventScroll: true })`, and fix the real overflow. When a screenshot looks shifted, log every element with a
  non-zero `scrollLeft`.
- **A media query placed before the rule it overrides does nothing.** Same specificity, later wins: my narrow-phone
  `.tab` sizes sat above the base `.tab, .mode` rule. Put responsive overrides at the end of the stylesheet.
- **Iterate on one feature with a scratch Playwright script, not the 8-minute e2e.** A 60-line copy of the new e2e
  section run against `vite preview` took 15 s per try and found three layout bugs before the full run.
- **Reset-everything features: reload instead of rebuilding scenes in place.** Selling the empire restarts car ids at
  1 while textures are keyed by id (`car-1`), so an in-place restart would show old art. Pause the scenes, apply the
  sale, save, show the celebration, then `location.reload()`: every scene and texture is rebuilt from the save.
- **The e2e log is block-buffered; the failure line is not where it stopped.** `console.log` to a file buffers while
  `console.error` doesn't, so "E2E FAILED" printed before the last few "ok" lines. Read the assertion text, not the
  position. The full e2e took ~17 minutes this run (headless GL at ~10 fps); run the new section alone first.


## 2026-11-07 (run 21)

- **A percentage `max-height` inside a grid backdrop limits nothing.** The Legacy tree's modal had
  `max-height: calc(100% - 8px)`, but `.modal-back` is a `display: grid` with an auto row, so 100% resolved against the
  content and the Done button fell below a 568 px screen. `grid-template-rows: minmax(0, 1fr)` on the backdrop makes
  the row the screen's height. The e2e checked the modal box on the first screenshot only, when it still fit: assert
  "fits" again after the content grows (respec line, more owned rows), and include the last button in the check.
- **Wire a cross-cutting perk through one small module of helpers.** All 12 tree effects are functions in
  `legacyTree.ts` that return the plain ECON value when the node isn't owned (`tapPerk`, `offlineCap`, ...), and the
  module only imports config and state types, so every business file can use it without an import cycle. Functions
  without state (`crushParts`, `haggleMultiplier`, `tipDeadline`, `expectedCarValue`) got an optional parameter that
  defaults to today's value, so old call sites and tests stayed valid. A mutation run (two perks returning 1) failed
  exactly those two tests.
- **Points bank on the sale, so a sim that "buys before selling" can't.** My first branch A/B called `buyNode` before
  `sellEmpire` and every buy failed (0 points). Buy right after the sale; effects that only act at the next sale
  (Head Start) need their own unit test, not the sim.
- **A gift must not break the save's sanity checks.** Head Start gives cash before any earnings, and `sane()` rejects
  `cash > lifetimeEarnings + 1`. Allow the gift whenever an empire has been sold (not only while the node is owned:
  a respec right after the sale would otherwise make the save unloadable). Unit-tested with a respec.
- **Read the sim before shipping a design number.** Rare Finds at x1.5 (the GDD draft) made Racer +19% vs +6-7% for
  the others; x1.3 brings it to +12%. A tested probability bound must come from the config (`expectA/expectB`), not a
  hand-typed window, or the next tweak breaks the test for the wrong reason.


## 2026-11-07 (run 22)

- **A save repair can silently undo an e2e's injected state.** My Night Shift test set `legacy.points = 40` in the save,
  but load repair re-derives points from all-time earnings (12), so the tree was cut back and the perk vanished; the
  test timed out waiting for a line that never came. Inject *consistent* state (points and the earnings that back them),
  and when an injected save "does nothing", dump the loaded state first (one `console.log` found it in a minute).
- **Run the baseline check in the background and iterate on a scratch e2e at the same time.** The full check takes
  ~17 minutes; `nohup npm run check > log &` at the start, then build to a separate `--outDir` and serve it with
  `vite preview --outDir` on another port, so the scratch run (1 minute, only the Legacy section) never overwrites
  the `dist/` the baseline is testing.
- **Writing a "what changed" note exposed a real bug.** The welcome-back popup reported the raw time away ("worked for
  5h") although every business stops at the offline cap. Showing a perk's effect forces you to compute the number the
  rules use (`offlineCap`), so check each existing text against the rule while you are there.
- **Reuse keyframes only when their transforms match.** `stamp-in` and the second `pop` both carry
  `translate(-50%, …)` for centred elements; reusing them on a row would have shifted it. Give new animations their own
  keyframes when the element isn't centred the same way.



## 2026-11-07 (run 23)

- **The baseline check is worth starting first: it found a flake before my change could be blamed.** The paint shop's
  560 px check lost its ticket because the Painter finished a "held" 3-unit order in the 700 ms resize. A hold set in a
  `waitForFunction` only lasts until that function returns; re-apply it right before the step that needs it.
- **To thread a new multiplier through ~60 call sites, make the parameter required.** Every cost function got a
  required `scale` argument, so `tsc` listed each caller (UI, rules, the balance bot); an optional one would have
  silently left the UI showing Rust Valley prices. Crew costs read straight from `ECON` became small `xxxCost(state)`
  helpers for the same reason.
- **A codemod that "fixes the arity" can be wrong for the sim.** My script appended `, 1` to the bot's cost calls, so in
  Motor City the bot would have judged prices at x1. Review what an automatic fix did in the sim before trusting a
  balance number; the invariance check (Motor City lifetime = x5 of Rust Valley ±15%) is what catches this class.
- **`run()` in balance.test.ts mutates the state it is given.** Branching a sim (stay vs move) needs a JSON clone of the
  state at the branch point, or the second branch starts hours later.
- **Screenshot before the layout assertion, not after.** When "fits the screen" failed there was no picture to look at;
  the screenshot now comes first. And a modal that slides in needs ~700 ms before its screenshot.
- **Fixing one e2e step's state can break a later step that measures cash exactly.** Holding the paint order longer
  meant the Painter paid its fee 2 minutes later, inside the "Skip haggling" check (cash delta must equal the car's
  value). That check already turned off every other earner; the Painter is now off too, and the assertion prints the
  numbers. When a test asserts an exact cash delta, list every earner the earlier sections left running.

## 2026-11-07 (run 24)

- **Render Canvas 2D art in isolation with rolldown, not the 17-minute e2e.** There is no esbuild binary in
  node_modules (Vite here bundles with rolldown), so `node_modules/.bin/rolldown entry.ts --file out.js --format iife`
  plus a 6-line Playwright page that adds the script and screenshots it shows a backdrop in under 10 seconds, for
  several cities and phone sizes side by side. The first look at the Motor City yard came from this, before any e2e.
- **A "covers the whole width" loop can stop one gap short.** `while (x < w) { push; x += width + gap }` left the last
  tower ending 0.3 px before the right edge at 1440 px (the gap pushed x past w). A unit test asserting the row reaches
  `w` on four screen sizes caught it; the fix stretches the last tower to the edge.
- **Commit a green slice before starting the next one in the same tree.** I edited the yard art while the check for the
  map was running, so that green run covered only the map files. Staging just those files for the first commit kept
  "never commit unchecked code" true; the yard got its own full check before its commit.
- **Put player-facing names behind one helper as soon as a second value exists.** Three scenes read their sign from
  `ECON.businesses.list.x.name` directly; adding `businessName(state, id)` and grepping for `.name.toUpperCase()` and
  hard-coded "Paint & Tuning" strings found every place a city name must show (signs, toasts, the lot's label).

## 2026-11-08 (run 25)

- **A "stable pseudo-random" `(i * 71) % n` is only random when 71 mod n is far from 0 and ±1.** I set the lot's far
  towers to `hVar = 70`, and since 71 ≡ 1 (mod 70) every tower came out 1 px taller than the last: a flat wall hidden
  behind the sign. The isolated rolldown render showed "no skyline" in seconds; the cause took a debug dump. When a
  theme number feeds a modular hash, assert the spread (here: tallest/shortest > 1.25 on 3 screens) in a unit test.
- **Check a new colour against what it sits on, not on its own.** The first Motor City far row (#9fb4cb) was almost the
  sky's colour at that height, so the towers vanished. Pick the backdrop's colour at the overlap and keep a clear step.
- **Extract a theme by replacing literals one for one, so the default city is pixel-identical.** Each hex literal became
  `T.x` with the old value as Rust Valley's entry, and the garage's building formula was rewritten as
  `lo + k/22 * (hi - lo)` that equals the old `0.28 + k/100` exactly; the side-by-side render showed Rust Valley
  unchanged, so no old screenshot needed a second look.

## 2026-11-08 (run 26)

- **Any feature tied to the real clock makes every visual e2e check clock-dependent.** The test machine's clock read
  03:00, so "auto" would have painted Motor City at night and the run-25 day checks (booth panels blue - red > 50)
  would have failed only at night, a flake that looks random. The e2e now pins `cityLights = 'day'` before the day
  checks and turns night on through the Settings UI. When adding time-of-day, locale or device-dependent looks, pin the
  input in the test first and test each value on purpose.
- **Even-odd fill of two overlapping circles leaves a ring where the inner one pokes out.** My first crescent moon had
  a thin sliver on its far side because the cut-out disc reached past the moon. Clip to the moon's disc, then fill a
  rect with the cut-out circle even-odd. The isolated rolldown render (run 24's lesson) showed it in seconds, with a
  3x crop of the moon.
- **Check "overlap" against an animated element's full range, not one frame.** The tap hint bobs up 5 px, so a label
  that clears the pill at rest still touches it at the top of the bob. The clamp and the e2e both use the bob's peak
  (the e2e reads the current `translate` and subtracts it).
- **A night variant should change colours only, not layout.** Building `LOT_NIGHT.rows` from the day rows' sizes (and
  a test that the skyline layout is equal by day and night) means no sign, ticket or label position can move when the
  clock flips; only the backdrop texture is repainted, not a full `layout()`.
- **Adding a row to a modal is a layout change on the smallest phone.** The City lights row made the Settings sheet
  taller than 568 px and the modal had no scroll, so Done sat off-screen; Playwright's "element is outside of the
  viewport" after 30 s was the only sign. Every modal that can grow should have `max-height` + `overflow-y: auto`, and
  the e2e that adds a row should assert the sheet's bottom is on screen (it does now for Settings).

## 2026-11-09 (run 27)

- **Vitest hides `console.log` from passing tests unless you pass `--reporter=verbose`.** My first balance experiment
  printed nothing, and I waited 20 minutes for a run that had finished in 23 s. `npm run sim` already passes the flag;
  any ad-hoc `npx vitest run file` that reports numbers needs it too. Check a background job's log within a minute.
- **For an economy experiment, copy the bot into a throwaway test and stop each run at the event you measure.** A
  `stopAtOffer` break turned a 5-empire prestige chain into ~20 s per curve, so 9 variants (exponent, Motor City scale,
  income per point) were compared in a few minutes. The table of variants went into economy.md, so the next tuning
  starts from the measured options, not from guesses.
- **Measure a lever before trusting it.** Raising the per-point income bonus seemed the obvious fix for a slow second
  empire, but +5% per point (2.5x the bonus) still left it at 3h52m; the cost curve was the lever. The two-line
  algebra ((P+10)^2 - P^2 grows with P) predicted that, and the sim confirmed it in one run.
- **A single-seed ratio test can be knocked over by an unrelated change.** The book's +5% yard bonuses moved the
  lot-tune A/B from x1.08 to x1.17 on one seed but x1.10-1.19 across four; it was seed noise amplified by compounding,
  not a broken mechanic. For A/B ratio caps, average 3 seeds and print each ratio.
- **`withDefaults` only keeps keys the default object has.** A `Record<string, ...>` map defaulting to `{}` would be
  wiped on every load. Pre-fill the map in `newGame` with every valid key (the 48 book entries), which also drops
  unknown keys from old or tampered saves for free; the save test covers both.
- **Keep the RNG order when adding a value modifier.** Computing the car's value first and applying the book bonus
  after picking the model kept every seeded test and sim identical without the book, which made the A/B checks clean.

- **Run `tsc` again after writing a new test file.** `npx tsc --noEmit` passed before `collection.test.ts` existed;
  the check then failed on `noUncheckedIndexedAccess` (`MODEL_NAMES.sedan[0]` is `string | undefined`). Tests are
  type-checked by the build too: index into config arrays with `!` in tests.
- **Never run the e2e in a foreground command: it takes ~17 minutes and the tool's 10-minute limit kills it** (the
  kill looks like an e2e failure, "Target page ... has been closed"). Start it in the background with `EXIT` appended
  to the log and poll the log.
- **Banners queue, so an e2e that waits for "a banner" can read an earlier one.** The Van set check first saw a Muscle
  set banner from the e2e's own earlier sales; wait for the specific text you expect.
- **Check that a test file name is free before writing it.** I wrote `tests/collection.test.ts` with the Write tool and
  replaced the run-9 collection-count tests without noticing; `git status` showing `M` instead of `??` caught it before
  the commit. `ls tests/` first, and read `git status` for every file you think is new.

## 2026-11-09 (run 28)

- **"Fits the screen" checks must use a worst-case state, not whatever the flow happens to have.** The run-20 top bar
  check ran right after a Sell Empire reset (no parts counter, no map, small cash) and passed, while a real late game
  overflowed every phone up to 414 px: flex items shrank silently (`min-width: 0` on the cash) and the Legacy chip slid
  over the cash. A 30-line Playwright script against `vite --port 5299` that filled the bar (big cash and rate, chip,
  parts, every button) and printed each item's right edge at 320/360/375/414 px found it in one run. The e2e now builds
  that worst case and asserts no two leaf items overlap, which also catches shrinking (plain "right <= hud.right" did not).
- **`flex: none` on fixed-size controls in a crowded flex row.** Without it the buttons shrank below 38 px and the
  measured edges looked fine; overflow only showed once shrinking was off. Measure with shrinking off first.
- **Count string lengths in an e2e prefix check instead of guessing.** `src.slice(0, 22)` included the comma after
  `base64`, so a working thumbnail failed the run after 2 minutes. Use `startsWith` or slice exactly the literal's length.
- **A sub-second UI element needs an in-page observer, not `waitForSelector` after the click.** The 0.9 s road wipe was
  missed once on a loaded machine (my dev server and the e2e shared the CPU). A MutationObserver installed before the
  click records it whatever the timing. Also stop ad-hoc dev servers before starting `npm run check`.
- **Read the NEW state before marking it.** The book marks entries seen on open, so the view model for the badges and
  tab dots is captured first (`unseenEntries`, page `isNew`) and kept for the whole visit.

## 2026-11-09 (run 29)

- **The starting-point check is only valid on an idle machine.** The baseline `npm run check` failed in the e2e (the
  barn reveal modal took > 5 s) because I ran vitest with 30 workers and two bot sims while it ran. Re-run on an idle
  machine: green. While the background e2e runs, do only docs and reading; queue CPU work until it reports EXIT.
- **A/B a new choice for dominance before shipping it.** The showcase draft (+1% income per kept classic) was never
  slower than selling, even in the first empire, so it was no choice at all. Halving it made keeping cost ~1 minute now
  for +5% later. For every "this or that" option, a bot run per branch and the question "is one side never worse?"
  takes ~10 s with `stopAtOffer`.
- **A third modal action is cheaper than a new modal.** `modal()` grew an optional `third`/`onThird` button; the close
  helper now takes which button was used instead of a boolean, so later three-way choices reuse it.
- **Never edit live game state behind the scenes' backs in the e2e.** Slicing `state.cars` to make room for the gift
  car left a Phaser image on a destroyed texture ("Cannot read properties of null (reading 'glTexture')"), reported
  only at the very end by the page-error check. Make room the way a player would (here: press Crush, accept the
  confirm), so the scene gets its events. Numbers like `arrivalTimer` or cooldowns are safe to poke; arrays of things
  the scene draws are not.
- **Fix a known flake pattern everywhere, not only where it bit.** Run 28 moved one road-wipe check to a
  MutationObserver; the Motor City copy of the same check (`waitForSelector` with 1 s) failed this run. When a lesson
  names a pattern, grep the e2e for every copy of it in the same run.
- **New daily-style systems: hash the day instead of drawing from the game RNG.** Rolling tasks from `state.rng` would
  have shifted every later car and broken the seeded sims; `rollKinds(available, day)` keeps them identical.
- **`git pull --rebase` drops the "merge origin/main into dev" commit.** The rebase linearised my commits onto
  origin/dev and the merge of the owner's PR merge commit vanished, so dev was "behind main" again. After rebasing,
  check `git log origin/dev..origin/main`; if it is not empty, merge origin/main again and push without rebasing.

## 2026-11-09 (run 30)

- **This machine has 2 cores: the background e2e owns them.** `nproc` said 2 and the load was 2.7 while the baseline
  e2e ran, so I wrote code, tests and e2e steps without running anything heavier than one vitest file
  (`--maxWorkers=1`, under a second) until it reported EXIT. Check `nproc` at the start of a run before deciding what
  can run in parallel.
- **Early rewards compound: A/B any new payout against the first Sell Empire, not only its share of earnings.** The
  medal draft paid only 0.43% of a run's earnings, yet moved the first sale 3-4% sooner because a dozen medals land in
  the first half hour when income is small. Measure "time to the offer, with vs without" (`stopAtOffer`, ~5 s).
- **vitest hides `console.log` of passing tests in the default reporter.** My tuning loop printed nothing until I added
  `--reporter=verbose` (what `npm run sim` uses). Use it whenever a test prints a timeline.
- **A second `.buy` button inside a modal breaks `.modal .buy` selectors.** The Awards page puts claim buttons (class
  `buy`) above the book's Done button, so the e2e's `.book .modal .buy` would have clicked a claim. Give the closing
  button its own class (`book-done`) and grep the e2e for the old selector when adding buttons to an existing modal.
- **Followed counters need one last look before a reset.** Achievements follow garage/lot/paint/barn counters by their
  growth after each tick; a sale made by an action between ticks would have dropped that growth, so `sellEmpire` calls
  `trackAchievements` first (unit-tested with a counter bumped after the last tick).
- **Adding lines to a shared popup: re-check it on the smallest phone.** The welcome-back popup had no scroll and the
  e2e screenshot on an iPhone 13 already filled the screen once the waiting lines were in; on 320x568 Collect would
  have been off screen. Any modal that grows with game state gets `max-height: 100%` + scroll (and the backdrop's
  `grid-template-rows: minmax(0, 1fr)`) and an SE-size e2e assertion.

## 2026-11-09 (run 31)

- **A new modal that pops on its own breaks every e2e flow that crosses its trigger.** Vince's scene at 20 sales would
  have covered the crusher, the map and three fresh browser contexts (each sets `carsSold = 120`). Before writing the
  feature I grepped the e2e for every `carsSold =` and `newContext`, tested the scene once where it fires naturally,
  then marked the whole chapter seen in each other context. Do this for any self-opening UI (scene, offer, popup).
- **The banner is a permanent element: test `.banner.show`, not `.banner`.** "The sale banner waits until the scene
  is closed" failed because `#banner` always exists. Check how an element is hidden (class, `display`, removed) before
  asserting it is absent.
- **Look at every screenshot you touch, not only the new ones.** e2e-19d showed two toasts printed over each other
  (Vince's and a medal's, both at the same `top`). Toasts now stack in a flex column (`.toasts`), at most three. The
  next screenshot (e2e-21s) showed a toast covering a modal's title, so the stack now sits under any open modal.
- **The sandbox clock can jump: measure e2e progress with timestamps, not with how long I think I waited.** I killed
  a healthy e2e believing it had hung for 6 minutes; `date` showed far less time had passed. Prefix the log lines with
  `date +%H:%M:%S` and judge a stall only by the timestamps.
- **Flavour on existing events beats a new mechanic when the owner hasn't decided.** Vince relabels lots and customers
  that are lost anyway (counters only, no RNG draw), so no sim or balance change was needed, and the "real rival or
  flavour?" question went to NEEDS_FROM_YOU instead of being guessed.
- **Plan detail lives in the Claude Docs plan:** `read` the project, then a `search` with `pattern` on the tab's root
  node (`kind: "search"`, not `query`) returns only the matching blocks: one call instead of paging the whole doc.

## 2026-11-09 (run 32)

- **A baseline check proves nothing about the start if I edit `src/` while it builds and runs unit tests.** I started
  `npm run check` in the background and began editing story.ts during its build/vitest phase; the e2e served the
  earlier build, but vitest may have read half-edited files. Next time: edit only docs and tests-to-be (in the
  scratchpad) until the log shows the vitest summary, then edit `src/` freely while the e2e runs on the built `dist`.
- **Replays inside an existing modal: expand inline, don't open a second modal.** `openStory` refuses while
  `modalOpen` (the book is a modal), so the story log shows the scene's lines under its row (`storyLinesHtml`, shared
  with the modal) instead of closing and reopening the book. Reuse the markup helper, not the modal.
- **When a chapter's beats depend on a city, gate each beat by its chapter's city in one place.** `beatReady` now
  looks up `CHAPTERS[chapterOf(id)].city` before the switch, so chapter 1 can never fire in Motor City and vice versa;
  the old "chapter 1 plays in Rust Valley only" test had to change because Motor City now has its own scene due.
- **Self-opening UI checklist applied (run 31 lesson):** before writing chapter 2 I grepped the e2e for every
  `legacy.city = 'motorCity'` and Motor City flow; two contexts needed the new beats marked or tested.
- **A grid `.modal-back` with `place-items: center` grows its column to the content's min-content.** A fifth book tab
  (nowrap labels and counts) pushed the whole book past a 320 px screen; the existing "book fits an iPhone SE" e2e
  caught it (`inView: false`). Every scrolling modal backdrop needs `grid-template-columns: minmax(0, 1fr)` as well as
  the rows; also give nowrap tab text `overflow: hidden`.

## 2026-11-09 (run 33)

- **A new reward currency touches five layers: do them in one pass, in this order.** config table -> pure module
  (`wallet.ts`) -> state/newGame/sanitize/sellEmpire keep -> reward objects (`DailyReward`, `claimAward`) -> UI text.
  Adding fields to a shared interface made `tsc` list every call site that builds one by hand (the all-done merge in
  `ui.ts`), so run `npx tsc --noEmit` right after changing the interface, before touching the UI.
- **Test income with the real claim functions, not by poking state.** The first wallet medal test failed because I
  assumed `carsSold = 1000` unlocks awards; reading the existing achievements test showed which counter drives which
  award. Copy the setup of the nearest existing test.
- **Editing `src/` while the baseline e2e runs is safe, but vitest on 2 cores is not free:** one file with
  `--maxWorkers=1` took ~1 s; the full unit run waits until the background e2e prints EXIT.
- **Wrap a fixed-width row with `flex-wrap` plus `flex: 1 1 30%` instead of shortening labels.** Shrinking text
  ("Bran...") hides information; two rows keep every word.


## 2026-11-10 (run 34)

- **The repo was already cloned and in scope; `add_repo` was not available as a tool.** Check `git remote -v` in the
  working directory first before searching for tools; `git fetch` plus `git checkout -B dev origin/dev` was enough.
- **Check a sink's numbers against the thing it skips before pricing it.** Barn stages last 20-90 s, so a gem price
  scaled by remaining time would have been silly; a flat 1-gem "courtesy" is honest. Read the config table first.
- **An e2e step that changes `carsSold` can fire story beats.** I almost raised it to unlock the parts crate; the story
  test after it expects no scene before 20 sales. Use an item whose lock does not depend on a counter another test
  watches, or restore the counter in the same evaluate.
- **Reuse an existing card style (`.award`) for a new list page** instead of new CSS: layout, 320 px fit and the glow
  for "ready" came free, and only one dimming rule was needed.

## 2026-11-10 (run 35)

- **A full `npm run check` takes longer than one tool call (the e2e alone is ~17 minutes).** I started it in the
  foreground first and the 10-minute limit killed it half way. Start the baseline with `nohup ... &` right away and
  write code while it runs; edits to `src/` after the build step do not change what the running e2e tests.
- **Keep `src/core/` free of imports from `src/audio/`.** I first put the volume clamp in the music score and imported it
  from `save.ts`; moving it next to the other save repairs kept the layering rule (core knows nothing about audio).
- **Put the music rules in a pure file and the Web Audio in another.** The layer logic and the note patterns are plain
  functions, so 9 unit tests cover them without a fake AudioContext; the player only schedules what they return.
- **Gate analytics behind consent by default** and make the sink pluggable; the browser test uses the memory sink, so
  no real network code is needed to prove that events fire.

## 2026-11-10 (run 36)

- **Never run unit tests while the e2e is running.** The e2e is timing based (haggle needle, frame waits); my parallel
  `vitest` (38 workers) starved the browser and failed "lesson haggle pays x1.2". Start the check, then only edit files
  and write docs until it finishes; run `tsc` (cheap) at most.
- **Edits made to `tools/e2e-smoke.cjs` while the e2e runs are not picked up** (node loaded it already); start a second
  check after a test edit.
- **Put a new feature's e2e at the end, next to the non-debug desktop page:** a service worker only registers outside
  `?debug`, so that page is the one place to prove offline loading.

## 2026-11-10 (run 37)

- **Inject third-party SDK objects instead of reading globals inside the adapter.** Poki and CrazyGames are tiny
  duck-typed interfaces here, so six unit tests cover ads, failures and visibility without a browser; main.ts is the
  only file that touches `window`.
- **A "first callback wins" guard is needed for callback-style ad APIs** (finished and error can both fire); the test
  fires both on purpose.
- **Waiting for the ~17 min baseline:** poll with `sleep 100` calls (a single call is cut at 2 min), and use the wait for
  docs and e2e edits only.

## 2026-11-10 (run 38)

- **A red baseline can be a flake: re-run once before debugging, but make the next failure explain itself.** The start
  check failed on a Phaser `glTexture` page error that did not repeat. Page errors in the e2e now carry the last
  section name and a stack, so a rare one costs one look instead of a 17 min bisect.
- **Generate bulk string moves with a script that evals the old object** (ten scenes became catalog keys in one pass),
  then fix the leftovers by hand; keep `tsc` as the safety net (the plural-aware `BaseKey` type differs from
  `MessageKey`).
- **Use the e2e wait for refactors that are build-independent:** the browser test runs on `dist`, so source edits after
  the build step are safe, but never start `vitest` meanwhile.

## 2026-11-10 (run 39)

- **A pure view-model file moves to the catalog fastest with one python replace script that asserts every old string
  exists** (a missed or edited line fails loudly); `tsc` then checks the keys. Existing unit tests that assert the
  English text are the proof that nothing visible changed.
- **When the baseline check is running, `tsc --noEmit` is safe but nothing heavier**; wait for the e2e to finish.

## 2026-11-10 (run 40)

- **Same working pattern as runs 38-39 held: start `npm run check` in the background, move strings with a python
  replace script that asserts each old text occurs exactly once, run `tsc` only while the e2e runs.** A
  `sed -i '96a import ...'` after a script edit is fine, but check the import line number first (`grep -n "^import"`).
- **`vitest` printing only "RUN" for minutes is normal on 2 cores** (the balance tests are long); it is not a hang.
  Check `tail` of the log before deciding anything.


## 2026-11-10 (run 41)

- **Moving strings out of a view that builds text from config (perk labels, ordinals, plurals) is mostly about
  parameters, not text:** keep config names/descriptions in config, pass them as `{name}`/`{desc}`, and let `_one/_other`
  keys replace hand-written `=== 1 ? '' : 's'` plurals. English ordinal suffixes became four keys so another language can
  override the whole form.
- **A baseline `npm run check` takes ~13 min on this box; run it once, edit while it runs (only `tsc --noEmit`), then run
  the final check once.** Do not poll with `sleep` over 110 s: the tool call times out at 120 s.

## 2026-11-11 (run 42)

- **`npm ci` plus a foreground `npm run check` overruns the 10 min tool limit; start the check with `nohup ... &` writing to a
  log in the scratchpad and poll the log tail.** Source edits are safe while the e2e runs on `dist`.

## 2026-11-11 (run 43)

- **A move script that asserts the exact occurrence count of every old string fails before writing anything, so a wrong
  guess (I expected 2 `'Hired'` lines, there was 1) costs a re-run, not a half-edited file.** Keep that, and print the
  per-pattern counts for loops over similar lines.
- **If the scheduled prompt names a tool that is not present (`add_repo`), check whether the repo is already cloned and
  in scope before giving up:** here it was, so the run could proceed.

## 2026-11-11 (run 44)

- **Check the catalog for key-name collisions before adding keys:** `tsc` caught two duplicate keys (`ui.barn.title`,
  `ui.barn.keep` already existed for the reveal modal). Grep `en.ts` for the prefix first, and when a `sed` renames a
  key in `ui.ts`, check with `git diff` that it only touched the new call site.
- **`npm run check` takes ~10 minutes, longer than one tool call may run:** start it with `nohup ... &`, poll
  `pgrep` with sleeps, and do not edit source files while the build step may still be running.

## 2026-11-11 (run 45)

- **A key whose English text differs from an existing one is a new key, not a reuse:** `map.aria` ("{city} city map") looked
  like the map button's label ("{city} map"), and reusing it would have changed what screen readers say. Grep `en.ts` for
  the exact text before mapping a string to an old key, and add the unit test for the final text.
- **When a scheduled run starts, kick off the baseline with `nohup` first and do the string moves while its e2e runs:** the
  build step is done after ~1 min, after which source edits are safe (the e2e runs on `dist`), so the baseline cost no time.

## 2026-11-11 (run 46)

- **Before swapping literals for `t(...)`, grep the enclosing function for a local named `t`:** the daily task card's
  `update` had `const t = s.daily.tasks[index]`, which would have shadowed the translator (a runtime TypeError that `tsc`
  may not flag in every case). Rename the local (`task`) in the same edit.
- **A flake that recurs twice with the same stack is a real race, not noise:** `glTexture` of null came from freeing a
  texture while an image (a lot thumbnail waiting for the next rebuild) still showed it. Fix it where textures are freed
  (one helper for every scene), not by re-running the e2e until it passes. When a flake note says "if it recurs, log X",
  add the logging in the same run it first happens, so the second occurrence is diagnosable.

## 2026-11-11 (run 47)

- **Scene strings are few and mostly template literals: list them with one grep (`floatText|setText`) before writing the move
  script, then move them in a single pass.** The script asserted one occurrence per old string, so it either applied
  everything or nothing; `tsc` plus one catalog unit test was enough to trust the result without reading each diff.
- **The scheduled prompt's `add_repo` step may be a no-op:** the repo was already cloned and in scope (as in run 43), so
  `git fetch` and `git checkout -B dev origin/dev` was all that was needed.

## 2026-11-11 (run 48)

- **When a data table of strings becomes catalog keys, type it with `BaseKey`, not `MessageKey`:** `t()` takes `BaseKey`
  (plural suffixes stripped), so a `MessageKey[]` fails to compile with a confusing 350-member union error. Also update
  the test that read the table directly (`CUSTOMER_LINES.map(t)`).
- **Poll long checks in sleeps under 2 minutes:** a `sleep 240` in one call was killed by the tool timeout; the
  `nohup` check itself kept running, so nothing was lost.

## 2026-11-11 (run 49)

- **Grep for stray literals with more than one pattern before declaring a move done:** the first grep (`floatText|setText`)
  missed `ui.toast`/`ui.showBanner` calls in `main.ts`; a second grep on `ui\.(toast|showBanner)\(` and `title:|body:|button:`
  found them. Do both passes up front.
- **Tables of lines become key tables (`BaseKey[]`) resolved with `t()` at the pick function,** so tests can keep checking
  stability and length by mapping the keys through `t`.

## 2026-11-12 (run 50)

- **Do not edit source while a background `npm run check` is still running:** the build and e2e read the tree as it
  changes, so the result would not describe either version. Edit only docs during a run, or wait and re-run.
- **A full `npm run check` now takes about 12 minutes:** start it with `nohup` right away, poll in sleeps under 2 minutes,
  and do the doc edits while it runs. A foreground call hits the 10-minute tool limit.
