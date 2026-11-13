import { describe, it, expect } from 'vitest';
import { bindAppState, bindBackButton, detectNative, nativeVibrate, type AppPlugin, type HapticsPlugin } from '../src/platform/native';
import { HAPTIC_PATTERNS, Haptics } from '../src/platform/haptics';

function fakeApp() {
  const listeners: Record<string, (e: never) => void> = {};
  let exits = 0;
  const app = {
    addListener: (ev: string, cb: (e: never) => void) => {
      listeners[ev] = cb;
    },
    exitApp: () => {
      exits++;
    },
  } as unknown as AppPlugin;
  return { app, fire: (ev: string, e: unknown) => listeners[ev]?.(e as never), exits: () => exits };
}

describe('native bridge', () => {
  it('detects the shell only when Capacitor says it is native', () => {
    expect(detectNative(undefined)).toBeNull();
    expect(detectNative({})).toBeNull();
    expect(detectNative({ isNativePlatform: () => false, getPlatform: () => 'web' })).toBeNull();
    expect(detectNative({ isNativePlatform: () => true, getPlatform: () => 'android' })).toBe('android');
    expect(detectNative({ isNativePlatform: () => true, getPlatform: () => 'ios' })).toBe('ios');
    expect(detectNative({ isNativePlatform: () => true, getPlatform: () => 'electron' })).toBeNull();
  });

  it('maps every haptic kind to a native call through Haptics.play', () => {
    const calls: string[] = [];
    const plugin: HapticsPlugin = {
      impact: (o) => void calls.push(`impact:${o.style}`),
      notification: (o) => void calls.push(`notification:${o.type}`),
    };
    let t = 0;
    const h = new Haptics(nativeVibrate(plugin), () => (t += 1000));
    expect(h.supported).toBe(true);
    for (const kind of Object.keys(HAPTIC_PATTERNS) as (keyof typeof HAPTIC_PATTERNS)[]) expect(h.play(kind)).toBe(true);
    expect(calls).toEqual([
      'impact:LIGHT',
      'impact:LIGHT',
      'notification:SUCCESS',
      'impact:HEAVY',
      'notification:ERROR',
      'notification:SUCCESS',
    ]);
  });

  it('has no haptics without the plugin and survives a throwing plugin', () => {
    expect(nativeVibrate(undefined)).toBeNull();
    const bad: HapticsPlugin = {
      impact: () => {
        throw new Error('no engine');
      },
      notification: () => Promise.reject(new Error('no engine')),
    };
    const v = nativeVibrate(bad)!;
    expect(v(HAPTIC_PATTERNS.heavy)).toBe(false);
    expect(v(HAPTIC_PATTERNS.error)).toBe(true); // rejected promises are swallowed
    expect(v([1, 2, 3])).toBe(false); // not one of our patterns
  });

  it('back button closes things first and exits only when nothing is open', () => {
    const f = fakeApp();
    let open = 2;
    expect(bindBackButton(f.app, () => (open > 0 ? (open--, true) : false))).toBe(true);
    f.fire('backButton', { canGoBack: false });
    f.fire('backButton', { canGoBack: false });
    expect(f.exits()).toBe(0);
    f.fire('backButton', { canGoBack: false });
    expect(f.exits()).toBe(1);
    expect(bindBackButton(undefined, () => true)).toBe(false);
  });

  it('reports app state changes', () => {
    const f = fakeApp();
    const seen: boolean[] = [];
    expect(bindAppState(f.app, (a) => seen.push(a))).toBe(true);
    f.fire('appStateChange', { isActive: false });
    f.fire('appStateChange', { isActive: true });
    expect(seen).toEqual([false, true]);
    expect(bindAppState(undefined, () => {})).toBe(false);
  });
});
