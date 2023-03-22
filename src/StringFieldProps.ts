import { BaseTextFieldProps } from '@mui/material';
import { Dispatch, SetStateAction } from 'react';

export interface StringFieldSetters {
  stringValue: string;
  setStringValue: Dispatch<SetStateAction<string>>;
  setRealStringValue: Dispatch<SetStateAction<string>>;
}

export const BigFieldSettersKeys = [
  'stringValue',
  'setStringValue',
  'setRealStringValue'
]

export default interface StringFieldProps extends BaseTextFieldProps, StringFieldSetters {
  [index: string]: any;
}