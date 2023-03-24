import { Box, Button, TextField, Typography } from '@mui/material';
import { useContext, useMemo, useState } from 'react';
import MoneyField from './MoneyField';
import PercentField, { isValidPercentage, setPercentage } from './PercentField';
import { FundInputItemSetter, InputContext } from './InputProvider'
import calculate from './Calculator';
import Big from 'big.js';
import { sum } from './BigUtils';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { UrlParamInputContext } from './UrlParamInputProvider';
import { InputUrlParamContext } from './InputUrlParamProvider';

import { DataGrid, GridCellParams, GridPreProcessEditCellProps, MuiBaseEvent, MuiEvent } from '@mui/x-data-grid';
import { setIf } from './SetUtils';
import { isBig, setBigFromInput, setBigFromString } from './InputUtils';


const boxSx = {
  '& .MuiTextField-root': { m: 1, width: '25ch' },
};

const InputView = () => {

  const { baseUrl, queryStrings } = useContext(UrlParamInputContext);
  const { inputUrlJsonString } = useContext(InputUrlParamContext);

  const linkUrl = useMemo(() => encodeURI(baseUrl + '?' + queryStrings + 'input=' + inputUrlJsonString), [baseUrl, queryStrings, inputUrlJsonString]);

  const copyTextToClipboard = (text: string) => navigator.clipboard.writeText(text);

  const { fundInputItemSetters, fundInputItems, addFundInputItem, removeFundInputItem } = useContext(InputContext);

  const [amountToInvest, setAmountToInvest] = useState<Big>(new Big('5000'));
  const [amountToInvestString, setAmountToInvestString] = useState<string>(amountToInvest.toString());

  const calculateResults = calculate(amountToInvest, fundInputItems);

  const calculatedTotal = sum(...calculateResults);

  type TableStrings = {
    internalId: number,
    name: string,
    currentBalance: string,
    targetPercent: string
  }
  const stringTableData: TableStrings[] = fundInputItemSetters.map(setter => {
    return {
      internalId: setter.internalId,
      name: setter.nameSetters.stringValue,
      currentBalance: setter.currentBalanceSetters.stringValue,
      targetPercent: setter.targetPercentSetters.stringValue
    }
  })

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
          setBigValue={setAmountToInvest} />

        <MoneyField
          disabled={true}
          id='investment-amount-input2'
          label='Investment Amount Totes'
          stringValue={calculatedTotal.toString()}
          setStringValue={() => { }}
          setBigValue={() => { }} />

        <div style={{ height: 500, width: '100%' }}>
          <DataGrid
            columns={[
              {
                field: 'name',
                headerName: 'Fund Name',
                editable: true,
                preProcessEditCellProps: (params: GridPreProcessEditCellProps) => {
                  const hasError = params.props.value.length < 3;
                  return { ...params.props, error: hasError };
                }
              },
              {
                field: 'currentBalance',
                headerName: 'Current Balance',
                editable: true,
                preProcessEditCellProps: (params: GridPreProcessEditCellProps) => {
                  const hasError = !isBig(params.props.value);
                  return { ...params.props, error: hasError };
                }
              },
              {
                field: 'targetPercent',
                headerName: 'Target Percent',
                editable: true,
                preProcessEditCellProps: (params: GridPreProcessEditCellProps) => {
                  const isBigValue = isBig(params.props.value);
                  const validPercent = isBigValue ? isValidPercentage(new Big(params.props.value)) : false
                  return { ...params.props, error: !validPercent };
                }
              }
            ]}
            getRowId={(row) => row.internalId}
            rows={stringTableData}
            onCellEditStop={(params: GridCellParams, event: MuiEvent<MuiBaseEvent>) => {
              const setter: FundInputItemSetter[] = fundInputItemSetters.filter( (s) => {
                return s.internalId === params.row.internalId;
              });
              if(setter.length === 1) {
                if (params.field === 'name') {

                } else if (params.field === 'currentBalance') {
                  setBigFromInput(setter[0].currentBalanceSetters.setStringValue, setter[0].currentBalanceSetters.setBigValue)
                } else if (params.field === 'targetPercent') {
                  setBigFromInput(setter[0].targetPercentSetters.setStringValue, setIf(isValidPercentage, setPercentage(setter[0].targetPercentSetters.setBigValue)))
                }
              }
            }}
            processRowUpdate={(newRow: TableStrings, oldRow: TableStrings) => {

              const setter: FundInputItemSetter[] = fundInputItemSetters.filter( (s) => {
                return s.internalId === oldRow.internalId;
              });

              if(setter.length === 1) {
                setter[0].nameSetters.setStringValue(newRow.name);
                setter[0].nameSetters.setRealStringValue(newRow.name);
                setBigFromString(newRow.currentBalance, setter[0].currentBalanceSetters.setStringValue, setter[0].currentBalanceSetters.setBigValue);
                setBigFromString(newRow.targetPercent, setter[0].targetPercentSetters.setStringValue, setIf(isValidPercentage, setPercentage(setter[0].targetPercentSetters.setBigValue)));
                return newRow;
              }
              return oldRow;
            }}
          />
        </div>

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