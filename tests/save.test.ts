import { describe, expect, it } from 'vitest';
import { checksum, deserialize, MemoryStore, SaveManager, serialize, withDefaults } from '../src/core/save';
import { tick } from '../src/core/sim';
import { newGame } from '../src/core/state';

const T0 = 1_800_000_000_000;

function played() {
  const s = newGame(T0, 9);
  s.managers = { mechanic: true, washer: true, seller: true };
  tick(s, 300);
  return s;
}

describe('save system', () => {
  it('round-trips a game', () => {
    const s = played();
    const back = deserialize(serialize(s, T0), T0);
    expect(back?.state).toEqual(s);
  });

  it('rejects a tampered save', () => {
    const s = played();
    const env = JSON.parse(serialize(s, T0));
    env.data = env.data.replace(/"cash":[0-9.]+/, '"cash":999999999');
    expect(deserialize(JSON.stringify(env), T0)).toBeNull();
  });

  it('rejects impossible values even with a valid checksum', () => {
    const s = played();
    s.cash = s.lifetimeEarnings * 10 + 1000;
    expect(deserialize(serialize(s, T0), T0)).toBeNull();
  });

  it('rejects garbage and saves from a newer game version', () => {
    expect(deserialize('not json', T0)).toBeNull();
    expect(deserialize(null, T0)).toBeNull();
    const s = played();
    const data = JSON.stringify(s);
    const future = JSON.stringify({ v: 999, savedAt: T0, sum: checksum(data), data });
    expect(deserialize(future, T0)).toBeNull();
  });

  it('fills missing fields from defaults (old saves keep loading)', () => {
    const partial = { cash: 50, lifetimeEarnings: 50, levels: { wash: 3 } };
    const s = withDefaults(partial, newGame(T0, 1));
    expect(s.cash).toBe(50);
    expect(s.levels.wash).toBe(3);
    expect(s.levels.repair).toBe(1);
    expect(s.managers.mechanic).toBe(false);
    expect(Array.isArray(s.cars)).toBe(true);
  });

  it('replaces wrong types and non-finite numbers with defaults', () => {
    const s = withDefaults({ cash: 'lots', slots: NaN, settings: null }, newGame(T0, 1));
    expect(s.cash).toBe(0);
    expect(s.slots).toBe(1);
    expect(s.settings.sound).toBe(true);
  });

  it('drops broken cars instead of crashing', () => {
    const s = played();
    (s.cars as unknown[]).push({ id: 'x' }, null);
    const back = deserialize(serialize(s, T0), T0);
    expect(back).not.toBeNull();
    expect(back!.state.cars.every((c) => typeof c.id === 'number')).toBe(true);
  });

  it('falls back to the other slot when the newest is corrupted', () => {
    const store = new MemoryStore();
    const mgr = new SaveManager(store);
    const s = played();
    mgr.save(s, T0); // slot a
    const later = structuredClone(s);
    later.carsSold += 5;
    mgr.save(later, T0 + 5000); // slot b
    store.set('jye_save_b', store.get('jye_save_b')!.slice(0, 40)); // crash mid-write
    const loaded = new SaveManager(store).load(T0 + 6000);
    expect(loaded?.carsSold).toBe(s.carsSold);
  });

  it('loads the newest of two good slots', () => {
    const store = new MemoryStore();
    const mgr = new SaveManager(store);
    const s = played();
    mgr.save(s, T0);
    const later = structuredClone(s);
    later.carsSold += 5;
    mgr.save(later, T0 + 5000);
    expect(new SaveManager(store).load(T0 + 6000)?.carsSold).toBe(later.carsSold);
  });

  it('reports failure when storage throws (full or private mode)', () => {
    const mgr = new SaveManager({
      get: () => null,
      set: () => {
        throw new Error('QuotaExceededError');
      },
      remove: () => {},
    });
    expect(mgr.save(played(), T0)).toBe(false);
  });
});
