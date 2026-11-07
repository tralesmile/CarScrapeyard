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

