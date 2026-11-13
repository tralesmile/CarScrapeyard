// Capacitor bridge (P2.1). The native shell injects `window.Capacitor`; its plugins (App, Haptics) are reached through
// `Capacitor.Plugins`, so the web build bundles no native code. Everything here takes the global as an argument, so it is
// unit-tested with plain objects and does nothing on the web.

import { HAPTIC_PATTERNS, type HapticKind, type VibrateFn } from './haptics';

export type NativeName = 'ios' | 'android';

export interface HapticsPlugin {
  impact(opts: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }): Promise<void> | void;
  notification(opts: { type: 'SUCCESS' | 'WARNING' | 'ERROR' }): Promise<void> | void;
}

export interface AppPlugin {
  addListener(event: 'backButton', cb: (e: { canGoBack: boolean }) => void): unknown;
  addListener(event: 'appStateChange', cb: (e: { isActive: boolean }) => void): unknown;
  exitApp(): Promise<void> | void;
}

export interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: { App?: AppPlugin; Haptics?: HapticsPlugin };
}

/** 'ios' / 'android' inside a Capacitor shell, otherwise null (plain web, portals). */
export function detectNative(cap: CapacitorGlobal | undefined): NativeName | null {
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return null;
  const p = typeof cap.getPlatform === 'function' ? cap.getPlatform() : '';
  return p === 'ios' || p === 'android' ? p : null;
}

const KIND_STYLE: Record<HapticKind, { impact: 'LIGHT' | 'MEDIUM' | 'HEAVY' } | { notification: 'SUCCESS' | 'WARNING' | 'ERROR' }> = {
  tick: { impact: 'LIGHT' },
  tap: { impact: 'LIGHT' },
  success: { notification: 'SUCCESS' },
  heavy: { impact: 'HEAVY' },
  error: { notification: 'ERROR' },
  celebrate: { notification: 'SUCCESS' },
};

/** A `VibrateFn` for `Haptics` that plays the native haptic engine. `Haptics.play` passes the pattern of a kind, so the kind is found by identity. */
export function nativeVibrate(plugin: HapticsPlugin | undefined): VibrateFn | null {
  if (!plugin) return null;
  return (pattern) => {
    const kind = (Object.keys(HAPTIC_PATTERNS) as HapticKind[]).find((k) => HAPTIC_PATTERNS[k] === pattern);
    if (!kind) return false;
    const style = KIND_STYLE[kind];
    try {
      const r = 'impact' in style ? plugin.impact({ style: style.impact }) : plugin.notification({ type: style.notification });
      void Promise.resolve(r).catch(() => {});
      return true;
    } catch {
      return false;
    }
  };
}

/** Android back button: `onBack` closes the topmost modal or screen and returns true; when nothing is open the app exits. */
export function bindBackButton(app: AppPlugin | undefined, onBack: () => boolean): boolean {
  if (!app) return false;
  app.addListener('backButton', () => {
    if (!onBack()) void Promise.resolve(app.exitApp()).catch(() => {});
  });
  return true;
}

/** Foreground / background of the whole app (the WebView's `visibilitychange` is not reliable in every shell). */
export function bindAppState(app: AppPlugin | undefined, onChange: (active: boolean) => void): boolean {
  if (!app) return false;
  app.addListener('appStateChange', (e) => onChange(e.isActive));
  return true;
}
