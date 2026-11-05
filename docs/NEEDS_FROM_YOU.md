# Things needed from the owner

Claude keeps this list up to date. When you ask "what do you need from me?", this is the answer.
Items are ordered by when they block work. Tick an item (or tell Claude) when it's done.

## Now

- [ ] **Play the prototype and give feedback.** Run `npm install && npm run dev` (or open the PR's
      build), play 10–15 minutes on your phone, and say what felt slow, confusing or fun.
      New since run 2: the car crusher (after ~25 sales) and the Jobs board (after ~45 sales) —
      do they feel rewarding, and is the Crush button easy to find?
      New since run 3: haggling (the slider on your 2nd sale and on rare cars) and the customer strip under
      the top bar (after ~10 sales). Is the haggle needle too fast or too slow? Do you want haggling on every sale?
- [ ] **Review and merge pull request #1 (`dev` → `main`)** when you're happy with a milestone.
      Claude works on `dev` and never pushes to `main`.

## Soon (Phase 1, web MVP)

- [ ] **Cloudflare account** (free): connect this repo in Cloudflare Pages so every push to `main`
      deploys the web game. Build command `npm run build`, output folder `dist`.
- [ ] **Domain name** (about $10–15/year), e.g. junkyardempire.com.
- [ ] **Google Play developer account ($25)** — create it early: personal accounts need a 14-day
      closed test with 12+ testers before launch.
- [ ] **Start a Discord server** for testers (Claude will write the rules and welcome posts).

## Later (Phase 2, mobile)

- [ ] Apple Developer Program ($99/year) and a way to build iOS (Codemagic free tier or a Mac).
- [ ] Google AdMob account; Firebase project; RevenueCat account.
- [ ] 20–25 Android testers for the closed test.
- [ ] Bank/tax details in Google Play Console and App Store Connect for payouts.

## Answered decisions

- 2026-11-05: Team = owner + Claude as the whole studio (no freelancers).
