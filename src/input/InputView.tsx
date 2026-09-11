import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import GitHubIcon from '@mui/icons-material/GitHub';
import ShareIcon from '@mui/icons-material/Share';
import { Box, Button, ButtonGroup, Container, Link, Stack, Typography } from '@mui/material';
import { grey } from '@mui/material/colors';
import { DataGrid, GridActionsCellItem, GridComparatorFn, GridPreProcessEditCellProps, GridRenderCellParams, GridRowParams, GridTreeNodeWithRender } from '@mui/x-data-grid';
import Big from 'big.js';
import { useContext, useMemo, useState } from 'react';
import { ONE_HUNDRED } from '../calculator/BigConstants';
import calculate, { CalculatorOutput, fromFundInputItem } from '../calculator/Calculator';
import ShareModal from '../share/modal/ShareModal';
import { isBig, setBigFromString, sum } from '../utils/BigUtils';
import { isValidPercentage, setPercentage } from '../utils/PercentUtils';
import { setIf } from '../utils/SetUtils';
import { FundInputItemStrings } from './FundInputItem';
import { InputContext } from './InputProvider';
import MoneyField from './MoneyField';

const githubLink = 'https://github.com/skylerwlewis/rebalancing-calculator'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

interface FundOutputItemStrings extends FundInputItemStrings {
  amountToInvestString: string,
  currentPercentString: string,
  balanceAfterString: string,
  percentAfterString: string
}

const renderValue = (params: GridRenderCellParams<FundOutputItemStrings, any, any, GridTreeNodeWithRender>) => {
  return params.row.internalId === -1 ? (<strong>{params.formattedValue}</strong>) : params.formattedValue;
};

const numericComparator: GridComparatorFn<string> = (v1, v2) => Number(v1) - Number(v2);

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

  const currentBalances = useMemo(() => fundInputItems.map(i => i.currentBalance), [fundInputItems]);
  const currentBalanceTotal = useMemo(() => sum(...currentBalances), [currentBalances]);

  const currentPercents = useMemo(() => calculateResults.outputItems.map(c => c.currentPercent), [calculateResults]);
  const currentPercentsTotal = useMemo(() => sum(...currentPercents), [currentPercents]);

  const amountsToInvest = useMemo(() => calculateResults.outputItems.map(c => c.amountToInvest), [calculateResults]);
  const amountToInvestTotal = useMemo(() => sum(...amountsToInvest), [amountsToInvest]);

  const balanceAfters = useMemo(() => calculateResults.outputItems.map(c => c.balanceAfter), [calculateResults]);
  const balanceAftersTotal = useMemo(() => sum(...balanceAfters), [balanceAfters]);

  const percentAfters = useMemo(() => calculateResults.outputItems.map(c => c.percentAfter), [calculateResults]);
  const percentAftersTotal = useMemo(() => sum(...percentAfters), [percentAfters]);

  const initialTableData: FundOutputItemStrings[] = useMemo(() => [
    {
      internalId: -1,
      nameString: 'Total',
      currentBalanceString: currentBalanceTotal.toString(),
      currentPercentString: ONE_HUNDRED.times(currentPercentsTotal).round(3).toFixed(3),
      targetPercentString: ONE_HUNDRED.times(totalTargetPercent).toString(),
      amountToInvestString: amountToInvestTotal.toString(),
      balanceAfterString: balanceAftersTotal.toString(),
      percentAfterString: ONE_HUNDRED.times(percentAftersTotal).round(3).toFixed(3)
    },
    ...fundInputItems.map((fundInputItem, index) => {
      return {
        internalId: fundInputItem.internalId,
        nameString: fundInputItem.name,
        currentBalanceString: currentBalances[index].toString(),
        currentPercentString: ONE_HUNDRED.times(currentPercents[index]).round(3).toFixed(3),
        targetPercentString: ONE_HUNDRED.times(fundInputItem.targetPercent).toString(),
        amountToInvestString: amountsToInvest[index].toString(),
        balanceAfterString: balanceAfters[index].toString(),
        percentAfterString: ONE_HUNDRED.times(percentAfters[index]).round(3).toFixed(3)
      }
    })
  ],
    [
      fundInputItems,
      currentBalanceTotal,
      currentPercentsTotal,
      totalTargetPercent,
      amountToInvestTotal,
      balanceAftersTotal,
      percentAftersTotal,
      currentBalances,
      currentPercents,
      amountsToInvest,
      balanceAfters,
      percentAfters
    ]
  );

  const [openModal, setOpenModal] = useState<string | boolean>(false);
  const handleClose = () => setOpenModal(false);

  return (
    <Stack alignItems='flex-start' sx={{
      height: '100%',
      width: '100%'
    }}>
      <Container>
        <Typography>
          Fill in your fund information to rebalance your portfolio
        </Typography>
        <MoneyField
          id='investment-amount-input'
          label='Investment Amount'
          sx={{
            m: 1,
            width: '25ch'
          }}
          {...amountToInvestSetters} />
      </Container>
      <Container sx={{
        display: 'flex',
        alignItems: 'center',
        width: 'fit-content',
        marginBottom: 1
      }}>
        <ButtonGroup variant="contained" sx={{
          // The Github Button with href below does not get handled correctly by ButtonGroup, the style below fixes that

          // Applying '.MuiButtonGroup-grouped:not(:first-of-type)' styles
          '.MuiButtonGroup-grouped:not(:first-child)': {
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0
          },
          // Applying '.MuiButtonGroup-grouped:not(:last-of-type)' styles
          '.MuiButtonGroup-grouped:not(:last-child)': {
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
            borderRight: '1px solid',
            borderRightColor: grey[400],
            borderColor: 'rgb(46, 115, 171)'
          },
        }}>
          <Button startIcon={<AddCircleIcon />} onClick={() => { addFundInputItem() }}>Add fund</Button>
          <Button startIcon={<ShareIcon />} onClick={() => setOpenModal('share')}>Share</Button>
          <Button startIcon={<GitHubIcon />} href={githubLink}>View on Github</Button>
        </ButtonGroup>
        <ShareModal open={openModal === 'share'} handleClose={handleClose} />
      </Container>
      <Box sx={{ flexGrow: '1', width: '100%' }}>
        <DataGrid
          disableColumnMenu={true}
          autoPageSize={true}
          getRowId={row => row.internalId}
          isCellEditable={params => params.row.internalId !== -1}
          rows={initialTableData}
          processRowUpdate={(newRow: FundOutputItemStrings, oldRow: FundOutputItemStrings) => {
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
              sortComparator: numericComparator,
              align: 'right',
              headerAlign: 'right'
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
              sortComparator: numericComparator,
              align: 'right',
              headerAlign: 'right'
            },
            {
              field: 'currentPercentString',
              headerName: 'Current Percent',
              valueFormatter: ({ value }) => value + '%',
              renderCell: renderValue,
              flex: 1,
              sortComparator: numericComparator,
              align: 'right',
              headerAlign: 'right'
            },
            {
              field: 'amountToInvestString',
              headerName: 'Amount to Invest',
              valueFormatter: ({ value }) => currencyFormatter.format(value),
              renderCell: renderValue,
              flex: 1,
              sortComparator: numericComparator,
              align: 'right',
              headerAlign: 'right'
            },
            {
              field: 'balanceAfterString',
              headerName: 'Balance After Investment',
              valueFormatter: ({ value }) => currencyFormatter.format(value),
              renderCell: renderValue,
              flex: 1,
              sortComparator: numericComparator,
              align: 'right',
              headerAlign: 'right'
            },
            {
              field: 'percentAfterString',
              headerName: 'Percent After Investment',
              valueFormatter: ({ value }) => value + '%',
              renderCell: renderValue,
              flex: 1,
              sortComparator: numericComparator,
              align: 'right',
              headerAlign: 'right'
            },
            {
              field: 'actions',
              headerName: 'Actions',
              type: 'actions',
              width: 80,
              getActions: (params: GridRowParams<FundOutputItemStrings>) => params.row.internalId === -1 ? [] :
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
      </Box>
      <Typography
        fontSize='0.8125rem'
        lineHeight={1.5}
        zIndex={999}
        marginLeft='0.25rem'
        marginTop='calc(-0.8125rem * 1.5)'
      >A <Link
        href="https://www.skylerlewis.io"
        target='_blank'
      >
        skylerlewis.io
      </Link> project
      </Typography>
    </Stack>
  );
};

export default InputView;