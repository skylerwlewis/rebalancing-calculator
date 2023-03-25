import { useContext } from 'react';
import { createContext, PropsWithChildren, useMemo } from 'react';
import { FundInputItemStrings, InputContext, toStrings } from './InputProvider';
import LZString from 'lz-string';

type InputUrlParamContextState = {
  input: FundInputItemStrings[];
  inputUrlJsonString: string;
}

const initialInputState: InputUrlParamContextState = {
  input: [],
  inputUrlJsonString: ''
};

export const InputUrlParamContext = createContext<InputUrlParamContextState>(initialInputState);

const InputUrlParamProvider = ({ children }: PropsWithChildren<{}>) => {

  const { fundInputItems } = useContext(InputContext);

  const urlParams: FundInputItemStrings[] = useMemo(() => fundInputItems.map(toStrings), [fundInputItems]);

  const jsonString = useMemo(() => LZString.compressToEncodedURIComponent(JSON.stringify(urlParams)), [urlParams]);

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