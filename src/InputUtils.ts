import { Big } from 'big.js';
import { Dispatch, SetStateAction } from 'react';

export const isNumber = (value: string) => {
  return !!value && !isNaN(Number(value));
};

export const setNumberFromInput = (setStringValue: Dispatch<SetStateAction<string>>, setNumberValue: Dispatch<SetStateAction<number>>) => {
  return (event: React.ChangeEvent<HTMLInputElement>) => {
    setStringValue(event.target.value);
    if (isNumber(event.target.value)) {
      setNumberValue(Number(event.target.value));
    }
  }
};

export const isBig = (value: string) => {
  try {
    new Big(value);
    return true;
  } catch (error) {
    return false;
  }
};

export const setBigFromInput = (setStringValue: Dispatch<SetStateAction<string>>, setBigValue: Dispatch<SetStateAction<Big>>) => {
  return (event: React.ChangeEvent<HTMLInputElement>) => {
    setStringValue(event.target.value);
    if (isBig(event.target.value)) {
      setBigValue(new Big(event.target.value));
    }
  }
};

export const setOptionalBigFromInput = (setStringValue: Dispatch<SetStateAction<string>>, setOptionalBigValue: Dispatch<SetStateAction<Big | undefined>>) => {
  return (event: React.ChangeEvent<HTMLInputElement>) => {
    setStringValue(event.target.value);
    if(!event.target.value) {
      setOptionalBigValue(undefined);
    } else if (isBig(event.target.value)) {
      setOptionalBigValue(new Big(event.target.value));
    }
  }
};