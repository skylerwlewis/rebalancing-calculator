import { Box, Button, Typography } from '@mui/material';
import { useContext, useMemo, useState } from 'react';
import MoneyField from './MoneyField';
import { isValidPercentage, setPercentage } from './PercentField';
import { FundInputItemStrings, InputContext } from './InputProvider'
import calculate, { CalculatorOutput, fromFundInputItem } from './Calculator';
import Big from 'big.js';
import { sum } from './BigUtils';
import { DataGrid, GridPreProcessEditCellProps, GridActionsCellItem, GridRowParams, GridRenderCellParams, GridTreeNodeWithRender } from '@mui/x-data-grid';
import { setIf } from './SetUtils';
import { isBig, setBigFromString } from './InputUtils';
import { ONE_HUNDRED } from './BigConstants';
import DeleteIcon from '@mui/icons-material/Delete';
import ShareModal from './ShareModal';
import ShareIcon from '@mui/icons-material/Share';


const boxSx = {
  '& .MuiTextField-root': { m: 1, width: '25ch' },
};

const InputView = () => {

  const { fundInputItemSetters, fundInputItems, addFundInputItem, removeFundInputItem } = useContext(InputContext);

  const [amountToInvest, setAmountToInvest] = useState<Big>(new Big('5000'));
  const [amountToInvestString, setAmountToInvestString] = useState<string>(amountToInvest.toString());

  const calcInput = useMemo(() => {
    return {
      amountToInvest: amountToInvest,
      fundInputItems: fundInputItems.map(fromFundInputItem)
    }
  }, [amountToInvest, fundInputItems]);
  const calculateResults: CalculatorOutput = useMemo(() => calculate(calcInput), [calcInput]);

  const calculatedValues = calculateResults.outputItems.map(c => c.calculatedValue);
  const calculatedTotal = sum(...calculatedValues);
  const balanceAfters = calculateResults.outputItems.map(c => c.balanceAfter);
  const balanceAftersTotal = sum(...balanceAfters);
  const percentAfters = calculateResults.outputItems.map(c => c.percentAfter);
  const percentAftersTotal = sum(...percentAfters);

  interface TableStrings extends FundInputItemStrings {
    calculatedValueString: string,
    balanceAfterString: string,
    percentAfterString: string
  }

  const initialTableData: TableStrings[] = [
    {
      internalId: -1,
      nameString: "Total",
      currentBalanceString: sum(...fundInputItems.map(i => i.currentBalance)).toString(),
      targetPercentString: ONE_HUNDRED.times(sum(...fundInputItems.map(i => i.targetPercent))).toString(),
      calculatedValueString: calculatedTotal.toString(),
      balanceAfterString: balanceAftersTotal.toString(),
      percentAfterString: ONE_HUNDRED.times(percentAftersTotal).toFixed(3)
    },
  ...fundInputItems.map((fundInputItem, index) => {
    return {
      internalId: fundInputItem.internalId,
      nameString: fundInputItem.name,
      currentBalanceString: fundInputItem.currentBalance.toString(),
      targetPercentString: ONE_HUNDRED.times(fundInputItem.targetPercent).toString(),
      calculatedValueString: calculatedValues[index].toString(),
      balanceAfterString: balanceAfters[index].toString(),
      percentAfterString: ONE_HUNDRED.times(percentAfters[index]).toFixed(3)
    }
  })
];

  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  const renderValue = (params: GridRenderCellParams<TableStrings, any, any, GridTreeNodeWithRender>) => {
    return params.row.internalId === -1 ? (<strong>{params.formattedValue}</strong>) : params.formattedValue;
  };

  const [openModal, setOpenModal] = useState<string | boolean>(false);
  const handleClose = () => setOpenModal(false);

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

        <div style={{ height: 500, width: '100%' }}>
          <DataGrid
            columns={[
              {
                field: 'nameString',
                headerName: 'Fund Name',
                editable: true,
                renderCell: renderValue
              },
              {
                field: 'currentBalanceString',
                headerName: 'Current Balance',
                editable: true,
                valueFormatter: ({ value }) => currencyFormatter.format(value),
                preProcessEditCellProps: (params: GridPreProcessEditCellProps) => {
                  const hasError = !isBig(params.props.value);
                  return { ...params.props, error: hasError };
                },
                renderCell: renderValue
              },
              {
                field: 'targetPercentString',
                headerName: 'Target Percent',
                editable: true,
                valueFormatter: ({ value }) => value + "%",
                preProcessEditCellProps: (params: GridPreProcessEditCellProps) => {
                  const isBigValue = isBig(params.props.value);
                  const validPercent = isBigValue ? isValidPercentage(new Big(params.props.value)) : false
                  return { ...params.props, error: !validPercent };
                },
                renderCell: renderValue
              },
              {
                field: 'calculatedValueString',
                headerName: 'Amount to Invest',
                valueFormatter: ({ value }) => currencyFormatter.format(value),
                renderCell: renderValue
              },
              {
                field: 'balanceAfterString',
                headerName: 'Balance After Investment',
                valueFormatter: ({ value }) => currencyFormatter.format(value),
                renderCell: renderValue
              },
              {
                field: 'percentAfterString',
                headerName: 'Percent After Investment',
                valueFormatter: ({ value }) => value + "%",
                renderCell: renderValue
              },
              {
                field: 'actions',
                headerName: 'Actions',
                type: 'actions',
                width: 80,
                getActions: (params: GridRowParams<TableStrings>) => {
                  if(params.row.internalId === -1) {
                    return []
                  } else {
                    return [
                      <GridActionsCellItem
                        icon={<DeleteIcon />}
                        label="Delete"
                        onClick={() => removeFundInputItem(params.row.internalId)}
                      />,
                    ]
                  }
              },
              },
              
            ]}
            getRowId={(row) => row.internalId}
            rows={initialTableData}
            isCellEditable={(params) => params.row.internalId !== -1}
            processRowUpdate={(newRow: TableStrings, oldRow: TableStrings) => {
              const setters = fundInputItemSetters.filter(item => item.internalId === oldRow.internalId);
              for(const setter of setters) {
                setter.nameSetters.setStringValue(newRow.nameString);
                setter.nameSetters.setRealStringValue(newRow.nameString);
                setBigFromString(newRow.currentBalanceString, setter.currentBalanceSetters.setStringValue, setter.currentBalanceSetters.setBigValue);
                setBigFromString(newRow.targetPercentString, setter.targetPercentSetters.setStringValue, setIf(isValidPercentage, setPercentage(setter.targetPercentSetters.setBigValue)));
              }
              return newRow;
            }}
          />
          <Button onClick={() => { addFundInputItem() }}>Add new item</Button>
          <Button onClick={() => setOpenModal('share')}><ShareIcon /></Button>
        <ShareModal open={openModal === 'share'} handleClose={handleClose} />
        </div>
      </>
    </Box>
  );
};

export default InputView;