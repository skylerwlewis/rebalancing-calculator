import { describe, expect, test } from 'vitest';
import Big from 'big.js';
import calculate from './Calculator';

// Helper to build a CalcFundItem-compatible object (FundInputItem shape)
function fund(currentBalance: string, targetPercent: string) {
  return {
    internalId: 0,
    name: 'Fund',
    currentBalance: new Big(currentBalance),
    // targetPercent stored as decimal (0.40 = 40%)
    targetPercent: new Big(targetPercent).div(100),
  };
}

function toFixed(big: Big, decimals = 2) {
  return big.toFixed(decimals);
}

describe('calculate()', () => {
  test('default two-fund scenario: VFIAX $100/40% + VTSAX $100/60%, invest $100', () => {
    const result = calculate({
      amountToInvest: new Big('100'),
      fundInputItems: [fund('100', '40'), fund('100', '60')],
    });

    const [vfiax, vtsax] = result.outputItems;

    // VFIAX is at 50% current, target 40% — over target, gets the smaller share
    expect(toFixed(vfiax.amountToInvest)).toBe('20.00');
    expect(toFixed(vtsax.amountToInvest)).toBe('80.00');

    expect(toFixed(vfiax.balanceAfter)).toBe('120.00');
    expect(toFixed(vtsax.balanceAfter)).toBe('180.00');

    // percentAfter should be close to target (40% / 60%)
    expect(vfiax.percentAfter.toFixed(4)).toBe('0.4000');
    expect(vtsax.percentAfter.toFixed(4)).toBe('0.6000');
  });

  test('amounts sum exactly to amountToInvest (rounding correctness)', () => {
    // Three-fund split — common source of off-by-a-penny rounding errors
    const result = calculate({
      amountToInvest: new Big('100'),
      fundInputItems: [fund('100', '33'), fund('100', '33'), fund('100', '34')],
    });

    const total = result.outputItems.reduce(
      (acc, item) => acc.plus(item.amountToInvest),
      new Big('0')
    );

    expect(toFixed(total)).toBe('100.00');
  });

  test('fund already over target: gets $0, rest fills the other', () => {
    // VFIAX balance=200, target=40% — already over target with invest=$100
    // Total future = 200 + 100 + 100 = 400; 40% of 400 = 160 < 200 → VFIAX gets $0
    const result = calculate({
      amountToInvest: new Big('100'),
      fundInputItems: [fund('200', '40'), fund('100', '60')],
    });

    const [vfiax, vtsax] = result.outputItems;

    expect(toFixed(vfiax.amountToInvest)).toBe('0.00');
    expect(toFixed(vtsax.amountToInvest)).toBe('100.00');
  });

  test('single fund: all investment goes to it', () => {
    const result = calculate({
      amountToInvest: new Big('500'),
      fundInputItems: [fund('1000', '100')],
    });

    expect(toFixed(result.outputItems[0].amountToInvest)).toBe('500.00');
    expect(toFixed(result.outputItems[0].balanceAfter)).toBe('1500.00');
    expect(result.outputItems[0].percentAfter.toFixed(4)).toBe('1.0000');
  });

  test('empty fund list: returns empty outputItems', () => {
    const result = calculate({
      amountToInvest: new Big('100'),
      fundInputItems: [],
    });

    expect(result.outputItems).toHaveLength(0);
  });

  test('target percentages sum > 100%: normalized proportionally', () => {
    // Both at 80% → each effectively 50% after normalization
    const result = calculate({
      amountToInvest: new Big('100'),
      fundInputItems: [fund('100', '80'), fund('100', '80')],
    });

    const [a, b] = result.outputItems;

    // After normalization both targets are 50%; current is also 50% — split evenly
    expect(toFixed(a.amountToInvest)).toBe('50.00');
    expect(toFixed(b.amountToInvest)).toBe('50.00');
  });

  test('zero total current balance: no division-by-zero, splits by target', () => {
    const result = calculate({
      amountToInvest: new Big('100'),
      fundInputItems: [fund('0', '40'), fund('0', '60')],
    });

    const [a, b] = result.outputItems;

    expect(toFixed(a.amountToInvest)).toBe('40.00');
    expect(toFixed(b.amountToInvest)).toBe('60.00');

    // percentAfter should match target percents
    expect(a.percentAfter.toFixed(4)).toBe('0.4000');
    expect(b.percentAfter.toFixed(4)).toBe('0.6000');
  });

  test('zero amountToInvest: all funds get $0', () => {
    const result = calculate({
      amountToInvest: new Big('0'),
      fundInputItems: [fund('100', '40'), fund('100', '60')],
    });

    for (const item of result.outputItems) {
      expect(toFixed(item.amountToInvest)).toBe('0.00');
    }
  });

  test('all target percents are 0%: investment assigned to first fund (no-op targets branch)', () => {
    // ZERO.eq(totalTargetPercents) → fixedTargetPercents all zero → all gaps are
    // zero → differenceScaled all zero → plusExtra all zero → penny-fix assigns
    // full amountToInvest to fund at maxTotalIndex (first fund by position).
    const result = calculate({
      amountToInvest: new Big('100'),
      fundInputItems: [fund('100', '0'), fund('100', '0')],
    });

    const total = result.outputItems.reduce(
      (acc, item) => acc.plus(item.amountToInvest),
      new Big('0')
    );
    // Investment is not lost — it ends up somewhere
    expect(toFixed(total)).toBe('100.00');
  });

  test('one fund has 0% target: that fund is skipped in ratio calc, gets $0', () => {
    // The ZERO.eq(fixedTargetBalance) guard in the maxCurrentTargetRatio
    // calculation prevents division-by-zero and correctly excludes the 0%-target
    // fund from influencing the ratio.  All investment goes to the other fund.
    const result = calculate({
      amountToInvest: new Big('100'),
      fundInputItems: [fund('100', '0'), fund('100', '100')],
    });

    const [zeroTarget, fullTarget] = result.outputItems;
    expect(toFixed(zeroTarget.amountToInvest)).toBe('0.00');
    expect(toFixed(fullTarget.amountToInvest)).toBe('100.00');
  });

  test('zero balances AND zero investment: no division-by-zero, all outputs are zero', () => {
    // Exercises both the ZERO.eq(balanceDifferenceTotal) guard (→ differenceScaled
    // filled with ZERO) and the ZERO.eq(balanceAftersTotal) guard (→ percentAfters
    // filled with ZERO), both of which are only reachable when this combination
    // of inputs is present.
    const result = calculate({
      amountToInvest: new Big('0'),
      fundInputItems: [fund('0', '40'), fund('0', '60')],
    });

    for (const item of result.outputItems) {
      expect(toFixed(item.amountToInvest)).toBe('0.00');
      expect(toFixed(item.balanceAfter)).toBe('0.00');
      expect(item.percentAfter.toFixed(4)).toBe('0.0000');
    }
  });
});
