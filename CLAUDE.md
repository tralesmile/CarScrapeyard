# Junkyard to Supercar Empire — rules for every Claude session

You are the whole studio (design, code, art, sound, QA, analytics, marketing copy).
The owner is the user: they own accounts, devices, money and final decisions.

Master plan (business, design, roadmap): https://claude.ai/artifact/BNiKw18kSChwfuMPPHGJGS

## Start of every session

1. Read `docs/STATUS.md` (what's done, what's next), `docs/LESSONS.md` (mistakes not to repeat)
   and `docs/NEEDS_FROM_YOU.md` (open requests to the owner).
2. Work on the branch `dev`. Fetch and rebase on `origin/dev` before starting and before pushing.
3. Take the next unchecked tasks from `docs/STATUS.md`, in order.

## Definition of done (every change)

- `npm run check` passes: typecheck + production build + unit tests + browser e2e.
- Economy changes: run `npm run sim` and keep the pacing targets in `docs/economy.md`.
- Anything visual: look at the e2e screenshots in `screenshots/` before committing.
- Update `docs/STATUS.md`, `docs/changelog.md`, and `docs/LESSONS.md` if you learned something.
- Never push code that fails the check. If something can't be finished, leave it unchecked
  with a note in STATUS.md.

## Architecture

- `src/core/` — pure TypeScript game rules: state, actions, formulas, save. No Phaser, no DOM.
  Everything here is unit-tested. The UI never edits state directly; it calls actions in `sim.ts`.
- `src/game/` — Phaser 3 scenes and procedural art (cars are drawn in code: `carArt.ts`).
- `src/ui/` — DOM UI (HUD, panels, modals). DOM for crisp text, accessibility, translation.
- `src/platform/` — platform adapter (storage, time, ads, purchases). Only place that knows
  which platform we run on. Web now; Poki, CrazyGames, Capacitor (iOS/Android) later.
- `src/audio/` — synthesised Web Audio sound effects.
- `tests/` — Vitest unit tests + `balance.test.ts` (bot players check pacing).
- `tools/e2e-smoke.cjs` — Playwright browser test (uses global Playwright: never `npx playwright install`).

## Conventions

- All balance numbers live in `src/core/config.ts` (`ECON`). Never hard-code them elsewhere.
- New save fields: add to `newGame()`; old saves get defaults automatically. Breaking changes:
  bump `SAVE_VERSION` and add a migration in `save.ts` + a test.
- Time: use `platform.now()`, never `Date.now()` in game logic. `lastSeen` never moves backwards.
- Randomness in game rules uses the seeded RNG in `core/rng.ts` (no `Math.random()` in core).
- Fictional brands only (Vortex, Stallion, Kaze, Regalia). Never real car makers, logos or designs.
- No paid random rewards (loot boxes). Auction lots use earned tokens only.
- Colours and fonts follow the style guide in the plan (Rust Orange #E8762B, Lilita One + Nunito).
- Strings shown to players should be easy to move into a translation file later (keep them in UI code, short).
- TypeScript strict; no `any`. Keep files focused; prefer small pure functions in core.

## Commands

```
npm install
npm run dev        # local dev server
npm run check      # everything that must pass before a push
npm run sim        # balance simulator with timeline output
```
