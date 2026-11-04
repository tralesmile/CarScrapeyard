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
