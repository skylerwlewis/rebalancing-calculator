import Big from "big.js";
import { ONE_HUNDRED } from "../calculator/BigConstants";

export default interface FundInputItem {
  internalId: number;
  name: string;
  currentBalance: Big;
  targetPercent: Big;
}

export interface FundInputItemStrings {
  internalId: number;
  nameString: string;
  currentBalanceString: string;
  targetPercentString: string;
}

export const toStrings = (fundInputItem: FundInputItem): FundInputItemStrings => {
  return {
    internalId: fundInputItem.internalId,
    nameString: fundInputItem.name,
    currentBalanceString: fundInputItem.currentBalance.toString(),
    targetPercentString: ONE_HUNDRED.times(fundInputItem.targetPercent).toString()
  }
}