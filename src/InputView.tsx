import { Box, Button, Typography } from '@mui/material';
import { useContext, useMemo, useState } from 'react';
import MoneyField from './MoneyField';
import { isValidPercentage, setPercentage } from './PercentField';
import { InputContext } from './InputProvider'
import calculate, { fromFundInputItem } from './Calculator';
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
  const calculateResults = useMemo(() => calculate(calcInput), [calcInput]);

  const calculatedTotal = sum(...calculateResults);

  type TableStrings = {
    internalId: number,
    name: string,
    currentBalance: string,
    targetPercent: string,
    calculatedValue: string
  }

  const initialTableData: TableStrings[] = [
    {
      internalId: -1,
      name: "Total",
      currentBalance: sum(...fundInputItems.map(i => i.currentBalance)).toString(),
      targetPercent: ONE_HUNDRED.times(sum(...fundInputItems.map(i => i.targetPercent))).toString(),
      calculatedValue: calculatedTotal.toString()
    },
  ...fundInputItems.map((fundInputItem, index) => {
    return {
      internalId: fundInputItem.internalId,
      name: fundInputItem.name,
      currentBalance: fundInputItem.currentBalance.toString(),
      targetPercent: ONE_HUNDRED.times(fundInputItem.targetPercent).toString(),
      calculatedValue: calculateResults[index].toString()
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
                field: 'name',
                headerName: 'Fund Name',
                editable: true,
                renderCell: renderValue
              },
              {
                field: 'currentBalance',
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
                field: 'targetPercent',
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
                field: 'calculatedValue',
                headerName: 'Amount to Invest',
                valueFormatter: ({ value }) => currencyFormatter.format(value),
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
                setter.nameSetters.setStringValue(newRow.name);
                setter.nameSetters.setRealStringValue(newRow.name);
                setBigFromString(newRow.currentBalance, setter.currentBalanceSetters.setStringValue, setter.currentBalanceSetters.setBigValue);
                setBigFromString(newRow.targetPercent, setter.targetPercentSetters.setStringValue, setIf(isValidPercentage, setPercentage(setter.targetPercentSetters.setBigValue)));
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