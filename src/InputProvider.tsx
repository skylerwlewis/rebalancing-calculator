import { Big } from 'big.js';
import { createContext, PropsWithChildren, useContext, useState } from 'react';
import { ONE_HUNDRED, ONE_HUNDREDTH, ZERO } from './BigConstants';
import { BigFieldSetters } from './BigFieldProps';
import FundInputItem from './FundInputItem';
import { setItemProperty } from './SetUtils';
import { StringFieldSetters } from './StringFieldProps';
import { UrlParamInputContext } from './UrlParamInputProvider';

//Interfaces for objects we need to hold in state
interface FundInputItemStrings {
  nameString: string;
  currentBalanceString: string;
  targetPercentString: string;
}

export type InputUrlParams = {
  fundInputItemStrings?: FundInputItemStrings[];
};

//Helper setter interface for passing down to TextFields
interface FundInputItemSetter {
  nameSetters: StringFieldSetters;
  currentBalanceSetters: BigFieldSetters;
  targetPercentSetters: BigFieldSetters;
}

//Consumers of this provider can use a read-only state or can use a separate list of setters to set the fields within that state
type InputContextState = {
  fundInputItems: FundInputItem[];
  fundInputItemSetters: FundInputItemSetter[];
  addFundInputItem: () => void;
  removeFundInputItem: (index: number) => void;
}

//Starting list of items in state
const initialItems = [
  {
    name: "SWISX",
    currentBalance: new Big('32116.97'),
    targetPercent: ONE_HUNDREDTH.times(new Big('20'))
  },
  {
    name: "SWMCX",
    currentBalance: new Big('30277.81'),
    targetPercent: ONE_HUNDREDTH.times(new Big('20'))
  },
  {
    name: "SWPPX",
    currentBalance: new Big('47674.68'),
    targetPercent: ONE_HUNDREDTH.times(new Big('30'))
  },
  {
    name: "SWSSX",
    currentBalance: new Big('44728.47'),
    targetPercent: ONE_HUNDREDTH.times(new Big('30'))
  }
]

const initialBigFieldSetter = (big: Big): BigFieldSetters => {
  return {
    stringValue: big.toString(),
    setStringValue: () => { },
    setBigValue: () => { }
  }
}
const initialStringFieldSetter = (string: string): StringFieldSetters => {
  return {
    stringValue: string,
    setStringValue: () => { },
    setRealStringValue: () => { }
  }
}
const initialInputState: InputContextState = {
  fundInputItems: initialItems,
  fundInputItemSetters: initialItems.map(fundInputItem => {
    return {
      nameSetters: initialStringFieldSetter(fundInputItem.name),
      currentBalanceSetters: initialBigFieldSetter(fundInputItem.currentBalance),
      targetPercentSetters: initialBigFieldSetter(fundInputItem.targetPercent)
    }
  }),
  addFundInputItem: () => { },
  removeFundInputItem: (index: number) => { }
};

export const toStrings = (fundInputItem: FundInputItem): FundInputItemStrings => {
  return {
    nameString: fundInputItem.name,
    currentBalanceString: fundInputItem.currentBalance.toString(),
    targetPercentString: ONE_HUNDRED.times(fundInputItem.targetPercent).toString()
  }
}

export const fromStrings = (fundInputItemStrings: FundInputItemStrings): FundInputItem => {
  return {
    name: fundInputItemStrings.nameString,
    currentBalance: new Big(fundInputItemStrings.currentBalanceString),
    targetPercent: ONE_HUNDREDTH.times(new Big(fundInputItemStrings.targetPercentString))
  }
}

export const InputContext = createContext<InputContextState>(initialInputState);

const InputProvider = ({ children }: PropsWithChildren<{}>) => {

  const { urlParamsInput } = useContext(UrlParamInputContext);

  const [fundInputItems, setFundInputItems] = useState<FundInputItem[]>(urlParamsInput.fundInputItemStrings ? urlParamsInput.fundInputItemStrings.map(fromStrings) : initialInputState.fundInputItems);

  const [fundInputItemStrings, setFundInputItemStrings] = useState<FundInputItemStrings[]>(fundInputItems.map(toStrings));

  const fundInputItemSetters: FundInputItemSetter[] = fundInputItemStrings.map((fundInputItemString, index) => {
    return {
      nameSetters: {
        stringValue: fundInputItemString.nameString,
        setStringValue: setItemProperty(index, fundInputItemStrings => fundInputItemStrings.nameString, (fundInputItemStrings, nameString) => { return { ...fundInputItemStrings, nameString } }, setFundInputItemStrings),
        setRealStringValue: setItemProperty(index, fundInputItem => fundInputItem.name, (fundInputItem, name) => { return { ...fundInputItem, name } }, setFundInputItems)
      },
      currentBalanceSetters: {
        stringValue: fundInputItemString.currentBalanceString,
        setStringValue: setItemProperty(index, fundInputItemStrings => fundInputItemStrings.currentBalanceString, (fundInputItemStrings, currentBalanceString) => { return { ...fundInputItemStrings, currentBalanceString } }, setFundInputItemStrings),
        setBigValue: setItemProperty(index, fundInputItem => fundInputItem.currentBalance, (fundInputItem, currentBalance) => { return { ...fundInputItem, currentBalance } }, setFundInputItems)
      },
      targetPercentSetters: {
        stringValue: fundInputItemString.targetPercentString,
        setStringValue: setItemProperty(index, fundInputItemStrings => fundInputItemStrings.targetPercentString, (fundInputItemStrings, targetPercentString) => { return { ...fundInputItemStrings, targetPercentString } }, setFundInputItemStrings),
        setBigValue: setItemProperty(index, fundInputItem => fundInputItem.targetPercent, (fundInputItem, targetPercent) => { return { ...fundInputItem, targetPercent } }, setFundInputItems)
      }
    }
  });

  const defaultItem = {
    name: "",
    currentBalance: ZERO,
    targetPercent: ZERO
  };
  const strings = toStrings(defaultItem);
  const addFundInputItem = () => {
    setFundInputItems([...fundInputItems, defaultItem]);
    setFundInputItemStrings([...fundInputItemStrings, strings]);
  }

  const removeFundInputItem = (index: number) => {
    setFundInputItems([
      ...fundInputItems.slice(0, index),
      ...fundInputItems.slice(index + 1)
    ]);
    setFundInputItemStrings([
      ...fundInputItemStrings.slice(0, index),
      ...fundInputItemStrings.slice(index + 1)
    ]);
  }

  return (
    <InputContext.Provider
      value={{
        fundInputItems,
        fundInputItemSetters,
        addFundInputItem,
        removeFundInputItem
      }}>
      {children}
    </InputContext.Provider>
  );
};

export default InputProvider;