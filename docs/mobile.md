# Mobile shells (Capacitor)

The same web build runs inside native Android and iOS apps through Capacitor 7. Game code never imports Capacitor: the
shell injects `window.Capacitor`, and `src/platform/native.ts` reads it (so the web build, Poki and CrazyGames stay clean).

## What exists

- `capacitor.config.ts` — app id `com.junkyardempire.game` (placeholder until store accounts exist), web dir `dist`.
- `android/`, `ios/` — generated projects. Capacitor's own `.gitignore` keeps the copied web assets out of git.
- Plugins: `@capacitor/app` (back button, foreground/background), `@capacitor/haptics` (native haptic engine).
- Portrait only on phones (Android manifest, iPhone orientations in `Info.plist`).

## What the game does inside the shell

- Back button: `Ui.handleBack()` clicks the `data-back` button of the topmost sheet. With nothing open the app exits.
- App state: `setAppHidden` in `main.ts` is the one place for pause/resume (save, mute, offline earnings popup); both
  `visibilitychange` and Capacitor's `appStateChange` call it.
- Haptics: `Haptics.setBackend(nativeVibrate(...))`; each haptic kind maps to impact LIGHT/HEAVY or notification SUCCESS/ERROR.
- No service worker (the shell already has the files); `platform.name` is `android` or `ios`.

## Building (on a computer with the tools)

```
npm ci
npm run cap:android   # builds the web game, syncs it, opens Android Studio (needs the Android SDK)
npm run cap:ios       # same for Xcode (macOS only)
```

After changing web code run `npm run cap:sync`. Rewarded ads (P2.2a) go through `Capacitor.Plugins.AdMob` (the community AdMob plugin, not installed yet: it needs the owner's AdMob app ids, see NEEDS_FROM_YOU); without it no ad is offered. Purchases, cloud save and push notifications are P2.3-P2.5.

## Testing without a device

`tests/native.test.ts` covers the bridge with plain objects, and the e2e section "native shell (Capacitor stub)" injects a
fake `window.Capacitor` before the page loads and checks back, exit, app state and haptics.
