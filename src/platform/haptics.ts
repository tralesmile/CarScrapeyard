// Haptic feedback. Web uses navigator.vibrate (Android Chrome; iOS Safari ignores it).
// Capacitor builds will swap the backend for the Haptics plugin (P2.1); game code only
// calls `haptics.play(kind)`.

export type HapticKind = 'tick' | 'tap' | 'success' | 'heavy' | 'error' | 'celebrate';

/** Vibration patterns in ms (on, off, on...). Short and subtle: haptics should feel, not buzz. */
export const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  tick: 6,
  tap: 12,
  success: [14, 50, 22],
  heavy: [40, 30, 60],
  error: [30, 40, 30],
  celebrate: [20, 40, 20, 40, 60],
};

/** Minimum ms between two buzzes of the same kind (rapid repair taps, wash scrubbing). */
const MIN_GAP: Record<HapticKind, number> = { tick: 60, tap: 40, success: 150, heavy: 200, error: 150, celebrate: 400 };

export type VibrateFn = (pattern: number | number[]) => boolean;

export class Haptics {
  enabled = true;
  private last: Partial<Record<HapticKind, number>> = {};

  constructor(
    private vibrate: VibrateFn | null,
    private clock: () => number = () => performance.now(),
  ) {}

  /** True if this device can vibrate at all (used to hide the setting where it does nothing). */
  get supported(): boolean {
    return this.vibrate !== null;
  }

  /** Returns true if a vibration was requested. */
  play(kind: HapticKind): boolean {
    if (!this.enabled || !this.vibrate) return false;
    const now = this.clock();
    const prev = this.last[kind];
    if (prev !== undefined && now - prev < MIN_GAP[kind]) return false;
    this.last[kind] = now;
    try {
      return this.vibrate(HAPTIC_PATTERNS[kind]);
    } catch {
      return false;
    }
  }
}

function webVibrate(): VibrateFn | null {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return null;
  // Chrome blocks (and logs a console error for) vibrate before the first tap on the page; the Foreman or the crew can
  // finish a job right after a reload, so skip until the page has had a user gesture.
  return (p) => {
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (ua && !ua.hasBeenActive) return false;
    return navigator.vibrate(p);
  };
}

export const haptics = new Haptics(webVibrate());
