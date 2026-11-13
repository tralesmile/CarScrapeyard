// AdMob rewarded ads (P2.2). The native shell injects `window.Capacitor`; the AdMob plugin is reached through
// `Capacitor.Plugins.AdMob`, so the web build bundles no native code. Pure: the plugin is injected, so it is unit-tested
// with plain objects. Ads are only offered when the player has not removed them and a video is loaded.

import type { Platform } from './platform';

/** Minimal shape of the community AdMob plugin (only what we call). */
export interface AdMobPlugin {
  initialize(opts?: Record<string, unknown>): Promise<void>;
  prepareRewardVideoAd(opts: { adId: string; isTesting?: boolean }): Promise<unknown>;
  showRewardVideoAd(): Promise<unknown>;
  addListener(event: 'onRewardedVideoAdReward' | 'onRewardedVideoAdDismissed' | 'onRewardedVideoAdFailedToLoad' | 'onRewardedVideoAdFailedToShow', cb: (e?: unknown) => void): unknown;
}

export interface AdMobConfig {
  /** Rewarded ad unit id. Test ids until the owner's AdMob account exists (see NEEDS_FROM_YOU). */
  adId: string;
  testing: boolean;
}

/** Google's public test unit ids: safe to ship in debug builds. */
export const TEST_REWARDED_ID = { android: 'ca-app-pub-3940256099942544/5224354917', ios: 'ca-app-pub-3940256099942544/1712485313' } as const;

export interface RewardedAds {
  init(): Promise<boolean>;
  available(): boolean;
  /** Resolves true only if the player earned the reward. Never throws. */
  show(): Promise<boolean>;
}

export function createAdMobAds(plugin: AdMobPlugin | undefined, cfg: AdMobConfig, adsRemoved: () => boolean = () => false): RewardedAds {
  let ready = false;
  let loading = false;
  let busy = false;
  let rewarded = false;
  let finish: ((earned: boolean) => void) | null = null;

  const load = async () => {
    if (!plugin || loading || ready) return;
    loading = true;
    try {
      await plugin.prepareRewardVideoAd({ adId: cfg.adId, isTesting: cfg.testing });
      ready = true;
    } catch {
      ready = false;
    } finally {
      loading = false;
    }
  };

  const end = () => {
    const f = finish;
    finish = null;
    busy = false;
    ready = false;
    const earned = rewarded;
    rewarded = false;
    f?.(earned);
    void load(); // preload the next one
  };

  return {
    async init() {
      if (!plugin) return false;
      try {
        await plugin.initialize({});
        plugin.addListener('onRewardedVideoAdReward', () => {
          rewarded = true;
        });
        plugin.addListener('onRewardedVideoAdDismissed', end);
        plugin.addListener('onRewardedVideoAdFailedToShow', end);
        plugin.addListener('onRewardedVideoAdFailedToLoad', () => {
          ready = false;
          loading = false;
        });
      } catch {
        return false;
      }
      await load();
      return true;
    },
    available: () => !!plugin && ready && !busy && !adsRemoved(),
    async show() {
      if (!plugin || !ready || busy || adsRemoved()) return false;
      busy = true;
      rewarded = false;
      return new Promise<boolean>((resolve) => {
        finish = resolve;
        Promise.resolve(plugin.showRewardVideoAd()).catch(end);
      });
    },
  };
}

/** Wrap a base platform so rewarded ads come from AdMob. */
export function withAdMob(base: Platform, ads: RewardedAds): Platform {
  return {
    ...base,
    rewardedAdAvailable: () => ads.available(),
    showRewardedAd: () => ads.show(),
  };
}
