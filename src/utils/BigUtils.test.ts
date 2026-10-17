import { describe, expect, test, vi } from 'vitest';
import Big from 'big.js';
import { isBig, setBigFromString, toBig } from './BigUtils';

describe('toBig()', () => {
  test.each([
    ['50', '50'],
    ['5,0', '50'],
    ['50,', '50'],
    ['1,000', '1000'],
    ['1,234.56', '1234.56'],
  ])('parses %s as %s, stripping commas', (input, expected) => {
    expect(toBig(input)?.toString()).toBe(expected);
  });

  test.each(['', 'abc', ',', '1.2.3', '$5'])('returns undefined for invalid input %j', (input) => {
    expect(toBig(input)).toBeUndefined();
  });
});

describe('isBig()', () => {
  test('agrees with toBig() on comma input', () => {
    for (const input of ['5,0', '50,', '1,000']) {
      expect(isBig(input)).toBe(true);
      expect(() => toBig(input)).not.toThrow();
    }
    expect(isBig('abc')).toBe(false);
  });
});

describe('setBigFromString()', () => {
  test('keeps the raw string and sets the comma-stripped Big', () => {
    const setString = vi.fn();
    const setBig = vi.fn();
    setBigFromString('1,000', setString, setBig);
    expect(setString).toHaveBeenCalledWith('1,000');
    expect(setBig).toHaveBeenCalledWith(new Big('1000'));
  });

  test('does not set the Big for invalid input', () => {
    const setString = vi.fn();
    const setBig = vi.fn();
    setBigFromString('abc', setString, setBig);
    expect(setString).toHaveBeenCalledWith('abc');
    expect(setBig).not.toHaveBeenCalled();
  });
});
