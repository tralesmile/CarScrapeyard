// Platform adapter: the only place that knows which platform we run on.
// Game code calls `platform.*`; web, Poki, CrazyGames and Capacitor builds
// each provide their own implementation later (ads, purchases, cloud save).

import { MemoryStore, type KeyValueStore } from '../core/save';

export interface Platform {
  name: 'web' | 'poki' | 'crazygames' | 'ios' | 'android';
  storage: KeyValueStore;
  /** True if saving is likely to be lost (private browsing, blocked storage). */
  storageVolatile: boolean;
  /** Trusted time in ms. Web uses the device clock; mobile will use server time. */
  now(): number;
  /** Rewarded video. Resolves true only if the reward should be granted. */
  showRewardedAd(placement: string): Promise<boolean>;
  rewardedAdAvailable(): boolean;
}

class LocalStore implements KeyValueStore {
  get(key: string) {
    return window.localStorage.getItem(key);
  }
  set(key: string, value: string) {
    window.localStorage.setItem(key, value);
  }
  remove(key: string) {
    window.localStorage.removeItem(key);
  }
}

function pickStorage(): { storage: KeyValueStore; volatile: boolean } {
  try {
    const probe = '__jye_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return { storage: new LocalStore(), volatile: false };
  } catch {
    // Safari private mode, blocked cookies, sandboxed iframes on some portals.
    return { storage: new MemoryStore(), volatile: true };
  }
}

export function createWebPlatform(): Platform {
  const { storage, volatile } = pickStorage();
  return {
    name: 'web',
    storage,
    storageVolatile: volatile,
    now: () => Date.now(),
    // No ad network in the prototype.
    showRewardedAd: async () => false,
    rewardedAdAvailable: () => false,
  };
}
