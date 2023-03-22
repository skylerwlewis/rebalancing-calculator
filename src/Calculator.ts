import Big from "big.js";
import { ONE, ZERO } from "./BigConstants";
import { max, min, sum } from "./BigUtils";
import FundInputItem from "./FundInputItem";

const calculate = (amountToInvest: Big, fundInputItems: FundInputItem[]): Big[] => {

  const targetPercents = fundInputItems.map(fundInputItem => fundInputItem.targetPercent);
  const totalTargetPercents = sum(...targetPercents);
  const fixedTargetPercents = ONE.gte(totalTargetPercents) ? targetPercents : fundInputItems.map(fundInputItem => fundInputItem.targetPercent.div(totalTargetPercents));

  const totalCurrentBalance = sum(...fundInputItems.map(fundInputItem => fundInputItem.currentBalance));
  const currentPercents = fundInputItems.map(fundInputItem => fundInputItem.currentBalance.div(totalCurrentBalance));
  const percentDifferences = fundInputItems.map((fundInputItem, index) => ZERO.eq(fixedTargetPercents[index]) ? ZERO : currentPercents[index].minus(fixedTargetPercents[index]).div(fixedTargetPercents[index]));

  const maxPercentDifference = max(...percentDifferences);
  const maxPercentDifferenceIndex = percentDifferences.indexOf(maxPercentDifference);
  const currentPercentForMaxPercentDifference = currentPercents[maxPercentDifferenceIndex];
  const targetPercentForMaxPercentDifference = fixedTargetPercents[maxPercentDifferenceIndex];

  const targetBalances = fundInputItems.map((fundInputItem, index) => max(fundInputItem.currentBalance, ZERO.eq(targetPercentForMaxPercentDifference) ? ZERO : fixedTargetPercents[index].times(totalCurrentBalance).times(currentPercentForMaxPercentDifference).div(targetPercentForMaxPercentDifference)));
  const balanceDifferences = fundInputItems.map((fundInputItem, index) => targetBalances[index].minus(fundInputItem.currentBalance));

  const balanceDifferenceTotal = sum(...balanceDifferences);
  const differenceScaled = ZERO.eq(balanceDifferenceTotal) ? new Array(fundInputItems.length).fill(ZERO) : balanceDifferences.map(balanceDifference => min(balanceDifference, amountToInvest.times(balanceDifference).div(balanceDifferenceTotal)));
  const differenceScaledTotal = sum(...differenceScaled);

  const plusExtra = fundInputItems.map((fundInputItem, index) => amountToInvest.minus(differenceScaledTotal).times(fixedTargetPercents[index]));

  const subtotal = plusExtra.map((extra, index) => extra.plus(differenceScaled[index]).round(2));

  const maxTotal = max(...subtotal);
  const maxTotalIndex = subtotal.indexOf(maxTotal);

  const fixedTotals = [...subtotal.slice(0, maxTotalIndex), maxTotal.minus(sum(...subtotal)).plus(amountToInvest), ...subtotal.slice(maxTotalIndex + 1)];

  return fixedTotals;
};

export default calculate;