import { Big } from 'big.js';
import { createContext } from 'react';
import { ONE_HUNDREDTH } from '../calculator/BigConstants';
import { BigFieldSetters } from './BigFieldProps';
import FundInputItem from './FundInputItem';
import { StringFieldSetters } from './StringFieldProps';

export interface FundInputItemSetter {
  internalId: number,
  nameSetters: StringFieldSetters;
  currentBalanceSetters: BigFieldSetters;
  targetPercentSetters: BigFieldSetters;
}

export interface InputContextState {
  amountToInvest: Big,
  amountToInvestSetters: BigFieldSetters,
  fundInputItems: FundInputItem[];
  fundInputItemSetters: FundInputItemSetter[];
  addFundInputItem: () => void;
  removeFundInputItem: (index: number) => void;
}

// Default context setters do nothing; InputProvider supplies the real ones.
const noop = () => undefined;

export const initialAmountToInvest = new Big('100');
const initialItems: FundInputItem[] = [
  {
    internalId: 0,
    name: 'VFIAX',
    currentBalance: new Big('100'),
    targetPercent: ONE_HUNDREDTH.times(new Big('40'))
  },
  {
    internalId: 1,
    name: 'VTSAX',
    currentBalance: new Big('100'),
    targetPercent: ONE_HUNDREDTH.times(new Big('60'))
  }
]

const initialBigFieldSetter = (big: Big): BigFieldSetters => {
  return {
    stringValue: big.toString(),
    setStringValue: noop,
    setBigValue: noop
  }
}
const initialStringFieldSetter = (string: string): StringFieldSetters => {
  return {
    stringValue: string,
    setStringValue: noop
  }
}
export const initialInputState: InputContextState = {
  amountToInvest: initialAmountToInvest,
  amountToInvestSetters: initialBigFieldSetter(initialAmountToInvest),
  fundInputItems: initialItems,
  fundInputItemSetters: initialItems.map(fundInputItem => {
    return {
      internalId: fundInputItem.internalId,
      nameSetters: initialStringFieldSetter(fundInputItem.name),
      currentBalanceSetters: initialBigFieldSetter(fundInputItem.currentBalance),
      targetPercentSetters: initialBigFieldSetter(fundInputItem.targetPercent)
    }
  }),
  addFundInputItem: noop,
  removeFundInputItem: noop
};

export const InputContext = createContext<InputContextState>(initialInputState);
