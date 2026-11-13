import { describe, it, expect } from 'vitest';
import { createAdMobAds, withAdMob, type AdMobPlugin } from '../src/platform/admob';
import { createWebPlatform } from '../src/platform/platform';

type Cb = (e?: unknown) => void;
function fakePlugin(opts: { failLoad?: boolean; reward?: boolean; failShow?: boolean } = {}) {
  const ls: Record<string, Cb> = {};
  let prepared = 0;
  let shown = 0;
  const plugin: AdMobPlugin = {
    initialize: async () => {},
    prepareRewardVideoAd: async () => {
      prepared++;
      if (opts.failLoad) throw new Error('no fill');
    },
    showRewardVideoAd: async () => {
      shown++;
      if (opts.failShow) throw new Error('boom');
      setTimeout(() => {
        if (opts.reward !== false) ls.onRewardedVideoAdReward?.();
        ls.onRewardedVideoAdDismissed?.();
      }, 0);
    },
    addListener: (ev, cb) => {
      ls[ev] = cb;
    },
  };
  return { plugin, prepared: () => prepared, shown: () => shown };
}
const cfg = { adId: 'x', testing: true };

describe('AdMob rewarded ads', () => {
  it('is unavailable without a plugin or before init', async () => {
    const none = createAdMobAds(undefined, cfg);
    expect(await none.init()).toBe(false);
    expect(none.available()).toBe(false);
    expect(await none.show()).toBe(false);
    const f = fakePlugin();
    const ads = createAdMobAds(f.plugin, cfg);
    expect(ads.available()).toBe(false);
  });

  it('loads on init, grants the reward once, then preloads the next ad', async () => {
    const f = fakePlugin();
    const ads = createAdMobAds(f.plugin, cfg);
    expect(await ads.init()).toBe(true);
    expect(ads.available()).toBe(true);
    const p = ads.show();
    expect(ads.available()).toBe(false); // one ad at a time
    expect(await ads.show()).toBe(false);
    expect(await p).toBe(true);
    await new Promise((r) => setTimeout(r, 5));
    expect(f.prepared()).toBe(2);
    expect(ads.available()).toBe(true);
  });

  it('gives no reward when the video is dismissed early', async () => {
    const ads = createAdMobAds(fakePlugin({ reward: false }).plugin, cfg);
    await ads.init();
    expect(await ads.show()).toBe(false);
  });

  it('never throws: a failed load or show just means no reward', async () => {
    const noFill = createAdMobAds(fakePlugin({ failLoad: true }).plugin, cfg);
    await noFill.init();
    expect(noFill.available()).toBe(false);
    const bad = fakePlugin({ failShow: true });
    const ads = createAdMobAds(bad.plugin, cfg);
    await ads.init();
    expect(await ads.show()).toBe(false);
  });

  it('is hidden once ads are removed', async () => {
    let removed = false;
    const ads = createAdMobAds(fakePlugin().plugin, cfg, () => removed);
    await ads.init();
    expect(ads.available()).toBe(true);
    removed = true;
    expect(ads.available()).toBe(false);
    expect(await ads.show()).toBe(false);
  });

  it('plugs into the platform', async () => {
    const ads = createAdMobAds(fakePlugin().plugin, cfg);
    await ads.init();
    const p = withAdMob(createWebPlatform(), ads);
    expect(p.rewardedAdAvailable()).toBe(true);
    expect(await p.showRewardedAd('offline_double')).toBe(true);
  });
});
