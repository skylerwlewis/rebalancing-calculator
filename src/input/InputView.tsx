import { Box, Button, Container, Typography } from '@mui/material';
import { useContext, useMemo, useState } from 'react';
import MoneyField from './MoneyField';
import { isValidPercentage, setPercentage } from '../utils/PercentUtils';
import { InputContext } from './InputProvider'
import calculate, { CalculatorOutput, fromFundInputItem } from '../calculator/Calculator';
import Big from 'big.js';
import { isBig, setBigFromString, sum } from '../utils/BigUtils';
import { DataGrid, GridPreProcessEditCellProps, GridActionsCellItem, GridRowParams, GridRenderCellParams, GridTreeNodeWithRender, GridComparatorFn } from '@mui/x-data-grid';
import { setIf } from '../utils/SetUtils';
import { ONE_HUNDRED } from '../calculator/BigConstants';
import DeleteIcon from '@mui/icons-material/Delete';
import ShareModal from '../share/modal/ShareModal';
import ShareIcon from '@mui/icons-material/Share';
import { FundInputItemStrings } from './FundInputItem';

const boxSx = {
  '& .MuiTextField-root': { m: 1, width: '25ch' },
};

const InputView = () => {

  const { amountToInvest, amountToInvestSetters, fundInputItemSetters, fundInputItems, addFundInputItem, removeFundInputItem } = useContext(InputContext);

  const calcInput = useMemo(() => {
    return {
      amountToInvest: amountToInvest,
      fundInputItems: fundInputItems.map(fromFundInputItem)
    }
  }, [amountToInvest, fundInputItems]);
  const calculateResults: CalculatorOutput = useMemo(() => calculate(calcInput), [calcInput]);

  const targetPercents = useMemo(() => fundInputItems.map(i => i.targetPercent), [fundInputItems]);
  const totalTargetPercent = useMemo(() => sum(...targetPercents), [targetPercents]);
  const calculatedValues = useMemo(() => calculateResults.outputItems.map(c => c.calculatedValue), [calculateResults]);
  const calculatedTotal = useMemo(() => sum(...calculatedValues), [calculatedValues]);
  const currentPercents = useMemo(() => calculateResults.outputItems.map(c => c.currentPercent), [calculateResults]);
  const currentPercentsTotal = useMemo(() => sum(...currentPercents), [currentPercents]);
  const balanceAfters = useMemo(() => calculateResults.outputItems.map(c => c.balanceAfter), [calculateResults]);
  const balanceAftersTotal = useMemo(() => sum(...balanceAfters), [balanceAfters]);
  const percentAfters = useMemo(() => calculateResults.outputItems.map(c => c.percentAfter), [calculateResults]);
  const percentAftersTotal = useMemo(() => sum(...percentAfters), [percentAfters]);

  interface TableStrings extends FundInputItemStrings {
    calculatedValueString: string,
    currentPercentString: string,
    balanceAfterString: string,
    percentAfterString: string
  }

  const initialTableData: TableStrings[] = useMemo(() => [
    {
      internalId: -1,
      nameString: 'Total',
      currentBalanceString: sum(...fundInputItems.map(i => i.currentBalance)).toString(),
      currentPercentString: ONE_HUNDRED.times(currentPercentsTotal).round(3).toFixed(3),
      targetPercentString: ONE_HUNDRED.times(totalTargetPercent).toString(),
      calculatedValueString: calculatedTotal.toString(),
      balanceAfterString: balanceAftersTotal.toString(),
      percentAfterString: ONE_HUNDRED.times(percentAftersTotal).round(3).toFixed(3)
    },
    ...fundInputItems.map((fundInputItem, index) => {
      return {
        internalId: fundInputItem.internalId,
        nameString: fundInputItem.name,
        currentBalanceString: fundInputItem.currentBalance.toString(),
        currentPercentString: ONE_HUNDRED.times(currentPercents[index]).round(3).toFixed(3),
        targetPercentString: ONE_HUNDRED.times(fundInputItem.targetPercent).toString(),
        calculatedValueString: calculatedValues[index].toString(),
        balanceAfterString: balanceAfters[index].toString(),
        percentAfterString: ONE_HUNDRED.times(percentAfters[index]).round(3).toFixed(3)
      }
    })
  ], [
    fundInputItems,
    currentPercentsTotal,
    totalTargetPercent,
    calculatedTotal,
    balanceAftersTotal,
    percentAftersTotal,
    currentPercents,
    calculatedValues,
    balanceAfters,
    percentAfters
  ]);

  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  const renderValue = (params: GridRenderCellParams<TableStrings, any, any, GridTreeNodeWithRender>) => {
    return params.row.internalId === -1 ? (<strong>{params.formattedValue}</strong>) : params.formattedValue;
  };

  const [openModal, setOpenModal] = useState<string | boolean>(false);
  const handleClose = () => setOpenModal(false);

  const numericComparator: GridComparatorFn<string> = (v1, v2) => Number(v1) - Number(v2);

  return (
    <Container sx={{
      ...boxSx,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <>
        <Typography>
          Fill in your fund information to rebalance your portfolio
        </Typography>
        <MoneyField
          id='investment-amount-input'
          label='Investment Amount'
          {...amountToInvestSetters} />
        <Container sx={{ flexGrow: '1' }}>
          <DataGrid
            disableColumnMenu={true}
            autoPageSize={true}
            getRowId={row => row.internalId}
            isCellEditable={params => params.row.internalId !== -1}
            rows={initialTableData}
            processRowUpdate={(newRow: TableStrings, oldRow: TableStrings) => {
              const setters = fundInputItemSetters.filter(item => item.internalId === oldRow.internalId);
              for (const setter of setters) {
                setter.nameSetters.setStringValue(newRow.nameString);
                setBigFromString(newRow.currentBalanceString, setter.currentBalanceSetters.setStringValue, setter.currentBalanceSetters.setBigValue);
                setBigFromString(newRow.targetPercentString, setter.targetPercentSetters.setStringValue, setIf(isValidPercentage, setPercentage(setter.targetPercentSetters.setBigValue)));
              }
              return newRow;
            }}
            columns={[
              {
                field: 'nameString',
                headerName: 'Fund Name',
                editable: true,
                renderCell: renderValue,
                flex: 1
              },
              {
                field: 'targetPercentString',
                headerName: 'Target Percent',
                editable: true,
                valueFormatter: ({ value }) => value + '%',
                preProcessEditCellProps: (params: GridPreProcessEditCellProps) => {
                  const isBigValue = isBig(params.props.value);
                  const validPercent = isBigValue ? isValidPercentage(new Big(params.props.value)) : false
                  return { ...params.props, error: !validPercent };
                },
                renderCell: renderValue,
                flex: 1,
                sortComparator: numericComparator
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
                renderCell: renderValue,
                flex: 1,
                sortComparator: numericComparator
              },
              {
                field: 'currentPercentString',
                headerName: 'Current Percent',
                valueFormatter: ({ value }) => value + '%',
                renderCell: renderValue,
                flex: 1,
                sortComparator: numericComparator
              },
              {
                field: 'calculatedValueString',
                headerName: 'Amount to Invest',
                valueFormatter: ({ value }) => currencyFormatter.format(value),
                renderCell: renderValue,
                flex: 1,
                sortComparator: numericComparator
              },
              {
                field: 'balanceAfterString',
                headerName: 'Balance After Investment',
                valueFormatter: ({ value }) => currencyFormatter.format(value),
                renderCell: renderValue,
                flex: 1,
                sortComparator: numericComparator
              },
              {
                field: 'percentAfterString',
                headerName: 'Percent After Investment',
                valueFormatter: ({ value }) => value + '%',
                renderCell: renderValue,
                flex: 1,
                sortComparator: numericComparator
              },
              {
                field: 'actions',
                headerName: 'Actions',
                type: 'actions',
                width: 80,
                getActions: (params: GridRowParams<TableStrings>) => params.row.internalId === -1 ? [] :
                  [
                    <GridActionsCellItem
                      icon={<DeleteIcon />}
                      label='Delete'
                      onClick={() => removeFundInputItem(params.row.internalId)}
                    />
                  ]
              }
            ]}
          />
        </Container>
        <Container>
          <Button onClick={() => { addFundInputItem() }}>Add new item</Button>
          <Button onClick={() => setOpenModal('share')}><ShareIcon /></Button>
        </Container>
        <ShareModal open={openModal === 'share'} handleClose={handleClose} />

      </>
    </Container>
  );
};

export default InputView;