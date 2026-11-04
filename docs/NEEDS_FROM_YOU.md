# Things needed from the owner

Claude keeps this list up to date. When you ask "what do you need from me?", this is the answer.
Items are ordered by when they block work. Tick an item (or tell Claude) when it's done.

## Now

- [ ] **Play the prototype and give feedback.** Run `npm install && npm run dev` (or open the PR's
      build), play 10–15 minutes on your phone, and say what felt slow, confusing or fun.
- [ ] **Review and merge the `dev` → `main` pull request** when you're happy with a milestone.
      Claude works on `dev` and never pushes to `main`.

## Soon (Phase 1, web MVP)

- [ ] **CI permission:** if GitHub rejects the workflow file, allow GitHub Actions for the repo
      (Settings → Actions → General → Allow all actions).
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
