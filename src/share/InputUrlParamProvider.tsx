import { useContext } from 'react';
import { createContext, PropsWithChildren, useMemo } from 'react';
import { InputContext } from '../input/InputProvider';
import LZString from 'lz-string';
import { FundInputItemParams, InputUrlParams, MinifiedInputUrlParams, toFundInputItemParams, toMinifiedInputUrlParams } from './InputUrlParams';
import JSON5 from 'json5'

type InputUrlParamContextState = {
  input: InputUrlParams;
  inputUrlJsonString: string;
}

const initialInputState: InputUrlParamContextState = {
  input: {},
  inputUrlJsonString: ''
};

export const InputUrlParamContext = createContext<InputUrlParamContextState>(initialInputState);

const InputUrlParamProvider = ({ children }: PropsWithChildren<{}>) => {

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

  const jsonString = useMemo(() => LZString.compressToEncodedURIComponent(JSON5.stringify(toMinifiedInputUrlParams(urlParams))), [urlParams]);

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