// Number formatting for big idle-game numbers.
// 999 -> "999", 1234 -> "1.23K", 1.5e6 -> "1.50M", then B, T, then aa, ab, ...

const NAMED = ['', 'K', 'M', 'B', 'T'];

function suffix(tier: number): string {
  const named = NAMED[tier];
  if (named !== undefined) return named;
  // tier 5 -> "aa", 6 -> "ab", ... 30 -> "az", 31 -> "ba"
  const n = tier - NAMED.length;
  const first = String.fromCharCode(97 + Math.floor(n / 26));
  const second = String.fromCharCode(97 + (n % 26));
  return first + second;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  const sign = value < 0 ? '-' : '';
  const v = Math.abs(value);
  if (v < 1000) return sign + Math.floor(v).toString();
  const tier = Math.floor(Math.log10(v) / 3);
  const scaled = v / Math.pow(1000, tier);
  // Guard against 999.995 rounding up to "1000.00K".
  if (scaled >= 999.995) return sign + (1).toFixed(2) + suffix(tier + 1);
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return sign + scaled.toFixed(digits) + suffix(tier);
}

export function formatCash(value: number): string {
  return '$' + formatNumber(value);
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
