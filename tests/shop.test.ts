import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { buyShopItem, shopItems } from '../src/core/shop';
import { ECON } from '../src/core/config';
import { tick } from '../src/core/sim';

function game() {
  const s = newGame(1);
  s.carsSold = 200;
  s.cash = 1000;
  return s;
}
const item = (s: ReturnType<typeof game>, id: string) => shopItems(s).find((i) => i.id === id)!;

describe('shop (P1.7b)', () => {
  it('buys nothing without the currency and takes nothing', () => {
    const s = game();
    expect(buyShopItem(s, 'partsCrate')).toBeNull();
    expect(s.parts).toBe(0);
    expect(s.wallet.gems).toBe(0);
  });

  it('parts crate pays gems for parts', () => {
    const s = game();
    s.wallet.gems = 5;
    expect(buyShopItem(s, 'partsCrate')).toContain('parts');
    expect(s.parts).toBe(ECON.shop.partsCrate.parts);
    expect(s.wallet.gems).toBe(5 - ECON.shop.partsCrate.gems);
  });

  it('parts crate is locked until the crusher unlocks', () => {
    const s = game();
    s.carsSold = 3;
    s.wallet.gems = 9;
    expect(item(s, 'partsCrate').available).toBe(false);
    expect(buyShopItem(s, 'partsCrate')).toBeNull();
    expect(s.wallet.gems).toBe(9);
  });

  it('cash bag adds cash and spends gems', () => {
    const s = game();
    s.wallet.gems = ECON.shop.cashBag.gems;
    const before = s.cash;
    expect(buyShopItem(s, 'cashBag')).toBeTruthy();
    expect(s.cash).toBeGreaterThan(before);
    expect(s.wallet.gems).toBe(0);
  });

  it('barn rush finishes a running stage on the next tick', () => {
    const s = game();
    s.wallet.gems = 3;
    expect(buyShopItem(s, 'barnRush')).toBeNull();
    s.barn.status = 'working';
    s.barn.stage = 0;
    s.barn.timeLeft = 50;
    expect(buyShopItem(s, 'barnRush')).toBeTruthy();
    const ev = tick(s, 0.05);
    expect(ev.some((e) => e.type === 'barnStageDone')).toBe(true);
    expect(s.barn.stage).toBe(1);
    expect(s.wallet.gems).toBe(3 - ECON.shop.barnRushGems);
  });

  it('token lot needs an open lot with a free spot', () => {
    const s = game();
    s.wallet.tokens = 10;
    expect(item(s, 'tokenLot').available).toBe(false);
    expect(buyShopItem(s, 'tokenLot')).toBeNull();
    s.businesses.opened.carlot = true;
    expect(item(s, 'tokenLot').available).toBe(true);
    const cashBefore = s.cash;
    expect(buyShopItem(s, 'tokenLot')).toBeTruthy();
    expect(s.carlot.cars.length).toBe(1);
    expect(s.carlot.cars[0]!.paid).toBe(0);
    expect(s.cash).toBe(cashBefore);
    expect(s.wallet.tokens).toBe(10 - ECON.shop.tokenLot.tokens);
    // fill the lot: no free spot left
    const first = s.carlot.cars[0]!;
    while (s.carlot.cars.length < s.carlot.spots) s.carlot.cars.push({ ...first, id: 900 + s.carlot.cars.length });
    expect(item(s, 'tokenLot').available).toBe(false);
  });
});
