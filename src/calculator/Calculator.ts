import Big from 'big.js';
import { ONE, ZERO } from './BigConstants';
import { max, min, sum } from '../utils/BigUtils';
import FundInputItem from '../input/FundInputItem';


interface CalcFundItem {
  currentBalance: Big;
  targetPercent: Big;
}
interface CalculatorInput {
  amountToInvest: Big,
  fundInputItems: CalcFundItem[]
}

export interface CalcOutputItem {
  amountToInvest: Big,
  currentPercent: Big,
  balanceAfter: Big,
  percentAfter: Big
}

export interface CalculatorOutput {
  outputItems: CalcOutputItem[]
}

export const fromFundInputItem = (item: FundInputItem): CalcFundItem => {
  return { currentBalance: item.currentBalance, targetPercent: item.targetPercent }
}

const calculate = ({ amountToInvest, fundInputItems }: CalculatorInput): CalculatorOutput => {

  if (fundInputItems.length === 0) { return { outputItems: [] } }

    // Scale target percents down to total 100% if the total entered is over 100%
  const targetPercents = fundInputItems.map(fundInputItem => fundInputItem.targetPercent);
  const totalTargetPercents = sum(...targetPercents);
  const fixedTargetPercents = ONE.eq(totalTargetPercents) ? targetPercents : ZERO.eq(totalTargetPercents) ? new Array(targetPercents.length).fill(ZERO) : fundInputItems.map(fundInputItem => fundInputItem.targetPercent.div(totalTargetPercents));

  // Calculate total current balance and current percents
  const currentBalances = fundInputItems.map(fundInputItem => fundInputItem.currentBalance);
  const totalCurrentBalance = sum(...currentBalances);
  const currentPercents = ZERO.eq(totalCurrentBalance) ? new Array(fundInputItems.length).fill(ZERO) : fundInputItems.map(fundInputItem => fundInputItem.currentBalance.div(totalCurrentBalance));

  // Calculate initial target balances based on simple percentages of the new total balance
  const totalFutureBalance = totalCurrentBalance.plus(amountToInvest);
  const fixedTargetBalances = fixedTargetPercents.map(fixedTargetPercent => fixedTargetPercent.times(totalFutureBalance));

  // Adjust these target balances, since we aren't lowering any balances past their current balance
  const maxCurrentTargetRatio = max(...fixedTargetBalances.map((fixedTargetBalance, index) => ZERO.eq(fixedTargetBalance) ? ZERO : max(fixedTargetBalance, currentBalances[index]).div(fixedTargetBalance)));
  const adjustedTargetBalances = fixedTargetBalances.map(fixedTargetBalance => fixedTargetBalance.times(maxCurrentTargetRatio));

  // Now that we have our final targeted balances for each fund, determine how much lower the current balance is
  const balanceDifferences = fundInputItems.map((fundInputItem, index) => adjustedTargetBalances[index].minus(fundInputItem.currentBalance));
  const balanceDifferenceTotal = sum(...balanceDifferences);

  // Spread our amountToInvest over the balance differences, closing the gap as much as possible, weighting by balance difference
  const differenceScaled = ZERO.eq(balanceDifferenceTotal) ? new Array(balanceDifferences.length).fill(ZERO) : balanceDifferences.map(balanceDifference => min(balanceDifference, amountToInvest.times(balanceDifference).div(balanceDifferenceTotal)));
  const differenceScaledTotal = sum(...differenceScaled);

  // If we have any amountToInvest left over, invest that according to our original target percents
  const plusExtra = fixedTargetPercents.map(fixedTargetPercent => amountToInvest.minus(differenceScaledTotal).times(fixedTargetPercent));

  // Calculate a subtotal, rounded to the nearest cent
  const subtotal = plusExtra.map((extra, index) => extra.plus(differenceScaled[index]).round(2));

  // Fix our subtotal if we are off by a penny due to rounding issues
  const maxTotal = max(...subtotal);
  const maxTotalIndex = subtotal.indexOf(maxTotal);
  const fixedTotals = [...subtotal.slice(0, maxTotalIndex), maxTotal.minus(sum(...subtotal)).plus(amountToInvest), ...subtotal.slice(maxTotalIndex + 1)];

  // Calculate balances and percents after our final investments
  const balanceAfters = fixedTotals.map((fixedTotal, index) => fixedTotal.plus(fundInputItems[index].currentBalance));
  const balanceAftersTotal = sum(...balanceAfters);
  const percentAfters = ZERO.eq(balanceAftersTotal) ? new Array(balanceAfters.length).fill(ZERO) : balanceAfters.map(balanceAfter => balanceAfter.div(balanceAftersTotal));

  return {
    outputItems: fixedTotals.map((fixedTotal, index) => {
      return {
        currentPercent: currentPercents[index],
        amountToInvest: fixedTotal,
        balanceAfter: balanceAfters[index],
        percentAfter: percentAfters[index]
      }
    })
  };
};

export default calculate;