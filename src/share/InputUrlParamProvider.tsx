import { useContext } from 'react';
import { PropsWithChildren, useMemo } from 'react';
import { InputContext } from '../input/InputContext';
import { InputUrlParamContext } from './InputUrlParamContext';
import LZString from 'lz-string';
import { FundInputItemParams, InputUrlParams, toFundInputItemParams, toMinifiedInputUrlParams } from './InputUrlParams';
import JSON5 from 'json5'

const InputUrlParamProvider = ({ children }: PropsWithChildren) => {

  const { amountToInvest, fundInputItems } = useContext(InputContext);

  const fundInputItemParams: FundInputItemParams[] = useMemo(() => fundInputItems.map(toFundInputItemParams), [fundInputItems]);

  const urlParams: InputUrlParams = useMemo(() => {
    return {
      amountToInvest: amountToInvest.toString(),
      fundInputItems: fundInputItemParams
    }
  }, [
    amountToInvest,
    fundInputItemParams
  ]);

  const minifiedUrlParams = useMemo(() => toMinifiedInputUrlParams(urlParams), [urlParams]);

  const jsonString = useMemo(() => LZString.compressToEncodedURIComponent(JSON5.stringify(minifiedUrlParams)), [minifiedUrlParams]);

  return (
    <InputUrlParamContext.Provider
      value={{
        input: urlParams,
        inputUrlJsonString: jsonString
      }}>
      {children}
    </InputUrlParamContext.Provider>
  );

};

export default InputUrlParamProvider;