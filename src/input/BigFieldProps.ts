import { BaseTextFieldProps } from '@mui/material';
import { Big } from 'big.js';
import { Dispatch, SetStateAction } from 'react';

export interface BigFieldSetters {
  stringValue: string;
  setStringValue: Dispatch<SetStateAction<string>>;
  setBigValue: Dispatch<SetStateAction<Big>>;
}

export const BigFieldSettersKeys = [
  'stringValue',
  'setStringValue',
  'setBigValue'
]

export default interface BigFieldProps extends BaseTextFieldProps, BigFieldSetters {
  [index: string]: any;
}