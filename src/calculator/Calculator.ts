import Big from "big.js";
import { ONE, ZERO } from "./BigConstants";
import { max, min, sum } from "../utils/BigUtils";
import FundInputItem from "../input/FundInputItem";


interface CalcFundItem {
  currentBalance: Big;
  targetPercent: Big;
}
interface CalculatorInput {
  amountToInvest: Big,
  fundInputItems: CalcFundItem[]
}

export interface CalcOutputItem {
  calculatedValue: Big,
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

const calculate = ({amountToInvest, fundInputItems}: CalculatorInput): CalculatorOutput => {

  if(fundInputItems.length === 0) { return { outputItems: [] } }

  const targetPercents = fundInputItems.map(fundInputItem => fundInputItem.targetPercent);
  const totalTargetPercents = sum(...targetPercents);
  const fixedTargetPercents = ONE.gte(totalTargetPercents) ? targetPercents : fundInputItems.map(fundInputItem => fundInputItem.targetPercent.div(totalTargetPercents));

  const totalCurrentBalance = sum(...fundInputItems.map(fundInputItem => fundInputItem.currentBalance));
  const currentPercents = ZERO.eq(totalCurrentBalance) ? new Array(fundInputItems.length).fill(ZERO) : fundInputItems.map(fundInputItem => fundInputItem.currentBalance.div(totalCurrentBalance));
  const percentDifferences = fixedTargetPercents.map((fixedTargetPercent, index) => ZERO.eq(fixedTargetPercent) ? ZERO : currentPercents[index].minus(fixedTargetPercent).div(fixedTargetPercent));

  const maxPercentDifference = max(...percentDifferences);
  const maxPercentDifferenceIndex = percentDifferences.indexOf(maxPercentDifference);
  const currentPercentForMaxPercentDifference = currentPercents[maxPercentDifferenceIndex];
  const targetPercentForMaxPercentDifference = fixedTargetPercents[maxPercentDifferenceIndex];

  const targetBalances = fundInputItems.map((fundInputItem, index) => max(fundInputItem.currentBalance, ZERO.eq(targetPercentForMaxPercentDifference) ? ZERO : fixedTargetPercents[index].times(totalCurrentBalance).times(currentPercentForMaxPercentDifference).div(targetPercentForMaxPercentDifference)));
  const balanceDifferences = fundInputItems.map((fundInputItem, index) => targetBalances[index].minus(fundInputItem.currentBalance));

  const balanceDifferenceTotal = sum(...balanceDifferences);
  const differenceScaled = ZERO.eq(balanceDifferenceTotal) ? new Array(balanceDifferences.length).fill(ZERO) : balanceDifferences.map(balanceDifference => min(balanceDifference, amountToInvest.times(balanceDifference).div(balanceDifferenceTotal)));
  const differenceScaledTotal = sum(...differenceScaled);

  const plusExtra = fixedTargetPercents.map(fixedTargetPercent => amountToInvest.minus(differenceScaledTotal).times(fixedTargetPercent));

  const subtotal = plusExtra.map((extra, index) => extra.plus(differenceScaled[index]).round(2));

  const maxTotal = max(...subtotal);
  const maxTotalIndex = subtotal.indexOf(maxTotal);

  const fixedTotals = [...subtotal.slice(0, maxTotalIndex), maxTotal.minus(sum(...subtotal)).plus(amountToInvest), ...subtotal.slice(maxTotalIndex + 1)];

  const balanceAfters = fixedTotals.map((fixedTotal, index) => fixedTotal.plus(fundInputItems[index].currentBalance));
  const balanceAftersTotal = sum(...balanceAfters);
  const percentAfters = ZERO.eq(balanceAftersTotal) ? new Array(balanceAfters.length).fill(ZERO) : balanceAfters.map(balanceAfter => balanceAfter.div(balanceAftersTotal));

  return { outputItems: fixedTotals.map((fixedTotal, index) => {
    return {
      calculatedValue: fixedTotal,
      currentPercent: currentPercents[index],
      balanceAfter: balanceAfters[index],
      percentAfter: percentAfters[index]
    }
  }) };
};

export default calculate;