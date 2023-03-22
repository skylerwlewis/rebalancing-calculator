import { BaseTextFieldProps, InputAdornment, TextField } from '@mui/material';
import { Big } from 'big.js';
import { Dispatch, SetStateAction } from 'react';
import { ONE_HUNDRED, ONE_HUNDREDTH, ZERO } from './BigConstants';
import { isBig, setBigFromInput } from './InputUtils';
import { setIf, setTransform } from './SetUtils';
import BigFieldProps, { BigFieldSettersKeys } from './BigFieldProps';

const MAX_PERCENTAGE = 100;

const isValidPercentage = (percentage: Big): boolean => {
  return ZERO.lte(percentage) && percentage.lte(MAX_PERCENTAGE);
}

const setPercentage = (setBigValue: Dispatch<SetStateAction<Big>>) =>
  setTransform(
    setBigValue,
    value => ONE_HUNDREDTH.times(value),
    value => ONE_HUNDRED.times(value)
  );

const PercentField = (props: BigFieldProps) => {

  const baseTextFieldProps = Object.keys(props)
    .filter(key => !BigFieldSettersKeys.includes(key))
    .reduce((obj, key) => {
      obj[key] = props[key];
      return obj;
    }, {} as BigFieldProps) as BaseTextFieldProps;

  const isBigValue = isBig(props.stringValue);
  const isValidPercentageValue = isBigValue ? isValidPercentage(new Big(props.stringValue)) : false;

  return (

    <TextField
      {...baseTextFieldProps}
      value={props.stringValue}
      error={!(isBigValue && isValidPercentageValue)}
      InputProps={{
        endAdornment: <InputAdornment position='end'>%</InputAdornment>
      }}
      onChange={setBigFromInput(props.setStringValue, setIf(isValidPercentage, setPercentage(props.setBigValue)))}
      helperText={
        !isBigValue ? 'Value should be numeric' :
          !isValidPercentageValue ? 'Value should be a number 0% to 100%' :
            ''
      } />
  );
};

export default PercentField;