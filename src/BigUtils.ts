
import { Big } from 'big.js';
import { ZERO } from './BigConstants';

export const sum = (...values: Big[]) => values.reduce((prev, curr) => prev.plus(curr), ZERO);
export const min = (...values: Big[]) => values.reduce((prev, curr) => prev.lt(curr) ? prev : curr);
export const max = (...values: Big[]) => values.reduce((prev, curr) => prev.gt(curr) ? prev : curr);
export const distinctBig = (value: Big, index: number, array: Big[]) => array.slice(0, index).filter(arrayItem => arrayItem.eq(value)).length === 0;
export const compareBig = (big1: Big, big2: Big) => big1.lt(big2) ? -1 : big1.gt(big2) ? 1 : 0;