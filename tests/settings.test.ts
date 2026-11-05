import { afterEach, describe, expect, it } from 'vitest';
import { formatCash, formatNumber, setNumberFormat } from '../src/core/format';
import { deserialize, serialize } from '../src/core/save';
import { newGame, type GameState } from '../src/core/state';

const T0 = 1_800_000_000_000;

describe('number format setting', () => {
  afterEach(() => setNumberFormat('short'));

  it('scientific shows mantissa and exponent', () => {
    expect(formatNumber(999, 'scientific')).toBe('999');
    expect(formatNumber(1234, 'scientific')).toBe('1.23e3');
    expect(formatNumber(1.5e6, 'scientific')).toBe('1.50e6');
    expect(formatNumber(9.999e8, 'scientific')).toBe('1.00e9');
    expect(formatNumber(-2.5e12, 'scientific')).toBe('-2.50e12');
  });

  it('the global setting changes formatCash and falls back to short for junk', () => {
    setNumberFormat('scientific');
    expect(formatCash(45_000)).toBe('$4.50e4');
    setNumberFormat('nonsense' as 'short');
    expect(formatCash(45_000)).toBe('$45.0K');
  });
});

describe('settings in the save', () => {
  it('new games start with sound and music on, motion and short numbers', () => {
    const s = newGame(T0, 1);
    expect(s.settings).toEqual({ sound: true, music: true, reduceMotion: false, numberFormat: 'short' });
  });

  it('old saves without the new settings get defaults; bad values are fixed', () => {
    const s = newGame(T0, 1);
    s.settings.sound = false;
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    raw.settings = { sound: false };
    const loaded = deserialize(serialize(raw as unknown as GameState, T0), T0)!.state;
    expect(loaded.settings).toEqual({ sound: false, music: true, reduceMotion: false, numberFormat: 'short' });
    const bad = JSON.parse(JSON.stringify(s)) as GameState;
    (bad.settings as { numberFormat: string }).numberFormat = 'roman';
    expect(deserialize(serialize(bad, T0), T0)!.state.settings.numberFormat).toBe('short');
  });

  it('settings survive a round trip', () => {
    const s = newGame(T0, 1);
    s.settings = { sound: false, music: false, reduceMotion: true, numberFormat: 'scientific' };
    expect(deserialize(serialize(s, T0), T0)!.state.settings).toEqual(s.settings);
  });
});
