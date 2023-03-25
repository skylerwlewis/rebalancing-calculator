import { BaseTextFieldProps, InputAdornment, TextField } from '@mui/material';
import BigFieldProps, { BigFieldSettersKeys } from './BigFieldProps';
import { Dispatch, SetStateAction } from 'react';
import Big from 'big.js';
import { isBig, setBigFromString } from './BigUtils';

export const setBigFromInput = (setStringValue: Dispatch<SetStateAction<string>>, setBigValue: Dispatch<SetStateAction<Big>>) => {
  return (event: React.ChangeEvent<HTMLInputElement>) => {
    setBigFromString(event.target.value, setStringValue, setBigValue);
  }
};

const MoneyField = (props: BigFieldProps) => {

  const baseTextFieldProps = Object.keys(props)
    .filter(key => !BigFieldSettersKeys.includes(key))
    .reduce((obj, key) => {
      obj[key] = props[key];
      return obj;
    }, {} as BigFieldProps) as BaseTextFieldProps;

  const isBigValue = isBig(props.stringValue);

  return (
    <TextField
      {...baseTextFieldProps}
      value={props.stringValue}
      error={!isBigValue}
      InputProps={{
        startAdornment: <InputAdornment position='start'>$</InputAdornment>
      }}
      onChange={setBigFromInput(props.setStringValue, props.setBigValue)}
      helperText={!isBigValue ? 'Value should be numeric' : ''} />
  );
};

export default MoneyField;