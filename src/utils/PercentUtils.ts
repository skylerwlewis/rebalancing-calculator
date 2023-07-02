import Big from 'big.js';
import { Dispatch, SetStateAction } from 'react';
import { ONE_HUNDRED, ONE_HUNDREDTH, ZERO } from '../calculator/BigConstants';
import { setTransform } from './SetUtils';

const MAX_PERCENTAGE = 100;

export const isValidPercentage = (percentage: Big): boolean => {
  return ZERO.lte(percentage) && percentage.lte(MAX_PERCENTAGE);
}

export const setPercentage = (setBigValue: Dispatch<SetStateAction<Big>>) =>
  setTransform(
    setBigValue,
    value => ONE_HUNDREDTH.times(value),
    value => ONE_HUNDRED.times(value)
  );