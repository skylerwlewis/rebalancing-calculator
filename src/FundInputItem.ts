import Big from "big.js";

export default interface FundInputItem {
  name: string;
  currentBalance: Big;
  targetPercent: Big;
}