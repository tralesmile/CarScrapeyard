# Junkyard to Supercar Empire

An idle car tycoon game: inherit Grandpa Joe's scrapyard, pressure-wash and fix wrecks,
sell them, hire a crew and grow a car empire. One TypeScript codebase for web, iOS and Android.

## Play it locally

```bash
npm install
npm run dev
```

Open the printed URL (on your phone too, if it's on the same Wi-Fi: use the "Network" URL).

## Checks

```bash
npm run check   # typecheck, production build, unit tests, browser test
npm run sim     # balance simulator: prints the opening timeline
```

The browser test needs Playwright installed once: `npm i -g playwright && npx playwright install chromium`.

## Project docs

- [Status and next tasks](docs/STATUS.md)
- [Things needed from the owner](docs/NEEDS_FROM_YOU.md)
- [Game design summary](docs/GDD.md)
- [Economy numbers](docs/economy.md)
- [Changelog](docs/changelog.md)
- [Master plan](https://claude.ai/artifact/BNiKw18kSChwfuMPPHGJGS)

## Tech

Phaser 3, TypeScript, Vite, Vitest. Mobile builds will use Capacitor; backend Firebase.
