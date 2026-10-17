
import { Big } from 'big.js';
import { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { ZERO } from '../calculator/BigConstants';

export const sum = (...values: Big[]) => values.reduce((prev, curr) => prev.plus(curr), ZERO);
export const min = (...values: Big[]) => values.reduce((prev, curr) => prev.lt(curr) ? prev : curr);
export const max = (...values: Big[]) => values.reduce((prev, curr) => prev.gt(curr) ? prev : curr);
export const distinctBig = (value: Big, index: number, array: Big[]) => array.slice(0, index).filter(arrayItem => arrayItem.eq(value)).length === 0;
export const compareBig = (big1: Big, big2: Big) => big1.lt(big2) ? -1 : big1.gt(big2) ? 1 : 0;

// Commas are treated as thousands separators and stripped before parsing.
export const toBig = (value: string): Big | undefined => {
  try {
    return new Big(value.replaceAll(',', ''));
  } catch {
    return undefined;
  }
};

export const isBig = (value: string) => toBig(value) !== undefined;

export const setBigFromString = (stringValue: string, setStringValue: Dispatch<SetStateAction<string>>, setBigValue: Dispatch<SetStateAction<Big>>) => {
  setStringValue(stringValue);
  const bigValue = toBig(stringValue);
  if (bigValue !== undefined) {
    setBigValue(bigValue);
  }
};

export const setBigFromInput = (setStringValue: Dispatch<SetStateAction<string>>, setBigValue: Dispatch<SetStateAction<Big>>) => {
  return (event: ChangeEvent<HTMLInputElement>) => {
    setBigFromString(event.target.value, setStringValue, setBigValue);
  }
};