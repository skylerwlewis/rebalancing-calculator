import Big from "big.js";
import FundInputItem from "../input/FundInputItem";

export interface InputUrlParams {
  name: string;
  currentBalance: string;
  targetPercent: string;
}

export const toInputUrlParams = (fundInputItem: FundInputItem): InputUrlParams => {
  return {
    name: fundInputItem.name,
    currentBalance: fundInputItem.currentBalance.toString(),
    targetPercent: fundInputItem.targetPercent.toString()
  }
}

export const fromInputUrlParams = (inputUrlParams: InputUrlParams, index: number): FundInputItem => {
  return {
    internalId: index,
    name: inputUrlParams.name,
    currentBalance: new Big(inputUrlParams.currentBalance),
    targetPercent: new Big(inputUrlParams.targetPercent)
  }
}