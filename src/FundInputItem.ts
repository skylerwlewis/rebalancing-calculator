import Big from "big.js";

export default interface FundInputItem {
  internalId: number;
  name: string;
  currentBalance: Big;
  targetPercent: Big;
}