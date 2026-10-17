import { Big } from 'big.js';
import { PropsWithChildren, useContext, useMemo, useState } from 'react';
import { ZERO } from '../calculator/BigConstants';
import { BigFieldSetters } from './BigFieldProps';
import FundInputItem, { FundInputItemStrings, toStrings } from './FundInputItem';
import { fromFundInputItemParams } from '../share/InputUrlParams';
import { setItemProperty } from '../utils/SetUtils';
import { UrlParamInputContext } from '../share/UrlParamInputContext';
import { FundInputItemSetter, initialAmountToInvest, initialInputState, InputContext } from './InputContext';

const InputProvider = ({ children }: PropsWithChildren) => {

  const { urlParamsInput } = useContext(UrlParamInputContext);

  const [fundInputItems, setFundInputItems] = useState<FundInputItem[]>(urlParamsInput.fundInputItems && urlParamsInput.fundInputItems.length > 0 ? urlParamsInput.fundInputItems.map((urlParamsInput, index) => fromFundInputItemParams(urlParamsInput, index)) : initialInputState.fundInputItems);
  const [fundInputItemStrings, setFundInputItemStrings] = useState<FundInputItemStrings[]>(fundInputItems.map(toStrings));
  const fundInputItemSetters: FundInputItemSetter[] = fundInputItemStrings.map((fundInputItemString, index) => {
    return {
      internalId: fundInputItemString.internalId,
      nameSetters: {
        stringValue: fundInputItemString.nameString,
        setStringValue: setItemProperty(index, fundInputItems => fundInputItems.name, (fundInputItems, name) => { return { ...fundInputItems, name } }, setFundInputItems)
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

  const [amountToInvest, setAmountToInvest] = useState<Big>(urlParamsInput.amountToInvest ? new Big(urlParamsInput.amountToInvest) : initialAmountToInvest);
  const [amountToInvestString, setAmountToInvestString] = useState<string>(amountToInvest.toString());
  const amountToInvestSetters: BigFieldSetters = {
    stringValue: amountToInvestString,
    setStringValue: setAmountToInvestString,
    setBigValue: setAmountToInvest
  }

  const [maxInternalId, setMaxInternalId] = useState<number>(Math.max(...fundInputItems.map(item => item.internalId)));
  const nextItem = useMemo(() => {
    return {
      internalId: maxInternalId + 1,
      name: 'New Fund',
      currentBalance: ZERO,
      targetPercent: ZERO
    }
  }, [maxInternalId]);
  const nextItemStrings = useMemo(() => toStrings(nextItem), [nextItem]);
  const addFundInputItem = () => {
    setFundInputItems([...fundInputItems, nextItem]);
    setFundInputItemStrings([...fundInputItemStrings, nextItemStrings]);
    setMaxInternalId(nextItem.internalId);
  }
  const removeFundInputItem = (internalId: number) => {
    setFundInputItems(fundInputItems.filter(fundInputItem => fundInputItem.internalId !== internalId));
    setFundInputItemStrings(fundInputItemStrings.filter(fundInputItemString => fundInputItemString.internalId !== internalId));
  }

  return (
    <InputContext.Provider
      value={{
        amountToInvest,
        amountToInvestSetters,
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