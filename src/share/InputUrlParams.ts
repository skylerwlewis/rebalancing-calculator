import Big from 'big.js';
import FundInputItem from '../input/FundInputItem';

export interface FundInputItemParams {
  name: string;
  currentBalance: string;
  targetPercent: string;
}
export interface InputUrlParams {
  amountToInvest?: string;
  fundInputItems?: FundInputItemParams[];
}

export const toFundInputItemParams = (fundInputItem: FundInputItem): FundInputItemParams => {
  return {
    name: fundInputItem.name,
    currentBalance: fundInputItem.currentBalance.toString(),
    targetPercent: fundInputItem.targetPercent.toString()
  }
}

export const fromFundInputItemParams = (inputUrlParams: FundInputItemParams, index: number): FundInputItem => {
  return {
    internalId: index,
    name: inputUrlParams.name,
    currentBalance: new Big(inputUrlParams.currentBalance),
    targetPercent: new Big(inputUrlParams.targetPercent)
  }
}

export interface MinifiedFundInputItemParams {
  a: string;
  b: string;
  c: string;
}

export const toMinifiedFundInputItemParams = (fundInputItemParams: FundInputItemParams): MinifiedFundInputItemParams => {
  return {
    a: fundInputItemParams.name,
    b: fundInputItemParams.currentBalance,
    c: fundInputItemParams.targetPercent,
  }
}

export const fromMinifiedFundInputItemParams = (fundInputItemParams: MinifiedFundInputItemParams): FundInputItemParams => {
  return {
    name: fundInputItemParams.a,
    currentBalance: fundInputItemParams.b,
    targetPercent: fundInputItemParams.c,
  }
}

export interface MinifiedInputUrlParams {
  a?: string;
  b?: MinifiedFundInputItemParams[];
}

export const toMinifiedInputUrlParams = (inputUrlParams: InputUrlParams): MinifiedInputUrlParams => {
  return {
    a: inputUrlParams.amountToInvest,
    b: inputUrlParams.fundInputItems ? inputUrlParams.fundInputItems.map(toMinifiedFundInputItemParams) : undefined
  }
}

export const fromMinifiedInputUrlParams = (inputUrlParams: MinifiedInputUrlParams): InputUrlParams => {
  return {
    amountToInvest: inputUrlParams.a,
    fundInputItems: inputUrlParams.b ? inputUrlParams.b.map(fromMinifiedFundInputItemParams) : undefined
  }
}