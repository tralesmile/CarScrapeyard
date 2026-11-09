/**
 * Wallet (P1.7a): Gems (soft premium, bought later) and Auction Tokens (earn-only). Both are kept on a Sell Empire.
 * `earned` totals feed stats and the future shop; spending never lowers them.
 */
import { ECON } from './config';
import type { GameState } from './state';

export interface Wallet {
  gems: number;
  tokens: number;
  gemsEarned: number;
  tokensEarned: number;
}

export function newWallet(): Wallet {
  return { gems: 0, tokens: 0, gemsEarned: 0, tokensEarned: 0 };
}

const whole = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

export function addGems(state: GameState, n: number): number {
  const add = Math.min(whole(n), Math.max(0, ECON.wallet.maxGems - state.wallet.gems));
  state.wallet.gems += add;
  state.wallet.gemsEarned += add;
  return add;
}

export function addTokens(state: GameState, n: number): number {
  const add = Math.min(whole(n), Math.max(0, ECON.wallet.maxTokens - state.wallet.tokens));
  state.wallet.tokens += add;
  state.wallet.tokensEarned += add;
  return add;
}

/** Spend gems; false (and nothing taken) when there are not enough. */
export function spendGems(state: GameState, n: number): boolean {
  const cost = whole(n);
  if (cost <= 0 || state.wallet.gems < cost) return false;
  state.wallet.gems -= cost;
  return true;
}

export function spendTokens(state: GameState, n: number): boolean {
  const cost = whole(n);
  if (cost <= 0 || state.wallet.tokens < cost) return false;
  state.wallet.tokens -= cost;
  return true;
}

/** Gems for a medal tier (0-3). */
export function medalGems(tier: number): number {
  return ECON.wallet.medalGems[Math.min(Math.max(0, tier), ECON.wallet.medalGems.length - 1)] ?? 0;
}

/** Short text such as "+3 💎 · +1 🎟", empty when nothing was paid. */
export function walletText(gems: number, tokens: number): string {
  return [gems > 0 ? `+${gems} 💎` : '', tokens > 0 ? `+${tokens} 🎟` : ''].filter(Boolean).join(' · ');
}

/** Save repair: whole numbers within the caps, earned never below what is held. */
export function sanitizeWallet(state: GameState): void {
  const w = state.wallet as Partial<Wallet> | undefined;
  const clean = newWallet();
  if (w && typeof w === 'object') {
    clean.gems = Math.min(whole(w.gems ?? 0), ECON.wallet.maxGems);
    clean.tokens = Math.min(whole(w.tokens ?? 0), ECON.wallet.maxTokens);
    clean.gemsEarned = Math.max(whole(w.gemsEarned ?? 0), clean.gems);
    clean.tokensEarned = Math.max(whole(w.tokensEarned ?? 0), clean.tokens);
  }
  state.wallet = clean;
}
