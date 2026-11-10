// Portal adapters (Poki, CrazyGames) behind the platform interface.
// The SDK objects are injected (duck-typed), so everything here is unit-testable
// without a network or a browser. Game code never talks to a portal directly.

import type { Platform } from './platform';

export type PortalName = 'poki' | 'crazygames';

/** What the game needs from any portal. Every method is safe to call at any time. */
export interface PortalSdk {
  name: PortalName;
  /** Initialise the SDK. Resolves false if it failed (the game still runs). */
  init(): Promise<boolean>;
  /** The first screen is playable. */
  loadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  /** Rewarded video. Resolves true only if the reward should be granted. */
  rewardedAd(placement: string): Promise<boolean>;
}

// ---- Minimal shapes of the real SDKs (only what we call) ----

export interface PokiGlobal {
  init(): Promise<void>;
  gameLoadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  rewardedBreak(): Promise<boolean>;
}

export interface CrazyAdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: unknown) => void;
}

export interface CrazyGamesGlobal {
  SDK: {
    init(): Promise<void>;
    game: {
      loadingStop?(): void;
      gameplayStart(): void;
      gameplayStop(): void;
    };
    ad: {
      requestAd(type: 'rewarded' | 'midgame', callbacks: CrazyAdCallbacks): void;
    };
  };
}

function safe(fn: () => void): void {
  try {
    fn();
  } catch {
    /* a portal hiccup must never break the game */
  }
}

export function createPokiSdk(poki: PokiGlobal): PortalSdk {
  return {
    name: 'poki',
    async init() {
      try {
        await poki.init();
        return true;
      } catch {
        return false;
      }
    },
    loadingFinished: () => safe(() => poki.gameLoadingFinished()),
    gameplayStart: () => safe(() => poki.gameplayStart()),
    gameplayStop: () => safe(() => poki.gameplayStop()),
    async rewardedAd() {
      try {
        return (await poki.rewardedBreak()) === true;
      } catch {
        return false;
      }
    },
  };
}

export function createCrazyGamesSdk(cg: CrazyGamesGlobal): PortalSdk {
  return {
    name: 'crazygames',
    async init() {
      try {
        await cg.SDK.init();
        return true;
      } catch {
        return false;
      }
    },
    loadingFinished: () => safe(() => cg.SDK.game.loadingStop?.()),
    gameplayStart: () => safe(() => cg.SDK.game.gameplayStart()),
    gameplayStop: () => safe(() => cg.SDK.game.gameplayStop()),
    rewardedAd() {
      return new Promise<boolean>((resolve) => {
        let done = false;
        const finish = (v: boolean) => {
          if (!done) {
            done = true;
            resolve(v);
          }
        };
        try {
          cg.SDK.ad.requestAd('rewarded', {
            adFinished: () => finish(true),
            adError: () => finish(false),
          });
        } catch {
          finish(false);
        }
      });
    },
  };
}

/** Which portal are we on? `?portal=poki` wins, then a global that is already present. */
export function detectPortal(
  search: string,
  globals: { PokiSDK?: unknown; CrazyGames?: unknown },
): PortalName | null {
  const q = new URLSearchParams(search).get('portal');
  if (q === 'poki' || q === 'crazygames') return q;
  if (globals.PokiSDK) return 'poki';
  if (globals.CrazyGames) return 'crazygames';
  return null;
}

/**
 * Wrap a base platform so rewarded ads and the platform name come from the portal.
 * The ad is only offered after `init()` resolved true, and one ad runs at a time.
 */
export function withPortal(base: Platform, sdk: PortalSdk): Platform & { portal: PortalSdk; ready(): boolean } {
  let ready = false;
  let busy = false;
  void sdk.init().then((ok) => {
    ready = ok;
  });
  return {
    ...base,
    name: sdk.name,
    portal: sdk,
    ready: () => ready,
    rewardedAdAvailable: () => ready && !busy,
    async showRewardedAd(placement: string) {
      if (!ready || busy) return false;
      busy = true;
      try {
        return await sdk.rewardedAd(placement);
      } finally {
        busy = false;
      }
    },
  };
}

/** Pause/resume portal gameplay timing with tab visibility. Returns an unsubscribe function. */
export function bindGameplayToVisibility(
  sdk: PortalSdk,
  doc: { hidden: boolean; addEventListener(t: 'visibilitychange', f: () => void): void; removeEventListener(t: 'visibilitychange', f: () => void): void },
): () => void {
  let playing = false;
  const sync = () => {
    const want = !doc.hidden;
    if (want && !playing) sdk.gameplayStart();
    if (!want && playing) sdk.gameplayStop();
    playing = want;
  };
  doc.addEventListener('visibilitychange', sync);
  sync();
  return () => doc.removeEventListener('visibilitychange', sync);
}
