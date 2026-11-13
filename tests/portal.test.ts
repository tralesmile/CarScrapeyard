import { describe, expect, it, vi } from 'vitest';
import {
  bindGameplayToVisibility,
  createCrazyGamesSdk,
  createPokiSdk,
  detectPortal,
  withPortal,
  type CrazyGamesGlobal,
  type PokiGlobal,
} from '../src/platform/portal';
import { MemoryStore } from '../src/core/save';
import type { Platform } from '../src/platform/platform';

const base = (): Platform => ({
  name: 'web',
  storage: new MemoryStore(),
  storageVolatile: false,
  now: () => 1,
  showRewardedAd: async () => false,
  rewardedAdAvailable: () => false,
});

const poki = (over: Partial<PokiGlobal> = {}): PokiGlobal => ({
  init: async () => {},
  gameLoadingFinished: vi.fn(),
  gameplayStart: vi.fn(),
  gameplayStop: vi.fn(),
  rewardedBreak: async () => true,
  ...over,
});

describe('portal adapters', () => {
  it('detects the portal from the query string or a present global', () => {
    expect(detectPortal('?portal=poki', {})).toBe('poki');
    expect(detectPortal('?portal=crazygames', {})).toBe('crazygames');
    expect(detectPortal('?portal=other', {})).toBeNull();
    expect(detectPortal('', { PokiSDK: {} })).toBe('poki');
    expect(detectPortal('', { CrazyGames: {} })).toBe('crazygames');
    expect(detectPortal('', {})).toBeNull();
  });

  it('Poki: rewarded result, failures never throw', async () => {
    expect(await createPokiSdk(poki()).rewardedAd('x')).toBe(true);
    expect(await createPokiSdk(poki({ rewardedBreak: async () => false })).rewardedAd('x')).toBe(false);
    expect(await createPokiSdk(poki({ rewardedBreak: async () => { throw new Error('no'); } })).rewardedAd('x')).toBe(false);
    expect(await createPokiSdk(poki({ init: async () => { throw new Error('no'); } })).init()).toBe(false);
    const throwing = createPokiSdk(poki({ gameplayStart: () => { throw new Error('boom'); } }));
    expect(() => throwing.gameplayStart()).not.toThrow();
  });

  const crazy = (mode: 'finish' | 'error' | 'throw'): CrazyGamesGlobal => ({
    SDK: {
      init: async () => {},
      game: { gameplayStart: vi.fn(), gameplayStop: vi.fn() },
      ad: {
        requestAd: (_t, cb) => {
          if (mode === 'throw') throw new Error('x');
          if (mode === 'finish') cb.adFinished?.();
          else cb.adError?.('blocked');
          cb.adFinished?.(); // a second callback must not flip the answer
        },
      },
    },
  });

  it('CrazyGames: finished grants, error or throw does not, first callback wins', async () => {
    expect(await createCrazyGamesSdk(crazy('finish')).rewardedAd('x')).toBe(true);
    expect(await createCrazyGamesSdk(crazy('error')).rewardedAd('x')).toBe(false);
    expect(await createCrazyGamesSdk(crazy('throw')).rewardedAd('x')).toBe(false);
  });

  it('withPortal offers ads only after init, one at a time, and renames the platform', async () => {
    let release: (v: boolean) => void = () => {};
    const sdk = createPokiSdk(poki({ rewardedBreak: () => new Promise<boolean>((r) => (release = r)) }));
    const p = withPortal(base(), sdk);
    expect(p.name).toBe('poki');
    expect(p.rewardedAdAvailable()).toBe(false);
    expect(await p.showRewardedAd('boost')).toBe(false); // not initialised yet
    await Promise.resolve();
    await Promise.resolve();
    expect(p.rewardedAdAvailable()).toBe(true);
    const first = p.showRewardedAd('boost');
    expect(p.rewardedAdAvailable()).toBe(false);
    expect(await p.showRewardedAd('boost')).toBe(false); // busy
    release(true);
    expect(await first).toBe(true);
    expect(p.rewardedAdAvailable()).toBe(true);
  });

  it('a failed init keeps ads off but the game keeps its storage and clock', async () => {
    const p = withPortal(base(), createPokiSdk(poki({ init: async () => { throw new Error('x'); } })));
    await Promise.resolve();
    await Promise.resolve();
    expect(p.rewardedAdAvailable()).toBe(false);
    expect(p.now()).toBe(1);
  });

  it('gameplay start/stop follows tab visibility and unsubscribes', () => {
    const handlers: (() => void)[] = [];
    const doc = {
      hidden: false,
      addEventListener: (_t: 'visibilitychange', f: () => void) => handlers.push(f),
      removeEventListener: (_t: 'visibilitychange', f: () => void) => handlers.splice(handlers.indexOf(f), 1),
    };
    const g = poki();
    const off = bindGameplayToVisibility(createPokiSdk(g), doc);
    expect(g.gameplayStart).toHaveBeenCalledTimes(1);
    doc.hidden = true;
    handlers[0]!();
    expect(g.gameplayStop).toHaveBeenCalledTimes(1);
    handlers[0]!();
    expect(g.gameplayStop).toHaveBeenCalledTimes(1);
    doc.hidden = false;
    handlers[0]!();
    expect(g.gameplayStart).toHaveBeenCalledTimes(2);
    off();
    expect(handlers).toHaveLength(0);
  });
});
