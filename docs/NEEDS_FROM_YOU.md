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
      New since run 4: the barn find (red barn at the back of the yard after ~60 sales; four timed restoration
      stages and a big reveal) and the settings menu (☰ top right). Is the reveal exciting enough? Would you rather
      keep restored classics for a collection than sell them?
      New since run 5: new car art, four new car types (Vans after 15 sales, SUVs after 40, Sports Cars after 100,
      Hypercars after 200) and vibration on Android phones (Settings → Vibration). Do the new cars feel worth waiting
      for? Is the vibration too strong, too weak, or annoying on rapid taps?
      New since runs 6-7: Hydraulic Press upgrade and the Scrapper (after the crusher), a free Swap on each job,
      customers drawn as characters walking into the yard, Tradie and Influencer buyers, and "Skip haggling" in Settings.
      New since run 8: the barn shows each restoration stage inside (hoist, welder, paint booth) and the classic drives
      out before the reveal; the Scrapper stands by a little press next to the barn and fills the parts bin while you're
      away; the barn card is now first in the Yard tab. Does the barn read clearly at phone size?
- [ ] **Review and merge `dev` → `main`** when you're happy with a milestone (PR #1 was merged after run 5;
      open a new PR from `dev` for the next milestone). Claude works on `dev` and never pushes to `main`.

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
- 2026-11-05 (after run 5): Playtest done, about 10 minutes: the game works well and held the owner's attention.
  Wants better graphics and a city map. Decision: keep the current task order (finish Phase 0 polish incl. art
  P0.14h, then the map in P1.1). PR #1 merged.
