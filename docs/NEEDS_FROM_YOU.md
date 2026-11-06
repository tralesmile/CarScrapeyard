# Things needed from the owner

Claude keeps this list up to date. When you ask "what do you need from me?", this is the answer.
Items are ordered by when they block work. Tick an item (or tell Claude) when it's done.

## Now

- [ ] **GitHub Actions stopped running (since 2026-11-06 16:34 UTC).** Every CI job since the PR #5 merge on `main`
      ends in 2-3 seconds without a runner ever starting (no logs), including PR #6 and a re-run. The code is fine: the
      same checks pass locally (typecheck, 218 unit tests, build, browser e2e). This usually means the account's free
      Actions minutes for private repos are used up, a spending limit of $0 was reached, or there is a billing/payment
      problem. Please check github.com → Settings → Billing and plans (and the repo's Actions settings), then re-run the
      failed job on PR #6. Making the repo public also gives unlimited free minutes.
      Owner decision (2026-11-06): keep the repo private and wait for the monthly reset. CI now runs only on PRs into
      `main` and on `main` (not on every push to `dev`), and a newer push cancels the older run, to save minutes.
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
      New since run 9 (your graphics feedback): car outlines are smooth now (the stair-steps came from an engine setting,
      fixed), the hypercar has its own shape (fin, big wing, bubble canopy), and the yard backdrop is repainted
      (clouds, layered hills, junk piles). Does it look good enough now, or what still looks cheap? The first sale of each
      car type now shows a Collection toast.
      New since run 10 (your city map request): a 🗺 button after 30 sales opens the Rust Valley map with your scrapyard
      and the Repair Garage's goal ($200K earned in total); the garage itself opens in the next update. Is the map what
      you had in mind (a plan view of the town with buildings), or would you rather have a side-scrolling street?
      Muscle cars (hood scoop) and hatchbacks (rounder) were redrawn to look less alike.
      New since run 11: **the Repair Garage is open for business.** Earn $200K in total, open it on the map for $100K and
      tap "Go": customers bring cars with a fault (flat tyre, battery, brakes, exhaust, engine); tap the car to fix it
      and they pay. Spare parts from the scrapyard save you the parts bill. Upgrades: Tool Wall, Reputation, two more
      bays, and a Foreman who works while you're away. Is tapping fun here, or should the garage have its own
      mini-game (e.g. hold to tighten, pick the right tool)? Is $100K and ~14 minutes the right moment?
      New since run 12: the garage looks alive: the customer steps out and waits next to their car, the Foreman stands in
      the workshop, the lift raises the car, a flat tyre makes the car lean, a dead battery sparks, and the lift's beam
      is the "REPAIR GARAGE" sign. The SUV has a spare wheel on the back and sits higher, so it no longer looks like the
      van. Does the garage read clearly on your phone?
      New since run 13: customers say what's wrong when they step out ("Ran over a nail!"), a flat tyre gets a new tyre
      rolled on, and the city map shows your businesses growing (three stars each: more lot slots / repair bays add cars,
      a crusher, an office, open garage doors). "Go" drives there with a road wipe. Do the map stars make you want to buy
      the next slot or bay? Still open: tapping vs a garage mini-game (hold to tighten, pick the right tool).
      New since run 14: **the Used Car Lot is open for business** (third business, after $5M earned in total; $2.5M to
      open). Buy cars at the auction board (you see the condition stars, price and profit before you bid), tap the car
      to refurbish it, then sell with the haggle slider or let a walk-up buyer take it. Hire the Detailer and the Auction
      Agent and it runs on its own. Is choosing between rough (cheap, lots of tapping) and mint (quick flip) cars an
      interesting choice? Should the auction be a real bidding mini-game (rival bidders, raise or pass) instead of a
      fixed price? The sim puts the lot opening at about 45 minutes for an active player.
      New since run 15: the auction counts down ("Going… 5s"), stamps lots SOLD! when someone else gets them and YOURS!
      when you do, with a gavel knock. Walk-up buyers now have personalities: they walk up, look the car over, say what
      they think and pay extra for cars they like (the Collector +30% for cars you bought in Good or Mint condition).
      Does the countdown make you want to grab a lot before it goes?
      New since run 16 (rules only, playable next update): the fourth business, Paint & Tuning ($50M goal), takes orders
      of one to three services (respray, rims, vinyl wrap, engine tune) and tips you +25% when you finish an order fast
      yourself. Do you like a tip for speed here, or would you rather have a style mini-game (pick the colour the
      customer asked for)?
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
