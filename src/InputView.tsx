import { Box, Button, TextField, Typography } from '@mui/material';
import { useContext, useMemo, useState } from 'react';
import MoneyField from './MoneyField';
import PercentField from './PercentField';
import { InputContext } from './InputProvider'
import calculate from './Calculator';
import Big from 'big.js';
import { sum } from './BigUtils';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { UrlParamInputContext } from './UrlParamInputProvider';
import { InputUrlParamContext } from './InputUrlParamProvider';

const boxSx = {
  '& .MuiTextField-root': { m: 1, width: '25ch' },
};

const InputView = () => {

  const { baseUrl, queryStrings } = useContext(UrlParamInputContext);
  const { inputUrlJsonString } = useContext(InputUrlParamContext);

  const linkUrl = useMemo(() => encodeURI(baseUrl + '?' + queryStrings + 'input=' + inputUrlJsonString), [baseUrl, queryStrings, inputUrlJsonString]);

  const copyTextToClipboard = (text: string) => navigator.clipboard.writeText(text);

  const { fundInputItemSetters, fundInputItems, addFundInputItem, removeFundInputItem } = useContext(InputContext);

  const [ amountToInvest, setAmountToInvest ] = useState<Big>(new Big('5000'));
  const [ amountToInvestString, setAmountToInvestString ] = useState<string>(amountToInvest.toString());

  const calculateResults = calculate(amountToInvest, fundInputItems);

  const calculatedTotal = sum(...calculateResults);

  return (
    <Box
      component='form'
      sx={boxSx}
      noValidate
      autoComplete='off'
    >
      <>
        <Typography>
          Fill in your fund information to rebalance your portfolio
        </Typography>
        <MoneyField
          id='investment-amount-input'
          label='Investment Amount'
          stringValue={amountToInvestString}
          setStringValue={setAmountToInvestString}
          setBigValue={setAmountToInvest}/>

        <MoneyField
          disabled={true}
          id='investment-amount-input2'
          label='Investment Amount Totes'
          stringValue={calculatedTotal.toString()}
          setStringValue={() => {}}
          setBigValue={() => {}}/>

        {fundInputItemSetters.map((fundInputItemSetter, index) =>

          <p>
            <TextField
              id='fund-name-input'
              label='Fund Name'
              value={fundInputItemSetter.nameSetters.stringValue}
              onChange={
                (event: React.ChangeEvent<HTMLInputElement>) => {
                  fundInputItemSetter.nameSetters.setStringValue(event.target.value);
                  fundInputItemSetter.nameSetters.setRealStringValue(event.target.value);
                }
              } />
            <MoneyField
              id='current-balance-input'
              label='Current Balance'
              {...fundInputItemSetter.currentBalanceSetters} />
            <PercentField
              id='current-percent-input'
              label='Target Percent'
              {...fundInputItemSetter.targetPercentSetters} />
            <text>{calculateResults[index].toFixed(2)}</text>
            <Button onClick={() => { removeFundInputItem(index) }}>Remove</Button>

          </p>
        )}

        <Button onClick={() => { addFundInputItem() }}>Add new item</Button>
        <Typography id='ss-modal-modal-title' variant='h4' component='h2' gutterBottom>
          Share or Bookmark Your Results
        </Typography>
        <Typography id='ss-modal-modal-title' variant='h6' component='h2'>
          URL to share
        </Typography>
        <TextField
          style={{ width: '100%' }}
          disabled={true}
          value={linkUrl}
          InputProps={{
            endAdornment: <Button onClick={() => copyTextToClipboard(linkUrl)}><ContentCopyIcon /></Button>
          }}
        />
      </>
    </Box>
  );
};

export default InputView;