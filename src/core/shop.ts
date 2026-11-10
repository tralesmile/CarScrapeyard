/**
 * Shop (P1.7b): the first Gem and Auction Token sinks. Pure rules; the UI calls these and shows the result.
 * Nothing here adds an income stream: gems come from play (medals, dailies) and each item is a convenience.
 */
import { ECON, MODEL_NAMES, PAINTS } from './config';
import { carsWorth } from './daily';
import { carlotOpen, ensureLotFocus, hasFreeSpot } from './carlot';
import { unlockedFamilies } from './formulas';
import { pick } from './rng';
import { spendGems, spendTokens } from './wallet';
import type { GameState, LotCar } from './state';

export type ShopItemId = 'barnRush' | 'partsCrate' | 'cashBag' | 'tokenLot';

export interface ShopItem {
  id: ShopItemId;
  icon: string;
  name: string;
  /** What it does, short. */
  line: string;
  currency: 'gems' | 'tokens';
  price: number;
  /** Whether the item applies right now, and why not. */
  available: boolean;
  why: string;
  /** Whether the wallet covers the price. */
  affordable: boolean;
}

export const SHOP_ITEMS: ShopItemId[] = ['barnRush', 'partsCrate', 'cashBag', 'tokenLot'];

function crusherOpen(state: GameState): boolean {
  return state.carsSold >= ECON.crusher.unlockCarsSold;
}

/** Everything the shop shows right now, in display order. */
export function shopItems(state: GameState): ShopItem[] {
  const s = ECON.shop;
  const w = state.wallet;
  const make = (id: ShopItemId, icon: string, name: string, line: string, currency: 'gems' | 'tokens', price: number, ok: boolean, why: string): ShopItem => ({
    id,
    icon,
    name,
    line,
    currency,
    price,
    available: ok,
    why: ok ? '' : why,
    affordable: (currency === 'gems' ? w.gems : w.tokens) >= price,
  });
  const working = state.barn.status === 'working';
  return [
    make('barnRush', '🏚️', 'Barn rush', 'Finish the running restoration stage now', 'gems', s.barnRushGems, working, 'No stage is running'),
    make('partsCrate', '📦', 'Parts crate', `+${s.partsCrate.parts} ⚙ parts for the crusher bin and the barn`, 'gems', s.partsCrate.gems, crusherOpen(state), 'Unlocks with the crusher'),
    make('cashBag', '💰', 'Cash bag', `Cash worth ${s.cashBag.cars} average yard cars`, 'gems', s.cashBag.gems, state.carsSold >= 1, 'Sell a car first'),
    make(
      'tokenLot',
      '🎟',
      'Token lot',
      'A Good-condition car for the Used Car Lot, no cash price',
      'tokens',
      s.tokenLot.tokens,
      carlotOpen(state) && hasFreeSpot(state),
      carlotOpen(state) ? 'Your lot has no free spot' : 'Open the Used Car Lot first',
    ),
  ];
}

/** Buy an item. Returns a short result text for the toast, or null when it did not go through (nothing is taken). */
export function buyShopItem(state: GameState, id: ShopItemId): string | null {
  const item = shopItems(state).find((i) => i.id === id);
  if (!item || !item.available || !item.affordable) return null;
  const s = ECON.shop;
  switch (id) {
    case 'barnRush':
      if (!spendGems(state, item.price)) return null;
      // The barn timer runs out on the next tick, which announces the stage as usual.
      state.barn.timeLeft = 0;
      return 'Stage finished';
    case 'partsCrate':
      if (!spendGems(state, item.price)) return null;
      state.parts += s.partsCrate.parts;
      return `+${s.partsCrate.parts} ⚙ parts`;
    case 'cashBag': {
      if (!spendGems(state, item.price)) return null;
      const cash = carsWorth(state, s.cashBag.cars);
      state.cash += cash;
      return `+$${Math.round(cash).toLocaleString('en-US')}`;
    }
    case 'tokenLot': {
      if (!spendTokens(state, item.price)) return null;
      const l = state.carlot;
      const family = pick(state, unlockedFamilies(state.carsSold));
      const condition = s.tokenLot.condition;
      const car: LotCar = {
        id: l.nextId++,
        family,
        model: pick(state, MODEL_NAMES[family]),
        paint: pick(state, PAINTS),
        condition,
        paid: 0,
        work: ECON.carlot.conditions[condition].work,
      };
      l.cars.push(car);
      ensureLotFocus(state);
      return `${car.model} joins your lot`;
    }
  }
}
