import { BaseTextFieldProps, InputAdornment, TextField } from '@mui/material';
import BigFieldProps, { BigFieldSettersKeys } from './BigFieldProps';
import { isBig, setBigFromInput } from '../utils/BigUtils';

const MoneyField = (props: BigFieldProps) => {

  const baseTextFieldProps = Object.keys(props)
    .filter(key => !BigFieldSettersKeys.includes(key))
    .reduce<Record<string, unknown>>((obj, key) => {
      obj[key] = props[key as keyof BigFieldProps];
      return obj;
    }, {}) as BaseTextFieldProps;

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